(function (global) {
    global.TabModules = global.TabModules || {};

    function mapApiPayloadToUi(payload) {
        const p = payload || {};
        const labels = Array.isArray(p.labels) ? p.labels : [];
        const transitions = Array.isArray(p.moroso_transition_count) ? p.moroso_transition_count : [];
        const avgCuota = Array.isArray(p.avg_cuota) ? p.avg_cuota : [];
        const vigenteBase = Array.isArray(p.vigente_base_count) ? p.vigente_base_count : [];
        const byGestion = {};
        const byGestionAvgCuota = {};
        const byGestionVigente = {};
        for (let i = 0; i < labels.length; i++) {
            const m = String(labels[i] || '');
            if (!/^\d{2}\/\d{4}$/.test(m)) continue;
            byGestion[m] = Number(transitions[i] || 0);
            byGestionAvgCuota[m] = Number(avgCuota[i] || 0);
            byGestionVigente[m] = Number(vigenteBase[i] || 0);
        }
        return {
            available: true,
            reason: '',
            byGestion,
            availableGestiones: labels.slice(),
            byGestionVigente,
            byGestionAvgCuota,
            rows: [],
            culVigAvailable: false,
            culVigReason: 'Serie de culminados se calcula localmente para conservar detalle por estado.',
            culVigByGestion: {},
            culStatusByGestion: {},
            culUnknownByGestion: {}
        };
    }

    function buildSelectionSummary(labels) {
        const unLabel = labels && labels.un ? labels.un : 'Todas';
        const anioLabel = labels && labels.anio ? labels.anio : 'Todos';
        const fechaLabel = labels && labels.fecha ? labels.fecha : 'Historia';
        const viaLabel = labels && labels.via ? labels.via : 'Todas';
        const catLabel = labels && labels.cat ? labels.cat : 'Todas';
        return `<strong>Selección actual:</strong> UN: ${unLabel} | Año Gestión: ${anioLabel} | Gestión: ${fechaLabel} | Vía Cobro: ${viaLabel} | Categoría: ${catLabel}`;
    }

    global.TabModules.acaMovimiento = {
        id: 'acaMovimiento',
        mapApiPayloadToUi,
        buildSelectionSummary
    };
})(window);
