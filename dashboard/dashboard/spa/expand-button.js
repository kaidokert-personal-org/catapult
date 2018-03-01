/* Copyright 2018 The Chromium Authors. All rights reserved.
   Use of this source code is governed by a BSD-style license that can be
   found in the LICENSE file.
*/
'use strict';
tr.exportTo('cp', () => {
  class ExpandButton extends Polymer.GestureEventListeners(cp.ElementBase) {
    static get properties() {
      return {
        ...cp.ElementBase.statePathProperties('statePath', {
          isExpanded: {type: Boolean},
        }),
        horizontal: {
          type: Boolean,
          value: false,
        },
        after: {
          type: Boolean,
          value: false,
        },
      };
    }

    toggle_(event) {
      this.dispatch('toggle', this.statePath);
    }

    icon_(isExpanded) {
      return ExpandButton.icon(isExpanded, this.horizontal, this.after);
    }

    static icon(isExpanded, horizontal, after) {
      if (after) isExpanded = !isExpanded;
      if (horizontal) {
        return (isExpanded ? 'chevron-left' : 'chevron-right');
      }
      return (isExpanded ? 'expand-less' : 'expand-more');
    }
  }

  ExpandButton.actions = {
    toggle: statePath => async (dispatch, getState) => {
      dispatch(cp.ElementBase.actions.toggleBoolean(
          `${statePath}.isExpanded`));
    },
  };

  cp.ElementBase.register(ExpandButton);

  return {
    ExpandButton,
  };
});
