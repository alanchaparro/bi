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

    function normalizeRows(rawRows) {
        const rows = Array.isArray(rawRows) ? rawRows : [];
        const toNumber = (v) => {
            const n = Number(v);
            return Number.isFinite(n) ? n : 0;
        };
        return rows.map((r) => ({
            year: String((r && r.year) || ''),
            contracts: toNumber(r && r.contracts),
            contractsVigentes: toNumber(r && r.contractsVigentes),
            tkpContrato: toNumber(r && r.tkpContrato),
            tkpTransaccional: toNumber(r && r.tkpTransaccional),
            tkpPago: toNumber(r && r.tkpPago),
            culminados: toNumber(r && r.culminados),
            culminadosVigentes: toNumber(r && r.culminadosVigentes),
            tkpContratoCulminado: toNumber(r && r.tkpContratoCulminado),
            tkpPagoCulminado: toNumber(r && r.tkpPagoCulminado),
            tkpContratoCulminadoVigente: toNumber(r && r.tkpContratoCulminadoVigente),
            tkpPagoCulminadoVigente: toNumber(r && r.tkpPagoCulminadoVigente),
            ltvCulminadoVigente: toNumber(r && r.ltvCulminadoVigente)
        }));
    }

    function computeLocalRows(ctx) {
        const carteraData = Array.isArray(ctx && ctx.carteraData) ? ctx.carteraData : [];
        const cobranzasData = Array.isArray(ctx && ctx.cobranzasData) ? ctx.cobranzasData : [];
        const contratosData = Array.isArray(ctx && ctx.contratosData) ? ctx.contratosData : [];
        const selUn = (ctx && ctx.selUn) || new Set();
        const selAnio = (ctx && ctx.selAnio) || new Set();
        const selMesContrato = (ctx && ctx.selMesContrato) || new Set();
        const cutoffMonth = String((ctx && ctx.cutoffMonth) || '');
        const cutoffSerial = Number((ctx && ctx.cutoffSerial) || 0);
        const monthToSerial = ctx && ctx.monthToSerial ? ctx.monthToSerial : (() => -1);
        const getYearFromGestionMonth = ctx && ctx.getYearFromGestionMonth ? ctx.getYearFromGestionMonth : (() => '');
        const monthFromDate = ctx && ctx.monthFromDate ? ctx.monthFromDate : (() => '');
        const monthsBetweenDateAndMonth = ctx && ctx.monthsBetweenDateAndMonth ? ctx.monthsBetweenDateAndMonth : (() => 0);
        const sumCobradoBetweenMonths = ctx && ctx.sumCobradoBetweenMonths ? ctx.sumCobradoBetweenMonths : (() => 0);
        const getCobranzasAggregates = ctx && ctx.getCobranzasAggregates ? ctx.getCobranzasAggregates : (() => ({ byContractMonth: {} }));

        const byContractMonth = {};
        for (let i = 0; i < carteraData.length; i++) {
            const r = carteraData[i];
            const cId = String(r._cId || '');
            const fe = String(r._feNorm || '');
            if (!cId || !/^\d{2}\/\d{4}$/.test(fe)) continue;
            const key = `${cId}_${fe}`;
            const cuotaRaw = parseFloat(r.monto_cuota);
            const cuotaNum = Number.isFinite(cuotaRaw) ? cuotaRaw : 0;
            if (!byContractMonth[key]) {
                byContractMonth[key] = { cId, month: fe, cuotaSum: cuotaNum, cuotaCount: Number.isFinite(cuotaRaw) ? 1 : 0 };
            } else {
                byContractMonth[key].cuotaSum += cuotaNum;
                if (Number.isFinite(cuotaRaw)) byContractMonth[key].cuotaCount += 1;
            }
        }

        const byContractTimeline = {};
        const snapshotKeys = Object.keys(byContractMonth);
        for (let i = 0; i < snapshotKeys.length; i++) {
            const s = byContractMonth[snapshotKeys[i]];
            s.cuotaAvg = s.cuotaCount > 0 ? (s.cuotaSum / s.cuotaCount) : 0;
            if (!byContractTimeline[s.cId]) byContractTimeline[s.cId] = [];
            byContractTimeline[s.cId].push(s);
        }
        const timelineIds = Object.keys(byContractTimeline);
        for (let i = 0; i < timelineIds.length; i++) {
            byContractTimeline[timelineIds[i]].sort((a, b) => monthToSerial(a.month) - monthToSerial(b.month));
        }

        const findSnapshotAtOrBefore = (cId, month) => {
            const timeline = byContractTimeline[cId];
            if (!timeline || !timeline.length) return null;
            const target = monthToSerial(month);
            let prev = null;
            for (let i = 0; i < timeline.length; i++) {
                const curr = timeline[i];
                const serial = monthToSerial(curr.month);
                if (serial > target) break;
                prev = curr;
                if (serial === target) break;
            }
            return prev;
        };

        const findSnapshotAtOrAfter = (cId, month) => {
            const timeline = byContractTimeline[cId];
            if (!timeline || !timeline.length) return null;
            const target = monthToSerial(month);
            for (let i = 0; i < timeline.length; i++) {
                if (monthToSerial(timeline[i].month) >= target) return timeline[i];
            }
            return null;
        };

        const paymentByContractMonth = {};
        for (let i = 0; i < cobranzasData.length; i++) {
            const r = cobranzasData[i];
            const cId = String(r._cId || '');
            const month = String(r._feNorm || '');
            if (!cId || !/^\d{2}\/\d{4}$/.test(month)) continue;
            const monto = parseFloat(r.monto);
            if (!Number.isFinite(monto)) continue;
            const serial = monthToSerial(month);
            if (!paymentByContractMonth[cId]) paymentByContractMonth[cId] = {};
            if (!paymentByContractMonth[cId][serial]) paymentByContractMonth[cId][serial] = { amount: 0, tx: 0 };
            paymentByContractMonth[cId][serial].amount += monto;
            paymentByContractMonth[cId][serial].tx += 1;
        }

        const paymentCumByContract = {};
        const payIds = Object.keys(paymentByContractMonth);
        for (let i = 0; i < payIds.length; i++) {
            const cId = payIds[i];
            const monthMap = paymentByContractMonth[cId];
            const serials = Object.keys(monthMap).map((v) => parseInt(v, 10)).sort((a, b) => a - b);
            let cumAmount = 0;
            let cumTx = 0;
            const cumAmounts = [];
            const cumTxs = [];
            for (let j = 0; j < serials.length; j++) {
                const bucket = monthMap[serials[j]];
                cumAmount += bucket.amount || 0;
                cumTx += bucket.tx || 0;
                cumAmounts.push(cumAmount);
                cumTxs.push(cumTx);
            }
            paymentCumByContract[cId] = { serials, cumAmounts, cumTxs };
        }

        const getCumPaidUpTo = (cId, maxSerial) => {
            const entry = paymentCumByContract[cId];
            if (!entry || !entry.serials.length) return { amount: 0, tx: 0 };
            let lo = 0;
            let hi = entry.serials.length - 1;
            let idx = -1;
            while (lo <= hi) {
                const mid = (lo + hi) >> 1;
                if (entry.serials[mid] <= maxSerial) {
                    idx = mid;
                    lo = mid + 1;
                } else {
                    hi = mid - 1;
                }
            }
            if (idx < 0) return { amount: 0, tx: 0 };
            return { amount: entry.cumAmounts[idx] || 0, tx: entry.cumTxs[idx] || 0 };
        };

        const cutoffYear = parseInt(getYearFromGestionMonth(cutoffMonth), 10);
        const getYearFromSerial = (serial) => {
            const n = Number(serial);
            if (!Number.isFinite(n) || n <= 0) return NaN;
            return Math.floor((n - 1) / 12);
        };
        const isPaymentYearAllowed = (serial) => {
            if (!Number.isFinite(cutoffYear)) return true;
            const y = getYearFromSerial(serial);
            return Number.isFinite(y) && y <= cutoffYear;
        };

        const carteraByContractMonth = {};
        for (let i = 0; i < carteraData.length; i++) {
            const r = carteraData[i];
            const cId = String(r._cId || '');
            const mm = String(r._feNorm || '');
            if (!cId || !mm) continue;
            if (!carteraByContractMonth[cId]) carteraByContractMonth[cId] = {};
            if (!carteraByContractMonth[cId][mm]) carteraByContractMonth[cId][mm] = r;
        }

        const contractsBySaleYear = {};
        for (let i = 0; i < contratosData.length; i++) {
            const c = contratosData[i];
            const cId = String(c._cId || '');
            const un = String(c.UN || 'S/D');
            const saleMonth = String(c._contractMonth || '');
            const saleYear = String(c._contractYear || '');
            if (!cId || !/^\d{4}$/.test(saleYear) || !/^\d{2}\/\d{4}$/.test(saleMonth)) continue;
            if (selUn.size > 0 && !selUn.has(un)) continue;
            if (selAnio.size > 0 && !selAnio.has(saleYear)) continue;
            if (selMesContrato.size > 0 && !selMesContrato.has(saleMonth)) continue;
            if (!contractsBySaleYear[saleYear]) contractsBySaleYear[saleYear] = [];
            contractsBySaleYear[saleYear].push(c);
        }

        const years = Object.keys(contractsBySaleYear).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
        const rows = [];
        const cobByContractMonth = getCobranzasAggregates().byContractMonth;

        for (let i = 0; i < years.length; i++) {
            const year = years[i];
            const contractIds = new Set();
            const contractIdsVigentes = new Set();
            let cuotaTotal = 0;
            const yearContracts = contractsBySaleYear[year] || [];

            for (let j = 0; j < yearContracts.length; j++) {
                const c = yearContracts[j];
                const cId = String(c._cId || '');
                if (!cId || contractIds.has(cId)) continue;
                let snap = findSnapshotAtOrBefore(cId, cutoffMonth);
                if (!snap) snap = findSnapshotAtOrAfter(cId, cutoffMonth);
                contractIds.add(cId);
                const cutoffRow = (carteraByContractMonth[cId] || {})[cutoffMonth] || null;
                const tramoCutoff = parseInt(cutoffRow ? cutoffRow.tramo : NaN, 10);
                if (Number.isFinite(tramoCutoff) && tramoCutoff <= 3) contractIdsVigentes.add(cId);
                let cuotaContrato = Number(c._montoCuota || c.monto_cuota || c.amount || 0);
                if (!Number.isFinite(cuotaContrato) || cuotaContrato <= 0) {
                    cuotaContrato = snap ? Number(snap.cuotaAvg || 0) : 0;
                }
                cuotaTotal += Number.isFinite(cuotaContrato) ? cuotaContrato : 0;
            }

            let paidToCutoffTotal = 0;
            let txToCutoffTotal = 0;
            let paidByContractMonthTotal = 0;
            let paidByContractMonthCount = 0;
            const contractIdList = Array.from(contractIds);
            for (let j = 0; j < contractIdList.length; j++) {
                const cId = contractIdList[j];
                const paid = getCumPaidUpTo(cId, cutoffSerial);
                paidToCutoffTotal += paid.amount;
                txToCutoffTotal += paid.tx;
                const byMonth = paymentByContractMonth[cId];
                if (!byMonth) continue;
                for (const key in byMonth) {
                    if (!Object.prototype.hasOwnProperty.call(byMonth, key)) continue;
                    const serial = parseInt(key, 10);
                    if (!Number.isFinite(serial) || serial <= 0) continue;
                    if (!isPaymentYearAllowed(serial)) continue;
                    paidByContractMonthTotal += byMonth[key].amount || 0;
                    paidByContractMonthCount += 1;
                }
            }

            let culminados = 0;
            let culminadosVigentes = 0;
            let cuotaCulTotal = 0;
            let cuotaCulTotalVigente = 0;
            let paidByContractMonthCulTotal = 0;
            let paidByContractMonthCulCount = 0;
            let paidByContractMonthCulTotalVigente = 0;
            let paidByContractMonthCulCountVigente = 0;
            let totalCobradoCulVigente = 0;
            let totalDeberiaCulVigente = 0;
            let monthsWeightedNumeratorCulVigente = 0;

            for (let j = 0; j < yearContracts.length; j++) {
                const c = yearContracts[j];
                const cId = String(c._cId || '');
                const culmMonth = String(c._culminacionMonth || '');
                const culmSerial = monthToSerial(culmMonth);
                if (!cId || culmSerial <= 0 || culmSerial > cutoffSerial) continue;
                let snap = findSnapshotAtOrBefore(cId, culmMonth);
                if (!snap) snap = findSnapshotAtOrAfter(cId, culmMonth);
                culminados += 1;
                const culmRow = (carteraByContractMonth[cId] || {})[culmMonth] || null;
                const tramoCulm = parseInt(culmRow ? culmRow.tramo : NaN, 10);
                const esVigente = Number.isFinite(tramoCulm) && tramoCulm <= 3;
                if (esVigente) culminadosVigentes += 1;
                const cuotaCul = snap ? Number(snap.cuotaAvg || 0) : (parseFloat(c._montoCuota || c.monto_cuota || c.amount || 0) || 0);
                cuotaCulTotal += cuotaCul;
                if (esVigente) cuotaCulTotalVigente += cuotaCul;

                const byMonth = paymentByContractMonth[cId];
                if (byMonth) {
                    for (const key in byMonth) {
                        if (!Object.prototype.hasOwnProperty.call(byMonth, key)) continue;
                        const serial = parseInt(key, 10);
                        if (!Number.isFinite(serial) || serial <= 0 || serial > culmSerial) continue;
                        if (!isPaymentYearAllowed(serial)) continue;
                        const amount = byMonth[key].amount || 0;
                        paidByContractMonthCulTotal += amount;
                        paidByContractMonthCulCount += 1;
                        if (esVigente) {
                            paidByContractMonthCulTotalVigente += amount;
                            paidByContractMonthCulCountVigente += 1;
                        }
                    }
                }

                if (esVigente) {
                    const saleMonth = String(c._contractMonth || monthFromDate(c.date) || '');
                    const months = monthsBetweenDateAndMonth(String(c.date || ''), culmMonth);
                    if (months > 0 && saleMonth && /^\d{2}\/\d{4}$/.test(culmMonth)) {
                        const deberia = cuotaCul * months;
                        const cobrado = sumCobradoBetweenMonths(cobByContractMonth[cId] || {}, saleMonth, culmMonth);
                        totalCobradoCulVigente += cobrado;
                        totalDeberiaCulVigente += deberia;
                        monthsWeightedNumeratorCulVigente += (months * deberia);
                    }
                }
            }

            rows.push({
                year,
                contracts: contractIds.size,
                contractsVigentes: contractIdsVigentes.size,
                tkpContrato: contractIds.size > 0 ? (cuotaTotal / contractIds.size) : 0,
                tkpTransaccional: txToCutoffTotal > 0 ? (paidToCutoffTotal / txToCutoffTotal) : 0,
                tkpPago: paidByContractMonthCount > 0 ? (paidByContractMonthTotal / paidByContractMonthCount) : 0,
                culminados,
                culminadosVigentes,
                tkpContratoCulminado: culminados > 0 ? (cuotaCulTotal / culminados) : 0,
                tkpPagoCulminado: paidByContractMonthCulCount > 0 ? (paidByContractMonthCulTotal / paidByContractMonthCulCount) : 0,
                tkpContratoCulminadoVigente: culminadosVigentes > 0 ? (cuotaCulTotalVigente / culminadosVigentes) : 0,
                tkpPagoCulminadoVigente: paidByContractMonthCulCountVigente > 0 ? (paidByContractMonthCulTotalVigente / paidByContractMonthCulCountVigente) : 0,
                ltvCulminadoVigente: totalDeberiaCulVigente > 0
                    ? (totalCobradoCulVigente / totalDeberiaCulVigente) * (monthsWeightedNumeratorCulVigente / totalDeberiaCulVigente)
                    : 0
            });
        }

        rows.sort((a, b) => parseInt(a.year, 10) - parseInt(b.year, 10));
        return rows;
    }

    global.TabModules.acaAnuales = {
        id: 'acaAnuales',
        buildSelectionSummary,
        renderTable,
        normalizeRows,
        computeLocalRows
    };
})(window);
