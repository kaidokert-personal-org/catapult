/* Copyright 2018 The Chromium Authors. All rights reserved.
   Use of this source code is governed by a BSD-style license that can be
   found in the LICENSE file.
*/
'use strict';
tr.exportTo('cp', () => {
  class DropdownInput extends cp.ElementBase {
    connectedCallback() {
      super.connectedCallback();
      this.observeIsFocused_();
    }

    async observeIsFocused_() {
      if (this.isFocused) {
        this.$.input.focus();
      } else {
        this.$.input.blur();
      }
    }

    renderDropdown_(hasBeenOpened, largeDom) {
      return hasBeenOpened || !largeDom;
    }

    isDisabled_(alwaysEnabled, options) {
      return !alwaysEnabled && options && (options.length === 0);
    }

    isValid_(selectedOptions, alwaysEnabled, options) {
      if (this.isDisabled_(alwaysEnabled, options)) return true;
      if (!this.required) return true;
      if (!this.requireSingle && !this.isEmpty_(selectedOptions)) return true;
      if (this.requireSingle && (selectedOptions.length === 1)) return true;
      return false;
    }

    showRecommended_(recommended, query) {
      return !this.isEmpty_(recommended) && this.isEmpty_(query);
    }

    showColumns_(columns, query) {
      return !this.isEmpty_(columns) && this.isEmpty_(query);
    }

    getInputValue_(isFocused, query, selectedOptions) {
      return DropdownInput.inputValue(isFocused, query, selectedOptions);
    }

    async onFocus_(event) {
      await this.dispatch('focus', this.statePath);
    }

    async onBlur_(event) {
      if (event.relatedTarget === this.$.dropdown ||
          cp.isElementChildOf(event.relatedTarget, this) ||
          cp.isElementChildOf(event.relatedTarget, this.$.dropdown)) {
        this.$.input.focus();
        return;
      }
      await this.dispatch('blur', this.statePath);
    }

    async onKeyup_(event) {
      if (event.key === 'Escape') {
        this.$.input.blur();
        return;
      }
      await this.dispatch('onKeyup', this.statePath, event.target.value);
      this.dispatchEvent(new CustomEvent('input-keyup', {
        detail: {
          key: event.key,
          value: this.query,
        },
      }));
    }

    async onClear_(event) {
      await this.dispatch('clear', this.statePath);
      this.dispatchEvent(new CustomEvent('clear'));
      this.dispatchEvent(new CustomEvent('option-select', {
        bubbles: true,
        composed: true,
      }));
    }

    async onColumnSelect_(event) {
      await this.dispatch('onColumnSelect', this.statePath);
      this.dispatchEvent(new CustomEvent('option-select', {
        bubbles: true,
        composed: true,
      }));
    }
  }

  DropdownInput.inputValue = (isFocused, query, selectedOptions) => {
    if (isFocused) return query;
    if (selectedOptions === undefined) return '';
    if (selectedOptions.length === 0) return '';
    if (selectedOptions.length === 1) return selectedOptions[0];
    return `[${selectedOptions.length} selected]`;
  };

  DropdownInput.State = {
    ...cp.OptionGroup.RootState,
    ...cp.OptionGroup.State,
    alwaysEnabled: options => options.alwaysEnabled !== false,
    columns: options => options.columns || [],
    errorMessage: options => options.errorMessage || '',
    focusTimestamp: options => undefined,
    hasBeenOpened: options => false,
    label: options => options.label || '',
    recommended: options => options.recommended || {},
    requireSingle: options => options.requireSingle || false,
    required: options => options.required || false,
  };

  DropdownInput.buildState = options => cp.buildState(
      DropdownInput.State, options);

  DropdownInput.properties = {
    ...cp.buildProperties('state', DropdownInput.State),
    largeDom: {statePath: 'largeDom'},
    rootFocusTimestamp: {statePath: 'focusTimestamp'},
    isFocused: {computed: 'isEqual_(focusTimestamp, rootFocusTimestamp)'},
  };

  DropdownInput.observers = ['observeIsFocused_(isFocused)'];

  DropdownInput.actions = {
    focus: inputStatePath => async(dispatch, getState) => {
      dispatch({
        type: DropdownInput.reducers.focus.name,
        // NOT "statePath"! ElementBase.statePathReducer would mess that up.
        inputStatePath,
      });
    },

    blurAll: () => async(dispatch, getState) => {
      dispatch({
        type: DropdownInput.reducers.blur.name,
        statePath: '',
      });
    },

    blur: statePath => async(dispatch, getState) => {
      dispatch({
        type: DropdownInput.reducers.blur.name,
        statePath,
      });
    },

    clear: statePath => async(dispatch, getState) => {
      dispatch(Redux.UPDATE(statePath, {
        query: '',
        selectedOptions: [],
      }));
      cp.DropdownInput.actions.focus(statePath)(dispatch, getState);
    },

    onKeyup: (statePath, query) => async(dispatch, getState) => {
      dispatch(Redux.UPDATE(statePath, {query}));
    },

    onColumnSelect: statePath =>
      async(dispatch, getState) => {
        dispatch({
          type: DropdownInput.reducers.onColumnSelect.name,
          statePath,
        });
      },

    populateColumns: statePath => async(dispatch, getState) => {
      dispatch({
        type: DropdownInput.reducers.populateColumns.name,
        statePath,
      });
    },
  };

  DropdownInput.reducers = {
    populateColumns: (state, action, rootState) => {
      const columnOptions = [];
      for (const option of state.options) {
        for (const name of cp.OptionGroup.getValuesFromOption(option)) {
          const columns = DropdownInput.parseColumns(name);
          while (columnOptions.length < columns.length) {
            columnOptions.push(new Set());
          }
          for (let i = 0; i < columns.length; ++i) {
            columnOptions[i].add(columns[i]);
          }
        }
      }

      const selectedColumns = [];
      while (selectedColumns.length < columnOptions.length) {
        selectedColumns.push(new Set());
      }
      for (const name of state.selectedOptions) {
        const columns = DropdownInput.parseColumns(name);
        for (let i = 0; i < columns.length; ++i) {
          selectedColumns[i].add(columns[i]);
        }
      }

      // select column options matching selectedOptions
      // set state.columns
      const columns = columnOptions.map((options, columnIndex) => {
        return {
          options: cp.OptionGroup.groupValues([...options].sort()),
          selectedOptions: [...selectedColumns[columnIndex]],
        };
      });
      return {...state, columns};
    },

    onColumnSelect: (state, action, rootState) => {
      // Remove all memory measurements from state.selectedOptions
      const selectedOptions = state.selectedOptions.filter(v =>
        !v.startsWith('memory:'));

      // Add all options whose columns are all selected.
      const selectedColumns = state.columns.map(column =>
        column.selectedOptions);
      // TODO reverse parseColumns to construct names from selectedColumns.
      for (const option of state.options) {
        for (const value of cp.OptionGroup.getValuesFromOption(option)) {
          if (DropdownInput.allColumnsSelected(value, selectedColumns)) {
            selectedOptions.push(value);
          }
        }
      }

      return {...state, selectedOptions};
    },

    focus: (rootState, action, rootStateAgain) => {
      const focusTimestamp = window.performance.now();
      rootState = {...rootState, focusTimestamp};
      if (!action.inputStatePath) return rootState; // Blur all dropdown-inputs

      return cp.setImmutable(
          rootState, action.inputStatePath, inputState => {
            return {...inputState, focusTimestamp, hasBeenOpened: true};
          });
    },

    blur: (state, action, rootState) => {
      return {
        ...state,
        focusTimestamp: window.performance.now(),
        query: '',
      };
    },
  };

  DropdownInput.parseColumns = name => {
    const parts = name.split(':');
    if (parts[0] !== 'memory') return [];
    if (parts.length < 5) return [];

    const browser = parts[1];
    let process = parts[2].replace(/_processe?/, '');
    if (process === 'alls') process = 'all';
    const source = parts[3].replace(/^reported_/, '');
    let component = parts.slice(4, parts.length - 1).join(':').replace(
        /system_memory/, 'system');
    if (!component) component = 'overall';
    const size = parts[parts.length - 1].replace(/_size(_\w)?$/, '');
    return [browser, process, source, component, size];
  };

  DropdownInput.allColumnsSelected = (name, selectedColumns) => {
    const columns = DropdownInput.parseColumns(name);
    if (columns.length === 0) return false;
    for (let i = 0; i < columns.length; ++i) {
      if (!selectedColumns[i].includes(columns[i])) return false;
    }
    return true;
  };

  cp.ElementBase.register(DropdownInput);

  return {
    DropdownInput,
  };
});
