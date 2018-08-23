/* Copyright 2018 The Chromium Authors. All rights reserved.
   Use of this source code is governed by a BSD-style license that can be
   found in the LICENSE file.
*/
'use strict';
tr.exportTo('cp', () => {
  class CreateElement extends cp.ElementBase {
    get content() {
      return this.content_;
    }

    update_() {
      if (this.content_) {
        this.shadowRoot.removeChild(this.content_);
      }
      this.content_ = document.createElement(this.tagName);
      const properties = {...this.properties, ...this.dataset};
      for (const [name, value] of Object.entries(properties)) {
        if (this.content_[name] !== value) {
          this.content_[name] = value;
        }
      }
      this.shadowRoot.appendChild(this.content_);
    }
  }

  CreateElement.properties = {
    tagName: {
      type: String,
      value: 'div',
    },
    properties: {
      type: Object,
      value: {},
    },
  };
  CreateElement.observers = ['update_(tagName, properties)'];

  cp.ElementBase.register(CreateElement);

  return {
    CreateElement,
  };
});
