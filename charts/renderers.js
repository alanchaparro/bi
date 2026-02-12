(function (global) {
    function safeDestroyChart(chartMap, id) {
        if (!chartMap || !chartMap[id]) return;
        try { chartMap[id].destroy(); } catch (_) {}
        delete chartMap[id];
    }

    global.ChartRenderUtils = { safeDestroyChart };
})(window);
