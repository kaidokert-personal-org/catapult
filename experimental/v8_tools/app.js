//  Vue component for drop-down menu; here the metrics,
//  stories and diagnostics are chosen through selection.
'use strict';
const app = new Vue({
  el: '#app',
  data: {
    sampleArr: [],
    guidValue: null,
    selected_metric: null,
    selected_story: null,
    selected_diagnostic: null,
    graph: new GraphData(),
    searchQuery: '',
    gridColumns: ['id', 'metric', 'averageSampleValues'],
    gridData: [],
    parsedMetrics: null,
    globalDiagnostic: null,
    additionalColumns: null
  },

  methods: {
    plotBarChart(data) {
      this.graph.xAxis('Story')
          .yAxis('Memory used (MiB)')
          .title('Average memory used')
          .setData(data)
          .plotBar();
    },
    //  Draw a cumulative frequency plot depending on the target value.
    //  This is for displaying results for the selected parameters
    // from the drop-down menu.
    plotCumulativeFrequency() {
      this
          .plotCumulativeFrequencyPlot(JSON
              .parse(JSON.stringify((this.filteredData))),
          this.selected_story);
    },

    //  Draw a dot plot depending on the target value.
    //  This is mainly for results from the table.
    plotDotPlot(target, story) {
      this.graph
          .xAxis('Memory used (MiB)')
          .title(story)
          .setData(target)
          .plotDot();
    },

    //  Draw a cumulative frequency plot depending on the target value.
    //  This is mainly for the results from the table.
    plotCumulativeFrequencyPlot(target, story) {
      this.graph.xAxis('Cumulative frequency')
          .yAxis('Memory used (MiB)')
          .title(story)
          .setData(target)
          .plotCumulativeFrequency();
    },

    //  Being given a metric, a story, a diagnostic and a set of
    //  subdiagnostics (for example, 3 labels from the total available
    //  ones), the method return the sample values for each subdiagnostic.
    getSubdiagnostics(metric, story, diagnostic, diagnostics) {
      const result = this.sampleArr
          .filter(value => value.name === metric &&
          this.guidValue
              .get(value.diagnostics.stories)[0] ===
              story);

      const content = new Map();
      for (const val of result) {
        const diagnosticItem = this.guidValue.get(
            val.diagnostics[diagnostic]);
        if (diagnosticItem === undefined) {
          continue;
        }
        let currentDiagnostic = '';
        if (typeof diagnosticItem === 'number') {
          currentDiagnostic = diagnosticItem;
        } else {
          currentDiagnostic = diagnosticItem[0];
        }
        if (content.has(currentDiagnostic)) {
          const aux = content.get(currentDiagnostic);
          content.set(currentDiagnostic, aux.concat(val.sampleValues));
        } else {
          content.set(currentDiagnostic, val.sampleValues);
        }
      }
      const obj = {};
      for (const [key, value] of content.entries()) {
        if (diagnostics === undefined ||
          diagnostics.includes(key.toString())) {
          value.map(value => +((value / MiB).toFixed(5)));
          obj[key] = value;
        }
      }
      return obj;
    },

    //  Draw a plot by default with all the sub-diagnostics
    //  in the same plot;
    plotSingleMetricWithAllSubdiagnostics(metric, story, diagnostic) {
      const obj = this.getSubdiagnostics(metric, story, diagnostic);
      this.plotCumulativeFrequencyPlot(obj, story);
    },

    //  Draw a plot depending on the target value which is made
    //  of a metric, a story, a diagnostic and a couple of sub-diagnostics
    //  and the chosen type of plot. All are chosen from the table.
    plotSingleMetric(metric, story, diagnostic,
        diagnostics, chosenPlot) {
      const target = this.targetForMultipleDiagnostics(metric, story,
          diagnostic, diagnostics);
      if (chosenPlot === 'Dot plot') {
        this.plotDotPlot(target, story);
      } else {
        this.plotCumulativeFrequencyPlot(target, story);
      }
    },

    //  Compute the target when the metric, story, diagnostics and
    //  sub-diagnostics are chosen from the table, not from the drop-down menu.
    //  It should be the same for both components but for now they should
    //  be divided.
    targetForMultipleDiagnostics(metric, story, diagnostic, diagnostics) {
      if (metric === null || story === null ||
        diagnostic === null || diagnostics === null) {
        return undefined;
      }
      return this.getSubdiagnostics(metric, story, diagnostic, diagnostics);
    }
  },

  computed: {
    data_loaded() {
      return this.sampleArr.length > 0;
    },

    seen_stories() {
      return this.stories && this.stories.length > 0;
    },

    seen_diagnostics() {
      return this.diagnostics && this.diagnostics.length > 0;
    },

    //  Compute the metrics for the drop-down menu;
    //  The user will chose one of them.
    metrics() {
      if (this.parsedMetrics !== null) {
        return this.parsedMetrics;
      }
      const metricsNames = [];
      this.sampleArr.map(el => metricsNames.push(el.name));
      return _.uniq(metricsNames);
    },

    //  Compute the stories depending on the chosen metric.
    //  The user should chose one of them.
    stories() {
      const reqMetrics = this.sampleArr
          .filter(elem => elem.name === this.selected_metric);
      const storiesByGuid = [];
      for (const elem of reqMetrics) {
        let storyName = this.guidValue.get(elem.diagnostics.stories);
        if (storyName === undefined) {
          continue;
        }
        if (typeof storyName !== 'number') {
          storyName = storyName[0];
        }
        storiesByGuid.push(storyName);
      }
      return _.uniq(storiesByGuid);
    },

    //  Compute all diagnostic elements; the final result will actually
    //  depend on the metric, the story and this diagnostic.
    diagnostics() {
      if (this.selected_story !== null && this.selected_metric !== null) {
        const result = this.sampleArr
            .filter(value => value.name === this.selected_metric &&
                    this.guidValue
                        .get(value.diagnostics.stories)[0] ===
                        this.selected_story);
        const allDiagnostics = result.map(val => Object.keys(val.diagnostics));
        return _.union.apply(this, allDiagnostics);
      }
    },

    //  Compute the final result with the chosen metric, story and diagnostics.
    //  These are chosen from the drop-down menu.
    filteredData() {
      if (this.selected_story === null ||
        this.selected_metric === null ||
        this.selected_diagnostic === null) {
        return undefined;
      }
      return this
          .getSubdiagnostics(this.selected_metric,
              this.selected_story,
              this.selected_diagnostic);
    },

    //  Extract all diagnostic names from all elements.
    allDiagnostics() {
      if (this.sampleArr === undefined) {
        return undefined;
      }
      const allDiagnostics = this.sampleArr
          .map(val => Object.keys(val.diagnostics));
      return _.union.apply(this, allDiagnostics);
    },
  },

  watch: {
    //  Whenever a new metric/ story/ diagnostic is chosen
    //  this function will run for drawing a new type of plot.
    //  These items are chosen from the drop-down menu.
    filteredData() {
      this.plotCumulativeFrequency();
    },

    metrics() {
      this.selected_metric = null;
      this.selected_story = null;
      this.selected_diagnostic = null;
    },
    //  Compute the data for the columns after the user has chosen a
    //  particular global diagnostic that has to be split in
    //  multiple subdiagnostics.
    globalDiagnostic() {
      if (this.globalDiagnostic === null) {
        return undefined;
      }
      this.gridColumns = ['id', 'metric', 'averageSampleValues'];
      const newDiagnostics = new Set();
      const content = new Map();
      for (const elem of this.sampleArr) {
        let diagnostic = this.guidValue.
            get(elem.diagnostics[this.globalDiagnostic]);
        if (diagnostic === undefined) {
          continue;
        } else if (diagnostic !== 'number') {
          diagnostic = diagnostic[0];
        }
        newDiagnostics.add(diagnostic);

        if (!content.has(elem.name)) {
          const map = new Map();
          map.set(diagnostic, [average(elem.sampleValues)]);
          content.set(elem.name, map);
        } else {
          const map = content.get(elem.name);
          if (map.has(diagnostic)) {
            const array = map.get(diagnostic);
            array.push(average(elem.sampleValues));
            map.set(diagnostic, array);
            content.set(elem.name, map);
          } else {
            map.set(diagnostic, [average(elem.sampleValues)]);
            content.set(elem.name, map);
          }
        }
      }
      this.additionalColumns = Array.from(newDiagnostics);
      for (const elem of this.gridData) {
        if (content.get(elem.metric) === undefined) {
          continue;
        }
        for (const diag of Array.from(newDiagnostics)) {
          elem[diag] = average(content.get(elem.metric).get(diag));
        }
      }
    }
  }
});
