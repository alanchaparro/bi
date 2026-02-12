(function (global) {
    async function getJson(url) {
        const res = await fetch(url);
        const body = await res.json();
        if (!res.ok) {
            throw new Error(body.message || body.code || 'API error');
        }
        if (body && body.code && body.message) {
            throw new Error(body.message);
        }
        return body;
    }

    function addSetParams(params, key, values) {
        if (!values || !values.size) return;
        Array.from(values).forEach((v) => params.append(key, String(v)));
    }

    function addScalarParam(params, key, value) {
        if (value === undefined || value === null || value === '') return;
        params.append(key, String(value));
    }

    function buildQuery(filters) {
        const params = new URLSearchParams();
        addSetParams(params, 'un', filters.un);
        addSetParams(params, 'gestion_month', filters.gestionMonth);
        addSetParams(params, 'via_cobro', filters.viaCobro);
        addSetParams(params, 'categoria', filters.categoria);
        addSetParams(params, 'supervisor', filters.supervisor);
        addSetParams(params, 'tramo', filters.tramo);
        addSetParams(params, 'via_pago', filters.viaPago);
        addSetParams(params, 'contract_month', filters.contractMonth);
        addScalarParam(params, 'debug', filters.debug);
        return params.toString();
    }

    const AnalyticsApiClient = {
        async getSummary(filters) {
            const q = buildQuery(filters || {});
            return getJson(`/analytics/portfolio/summary${q ? `?${q}` : ''}`);
        },
        async getTrend(filters) {
            const q = buildQuery(filters || {});
            return getJson(`/analytics/portfolio/trend${q ? `?${q}` : ''}`);
        },
        async getPerformanceByManagementMonth(filters) {
            const q = buildQuery(filters || {});
            return getJson(`/analytics/performance/by-management-month${q ? `?${q}` : ''}`);
        },
        async getMovementMorosoTrend(filters) {
            const q = buildQuery(filters || {});
            return getJson(`/analytics/movement/moroso-trend${q ? `?${q}` : ''}`);
        },
        async getAnualesSummary(filters) {
            const q = buildQuery(filters || {});
            return getJson(`/analytics/anuales/summary${q ? `?${q}` : ''}`);
        }
    };

    global.AnalyticsApiClient = AnalyticsApiClient;
})(window);
