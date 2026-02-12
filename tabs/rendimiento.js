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

    function renderPerformanceUI(ctx) {
        const stats = (ctx && ctx.stats) || {};
        const renderChart = ctx && ctx.renderChart;
        const formatPYG = ctx && ctx.formatPYG;
        const monthToSerial = ctx && ctx.monthToSerial;
        const formatNumber = ctx && ctx.formatNumber;
        const showPerfChartLabels = !!(ctx && ctx.showPerfChartLabels);
        const state = (ctx && ctx.state) || {};
        const ChartCtor = (ctx && ctx.Chart) || global.Chart;
        if (typeof renderChart !== 'function' || typeof formatPYG !== 'function' || typeof monthToSerial !== 'function' || !state.rendimiento || !ChartCtor) {
            return false;
        }

        const headerValues = getHeaderValues(stats);
        const setTxt = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        setTxt('perf-recovery-rate', (headerValues.globalRate * 100).toFixed(1) + '%');
        setTxt('perf-total-contracts', headerValues.totalContracts.toLocaleString());
        setTxt('perf-total-debt', formatPYG(headerValues.totalDebt));
        setTxt('perf-total-contracts-paid', headerValues.totalContractsPaid.toLocaleString());
        setTxt('perf-total-paid', formatPYG(headerValues.totalPaid));

        const drawPerfPercentBubble = (drawCtx, text, x, y) => {
            const padX = 6;
            const padY = 3;
            const radius = 6;
            const font = '700 12px Outfit';
            drawCtx.save();
            drawCtx.font = font;
            drawCtx.textAlign = 'left';
            drawCtx.textBaseline = 'middle';
            const textW = drawCtx.measureText(text).width;
            const boxW = textW + padX * 2;
            const boxH = 12 + padY * 2;
            const left = x;
            const top = y - boxH / 2;

            drawCtx.beginPath();
            drawCtx.moveTo(left + radius, top);
            drawCtx.lineTo(left + boxW - radius, top);
            drawCtx.quadraticCurveTo(left + boxW, top, left + boxW, top + radius);
            drawCtx.lineTo(left + boxW, top + boxH - radius);
            drawCtx.quadraticCurveTo(left + boxW, top + boxH, left + boxW - radius, top + boxH);
            drawCtx.lineTo(left + radius, top + boxH);
            drawCtx.quadraticCurveTo(left, top + boxH, left, top + boxH - radius);
            drawCtx.lineTo(left, top + radius);
            drawCtx.quadraticCurveTo(left, top, left + radius, top);
            drawCtx.closePath();
            drawCtx.fillStyle = 'rgba(15, 23, 42, 0.92)';
            drawCtx.fill();
            drawCtx.lineWidth = 1;
            drawCtx.strokeStyle = 'rgba(14, 165, 233, 0.9)';
            drawCtx.stroke();

            drawCtx.fillStyle = '#e2e8f0';
            drawCtx.fillText(text, left + padX, y);
            drawCtx.restore();
        };

        const perfLineValueLabelsPlugin = {
            id: 'perfLineValueLabels',
            afterDatasetsDraw(chart) {
                const meta = chart.getDatasetMeta(0);
                if (!meta || meta.hidden) return;
                const data = chart.data.datasets && chart.data.datasets[0] ? chart.data.datasets[0].data : [];
                const drawCtx = chart.ctx;
                drawCtx.save();
                drawCtx.font = '11px Outfit';
                drawCtx.fillStyle = '#e2e8f0';
                drawCtx.textAlign = 'left';
                drawCtx.textBaseline = 'middle';
                for (let i = 0; i < meta.data.length; i++) {
                    const pt = meta.data[i];
                    const val = parseFloat(data[i]) || 0;
                    if (!pt) continue;
                    drawCtx.beginPath();
                    drawCtx.fillStyle = '#f59e0b';
                    drawCtx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
                    drawCtx.fill();
                    drawPerfPercentBubble(drawCtx, `${val.toFixed(1)}%`, pt.x + 7, pt.y - 12);
                }
                drawCtx.restore();
            }
        };

        const perfBarValueLabelsPlugin = {
            id: 'perfBarValueLabels',
            afterDatasetsDraw(chart) {
                const meta = chart.getDatasetMeta(0);
                if (!meta || meta.hidden) return;
                const data = chart.data.datasets && chart.data.datasets[0] ? chart.data.datasets[0].data : [];
                const drawCtx = chart.ctx;
                drawCtx.save();
                drawCtx.font = '11px Outfit';
                drawCtx.fillStyle = '#e2e8f0';
                drawCtx.textAlign = 'center';
                drawCtx.textBaseline = 'middle';
                for (let i = 0; i < meta.data.length; i++) {
                    const bar = meta.data[i];
                    const val = parseFloat(data[i]) || 0;
                    if (!bar) continue;
                    const y = bar.y + (bar.base - bar.y) / 2;
                    drawCtx.save();
                    drawCtx.translate(bar.x, y);
                    drawCtx.rotate(-Math.PI / 2);
                    drawCtx.fillText(`${val.toFixed(1)}%`, 0, 0);
                    drawCtx.restore();
                }
                drawCtx.restore();
            }
        };

        const perfLinePlugins = showPerfChartLabels ? [perfLineValueLabelsPlugin] : [];
        const perfBarPlugins = showPerfChartLabels ? [perfBarValueLabelsPlugin] : [];
        const vm = prepareViewModel(stats, { monthToSerial, formatNumber });

        renderChart('perfTrendChart', 'rendimiento', 'line', vm.sortedMonths, vm.trendData, '% Eficacia', '#38bdf8', perfLinePlugins);
        renderChart('perfTrendCountChart', 'rendimiento', 'line', vm.sortedMonths, vm.trendCountData, '% Eficacia (Cantidad)', '#f59e0b', perfLinePlugins);
        renderChart('perfTramoChart', 'rendimiento', 'bar', vm.tramoLabels.map((t) => 'Tramo ' + t), vm.tramoEff, '% Eficacia', '#818cf8', perfBarPlugins);
        renderChart('perfUnChart', 'rendimiento', 'bar', vm.unLabels, vm.unEff, '% Eficacia', '#6366f1', perfBarPlugins);
        renderChart('perfViaCobroChart', 'rendimiento', 'bar', vm.vcLabels, vm.vcEff, '% Eficacia (Intencion)', '#10b981', perfBarPlugins);

        const matrixEl = document.getElementById('perfViaMatrixChart');
        if (matrixEl) {
            const matrixCtx = matrixEl.getContext('2d');
            if (state.rendimiento.charts['perfViaMatrixChart']) state.rendimiento.charts['perfViaMatrixChart'].destroy();
            state.rendimiento.charts['perfViaMatrixChart'] = new ChartCtor(matrixCtx, {
                type: 'bar',
                data: { labels: vm.vcLabels, datasets: vm.matrixDatasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: (v) => formatPYG(v) } } },
                    plugins: {
                        tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${formatPYG(c.raw)}` } },
                        legend: { position: 'bottom', labels: { color: '#e2e8f0', font: { family: 'Outfit' } } }
                    }
                }
            });
        }
        return true;
    }

    global.TabModules.rendimiento = {
        id: 'rendimiento',
        getHeaderValues,
        prepareViewModel,
        renderPerformanceUI
    };
})(window);
