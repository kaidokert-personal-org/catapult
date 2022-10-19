# Copyright 2013 The Chromium Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

# pylint: disable=import-error
# pylint: disable=no-name-in-module
from __future__ import print_function
from __future__ import absolute_import
import distutils.spawn as spawn
import logging
import os
import re
import stat
import subprocess
import sys

from telemetry.internal.platform import desktop_platform_backend


def _BinaryExistsInSudoersFiles(path, sudoers_file_contents):
  """Returns True if the binary in |path| features in the sudoers file.
  """
  for line in sudoers_file_contents.splitlines():
    if re.match(r'\s*\(.+\) NOPASSWD: %s(\s\S+)*$' % re.escape(path), line):
      return True
  return False


def _CanRunElevatedWithSudo(path, platform_backend=None):
  """Returns True if the binary at |path| appears in the sudoers file.
  If this function returns true then the binary at |path| can be run via sudo
  without prompting for a password.
  """
  cmd = ['/usr/bin/sudo', '-l']
  if platform_backend and platform_backend.has_interface:
    rc, sudoers, _= platform_backend.interface.RunCmdOnDevice(cmd)
    sudoers = sudoers.strip()
    assert rc == 0, 'sudo -l failed to execute'
  else:
    sudoers = subprocess.check_output(cmd)
  return _BinaryExistsInSudoersFiles(path, sudoers)


class PosixPlatformBackend(desktop_platform_backend.DesktopPlatformBackend):

  # This is an abstract class. It is OK to have abstract methods.
  # pylint: disable=abstract-method

  def HasRootAccess(self):
    if self.has_interface:
      stdout, _  = self.interface.RunCmdOnDevice(['echo', '$UID'])
      return stdout.strip() == 0
    return os.getuid() == 0

  def RunCommandWithRC(self, args):
    if self.has_interface:
      return self.interface.RunCmdOnDeviceWithRC(args)
    p = subprocess.Popen(args, stdout=subprocess.PIPE)
    return p.returncode, p.stdout, p.stderr

  def RunCommand(self, args):
    return self.RunCommandWithRC(args)[1]

  def GetFileContents(self, path):
    if self.has_interface:
      return self.interface.GetFileContents(path)

    with open(path, 'r') as f:
      return f.read()

  def FindApplication(self, application):
    if self.has_interface:
      _, stdout, _ = self.interface.RunCmdOnDeviceWithRC(['which', application])
      return stdout
    return spawn.find_executable(application)

  def CanLaunchApplication(self, application):
    return bool(self.FindApplication(application))

  def LaunchApplication(
      self, application, parameters=None, elevate_privilege=False):
    assert application, 'Must specify application to launch'

    if os.path.sep not in application:
      application = self.FindApplication(application)
      assert application, 'Failed to find application in path'

    args = [application]

    if parameters:
      assert isinstance(parameters, list), 'parameters must be a list'
      args += parameters

    def IsElevated():
      """ Returns True if the current process is elevated via sudo i.e. running
      sudo will not prompt for a password. Returns False if not authenticated
      via sudo or if telemetry is run on a non-interactive TTY."""
      # `sudo -v` will always fail if run from a non-interactive TTY.
      rc, stdout, stderr = self.RunCommandWithRC(
          ['/usr/bin/sudo', '-nv'])
      stdout += stderr
      # Some versions of sudo set the returncode based on whether sudo requires
      # a password currently. Other versions return output when password is
      # required and no output when the user is already authenticated.
      return rc and not stdout

    def IsSetUID(path):
      """Returns True if the binary at |path| has the setuid bit set."""
      if not self.IsRemoteDevice():
        return (os.stat(path).st_mode & stat.S_ISUID) == stat.S_ISUID
      dirname, basename = os.path.split(path)
      stdout, _ = self.RunCommand(['find', dirname, '-perm', '/4000',
                                 '-name', basename
                                 ])
      return stdout.strip == path


    if elevate_privilege and not IsSetUID(application):
      if self.has_interface and not self.interface.local:
        logging.warning('Non-local platform interface is always running root')
      else:
        args = ['/usr/bin/sudo'] + args
        if not _CanRunElevatedWithSudo(application, platform_backend=self) and not IsElevated():
          if not sys.stdout.isatty():
            # Without an interactive terminal (or a configured 'askpass', but
            # that is rarely relevant), there's no way to prompt the user for
            # sudo. Fail with a helpful error message. For more information, see:
            #   https://code.google.com/p/chromium/issues/detail?id=426720
            text = (
                'Telemetry needs to run %s with elevated privileges, but the '
                'setuid bit is not set and there is no interactive terminal '
                'for a prompt. Please ask an administrator to set the setuid '
                'bit on this executable and ensure that it is owned by a user '
                'with the necessary privileges. Aborting.' % application)
            print(text)
            raise Exception(text)
          # Else, there is a tty that can be used for a useful interactive prompt.
          print('Telemetry needs to run %s under sudo. Please authenticate.' %
                application)
          # Synchronously authenticate.
          subprocess.check_call(['/usr/bin/sudo', '-v'])

    if self.has_interface:
      return self.interface.StartCmd(args)
    else:
      stderror_destination = subprocess.PIPE
      if logging.getLogger().isEnabledFor(logging.DEBUG):
        stderror_destination = None
      return subprocess.Popen(
                  args, stdout=subprocess.PIPE, stderr=stderror_destination)
