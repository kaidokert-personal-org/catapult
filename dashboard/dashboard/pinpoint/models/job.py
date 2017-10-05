# Copyright 2016 The Chromium Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

import collections
import datetime
import logging
import os
import traceback
import uuid

from google.appengine.api import taskqueue
from google.appengine.ext import ndb
from google.appengine.runtime import apiproxy_errors

from dashboard.common import utils
from dashboard.pinpoint.models import attempt as attempt_module
from dashboard.pinpoint.models import change as change_module
from dashboard.pinpoint.models import mann_whitney_u
from dashboard.services import gitiles_service
from dashboard.services import issue_tracker_service


# We want this to be fast to minimize overhead while waiting for tasks to
# finish, but don't want to consume too many resources.
_TASK_INTERVAL = 10


_DEFAULT_REPEAT_COUNT = 15
_SIGNIFICANCE_LEVEL = 0.001


_DIFFERENT = 'different'
_PENDING = 'pending'
_SAME = 'same'
_UNKNOWN = 'unknown'


_CRYING_CAT_FACE = u'\U0001f63f'
_MIDDLE_DOT = u'\xb7'
_ROUND_PUSHPIN = u'\U0001f4cd'


def JobFromId(job_id):
  """Get a Job object from its ID. Its ID is just its key as a hex string.

  Users of Job should not have to import ndb. This function maintains an
  abstraction layer that separates users from the Datastore details.
  """
  job_key = ndb.Key('Job', int(job_id, 16))
  return job_key.get()


class Job(ndb.Model):
  """A Pinpoint job."""

  created = ndb.DateTimeProperty(required=True, auto_now_add=True)
  # Don't use `auto_now` for `updated`. When we do data migration, we need
  # to be able to modify the Job without changing the Job's completion time.
  updated = ndb.DateTimeProperty(required=True, auto_now_add=True)

  # The name of the Task Queue task this job is running on. If it's present, the
  # job is running. The task is also None for Task Queue retries.
  task = ndb.StringProperty()

  # The string contents of any Exception that was thrown to the top level.
  # If it's present, the job failed.
  exception = ndb.TextProperty()

  # Request parameters.
  arguments = ndb.JsonProperty(required=True)

  repeat_count = ndb.IntegerProperty(required=True)

  # If True, the service should pick additional Changes to run (bisect).
  # If False, only run the Changes explicitly added by the user.
  auto_explore = ndb.BooleanProperty(required=True)

  # TODO: The bug id is only used for posting bug comments when a job starts and
  # completes. This probably should not be the responsibility of Pinpoint.
  bug_id = ndb.IntegerProperty()

  state = ndb.PickleProperty(required=True)

  @classmethod
  def New(cls, arguments, quests, auto_explore,
          repeat_count=_DEFAULT_REPEAT_COUNT, bug_id=None):
    repeat_count = repeat_count or _DEFAULT_REPEAT_COUNT
    # Create job.
    return cls(
        arguments=arguments,
        auto_explore=auto_explore,
        repeat_count=repeat_count,
        bug_id=bug_id,
        state=_JobState(quests, repeat_count))

  @property
  def job_id(self):
    return '%x' % self.key.id()

  @property
  def status(self):
    if self.task:
      return 'Running'

    if self.exception:
      return 'Failed'

    return 'Completed'

  @property
  def url(self):
    return 'https://%s/job/%s' % (os.environ['HTTP_HOST'], self.job_id)

  def AddChange(self, change):
    self.state.AddChange(change)

  def Start(self):
    self._Schedule()

    title = _ROUND_PUSHPIN + ' Pinpoint job started.'
    comment = '\n'.join((title, self.url))
    self._PostBugComment(comment, send_email=False)

  def _Complete(self):
    # Format bug comment.

    # Include list of Changes.
    differences = tuple(self.state.Differences())

    # Header.
    if differences:
      if len(differences) == 1:
        status = 'Found a significant difference after 1 commit.'
      else:
        status = ('Found significant differences after each of %d commits.' %
                  len(differences))
    else:
      status = "Couldn't reproduce a difference."

    title = '<b>%s %s</b>' % (_ROUND_PUSHPIN, status)
    header = '\n'.join((title, self.url))

    # Body.
    change_details = []
    for _, change in differences:
      change_details.append(_FormatChangeForBug(change))
    body = '\n\n'.join(change_details)

    # Footer.
    if differences:
      footer = ('Understanding performance regressions:\n'
                '  http://g.co/ChromePerformanceRegressions')
    else:
      footer = ''

    # Bring it all together.
    comment = '\n\n'.join(section for section in (header, body, footer)
                          if section)
    self._PostBugComment(comment)

  def _Fail(self):
    self.exception = traceback.format_exc()

    title = _CRYING_CAT_FACE + ' Pinpoint job stopped with an error.'
    comment = '\n'.join((title, self.url))
    self._PostBugComment(comment)

  def _Schedule(self):
    # Set a task name to deduplicate retries. This adds some latency, but we're
    # not latency-sensitive. If Job.Run() works asynchronously in the future,
    # we don't need to worry about duplicate tasks.
    # https://github.com/catapult-project/catapult/issues/3900
    task_name = str(uuid.uuid4())
    try:
      task = taskqueue.add(
          queue_name='job-queue', url='/api/run/' + self.job_id,
          name=task_name, countdown=_TASK_INTERVAL)
    except apiproxy_errors.DeadlineExceededError:
      task = taskqueue.add(
          queue_name='job-queue', url='/api/run/' + self.job_id,
          name=task_name, countdown=_TASK_INTERVAL)

    self.task = task.name

  def Run(self):
    self.exception = None  # In case the Job succeeds on retry.
    self.task = None  # In case an exception is thrown.

    try:
      if self.auto_explore:
        self.state.Explore()
      work_left = self.state.ScheduleWork()

      # Schedule moar task.
      if work_left:
        self._Schedule()
      else:
        self._Complete()
    except BaseException:
      self._Fail()
      raise
    finally:
      # Don't use `auto_now` for `updated`. When we do data migration, we need
      # to be able to modify the Job without changing the Job's completion time.
      self.updated = datetime.datetime.now()

  def AsDict(self, include_state=True):
    d = {
        'job_id': self.job_id,

        'arguments': self.arguments,
        'auto_explore': self.auto_explore,
        'bug_id': self.bug_id,

        'created': self.created.isoformat(),
        'updated': self.updated.isoformat(),
        'exception': self.exception,
        'status': self.status,
    }
    if include_state:
      d.update(self.state.AsDict())
    return d

  def _PostBugComment(self, comment, send_email=True):
    if not self.bug_id:
      return

    issue_tracker = issue_tracker_service.IssueTrackerService(
        utils.ServiceAccountHttp())
    issue_tracker.AddBugComment(self.bug_id, comment, send_email=send_email)


class _JobState(object):
  """The internal state of a Job.

  Wrapping the entire internal state of a Job in a PickleProperty allows us to
  use regular Python objects, with constructors, dicts, and object references.

  We lose the ability to index and query the fields, but it's all internal
  anyway. Everything queryable should be on the Job object.
  """

  def __init__(self, quests, repeat_count):
    """Create a _JobState.

    Args:
      quests: A sequence of quests to run on each Change.
      repeat_count: The number of attempts to automatically run per Change.
    """
    # _quests is mutable. Any modification should mutate the existing list
    # in-place rather than assign a new list, because every Attempt references
    # this object and will be updated automatically if it's mutated.
    self._quests = list(quests)

    # _changes can be in arbitrary order. Client should not assume that the
    # list of Changes is sorted in any particular order.
    self._changes = []

    # A mapping from a Change to a list of Attempts on that Change.
    self._attempts = {}

    self._repeat_count = repeat_count

  def AddAttempt(self, change):
    assert change in self._attempts
    self._attempts[change].append(attempt_module.Attempt(self._quests, change))

  def AddChange(self, change, index=None):
    if index:
      self._changes.insert(index, change)
    else:
      self._changes.append(change)

    self._attempts[change] = []
    for _ in xrange(self._repeat_count):
      self.AddAttempt(change)

  def Explore(self):
    """Compare Changes and bisect by adding additional Changes as needed.

    For every pair of adjacent Changes, compare their results as probability
    distributions. If the results are different, find the midpoint of the
    Changes and add it to the Job.

    The midpoint can only be added if the second Change represents a commit that
    comes after the first Change. Otherwise, this method won't explore further.
    For example, if Change A is repo@abc, and Change B is repo@abc + patch,
    there's no way to pick additional Changes to try.
    """
    # This loop adds Changes to the _changes list while looping through it.
    # The Change insertion simultaneously uses and modifies the list indices.
    # However, the loop index goes in reverse order and Changes are only added
    # after the loop index, so the loop never encounters the modified items.
    for index, change_b in reversed(tuple(self.Differences())):
      change_a = self._changes[index - 1]

      try:
        midpoint = change_module.Change.Midpoint(change_a, change_b)
      except change_module.NonLinearError:
        continue

      logging.info('Adding Change %s.', midpoint)
      self.AddChange(midpoint, index)

  def ScheduleWork(self):
    work_left = False
    for attempts in self._attempts.itervalues():
      for attempt in attempts:
        if attempt.completed:
          continue

        attempt.ScheduleWork()
        work_left = True

    return work_left

  def Differences(self):
    """Compares every pair of Changes and yields ones with different results.

    This method loops through every pair of adjacent Changes. If they have
    statistically different results, this method yields the latter one (which is
    assumed to have caused the difference).

    Yields:
      Tuples of (change_index, Change).
    """
    for index in xrange(1, len(self._changes)):
      change_a = self._changes[index - 1]
      change_b = self._changes[index]
      if self._Compare(change_a, change_b) == _DIFFERENT:
        yield index, change_b

  def AsDict(self):
    comparisons = []
    for index in xrange(1, len(self._changes)):
      change_a = self._changes[index - 1]
      change_b = self._changes[index]
      comparisons.append(self._Compare(change_a, change_b))

    # result_values is a 3D array. result_values[change][quest] is a list of
    # all the result values for that Change and Quest.
    result_values = []
    for change in self._changes:
      change_result_values = []

      change_results_per_quest = _CombineResultsPerQuest(self._attempts[change])
      for quest in self._quests:
        change_result_values.append(change_results_per_quest[quest])

      result_values.append(change_result_values)

    attempts = []
    for c in self._changes:
      attempts.append([attempt.AsDict() for attempt in self._attempts[c]])

    return {
        'quests': map(str, self._quests),
        'changes': [change.AsDict() for change in self._changes],
        # TODO: Use JobState.Differences().
        'comparisons': comparisons,
        'result_values': result_values,
        'attempts': attempts,
    }

  def _Compare(self, change_a, change_b):
    attempts_a = self._attempts[change_a]
    attempts_b = self._attempts[change_b]

    if any(not attempt.completed for attempt in attempts_a + attempts_b):
      return _PENDING

    # Compare exceptions.
    exceptions_a = tuple(bool(attempt.exception) for attempt in attempts_a)
    exceptions_b = tuple(bool(attempt.exception) for attempt in attempts_b)

    if _CompareValues(exceptions_a, exceptions_b) == _DIFFERENT:
      return _DIFFERENT

    # Compare values.
    results_a = _CombineResultsPerQuest(attempts_a)
    results_b = _CombineResultsPerQuest(attempts_b)

    if any(_CompareValues(results_a[quest], results_b[quest]) == _DIFFERENT
           for quest in self._quests):
      return _DIFFERENT

    # Here, "the same" means that we fail to reject the null hypothesis. We can
    # never be completely sure that the two Changes have the same results, but
    # we've run everything that we planned to, and didn't detect any difference.
    if (len(attempts_a) >= self._repeat_count and
        len(attempts_b) >= self._repeat_count):
      return _SAME

    return _UNKNOWN


def _FormatChangeForBug(change):
  # TODO: Store the commit info in the Commit.
  commit = change.last_commit
  commit_info = gitiles_service.CommitInfo(commit.repository_url,
                                           commit.git_hash)
  subject = '<b>%s</b>' % commit_info['message'].split('\n', 1)[0]
  author = commit_info['author']['email']
  time = commit_info['committer']['time']

  byline = 'By %s %s %s' % (author, _MIDDLE_DOT, time)
  git_link = commit.repository + ' @ ' + commit.git_hash
  return '\n'.join((subject, byline, git_link))


def _CombineResultsPerQuest(attempts):
  aggregate_results = collections.defaultdict(list)
  for attempt in attempts:
    if not attempt.completed:
      continue

    for quest, results in attempt.result_values.iteritems():
      aggregate_results[quest] += results

  return aggregate_results


def _CompareValues(values_a, values_b):
  if not (values_a and values_b):
    return _UNKNOWN

  try:
    p_value = mann_whitney_u.MannWhitneyU(values_a, values_b)
  except ValueError:
    return _UNKNOWN

  if p_value < _SIGNIFICANCE_LEVEL:
    return _DIFFERENT
  else:
    return _UNKNOWN
