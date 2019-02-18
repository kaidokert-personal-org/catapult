/* Copyright 2018 The Chromium Authors. All rights reserved.
   Use of this source code is governed by a BSD-style license that can be
   found in the LICENSE file.
*/
'use strict';
tr.exportTo('cp', () => {
  /**
   * ChartPair synchronizes revision ranges and axis properties between two
   * charts. Typical use-case includes a minimap for overview and a chart for
   * mouse-over details.
   */
  class ChartPair extends cp.ElementBase {
    hideOptions_(minimapLayout) {
      return this.$.minimap.showPlaceholder(
          (minimapLayout && minimapLayout.isLoading),
          (minimapLayout ? minimapLayout.lines : []));
    }

    async onGetTooltip_(event) {
      const p = event.detail.nearestPoint;
      this.dispatch(Redux.UPDATE(this.statePath, {
        cursorRevision: p.x,
        cursorScalar: new tr.b.Scalar(p.datum.unit, p.y),
      }));
      // Don't reset cursor on mouseLeave -- allow users to scroll through
      // sparklines.
    }

    async onMenuKeyup_(event) {
      if (event.key === 'Escape') {
        await this.dispatch('showOptions', this.statePath, false);
      }
    }

    async onMenuBlur_(event) {
      if (cp.isElementChildOf(event.relatedTarget, this.$.options_container)) {
        return;
      }
      await this.dispatch('showOptions', this.statePath, false);
    }

    async onOptionsToggle_(event) {
      await this.dispatch('showOptions', this.statePath,
          !this.isShowingOptions);
    }

    async onMinimapBrush_(event) {
      if (event.detail.sourceEvent.detail.state !== 'end') return;
      await this.dispatch('brushMinimap', this.statePath);
      if (this.isLinked) {
        await this.dispatch('updateLinkedRevisions', this.linkedStatePath,
            this.minRevision, this.maxRevision);
      }
    }

    async onChartClick_(event) {
      await this.dispatch('chartClick', this.statePath);
    }

    async onBrush_(event) {
      await this.dispatch('brushChart', this.statePath,
          event.detail.brushIndex,
          event.detail.value);
    }

    async onToggleLinked_(event) {
      await this.dispatch('toggleLinked', this.statePath, this.linkedStatePath);
    }

    async onToggleZeroYAxis_(event) {
      await this.dispatch('toggleZeroYAxis', this.statePath);
      if (this.isLinked) {
        await this.dispatch('toggleLinkedZeroYAxis', this.linkedStatePath);
      }
    }

    async onToggleFixedXAxis_(event) {
      await this.dispatch('toggleFixedXAxis', this.statePath);
      if (this.isLinked) {
        await this.dispatch('toggleLinkedFixedXAxis', this.linkedStatePath);
      }
    }

    observeLineDescriptors_(newLineDescriptors, oldLineDescriptors) {
      if (newLineDescriptors === oldLineDescriptors) return; // WTF, polymer
      this.dispatch('load', this.statePath);
    }

    observeLinkedCursor_() {
      if (!this.isLinked) return;
      this.dispatch(Redux.UPDATE(this.statePath, {
        cursorRevision: this.linkedCursorRevision,
        cursorScalar: this.linkedCursorScalar,
      }));
    }

    observeLinkedRevisions_() {
      if (!this.isLinked) return;
      this.dispatch('updateRevisions', this.statePath,
          this.linkedMinRevision, this.linkedMaxRevision);
    }

    observeLinkedMode_() {
      if (!this.isLinked) return;
      if (this.mode === this.linkedMode) return;
      this.dispatch('mode', this.statePath, this.linkedMode);
    }

    observeLinkedZeroYAxis_() {
      if (!this.isLinked) return;
      if (this.zeroYAxis === this.linkedZeroYAxis) return;
      this.dispatch('toggleZeroYAxis', this.statePath);
    }

    observeLinkedFixedXAxis_() {
      if (!this.isLinked) return;
      if (this.fixedXAxis === this.linkedFixedXAxis) return;
      this.dispatch('toggleFixedXAxis', this.statePath);
    }

    onModeChange_(event) {
      this.dispatch('mode', this.statePath, event.detail.value);
      if (this.isLinked) {
        this.dispatch('linkedMode', this.linkedStatePath, event.detail.value);
      }
    }

    observeChartLoading_(newLoading, oldLoading) {
      if (oldLoading && !newLoading) {
        this.dispatch('updateStale', this.statePath);
      }
    }

    observeCursor_(cursorRevision, cursorScalar) {
      this.dispatch('setCursors', this.statePath);
      if (this.isLinked &&
          (this.cursorRevision !== this.linkedCursorRevision ||
           this.cursorScalar !== this.linkedCursorScalar)) {
        this.dispatch(Redux.UPDATE(this.linkedStatePath, {
          linkedCursorRevision: this.cursorRevision,
          linkedCursorScalar: this.cursorScalar,
        }));
      }
    }
  }

  ChartPair.State = {
    lineDescriptors: options => [],
    isExpanded: options => options.isExpanded !== false,
    minimapLayout: options => {
      const minimapLayout = {
        ...cp.ChartTimeseries.buildState({
          levelOfDetail: cp.LEVEL_OF_DETAIL.XY,
        }),
        graphHeight: 40,
      };
      minimapLayout.xAxis.height = 15;
      minimapLayout.yAxis.width = 50;
      minimapLayout.yAxis.generateTicks = false;
      return minimapLayout;
    },
    chartLayout: options => {
      const chartLayout = cp.ChartTimeseries.buildState({
        levelOfDetail: cp.LEVEL_OF_DETAIL.ANNOTATIONS,
        showTooltip: true,
      });
      chartLayout.xAxis.height = 15;
      chartLayout.xAxis.showTickLines = true;
      chartLayout.yAxis.width = 50;
      chartLayout.yAxis.showTickLines = true;
      return chartLayout;
    },
    isShowingOptions: options => false,
    isLinked: options => options.isLinked !== false,
    cursorRevision: options => 0,
    cursorScalar: options => undefined,
    minRevision: options => options.minRevision,
    maxRevision: options => options.maxRevision,
    mode: options => options.mode || 'normalizeUnit',
    zeroYAxis: options => options.zeroYAxis || false,
    fixedXAxis: options => options.fixedXAxis !== false,
  };

  ChartPair.buildState = options => cp.buildState(ChartPair.State, options);

  ChartPair.observers = [
    'observeLinkedCursor_(linkedCursorRevision, linkedCursorScalar)',
    'observeLinkedRevisions_(linkedMinRevision, linkedMaxRevision)',
    'observeLinkedMode_(linkedMode)',
    'observeLinkedZeroYAxis_(linkedZeroYAxis)',
    'observeLinkedFixedXAxis_(linkedFixedXAxis)',
    'observeCursor_(cursorRevision, cursorScalar)',
  ];

  ChartPair.LinkedState = {
    linkedCursorRevision: options => undefined,
    linkedCursorScalar: options => undefined,
    linkedMinRevision: options => options.minRevision,
    linkedMaxRevision: options => options.maxRevision,
    linkedMode: options => options.mode || 'normalizeUnit',
    linkedZeroYAxis: options => options.zeroYAxis || false,
    linkedFixedXAxis: options => options.fixedXAxis !== false,
  };

  ChartPair.properties = {
    ...cp.buildProperties('state', ChartPair.State),
    ...cp.buildProperties('linkedState', ChartPair.LinkedState),
    isChartLoading: {
      computed: 'identity_(chartLayout.isLoading)',
      observer: 'observeChartLoading_',
    },
  };

  ChartPair.properties.lineDescriptors.observer = 'observeLineDescriptors_';

  ChartPair.actions = {
    setCursors: statePath => async(dispatch, getState) => {
      dispatch({
        type: ChartPair.reducers.setCursors.name,
        statePath,
      });
    },

    updateRevisions: (statePath, minRevision, maxRevision) =>
      async(dispatch, getState) => {
        const state = Polymer.Path.get(getState(), statePath);
        if (minRevision === state.minRevision &&
            maxRevision === state.maxRevision) {
          return;
        }
        dispatch(Redux.UPDATE(statePath, {minRevision, maxRevision}));
        ChartPair.actions.load(statePath)(dispatch, getState);
      },

    updateStale: statePath => async(dispatch, getState) => {
      dispatch({type: ChartPair.reducers.updateStale.name, statePath});
    },

    updateLinkedRevisions: (
        linkedStatePath, linkedMinRevision, linkedMaxRevision) =>
      async(dispatch, getState) => {
        const state = Polymer.Path.get(getState(), linkedStatePath);
        if (linkedMinRevision === state.linkedMinRevision &&
            linkedMaxRevision === state.linkedMaxRevision) {
          return;
        }
        dispatch(Redux.UPDATE(linkedStatePath, {
          linkedMinRevision, linkedMaxRevision,
        }));
      },

    toggleLinked: (statePath, linkedStatePath) => async(dispatch, getState) => {
      dispatch({
        type: ChartPair.reducers.toggleLinked.name,
        statePath,
        linkedStatePath,
      });
      ChartPair.actions.load(statePath)(dispatch, getState);
    },

    toggleZeroYAxis: statePath => async(dispatch, getState) => {
      dispatch(Redux.TOGGLE(`${statePath}.zeroYAxis`));
      ChartPair.actions.load(statePath)(dispatch, getState);
    },

    toggleLinkedZeroYAxis: linkedStatePath => async(dispatch, getState) => {
      dispatch(Redux.TOGGLE(`${linkedStatePath}.linkedZeroYAxis`));
    },

    toggleFixedXAxis: statePath => async(dispatch, getState) => {
      dispatch(Redux.TOGGLE(`${statePath}.fixedXAxis`));
      ChartPair.actions.load(statePath)(dispatch, getState);
    },

    toggleLinkedFixedXAxis: linkedStatePath => async(dispatch, getState) => {
      dispatch(Redux.TOGGLE(`${linkedStatePath}.linkedFixedXAxis`));
    },

    showOptions: (statePath, isShowingOptions) => async(dispatch, getState) => {
      dispatch(Redux.UPDATE(statePath, {isShowingOptions}));
    },

    brushMinimap: statePath => async(dispatch, getState) => {
      dispatch({
        type: ChartPair.reducers.brushMinimap.name,
        statePath,
      });
    },

    brushChart: (statePath, brushIndex, value) =>
      async(dispatch, getState) => {
        const path = `${statePath}.chartLayout.xAxis.brushes.${brushIndex}`;
        dispatch(Redux.UPDATE(path, {xPct: value + '%'}));
      },

    load: statePath => async(dispatch, getState) => {
      const state = Polymer.Path.get(getState(), statePath);
      if (!state || !state.lineDescriptors ||
          state.lineDescriptors.length === 0) {
        dispatch(Redux.CHAIN(
            Redux.UPDATE(`${statePath}.minimapLayout`, {lineDescriptors: []}),
            Redux.UPDATE(`${statePath}.chartLayout`, {lineDescriptors: []}),
        ));
        return;
      }

      const {firstNonEmptyLineDescriptor, timeserieses} =
        await ChartPair.findFirstNonEmptyLineDescriptor(
            state.lineDescriptors, `${statePath}.minimapLayout`, dispatch,
            getState);

      let firstRevision = tr.b.math.Statistics.min(timeserieses.map(ts => {
        if (!ts) return Infinity;
        const datum = ts[0];
        if (datum === undefined) return Infinity;
        return datum.revision;
      }));
      if (firstRevision === Infinity) {
        firstRevision = undefined;
      }

      let lastRevision = tr.b.math.Statistics.max(timeserieses.map(ts => {
        if (!ts) return -Infinity;
        const datum = ts[ts.length - 1];
        if (datum === undefined) return -Infinity;
        return datum.revision;
      }));
      if (lastRevision === -Infinity) {
        lastRevision = undefined;
      }

      let minRevision = state.minRevision;
      if (!minRevision || minRevision >= lastRevision) {
        let closestTimestamp = Infinity;
        const minTimestampMs = new Date() - MS_PER_MONTH;
        for (const timeseries of timeserieses) {
          if (!timeseries || !timeseries.length) continue;
          const datum = tr.b.findClosestElementInSortedArray(
              timeseries, d => d.timestamp, minTimestampMs);
          if (!datum) continue;
          const timestamp = datum.timestamp;
          if (Math.abs(timestamp - minTimestampMs) <
              Math.abs(closestTimestamp - minTimestampMs)) {
            minRevision = datum.revision;
            closestTimestamp = timestamp;
          }
        }
      }

      let maxRevision = state.maxRevision;
      if (!maxRevision || maxRevision <= firstRevision) {
        maxRevision = lastRevision;
        dispatch(Redux.UPDATE(statePath, {maxRevision}));
      }

      const minimapLineDescriptors = [];
      if (firstNonEmptyLineDescriptor) {
        minimapLineDescriptors.push({
          ...firstNonEmptyLineDescriptor,
          icons: [],
        });
      }

      dispatch(Redux.UPDATE(`${statePath}.minimapLayout`, {
        lineDescriptors: minimapLineDescriptors,
        brushRevisions: [minRevision, maxRevision],
        fixedXAxis: state.fixedXAxis,
      }));

      let lineDescriptors = state.lineDescriptors;
      if (lineDescriptors.length === 1) {
        lineDescriptors = [...lineDescriptors];
        lineDescriptors.push({
          ...state.lineDescriptors[0],
          buildType: 'ref',
          icons: [],
        });
      }

      dispatch(Redux.UPDATE(`${statePath}.chartLayout`, {
        lineDescriptors,
        minRevision,
        maxRevision,
        brushRevisions: [],
        fixedXAxis: state.fixedXAxis,
        mode: state.mode,
        zeroYAxis: state.zeroYAxis,
      }));
    },

    chartClick: statePath => async(dispatch, getState) => {
      dispatch(Redux.UPDATE(`${statePath}.chartLayout.xAxis`, {brushes: []}));
    },

    mode: (statePath, mode) => async(dispatch, getState) => {
      dispatch(Redux.UPDATE(statePath, {mode}));
      ChartPair.actions.load(statePath)(dispatch, getState);
    },

    linkedMode: (linkedStatePath, linkedMode) => async(dispatch, getState) => {
      dispatch(Redux.UPDATE(linkedStatePath, {linkedMode}));
    }
  };

  ChartPair.reducers = {
    setCursors: (state, action, rootState) => {
      let minimapXPct;
      let chartXPct;
      let color;
      let chartYPct;

      if (state.cursorRevision && state.chartLayout &&
          state.chartLayout.xAxis && !state.chartLayout.xAxis.range.isEmpty) {
        if (state.fixedXAxis) {
          // Bisect to find point nearest to cursorRevision.
          minimapXPct = tr.b.findClosestElementInSortedArray(
              state.minimapLayout.lines[0].data,
              d => d.x,
              state.cursorRevision).xPct + '%';

          let nearestDatum;
          for (const line of state.chartLayout.lines) {
            const datum = tr.b.findClosestElementInSortedArray(
                line.data, d => d.x, state.cursorRevision);
            if (!nearestDatum ||
                (Math.abs(state.cursorRevision - datum.x) <
                 Math.abs(state.cursorRevision - nearestDatum.x))) {
              nearestDatum = datum;
            }
          }
          chartXPct = nearestDatum.xPct + '%';
        } else {
          minimapXPct = state.minimapLayout.xAxis.range.normalize(
              state.cursorRevision) * 100 + '%';
          chartXPct = state.chartLayout.xAxis.range.normalize(
              state.cursorRevision) * 100 + '%';
        }

        if (state.chartLayout.tooltip &&
            state.chartLayout.tooltip.isVisible) {
          color = tr.b.Color.fromString(state.chartLayout.tooltip.color);
          color.a = 0.8;
        }
      }

      if (state.cursorScalar && state.chartLayout && state.chartLayout.yAxis) {
        let yRange;
        if (state.mode === 'normalizeUnit') {
          if (state.chartLayout.yAxis.rangeForUnitName) {
            yRange = state.chartLayout.yAxis.rangeForUnitName.get(
                state.cursorScalar.unit.baseUnit.unitName);
          }
        } else if (state.chartLayout.lines.length === 1) {
          yRange = state.chartLayout.lines[0].yRange;
        }
        if (yRange) {
          chartYPct = (1 - yRange.normalize(
              state.cursorScalar.value)) * 100 + '%';
        }
      }

      return {
        ...state,
        minimapLayout: {
          ...state.minimapLayout,
          xAxis: {
            ...state.minimapLayout.xAxis,
            cursor: {
              pct: minimapXPct,
            },
          },
        },
        chartLayout: {
          ...state.chartLayout,
          xAxis: {
            ...state.chartLayout.xAxis,
            cursor: {
              pct: chartXPct,
              color,
            },
          },
          yAxis: {
            ...state.chartLayout.yAxis,
            cursor: {
              color,
              pct: chartYPct,
            },
          },
        },
      };
    },

    toggleLinked: (state, {linkedStatePath}, rootState) => {
      state = {...state, isLinked: !state.isLinked};
      if (state.isLinked) {
        const linkedState = Polymer.Path.get(rootState, linkedStatePath);
        state = {
          ...state,
          cursorRevision: linkedState.linkedCursorRevision,
          minRevision: linkedState.linkedMinRevision,
          maxRevision: linkedState.linkedMaxRevision,
          mode: linkedState.mode,
          zeroYAxis: linkedState.linkedZeroYAxis,
          fixedXAxis: linkedState.linkedFixedXAxis,
        };
      }
      return state;
    },

    receiveTestSuites: (state, action, rootState) => {
      if (rootState.userEmail &&
          (action.options.length < state.suite.options.length)) {
        // The loadTestSuites() in actions.connected might race with the
        // loadTestSuites() in actions.authChange. If the internal test suites
        // load first then the public test suites load, ignore the public test
        // suites. If the user signs out, then userEmail will become
        // the empty string, so load the public test suites.
        return state;
      }
      const suite = {
        ...state.suite,
        options: action.options,
        label: `Test suites (${action.count})`,
      };
      return {...state, suite};
    },

    brushMinimap: (state, action, rootState) => {
      if (state.minimapLayout.lines.length === 0) return state;
      const range = new tr.b.math.Range();
      for (const brush of state.minimapLayout.xAxis.brushes) {
        const index = tr.b.findLowIndexInSortedArray(
            state.minimapLayout.lines[0].data,
            datum => datum.xPct,
            parseFloat(brush.xPct));
        const datum = state.minimapLayout.lines[0].data[index];
        if (!datum) continue;
        range.addValue(datum.x);
      }
      const minRevision = range.min;
      const maxRevision = range.max;
      return {
        ...state,
        minRevision,
        maxRevision,
        chartLayout: {
          ...state.chartLayout,
          minRevision,
          maxRevision,
        },
      };
    },

    updateLegendColors: (state, action, rootState) => {
      if (!state.legend) return state;
      const colorMap = new Map();
      for (const line of state.chartLayout.lines) {
        colorMap.set(cp.ChartTimeseries.stringifyDescriptor(
            line.descriptor), line.color);
      }
      function handleLegendEntry(entry) {
        if (entry.children) {
          return {...entry, children: entry.children.map(handleLegendEntry)};
        }
        const color = colorMap.get(cp.ChartTimeseries.stringifyDescriptor(
            entry.lineDescriptor));
        return {...entry, color};
      }
      return {...state, legend: state.legend.map(handleLegendEntry)};
    },

    buildLegend: (state, action, rootState) => {
      const legend = ChartPair.buildLegend(
          ChartPair.parameterMatrix(state));
      return {...state, legend};
    },

    updateTitle: (state, action, rootState) => {
      if (state.isTitleCustom) return state;
      let title = state.measurement.selectedOptions.join(', ');
      if (state.bot.selectedOptions.length > 0 &&
          state.bot.selectedOptions.length < 4) {
        title += ' on ' + state.bot.selectedOptions.join(', ');
      }
      if (state.case.selectedOptions.length > 0 &&
          state.case.selectedOptions.length < 4) {
        title += ' for ' + state.case.selectedOptions.join(', ');
      }
      return {
        ...state,
        title,
      };
    },

    receiveDescriptor: (state, action, rootState) => {
      const measurement = {
        ...state.measurement,
        optionValues: action.descriptor.measurements,
        options: cp.OptionGroup.groupValues(action.descriptor.measurements),
        label: `Measurements (${action.descriptor.measurements.size})`,
      };

      const botOptions = cp.OptionGroup.groupValues(action.descriptor.bots);
      const bot = {
        ...state.bot,
        optionValues: action.descriptor.bots,
        options: botOptions.map(option => {
          return {...option, isExpanded: true};
        }),
        label: `Bots (${action.descriptor.bots.size})`,
      };

      const caseOptions = [];
      if (action.descriptor.cases.size) {
        caseOptions.push({
          label: `All ${action.descriptor.cases.size} test cases`,
          isExpanded: true,
          value: '*',
          options: cp.OptionGroup.groupValues(action.descriptor.cases),
        });
      }

      const cas = {
        ...state.case,
        optionValues: action.descriptor.cases,
        options: caseOptions,
        label: `Test cases (${action.descriptor.cases.size})`,
        tags: {
          ...state.case.tags,
          options: cp.OptionGroup.groupValues(action.descriptor.caseTags),
        },
      };

      return {...state, measurement, bot, case: cas};
    },

    finalizeParameters: (state, action, rootState) => {
      const measurement = {
        ...state.measurement,
        selectedOptions: state.measurement.selectedOptions.filter(m =>
          state.measurement.optionValues.has(m)),
      };

      const bot = {...state.bot};

      if (bot.selectedOptions.length === 0 ||
          ((bot.selectedOptions.length === 1) &&
          (bot.selectedOptions[0] === '*'))) {
        bot.selectedOptions = [...bot.optionValues];
      } else {
        bot.selectedOptions = bot.selectedOptions.filter(b =>
          bot.optionValues.has(b));
      }

      const cas = {
        ...state.case,
        selectedOptions: state.case.selectedOptions.filter(t =>
          state.case.optionValues.has(t)),
      };

      return {...state, measurement, bot, case: cas};
    },

    updateStale: (state, action, rootState) => {
      // Add an icon to the last datum of a line if it's stale.
      if ((state.minimapLayout.lines.length === 0) ||
          (state.minimapLayout.brushRevisions[1] <
           state.minimapLayout.lines[0].data[
               state.minimapLayout.lines[0].data.length - 1].x)) {
        return state;
      }

      const now = new Date();
      const staleMs = window.IS_DEBUG ? 1 : MS_PER_DAY;
      const staleTimestamp = now - staleMs;
      let anyStale = false;
      const lines = state.chartLayout.lines.map(line => {
        const minDate = line.data[line.data.length - 1].datum.timestamp;
        if (minDate >= staleTimestamp) return line;
        anyStale = true;
        let hue;
        if (minDate < (now - (28 * staleMs))) {
          hue = 0;  // red
        } else if (minDate < (now - (7 * staleMs))) {
          hue = 20;  // red-orange
        } else if (minDate < (now - staleMs)) {
          hue = 40;  // orange
        }
        const iconColor = `hsl(${hue}, 90%, 60%)`;
        return cp.setImmutable(line, `data.${line.data.length - 1}`, datum => {
          return {...datum, icon: 'cp:clock', iconColor};
        });
      });
      if (!anyStale) return state;
      return {...state, chartLayout: {...state.chartLayout, lines}};
    },
  };

  const MS_PER_DAY = tr.b.convertUnit(
      1, tr.b.UnitScale.TIME.DAY, tr.b.UnitScale.TIME.MILLI_SEC);
  const MS_PER_MONTH = tr.b.convertUnit(
      1, tr.b.UnitScale.TIME.MONTH, tr.b.UnitScale.TIME.MILLI_SEC);

  ChartPair.findFirstNonEmptyLineDescriptor = async(
    lineDescriptors, refStatePath, dispatch, getState) => {
    for (const lineDescriptor of lineDescriptors) {
      const fetchDescriptors = cp.ChartTimeseries.createFetchDescriptors(
          lineDescriptor, cp.LEVEL_OF_DETAIL.XY);

      const results = await Promise.all(fetchDescriptors.map(
          async fetchDescriptor => {
            const reader = new cp.TimeseriesRequest(fetchDescriptor).reader();
            for await (const timeseries of reader) {
              return timeseries;
            }
          }));

      for (const timeseries of results) {
        if (!timeseries || !timeseries.length) continue;
        return {
          firstNonEmptyLineDescriptor: lineDescriptor,
          timeserieses: results,
        };
      }
    }

    return {
      timeserieses: [],
    };
  };

  cp.ElementBase.register(ChartPair);

  return {
    ChartPair,
  };
});
