/* Copyright 2017 The Chromium Authors. All rights reserved.
   Use of this source code is governed by a BSD-style license that can be
   found in the LICENSE file.
*/
'use strict';
tr.exportTo('cp', () => {
  class OptionGroup extends cp.ElementBase {
    shouldStampSubOptions_(option) {
      return option.isExpanded || option.options.length < 20;
    }

    countDescendents_(options) {
      return OptionGroup.countDescendents(options);
    }

    isSelected_(option, selectedOptions) {
      if (!option || !selectedOptions) return false;
      return selectedOptions.includes(this.value_(option));
    }

    label_(option) {
      return option.label || this.value_(option);
    }

    value_(option) {
      return option.value || option;
    }

    indentRow_(option) {
      if (option.options) return false;
      return !this.isRoot || OptionGroup.getAnyGroups(this.options);
    }

    static getAnyGroups(options) {
      return (options || []).filter(o => o.options).length > 0;
    }

    onSelect_(event) {
      this.dispatch('select', this.rootStatePath,
          this.value_(event.model.option));
      this.dispatchEvent(new CustomEvent('option-select', {
        bubbles: true,
        composed: true,
      }));
    }
  }

  OptionGroup.properties = {
    ...cp.ElementBase.statePathProperties('statePath', {
      options: {
        type: Array,
        value: [],
      },
    }),
    ...cp.ElementBase.statePathProperties('rootStatePath', {
      selectedOptions: {
        type: Array,
        value: [],
      },
    }),
    isRoot: {
      type: Boolean,
      computed: '_eq(statePath, rootStatePath)',
    },
  };

  OptionGroup.countDescendents = options => {
    let count = 0;
    for (const option of options) {
      if (option.options) {
        count += OptionGroup.countDescendents(option.options);
      } else {
        count += 1;
      }
    }
    return count;
  };

  OptionGroup.groupValues = names => {
    const options = [];
    for (const name of names) {
      const parts = name.split(':');
      let parent = options;
      for (let i = 0; i < parts.length; ++i) {
        const part = parts[i];

        let found = false;
        for (const option of parent) {
          if (option.label === part) {
            if (i === parts.length - 1) {
              option.options.push({
                label: part,
                value: name,
              });
            } else {
              parent = option.options;
            }
            found = true;
            break;
          }
        }

        if (!found) {
          if (i === parts.length - 1) {
            parent.push({
              label: part,
              value: name,
            });
          } else {
            const option = {
              options: [],
              isExpanded: false,
              label: part,
              value: parts.slice(0, i + 1).join(':'),
            };
            parent.push(option);
            parent = option.options;
          }
        }
      }
    }
    return options;
  };

  OptionGroup.actions = {
    select: (statePath, value) => async (dispatch, getState) => {
      dispatch({
        type: OptionGroup.reducers.select.typeName,
        statePath,
        value,
      });
    },
  };

  OptionGroup.reducers = {
    select: cp.ElementBase.statePathReducer((state, action) => {
      const selectedOptions = Array.from(state.selectedOptions);
      if (selectedOptions.includes(action.value)) {
        selectedOptions.splice(selectedOptions.indexOf(action.value), 1);
      } else {
        selectedOptions.push(action.value);
      }
      return {...state, selectedOptions};
    }),
  };

  cp.ElementBase.register(OptionGroup);

  return {
    OptionGroup,
  };
});
