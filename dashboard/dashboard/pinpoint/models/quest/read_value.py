# Copyright 2016 The Chromium Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

import json

from dashboard.pinpoint.models.quest import execution
from dashboard.pinpoint.models.quest import quest
from dashboard.services import isolate_service


class ReadValueError(Exception):

  pass


class ReadChartJsonValue(quest.Quest):

  def __init__(self, chart, tir_label=None, trace=None):
    self._chart = chart
    self._tir_label = tir_label
    self._trace = trace

  def __eq__(self, other):
    return (isinstance(other, type(self)) and
            self._chart == other._chart and
            self._tir_label == other._tir_label and
            self._trace == other._trace)

  def __str__(self):
    return 'Values'

  def Start(self, change, isolate_hash):
    del change
    return _ReadChartJsonValueExecution(self._chart, self._tir_label,
                                        self._trace, isolate_hash)


class _ReadChartJsonValueExecution(execution.Execution):

  def __init__(self, chart, tir_label, trace, isolate_hash):
    super(_ReadChartJsonValueExecution, self).__init__()
    self._chart = chart
    self._tir_label = tir_label
    self._trace = trace
    self._isolate_hash = isolate_hash

    self._trace_urls = []

  def _AsDict(self):
    if not self._trace_urls:
      return {}
    return {'traces': self._trace_urls}

  def _Poll(self):
    chartjson = _RetrieveOutputJson(self._isolate_hash, 'chartjson-output.json')

    # Get and cache any trace URLs.
    if 'trace' in chartjson['charts']:
      traces = chartjson['charts']['trace']
      traces = sorted(traces.iteritems(), key=lambda item: item[1]['page_id'])
      for name, details in traces:
        self._trace_urls.append({'name': name, 'url': details['cloud_url']})

    # Look up chart.
    if self._tir_label:
      chart_name = '@@'.join((self._tir_label, self._chart))
    else:
      chart_name = self._chart
    if chart_name not in chartjson['charts']:
      raise ReadValueError('The chart "%s" is not in the results.' % chart_name)

    # Look up trace.
    trace_name = self._trace or 'summary'
    if trace_name not in chartjson['charts'][chart_name]:
      raise ReadValueError('The trace "%s" is not in the results.' % trace_name)

    # Convert data to individual values.
    chart = chartjson['charts'][chart_name][trace_name]
    if chart['type'] == 'list_of_scalar_values':
      result_values = chart['values']
    elif chart['type'] == 'histogram':
      result_values = _ResultValuesFromHistogram(chart['buckets'])
    elif chart['type'] == 'scalar':
      result_values = [chart['value']]

    self._Complete(result_values=tuple(result_values))


def _ResultValuesFromHistogram(buckets):
  total_count = sum(bucket['count'] for bucket in buckets)

  result_values = []
  for bucket in buckets:
    # TODO: Assumes the bucket is evenly distributed.
    bucket_mean = (bucket['low'] + bucket.get('high', bucket['low'])) / 2
    if total_count > 10000:
      bucket_count = 10000 * bucket['count'] / total_count
    else:
      bucket_count = bucket['count']
    result_values += [bucket_mean] * bucket_count

  return tuple(result_values)


class ReadGraphJsonValue(quest.Quest):

  def __init__(self, chart, trace):
    self._chart = chart
    self._trace = trace

  def __eq__(self, other):
    return (isinstance(other, type(self)) and
            self._chart == other._chart and
            self._trace == other._trace)

  def __str__(self):
    return 'Values'

  def Start(self, change, isolate_hash):
    del change
    return _ReadGraphJsonValueExecution(self._chart, self._trace, isolate_hash)


class _ReadGraphJsonValueExecution(execution.Execution):

  def __init__(self, chart, trace, isolate_hash):
    super(_ReadGraphJsonValueExecution, self).__init__()
    self._chart = chart
    self._trace = trace
    self._isolate_hash = isolate_hash

  def _AsDict(self):
    return {}

  def _Poll(self):
    graphjson = _RetrieveOutputJson(self._isolate_hash, 'chartjson-output.json')

    if self._chart not in graphjson:
      raise ReadValueError('The chart "%s" is not in the results.' %
                           self._chart)
    if self._trace not in graphjson[self._chart]['traces']:
      raise ReadValueError('The trace "%s" is not in the results.' %
                           self._trace)
    result_value = float(graphjson[self._chart]['traces'][self._trace][0])

    self._Complete(result_values=(result_value,))


def _RetrieveOutputJson(isolate_hash, filename):
  output_files = isolate_service.Retrieve(isolate_hash)['files']

  if filename not in output_files:
    raise ReadValueError("The test didn't produce %s." % filename)
  output_json_isolate_hash = output_files[filename]['h']
  return json.loads(isolate_service.Retrieve(output_json_isolate_hash))
