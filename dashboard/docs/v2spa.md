The next version of the Chromeperf Dashboard is at the prototype stage,
available for preview at https://v2spa-dot-chromeperf.appspot.com .

In order to develop or deploy v2spa, a one-time setup is required:
```
pushd common/node_runner/node_runner
npm install
sed -i 's/ecmaVersion: 6/ecmaVersion: 9/g' node_modules/hydrolysis/lib/ast-utils/js-parse.js
popd
pushd dashboard
ln -sf ../third_party/polymer-svg-template
ln -sf ../third_party/polymer2
ln -sf ../third_party/polymer2/bower_components
ln -sf ../third_party/redux
ln -sf ../third_party/redux/redux.min.js
ln -sf ../tracing/third_party/gl-matrix/dist/gl-matrix-min.js
ln -sf ../tracing/third_party/mannwhitneyu
ln -sf ../tracing/tracing
ln -sf ../tracing/tracing_project.py
popd
```

In order to deploy app.yaml to v2spa-dot-chromeperf.appspot.com, run
`dashboard/bin/deploy`. That serves a vulcanized HTML file at `/` and the
same script request handlers as V1, which is configured in app.yaml and
continues to be deployed to chromeperf.appspot.com by `dashboard/bin/deploy`.

In order to develop v2spa locally, run `dev_appserver.py v2spa_dev.yaml` to
serve the unvulcanized sources at http://localhost:8080 to speed up reloading
changes. `v2spa_dev.yaml` is not intended to be deployed even to a dev instance.
When running on localhost, V2SPA does not send requests to the backend, so no
script request handlers are needed.
