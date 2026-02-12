(function (global) {
    global.TabModules = global.TabModules || {};
    global.TabModules.acaAnualesApi = {
        async fetch(filters) {
            return global.AnalyticsApiClient.getAnualesSummary(filters);
        }
    };
})(window);
