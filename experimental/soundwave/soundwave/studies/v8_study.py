# Copyright 2018 The Chromium Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

ANDROID_GO = 'ChromiumPerf/android-go-perf'
V8_EFFECTIVE_SIZE = (
    'memory:chrome:renderer_processes:reported_by_chrome:v8:effective_size')


TEST_SUITES = {
    'system_health.memory_mobile': [
        V8_EFFECTIVE_SIZE],
    'system_health.common_mobile': [
        'timeToFirstContentfulPaint', 'timeToFirstMeaningfulPaint',
        'timeToInteractive'],
    'v8.browsing_mobile': [
        'Total:duration', 'V8-Only:duration', V8_EFFECTIVE_SIZE]
}


def GetEmergingMarketStories(api):
  description = api.dashboard.Describe('system_health.memory_mobile')
  return description['caseTags']['emerging_market']


def IterTestPaths(api):
  # We want to track emerging market stories only.
  stories = GetEmergingMarketStories(api)

  for test_suite, measurements in TEST_SUITES.iteritems():
    # v8.browsing_mobile only runs 'browse:*' stories, while other benchmarks
    # run all of them.
    browse_only = 'browsing' in test_suite
    for story in stories:
      if browse_only and not story.startswith('browse:'):
        continue
      parts = story.split(':')
      story_group, story_name = '_'.join(parts[:2]), '_'.join(parts)
      for measurement in measurements:
        yield '/'.join([
            ANDROID_GO, test_suite, measurement, story_group, story_name])
