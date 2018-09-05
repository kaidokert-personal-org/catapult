A standalone WebApp for viewing chrome://net-export
[NetLog](https://www.chromium.org/developers/design-documents/network-stack/netlog) dump files
============

Introduction
------------
This is a WebApp that allows someone to perform post-mortem analysis of a
saved NetLog dump. The initial code was taken out of Chromium.
The code should contain all changes made to net-internals up to chromium commit
940b87bb7cb870e5d4415e238e192651a093db05. The full design doc can be found
[here](https://docs.google.com/document/d/1Ll7T5cguj5m2DqkUTad5DWRCqtbQ3L1q9FRvTN5-Y28/edit#).

Suggested merge steps:

1.
```
cd CHROME_DIR/chrome/browser/resources/net_internals
git diff --relative --src-prefix="a/netlog_viewer/netlog_viewer/"\
--dst-prefix="b/netlog_viewer/netlog_viewer/"\
R1 R2 . > diff.txt
```
where R1 and R2 are Chromium commit hashes.

2.
```
cd CATAPULT_DIR;
git apply --reject --whitespace=fix diff.txt
```

3.
Manually merge any rejected chunks in `*.rej` files.

4.
```
cd CHROME_DIR/chrome/test/data/webui/net_internals
git diff --relative R1 R2 . > test-diff.txt
```

5.
edit test-diff.txt and convert the filenames to match, for example: log_view_painter.js
-> log_view_painter_test.html, and remove diff chunks for tests that don't exist
in the catapult repo.

6.
```
cd CATAPULT_DIR/netlog_viewer/netlog_viewer
git apply --reject --whitespace=fix test-diff.txt
```

7.
Manually merge any rejected chunks in `*.rej` files.

8.
Run netlog_viewer/bin/run_dev_server_tests and fix any failures that weren't
already present before starting the merge.

9.
Start a server for the webapp and open in Chrome (see Workflow section), load a
netlog file, and manually verify that everything looks fine.


Motivation
------------
There are a few problems with the current system of logging network events
within Chromium (see chrome://net-internals) that motivated the design and
creation of this new project:
- Attempting to add new and improved functionalities to network logging within
Chromium comes at the cost of bloating the Chromium binaries.
- The renderer process behind chrome://net-internals is privileged meaning it
can ask the browser process to do more--monitoring networking events in this
case. Generally, privileged UI on Chrome should be minmially complex and
small in size, but a large chunk of chrome://net-internals is neither leaving
behind a rather large attack surface.
- The lack of chrome://net-export on desktop as outlined in an
[issue](https://bugs.chromium.org/p/chromium/issues/detail?id=472706)

Workflow
--------------
To use this WebApp effectively, the first step is having a NetLog dump to use.
To export a NetLog dump you can capture events and load them into a file
using chrome://net-internals/#export (soon to be chrome://net-export).

Once you have a log file you can use this WebApp to load it for analysis.
To do that you need to first git clone into the catapult repository:

git clone https://github.com/catapult-project/catapult.git

Then go to the directory that contains this WebApp by using the cd command:

cd path_to_catapult/catapult/netlog_viewer

Serve the files from an HTTP localhost server with:

python -m SimpleHTTPServer 8080

Visit http://localhost:8080/index.html in your web browser to view the
netlog viewer. You will be able to click "Choose File" which will allow you to
select the file you exported earlier. From there your NetLog dump will appear
as a table filled with all the dump's information. Visit the other tabs to
view additional information! There are seven tabs that are currently fully
functional (Import, Events, Proxy, Timeline, DNS, Sockets, Cache).
