(function (global) {
    global.TabModules = global.TabModules || {};
    global.TabModules.acaMovimientoApi = {
        async fetch(filters) {
            return global.AnalyticsApiClient.getMovementMorosoTrend(filters);
        }
    };
})(window);
