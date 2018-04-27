# Copyright 2016 The Chromium Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

import json

from dashboard.api import api_auth
from dashboard.api import api_request_handler
from dashboard.common import namespaced_stored_object
from dashboard.pinpoint.models import change
from dashboard.pinpoint.models import job as job_module
from dashboard.pinpoint.models import quest as quest_module


_BOT_CONFIGURATIONS = 'bot_configurations'


_ERROR_BUG_ID = 'Bug ID must be an integer.'
_ERROR_TAGS_DICT = 'Tags must be a dict of key/value string pairs.'


class New(api_request_handler.ApiRequestHandler):
  """Handler that cooks up a fresh Pinpoint job."""

  def AuthorizedPost(self):
    try:
      job = _CreateJob(self.request)
      job.Start()

      return {
          'jobId': job.job_id,
          'jobUrl': job.url,
      }
    except (KeyError, TypeError, ValueError) as e:
      raise api_request_handler.BadRequestError(e.message)


def _CreateJob(request):
  """Creates a new Pinpoint job from WebOb request arguments."""
  original_arguments = request.params.mixed()
  arguments = _ArgumentsWithConfiguration(original_arguments)

  # Validate arguments and convert them to canonical internal representation.
  quests = _GenerateQuests(arguments)
  changes = _ValidateChanges(arguments)
  auto_explore = _ParseBool(arguments.get('auto_explore'))
  bug_id = _ValidateBugId(arguments.get('bug_id'))
  comparison_mode = _ValidateComparisonMode(arguments.get('comparison_mode'))
  tags = _ValidateTags(arguments.get('tags'))
  user = _ValidateUser(arguments.get('user'))

  # Create job.
  return job_module.Job.New(
      quests,
      changes,
      arguments=original_arguments,
      auto_explore=auto_explore,
      bug_id=bug_id,
      comparison_mode=comparison_mode,
      tags=tags,
      user=user)


def _ArgumentsWithConfiguration(original_arguments):
  # "configuration" is a special argument that maps to a list of preset
  # arguments. Pull any arguments from the specified "configuration", if any.
  configuration = original_arguments.get('configuration')
  if configuration:
    configurations = namespaced_stored_object.Get(_BOT_CONFIGURATIONS)
    new_arguments = configurations[configuration]
  else:
    new_arguments = {}

  # Override the configuration arguments with the API-provided arguments.
  new_arguments.update(original_arguments)

  return new_arguments


def _ParseBool(value):
  return value == '1' or value.lower() == 'true'


def _ValidateBugId(bug_id):
  if not bug_id:
    return None

  try:
    return int(bug_id)
  except ValueError:
    raise ValueError(_ERROR_BUG_ID)


def _ValidateChanges(arguments):
  changes = arguments.get('changes')
  if changes:
    return [change.Change.FromDict(c) for c in json.loads(changes)]

  change_1 = {
      'commits': [{
          'repository': arguments.get('repository'),
          'git_hash': arguments.get('start_git_hash')
      }],
  }

  change_2 = {
      'commits': [{
          'repository': arguments.get('repository'),
          'git_hash': arguments.get('end_git_hash')
      }]
  }

  if arguments.get('patch'):
    change_2['patch'] = arguments.get('patch')

  return (change.Change.FromDict(change_1), change.Change.FromDict(change_2))


def _ValidateComparisonMode(comparison_mode):
  if not comparison_mode:
    return None
  if comparison_mode == 'functional':
    return job_module.ComparisonMode.FUNCTIONAL
  if comparison_mode == 'performance':
    return job_module.ComparisonMode.PERFORMANCE
  raise ValueError('`comparison_mode` should be "functional", '
                   '"performance", or None. Got "%s".' % comparison_mode)


def _GenerateQuests(arguments):
  """Generate a list of Quests from a dict of arguments.

  GenerateQuests uses the arguments to infer what types of Quests the user wants
  to run, and creates a list of Quests with the given configuration.

  Arguments:
    arguments: A dict or MultiDict containing arguments.

  Returns:
    A tuple of (arguments, quests), where arguments is a dict containing the
    request arguments that were used, and quests is a list of Quests.
  """
  target = arguments.get('target')
  if target in ('telemetry_perf_tests', 'telemetry_perf_webview_tests'):
    quest_classes = (quest_module.FindIsolate, quest_module.RunTelemetryTest,
                     quest_module.ReadHistogramsJsonValue)
  else:
    quest_classes = (quest_module.FindIsolate, quest_module.RunGTest,
                     quest_module.ReadGraphJsonValue)

  quests = []
  for quest_class in quest_classes:
    quest = quest_class.FromDict(arguments)
    if not quest:
      break
    quests.append(quest)

  return quests


def _ValidateTags(tags):
  if not tags:
    return {}

  tags_dict = json.loads(tags)

  if not isinstance(tags_dict, dict):
    raise ValueError(_ERROR_TAGS_DICT)

  for k, v in tags_dict.iteritems():
    if not isinstance(k, basestring) or not isinstance(v, basestring):
      raise ValueError(_ERROR_TAGS_DICT)

  return tags_dict


def _ValidateUser(user):
  return user or api_auth.Email()
