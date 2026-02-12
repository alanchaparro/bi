(function (global) {
    global.TabModules = global.TabModules || {};
    global.TabModules.rendimientoApi = {
        async fetch(filters) {
            return global.AnalyticsApiClient.getPerformanceByManagementMonth(filters);
        }
    };
})(window);
