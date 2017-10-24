# Copyright 2016 The Chromium Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

"""Quest and Execution for running a test in Swarming.

This is the only Quest/Execution where the Execution has a reference back to
modify the Quest.
"""

import collections
import copy

from dashboard.pinpoint.models.quest import execution as execution_module
from dashboard.pinpoint.models.quest import quest
from dashboard.services import swarming_service


class RunTestError(Exception):

  pass


class SwarmingTaskError(RunTestError):

  def __init__(self, task_id, state):
    self.task_id = task_id
    self.state = state
    super(SwarmingTaskError, self).__init__(
        'The swarming task %s failed with state "%s".' %
        (self.task_id, self.state))

  def __reduce__(self):
    # http://stackoverflow.com/a/36342588
    return SwarmingTaskError, (self.task_id, self.state)


class SwarmingTestError(RunTestError):

  def __init__(self, task_id, exit_code):
    self.task_id = task_id
    self.exit_code = exit_code
    super(SwarmingTestError, self).__init__(
        'The swarming task %s failed. The test exited with code %s.' %
        (self.task_id, self.exit_code))

  def __reduce__(self):
    # http://stackoverflow.com/a/36342588
    return SwarmingTestError, (self.task_id, self.exit_code)


class RunTest(quest.Quest):

  def __init__(self, dimensions, extra_args):
    self._dimensions = dimensions
    self._extra_args = extra_args

    # We want subsequent executions use the same bot as the first one.
    self._canonical_executions = []
    self._execution_counts = collections.defaultdict(int)

  def __eq__(self, other):
    return (isinstance(other, type(self)) and
            self._dimensions == other._dimensions and
            self._extra_args == other._extra_args and
            self._canonical_executions == other._canonical_executions and
            self._execution_counts == other._execution_counts)


  def __str__(self):
    return 'Test'

  def Start(self, change, isolate_hash):
    index = self._execution_counts[change]
    self._execution_counts[change] += 1

    # For results2 to differentiate between runs, we need telemetry to
    # append --results-label=foo to the runs. Since this is where we're given
    # the actual change that's being run, we look for the dummy
    # --results-label in extra_args and fill it in with the change string.
    # https://github.com/catapult-project/catapult/issues/3998
    extra_args = copy.copy(self._extra_args)
    try:
      results_label_index = self._extra_args.index('--results-label')
      extra_args[results_label_index+1] = str(change)
    except ValueError:
      # If it's not there, this is probably a gtest
      pass

    if len(self._canonical_executions) <= index:
      execution = _RunTestExecution(
          self._dimensions, extra_args, isolate_hash)
      self._canonical_executions.append(execution)
    else:
      execution = _RunTestExecution(
          self._dimensions, extra_args, isolate_hash,
          previous_execution=self._canonical_executions[index])

    return execution


class _RunTestExecution(execution_module.Execution):

  def __init__(self, dimensions, extra_args, isolate_hash,
               previous_execution=None):
    super(_RunTestExecution, self).__init__()
    self._dimensions = dimensions
    self._extra_args = extra_args
    self._isolate_hash = isolate_hash
    self._previous_execution = previous_execution

    self._task_id = None
    self._bot_id = None

  @property
  def bot_id(self):
    return self._bot_id

  def _AsDict(self):
    return {
        'bot_id': self._bot_id,
        'task_id': self._task_id,
    }

  def _Poll(self):
    if not self._task_id:
      self._StartTask()
      return

    result = swarming_service.Task(self._task_id).Result()

    if 'bot_id' in result:
      # Set bot_id to pass the info back to the Quest.
      self._bot_id = result['bot_id']

    if result['state'] == 'PENDING' or result['state'] == 'RUNNING':
      return

    if result['state'] != 'COMPLETED':
      raise SwarmingTaskError(self._task_id, result['state'])

    if result['failure']:
      raise SwarmingTestError(self._task_id, result['exit_code'])

    isolate_hash = result['outputs_ref']['isolated']

    result_arguments = {'isolate_hash': isolate_hash}
    self._Complete(result_arguments=result_arguments)


  def _StartTask(self):
    """Kick off a Swarming task to run a test."""
    if self._previous_execution and not self._previous_execution.bot_id:
      if self._previous_execution.failed:
        # If the previous Execution fails before it gets a bot ID, it's likely
        # it couldn't find any device to run on. Subsequent Executions probably
        # wouldn't have any better luck, and failing fast is less complex than
        # handling retries.
        raise RunTestError('There are no bots available to run the test.')
      else:
        return

    dimensions = [{'key': 'pool', 'value': 'Chrome-perf-pinpoint'}]
    if self._previous_execution:
      dimensions.append({
          'key': 'id',
          'value': self._previous_execution.bot_id
      })
    else:
      dimensions += self._dimensions

    body = {
        'name': 'Pinpoint job',
        'user': 'Pinpoint',
        'priority': '100',
        'expiration_secs': '36000',  # 10 hours.
        'properties': {
            'inputs_ref': {'isolated': self._isolate_hash},
            'extra_args': self._extra_args,
            'dimensions': dimensions,
            'execution_timeout_secs': '7200',  # 2 hours.
            'io_timeout_secs': '3600',
        },
    }
    response = swarming_service.Tasks().New(body)

    self._task_id = response['task_id']
