/* Copyright 2018 The Chromium Authors. All rights reserved.
   Use of this source code is governed by a BSD-style license that can be
   found in the LICENSE file.
*/
'use strict';

// Use native shadow DOM to encapsulate web components instead of the slower
// shady DOM.
window.Polymer = {dom: 'shadow'};
window.addEventListener('load', () => {
  const loadTimes = Object.entries(performance.timing.toJSON()).filter(p =>
    p[1] > 0);
  loadTimes.sort((a, b) => a[1] - b[1]);
  const start = loadTimes.shift()[1];
  for (const [name, timeStamp] of loadTimes) {
    tr.b.Timing.mark('load', name, start).end(timeStamp);
  }
});

// Google Analytics
// const trackingId = 'UA-98760012-3'; // production
const trackingId = 'UA-122828291-1'; // development

window.ga = window.ga || function() {
  ga.q = ga.q || [];
  ga.q.push(arguments);
};
ga.l = new Date();
ga('create', trackingId, 'auto');
ga('send', 'pageview');
(function() {
  // Write this script tag at runtime instead of in HTML in order to bypass the
  // vulcanizer.
  const script = document.createElement('script');
  script.src = 'https://www.google-analytics.com/analytics.js';
  script.type = 'text/javascript';
  script.async = true;
  document.head.appendChild(script);
})();

// Register the Service Worker in production.
if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
  window.swChannel = new BroadcastChannel('service-worker');

  (async() => {
    const [clientId] = await Promise.all([
      new Promise(resolve => ga(tracker => resolve(tracker.get('clientId')))),
      navigator.serviceWorker.register('service-worker.js'),
    ]);

    window.swChannel.postMessage({
      type: 'GOOGLE_ANALYTICS',
      payload: {
        trackingId,
        clientId,
      },
    });
  })();
}

