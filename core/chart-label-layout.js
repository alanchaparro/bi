(function (global) {
    function rectsOverlap(a, b, pad) {
        const p = Number.isFinite(pad) ? pad : 2;
        return (
            a.left < b.right + p &&
            a.right > b.left - p &&
            a.top < b.bottom + p &&
            a.bottom > b.top - p
        );
    }

    global.ChartLabelLayoutCore = {
        rectsOverlap
    };
})(window);
