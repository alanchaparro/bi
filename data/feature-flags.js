(function (global) {
    function readFlag(name, defaultValue) {
        try {
            const storageKey = `ff_${name}`;
            const saved = localStorage.getItem(storageKey);
            if (saved === '1' || saved === 'true') return true;
            if (saved === '0' || saved === 'false') return false;
        } catch (e) {
            // Keep runtime defaults when localStorage is blocked.
        }
        if (global[name] !== undefined) return !!global[name];
        return !!defaultValue;
    }

    function readDebugMode() {
        try {
            const qp = new URLSearchParams(global.location.search || '');
            const debug = String(qp.get('debug') || '').toLowerCase();
            if (['1', 'true', 'yes', 'on'].includes(debug)) return true;
        } catch (e) {
            // ignore
        }
        return false;
    }

    global.FeatureFlags = {
        FF_MOVEMENT_SERIES_V2: readFlag('FF_MOVEMENT_SERIES_V2', true),
        FF_LINE_LABELS_SMART_LAYOUT: readFlag('FF_LINE_LABELS_SMART_LAYOUT', true),
        FF_API_ANALISIS_CARTERA: readFlag('FF_API_ANALISIS_CARTERA', true),
        FF_API_MOVIMIENTO: readFlag('FF_API_MOVIMIENTO', true),
        FF_API_ANUALES: readFlag('FF_API_ANUALES', true),
        FF_API_RENDIMIENTO: readFlag('FF_API_RENDIMIENTO', true),
        DEBUG_MODE: readDebugMode(),
    };
})(window);
