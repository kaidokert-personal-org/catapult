/* Copyright 2018 The Chromium Authors. All rights reserved.
   Use of this source code is governed by a BSD-style license that can be
   found in the LICENSE file.
*/
'use strict';
tr.exportTo('cp', () => {
  const PRE_DESCRIBE_TEST_SUITES = [
    'system_health.common_desktop',
    'system_health.common_mobile',
    'system_health.memory_desktop',
    'system_health.memory_mobile',
  ];

  class ChromeperfApp extends cp.ElementBase {
    async ready() {
      super.ready();
      const routeParams = new URLSearchParams(this.route.path);
      this.dispatch('ready', this.statePath, routeParams);
    }

    escapedUrl_(path) {
      return encodeURIComponent(window.location.origin + '#' + path);
    }

    observeReduxRoute_() {
      this.route = {prefix: '', path: this.reduxRoutePath};
    }

    observeAppRoute_() {
      if (!this.readied) return;
      if (this.route.path === '') {
        this.dispatch('reset', this.statePath);
        return;
      }
      // TODO(benjhayden) Restore session?
    }

    async onUserUpdate_() {
      await this.dispatch('userUpdate', this.statePath);
    }

    async onReopenClosedAlerts_(event) {
      await this.dispatch('reopenClosedAlerts', this.statePath);
    }

    async onReopenClosedChart_() {
      await this.dispatch('reopenClosedChart', this.statePath);
    }

    async requireSignIn_(event) {
      if (this.userEmail || !this.isProduction) return;
      const auth = await window.getAuthInstanceAsync();
      await auth.signIn();
    }

    hideReportSection_(event) {
      this.dispatch('reportSectionShowing', this.statePath, false);
    }

    async onShowReportSection_(event) {
      await this.dispatch('reportSectionShowing', this.statePath, true);
    }

    async onNewAlertsSection_(event) {
      await this.dispatch('newAlerts', this.statePath, {});
    }

    async onCloseAlerts_(event) {
      await this.dispatch('closeAlerts', this.statePath, event.model.id);
    }

    async onCloseChart_(event) {
      this.dispatch('closeChart', this.statePath, event.model.id);
    }

    async onReportAlerts_(event) {
      await this.dispatch('newAlerts', this.statePath, event.detail.options);
    }

    async onNewChart_(event) {
      await this.dispatch('newChart', this.statePath, event.detail.options);
    }

    async onCloseAllCharts_(event) {
      await this.dispatch('closeAllCharts', this.statePath);
    }

    observeSections_() {
      if (!this.readied) return;
      this.debounce('updateLocation', () => {
        this.dispatch('updateLocation', this.statePath);
      }, Polymer.Async.animationFrame);
    }

    isInternal_(userEmail) {
      return userEmail.endsWith('@google.com');
    }

    get isProduction() {
      return window.IS_PRODUCTION;
    }

    onReset_(event) {
      this.dispatch('reset', this.statePath);
    }
  }

  ChromeperfApp.State = {
    enableNav: options => true,
    isLoading: options => true,
    readied: options => false,
    reportSection: options => cp.ReportSection.buildState({
      sources: [cp.ReportSection.DEFAULT_NAME],
    }),
    linkedChartState: options => cp.buildState(cp.ChartPair.LinkedState, {}),
    showingReportSection: options => true,
    alertsSectionIds: options => [],
    alertsSectionsById: options => {return {};},
    chartSectionIds: options => [],
    chartSectionsById: options => {return {};},
    closedAlertsIds: options => undefined,
    closedChartIds: options => undefined,
    // App-route sets |route|, and redux sets |reduxRoutePath|.
    // ChromeperfApp translates between them.
    // https://stackoverflow.com/questions/41440316
    reduxRoutePath: options => '#',
    vulcanizedDate: options => options.vulcanizedDate,
  };

  ChromeperfApp.properties = {
    ...cp.buildProperties('state', ChromeperfApp.State),
    route: {type: Object},
    userEmail: {statePath: 'userEmail'},
  };

  ChromeperfApp.observers = [
    'observeReduxRoute_(reduxRoutePath)',
    'observeAppRoute_(route)',
    ('observeSections_(showingReportSection, reportSection, ' +
     'alertsSectionsById, chartSectionsById)'),
  ];

  ChromeperfApp.actions = {
    ready: (statePath, routeParams) =>
      async(dispatch, getState) => {
        requestIdleCallback(async() => {
          new cp.TestSuitesRequest({}).response;
          await Promise.all(PRE_DESCRIBE_TEST_SUITES.map(suite =>
            new cp.DescribeRequest({suite}).response));
        });

        dispatch(Redux.CHAIN(
            Redux.ENSURE(statePath),
            Redux.ENSURE('userEmail', ''),
            Redux.ENSURE('largeDom', false),
        ));

        // Wait for ChromeperfApp and its reducers to be registered.
        await cp.afterRender();

        // Create the First Contentful Paint with a placeholder table in the
        // ReportSection. ReportSection will also fetch public /api/report/names
        // without authorizationHeaders.
        dispatch({
          type: ChromeperfApp.reducers.ready.name,
          statePath,
        });

        if (window.IS_PRODUCTION) {
          // Wait for gapi.auth2 to load and get an Authorization token.
          await window.getAuthInstanceAsync();
        }

        // Now, if the user is signed in, we can get auth headers. Try to
        // restore session state, which might include internal data.
        await ChromeperfApp.actions.restoreFromRoute(
            statePath, routeParams)(dispatch, getState);

        // The app is done loading.
        dispatch(Redux.UPDATE(statePath, {
          isLoading: false,
          readied: true,
        }));

        if (window.IS_DEBUG) {
          // In production, this api is only available to chromium members.
          ChromeperfApp.actions.getRecentBugs()(dispatch, getState);
        }
      },

    reportSectionShowing: (statePath, showingReportSection) =>
      async(dispatch, getState) => {
        dispatch(Redux.UPDATE(statePath, {showingReportSection}));
      },

    newAlerts: (statePath, options) => async(dispatch, getState) => {
      const sectionId = tr.b.GUID.allocateSimple();
      dispatch({
        type: ChromeperfApp.reducers.newAlerts.name,
        statePath,
        sectionId,
        options,
      });

      const state = Polymer.Path.get(getState(), statePath);
      const section = state.alertsSectionsById[sectionId];
      if (cp.AlertsSection.isEmpty(section)) {
        cp.MenuInput.actions.focus(
            `${statePath}.alertsSectionsById.${sectionId}.sheriff`
        )(dispatch, getState);
      }
    },

    closeAlerts: (statePath, sectionId) => async(dispatch, getState) => {
      dispatch({
        type: ChromeperfApp.reducers.closeAlerts.name,
        statePath,
        sectionId,
      });
      ChromeperfApp.actions.updateLocation(statePath)(dispatch, getState);

      await cp.timeout(5000);
      const state = Polymer.Path.get(getState(), statePath);
      if (state.closedAlertsIds && !state.closedAlertsIds.includes(sectionId)) {
        // This alerts section was reopened.
        return;
      }
      dispatch({
        type: ChromeperfApp.reducers.forgetClosedAlerts.name,
        statePath,
      });
    },

    userUpdate: statePath => async(dispatch, getState) => {
      const profile = await window.getUserProfileAsync();
      dispatch(Redux.UPDATE('', {
        userEmail: profile ? profile.getEmail() : '',
      }));
      new cp.TestSuitesRequest({}).response;
      if (profile) {
        ChromeperfApp.actions.getRecentBugs()(dispatch, getState);
      }
    },

    getRecentBugs: () => async(dispatch, getState) => {
      const bugs = await new cp.RecentBugsRequest().response;
      const recentPerformanceBugs = bugs && bugs.map(
          cp.AlertsSection.transformBug);
      dispatch(Redux.UPDATE('', {recentPerformanceBugs}));
    },

    restoreSessionState: (statePath, sessionId) =>
      async(dispatch, getState) => {
        const request = new cp.SessionStateRequest({sessionId});
        const sessionState = await request.response;
        if (sessionState.teamName) {
          dispatch(Redux.UPDATE('', {teamName: sessionState.teamName}));
        }

        dispatch(Redux.CHAIN(
            {
              type: ChromeperfApp.reducers.receiveSessionState.name,
              statePath,
              sessionState,
            },
            {
              type: ChromeperfApp.reducers.updateLargeDom.name,
              appStatePath: statePath,
            },
        ));
        cp.ReportSection.actions.restoreState(
            `${statePath}.reportSection`, sessionState.reportSection
        )(dispatch, getState);
      },

    restoreFromRoute: (statePath, routeParams) => async(dispatch, getState) => {
      const teamName = routeParams.get('team');
      if (teamName) {
        dispatch(Redux.UPDATE('', {teamName}));
      }

      if (routeParams.has('nonav')) {
        dispatch(Redux.UPDATE(statePath, {enableNav: false}));
      }

      const sessionId = routeParams.get('session');
      if (sessionId) {
        await ChromeperfApp.actions.restoreSessionState(
            statePath, sessionId)(dispatch, getState);
        return;
      }

      if (routeParams.get('report') !== null) {
        const options = cp.ReportSection.newStateOptionsFromQueryParams(
            routeParams);
        cp.ReportSection.actions.restoreState(
            `${statePath}.reportSection`, options)(dispatch, getState);
        return;
      }

      if (routeParams.get('sheriff') !== null ||
          routeParams.get('bug') !== null ||
          routeParams.get('ar') !== null) {
        const options = cp.AlertsSection.newStateOptionsFromQueryParams(
            routeParams);
        // Hide the report section and create a single alerts-section.
        dispatch(Redux.CHAIN(
            Redux.UPDATE(statePath, {showingReportSection: false}),
            {
              type: ChromeperfApp.reducers.newAlerts.name,
              statePath,
              options,
            },
        ));
        return;
      }

      if (routeParams.get('testSuite') !== null ||
          routeParams.get('suite') !== null ||
          routeParams.get('chart') !== null) {
        // Hide the report section and create a single chart.
        const options = cp.ChartSection.newStateOptionsFromQueryParams(
            routeParams);
        dispatch(Redux.UPDATE(statePath, {showingReportSection: false}));
        ChromeperfApp.actions.newChart(statePath, options)(dispatch, getState);
        return;
      }
    },

    saveSession: statePath => async(dispatch, getState) => {
      const rootState = getState();
      const state = Polymer.Path.get(rootState, statePath);
      const session = await new cp.SessionIdRequest({sessionState: {
        ...ChromeperfApp.getSessionState(state),
        teamName: rootState.teamName,
      }}).response;
      dispatch(Redux.UPDATE(statePath, {
        reduxRoutePath: new URLSearchParams({session}),
      }));
    },

    updateLocation: statePath => async(dispatch, getState) => {
      const rootState = getState();
      const state = Polymer.Path.get(rootState, statePath);
      if (!state.readied) return;
      const nonEmptyAlerts = state.alertsSectionIds.filter(id =>
        !cp.AlertsSection.isEmpty(state.alertsSectionsById[id]));
      const nonEmptyCharts = state.chartSectionIds.filter(id =>
        !cp.ChartSection.isEmpty(state.chartSectionsById[id]));

      let routeParams;

      if (!state.showingReportSection &&
          (nonEmptyAlerts.length === 0) &&
          (nonEmptyCharts.length === 0)) {
        routeParams = new URLSearchParams();
      }

      if (state.showingReportSection &&
          (nonEmptyAlerts.length === 0) &&
          (nonEmptyCharts.length === 0)) {
        routeParams = cp.ReportSection.getRouteParams(state.reportSection);
      }

      if (!state.showingReportSection &&
          (nonEmptyAlerts.length === 1) &&
          (nonEmptyCharts.length === 0)) {
        routeParams = cp.AlertsSection.getRouteParams(
            state.alertsSectionsById[nonEmptyAlerts[0]]);
      }

      if (!state.showingReportSection &&
          (nonEmptyAlerts.length === 0) &&
          (nonEmptyCharts.length === 1)) {
        routeParams = cp.ChartSection.getRouteParams(
            state.chartSectionsById[nonEmptyCharts[0]]);
      }

      if (routeParams === undefined) {
        ChromeperfApp.actions.saveSession(statePath)(dispatch, getState);
        return;
      }

      if (rootState.teamName) {
        routeParams.set('team', rootState.teamName);
      }

      if (!state.enableNav) {
        routeParams.set('nonav', '');
      }

      // The extra '#' prevents observeAppRoute_ from dispatching reset.
      const reduxRoutePath = routeParams.toString() || '#';
      dispatch(Redux.UPDATE(statePath, {reduxRoutePath}));
    },

    reopenClosedAlerts: statePath => async(dispatch, getState) => {
      const state = Polymer.Path.get(getState(), statePath);
      dispatch(Redux.UPDATE(statePath, {
        alertsSectionIds: [
          ...state.alertsSectionIds,
          ...state.closedAlertsIds,
        ],
        closedAlertsIds: undefined,
      }));
    },

    reopenClosedChart: statePath => async(dispatch, getState) => {
      const state = Polymer.Path.get(getState(), statePath);
      dispatch(Redux.UPDATE(statePath, {
        chartSectionIds: [
          ...state.chartSectionIds,
          ...state.closedChartIds,
        ],
        closedChartIds: undefined,
      }));
    },

    newChart: (statePath, options) => async(dispatch, getState) => {
      dispatch(Redux.CHAIN(
          {
            type: ChromeperfApp.reducers.newChart.name,
            statePath,
            options,
          },
          {
            type: ChromeperfApp.reducers.updateLargeDom.name,
            appStatePath: statePath,
          },
      ));
    },

    closeChart: (statePath, sectionId) => async(dispatch, getState) => {
      dispatch({
        type: ChromeperfApp.reducers.closeChart.name,
        statePath,
        sectionId,
      });
      ChromeperfApp.actions.updateLocation(statePath)(dispatch, getState);

      await cp.timeout(5000);
      const state = Polymer.Path.get(getState(), statePath);
      if (state.closedChartIds && !state.closedChartIds.includes(sectionId)) {
        // This chart was reopened.
        return;
      }
      dispatch({
        type: ChromeperfApp.reducers.forgetClosedChart.name,
        statePath,
      });
    },

    closeAllCharts: statePath => async(dispatch, getState) => {
      dispatch({
        type: ChromeperfApp.reducers.closeAllCharts.name,
        statePath,
      });
      ChromeperfApp.actions.updateLocation(statePath)(dispatch, getState);
    },

    reset: statePath => async(dispatch, getState) => {
      cp.ReportSection.actions.restoreState(`${statePath}.reportSection`, {
        sources: [cp.ReportSection.DEFAULT_NAME]
      })(dispatch, getState);
      ChromeperfApp.actions.reportSectionShowing(
          statePath, true)(dispatch, getState);
      dispatch({type: ChromeperfApp.reducers.closeAllAlerts.name, statePath});
      ChromeperfApp.actions.closeAllCharts(statePath)(dispatch, getState);
    },
  };

  ChromeperfApp.reducers = {
    ready: (state, action, rootState) => {
      let vulcanizedDate = 'dev_appserver';
      if (window.VULCANIZED_TIMESTAMP) {
        vulcanizedDate = tr.b.formatDate(new Date(
            VULCANIZED_TIMESTAMP.getTime() - (1000 * 60 * 60 * 7))) + ' PT';
      }
      return cp.buildState(ChromeperfApp.State, {vulcanizedDate});
    },

    closeAllAlerts: (state, action, rootState) => {
      return {
        ...state,
        alertsSectionIds: [],
        alertsSectionsById: {},
      };
    },

    newAlerts: (state, {sectionId, options}, rootState) => {
      for (const alerts of Object.values(state.alertsSectionsById)) {
        // If the user mashes the ALERTS button, don't open copies of the same
        // alerts section.
        // TODO scroll to the matching alerts section.
        if (!cp.AlertsSection.matchesOptions(alerts, options)) continue;
        if (state.alertsSectionIds.includes(alerts.sectionId)) return state;
        return {
          ...state,
          closedAlertsIds: undefined,
          alertsSectionIds: [
            alerts.sectionId,
            ...state.alertsSectionIds,
          ],
        };
      }

      if (!sectionId) sectionId = tr.b.GUID.allocateSimple();
      const newSection = cp.AlertsSection.buildState({sectionId, ...options});
      const alertsSectionsById = {...state.alertsSectionsById};
      alertsSectionsById[sectionId] = newSection;
      state = {...state};
      const alertsSectionIds = Array.from(state.alertsSectionIds);
      alertsSectionIds.push(sectionId);
      return {...state, alertsSectionIds, alertsSectionsById};
    },

    newChart: (state, {options}, rootState) => {
      for (const chart of Object.values(state.chartSectionsById)) {
        // If the user mashes the OPEN CHART button in the alerts-section, for
        // example, don't open multiple copies of the same chart.
        if ((options && options.clone) ||
            !cp.ChartSection.matchesOptions(chart, options)) {
          continue;
        }
        // TODO scroll to the matching chart.
        if (state.chartSectionIds.includes(chart.sectionId)) return state;
        return {
          ...state,
          closedChartIds: undefined,
          chartSectionIds: [
            chart.sectionId,
            ...state.chartSectionIds,
          ],
        };
      }

      const sectionId = tr.b.GUID.allocateSimple();
      const newSection = {
        type: cp.ChartSection.is,
        sectionId,
        ...cp.ChartSection.buildState(options || {}),
      };
      const chartSectionsById = {...state.chartSectionsById};
      chartSectionsById[sectionId] = newSection;
      state = {...state, chartSectionsById};

      const chartSectionIds = Array.from(state.chartSectionIds);
      chartSectionIds.push(sectionId);

      if (chartSectionIds.length === 1 && options) {
        const linkedChartState = cp.buildState(
            cp.ChartPair.LinkedState, options);
        state = {...state, linkedChartState};
      }
      return {...state, chartSectionIds};
    },

    closeAlerts: (state, {sectionId}, rootState) => {
      const sectionIdIndex = state.alertsSectionIds.indexOf(sectionId);
      const alertsSectionIds = [...state.alertsSectionIds];
      alertsSectionIds.splice(sectionIdIndex, 1);
      let closedAlertsIds;
      if (!cp.AlertsSection.isEmpty(
          state.alertsSectionsById[sectionId])) {
        closedAlertsIds = [sectionId];
      }
      return {...state, alertsSectionIds, closedAlertsIds};
    },

    forgetClosedAlerts: (state, action, rootState) => {
      const alertsSectionsById = {...state.alertsSectionsById};
      if (state.closedAlertsIds) {
        for (const id of state.closedAlertsIds) {
          delete alertsSectionsById[id];
        }
      }
      return {
        ...state,
        alertsSectionsById,
        closedAlertsIds: undefined,
      };
    },

    closeChart: (state, action, rootState) => {
      // Don't remove the section from chartSectionsById until
      // forgetClosedChart.
      const sectionIdIndex = state.chartSectionIds.indexOf(action.sectionId);
      const chartSectionIds = [...state.chartSectionIds];
      chartSectionIds.splice(sectionIdIndex, 1);
      let closedChartIds;
      if (!cp.ChartSection.isEmpty(state.chartSectionsById[action.sectionId])) {
        closedChartIds = [action.sectionId];
      }
      return {...state, chartSectionIds, closedChartIds};
    },

    closeAllCharts: (state, action, rootState) => {
      return {
        ...state,
        chartSectionIds: [],
        closedChartIds: Array.from(state.chartSectionIds),
      };
    },

    forgetClosedChart: (state, action, rootState) => {
      const chartSectionsById = {...state.chartSectionsById};
      if (state.closedChartIds) {
        for (const id of state.closedChartIds) {
          delete chartSectionsById[id];
        }
      }
      return {
        ...state,
        chartSectionsById,
        closedChartIds: undefined,
      };
    },

    receiveSessionState: (state, action, rootState) => {
      state = {
        ...state,
        isLoading: false,
        showingReportSection: action.sessionState.showingReportSection,
        alertsSectionIds: [],
        alertsSectionsById: {},
        chartSectionIds: [],
        chartSectionsById: {},
      };

      if (action.sessionState.alertsSections) {
        for (const options of action.sessionState.alertsSections) {
          state = ChromeperfApp.reducers.newAlerts(state, {options});
        }
      }
      if (action.sessionState.chartSections) {
        for (const options of action.sessionState.chartSections) {
          state = ChromeperfApp.reducers.newChart(state, {options});
        }
      }
      return state;
    },

    updateLargeDom: (rootState, action, rootStateAgain) => {
      const state = Polymer.Path.get(rootState, action.appStatePath);
      const sectionCount = (
        state.chartSectionIds.length + state.alertsSectionIds.length);
      return {...rootState, largeDom: (sectionCount > 3)};
    },
  };

  ChromeperfApp.getSessionState = state => {
    const alertsSections = [];
    for (const id of state.alertsSectionIds) {
      if (cp.AlertsSection.isEmpty(state.alertsSectionsById[id])) continue;
      alertsSections.push(cp.AlertsSection.getSessionState(
          state.alertsSectionsById[id]));
    }
    const chartSections = [];
    for (const id of state.chartSectionIds) {
      if (cp.ChartSection.isEmpty(state.chartSectionsById[id])) continue;
      chartSections.push(cp.ChartSection.getSessionState(
          state.chartSectionsById[id]));
    }

    return {
      enableNav: state.enableNav,
      showingReportSection: state.showingReportSection,
      reportSection: cp.ReportSection.getSessionState(
          state.reportSection),
      alertsSections,
      chartSections,
    };
  };

  cp.ElementBase.register(ChromeperfApp);

  return {
    ChromeperfApp,
  };
});
