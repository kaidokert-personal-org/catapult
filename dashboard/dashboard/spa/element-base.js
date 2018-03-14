/* Copyright 2018 The Chromium Authors. All rights reserved.
   Use of this source code is governed by a BSD-style license that can be
   found in the LICENSE file.
*/
'use strict';

tr.exportTo('cp', () => {
  function setImmutableInternal_(obj, path, value, depth) {
    // Based on dot-prop-immutable:
    // https://github.com/debitoor/dot-prop-immutable/blob/master/index.js
    if (obj === undefined) {
      path = Polymer.Path.normalize(path.slice(0, depth));
      throw new Error(`undefined at ${path}`);
    }
    if (path.length === depth) {
      // Recursive base case.
      if (typeof value === 'function') {
        return value(obj);
      }
      return value;
    }
    let key = path[depth];
    if (Array.isArray(obj)) key = parseInt(key);
    const wrappedValue = setImmutableInternal_(
        obj[key], path, value, depth + 1);
    const clone = Array.isArray(obj) ? Array.from(obj) : {...obj};
    if (Array.isArray(obj)) {
      clone.splice(key, 1, wrappedValue);
    } else {
      clone[key] = wrappedValue;
    }
    return clone;
  }

  /**
   * Like Polymer.Path.set(), but returns a modified clone of root instead of
   * modifying root. In order to compute a new value from the existing value at
   * path efficiently, instead of calling Path.get() and then Path.set(),
   * |value| may be set to a function that takes the existing value and returns
   * a new value.
   *
   * @param {!Object|!Array} root
   * @param {string|!Array} path
   * @param {*|function} value
   * @return {!Object|!Array}
   */
  Polymer.Path.setImmutable = (root, path, value) => {
    if (path === '') {
      path = [];
    } else if (typeof(path) === 'string') {
      path = Polymer.Path.split(path);
    }
    return setImmutableInternal_(root, path, value, 0);
  };

  // In order for ElementBase to be useful in multiple different apps, the
  // default state must be empty, and each app must populate it.
  const DEFAULT_STATE = {};

  // Maps from string "action type" to synchronous
  // function(!Object state, !Object action):!Object state.
  const REDUCERS = new Map();

  // Forwards (state, action) to action.reducer.
  function rootReducer(state, action) {
    if (state === undefined) {
      state = DEFAULT_STATE;
    }
    if (typeof(action.type) === 'function') {
      throw new Error(action.type.typeName);
    }
    if (!REDUCERS.has(action.type)) return state;
    // TODO if (DEBUG) state = Object.freezeRecursive(state);
    return REDUCERS.get(action.type)(state, action);
  }

  // This is all that is needed from redux-thunk to enable asynchronous action
  // creators.
  // https://tur-nr.github.io/polymer-redux/docs#async-actions
  const THUNK = ({dispatch, getState}) => next => action => {
    if (typeof action === 'function') {
      return action(dispatch, getState);
    }
    try {
      return next(action);
    } catch (error) {
      const state = getState();
      // eslint-disable-next-line no-console
      console.error(error, action, state);
      return state;
    }
  };

  const STORE = Redux.createStore(
      rootReducer, DEFAULT_STATE, Redux.applyMiddleware(THUNK));

  const ReduxMixin = PolymerRedux(STORE);

  /*
   * This base class mixes Polymer.Element with Polymer-Redux and provides
   * utility functions to help data-bindings in elements perform minimal
   * computation without computed properties.
   */
  class ElementBase extends ReduxMixin(Polymer.Element) {
    constructor() {
      super();
      this.debounceJobs_ = new Map();
    }

    _add() {
      let sum = arguments[0];
      for (const arg of Array.from(arguments).slice(1)) {
        sum += arg;
      }
      return sum;
    }

    _eq() {
      const test = arguments[0];
      for (const arg of Array.from(arguments).slice(1)) {
        if (arg !== test) return false;
      }
      return true;
    }

    _len(seq) {
      if (seq === undefined) return 0;
      if (seq === null) return 0;
      if (seq instanceof Array) return seq.length;
      if (seq instanceof Map || seq instanceof Set) return seq.size;
      if (seq instanceof tr.v.HistogramSet) return seq.length;
      return Object.keys(seq).length;
    }

    _empty(seq) {
      return this._len(seq) === 0;
    }

    _plural(num) {
      return num === 1 ? '' : 's';
    }

    /**
     * Wrap Polymer.Debouncer in a friendlier syntax.
     *
     * @param {*} jobName
     * @param {Function()} callback
     * @param {Object=} asyncModule See Polymer.Async.
     */
    debounce(jobName, callback, opt_asyncModule) {
      const asyncModule = opt_asyncModule || Polymer.Async.microTask;
      this.debounceJobs_.set(jobName, Polymer.Debouncer.debounce(
          this.debounceJobs_.get(jobName), asyncModule, callback));
    }
  }

  /**
    * Subclasses should use this to bind properties to redux state.
    * @param {String} statePathPropertyName Typically 'statePath'.
    * @param {!Object} configs
    * @return {!Object} properties
    */
  ElementBase.statePathProperties = (statePathPropertyName, configs) => {
    const properties = {};
    properties[statePathPropertyName] = {type: String};

    for (const [name, config] of Object.entries(configs)) {
      properties[name] = {
        ...config,
        readOnly: true,
        statePath(state) {
          try {
            state = Polymer.Path.get(state, this[statePathPropertyName]);
            if (state === undefined) return undefined;
            return state[name];
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(error, {
              tagName: this.tagName,
              statePathPropertyName,
              statePath: this[statePathPropertyName],
              name,
            });
            return undefined;
          }
        },
      };
    }

    return properties;
  };

  ElementBase.statePathReducer = reducer => {
    const replacement = (rootState, action) => {
      try {
        return Polymer.Path.setImmutable(rootState, action.statePath, state =>
          reducer(state, action, rootState));
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(replacement.typeName, error, action, rootState);
        return rootState;
      }
    };
    replacement.implementation = reducer;
    return replacement;
  };

  ElementBase.registerReducers = cls => {
    for (const [name, reducer] of Object.entries(cls.reducers)) {
      reducer.typeName = `${cls.name}.reducers.${name}`;
      REDUCERS.set(reducer.typeName, reducer);
    }
  };

  ElementBase.register = subclass => {
    subclass.is = Polymer.CaseMap.camelToDashCase(subclass.name).substr(1);
    customElements.define(subclass.is, subclass);
    if (subclass.reducers && subclass.reducers !== ElementBase.reducers) {
      ElementBase.registerReducers(subclass);
    }
  };

  ElementBase.afterRender = () => new Promise(resolve => {
    Polymer.RenderStatus.afterNextRender({}, () => {
      resolve();
    });
  });

  ElementBase.beforeRender = () => new Promise(resolve => {
    Polymer.RenderStatus.beforeNextRender({}, () => {
      resolve();
    });
  });

  ElementBase.timeout = ms => new Promise(resolve => setTimeout(resolve, ms));

  ElementBase.measureInputLatency = async(groupName, functionName, event) => {
    const mark = tr.b.Timing.mark(
        groupName, functionName,
        event.timeStamp || event.detail.sourceEvent.timeStamp);
    await ElementBase.afterRender();
    mark.end();
  };

  ElementBase.actions = {
    updateObject: (statePath, delta) => async(dispatch, getState) => {
      dispatch({
        type: ElementBase.reducers.updateObject.typeName,
        statePath,
        delta,
      });
    },

    toggleBoolean: statePath => async(dispatch, getState) => {
      dispatch({
        type: ElementBase.reducers.toggleBoolean.typeName,
        statePath,
      });
    },

    ensureObject: statePath => async(dispatch, getState) => {
      const statePathParts = Polymer.Path.split(statePath);
      for (let i = 0; i < statePathParts.length; ++i) {
        dispatch(ElementBase.actions.updateObject(
            statePathParts.slice(0, i), {[statePathParts[i]]: {}}));
      }
    },
  };

  ElementBase.reducers = {
    updateObject: ElementBase.statePathReducer((state, action) => {
      return {...state, ...action.delta};
    }),

    toggleBoolean: ElementBase.statePathReducer((state, action) => !state),
  };

  ElementBase.registerReducers(ElementBase);

  return {
    ElementBase,
  };
});
