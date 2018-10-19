# Copyright 2018 The Chromium Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

import csv
import json
import ntpath
import posixpath

from pinpoint_cli import histograms_df
from pinpoint_cli import job_results


def DownloadJobResultsAsCsv(api, job_ids, output_file):
  """Download the perf results of a job as a csv file."""
  with open(output_file, 'wb') as f:
    writer = csv.writer(f)
    writer.writerow(('job_id', 'change', 'isolate') + histograms_df.COLUMNS)
    num_rows = 0
    for job_id in job_ids:
      job = api.pinpoint.Job(job_id, with_state=True)
      os_path = _OsPathFromJob(job)
      results_file = os_path.join(
          job['arguments']['benchmark'], 'perf_results.json')
      print 'Fetching results for %s job %s:' % (job['status'].lower(), job_id)
      for change_id, isolate_hash in job_results.IterTestOutputIsolates(job):
        print '- isolate: %s ...' % isolate_hash
        histograms = api.isolate.RetrieveFile(isolate_hash, results_file)
        for row in histograms_df.IterRows(json.loads(histograms)):
          writer.writerow((job_id, change_id, isolate_hash) + row)
          num_rows += 1
  print 'Wrote data from %d histograms in %s.' % (num_rows, output_file)


def _OsPathFromJob(job):
  if job['arguments']['configuration'].lower().startswith('win'):
    return ntpath
  else:
    return posixpath
