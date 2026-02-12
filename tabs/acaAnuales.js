(function (global) {
    global.TabModules = global.TabModules || {};

    function buildSelectionSummary(labels) {
        const unLabel = labels && labels.un ? labels.un : 'Todas';
        const anioLabel = labels && labels.anio ? labels.anio : 'Todos';
        const mesContratoLabel = labels && labels.mesContrato ? labels.mesContrato : 'Todos';
        const corte = labels && labels.corte ? labels.corte : 'S/D';
        return `<strong>Selección actual:</strong> UN: ${unLabel} | Año: ${anioLabel} | Mes/Año Contrato: ${mesContratoLabel} | Corte: ${corte}`;
    }

    function renderTable(tbody, rows, formatters) {
        if (!tbody) return;
        const fmtNumber = formatters && formatters.number ? formatters.number : (n) => String(n);
        const fmtPyg = formatters && formatters.pyg ? formatters.pyg : (n) => String(n);
        tbody.innerHTML = '';

        if (!rows || rows.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="13" style="text-align:center; color:#94a3b8;">Sin datos para filtros seleccionados.</td>';
            tbody.appendChild(tr);
            return;
        }

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i] || {};
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${r.year || ''}</td>
                <td>${fmtNumber(r.contracts || 0)}</td>
                <td>${fmtNumber(r.contractsVigentes || 0)}</td>
                <td>${fmtPyg(r.tkpContrato || 0)}</td>
                <td>${fmtPyg(r.tkpTransaccional || 0)}</td>
                <td>${fmtPyg(r.tkpPago || 0)}</td>
                <td>${fmtNumber(r.culminados || 0)}</td>
                <td>${fmtNumber(r.culminadosVigentes || 0)}</td>
                <td>${fmtPyg(r.tkpContratoCulminado || 0)}</td>
                <td>${fmtPyg(r.tkpPagoCulminado || 0)}</td>
                <td>${fmtPyg(r.tkpContratoCulminadoVigente || 0)}</td>
                <td>${fmtPyg(r.tkpPagoCulminadoVigente || 0)}</td>
                <td>${Number(r.ltvCulminadoVigente || 0).toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        }
    }

    global.TabModules.acaAnuales = {
        id: 'acaAnuales',
        buildSelectionSummary,
        renderTable
    };
})(window);
