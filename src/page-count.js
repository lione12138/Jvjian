'use strict';

const jujianPageCount = (() => {
  const maximum = 8;
  return {
    defaults: { longPageCount: null, longPageEnabled: true },
    fromSettings({ longPageCount, longPageEnabled }) {
      if (Number.isInteger(longPageCount) && longPageCount >= 1 && longPageCount <= maximum) {
        return longPageCount;
      }
      // Preserve one-page mode for readers who disabled the old long-page switch.
      return longPageEnabled === false ? 1 : 6;
    },
    options: Array.from({ length: maximum }, (_, index) => {
      const count = index + 1;
      return `<option value="${count}">${count} 个普通页</option>`;
    }).join(''),
  };
})();
