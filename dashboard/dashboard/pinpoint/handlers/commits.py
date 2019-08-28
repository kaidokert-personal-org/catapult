# Copyright 2019 The Chromium Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

from __future__ import print_function
from __future__ import division
from __future__ import absolute_import

from dashboard.api import api_request_handler
from dashboard.pinpoint.models import change


class Commits(api_request_handler.ApiRequestHandler):

  def _CheckUser(self):
    pass

  def Post(self):
    c1 = change.Commit.FromDict({
        'repository': 'chromium',
        'git_hash': self.request.get('start_git_hash'),
    })
    c2 = change.Commit.FromDict({
        'repository': 'chromium',
        'git_hash': self.request.get('end_git_hash'),
    })
    return change.Commit.CommitRange(c1, c2)
