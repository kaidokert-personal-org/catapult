/* Copyright 2018 The Chromium Authors. All rights reserved.
   Use of this source code is governed by a BSD-style license that can be
   found in the LICENSE file.
*/
'use strict';
tr.exportTo('cp', () => {
  const CHROMIUM_MILESTONES = {
    // https://omahaproxy.appspot.com/
    // Does not support M<=63
    64: 520840,
    65: 530369,
    66: 540276,
    67: 550428,
    68: 561733,
    69: 576753,
    70: 587811,
    71: 599034,
    72: 612437,
  };
  const CURRENT_MILESTONE = tr.b.math.Statistics.max(
      Object.keys(CHROMIUM_MILESTONES));
  const MIN_MILESTONE = tr.b.math.Statistics.min(
      Object.keys(CHROMIUM_MILESTONES));

  class ReportSection extends cp.ElementBase {
    ready() {
      super.ready();
      this.scrollIntoView(true);
    }

    canEdit_(table, userEmail) {
      return ReportSection.canEdit(table, userEmail);
    }

    observeSources_() {
      this.debounce('loadReports', () => {
        this.dispatch('loadReports', this.statePath);
      }, Polymer.Async.timeOut.after(200));
    }
  }

  ReportSection.canEdit = (table, userEmail) =>
    window.IS_DEBUG ||
    (table && table.owners && userEmail && table.owners.includes(userEmail));

  ReportSection.State = {
    copiedMeasurements: options => false,
    isLoading: options => false,
    milestone: options => parseInt(options.milestone) || CURRENT_MILESTONE,
    minRevision: options => options.minRevision,
    maxRevision: options => options.maxRevision,
    minRevisionInput: options => options.minRevision,
    maxRevisionInput: options => options.maxRevision,
    sectionId: options => options.sectionId || tr.b.GUID.allocateSimple(),
    source: options => cp.MenuInput.buildState({
      label: 'Reports (loading)',
      options: [
        ReportSection.DEFAULT_NAME,
        ReportSection.CREATE,
      ],
      selectedOptions: options.sources ? options.sources : [
        ReportSection.DEFAULT_NAME,
      ],
    }),
    tables: options => [PLACEHOLDER_TABLE],
  };

  ReportSection.buildState = options => cp.buildState(
      ReportSection.State, options);

  ReportSection.properties = {
    ...cp.buildProperties('state', ReportSection.State),
    userEmail: {statePath: 'userEmail'},
  };
  ReportSection.observers = [
    'observeSources_(source.selectedOptions, minRevision, maxRevision)',
  ];

  const DASHES = '-'.repeat(5);
  const PLACEHOLDER_TABLE = {
    name: DASHES,
    isPlaceholder: true,
    statistics: ['avg'],
    report: {
      rows: [],
      tooltip: {},
    },
  };
  // Keep this the same shape as the default report so that the buttons don't
  // move when the default report loads.
  for (let i = 0; i < 4; ++i) {
    const scalars = [];
    for (let j = 0; j < 4 * PLACEHOLDER_TABLE.statistics.length; ++j) {
      scalars.push({value: 0, unit: tr.b.Unit.byName.count});
    }
    PLACEHOLDER_TABLE.report.rows.push({
      labelParts: [
        {
          href: '',
          label: DASHES,
          isFirst: true,
          rowCount: 1,
        },
      ],
      scalars,
    });
  }

  ReportSection.placeholderTable = name => {
    return {
      ...PLACEHOLDER_TABLE,
      name,
    };
  };

  ReportSection.DEFAULT_NAME = 'Chromium Performance Overview';
  ReportSection.CREATE = '[Create new report]';

  ReportSection.actions = {
    selectMilestone: (statePath, milestone) => async(dispatch, getState) => {
      dispatch({
        type: ReportSection.reducers.selectMilestone.name,
        statePath,
        milestone,
      });
    },

    restoreState: (statePath, options) => async(dispatch, getState) => {
      dispatch({
        type: ReportSection.reducers.restoreState.name,
        statePath,
        options,
      });
      const state = Polymer.Path.get(getState(), statePath);
      if (state.minRevision === undefined ||
          state.maxRevision === undefined) {
        ReportSection.actions.selectMilestone(
            statePath, state.milestone)(dispatch, getState);
      }
    },

    loadSources: statePath => async(dispatch, getState) => {
      const reportTemplateInfos = await new cp.ReportNamesRequest().response;
      const rootState = getState();
      const teamFilter = cp.TeamFilter.get(rootState.teamName);
      const reportNames = await teamFilter.reportNames(
          reportTemplateInfos.map(t => t.name));
      dispatch({
        type: ReportSection.reducers.receiveSourceOptions.name,
        statePath,
        reportNames,
      });
    },

    loadReports: statePath => async(dispatch, getState) => {
      let rootState = getState();
      let state = Polymer.Path.get(rootState, statePath);
      let suites = [];
      if (state.source.selectedOptions.includes(ReportSection.CREATE)) {
        suites = await cp.TeamFilter.get(rootState.teamName).suites(
            await new cp.TestSuitesRequest({}).response);
      }
      dispatch({
        type: ReportSection.reducers.requestReports.name,
        statePath,
        suites,
      });

      const names = state.source.selectedOptions.filter(name =>
        name !== ReportSection.CREATE);
      const requestedReports = new Set(state.source.selectedOptions);
      const revisions = [state.minRevision, state.maxRevision];
      const reportTemplateInfos = await new cp.ReportNamesRequest().response;
      const readers = [];

      for (const name of names) {
        for (const templateInfo of reportTemplateInfos) {
          if (templateInfo.name === name) {
            readers.push(new cp.ReportRequest(
                {...templateInfo, revisions}).reader());
          }
        }
      }

      for await (const {results, errors} of new cp.BatchIterator(readers)) {
        rootState = getState();
        state = Polymer.Path.get(rootState, statePath);
        if (!tr.b.setsEqual(requestedReports, new Set(
            state.source.selectedOptions)) ||
            (state.minRevision !== revisions[0]) ||
            (state.maxRevision !== revisions[1])) {
          return;
        }
        if (suites.length === 0) {
          suites = await cp.TeamFilter.get(rootState.teamName).suites(
              await new cp.TestSuitesRequest({}).response);
        }
        dispatch({
          type: ReportSection.reducers.receiveReports.name,
          statePath,
          reports: results,
          suites,
        });
        // ReportSection.actions.renderEditForms(statePath)(dispatch, getState);
        // ReportSection.actions.prefetchCharts(statePath)(dispatch, getState);
      }

      dispatch(Redux.UPDATE(statePath, {isLoading: false}));
    },

    renderEditForm: (statePath, tableIndex) => async(dispatch, getState) => {
      const state = Polymer.Path.get(getState(), statePath);
      const table = state.tables[tableIndex];
      if (table.canEdit === true) return;
      if (table.canEdit !== false) await table.canEdit;
      const promise = (async() => {
        await Promise.all(table.rows.map(async(row, rowIndex) => {
          if (!row.suite || !row.suite.selectedOptions ||
              !row.suite.selectedOptions.length) {
            // TODO this nullcheck should not be necessary
            return;
          }
          const path = `${statePath}.tables.${tableIndex}.rows.${rowIndex}`;
          await cp.ChartSection.actions.describeTestSuites(path)(
              dispatch, getState);
        }));
        const path = `${statePath}.tables.${tableIndex}`;
        dispatch(Redux.UPDATE(path, {canEdit: true}));
      })();
      dispatch(Redux.UPDATE(`${statePath}.tables.${tableIndex}`, {
        canEdit: promise,
      }));
      await promise;
    },

    renderEditForms: statePath => async(dispatch, getState) => {
      const state = Polymer.Path.get(getState(), statePath);
      await Promise.all(state.tables.map(async(table, tableIndex) => {
        await cp.idle();
        await ReportSection.actions.renderEditForm(statePath, tableIndex)(
            dispatch, getState);
      }));
    },

    prefetchCharts: statePath => async(dispatch, getState) => {
      const state = Polymer.Path.get(getState(), statePath);
      const lineDescriptors = [];
      for (const table of state.tables) {
        for (const row of table.rows) {
          if (!row.suite || !row.measurement || !row.bot || !row.testCase) {
            continue;
          }
          lineDescriptors.push({
            suites: row.suite.selectedOptions,
            measurement: row.measurement.selectedOptions[0],
            bots: row.bot.selectedOptions,
            testCases: row.testCase.selectedOptions,
            statistic: 'avg',
            buildType: 'test',
          });
        }
      }
      for (let i = 0; i < lineDescriptors.length; i += 5) {
        await cp.idle();
        await cp.ChartTimeseries.actions.prefetch(
            statePath, lineDescriptors.slice(i, i + 5))(dispatch, getState);
      }
    },

    setMinRevision: (statePath, minRevisionInput) =>
      async(dispatch, getState) => {
        dispatch(Redux.UPDATE(statePath, {minRevisionInput}));
        if (!minRevisionInput.match(/^\d{6}$/)) return;
        dispatch(Redux.UPDATE(statePath, {minRevision: minRevisionInput}));
      },

    setMaxRevision: (statePath, maxRevisionInput) =>
      async(dispatch, getState) => {
        dispatch(Redux.UPDATE(statePath, {maxRevisionInput}));
        if (!maxRevisionInput.match(/^\d{6}$/)) return;
        dispatch(Redux.UPDATE(statePath, {maxRevision: maxRevisionInput}));
      },
  };

  ReportSection.reducers = {
    selectMilestone: (state, {milestone}, rootState) => {
      const maxRevision = (milestone === CURRENT_MILESTONE) ?
        'latest' : CHROMIUM_MILESTONES[milestone + 1];
      const minRevision = CHROMIUM_MILESTONES[milestone];
      return {
        ...state,
        minRevision,
        maxRevision,
        minRevisionInput: minRevision,
        maxRevisionInput: maxRevision,
        milestone,
      };
    },

    restoreState: (state, action, rootState) => {
      if (!action.options) return state;
      const source = {
        ...state.source,
        selectedOptions: action.options.sources,
      };
      return {
        ...state,
        source,
        milestone: parseInt(action.options.milestone || CURRENT_MILESTONE),
        minRevision: action.options.minRevision,
        maxRevision: action.options.maxRevision,
        minRevisionInput: action.options.minRevision,
        maxRevisionInput: action.options.maxRevision,
      };
    },

    receiveSourceOptions: (state, {reportNames}, rootState) => {
      const options = cp.OptionGroup.groupValues(reportNames);
      if (window.IS_DEBUG || rootState.userEmail) {
        options.push(ReportSection.CREATE);
      }
      const label = `Reports (${reportNames.length})`;
      return {...state, source: {...state.source, options, label}};
    },

    requestReports: (state, action, rootState) => {
      const tables = [];
      const tableNames = new Set();
      const selectedNames = state.source.selectedOptions;
      for (const table of state.tables) {
        // Remove tables whose names are unselected.
        if (selectedNames.includes(table.name)) {
          tables.push(table);
          tableNames.add(table.name);
        }
      }
      for (const name of selectedNames) {
        // Add placeholderTables for missing names.
        if (!tableNames.has(name)) {
          if (name === ReportSection.CREATE) {
            tables.push(ReportSection.newTemplate(
                rootState.userEmail, action.suites));
          } else {
            tables.push(ReportSection.placeholderTable(name));
          }
        }
      }
      return {...state, isLoading: true, tables};
    },

    receiveReports: (state, action, rootState) => {
      const tables = [...state.tables];
      for (const report of action.reports) {
        // Remove the placeholderTable for this report.
        if (!report) continue;
        const placeholderIndex = tables.findIndex(table =>
          table && (table.name === report.name));
        tables.splice(placeholderIndex, 1);

        const rows = report.report.rows.map(
            row => ReportSection.transformReportRow(
                row, state.minRevision, state.maxRevision,
                report.report.statistics, action.suites));

        // Right-align labelParts.
        const maxLabelParts = tr.b.math.Statistics.max(rows, row =>
          row.labelParts.length);
        for (const {labelParts} of rows) {
          while (labelParts.length < maxLabelParts) {
            labelParts.unshift({
              href: '',
              isFirst: true,
              label: '',
              rowCount: 1,
            });
          }
        }

        // Compute labelPart.isFirst, labelPart.rowCount.
        for (let rowIndex = 1; rowIndex < rows.length; ++rowIndex) {
          for (let partIndex = 0; partIndex < maxLabelParts; ++partIndex) {
            if (rows[rowIndex].labelParts[partIndex].label !==
                rows[rowIndex - 1].labelParts[partIndex].label) {
              continue;
            }
            rows[rowIndex].labelParts[partIndex].isFirst = false;
            let firstRi = rowIndex - 1;
            while (!rows[firstRi].labelParts[partIndex].isFirst) {
              --firstRi;
            }
            ++rows[firstRi].labelParts[partIndex].rowCount;
          }
        }

        // TODO compute colors for deltaPercent columns

        tables.push({
          ...report,
          ...report.report,
          canEdit: false, // See actions.renderEditForm
          isEditing: false,
          rows,
          tooltip: {},
          maxLabelParts,
          owners: (report.owners || []).join(', '),
          statistic: {
            label: 'Statistics',
            query: '',
            options: [
              'avg',
              'std',
              'count',
              'min',
              'max',
              'median',
              'iqr',
              '90%',
              '95%',
              '99%',
            ],
            selectedOptions: report.report.statistics,
            required: true,
          },
        });
      }
      return {
        ...state,
        tables,
      };
    },

    templateRemoveRow: (state, action, rootState) => {
      const tables = [...state.tables];
      const table = tables[action.tableIndex];
      const rows = [...table.rows];
      rows.splice(action.rowIndex, 1);
      tables[action.tableIndex] = {
        ...table,
        rows,
      };
      return {...state, tables};
    },

    templateAddRow: (table, action, rootState) => {
      const contextRow = table.rows[action.rowIndex];
      const newRow = ReportSection.newTemplateRow({
        suite: {
          options: cp.OptionGroup.groupValues(action.suites),
          label: `Test suites (${action.suites.length})`,
          selectedOptions: [...contextRow.suite.selectedOptions],
        },
        bot: {
          selectedOptions: [...contextRow.bot.selectedOptions],
        },
        testCase: {
          selectedOptions: [...contextRow.testCase.selectedOptions],
        },
      });
      const rows = [...table.rows];
      rows.splice(action.rowIndex + 1, 0, newRow);
      return {...table, rows};
    },
  };

  ReportSection.newTemplate = (userEmail, suites) => {
    return {
      isEditing: true,
      name: '',
      owners: userEmail,
      url: '',
      statistics: [],
      rows: [ReportSection.newTemplateRow({
        suite: {
          options: cp.OptionGroup.groupValues(suites),
          label: `Test suites (${suites.length})`,
        },
      })],
      statistic: {
        label: 'Statistics',
        query: '',
        options: [
          'avg',
          'std',
          'count',
          'min',
          'max',
          'median',
          'iqr',
          '90%',
          '95%',
          '99%',
        ],
        selectedOptions: ['avg'],
        required: true,
      },
    };
  };

  ReportSection.newTemplateRow = ({suite, bot, testCase}) => {
    return {
      label: '',
      suite: {
        ...suite,
        errorMessage: 'Required',
        query: '',
        required: true,
        selectedOptions: suite.selectedOptions || [],
      },
      measurement: {
        errorMessage: 'Require exactly one',
        label: 'Measurement',
        options: [],
        query: '',
        requireSingle: true,
        required: true,
        selectedOptions: [],
      },
      bot: {
        errorMessage: 'Required',
        label: 'Bots',
        options: [],
        query: '',
        required: true,
        selectedOptions: bot ? bot.selectedOptions : [],
      },
      testCase: {
        label: 'Test cases',
        options: [],
        query: '',
        selectedOptions: testCase ? testCase.selectedOptions : [],
      },
    };
  };

  function maybeInt(x) {
    const i = parseInt(x);
    return isNaN(i) ? x : i;
  }

  ReportSection.newStateOptionsFromQueryParams = queryParams => {
    const options = {
      sources: queryParams.getAll('report'),
      milestone: parseInt(queryParams.get('m')) || undefined,
      minRevision: maybeInt(queryParams.get('minRev')) || undefined,
      maxRevision: maybeInt(queryParams.get('maxRev')) || undefined,
    };
    if (options.maxRevision < options.minRevision) {
      [options.maxRevision, options.minRevision] = [
        options.minRevision, options.maxRevision];
    }
    if (options.milestone === undefined &&
        options.minRevision !== undefined &&
        options.maxRevision !== undefined) {
      for (const [milestone, milestoneRevision] of Object.entries(
          CHROMIUM_MILESTONES)) {
        if ((milestoneRevision >= options.minRevision) &&
            ((options.maxRevision === 'latest') ||
             (options.maxRevision >= milestoneRevision))) {
          options.milestone = milestone;
          break;
        }
      }
    }
    return options;
  };

  ReportSection.getSessionState = state => {
    return {
      sources: state.source.selectedOptions,
      milestone: state.milestone,
    };
  };

  ReportSection.getRouteParams = state => {
    const routeParams = new URLSearchParams();
    const selectedOptions = state.source.selectedOptions;
    if (state.containsDefaultSection &&
        selectedOptions.length === 1 &&
        selectedOptions[0] === ReportSection.DEFAULT_NAME) {
      return routeParams;
    }
    for (const option of selectedOptions) {
      if (option === ReportSection.CREATE) continue;
      routeParams.append('report', option);
    }
    routeParams.set('minRev', state.minRevision);
    routeParams.set('maxRev', state.maxRevision);
    return routeParams;
  };

  function chartHref(lineDescriptor) {
    const params = new URLSearchParams({
      measurement: lineDescriptor.measurement,
    });
    for (const suite of lineDescriptor.suites) {
      params.append('suite', suite);
    }
    for (const bot of lineDescriptor.bots) {
      params.append('bot', bot);
    }
    for (const cas of lineDescriptor.cases) {
      params.append('testCase', cas);
    }
    return location.origin + '#' + params;
  }

  ReportSection.transformReportRow = (
      row, minRevision, maxRevision, statistics, suites) => {
    if (!row.suites) row.suites = row.testSuites;
    if (!row.cases) row.cases = row.testCases;

    const href = chartHref(row);
    const labelParts = row.label.split(':').map(label => {
      return {
        href,
        isFirst: true,
        label,
        rowCount: 1,
      };
    });

    let rowUnit = tr.b.Unit.byJSONName[row.units];
    let conversionFactor = 1;
    if (!rowUnit) {
      rowUnit = tr.b.Unit.byName.unitlessNumber;
      const info = tr.v.LEGACY_UNIT_INFO.get(row.units);
      let improvementDirection = tr.b.ImprovementDirection.DONT_CARE;
      if (info) {
        conversionFactor = info.conversionFactor;
        if (info.defaultImprovementDirection !== undefined) {
          improvementDirection = info.defaultImprovementDirection;
        }
        const unitNameSuffix = tr.b.Unit.nameSuffixForImprovementDirection(
            improvementDirection);
        rowUnit = tr.b.Unit.byName[info.name + unitNameSuffix];
      }
    }
    if (rowUnit.improvementDirection === tr.b.ImprovementDirection.DONT_CARE &&
        row.improvement_direction !== 4) {
      const improvementDirection = (row.improvement_direction === 0) ?
        tr.b.ImprovementDirection.BIGGER_IS_BETTER :
        tr.b.ImprovementDirection.SMALLER_IS_BETTER;
      const unitNameSuffix = tr.b.Unit.nameSuffixForImprovementDirection(
          improvementDirection);
      rowUnit = tr.b.Unit.byName[rowUnit.unitName + unitNameSuffix];
    }

    const scalars = [];
    for (const revision of [minRevision, maxRevision]) {
      for (let statistic of statistics) {
        // IndexedDB can return impartial results if there is no data cached for
        // the requested revision.
        if (!row.data[revision]) {
          scalars.push({}); // insert empty column
          continue;
        }

        if (statistic === 'avg') statistic = 'mean';
        if (statistic === 'std') statistic = 'stddev';

        const unit = (statistic === 'count') ? tr.b.Unit.byName.count :
          rowUnit;
        let unitPrefix;
        if (rowUnit.baseUnit === tr.b.Unit.byName.sizeInBytes) {
          unitPrefix = tr.b.UnitPrefixScale.BINARY.KIBI;
        }
        const running = tr.b.math.RunningStatistics.fromDict(
            row.data[revision].statistics);
        scalars.push({
          unit,
          unitPrefix,
          value: running[statistic],
        });
      }
    }
    for (let statistic of statistics) {
      if (statistic === 'avg') statistic = 'mean';
      if (statistic === 'std') statistic = 'stddev';

      // IndexedDB can return impartial results if there is no data cached for
      // the requested min or max revision.
      if (!row.data[minRevision] || !row.data[maxRevision]) {
        scalars.push({}); // insert empty relative delta
        scalars.push({}); // insert empty absolute delta
        continue;
      }

      const unit = ((statistic === 'count') ? tr.b.Unit.byName.count :
        rowUnit).correspondingDeltaUnit;
      const deltaValue = (
        tr.b.math.RunningStatistics.fromDict(
            row.data[maxRevision].statistics)[statistic] -
        tr.b.math.RunningStatistics.fromDict(
            row.data[minRevision].statistics)[statistic]);
      const suffix = tr.b.Unit.nameSuffixForImprovementDirection(
          unit.improvementDirection);
      scalars.push({
        unit: tr.b.Unit.byName[`normalizedPercentageDelta${suffix}`],
        value: deltaValue / tr.b.math.RunningStatistics.fromDict(
            row.data[minRevision].statistics)[statistic],
      });
      scalars.push({
        unit,
        value: deltaValue,
      });
    }
    const actualDescriptors = (
      row.data[minRevision] || row.data[maxRevision] || {}).descriptors;

    return {
      labelParts,
      scalars,
      label: row.label,
      actualDescriptors,
      ...cp.buildState(cp.TimeseriesDescriptor.State, {
        suite: {
          selectedOptions: row.suites,
        },
        measurement: {
          selectedOptions: [row.measurement],
        },
        bot: {
          selectedOptions: row.bots,
        },
        case: {
          selectedOptions: row.cases,
        },
      }),
    };
  };

  cp.ElementBase.register(ReportSection);

  return {ReportSection};
});
