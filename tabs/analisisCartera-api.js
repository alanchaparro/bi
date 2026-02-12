(function (global) {
    global.TabModules = global.TabModules || {};
    global.TabModules.analisisCarteraApi = {
        async fetch(filters) {
            const summary = await global.AnalyticsApiClient.getSummary(filters);
            const trend = await global.AnalyticsApiClient.getTrend(filters);
            return { summary, trend };
        }
    };
})(window);
