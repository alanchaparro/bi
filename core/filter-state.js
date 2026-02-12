(function (global) {
    function setToSortedArray(setObj) {
        return Array.from(setObj || []).map((v) => String(v)).sort();
    }

    function buildFilterSignature(filtersById) {
        const out = {};
        const ids = Object.keys(filtersById || {}).sort();
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            out[id] = setToSortedArray(filtersById[id]);
        }
        return JSON.stringify(out);
    }

    global.FilterStateCore = {
        setToSortedArray,
        buildFilterSignature
    };
})(window);
