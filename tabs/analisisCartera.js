(function (global) {
    global.TabModules = global.TabModules || {};

    function buildSelectionSummary(labels) {
        const un = labels && labels.un ? labels.un : 'Todas';
        const anio = labels && labels.anio ? labels.anio : 'Todos';
        const fecha = labels && labels.fecha ? labels.fecha : 'Historia';
        const via = labels && labels.via ? labels.via : 'Todas';
        const supervisor = labels && labels.supervisor ? labels.supervisor : 'Todos';
        const categoria = labels && labels.categoria ? labels.categoria : 'Todas';
        return `<strong>Selección actual:</strong> UN: ${un} | Año Gestión: ${anio} | Gestión: ${fecha} | Vía Cobro: ${via} | Supervisor: ${supervisor} | Categoría: ${categoria}`;
    }

    function renderSelectionSummary(summaryEl, labels) {
        if (!summaryEl) return false;
        summaryEl.innerHTML = buildSelectionSummary(labels || {});
        return true;
    }

    function prepareViewModel(stats, deps) {
        const monthToSerial = deps && deps.monthToSerial ? deps.monthToSerial : (() => 0);
        const byGestion = (stats && stats.byGestion) || {};
        const months = Object.keys(byGestion).sort((a, b) => monthToSerial(a) - monthToSerial(b));
        const vigenteData = months.map((m) => (byGestion[m] && byGestion[m].vigente) || 0);
        const morosoData = months.map((m) => (byGestion[m] && byGestion[m].moroso) || 0);
        const cobradorData = months.map((m) => (byGestion[m] && byGestion[m].cobrador) || 0);
        const debitoData = months.map((m) => (byGestion[m] && byGestion[m].debito) || 0);
        const debtData = months.map((m) => (byGestion[m] && byGestion[m].debt) || 0);
        const paidData = months.map((m) => (byGestion[m] && byGestion[m].paid) || 0);
        const complianceData = months.map((m, i) => {
            const d = debtData[i] || 0;
            const p = paidData[i] || 0;
            return d > 0 ? Math.round((p / d) * 1000) / 10 : 0;
        });
        const totalContractsData = months.map((m) => (byGestion[m] && byGestion[m].total) || 0);
        const paidContractsData = months.map((m) => (byGestion[m] && byGestion[m].paidContracts) || 0);
        const complianceContractsData = months.map((m, i) => {
            const d = totalContractsData[i] || 0;
            const p = paidContractsData[i] || 0;
            return d > 0 ? Math.round((p / d) * 1000) / 10 : 0;
        });
        return {
            months,
            vigenteData,
            morosoData,
            cobradorData,
            debitoData,
            debtData,
            paidData,
            complianceData,
            totalContractsData,
            paidContractsData,
            complianceContractsData
        };
    }

    function getHeaderValues(stats) {
        const toInt = (v) => Number(v || 0);
        return {
            total: toInt(stats && stats.total),
            vigente: toInt(stats && stats.vigente),
            moroso: toInt(stats && stats.moroso),
            cobrador: toInt(stats && stats.cobrador),
            debito: toInt(stats && stats.debito)
        };
    }

    global.TabModules.analisisCartera = {
        id: 'analisisCartera',
        buildSelectionSummary,
        renderSelectionSummary,
        prepareViewModel,
        getHeaderValues
    };
})(window);
