(function (global) {
    global.TabModules = global.TabModules || {};

    function getHeaderValues(stats) {
        const s = stats || {};
        const totalDebt = Number(s.totalDebt || 0);
        const totalPaid = Number(s.totalPaid || 0);
        const totalContracts = Number(s.totalContracts || 0);
        const totalContractsPaid = Number(s.totalContractsPaid || 0);
        const globalRate = totalDebt > 0 ? (totalPaid / totalDebt) : 0;
        const globalCountRate = totalContracts > 0 ? (totalContractsPaid / totalContracts) : 0;
        return {
            totalDebt,
            totalPaid,
            totalContracts,
            totalContractsPaid,
            globalRate,
            globalCountRate
        };
    }

    function prepareViewModel(stats, deps) {
        const s = stats || {};
        const monthToSerial = deps && deps.monthToSerial ? deps.monthToSerial : (() => 0);
        const trendStats = s.trendStats || {};
        const tramoStats = s.tramoStats || {};
        const unStats = s.unStats || {};
        const viaCStats = s.viaCStats || {};
        const matrixStats = s.matrixStats || {};

        const sortedMonths = Object.keys(trendStats).sort((a, b) => monthToSerial(a) - monthToSerial(b));
        const trendData = sortedMonths.map((m) => {
            const bucket = trendStats[m] || {};
            const d = Number(bucket.d || 0);
            const p = Number(bucket.p || 0);
            return d > 0 ? (p / d) * 100 : 0;
        });
        const trendCountData = sortedMonths.map((m) => {
            const bucket = trendStats[m] || {};
            const c = Number(bucket.c || 0);
            const cp = Number(bucket.cp || 0);
            return c > 0 ? (cp / c) * 100 : 0;
        });

        const tramoLabels = Object.keys(tramoStats).sort((a, b) => Number(a) - Number(b));
        const tramoEff = tramoLabels.map((t) => {
            const bucket = tramoStats[t] || {};
            const d = Number(bucket.d || 0);
            const p = Number(bucket.p || 0);
            return d > 0 ? (p / d) * 100 : 0;
        });

        const unLabels = Object.keys(unStats).sort();
        const unEff = unLabels.map((u) => {
            const bucket = unStats[u] || {};
            const d = Number(bucket.d || 0);
            const p = Number(bucket.p || 0);
            return d > 0 ? (p / d) * 100 : 0;
        });

        const vcLabels = Object.keys(viaCStats).sort();
        const vcEff = vcLabels.map((v) => {
            const bucket = viaCStats[v] || {};
            const d = Number(bucket.d || 0);
            const p = Number(bucket.p || 0);
            return d > 0 ? (p / d) * 100 : 0;
        });

        const allActualVias = [...new Set(Object.values(matrixStats).flatMap((o) => Object.keys(o || {})))].sort();
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
        const matrixDatasets = allActualVias.map((vAct, idx) => ({
            label: vAct,
            data: vcLabels.map((vc) => ((matrixStats[vc] || {})[vAct] || 0)),
            backgroundColor: colors[idx % colors.length]
        }));

        return {
            sortedMonths,
            trendData,
            trendCountData,
            tramoLabels,
            tramoEff,
            unLabels,
            unEff,
            vcLabels,
            vcEff,
            matrixDatasets
        };
    }

    global.TabModules.rendimiento = {
        id: 'rendimiento',
        getHeaderValues,
        prepareViewModel
    };
})(window);
