/* Copyright 2018 The Chromium Authors. All rights reserved.
   Use of this source code is governed by a BSD-style license that can be
   found in the LICENSE file.
*/
'use strict';
tr.exportTo('cp', () => {
  const MS_PER_SECOND = 1000;
  const MS_PER_MINUTE = 60 * MS_PER_SECOND;
  const MS_PER_HOUR = 60 * MS_PER_MINUTE;
  const MS_PER_DAY = 24 * MS_PER_HOUR;
  const MS_PER_MONTH = 30 * MS_PER_DAY;

  // TODO share this with api/describe.py? Make AlertsRequestHandler
  // descriptorify alert test paths?
  const PARTIAL_TEST_SUITE_HASHES = [
    '6f3defc338a36507ed61085b6b29e9ac0cd8a95066f557ac6a664deafc9fc503',
    '84bcb2064732acc3a77dc629e27851e535a6b13e2f808d96c2437bed0319eb4a',
    'e9cfb0c1c412e5e049819a87c78d32d9aa12ce0e0c4a47277c7e6cd1ee22129f',
    '127edf76c9bfd5f39ce2112c67d09abed4f704360b182bb923f2af14811c8d47',
    '89d460df708abdf78bbc722c755324614c179c8d5c523120ae9e3882d4f4a920',
    '8cac414e9a2b4f0bd4cb8e065cab051ede705f3be766d47d15d66db47baec752',
    'db60c2e6510f122cc91c601f7234cb82e87a40ddcc59c7df46ff98eccf37122a',
    'a3eb4c22d502c1b1bae7afb42a31aa69b37a461002bef65e61f561dbae54f353',
    '33a41e925be99297177ae7718318f7c15f73817bf33ef40c5274e0a68c4fad50',
    'cb948a7c86446f5a6c120ca77dfea5024f942c555a0139d725dbfb29c0db7d74',
    '210a6ef892487b9a0ab882f6c724034a3bcdca1bbed6d8a3c4a48fc97214da9b',
    '93379b402f117fe6a4fafb0673dcb6e91a7396067783fc4eedc155ddc4674c9e',
    '40f23ec66c9dc358009863f354efb410cb908b6e35b26a05ec7cccbfbf334aac',
    '6a501dd89d11aaf5f18723c72142d4fbce8c896cd2651235c998afb0797553cd',
    '48ac6b6d687f87d6b5389063d9ae90662923a185d46705de6927d31479a233b3',
    'a7a07b6d79e949a8620ce809e93282ed0eb355f1b7b0b02578dc79ca92030570',
    'd4e90ebada38a5029c0e9c5cae3e3387eca45499d1cef1e6ca50124890a1d8b8',
    '8d2d2b5a0d9ceda5e978208bcaf90d497a8e91cc6685c8a25133725c563baf61',
    '692b99ee360b23545e5d3b76e0b776c818267654382a34d8c6df890e34f42379',
    '2bf796fb531e5cbff8bf04a196d3758a6b65d1b504f11e3366a6902fe91b1a86',
    'd6d362eecb896c695d945f73036e774d175aed5a5cf758f5d97266182b8a0992',
    '5a78eeca904473182733cd1073452c5d5c941130fc2728ffcdfe25235237c640',
    'dd25baf23ce594667668b838eb4321b3fce07c9bad7aef14463297bf6f63c843',
    '47605e96e58bc85a863d27ad780072cf229738e338a3f6eb595c2fdb017e99d3',
    'ffdc1402c5981f48459a2fc9563288201efcbbec0c81669f66f2cea04a651f74',
    '4bc27a2b0e1d2581aa7f07a8fe36123e8f4b4fa7674fc44766ca7a7e641afb3a',
    '61f3e26a2ad79237b5f23d211387a409df055802ff9a7f74ec1c4afd3d0be50e',
    'd4686b075579056ac99f3adfae557088241534d2db6a17964ea377d5ec43daa3',
    '8fc522eac949ebf21d09e96bd0e0ab27e948ab60718b78d9aa3df4829a90a0e0',
    '5fe7428907bfe8b86f67b6d378e6828eb81090b046902ffd42562cf7dc88f54c',
    '82634db8506881f5193bb0c965beec493b0832adb6a9b895429ea8dccc85b20c',
    '586217b9dfd0fe0f9c4bf673ec006c05f2a68fe7781c6a9da630ef54c82329ea',
    'd1bea12862dfe226e796f190a85120c24654d727d9659c750879fc2460d8bb69',
    'bbf85d2697c43c0a2e658c12bc351d5faf9474a2651abb4432cfe8f984c123f4',
    '68f6d39adec5d35ee4eb3baca16d17865e9326ab9424b7adc86fb9b562af4a9e',
    '2a1dd20563dfda50b7377f806f06de46c5ffad8d618a615cd859b3bd3b80a821',
    'bca774141490a3077d34bbbf01af4957ec1e8cad8fa37eebc4a9f62ea971ff2e',
    '0c8c88f83e3fe71314fa699cd99be2a1867a2a7e46132755c148f849152da3c5',
    'b7e4d9f4fd36f427b7eaaa0588d9aed6ffd33c9da40fd359ae21ca99cce6e58e',
    '2abd965714ff385d3ffde085ed74a1d2074198d0a468295176188a0566abedb9',
    '2603596a5a6e6a07969ab9b5e0b8f297893c5ed322fe1d26bbcbd4be3c9d7769',
    '73ab1766ae2339d37413a7f376ca5af480cfe428bd37a4ff80b25f775666f91a',
    '015c916a8957b79867652ff40b47015af35f7c1f8b22b4c2da98e1c476840c4b',
    '3d900620712d5cc18c3f943cb5ad7d9fe95de332bc10964c872e35e45d24a2bc',
    '8528beaeb1948cb89c497d37702688d01db195324f5baa5349a6e0d29e93911d',
    'd8ec9531739ba4eefe209a2dbc3f0b5be954da2cdd2d60ea09660687890ef679',
    '8ee673a89aacc827bfb6e3e551da8cdbb3bae013a4d031df56c633cb0dd48212',
    '88a953f5872982d3d782e71f06bb8e8e76f75e8bac26768f2e785ee57899a940',
    '02637d70632c7b249b50f9e849094f53407d56e5c6300d2445d0b398d12f80b0',
    '2c74dc4e60629fc0bcc621c72d376beb02c1df3bb251fec7c07d232736e83b1a',
  ];
  const POLYMEASUREMENT_TEST_SUITE_HASHES = [
    '40f23ec66c9dc358009863f354efb410cb908b6e35b26a05ec7cccbfbf334aac',
    '692b99ee360b23545e5d3b76e0b776c818267654382a34d8c6df890e34f42379',
    'd6d362eecb896c695d945f73036e774d175aed5a5cf758f5d97266182b8a0992',
    'd4686b075579056ac99f3adfae557088241534d2db6a17964ea377d5ec43daa3',
    'd1bea12862dfe226e796f190a85120c24654d727d9659c750879fc2460d8bb69',
    '68f6d39adec5d35ee4eb3baca16d17865e9326ab9424b7adc86fb9b562af4a9e',
    '2a1dd20563dfda50b7377f806f06de46c5ffad8d618a615cd859b3bd3b80a821',
    '2603596a5a6e6a07969ab9b5e0b8f297893c5ed322fe1d26bbcbd4be3c9d7769',
    '73ab1766ae2339d37413a7f376ca5af480cfe428bd37a4ff80b25f775666f91a',
    '015c916a8957b79867652ff40b47015af35f7c1f8b22b4c2da98e1c476840c4b',
    '3d900620712d5cc18c3f943cb5ad7d9fe95de332bc10964c872e35e45d24a2bc',
    '8528beaeb1948cb89c497d37702688d01db195324f5baa5349a6e0d29e93911d',
    'd8ec9531739ba4eefe209a2dbc3f0b5be954da2cdd2d60ea09660687890ef679',
    '8ee673a89aacc827bfb6e3e551da8cdbb3bae013a4d031df56c633cb0dd48212',
  ];

  class NewBugRequest extends cp.RequestBase {
    constructor(options) {
      super(options);
      this.method_ = 'POST';
      this.body_ = new FormData();
      for (const key of options.alertKeys) this.body_.append('key', key);
      for (const label of options.labels) this.body_.append('label', label);
      for (const component of options.components) {
        this.body_.append('component', component);
      }
      this.body_.set('summary', options.summary);
      this.body_.set('description', options.description);
      this.body_.set('owner', options.owner);
      this.body_.set('cc', options.cc);
    }

    get url_() {
      return '/api/alerts/new_bug';
    }

    async localhostResponse_() {
      return {bug_id: 123450000 + tr.b.GUID.allocateSimple()};
    }

    postProcess_(json) {
      return json.bug_id;
    }
  }

  class ExistingBugRequest extends cp.RequestBase {
    constructor(options) {
      super(options);
      this.method_ = 'POST';
      this.body_ = new FormData();
      for (const key of options.alertKeys) this.body_.append('key', key);
      this.body_.set('bug_id', options.bugId);
    }

    get url_() {
      return '/api/alerts/existing_bug';
    }
  }

  class AlertsRequest extends cp.RequestBase {
    constructor(options) {
      super(options);
      this.headers_.set('Content-type', 'application/x-www-form-urlencoded');
      this.method_ = 'POST';
      this.body_ = new URLSearchParams();
      for (const [key, value] of Object.entries(options.body)) {
        if (value === undefined) continue;
        this.body_.set(key, value);
      }
      this.improvements = options.body.improvements;
      this.triaged = options.body.triaged;
    }

    get url_() {
      // TODO /api/alerts
      return '/alerts';
    }

    async localhostResponse_() {
      const improvements = Boolean(this.improvements);
      const triaged = Boolean(this.triaged);
      const alerts = [];
      const measurements = [
        'memory:a_size',
        'memory:b_size',
        'memory:c_size',
        'cpu:a',
        'cpu:b',
        'cpu:c',
        'power',
        'loading',
        'startup',
        'size',
      ];
      const testCases = [
        'browse:media:facebook_photos',
        'browse:media:imgur',
        'browse:media:youtube',
        'browse:news:flipboard',
        'browse:news:hackernews',
        'browse:news:nytimes',
        'browse:social:facebook',
        'browse:social:twitter',
        'load:chrome:blank',
        'load:games:bubbles',
        'load:games:lazors',
        'load:games:spychase',
        'load:media:google_images',
        'load:media:imgur',
        'load:media:youtube',
        'search:portal:google',
      ];
      for (let i = 0; i < 10; ++i) {
        const revs = new tr.b.math.Range();
        revs.addValue(parseInt(1e6 * Math.random()));
        revs.addValue(parseInt(1e6 * Math.random()));
        let bugId = undefined;
        if (triaged && (Math.random() > 0.5)) {
          if (Math.random() > 0.5) {
            bugId = -1;
          } else {
            bugId = 123456;
          }
        }
        alerts.push({
          bot: 'bot' + parseInt(Math.random() * 3),
          bug_components: [],
          bug_id: bugId,
          bug_labels: [],
          end_revision: revs.max,
          improvement: improvements && (Math.random() > 0.5),
          key: tr.b.GUID.allocateSimple(),
          master: 'master',
          median_after_anomaly: 100 * Math.random(),
          median_before_anomaly: 100 * Math.random(),
          start_revision: revs.min,
          test: measurements[i] + '/' +
            testCases[parseInt(Math.random() * testCases.length)],
          testsuite: 'system_health.common_desktop',
          units: 'ms',
        });
      }
      alerts.sort((x, y) => x.start_revision - y.start_revision);
      const bugs = [
        {
          id: '12345',
          status: 'WontFix',
          owner: {name: 'owner'},
          summary: '0% regression in nothing at 1:9999999',
        },
      ];
      for (let i = 0; i < 50; ++i) {
        bugs.push({
          id: 'TODO',
          status: 'TODO',
          owner: {name: 'TODO'},
          summary: 'TODO '.repeat(30),
        });
      }
      return {
        anomaly_list: alerts,
        recent_bugs: bugs,
      };
    }

    postProcess_(json) {
      if (json.error) {
        // eslint-disable-next-line no-console
        console.error('Error fetching alerts', json.error);
        return {
          anomaly_list: [],
          recent_bugs: [],
        };
      }
      return json;
    }
  }

  class AlertsSection extends cp.ElementBase {
    ready() {
      super.ready();
      this.scrollIntoView(true);
    }

    async connectedCallback() {
      super.connectedCallback();
      this.dispatch('connected', this.statePath, window.innerHeight);
    }

    isLoading_(isLoading, isPreviewLoading) {
      return isLoading || isPreviewLoading;
    }

    canTriage_(alertGroups) {
      const selectedAlerts = AlertsSection.getSelectedAlerts(alertGroups);
      if (selectedAlerts.length === 0) return false;
      for (const alert of selectedAlerts) {
        if (alert.bugId) return false;
      }
      return true;
    }

    crbug_(bugId) {
      return `https://bugs.chromium.org/p/chromium/issues/detail?id=${bugId}`;
    }

    canUnassignAlerts_(alertGroups) {
      const selectedAlerts = AlertsSection.getSelectedAlerts(alertGroups);
      for (const alert of selectedAlerts) {
        if (alert.bugId) return true;
      }
      return false;
    }

    onUnassign_(event) {
      this.dispatch('unassignAlerts', this.statePath);
    }

    summary_(alertGroups) {
      if (!alertGroups) return '';
      const groups = alertGroups.length;
      let total = 0;
      for (const group of alertGroups) {
        total += group.alerts.length;
      }
      return (
        `${total} alert${this._plural(total)} in ` +
        `${groups} group${this._plural(groups)}`);
    }

    onSourceClear_(event) {
      this.dispatch('onSourceClear', this.statePath);
    }

    onSourceSelect_(event) {
      this.dispatch('loadAlerts', this.statePath);
    }

    onToggleImprovements_(event) {
      this.dispatch('toggleShowingImprovements', this.statePath);
    }

    onToggleTriaged_(event) {
      this.dispatch('toggleShowingTriaged', this.statePath);
    }

    onTapRecentBugs_(event) {
      this.dispatch('toggleRecentBugs', this.statePath);
    }

    onCancelTriagedNew_(event) {
      this.dispatch('cancelTriagedNew', this.statePath);
    }

    onCancelTriagedExisting_(event) {
      this.dispatch('cancelTriagedExisting', this.statePath);
    }

    onCancelIgnored_(event) {
      this.dispatch('cancelIgnored', this.statePath);
    }

    onCancelRecentBugs_(event) {
      this.dispatch('toggleRecentBugs', this.statePath);
    }

    onClose_(event) {
      this.dispatchEvent(new CustomEvent('close-section', {
        bubbles: true,
        composed: true,
        detail: {sectionId: this.sectionId},
      }));
    }

    onCharts_(event) {
      const selectedAlerts = AlertsSection.getSelectedAlerts(
          this.alertGroups);
      if (event.detail.sourceEvent.ctrlKey) {
        cp.todo('open V2SPA charts instead of V1 charts');
        for (const alert of selectedAlerts) {
          window.open(alert.v1ReportLink, '_blank');
        }
        return;
      }
      for (const alert of selectedAlerts) {
        this.dispatchEvent(new CustomEvent('new-chart', {
          bubbles: true,
          composed: true,
          detail: {
            options: {
              minRevision: this.$.preview.minRevision,
              maxRevision: this.$.preview.maxRevision,
              parameters: {
                testSuites: [alert.testSuite],
                measurements: [alert.measurement],
                bots: [alert.master + ':' + alert.bot],
                testCases: [alert.testCase],
                statistic: 'avg',
              },
              // TODO brush event.detail.datum.chromiumCommitPositions
            },
          },
        }));
      }
    }

    onTriageNew_(event) {
      // If the user is already signed in, then require-sign-in will do nothing,
      // and openNewBugDialog will do so. If the user is not already signed in,
      // then openNewBugDialog won't, and require-sign-in will start the signin
      // flow.
      this.dispatchEvent(new CustomEvent('require-sign-in', {
        bubbles: true,
        composed: true,
      }));
      this.dispatch('openNewBugDialog', this.statePath);
    }

    onTriageExisting_(event) {
      // If the user is already signed in, then require-sign-in will do nothing,
      // and openExistingBugDialog will do so. If the user is not already signed
      // in, then openExistingBugDialog won't, and require-sign-in will start
      // the signin flow.
      this.dispatchEvent(new CustomEvent('require-sign-in', {
        bubbles: true,
        composed: true,
      }));
      this.dispatch('openExistingBugDialog', this.statePath);
    }

    onTriageNewSubmit_(event) {
      this.dispatch('submitNewBug', this.statePath);
    }

    onTriageExistingSubmit_(event) {
      this.dispatch('submitExistingBug', this.statePath);
    }

    onIgnore_(event) {
      this.dispatch('ignore', this.statePath);
    }

    onDotClick_(event) {
      this.dispatchEvent(new CustomEvent('new-chart', {
        bubbles: true,
        composed: true,
        detail: {
          options: {
            parameters: event.detail.line.descriptor,
            // TODO brush event.detail.datum.chromiumCommitPositions
          },
        },
      }));
    }

    onDotMouseOver_(event) {
      this.dispatch('dotMouseOver', this.statePath, event.detail.datum);
    }

    onDotMouseOut_(event) {
      // TODO unbold row in table
    }

    onSelected_(event) {
      this.dispatch('maybeLayoutPreview', this.statePath);
    }

    onSelectAlert_(event) {
      this.dispatch('selectAlert', this.statePath,
          event.detail.alertGroupIndex, event.detail.alertIndex);
    }

    onPreviewLineCountChange_() {
      this.dispatch('updateAlertColors', this.statePath);
    }

    onSort_(event) {
      this.dispatch('onSort_', this.statePath);
    }

    observeTriaged_() {
      if (this.hasTriagedNew || this.hasTriagedExisting || this.hasIgnored) {
        this.$.recent_bugs.scrollIntoView(true);
      }
    }

    observeUserEmail_() {
      this.dispatch('authChange', this.statePath);
    }
  }

  AlertsSection.properties = {
    ...cp.ElementBase.statePathProperties('statePath', {
      alertGroups: {type: Array},
      areAlertGroupsPlaceholders: {type: Boolean},
      hasTriagedNew: {
        type: Boolean,
        observer: 'observeTriaged_',
      },
      hasTriagedExisting: {
        type: Boolean,
        observer: 'observeTriaged_',
      },
      hasIgnored: {
        type: Boolean,
        observer: 'observeTriaged_',
      },
      ignoredCount: {type: Number},
      triagedBugId: {type: Number},
      isLoading: {type: Boolean},
      isOwner: {type: Boolean},
      preview: {type: Object},
      recentBugs: {type: Array},
      showingRecentBugs: {type: Boolean},
      sectionId: {type: String},
      selectedAlertsCount: {type: Number},
      showBugColumn: {type: Boolean},
      showMasterColumn: {type: Boolean},
      showingImprovements: {type: Boolean},
      showingTriaged: {type: Boolean},
      source: {type: Object},
    }),
    ...cp.ElementBase.statePathProperties('linkedStatePath', {
      // AlertsSection only needs the linkedStatePath property to forward to
      // ChartPair.
    }),
    userEmail: {
      type: Object,
      statePath: 'userEmail',
      observer: 'observeUserEmail_',
    },
  };

  AlertsSection.actions = {
    selectAlert: (statePath, alertGroupIndex, alertIndex) =>
      async(dispatch, getState) => {
        dispatch({
          type: AlertsSection.reducers.selectAlert.typeName,
          statePath,
          alertGroupIndex,
          alertIndex,
        });
        /*
        dispatch(cp.ElementBase.actions.updateObject(`${statePath}.preview`, {
          lineDescriptors: [AlertsSection.computeLineDescriptor(alert)],
          minTimestampMs: new Date() - MS_PER_MONTH,
        }));
        */
      },

    authChange: statePath => async(dispatch, getState) => {
      // TODO reload alerts?
    },

    toggleRecentBugs: statePath => async(dispatch, getState) => {
      dispatch(cp.ElementBase.actions.toggleBoolean(
          `${statePath}.showingRecentBugs`));
    },

    cancelTriagedNew: statePath => async(dispatch, getState) => {
      dispatch(cp.ElementBase.actions.updateObject(statePath, {
        hasTriagedNew: false,
      }));
    },

    cancelTriagedExisting: statePath => async(dispatch, getState) => {
      dispatch(cp.ElementBase.actions.updateObject(statePath, {
        hasTriagedExisting: false,
        triagedBugId: 0,
      }));
    },

    cancelIgnored: statePath => async(dispatch, getState) => {
      dispatch(cp.ElementBase.actions.updateObject(statePath, {
        hasIgnored: false,
      }));
    },

    updateAlertColors: statePath => async(dispatch, getState) => {
      dispatch({
        type: AlertsSection.reducers.updateAlertColors.typeName,
        statePath,
      });
    },

    unassignAlerts: statePath => async(dispatch, getState) => {
      dispatch(AlertsSection.actions.changeBugId(statePath, 0));
    },

    dotMouseOver: (statePath, datum) => async(dispatch, getState) => {
      // TODO bold row in table
    },

    onSourceClear: statePath => async(dispatch, getState) => {
      dispatch(AlertsSection.actions.loadAlerts(statePath));
      dispatch(cp.DropdownInput.actions.focus(statePath + '.source'));
    },

    connected: (statePath, windowHeight) => async(dispatch, getState) => {
      dispatch(cp.ElementBase.actions.updateObject(
          statePath, {tableHeightPx: Math.max(122, windowHeight - 320)}));
      const state = Polymer.Path.get(getState(), statePath);
      if (state.source.selectedOptions.length > 0) {
        dispatch(AlertsSection.actions.loadAlerts(statePath));
      }
      if (state.doSelectAll) {
        // TODO select all
        dispatch(cp.ElementBase.actions.updateObject(
            statePath, {doSelectAll: false}));
      }
      if (state.doOpenCharts) {
        // TODO open charts
        dispatch(cp.ElementBase.actions.updateObject(
            statePath, {doOpenCharts: false}));
      }
    },

    restoreState: (statePath, options) => async(dispatch, getState) => {
      // Don't use newState, which would drop state that was computed/fetched in
      // actions.connected.
      dispatch({
        type: AlertsSection.reducers.restoreState.typeName,
        statePath,
        options,
      });
      const state = Polymer.Path.get(getState(), statePath);
      if (state.source.selectedOptions.length === 0) {
        dispatch(cp.DropdownInput.actions.focus(statePath + '.source'));
      } else {
        dispatch(AlertsSection.actions.loadAlerts(statePath));
      }
    },

    submitExistingBug: statePath => async(dispatch, getState) => {
      let state = Polymer.Path.get(getState(), statePath);
      const triagedBugId = state.existingBug.bugId;
      await dispatch(AlertsSection.actions.changeBugId(
          statePath, triagedBugId));
      dispatch({
        type: AlertsSection.reducers.showTriagedExisting.typeName,
        statePath,
        triagedBugId,
      });
      await cp.ElementBase.timeout(5000);
      state = Polymer.Path.get(getState(), statePath);
      if (state.triagedBugId !== triagedBugId) return;
      dispatch(AlertsSection.actions.cancelTriagedExisting(statePath));
    },

    changeBugId: (statePath, bugId) => async(dispatch, getState) => {
      dispatch(cp.ElementBase.actions.updateObject(
          statePath, {isLoading: true}));
      const rootState = getState();
      let state = Polymer.Path.get(rootState, statePath);
      const alerts = AlertsSection.getSelectedAlerts(state.alertGroups);
      try {
        const request = new ExistingBugRequest({
          alertKeys: alerts.map(a => a.key),
          bugId,
        });
        await request.response;
        dispatch({
          type: AlertsSection.reducers.removeSelectedAlerts.typeName,
          statePath,
          bugId,
        });
        state = Polymer.Path.get(getState(), statePath);
        dispatch(AlertsSection.actions.prefetchPreviewAlertGroup_(
            statePath, state.alertGroups[0]));
        dispatch(cp.ElementBase.actions.updateObject(
            `${statePath}.preview`, {lineDescriptors: []}));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
      }
      dispatch(cp.ElementBase.actions.updateObject(
          statePath, {isLoading: false}));
      dispatch(cp.ElementBase.actions.updateObject(
          `${statePath}.existingBug`, {isOpen: false}));
    },

    ignore: statePath => async(dispatch, getState) => {
      let state = Polymer.Path.get(getState(), statePath);
      const alerts = AlertsSection.getSelectedAlerts(state.alertGroups);
      const ignoredCount = alerts.length;
      await dispatch(AlertsSection.actions.changeBugId(statePath, -2));

      dispatch(cp.ElementBase.actions.updateObject(statePath, {
        hasTriagedExisting: false,
        hasTriagedNew: false,
        hasIgnored: true,
        ignoredCount,
      }));
      await cp.ElementBase.timeout(5000);
      state = Polymer.Path.get(getState(), statePath);
      if (state.ignoredCount !== ignoredCount) return;
      dispatch(cp.ElementBase.actions.updateObject(statePath, {
        hasIgnored: false,
        ignoredCount: 0,
      }));
    },

    openNewBugDialog: statePath => async(dispatch, getState) => {
      let userEmail = getState().userEmail;
      if (location.hostname === 'localhost') {
        userEmail = 'you@chromium.org';
      }
      if (!userEmail) return;
      dispatch({
        type: AlertsSection.reducers.openNewBugDialog.typeName,
        statePath,
        userEmail,
      });
    },

    openExistingBugDialog: statePath => async(dispatch, getState) => {
      let userEmail = getState().userEmail;
      if (location.hostname === 'localhost') {
        userEmail = 'you@chromium.org';
      }
      if (!userEmail) return;
      dispatch({
        type: AlertsSection.reducers.openExistingBugDialog.typeName,
        statePath,
      });
    },

    submitNewBug: statePath => async(dispatch, getState) => {
      dispatch(cp.ElementBase.actions.updateObject(
          statePath, {isLoading: true}));
      const rootState = getState();
      let state = Polymer.Path.get(rootState, statePath);
      const alerts = AlertsSection.getSelectedAlerts(state.alertGroups);
      let bugId;
      try {
        const request = new NewBugRequest({
          alertKeys: alerts.map(a => a.key),
          ...state.newBug,
          labels: state.newBug.labels.filter(
              x => x.isEnabled).map(x => x.name),
          components: state.newBug.components.filter(
              x => x.isEnabled).map(x => x.name),
        });
        const summary = state.newBug.summary;
        bugId = await request.response;
        dispatch({
          type: AlertsSection.reducers.showTriagedNew.typeName,
          statePath,
          bugId,
          summary,
        });
        dispatch({
          type: AlertsSection.reducers.removeSelectedAlerts.typeName,
          statePath,
          bugId,
        });
        state = Polymer.Path.get(getState(), statePath);
        dispatch(AlertsSection.actions.prefetchPreviewAlertGroup_(
            statePath, state.alertGroups[0]));
        dispatch(cp.ElementBase.actions.updateObject(
            `${statePath}.preview`, {lineDescriptors: []}));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
      }
      dispatch(cp.ElementBase.actions.updateObject(
          statePath, {isLoading: false}));

      if (bugId === undefined) return;
      await cp.ElementBase.timeout(5000);
      state = Polymer.Path.get(getState(), statePath);
      if (state.triagedBugId !== bugId) return;
      dispatch(cp.ElementBase.actions.updateObject(statePath, {
        hasTriagedNew: false,
        triagedBugId: 0,
      }));
    },

    onSort_: statePath => async(dispatch, getState) => {
      const state = Polymer.Path.get(getState(), statePath);
      dispatch(AlertsSection.actions.prefetchPreviewAlertGroup_(
          statePath, state.alertGroups[0]));
    },

    loadAlerts: statePath => async(dispatch, getState) => {
      dispatch(cp.DropdownInput.actions.blurAll());
      dispatch({
        type: AlertsSection.reducers.startLoadingAlerts.typeName,
        statePath,
      });
      const rootState = getState();
      let state = Polymer.Path.get(rootState, statePath);

      const alerts = [];
      const errors = [];
      let recentBugs = [];
      await Promise.all(state.source.selectedOptions.map(async source => {
        const request = new AlertsRequest({
          body: {
            improvements: state.showingImprovements ? 'true' : '',
            triaged: state.showingTriaged ? 'true' : '',
            ...AlertsSection.unpackSourceOptions(source),
          },
        });
        try {
          const response = await request.response;
          alerts.push.apply(alerts, response.anomaly_list);
          // TODO use a separate request for recent bugs
          recentBugs = response.recent_bugs;
        } catch (err) {
          errors.push('Failed to fetch alerts: ' + err);
        }
      }));

      await Promise.all(alerts.map(async alert => {
        // Ideally, this should be handled in transformAlert, but reducers can't
        // be async, and sha256 is async so this needs to be done here.
        const partialSuite = alert.testsuite + ':' + alert.test.split('/')[0];
        alert.partialHash = await cp.sha256(partialSuite);
      }));

      dispatch({
        type: AlertsSection.reducers.receiveAlerts.typeName,
        statePath,
        alerts,
        errors,
        recentBugs,
      });
      state = Polymer.Path.get(getState(), statePath);
      dispatch(AlertsSection.actions.prefetchPreviewAlertGroup_(
          statePath, state.alertGroups[0]));
    },

    toggleShowingImprovements: statePath => async(dispatch, getState) => {
      dispatch(cp.ElementBase.actions.toggleBoolean(
          `${statePath}.showingImprovements`));
      dispatch(AlertsSection.actions.loadAlerts(statePath));
    },

    toggleShowingTriaged: statePath => async(dispatch, getState) => {
      dispatch(cp.ElementBase.actions.toggleBoolean(
          `${statePath}.showingTriaged`));
      dispatch(AlertsSection.actions.loadAlerts(statePath));
    },

    prefetchPreviewAlertGroup_: (statePath, alertGroup) =>
      async(dispatch, getState) => {
        if (!alertGroup) return;
        dispatch(cp.ChartTimeseries.actions.prefetch(
            `${statePath}.preview`, alertGroup.alerts.map(
                AlertsSection.computeLineDescriptor)));
        dispatch(cp.PrefetchTestSuiteDescriptors({
          testSuites: alertGroup.alerts.map(alert => alert.testSuite),
        }));
      },

    layoutPreview: statePath => async(dispatch, getState) => {
      const rootState = getState();
      const state = Polymer.Path.get(rootState, statePath);
      const alerts = AlertsSection.getSelectedAlerts(state.alertGroups);
      const lineDescriptors = alerts.map(AlertsSection.computeLineDescriptor);
      if (lineDescriptors.length === 1) {
        lineDescriptors.push({
          ...lineDescriptors[0],
          buildType: 'reference',
          icons: [],
        });
      }
      const minTimestampMs = new Date() - MS_PER_MONTH;
      dispatch(cp.ElementBase.actions.updateObject(
          `${statePath}.preview`, {lineDescriptors, minTimestampMs}));

      const testSuites = new Set();
      for (const descriptor of lineDescriptors) {
        testSuites.add(descriptor.testSuites[0]);
      }
      dispatch(cp.PrefetchTestSuiteDescriptors({
        testSuites: [...testSuites],
      }));
    },

    maybeLayoutPreview: statePath => async(dispatch, getState) => {
      const state = Polymer.Path.get(getState(), statePath);
      if (!state.selectedAlertsCount) {
        dispatch(cp.ElementBase.actions.updateObject(
            `${statePath}.preview`, {lineDescriptors: []}));
        return;
      }

      dispatch(AlertsSection.actions.layoutPreview(statePath));
    },
  };

  AlertsSection.computeLineDescriptor = alert => {
    return {
      baseUnit: alert.baseUnit,
      testSuites: [alert.testSuite],
      measurement: alert.measurement,
      bots: [alert.master + ':' + alert.bot],
      testCases: [alert.testCase],
      statistic: 'avg', // TODO
      buildType: 'test',
      icons: [ // TODO ChartTimeseries should get this from the backend
        {
          revision: alert.endRevision,
          icon: alert.improvement ? 'thumb-up' : 'error',
        },
      ],
    };
  };

  AlertsSection.reducers = {
    selectAlert: (state, action, rootState) => {
      const alertPath =
        `alertGroups.${action.alertGroupIndex}.alerts.${action.alertIndex}`;
      const alert = Polymer.Path.get(state, alertPath);
      if (!alert.isSelected) {
        state = Polymer.Path.setImmutable(
            state, `${alertPath}.isSelected`, true);
      }
      if (state.selectedAlertPath === alertPath) {
        return {
          ...state,
          selectedAlertPath: undefined,
          preview: {
            ...state.preview,
            lineDescriptors: AlertsSection.getSelectedAlerts(
                state.alertGroups).map(AlertsSection.computeLineDescriptor),
          },
        };
      }
      return {
        ...state,
        selectedAlertPath: alertPath,
        preview: {
          ...state.preview,
          lineDescriptors: [AlertsSection.computeLineDescriptor(alert)],
        },
      };
    },

    restoreState: (state, action, rootState) => {
      if (!action.options) return state;
      if (action.options.sources) {
        const source = {...state.source};
        source.selectedOptions = action.options.sources;
        state = {...state, source};
      }
      return {
        ...state,
        showingImprovements: action.options.showingImprovements || false,
        showingTriaged: action.options.showingTriaged || false,
        sortColumn: action.options.sortColumn || 'revisions',
        sortDescending: action.options.sortDescending || false,
      };
    },

    showTriagedNew: (state, action, rootState) => {
      return {
        ...state,
        hasTriagedExisting: false,
        hasTriagedNew: true,
        hasIgnored: false,
        triagedBugId: action.bugId,
        recentBugs: [
          {
            id: action.bugId,
            summary: action.summary,
          },
          ...state.recentBugs,
        ],
      };
    },

    showTriagedExisting: (state, action, rootState) => {
      const recentBugs = state.recentBugs.filter(bug =>
        bug.id !== action.triagedBugId);
      let triagedBugSummary = '(TODO fetch bug summary)';
      for (const bug of state.existingBug.recentBugs) {
        if (bug.id === action.triagedBugId) {
          triagedBugSummary = bug.summary;
          break;
        }
      }
      recentBugs.unshift({
        id: action.triagedBugId,
        summary: triagedBugSummary,
      });
      return {
        ...state,
        hasTriagedExisting: true,
        hasTriagedNew: false,
        hasIgnored: false,
        triagedBugId: action.triagedBugId,
        recentBugs,
      };
    },

    updateAlertColors: (state, action, rootState) => {
      const colorByDescriptor = new Map();
      for (const line of state.preview.chartLayout.lines) {
        colorByDescriptor.set(cp.ChartTimeseries.stringifyDescriptor(
            line.descriptor), line.color);
      }
      return {
        ...state,
        alertGroups: state.alertGroups.map(alertGroup => {
          return {
            ...alertGroup,
            alerts: alertGroup.alerts.map(alert => {
              const descriptor = cp.ChartTimeseries.stringifyDescriptor(
                  AlertsSection.computeLineDescriptor(alert));
              return {
                ...alert,
                color: colorByDescriptor.get(descriptor),
              };
            }),
          };
        }),
      };
    },

    removeSelectedAlerts: (state, action, rootState) => {
      const alertGroups = [];
      for (const group of state.alertGroups) {
        let alerts = group.alerts;
        if (state.showingTriaged) {
          alerts = alerts.map(alert => {
            return {
              ...alert,
              bugId: action.bugId,
            };
          });
        } else {
          alerts = alerts.filter(a => !a.isSelected);
          if (alerts.length === 0) continue;
        }
        alertGroups.push({...group, alerts});
      }
      return {
        ...state,
        alertGroups,
        selectedAlertsCount: 0,
      };
    },

    openNewBugDialog: (state, action, rootState) => {
      const alerts = AlertsSection.getSelectedAlerts(state.alertGroups);
      return {
        ...state,
        newBug: cp.TriageNew.newState(alerts, action.userEmail),
      };
    },

    openExistingBugDialog: (state, action, rootState) => {
      const alerts = AlertsSection.getSelectedAlerts(state.alertGroups);
      return {
        ...state,
        existingBug: {
          ...state.existingBug,
          ...cp.TriageExisting.openState(alerts),
        },
      };
    },

    receiveAlerts: (state, action, rootState) => {
      const recentBugs = action.recentBugs.map(AlertsSection.transformBug);

      if (!action.alerts.length) {
        state = {
          ...state,
          alertGroups: PLACEHOLDER_ALERT_GROUPS,
          areAlertGroupsPlaceholders: true,
          isLoading: false,
          isOwner: false,
          existingBug: {
            ...state.existingBug,
            recentBugs,
          },
          selectedAlertsCount: 0,
          showBugColumn: true,
          showMasterColumn: true,
          showTestCaseColumn: true,
        };
        if (state.source.selectedOptions.length === 0) return state;
        return {
          ...state,
          alertGroups: [],
          areAlertGroupsPlaceholders: false,
        };
      }

      let alertGroups = d.groupAlerts(action.alerts);
      alertGroups = alertGroups.map((alerts, groupIndex) => {
        return {
          isExpanded: false,
          alerts: alerts.map(AlertsSection.transformAlert),
        };
      });

      alertGroups = AlertsSection.sortGroups(
          alertGroups, state.sortColumn, state.sortDescending);

      // Don't automatically select the first group. Users often want to sort
      // the table by some column before previewing any alerts.

      // Hide the Bug, Master, and Test Case columns if they're boring.
      const bugs = new Set();
      const masters = new Set();
      const testCases = new Set();
      for (const group of alertGroups) {
        for (const alert of group.alerts) {
          bugs.add(alert.bugId);
          masters.add(alert.master);
          testCases.add(alert.testCase);
        }
      }

      return {
        ...state,
        alertGroups,
        areAlertGroupsPlaceholders: false,
        isLoading: false,
        isOwner: Math.random() < 0.5,
        selectedAlertsCount: 0,
        showBugColumn: bugs.size > 1,
        showMasterColumn: masters.size > 1,
        showTestCaseColumn: testCases.size > 1,
        existingBug: {
          ...state.existingBug,
          recentBugs,
        }
      };
    },

    startLoadingAlerts: (state, action, rootState) => {
      return {...state, isLoading: true};
    },
  };

  AlertsSection.newStateOptionsFromQueryParams = queryParams => {
    return {
      sources: queryParams.getAll('alerts').map(
          source => source.replace(/_/g, ' ')),
      sortColumn: queryParams.get('sort') || 'revisions',
      showingImprovements: queryParams.get('improvements') !== null,
      showingTriaged: queryParams.get('triaged') !== null,
      sortDescending: queryParams.get('descending') !== null,
    };
  };

  const PLACEHOLDER_ALERT_GROUPS = [];
  const DASHES = '-'.repeat(5);
  for (let i = 0; i < 5; ++i) {
    PLACEHOLDER_ALERT_GROUPS.push({
      isSelected: false,
      alerts: [
        {
          bugId: DASHES,
          revisions: DASHES,
          testSuite: DASHES,
          measurement: DASHES,
          master: DASHES,
          bot: DASHES,
          testCase: DASHES,
          deltaValue: 0,
          deltaUnit: tr.b.Unit.byName.countDelta_biggerIsBetter,
          percentDeltaValue: 0,
          percentDeltaUnit:
            tr.b.Unit.byName.normalizedPercentageDelta_biggerIsBetter,
        },
      ],
    });
  }

  AlertsSection.newState = options => {
    const sources = options.sources || [];
    let anyBug = false;
    let anyReports = false;
    let anySheriff = false;
    for (const source of sources) {
      if (source.startsWith('Report')) {
        anyReports = true;
      } else if (source.startsWith('Bug')) {
        anyBug = true;
      } else {
        anySheriff = true;
      }
    }
    const sourceOptions = cp.dummyAlertsSources();
    for (const option of sourceOptions) {
      if ((option.label === 'Bug' && anyBug) ||
          (option.label === 'Report' && anyReports)) {
        option.isExpanded = true;
      } else if (option.label === 'Sheriff' && !anySheriff &&
                 (anyBug || anyReports)) {
        option.isExpanded = false;
      }
    }

    return {
      alertGroups: PLACEHOLDER_ALERT_GROUPS,
      areAlertGroupsPlaceholders: true,
      doOpenCharts: options.doOpenCharts || false,
      doSelectAll: options.doSelectAll || false,
      existingBug: cp.TriageExisting.DEFAULT_STATE,
      hasTriagedNew: false,
      hasTriagedExisting: false,
      hasIgnored: false,
      ignoredCount: 0,
      triagedBugId: 0,
      isLoading: false,
      isOwner: false,
      newBug: {isOpen: false},
      preview: cp.ChartPair.newState(options),
      previousSelectedAlertKey: undefined,
      recentBugs: [],
      selectedAlertPath: undefined,
      selectedAlertsCount: 0,
      showBugColumn: true,
      showMasterColumn: true,
      showTestCaseColumn: true,
      showingImprovements: options.showingImprovements || false,
      showingTriaged: options.showingTriaged || false,
      sortColumn: options.sortColumn || 'revisions',
      sortDescending: options.sortDescending || false,
      source: {
        label: 'Source',
        options: sourceOptions,
        query: '',
        selectedOptions: sources,
      },
    };
  };

  AlertsSection.getSelectedAlerts = alertGroups => {
    const selectedAlerts = [];
    for (const alertGroup of alertGroups) {
      for (const alert of alertGroup.alerts) {
        if (alert.isSelected) {
          selectedAlerts.push(alert);
        }
      }
    }
    return selectedAlerts;
  };

  AlertsSection.compareAlerts = (alertA, alertB, sortColumn) => {
    switch (sortColumn) {
      case 'bug': return alertA.bugId - alertB.bugId;
      case 'revisions': return alertA.startRevision - alertB.startRevision;
      case 'testSuite':
        return alertA.testSuite.localeCompare(alertB.testSuite);
      case 'master': return alertA.master.localeCompare(alertB.master);
      case 'bot': return alertA.bot.localeCompare(alertB.bot);
      case 'measurement':
        return alertA.measurement.localeCompare(alertB.measurement);
      case 'testCase':
        return alertA.testCase.localeCompare(alertB.testCase);
      case 'delta': return alertA.deltaValue - alertB.deltaValue;
      case 'deltaPct':
        return Math.abs(alertA.percentDeltaValue) -
          Math.abs(alertB.percentDeltaValue);
    }
  };

  AlertsSection.sortGroups = (alertGroups, sortColumn, sortDescending) => {
    const factor = sortDescending ? -1 : 1;
    alertGroups = alertGroups.map(group => {
      const alerts = Array.from(group.alerts);
      alerts.sort((alertA, alertB) => factor * AlertsSection.compareAlerts(
          alertA, alertB, sortColumn));
      return {
        ...group,
        alerts,
      };
    });
    alertGroups.sort((groupA, groupB) => factor * AlertsSection.compareAlerts(
        groupA.alerts[0], groupB.alerts[0], sortColumn));
    return alertGroups;
  };

  AlertsSection.transformAlert = alert => {
    let deltaValue = alert.median_after_anomaly -
      alert.median_before_anomaly;
    const percentDeltaValue = deltaValue / alert.median_before_anomaly;

    let improvementDirection = tr.b.ImprovementDirection.BIGGER_IS_BETTER;
    if (alert.improvement === (deltaValue < 0)) {
      improvementDirection = tr.b.ImprovementDirection.SMALLER_IS_BETTER;
    }
    const unitSuffix = tr.b.Unit.nameSuffixForImprovementDirection(
        improvementDirection);

    let unitName = 'unitlessNumber';
    if (tr.b.Unit.byName[alert.units + unitSuffix]) {
      unitName = alert.units;
    } else {
      const info = tr.v.LEGACY_UNIT_INFO.get(alert.units);
      if (info) {
        unitName = info.name;
        deltaValue *= info.conversionFactor || 1;
      }
    }
    const baseUnit = tr.b.Unit.byName[unitName + unitSuffix];

    const testParts = alert.test.split('/');
    if (PARTIAL_TEST_SUITE_HASHES.includes(alert.partialHash)) {
      alert.testsuite += ':' + testParts.shift();
    }
    let measurement = testParts[0];
    let testCase = testParts.slice(1).join('/');
    if (POLYMEASUREMENT_TEST_SUITE_HASHES.includes(alert.partialHash)) {
      if (testParts[testParts.length - 1] === 'no-mitigations') {
        testCase = testParts.pop();
      } else {
        testCase = undefined;
      }
      measurement = testParts.join(':');
    }
    let statistic = 'avg';
    for (const statName of ['avg', 'count', 'min', 'max', 'std']) {
      if (measurement.endsWith('_' + statName)) {
        measurement = measurement.slice(
            0, measurement.length - statName.length - 1);
        statistic = statName;
        break;
      }
    }

    if (testParts.length > 2 && testParts[2].startsWith(testParts[1])) {
      // Drop redundant legacy test path components.
      testCase = testParts.slice(2).join('/');
    }
    if (alert.testsuite.startsWith('system_health')) {
      testCase = testCase.replace(/_/g, ':');
    }

    return {
      baseUnit,
      bot: alert.bot,
      bugComponents: alert.bug_components,
      bugId: alert.bug_id === undefined ? '' : alert.bug_id,
      bugLabels: alert.bug_labels,
      deltaUnit: baseUnit.correspondingDeltaUnit,
      deltaValue,
      key: alert.key,
      improvement: alert.improvement,
      isSelected: false,
      master: alert.master,
      measurement,
      statistic,
      percentDeltaUnit: tr.b.Unit.byName[
          'normalizedPercentageDelta' + unitSuffix],
      percentDeltaValue,
      startRevision: alert.start_revision,
      endRevision: alert.end_revision,
      testCase,
      testSuite: alert.testsuite,
      v1ReportLink: alert.dashboard_link,
    };
  };

  AlertsSection.transformBug = bug => {
    // Save memory by stripping out all the unnecessary data.
    // TODO save bandwidth by stripping out the unnecessary data in the
    // backend request handler.
    let revisionRange = bug.summary.match(/.* (\d+):(\d+)$/);
    if (revisionRange === null) {
      revisionRange = new tr.b.math.Range();
    } else {
      revisionRange = tr.b.math.Range.fromExplicitRange(
          parseInt(revisionRange[1]), parseInt(revisionRange[2]));
    }
    return {
      id: '' + bug.id,
      status: bug.status,
      owner: bug.owner ? bug.owner.name : '',
      summary: cp.AlertsSection.breakWords(bug.summary),
      revisionRange,
    };
  };

  AlertsSection.unpackSourceOptions = source => {
    let sheriff;
    let bugId;
    let report;
    let milestone;
    const sourceParts = source.split(':');
    const sourceType = sourceParts[0];
    if (sourceParts.length === 1) {
      sheriff = sourceType;
    } else if (sourceType === 'Bug') {
      bugId = sourceParts[1];
    } else if (sourceType === 'Report') {
      milestone = sourceParts[1];
      report = sourceParts[2];
    }
    return {
      sheriff,
      bugId,
      milestone,
      report,
    };
  };

  const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);

  AlertsSection.breakWords = str => {
    if (str === undefined) return '';

    // Insert spaces before underscores.
    str = str.replace(/_/g, ZERO_WIDTH_SPACE + '_');

    // Insert spaces after colons and dots.
    str = str.replace(/\./g, '.' + ZERO_WIDTH_SPACE);
    str = str.replace(/:/g, ':' + ZERO_WIDTH_SPACE);

    // Insert spaces before camel-case words.
    str = str.split(/([a-z][A-Z])/g);
    str = str.map((s, i) => {
      if ((i % 2) === 0) return s;
      return s[0] + ZERO_WIDTH_SPACE + s[1];
    });
    str = str.join('');
    return str;
  };

  AlertsSection.getSessionState = state => {
    return {
      sources: state.source.selectedOptions,
      showingImprovements: state.showingImprovements,
      showingTriaged: state.showingTriaged,
      sortColumn: state.sortColumn,
      sortDescending: state.sortDescending,
    };
  };

  AlertsSection.getRouteParams = state => {
    const queryParams = new URLSearchParams();
    for (const source of state.source.selectedOptions) {
      queryParams.append('alerts', source.replace(/ /g, '_'));
    }
    if (state.showingImprovements) queryParams.set('improvements', '');
    if (state.showingTriaged) queryParams.set('triaged', '');
    if (state.sortColumn !== 'revisions') {
      queryParams.set('sort', state.sortColumn);
    }
    if (state.sortDescending) queryParams.set('descending', '');
    return queryParams;
  };

  cp.ElementBase.register(AlertsSection);

  return {
    AlertsSection,
    MS_PER_MONTH,
  };
});
