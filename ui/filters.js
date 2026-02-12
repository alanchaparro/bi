(function (global) {
    function getAppliedFilterSet(rootSelector, filterClass) {
        const root = document.querySelector(rootSelector);
        if (!root) return new Set();
        return new Set(Array.from(root.querySelectorAll(`.${filterClass}:checked`)).map((x) => String(x.value)));
    }

    global.FilterUtils = { getAppliedFilterSet };
})(window);
