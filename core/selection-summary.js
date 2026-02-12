(function (global) {
    function createSelectionSummary(prefix, labels) {
        return `<strong>Selección actual:</strong> ${prefix}: ${labels}`;
    }

    global.SelectionSummaryCore = {
        createSelectionSummary
    };
})(window);
