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

    function computeLocalMovement(ctx) {
        const state = (ctx && ctx.state) || {};
        const carteraData = (state.cartera && state.cartera.data) || [];
        const contratosData = (state.contratos && state.contratos.data) || [];
        const selUn = (ctx && ctx.selUn) || new Set();
        const selAnio = (ctx && ctx.selAnio) || new Set();
        const selFecha = (ctx && ctx.selFecha) || new Set();
        const selViaCobro = (ctx && ctx.selViaCobro) || new Set();
        const selCat = (ctx && ctx.selCat) || new Set();
        const monthToSerial = ctx && ctx.monthToSerial ? ctx.monthToSerial : (() => -1);
        const getYearFromGestionMonth = ctx && ctx.getYearFromGestionMonth ? ctx.getYearFromGestionMonth : (() => '');
        const normalizeViaCobro = ctx && ctx.normalizeViaCobro ? ctx.normalizeViaCobro : ((v) => String(v || 'DEBITO'));
        const addMonths = ctx && ctx.addMonths ? ctx.addMonths : ((m) => m);

        const result = {
            available: false,
            reason: '',
            byGestion: {},
            availableGestiones: [],
            byGestionAvgCuota: {},
            rows: [],
            culVigAvailable: false,
            culVigReason: '',
            culVigByGestion: {},
            culStatusByGestion: {},
            culUnknownByGestion: {}
        };

        const hasMorosoSelected = selCat.size === 0 || selCat.has('MOROSO');
        if (!carteraData.length) {
            result.reason = 'Movimiento de cartera requiere cartera.csv en memoria. Usa sincronizacion completa.';
            result.culVigReason = 'Culminados por estado requiere cartera.csv en memoria. Usa sincronizacion completa.';
            return result;
        }

        const byContractMonth = {};
        const byContractTimeline = {};
        for (let i = 0; i < carteraData.length; i++) {
            const r = carteraData[i];
            const cId = String(r._cId || '');
            const fe = String(r._feNorm || '');
            if (!cId || !/^\d{2}\/\d{4}$/.test(fe)) continue;
            const key = `${cId}_${fe}`;
            const tramoRaw = parseInt(r.tramo, 10);
            const tramoNum = Number.isFinite(tramoRaw) ? tramoRaw : 0;
            const unVal = String(r.UN || 'S/D');
            const viaVal = normalizeViaCobro(r.via_de_cobro);
            const cuotaRaw = parseFloat(r.monto_cuota);
            const cuotaVal = Number.isFinite(cuotaRaw) ? cuotaRaw : 0;
            const cuotaCount = Number.isFinite(cuotaRaw) ? 1 : 0;
            if (!byContractMonth[key]) {
                byContractMonth[key] = {
                    cId,
                    gestion: fe,
                    tramo: tramoNum,
                    un: unVal,
                    via: viaVal,
                    cuotaTotal: cuotaVal,
                    cuotaCount
                };
            } else {
                const curr = byContractMonth[key];
                if (tramoNum > curr.tramo) curr.tramo = tramoNum;
                if ((curr.un === 'S/D' || !curr.un) && unVal) curr.un = unVal;
                if (viaVal === 'COBRADOR') curr.via = 'COBRADOR';
                curr.cuotaTotal += cuotaVal;
                curr.cuotaCount += cuotaCount;
            }
        }

        const byContractMonthKeys = Object.keys(byContractMonth);
        for (let i = 0; i < byContractMonthKeys.length; i++) {
            const row = byContractMonth[byContractMonthKeys[i]];
            if (!row || !row.cId || !row.gestion) continue;
            if (!byContractTimeline[row.cId]) byContractTimeline[row.cId] = [];
            byContractTimeline[row.cId].push(row);
        }
        const timelineIds = Object.keys(byContractTimeline);
        for (let i = 0; i < timelineIds.length; i++) {
            byContractTimeline[timelineIds[i]].sort((a, b) => monthToSerial(a.gestion) - monthToSerial(b.gestion));
        }

        const findSnapshotAtOrBefore = (cId, month) => {
            const timeline = byContractTimeline[cId];
            if (!timeline || !timeline.length || !/^\d{2}\/\d{4}$/.test(String(month || ''))) return null;
            const targetSerial = monthToSerial(month);
            let prev = null;
            for (let i = 0; i < timeline.length; i++) {
                const row = timeline[i];
                const rowSerial = monthToSerial(String(row.gestion || ''));
                if (rowSerial <= 0) continue;
                if (rowSerial > targetSerial) break;
                prev = row;
                if (String(row.gestion || '') === String(month || '')) break;
            }
            return prev;
        };
        const findSnapshotAtOrAfter = (cId, month) => {
            const timeline = byContractTimeline[cId];
            if (!timeline || !timeline.length || !/^\d{2}\/\d{4}$/.test(String(month || ''))) return null;
            const targetSerial = monthToSerial(month);
            for (let i = 0; i < timeline.length; i++) {
                const row = timeline[i];
                const rowSerial = monthToSerial(String(row.gestion || ''));
                if (rowSerial <= 0) continue;
                if (rowSerial >= targetSerial) return row;
            }
            return null;
        };

        const rows = [];
        const byGestionCounts = {};
        const byGestionVigenteCounts = {};
        const byGestionCuotaTotals = {};
        const byGestionCuotaCounts = {};
        const availableGestiones = new Set();
        const keys = Object.keys(byContractMonth);

        if (hasMorosoSelected) {
            for (let i = 0; i < keys.length; i++) {
                const curr = byContractMonth[keys[i]];
                if (!curr || curr.tramo <= 3) continue;
                const gestion = String(curr.gestion || '');
                if (!/^\d{2}\/\d{4}$/.test(gestion)) continue;
                if (selAnio.size > 0 && !selAnio.has(getYearFromGestionMonth(gestion))) continue;
                if (selFecha.size > 0 && !selFecha.has(gestion)) continue;
                if (selUn.size > 0 && !selUn.has(String(curr.un || 'S/D'))) continue;
                if (selViaCobro.size > 0 && !selViaCobro.has(String(curr.via || 'DEBITO'))) continue;
                const prevGestion = addMonths(gestion, -1);
                if (!/^\d{2}\/\d{4}$/.test(prevGestion)) continue;
                const prev = findSnapshotAtOrBefore(curr.cId, prevGestion);
                if (!prev) continue;
                if ((parseInt(prev.tramo, 10) || 0) > 3) continue;
                const cuotaPromContrato = curr.cuotaCount > 0 ? (curr.cuotaTotal / curr.cuotaCount) : 0;
                rows.push({
                    gestion,
                    prevGestion: String(prev.gestion || prevGestion),
                    cId: curr.cId,
                    prevTramo: parseInt(prev.tramo, 10) || 0,
                    currTramo: parseInt(curr.tramo, 10) || 0,
                    un: String(curr.un || 'S/D'),
                    via: String(curr.via || 'DEBITO'),
                    avgMontoCuota: cuotaPromContrato
                });
                byGestionCounts[gestion] = (byGestionCounts[gestion] || 0) + 1;
                byGestionCuotaTotals[gestion] = (byGestionCuotaTotals[gestion] || 0) + cuotaPromContrato;
                byGestionCuotaCounts[gestion] = (byGestionCuotaCounts[gestion] || 0) + 1;
            }
        } else {
            result.reason = 'Sin resultados: el filtro Categoria no incluye MOROSO.';
        }

        for (let i = 0; i < keys.length; i++) {
            const curr = byContractMonth[keys[i]];
            if (!curr) continue;
            const gestion = String(curr.gestion || '');
            if (!/^\d{2}\/\d{4}$/.test(gestion)) continue;
            if (selAnio.size > 0 && !selAnio.has(getYearFromGestionMonth(gestion))) continue;
            if (selFecha.size > 0 && !selFecha.has(gestion)) continue;
            if (selUn.size > 0 && !selUn.has(String(curr.un || 'S/D'))) continue;
            if (selViaCobro.size > 0 && !selViaCobro.has(String(curr.via || 'DEBITO'))) continue;
            availableGestiones.add(gestion);
            if (curr.tramo <= 3) {
                byGestionVigenteCounts[gestion] = (byGestionVigenteCounts[gestion] || 0) + 1;
            }
        }

        rows.sort((a, b) => {
            const cmp = monthToSerial(a.gestion) - monthToSerial(b.gestion);
            if (cmp !== 0) return cmp;
            return String(a.cId).localeCompare(String(b.cId));
        });

        result.available = true;
        result.byGestion = byGestionCounts;
        result.byGestionVigente = byGestionVigenteCounts;
        result.availableGestiones = Array.from(availableGestiones);
        const byGestionAvgCuota = {};
        const monthKeys = Object.keys(byGestionCounts);
        for (let i = 0; i < monthKeys.length; i++) {
            const m = monthKeys[i];
            const count = byGestionCuotaCounts[m] || 0;
            byGestionAvgCuota[m] = count > 0 ? (byGestionCuotaTotals[m] || 0) / count : 0;
        }
        result.byGestionAvgCuota = byGestionAvgCuota;
        result.rows = rows;
        if (hasMorosoSelected && rows.length === 0) {
            result.reason = 'No se encontraron contratos que pasaron de tramo <= 3 a tramo > 3.';
        }

        if (!contratosData.length) {
            result.culVigReason = 'Culminados por estado requiere contratos.csv en memoria. Sincroniza contratos.';
            return result;
        }

        const culStatusByGestion = {};
        const culUnknownByGestion = {};
        const culVigCandidateMonths = new Set();
        for (let i = 0; i < contratosData.length; i++) {
            const c = contratosData[i];
            const cId = String(c._cId || '');
            const culmMonth = String(c._culminacionMonth || '');
            if (!cId || !/^\d{2}\/\d{4}$/.test(culmMonth)) continue;
            if (selAnio.size > 0 && !selAnio.has(getYearFromGestionMonth(culmMonth))) continue;
            if (selFecha.size > 0 && !selFecha.has(culmMonth)) continue;
            const allKnownCatsSelected = selCat.size === 0 || (selCat.has('VIGENTE') && selCat.has('MOROSO'));
            const allKnownViaSelected = selViaCobro.size === 0 || (selViaCobro.has('COBRADOR') && selViaCobro.has('DEBITO'));
            const contractUN = String(c.UN || 'S/D');

            let row = findSnapshotAtOrBefore(cId, culmMonth);
            if (!row) row = findSnapshotAtOrAfter(cId, culmMonth);
            const un = String((row && row.un) || contractUN || 'S/D');
            const via = String((row && row.via) || 'S/D');
            if (selUn.size > 0 && !selUn.has(un)) continue;
            if (selViaCobro.size > 0 && via !== 'S/D' && !selViaCobro.has(via)) continue;
            if (selViaCobro.size > 0 && via === 'S/D' && !allKnownViaSelected) continue;

            const tramoRaw = row ? parseInt(row.tramo, 10) : NaN;
            culVigCandidateMonths.add(culmMonth);
            if (!culStatusByGestion[culmMonth]) culStatusByGestion[culmMonth] = { vigente: 0, moroso: 0 };
            if (!row || !Number.isFinite(tramoRaw)) {
                if (!allKnownCatsSelected) continue;
                culUnknownByGestion[culmMonth] = (culUnknownByGestion[culmMonth] || 0) + 1;
            } else {
                const catCulm = tramoRaw <= 3 ? 'VIGENTE' : 'MOROSO';
                if (selCat.size > 0 && !selCat.has(catCulm)) continue;
                if (catCulm === 'VIGENTE') culStatusByGestion[culmMonth].vigente += 1;
                else culStatusByGestion[culmMonth].moroso += 1;
            }
        }

        const candidateMonths = Array.from(culVigCandidateMonths);
        for (let i = 0; i < candidateMonths.length; i++) {
            const month = candidateMonths[i];
            if (!Object.prototype.hasOwnProperty.call(culStatusByGestion, month)) culStatusByGestion[month] = { vigente: 0, moroso: 0 };
            if (!Object.prototype.hasOwnProperty.call(culUnknownByGestion, month)) culUnknownByGestion[month] = 0;
        }

        result.culVigAvailable = true;
        result.culStatusByGestion = culStatusByGestion;
        result.culUnknownByGestion = culUnknownByGestion;
        result.culVigByGestion = Object.fromEntries(Object.keys(culStatusByGestion).map((m) => [m, culStatusByGestion[m].vigente || 0]));
        if (Object.keys(culStatusByGestion).length === 0) {
            result.culVigReason = 'No se encontraron culminados para los filtros actuales.';
        }
        return result;
    }

    function prepareViewModel(movement, deps) {
        const monthToSerial = deps && deps.monthToSerial ? deps.monthToSerial : (() => -1);
        const formatNumber = deps && deps.formatNumber ? deps.formatNumber : (n) => String(n);
        const available = movement && movement.available === true;
        const vm = {
            available,
            labels: [],
            values: [],
            avgCuotaValues: [],
            vigenteValues: [],
            percentValues: [],
            movementStatus: 'Movimiento de cartera no disponible.',
            culVigAvailable: movement && movement.culVigAvailable === true,
            culVigLabels: [],
            culVigData: [],
            culMorData: [],
            culUnknownData: [],
            culVigStatus: 'Culminados por estado no disponible.'
        };
        if (!available) {
            if (movement && movement.reason) vm.movementStatus = movement.reason;
            if (movement && movement.culVigReason) vm.culVigStatus = movement.culVigReason;
            return vm;
        }

        const byGestion = (movement && movement.byGestion) || {};
        const byGestionVigente = (movement && movement.byGestionVigente) || {};
        const baseLabels = Array.isArray(movement.availableGestiones) && movement.availableGestiones.length > 0
            ? movement.availableGestiones
            : [...new Set([...Object.keys(byGestion), ...Object.keys(byGestionVigente)])];
        const labels = baseLabels.sort((a, b) => monthToSerial(a) - monthToSerial(b));
        const values = labels.map((m) => byGestion[m] || 0);
        const byGestionAvgCuota = (movement && movement.byGestionAvgCuota) || {};
        const avgCuotaValues = labels.map((m) => byGestionAvgCuota[m] || 0);
        const vigenteValues = labels.map((m) => byGestionVigente[m] || 0);
        const percentValues = labels.map((m, i) => {
            const denom = Number(vigenteValues[i] || 0);
            const num = Number(values[i] || 0);
            return denom > 0 ? (num / denom) * 100 : 0;
        });
        vm.labels = labels;
        vm.values = values;
        vm.avgCuotaValues = avgCuotaValues;
        vm.vigenteValues = vigenteValues;
        vm.percentValues = percentValues;
        const totalContracts = values.reduce((acc, v) => acc + (Number(v) || 0), 0);
        vm.movementStatus = totalContracts > 0
            ? `Total contratos que pasaron a moroso: ${formatNumber(totalContracts)}.`
            : (movement.reason || 'No se encontraron contratos que pasaron a moroso con los filtros actuales.');

        if (!vm.culVigAvailable) {
            vm.culVigStatus = movement && movement.culVigReason
                ? movement.culVigReason
                : 'Culminados por estado no disponible.';
            return vm;
        }

        const culStatusByGestion = movement.culStatusByGestion || {};
        const culUnknownByGestion = movement.culUnknownByGestion || {};
        const culVigLabels = Object.keys(culStatusByGestion).sort((a, b) => monthToSerial(a) - monthToSerial(b));
        const culVigData = culVigLabels.map((m) => (culStatusByGestion[m] && culStatusByGestion[m].vigente) ? culStatusByGestion[m].vigente : 0);
        const culMorData = culVigLabels.map((m) => (culStatusByGestion[m] && culStatusByGestion[m].moroso) ? culStatusByGestion[m].moroso : 0);
        const culUnknownData = culVigLabels.map((m) => Number(culUnknownByGestion[m] || 0));
        vm.culVigLabels = culVigLabels;
        vm.culVigData = culVigData;
        vm.culMorData = culMorData;
        vm.culUnknownData = culUnknownData;
        if (culVigLabels.length === 0) {
            vm.culVigStatus = movement.culVigReason || 'No se encontraron culminados por estado para los filtros actuales.';
        } else {
            const totalCulVig = culVigData.reduce((acc, v) => acc + (Number(v) || 0), 0);
            const totalCulMor = culMorData.reduce((acc, v) => acc + (Number(v) || 0), 0);
            const totalCulUnknown = culUnknownData.reduce((acc, v) => acc + (Number(v) || 0), 0);
            const totalAll = totalCulVig + totalCulMor + totalCulUnknown;
            vm.culVigStatus = `Total culminados: ${formatNumber(totalAll)} | Vigentes: ${formatNumber(totalCulVig)} | Morosos: ${formatNumber(totalCulMor)} | Sin tramo: ${formatNumber(totalCulUnknown)}.`;
        }
        return vm;
    }

    function buildMovementDatasets(vm) {
        return [
            {
                type: 'bar',
                label: 'Contratos que pasaron a moroso',
                data: vm && Array.isArray(vm.values) ? vm.values : [],
                backgroundColor: '#f97316',
                borderRadius: 6,
                yAxisID: 'y'
            },
            {
                type: 'line',
                label: '% sobre Vigentes',
                data: vm && Array.isArray(vm.percentValues) ? vm.percentValues : [],
                borderColor: 'rgba(0,0,0,0)',
                backgroundColor: 'rgba(0,0,0,0)',
                tension: 0.35,
                pointRadius: 0,
                yAxisID: 'y1'
            }
        ];
    }

    function buildCulVigDatasets(vm) {
        const culVigData = vm && Array.isArray(vm.culVigData) ? vm.culVigData : [];
        const culMorData = vm && Array.isArray(vm.culMorData) ? vm.culMorData : [];
        const culUnknownData = vm && Array.isArray(vm.culUnknownData) ? vm.culUnknownData : [];
        const totalCulVig = culVigData.reduce((acc, v) => acc + (Number(v) || 0), 0);
        const totalCulMor = culMorData.reduce((acc, v) => acc + (Number(v) || 0), 0);
        const totalCulUnknown = culUnknownData.reduce((acc, v) => acc + (Number(v) || 0), 0);
        const datasets = [];
        if (totalCulVig > 0) {
            datasets.push({
                label: 'Culminados vigentes',
                data: culVigData,
                backgroundColor: '#22c55e',
                borderRadius: 6
            });
        }
        if (totalCulMor > 0) {
            datasets.push({
                label: 'Culminados morosos',
                data: culMorData,
                backgroundColor: '#ef4444',
                borderRadius: 6
            });
        }
        if (totalCulUnknown > 0) {
            datasets.push({
                label: 'Culminados sin tramo',
                data: culUnknownData,
                backgroundColor: '#94a3b8',
                borderRadius: 6
            });
        }
        if (datasets.length === 0) {
            datasets.push({
                label: 'Culminados vigentes',
                data: culVigData,
                backgroundColor: '#22c55e',
                borderRadius: 6
            });
        }
        return datasets;
    }

    global.TabModules.acaMovimiento = {
        id: 'acaMovimiento',
        mapApiPayloadToUi,
        buildSelectionSummary,
        computeLocalMovement,
        prepareViewModel,
        buildMovementDatasets,
        buildCulVigDatasets
    };
})(window);
