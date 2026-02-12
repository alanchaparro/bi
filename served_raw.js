// Dashboard Logic with IndexedDB Persistence
document.addEventListener('DOMContentLoaded', async () => {
    const fileInput = document.getElementById('file-input');
    const dropZone = document.getElementById('drop-zone');
    const loading = document.getElementById('loading');
    const progressText = document.getElementById('progress-text');
    const tabsNav = document.getElementById('tabs-nav');
    const btnProceed = document.getElementById('btn-proceed');

    // DB Handler
    const dbName = 'CobranzasDB';
    const storeName = 'datasets';
    const openDB = () => new Promise((resolve, reject) => {
        const req = indexedDB.open(dbName, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(storeName);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

    const saveData = async (key, val) => {
        const db = await openDB();
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(val, key);
        return new Promise((res) => tx.oncomplete = res);
    };

    const getData = async (key) => {
        const db = await openDB();
        const req = db.transaction(storeName).objectStore(storeName).get(key);
        return new Promise((res) => req.onsuccess = () => res(req.result));
    };

    // File State
    let pendingFiles = { cartera: null, cobranzas: null, gestores: null };

    // Content Containers
    const contents = {
        cartera: document.getElementById('cartera-content'),
        cobranzas: document.getElementById('cobranzas-content'),
        rendimiento: document.getElementById('rendimiento-content'),
        cosecha: document.getElementById('cosecha-content'),
        ltv: document.getElementById('ltv-content'),
        gestores: document.getElementById('gestores-content'),
        config: document.getElementById('config-content')
    };

    // Data State
    let state = {
        cartera: { data: [], filters: {}, charts: {} },
        cobranzas: { data: [], filters: {}, charts: {} },
        gestores: { data: [], filters: {}, charts: {} },
        rendimiento: { data: [], filters: {}, charts: {} },
        cosecha: { data: [], filters: {}, charts: {} },
        contratos: { data: [] },
        ltv: { filters: {}, charts: {} }
    };

    // -- INIT: Load from Persistent Storage --
    try {
        const cData = await getData('cartera');
        const cobData = await getData('cobranzas');
        const gData = await getData('gestores');
        const ctData = await getData('contratos');

        if (cData || cobData || gData || ctData) {
            loading.classList.remove('hidden');
            progressText.textContent = 'Restaurando sesion...';
            // Let UI render the message
            await new Promise(r => setTimeout(r, 50));

            if (cData) await processCartera(cData);
            if (cobData) await processCobranzas(cobData);
            if (gData) await processGestores(gData);
            if (ctData) await processContratos(ctData);

            tabsNav.classList.remove('hidden');
            dropZone.classList.add('hidden');

            // Auto-navigate to Performance if all exist
            if (cData && cobData) {
                switchTab('rendimiento');
            } else {
                switchTab(cData ? 'cartera' : (cobData ? 'cobranzas' : (ctData ? 'ltv' : 'config')));
            }

            loading.classList.add('hidden');
        }
    } catch (e) {
        console.error('Error loading from IDB:', e);
        loading.classList.add('hidden');
    }

    // Drag and Drop
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('drag-over'); });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFiles(e.target.files);
    });

    function handleFiles(files) {
        Array.from(files).forEach(file => {
            if (file.name.toLowerCase().includes('cartera')) {
                pendingFiles.cartera = file;
                updateFileStatus('cartera', file.name);
            } else if (file.name.toLowerCase().includes('cobranzas')) {
                pendingFiles.cobranzas = file;
                updateFileStatus('cobranzas', file.name);
            } else if (file.name.toLowerCase().includes('gestor') || file.name.toLowerCase().includes('asignacion')) {
                pendingFiles.gestores = file;
                updateFileStatus('gestores', file.name);
            }
        });

        btnProceed.disabled = !(pendingFiles.cartera && pendingFiles.cobranzas && pendingFiles.gestores);
    }

    function updateFileStatus(type, name) {
        const el = document.getElementById(`status-${type}`);
        el.classList.add('loaded');
        el.querySelector('.status-icon').textContent = 'OK';
        el.querySelector('.file-name').textContent = name;
        el.querySelector('.status-text').textContent = 'Listo';
    }

    btnProceed.onclick = async () => {
        loading.classList.remove('hidden'); // Use class instead of style.display for consistency
        progressText.textContent = 'Iniciando procesamiento...';

        // Let the UI render the loading screen before blocking the main thread
        await new Promise(r => setTimeout(r, 50));

        try {
            await processFile(pendingFiles.cartera, 'cartera');
            await processFile(pendingFiles.cobranzas, 'cobranzas');
            await processFile(pendingFiles.gestores, 'gestores');

            loading.classList.add('hidden');
            tabsNav.classList.remove('hidden');
            dropZone.classList.add('hidden');
            switchTab('cartera');
        } catch (err) {
            alert('Error al procesar: ' + err);
            loading.classList.add('hidden');
        }
    };

    function processFile(file, type) {
        return new Promise((resolve, reject) => {
            let loadedData = [];
            Papa.parse(file, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                worker: true,
                chunk: (results) => {
                    for (let i = 0; i < results.data.length; i++) loadedData.push(results.data[i]);
                    progressText.textContent = `Cargando ${type}: ${loadedData.length.toLocaleString()} filas...`;
                },
                complete: async () => {
                    try {
                        progressText.textContent = `Procesando ${type}...`;
                        await new Promise(r => setTimeout(r, 50));

                        if (type === 'cartera') await processCartera(loadedData);
                        else if (type === 'cobranzas') await processCobranzas(loadedData);
                        else if (type === 'gestores') {
                            await processGestores(loadedData);
                            await calculateGestoresDashboard();
                        } else if (type === 'contratos') {
                            await processContratos(loadedData);
                        }
                        resolve();
                    } catch (e) {
                        console.error(`Error en procesamiento de ${type}:`, e);
                        reject(e);
                    }
                },
                error: (err) => reject(err)
            });
        });
    }

    // Tab Switching
    window.switchTab = (tabId) => {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('onclick').includes(tabId));
        });
        Object.keys(contents).forEach(key => {
            contents[key].classList.toggle('hidden', key !== tabId);
        });

        if (tabId === 'gestores' && !state.gestores.dashboardInitialized) {
            calculateGestoresDashboard();
            state.gestores.dashboardInitialized = true;
        }
        if (tabId === 'cosecha' && !state.cosecha.dashboardInitialized) {
            calculateCosecha();
            state.cosecha.dashboardInitialized = true;
        }
        if (tabId === 'ltv') {
            ensureContratosLoaded().then(() => calculateLtv());
            state.ltv.dashboardInitialized = true;
        }
    };

    // --- CARTERA LOGIC ---
    async function processCartera(data) {
        state.cartera.data = data;
        await saveData('cartera', data);

        const uns = new Set(), tramos = new Set(), cats = new Set(), fechas = new Set();

        console.log("Optimizing Cartera process (Single-pass + Normalization)...");
        for (let i = 0; i < data.length; i++) {
            const r = data[i];

            // Pre-normalize (only if needed)
            const rawFe = r['Fecha gestion'];
            if (rawFe && rawFe.length < 7) { // e.g. "1/2026"
                r._feNorm = normD(rawFe);
            } else {
                r._feNorm = rawFe || 'S/D';
            }

            r._cId = String(r.id_contrato || '').replace(/[^0-9]/g, '');
            r._saleMonth = monthFromDate(r.fecha_contrato) || 'S/D';
            r._cierreMonth = monthFromDate(r.fecha_cierre) || 'S/D';
            const sm = r._saleMonth.split('/');
            r._saleMonthNum = sm.length === 2 ? String(sm[0]) : '';
            r._saleYear = sm.length === 2 ? String(sm[1]) : '';

            if (r.UN) uns.add(String(r.UN));
            if (r.tramo !== undefined && r.tramo !== null) tramos.add(String(r.tramo));
            if (r.categoria_tramo) cats.add(String(r.categoria_tramo));
            if (r._feNorm) fechas.add(r._feNorm);

            // Yield more frequently (every 10k rows)
            if (i % 10000 === 0) {
                progressText.textContent = `Analizando Cartera: ${i.toLocaleString()} / ${data.length.toLocaleString()}...`;
                await new Promise(r => setTimeout(r, 0));
            }
        }

        progressText.textContent = "Guardando Cartera en memoria local...";
        await new Promise(r => setTimeout(r, 50));
        await saveData('cartera', data);

        const sortedFechas = Array.from(fechas).sort((a, b) => {
            const [m1, y1] = a.split('/'); const [m2, y2] = b.split('/');
            return new Date(y1, m1 - 1) - new Date(y2, m2 - 1);
        });

        setupFilter('un', Array.from(uns).sort(), 'cartera');
        setupFilter('tramo', Array.from(tramos).sort((a, b) => a - b), 'cartera');
        setupFilter('cat', Array.from(cats).sort(), 'cartera');
        setupFilter('fecha', sortedFechas, 'cartera');

        document.getElementById('reset-cartera').onclick = () => { resetFilters('cartera'); applyCarteraFilters(); };
        applyCarteraFilters();

        // Only trigger if both are ready
        if (state.cobranzas.data.length) {
            await calculatePerformance();
            await calculateCosecha();
        }
    }

    function applyCarteraFilters() {
        const selUn = getSelected('un');
        const selTramo = getSelected('tramo');
        const selCat = getSelected('cat');
        const selFecha = getSelected('fecha');

        const filtered = state.cartera.data.filter(r =>
            selUn.has(String(r.UN)) && selTramo.has(String(r.tramo)) &&
            selCat.has(String(r.categoria_tramo)) && selFecha.has(r._feNorm)
        );
        updateCarteraUI(filtered);
    }

    function updateCarteraUI(data) {
        let n = 0, amt = 0; const unS = {}, trS = {};
        for (let i = 0; i < data.length; i++) {
            const r = data[i];
            const c = (r.monto_cuota || 0) + (r.monto_vencido || 0);
            n++; amt += c;
            unS[r.UN] = (unS[r.UN] || 0) + 1;
            trS[r.tramo] = (trS[r.tramo] || 0) + 1;
        }
        document.getElementById('total-contracts').textContent = n.toLocaleString();
        document.getElementById('total-amount').textContent = formatPYG(amt);
        renderChart('unChart', 'cartera', 'bar', Object.keys(unS), Object.values(unS), 'Contratos', '#38bdf8');
        renderChart('tramoChart', 'cartera', 'doughnut', Object.keys(trS).map(t => 'Tramo ' + t), Object.values(trS));
    }

    async function processCobranzas(data) {
        state.cobranzas.data = data;
        await saveData('cobranzas', data);

        const vps = new Set(), sucs = new Set(), anios = new Set(), meses = new Set(), dias = new Set();

        console.log("Optimizing Cobranzas process (Single-pass + Normalization)...");
        for (let i = 0; i < data.length; i++) {
            const r = data[i];

            // Pre-normalize
            const rawM = r.Mes || r.mes || r.month || 0;
            const rawA = r['A\u00f1o'] || r['Ano'] || r['Ao'] || r.year || 2026;
            const mStr = String(rawM);
            r._feNorm = mStr.length === 1 ? `0${mStr}/${rawA}` : `${mStr}/${rawA}`;
            r._cId = String(r.contract_id || r.id_contrato || '').replace(/[^0-9]/g, '');

            const vp = String(r.VP || '').trim();
            const suc = String(r.Suc || '').trim();
            const anio = String(r['A\u00f1o'] || '').trim();
            const mes = String(r.Mes || '').trim();
            const dia = String(r.Dia || '').trim();

            if (vp) vps.add(vp);
            if (suc) sucs.add(suc);
            if (anio) anios.add(anio);
            if (mes) meses.add(mes);
            if (dia) dias.add(dia);

            if (i % 10000 === 0) {
                progressText.textContent = `Analizando Cobranzas: ${i.toLocaleString()} / ${data.length.toLocaleString()}...`;
                await new Promise(r => setTimeout(r, 0));
            }
        }

        progressText.textContent = "Guardando Cobranzas en memoria local...";
        await new Promise(r => setTimeout(r, 50));
        await saveData('cobranzas', data);

        setupFilter('vp', Array.from(vps).sort(), 'cobranzas');
        setupFilter('suc', Array.from(sucs).sort(), 'cobranzas');
        setupFilter('anio', Array.from(anios).sort(), 'cobranzas');
        setupFilter('mes', Array.from(meses).sort((a, b) => a - b), 'cobranzas');
        setupFilter('dia', Array.from(dias).sort((a, b) => a - b), 'cobranzas');

        document.getElementById('reset-cobranzas').onclick = () => { resetFilters('cobranzas'); applyCobranzasFilters(); };
        applyCobranzasFilters();

        if (state.cartera.data.length) {
            await calculatePerformance();
            await calculateCosecha();
        }
    }

    async function processGestores(data) {
        state.gestores.data = data;
        await saveData('gestores', data);

        // No UI filters for gestores tab yet (tab not created), 
        // but normalize for the join
        for (let i = 0; i < data.length; i++) {
            const r = data[i];
            const rawFe = r.from_date;
            if (rawFe) {
                // Query format is YYYY-MM-DD
                const parts = rawFe.split('-');
                if (parts.length >= 2) {
                    r._feNorm = `${parts[1]}/${parts[0]}`; // MM/YYYY
                }
            }
            r._cId = String(r.contract_id || '').replace(/[^0-9]/g, '');
        }
        await saveData('gestores', data);
        console.log("Gestores processed and normalized.");

        if (state.cartera.data.length && state.cobranzas.data.length) await calculatePerformance();
    }

    async function processContratos(data) {
        for (let i = 0; i < data.length; i++) {
            const r = data[i];
            r._cId = String(r.id || r.contract_id || '').replace(/[^0-9]/g, '');
            r._contractMonth = monthFromDate(r.date) || 'S/D';
            const parts = r._contractMonth.split('/');
            r._contractYear = parts.length === 2 ? String(parts[1]) : 'S/D';
            r._statusNum = parseInt(r.status, 10);
            r._statusName = r._statusNum === 6 ? 'CULMINADO' : (r._statusNum === 5 ? 'ACTIVO' : 'OTRO');
            r._montoCuota = parseFloat(r.monto_cuota || r.amount || 0) || 0;
        }
        state.contratos.data = data;
        await saveData('contratos', data);
        console.log("Contratos processed and stored.");
        await calculateLtv();
    }

    async function ensureContratosLoaded() {
        if (state.contratos.data.length) return;
        try {
            const check = await fetch('/api/check-files');
            const files = await check.json();
            if (files.contratos) {
                await fetchAndProcess('contratos.csv', 'contratos');
            } else {
                addLog('contratos.csv no encontrado para LTV.', 'error');
            }
        } catch (err) {
            addLog(`No se pudo cargar contratos.csv para LTV: ${err.message}`, 'error');
        }
    }

    async function ensureCarteraLoaded() {
        if (state.cartera.data.length) return;
        try {
            const check = await fetch('/api/check-files');
            const files = await check.json();
            if (files.cartera) {
                await fetchAndProcess('cartera.csv', 'cartera');
            } else {
                addLog('cartera.csv no encontrado para LTV.', 'error');
            }
        } catch (err) {
            addLog(`No se pudo cargar cartera.csv para LTV: ${err.message}`, 'error');
        }
    }

    async function ensureCobranzasLoaded() {
        if (state.cobranzas.data.length) return;
        try {
            const check = await fetch('/api/check-files');
            const files = await check.json();
            if (files.cobranzas) {
                await fetchAndProcess('cobranzas_prepagas.csv', 'cobranzas');
            } else {
                addLog('cobranzas_prepagas.csv no encontrado para LTV.', 'error');
            }
        } catch (err) {
            addLog(`No se pudo cargar cobranzas para LTV: ${err.message}`, 'error');
        }
    }

    async function calculateLtv() {
        await ensureContratosLoaded();
        await ensureCarteraLoaded();
        await ensureCobranzasLoaded();
        if (!state.contratos.data.length || !state.cartera.data.length) return;

        if (!state.ltv.filtersInitialized) {
            const uns = [...new Set(state.contratos.data.map(r => String(r.UN || 'S/D')).filter(Boolean))].sort();
            const anios = [...new Set(state.contratos.data.map(r => String(r._contractYear || 'S/D')).filter(Boolean))].sort();
            const fechas = [...new Set(state.contratos.data.map(r => String(r._contractMonth || 'S/D')).filter(Boolean))].sort((a, b) => {
                const [m1, y1] = a.split('/'); const [m2, y2] = b.split('/');
                return new Date(y1, m1 - 1) - new Date(y2, m2 - 1);
            });
            const gestiones = [...new Set(state.cartera.data.map(r => String(r._feNorm || 'S/D')).filter(Boolean))].sort((a, b) => {
                const [m1, y1] = a.split('/'); const [m2, y2] = b.split('/');
                return new Date(y1, m1 - 1) - new Date(y2, m2 - 1);
            });
            const viasCobro = ['COBRADOR', 'DEBITO'];

            setupFilter('ltv-un', uns, 'ltv');
            setupFilter('ltv-anio', anios, 'ltv');
            setupFilter('ltv-fecha', fechas, 'ltv');
            setupFilter('ltv-gestion', gestiones, 'ltv');
            setupFilter('ltv-via-cobro', viasCobro, 'ltv');

            document.getElementById('reset-ltv').onclick = async () => {
                resetFilters('ltv');
                await calculateLtv();
            };
            state.ltv.filtersInitialized = true;
        }

        const selUn = getSelected('ltv-un');
        const selAnio = getSelected('ltv-anio');
        const selFecha = getSelected('ltv-fecha');
        const selGestion = getSelected('ltv-gestion');
        const selViaCobro = getSelected('ltv-via-cobro');
        updateLtvSelectionSummary(selUn, selAnio, selFecha, selGestion, selViaCobro);

        const stats = {
            totalContracts: 0,
            totalCobrar: 0,
            mora: 0,
            totalCobrado: 0,
            byGestion: {},
            sumDeberia: 0,
            sumCobrado: 0,
            ratioPago: 0,
            mesesPonderados: 0,
            ltvScore: 0,
            ltvCutoff: 'S/D'
        };

        const filteredContracts = state.contratos.data.filter(r =>
            (selUn.size === 0 || selUn.has(String(r.UN || 'S/D'))) &&
            (selAnio.size === 0 || selAnio.has(String(r._contractYear || 'S/D'))) &&
            (selFecha.size === 0 || selFecha.has(String(r._contractMonth || 'S/D')))
        );
        const contractIds = new Set(filteredContracts.map(r => r._cId).filter(Boolean));
        const contractStatusById = {};
        const contractDateById = {};
        for (let i = 0; i < filteredContracts.length; i++) {
            const c = filteredContracts[i];
            contractStatusById[c._cId] = c._statusName;
            contractDateById[c._cId] = String(c.date || '');
        }
        const filteredCartera = state.cartera.data.filter(r =>
            contractIds.has(r._cId) &&
            (selGestion.size === 0 || selGestion.has(String(r._feNorm || 'S/D'))) &&
            (selViaCobro.size === 0 || selViaCobro.has(normalizeViaCobro(r.via_de_cobro)))
        );

        const cobAggr = {};
        const cobByContractMonth = {};
        for (let i = 0; i < state.cobranzas.data.length; i++) {
            const r = state.cobranzas.data[i];
            if (!r._cId || !r._feNorm) continue;
            const key = `${r._cId}_${r._feNorm}`;
            cobAggr[key] = (cobAggr[key] || 0) + (parseFloat(r.monto) || 0);
            if (!cobByContractMonth[r._cId]) cobByContractMonth[r._cId] = {};
            cobByContractMonth[r._cId][r._feNorm] = (cobByContractMonth[r._cId][r._feNorm] || 0) + (parseFloat(r.monto) || 0);
        }

        for (let i = 0; i < filteredCartera.length; i++) {
            const r = filteredCartera[i];
            const gestion = String(r._feNorm || 'S/D');
            const montoCobrar = (parseFloat(r.monto_cuota) || 0) + (parseFloat(r.monto_vencido) || 0);
            const montoCobrado = cobAggr[`${r._cId}_${gestion}`] || 0;
            const fechaContrato = contractDateById[r._cId] || '';
            const mesesAntiguedad = monthsBetweenDateAndMonth(fechaContrato, gestion);
            const deberiaFila = (parseFloat(r.monto_cuota) || 0) * mesesAntiguedad;
            const isMora = String(r.categoria_tramo || '').toUpperCase().includes('MOROS')
                || ((parseInt(r.tramo, 10) || 0) > 3);

            stats.totalContracts += 1;
            stats.totalCobrar += montoCobrar;
            stats.totalCobrado += montoCobrado;
            if (isMora) stats.mora += 1;

            if (!stats.byGestion[gestion]) {
                stats.byGestion[gestion] = {
                    vigente: 0,
                    mora: 0,
                    culminado: 0,
                    cobrar: 0,
                    cobrado: 0,
                    deberia: 0,
                    weightedMonthsNumerator: 0,
                    mesesPond: 0,
                    ratioPago: 0,
                    ltv: 0
                };
            }
            if (isMora) stats.byGestion[gestion].mora += 1;
            else stats.byGestion[gestion].vigente += 1;
            if (contractStatusById[r._cId] === 'CULMINADO') stats.byGestion[gestion].culminado += 1;
            stats.byGestion[gestion].cobrar += montoCobrar;
            stats.byGestion[gestion].cobrado += montoCobrado;
            stats.byGestion[gestion].deberia += deberiaFila;
            stats.byGestion[gestion].weightedMonthsNumerator += (mesesAntiguedad * deberiaFila);
        }

        // LTV financiero acumulado por mes de corte
        const validGestiones = [...new Set(filteredCartera.map(r => String(r._feNorm || '')))]
            .filter(v => /^\d{2}\/\d{4}$/.test(v))
            .sort((a, b) => monthToSerial(a) - monthToSerial(b));

        const computeLtvAtCutoff = (cutoff) => {
            const cutoffSerial = monthToSerial(cutoff);
            const endpointMap = {};
            for (let i = 0; i < filteredCartera.length; i++) {
                const r = filteredCartera[i];
                if (String(r._feNorm || '') !== cutoff) continue;
                if (!endpointMap[r._cId]) endpointMap[r._cId] = r;
            }

            let sumDeberia = 0;
            let sumCobrado = 0;
            let weightedMonthsNumerator = 0;
            const endpointRows = Object.values(endpointMap);
            for (let i = 0; i < endpointRows.length; i++) {
                const r = endpointRows[i];
                const fechaContrato = contractDateById[r._cId] || '';
                const mesesAntiguedad = monthsBetweenDateAndMonth(fechaContrato, cutoff);
                const cuota = parseFloat(r.monto_cuota) || 0;
                const deberiaFila = cuota * mesesAntiguedad;
                if (deberiaFila <= 0) continue;

                sumDeberia += deberiaFila;
                weightedMonthsNumerator += (mesesAntiguedad * deberiaFila);

                const startMonth = monthFromDate(fechaContrato);
                const startSerial = monthToSerial(startMonth);
                const monthMap = cobByContractMonth[r._cId] || {};
                let cobradoAcumulado = 0;
                for (const m in monthMap) {
                    const s = monthToSerial(m);
                    if (s >= startSerial && s <= cutoffSerial) cobradoAcumulado += monthMap[m];
                }
                sumCobrado += cobradoAcumulado;
            }

            let ratioPago = 0;
            let mesesPonderados = 0;
            let ltvScore = 0;
            if (sumDeberia > 0) {
                ratioPago = sumCobrado / sumDeberia;
                mesesPonderados = weightedMonthsNumerator / sumDeberia;
                ltvScore = ratioPago * mesesPonderados;
            }
            return { sumDeberia, sumCobrado, ratioPago, mesesPonderados, ltvScore };
        };

        for (let i = 0; i < validGestiones.length; i++) {
            const cutoff = validGestiones[i];
            const calc = computeLtvAtCutoff(cutoff);
            if (stats.byGestion[cutoff]) {
                stats.byGestion[cutoff].deberia = calc.sumDeberia;
                stats.byGestion[cutoff].ratioPago = calc.ratioPago;
                stats.byGestion[cutoff].mesesPond = calc.mesesPonderados;
                stats.byGestion[cutoff].ltv = calc.ltvScore;
            }
        }

        if (validGestiones.length > 0) {
            const cutoff = validGestiones[validGestiones.length - 1];
            const calc = computeLtvAtCutoff(cutoff);
            stats.ltvCutoff = cutoff;
            stats.sumDeberia = calc.sumDeberia;
            stats.sumCobrado = calc.sumCobrado;
            stats.ratioPago = calc.ratioPago;
            stats.mesesPonderados = calc.mesesPonderados;
            stats.ltvScore = calc.ltvScore;
        }

        updateLtvUI(stats);
    }

    function updateLtvSelectionSummary(selUn, selAnio, selFecha, selGestion, selViaCobro) {
        const el = document.getElementById('ltv-selection-summary');
        if (!el) return;

        const labels = {
            un: getSelectionLabel('ltv-un', selUn, 'Todas'),
            anio: getSelectionLabel('ltv-anio', selAnio, 'Todos'),
            fecha: getSelectionLabel('ltv-fecha', selFecha, 'Historia'),
            gestion: getSelectionLabel('ltv-gestion', selGestion, 'Historia'),
            viaCobro: getSelectionLabel('ltv-via-cobro', selViaCobro, 'Todas')
        };

        el.innerHTML = `<strong>Seleccion actual:</strong> UN: ${labels.un} | Anio: ${labels.anio} | Mes/Anio: ${labels.fecha} | Gestion: ${labels.gestion} | Via Cobro: ${labels.viaCobro}`;
    }

    function getSelectionLabel(filterId, selectedSet, allLabel) {
        const allOptions = [...document.querySelectorAll(`.${filterId}-cb`)].map(c => String(c.value));
        const selected = allOptions.filter(v => selectedSet.has(v));

        if (selected.length === 0 || selected.length === allOptions.length) return allLabel;
        if (selected.length <= 3) return selected.join(', ');
        return `${selected.length} seleccionados`;
    }

    function applyCobranzasFilters() {
        const selVp = getSelected('vp');
        const selSuc = getSelected('suc');
        const selAnio = getSelected('anio');
        const selMes = getSelected('mes');
        const selDia = getSelected('dia');

        const filtered = state.cobranzas.data.filter(r => {
            return selVp.has(String(r.VP || '').trim()) &&
                selSuc.has(String(r.Suc || '').trim()) &&
                selAnio.has(String(r['A\u00f1o'] || '').trim()) &&
                selMes.has(String(r.Mes || '').trim()) &&
                selDia.has(String(r.Dia || '').trim());
        });
        updateCobranzasUI(filtered);
    }

    function updateCobranzasUI(data) {
        let t = 0, d = 0, c = 0;
        const trend = {}, vpMap = {}, sucMap = {};
        const mesDist = {}, diaDist = {};

        data.forEach(r => {
            const m = r.monto || 0; t += m;
            if (r.VP === 'DEBITO') d += m;
            if (r.VP === 'COBRADOR') c += m;

            // Trend (MM/YYYY)
            const f = `${String(r.Mes).padStart(2, '0')}/${r['A\u00f1o']}`;
            trend[f] = (trend[f] || 0) + m;

            // VP & Sucursal
            vpMap[r.VP] = (vpMap[r.VP] || 0) + m;
            sucMap[r.Suc] = (sucMap[r.Suc] || 0) + m;

            // Distribution by Month (1-12) and Day (1-31)
            mesDist[r.Mes] = (mesDist[r.Mes] || 0) + m;
            diaDist[r.Dia] = (diaDist[r.Dia] || 0) + m;
        });

        document.getElementById('total-cobrado').textContent = formatPYG(t);
        document.getElementById('cobrado-debito').textContent = formatPYG(d);
        document.getElementById('cobrado-cobrador').textContent = formatPYG(c);

        // Render Charts
        renderChart('cobranzaTrendChart', 'cobranzas', 'line', Object.keys(trend), Object.values(trend), 'Gs.', '#10b981');
        renderChart('vpChart', 'cobranzas', 'doughnut', Object.keys(vpMap), Object.values(vpMap));
        renderChart('sucChart', 'cobranzas', 'bar', Object.keys(sucMap), Object.values(sucMap), 'Gs.', '#3b82f6');

        // Mes Distribution Chart (Sorted 1-12)
        const mesLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const mesData = Array.from({ length: 12 }, (_, i) => mesDist[i + 1] || 0);
        renderChart('mesDistribChart', 'cobranzas', 'bar', mesLabels, mesData, 'Gs.', '#818cf8');

        // Dia Distribution Chart (Sorted 1-31)
        const diaLabels = Array.from({ length: 31 }, (_, i) => String(i + 1));
        const diaData = Array.from({ length: 31 }, (_, i) => diaDist[i + 1] || 0);
        renderChart('diaDistribChart', 'cobranzas', 'bar', diaLabels, diaData, 'Gs.', '#f472b6');
    }

    // --- RENDIMIENTO LOGIC (JOIN) ---
    // --- RENDIMIENTO LOGIC (JOIN) ---
    // --- RENDIMIENTO LOGIC (JOIN) ---
    async function calculatePerformance() {
        if (!state.cartera.data.length || !state.cobranzas.data.length) return;

        console.log("Rendimiento: Iniciando calculo robusto optimizado (V7)...");
        let matches = 0, nonMatches = 0;
        let totalMatchedAmount = 0;

        progressText.textContent = "Analizando cruce de datos (1/3)...";
        await new Promise(r => setTimeout(r, 50));

        // 1. Aggregate collections track Via de Pago (Real)
        const cobAggr = {};
        const cobData = state.cobranzas.data;
        const cobLen = cobData.length;
        for (let i = 0; i < cobLen; i++) {
            const r = cobData[i];
            if (!r._feNorm || !r._cId) continue;

            const key = `${r._cId}_${r._feNorm}`;
            if (!cobAggr[key]) cobAggr[key] = { total: 0, byVia: {} };

            const monto = parseFloat(r.monto) || 0;
            const viaPagoReal = String(r.VP || 'S/D').trim();

            cobAggr[key].total += monto;
            cobAggr[key].byVia[viaPagoReal] = (cobAggr[key].byVia[viaPagoReal] || 0) + monto;

            if (i % 25000 === 0) {
                progressText.textContent = `Analizando cruce (Cobranzas): ${i.toLocaleString()}...`;
                await new Promise(r => setTimeout(r, 0));
            }
        }

        progressText.textContent = "Analizando cruce de datos (2/3)...";
        await new Promise(r => setTimeout(r, 50));

        // 2. Setup Rendimiento Filters
        if (!state.rendimiento.filtersInitialized) {
            console.log("Rendimiento: Inicializando filtros por primera vez...");
            const uns = [...new Set(state.cartera.data.map(r => String(r.UN || 'S/D')).filter(Boolean))].sort();
            const tramos = [...new Set(state.cartera.data.map(r => String(r.tramo || '0')).filter(v => v !== null))].sort((a, b) => a - b);
            const fechas = [...new Set(state.cartera.data.map(r => r._feNorm).filter(Boolean))].sort((a, b) => {
                const [m1, y1] = a.split('/'); const [m2, y2] = b.split('/');
                return new Date(y1, m1 - 1) - new Date(y2, m2 - 1);
            });
            const viasPagoReal = [...new Set(state.cobranzas.data.map(r => String(r.VP || 'S/D')).filter(Boolean))].sort();
            const viasCobroInt = ['COBRADOR', 'DEBITO'];

            setupFilter('perf-un', uns, 'rendimiento');
            setupFilter('perf-tramo', tramos, 'rendimiento');
            setupFilter('perf-fecha', fechas, 'rendimiento');
            setupFilter('perf-via-cobro', viasCobroInt, 'rendimiento');
            setupFilter('perf-via-pago', viasPagoReal, 'rendimiento');
            setupFilter('perf-cat', ['VIGENTE', 'MOROSO'], 'rendimiento');

            document.getElementById('reset-perf').onclick = async () => {
                resetFilters('rendimiento');
                await calculatePerformance();
            };
            state.rendimiento.filtersInitialized = true;
        }

        const selUn = getSelected('perf-un');
        const selTramo = getSelected('perf-tramo');
        const selFecha = getSelected('perf-fecha');
        const selViaCobroInt = getSelected('perf-via-cobro');
        const selViaPagoReal = getSelected('perf-via-pago');
        const selCat = getSelected('perf-cat');

        // 2.5 Build Gestores Map for quick lookup
        const gMap = {};
        const gData = state.gestores.data;
        for (let j = 0; j < gData.length; j++) {
            const gr = gData[j];
            if (gr._cId && gr._feNorm) {
                gMap[`${gr._cId}_${gr._feNorm}`] = String(gr.Gestor || 'S/D');
            }
        }

        // 3. Match against Portfolio
        const portfolioMap = {};
        const cartData = state.cartera.data;
        const cartLen = cartData.length;

        for (let i = 0; i < cartLen; i++) {
            const r = cartData[i];
            const unVal = String(r.UN || 'S/D');
            const trVal = String(r.tramo || '0');
            const trNum = parseInt(trVal) || 0;
            const catVal = (trNum <= 3) ? 'VIGENTE' : 'MOROSO';

            const rawVia = String(r.via_de_cobro || '').trim().toUpperCase();
            const viaCInt = (rawVia === 'COBRADOR' || rawVia === 'COB') ? 'COBRADOR' : 'DEBITO';

            if ((selUn.size === 0 || selUn.has(unVal)) &&
                (selTramo.size === 0 || selTramo.has(trVal)) &&
                (selCat.size === 0 || selCat.has(catVal)) &&
                (selViaCobroInt.size === 0 || selViaCobroInt.has(viaCInt)) &&
                (selFecha.size === 0 || selFecha.has(r._feNorm))) {

                const gName = gMap[`${r._cId}_${r._feNorm}`] || 'S/D';

                if (!r._cId) continue;
                const key = `${r._cId}_${r._feNorm}`;
                const debt = (parseFloat(r.monto_cuota) || 0) + (parseFloat(r.monto_vencido) || 0);

                if (!portfolioMap[key]) {
                    portfolioMap[key] = { un: unVal, tramo: trVal, viaC: viaCInt, gestor: gName, debt: 0, cId: r._cId };
                }
                portfolioMap[key].debt += debt;
            }
            if (i % 25000 === 0) {
                progressText.textContent = `Analizando cruce (Cartera): ${i.toLocaleString()}...`;
                await new Promise(r => setTimeout(r, 0));
            }
        }

        progressText.textContent = "Finalizando cruce de datos (3/3)...";
        await new Promise(r => setTimeout(r, 50));

        const pKeys = Object.keys(portfolioMap);
        const pLen = pKeys.length;
        const stats = {
            totalDebt: 0, totalPaid: 0,
            totalContracts: 0, totalContractsPaid: 0,
            tramoStats: {}, unStats: {}, viaCStats: {}, gestorStats: {}, matrixStats: {},
            trendStats: {} // Month -> {d, p, c, cp}
        };

        for (let i = 0; i < pLen; i++) {
            const key = pKeys[i]; // cId_feNorm
            const feNorm = key.split('_')[1];
            const info = portfolioMap[key];
            const cob = cobAggr[key] || { total: 0, byVia: {} };

            let paid = 0, paidDetails = {};
            if (selViaPagoReal.size === 0) {
                paid = cob.total;
                paidDetails = cob.byVia;
            } else {
                for (const v in cob.byVia) {
                    if (selViaPagoReal.has(v)) {
                        paid += cob.byVia[v];
                        paidDetails[v] = cob.byVia[v];
                    }
                }
            }

            // Aggregation (Injected from updatePerformanceUI)
            const d = info.debt;
            stats.totalDebt += d;
            stats.totalPaid += paid;
            stats.totalContracts += 1;
            if (paid > 0) stats.totalContractsPaid += 1;

            if (!stats.trendStats[feNorm]) stats.trendStats[feNorm] = { d: 0, p: 0, c: 0, cp: 0 };
            stats.trendStats[feNorm].d += d;
            stats.trendStats[feNorm].p += paid;
            stats.trendStats[feNorm].c += 1;
            if (paid > 0) stats.trendStats[feNorm].cp += 1;

            const t = info.tramo || '0';
            const u = info.un || 'S/D';
            const vc = info.viaC || 'DEBITO';

            if (!stats.tramoStats[t]) stats.tramoStats[t] = { d: 0, p: 0 };
            stats.tramoStats[t].d += d;
            stats.tramoStats[t].p += paid;

            if (!stats.unStats[u]) stats.unStats[u] = { d: 0, p: 0 };
            stats.unStats[u].d += d;
            stats.unStats[u].p += paid;

            const g = info.gestor || 'S/D';
            if (!stats.gestorStats[g]) stats.gestorStats[g] = { d: 0, p: 0 };
            stats.gestorStats[g].d += d;
            stats.gestorStats[g].p += paid;

            if (!stats.viaCStats[vc]) stats.viaCStats[vc] = { d: 0, p: 0 };
            stats.viaCStats[vc].d += d;
            stats.viaCStats[vc].p += paid;

            if (!stats.matrixStats[vc]) stats.matrixStats[vc] = {};
            for (const vAct in paidDetails) {
                stats.matrixStats[vc][vAct] = (stats.matrixStats[vc][vAct] || 0) + paidDetails[vAct];
            }

            if (i % 20000 === 0) {
                progressText.textContent = `Generando estadisticas: ${i.toLocaleString()} / ${pLen.toLocaleString()}...`;
                await new Promise(r => setTimeout(r, 0));
            }
        }

        console.log(`Rendimiento Diagnostic: UNIQUE Portfolio Keys: ${pLen}, Total Debt: ${stats.totalDebt}, Total Paid: ${stats.totalPaid}`);

        updatePerformanceUI(stats);
    }

    // --- COSECHA LOGIC (COHORTS) ---
    async function calculateCosecha() {
        if (!state.cartera.data.length || !state.cobranzas.data.length) return;

        console.log("Cosecha: Iniciando calculo de cohortes...");
        let totalBase = 0, totalPaid = 0, totalBaseCount = 0, totalPaidCount = 0;

        // 1. Aggregate cobranzas by contract + month
        const cobAggr = {};
        const cobData = state.cobranzas.data;
        for (let i = 0; i < cobData.length; i++) {
            const r = cobData[i];
            if (!r._feNorm || !r._cId) continue;

            const key = `${r._cId}_${r._feNorm}`;
            if (!cobAggr[key]) cobAggr[key] = { total: 0, byVia: {} };

            const monto = parseFloat(r.monto) || 0;
            const viaPagoReal = String(r.VP || 'S/D').trim();
            cobAggr[key].total += monto;
            cobAggr[key].byVia[viaPagoReal] = (cobAggr[key].byVia[viaPagoReal] || 0) + monto;

            if (i % 25000 === 0) {
                progressText.textContent = `Cosecha: procesando cobranzas ${i.toLocaleString()}...`;
                await new Promise(r => setTimeout(r, 0));
            }
        }

        // 2. Setup Cosecha Filters
        if (!state.cosecha.filtersInitialized) {
            const uns = [...new Set(state.cartera.data.map(r => String(r.UN || 'S/D')).filter(Boolean))].sort();
            const tramos = [...new Set(state.cartera.data.map(r => String(r.tramo || '0')).filter(v => v !== null))].sort((a, b) => a - b);
            const anios = [...new Set(state.cartera.data.map(r => String(r._saleYear || '')).filter(Boolean))].sort();
            const meses = [...new Set(state.cartera.data.map(r => String(r._saleMonthNum || '')).filter(Boolean))].sort((a, b) => a - b);
            const fechasGest = [...new Set(state.cartera.data.map(r => r._feNorm).filter(Boolean))].sort((a, b) => {
                const [m1, y1] = a.split('/'); const [m2, y2] = b.split('/');
                return new Date(y1, m1 - 1) - new Date(y2, m2 - 1);
            });
            const viasPagoReal = [...new Set(state.cobranzas.data.map(r => String(r.VP || 'S/D')).filter(Boolean))].sort();
            const viasCobroInt = ['COBRADOR', 'DEBITO'];

            setupFilter('co-un', uns, 'cosecha');
            setupFilter('co-tramo', tramos, 'cosecha');
            setupFilter('co-anio', anios, 'cosecha');
            setupFilter('co-mes', meses, 'cosecha');
            setupFilter('co-fecha-gest', fechasGest, 'cosecha');
            setupFilter('co-via-cobro', viasCobroInt, 'cosecha');
            setupFilter('co-via-pago', viasPagoReal, 'cosecha');
            setupFilter('co-cat', ['VIGENTE', 'MOROSO'], 'cosecha');

            document.getElementById('reset-co').onclick = async () => {
                resetFilters('cosecha');
                await calculateCosecha();
            };
            state.cosecha.filtersInitialized = true;
        }

        const selUn = getSelected('co-un');
        const selTramo = getSelected('co-tramo');
        const selAnio = getSelected('co-anio');
        const selMes = getSelected('co-mes');
        const selFechaGest = getSelected('co-fecha-gest');
        const selViaCobroInt = getSelected('co-via-cobro');
        const selViaPagoReal = getSelected('co-via-pago');
        const selCat = getSelected('co-cat');

        const trend = {}; // saleMonth -> { b, p, cBase, cPaid }

        // 3. Iterate cartera rows and apply cohort rule
        const cartData = state.cartera.data;
        for (let i = 0; i < cartData.length; i++) {
            const r = cartData[i];
            if (!r._cId || !r._saleMonth) continue;

            const unVal = String(r.UN || 'S/D');
            const trVal = String(r.tramo || '0');
            const trNum = parseInt(trVal) || 0;
            const catVal = (trNum <= 3) ? 'VIGENTE' : 'MOROSO';

            const rawVia = String(r.via_de_cobro || '').trim().toUpperCase();
            const viaCInt = (rawVia === 'COBRADOR' || rawVia === 'COB') ? 'COBRADOR' : 'DEBITO';

            if ((selUn.size === 0 || selUn.has(unVal)) &&
                (selTramo.size === 0 || selTramo.has(trVal)) &&
                (selCat.size === 0 || selCat.has(catVal)) &&
                (selViaCobroInt.size === 0 || selViaCobroInt.has(viaCInt)) &&
                (selAnio.size === 0 || selAnio.has(String(r._saleYear || ''))) &&
                (selMes.size === 0 || selMes.has(String(r._saleMonthNum || ''))) &&
                (selFechaGest.size === 0 || selFechaGest.has(r._feNorm))) {

                let cobMonth = '';
                if (selFechaGest.size > 0) {
                    if (!r._feNorm || !selFechaGest.has(r._feNorm)) continue;
                    cobMonth = r._feNorm;
                } else {
                    cobMonth = addMonths(r._saleMonth, 1);
                    if (!cobMonth) continue;
                    if (r._feNorm && r._feNorm !== cobMonth) continue;
                }

                const key = `${r._cId}_${cobMonth}`;
                const cob = cobAggr[key] || { total: 0, byVia: {} };

                let paid = 0;
                if (selViaPagoReal.size === 0) {
                    paid = cob.total;
                } else {
                    for (const v in cob.byVia) {
                        if (selViaPagoReal.has(v)) paid += cob.byVia[v];
                    }
                }

                const base = (parseFloat(r.monto_cuota) || 0) + (parseFloat(r.monto_vencido) || 0);
                totalBase += base;
                totalPaid += paid;
                totalBaseCount += 1;
                if (paid > 0) totalPaidCount += 1;

                if (!trend[r._saleMonth]) trend[r._saleMonth] = { b: 0, p: 0, cBase: 0, cPaid: 0 };
                trend[r._saleMonth].b += base;
                trend[r._saleMonth].p += paid;
                trend[r._saleMonth].cBase += 1;
                if (paid > 0) trend[r._saleMonth].cPaid += 1;
            }

            if (i % 25000 === 0) {
                progressText.textContent = `Cosecha: procesando cartera ${i.toLocaleString()}...`;
                await new Promise(r => setTimeout(r, 0));
            }
        }

        updateCosechaUI({ totalBase, totalPaid, totalBaseCount, totalPaidCount, trend });
    }

    // --- GESTORES DASHBOARD LOGIC ---
    async function calculateGestoresDashboard() {
        if (!state.cartera.data.length || !state.gestores.data.length) return;

        console.log("Gestores: Iniciando calculo de productividad...");
        loading.classList.remove('hidden');
        progressText.textContent = "Analizando productividad por gestor...";
        await new Promise(r => setTimeout(r, 50));

        // 1. Initial Setup for Filters
        if (!state.gestores.filtersInitialized) {
            const gestores = [...new Set(state.gestores.data.map(r => String(r.Gestor || 'S/D')).filter(Boolean))].sort();
            const uns = [...new Set(state.cartera.data.map(r => String(r.UN || 'S/D')).filter(Boolean))].sort();
            const fechas = [...new Set(state.cartera.data.map(r => r._feNorm).filter(Boolean))].sort((a, b) => {
                const [m1, y1] = a.split('/'); const [m2, y2] = b.split('/');
                return new Date(y1, m1 - 1) - new Date(y2, m2 - 1);
            });

            setupFilter('gs-gestor', gestores, 'gestores');
            setupFilter('gs-un', uns, 'gestores');
            setupFilter('gs-fecha', fechas, 'gestores');

            document.getElementById('reset-gs').onclick = async () => {
                resetFilters('gestores');
                await calculateGestoresDashboard();
            };
            state.gestores.filtersInitialized = true;
        }

        const selGestor = getSelected('gs-gestor');
        const selUn = getSelected('gs-un');
        const selFecha = getSelected('gs-fecha');

        // 2. Build Maps
        // Cartera Map for quick debt lookup: {contract_id_FECHA: debtStats}
        const cartMap = {};
        state.cartera.data.forEach(r => {
            const key = `${r._cId}_${r._feNorm}`;
            if (!cartMap[key]) cartMap[key] = { debt: 0, un: r.UN, tramo: r.tramo, viaC: r.via_de_cobro };
            cartMap[key].debt += (parseFloat(r.monto_cuota) || 0) + (parseFloat(r.monto_vencido) || 0);
        });

        // CobAggr is already global or semi-global if calculatePerformance ran.
        // If not, we might need a local one. For safety, let's rebuild or reuse logic.
        const cobAggr = {};
        state.cobranzas.data.forEach(r => {
            if (r._cId && r._feNorm) {
                const key = `${r._cId}_${r._feNorm}`;
                cobAggr[key] = (cobAggr[key] || 0) + (parseFloat(r.monto) || 0);
            }
        });

        // 3. Process Gestores Assignments
        const stats = {
            totalContracts: 0, totalDebt: 0, totalPaid: 0, hits: 0,
            tramoDist: {}, viaDist: {}, gestorStats: {}
        };

        const gData = state.gestores.data;
        for (let i = 0; i < gData.length; i++) {
            const r = gData[i];
            if (!r._cId || !r._feNorm) continue;
            const key = `${r._cId}_${r._feNorm}`;

            const gName = String(r.Gestor || 'S/D');
            const cInfo = cartMap[key];
            if (!cInfo) continue; // Assigned but not in portfolio

            // Filter
            if (selGestor.size > 0 && !selGestor.has(gName)) continue;
            if (selUn.size > 0 && !selUn.has(String(cInfo.un))) continue;
            if (selFecha.size > 0 && !selFecha.has(r._feNorm)) continue;

            const debt = cInfo.debt;
            const paid = cobAggr[key] || 0;
            const tramo = String(cInfo.tramo || '0');
            const via = String(cInfo.viaC || 'DEBITO').trim().toUpperCase() === 'COBRADOR' ? 'COBRADOR' : 'DEBITO';

            stats.totalContracts++;
            stats.totalDebt += debt;
            stats.totalPaid += paid;
            if (paid > 0) stats.hits++;

            stats.tramoDist[tramo] = (stats.tramoDist[tramo] || 0) + 1;
            stats.viaDist[via] = (stats.viaDist[via] || 0) + 1;

            if (!stats.gestorStats[gName]) stats.gestorStats[gName] = { c: 0, h: 0, d: 0, p: 0 };
            stats.gestorStats[gName].c++;
            if (paid > 0) stats.gestorStats[gName].h++;
            stats.gestorStats[gName].d += debt;
            stats.gestorStats[gName].p += paid;

            if (i % 20000 === 0) {
                progressText.textContent = `Calculando gestores: ${i.toLocaleString()} / ${gData.length.toLocaleString()}...`;
                await new Promise(r => setTimeout(r, 0));
            }
        }

        updateGestoresUI(stats);
        loading.classList.add('hidden');
    }

    function updateGestoresUI(stats) {
        document.getElementById('gs-total-contracts').textContent = stats.totalContracts.toLocaleString();
        document.getElementById('gs-total-debt').textContent = formatPYG(stats.totalDebt);
        document.getElementById('gs-total-paid').textContent = formatPYG(stats.totalPaid);

        const coverage = stats.totalContracts > 0 ? (stats.hits / stats.totalContracts) * 100 : 0;
        document.getElementById('gs-coverage-rate').textContent = coverage.toFixed(1) + '%';
        document.getElementById('gs-coverage-detail').textContent = `${stats.hits.toLocaleString()} de ${stats.totalContracts.toLocaleString()} contratos`;

        const efficiency = stats.totalDebt > 0 ? (stats.totalPaid / stats.totalDebt) * 100 : 0;
        document.getElementById('gs-recovery-rate').textContent = efficiency.toFixed(1) + '%';

        // Distribution Charts
        renderChart('gsTramoChart', 'gestores', 'doughnut', Object.keys(stats.tramoDist).map(t => 'Tramo ' + t), Object.values(stats.tramoDist));
        renderChart('gsViaChart', 'gestores', 'bar', Object.keys(stats.viaDist), Object.values(stats.viaDist), 'Contratos', '#3b82f6');

        // Detailed Per-Gestor Charts
        const gLabels = Object.keys(stats.gestorStats).sort();

        // Coverage (Assigned vs Hits)
        const gAssigned = gLabels.map(g => stats.gestorStats[g].c);
        const gHits = gLabels.map(g => stats.gestorStats[g].h);

        const coverageChartCtx = document.getElementById('gsCoverageChart');
        if (state.gestores.charts['gsCoverageChart']) state.gestores.charts['gsCoverageChart'].destroy();
        state.gestores.charts['gsCoverageChart'] = new Chart(coverageChartCtx, {
            type: 'bar',
            data: {
                labels: gLabels,
                datasets: [
                    { label: 'Asignados', data: gAssigned, backgroundColor: '#475569' },
                    { label: 'Cobrados (Hits)', data: gHits, backgroundColor: '#10b981' }
                ]
            },
            options: { responsive: true, scales: { y: { beginAtZero: true } } }
        });

        // Efficiency (Paid vs Debt)
        const gDebt = gLabels.map(g => stats.gestorStats[g].d);
        const gPaid = gLabels.map(g => stats.gestorStats[g].p);

        const efficiencyChartCtx = document.getElementById('gsEfficiencyChart');
        if (state.gestores.charts['gsEfficiencyChart']) state.gestores.charts['gsEfficiencyChart'].destroy();
        state.gestores.charts['gsEfficiencyChart'] = new Chart(efficiencyChartCtx, {
            type: 'bar',
            data: {
                labels: gLabels,
                datasets: [
                    { label: 'Monto Asignado', data: gDebt, backgroundColor: '#334155' },
                    { label: 'Monto Cobrado', data: gPaid, backgroundColor: '#38bdf8' }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: v => (v / 1e6).toFixed(0) + 'M' }
                    }
                }
            }
        });
    }

    function updatePerformanceUI(stats) {
        const { totalDebt, totalPaid, totalContracts, totalContractsPaid, tramoStats, unStats, viaCStats, gestorStats, matrixStats, trendStats } = stats;

        const globalRate = totalDebt > 0 ? (totalPaid / totalDebt) : 0;
        const globalCountRate = totalContracts > 0 ? (totalContractsPaid / totalContracts) : 0;

        document.getElementById('perf-recovery-rate').textContent = (globalRate * 100).toFixed(1) + '%';
        document.getElementById('perf-total-contracts').textContent = totalContracts.toLocaleString();
        document.getElementById('perf-total-debt').textContent = formatPYG(totalDebt);
        document.getElementById('perf-total-contracts-paid').textContent = totalContractsPaid.toLocaleString();
        document.getElementById('perf-total-paid').textContent = formatPYG(totalPaid);

        // Performance Trend Chart
        const sortedMonths = Object.keys(trendStats).sort((a, b) => {
            const [m1, y1] = a.split('/'); const [m2, y2] = b.split('/');
            return new Date(y1, m1 - 1) - new Date(y2, m2 - 1);
        });
        const trendData = sortedMonths.map(m => (trendStats[m].d > 0 ? (trendStats[m].p / trendStats[m].d) * 100 : 0));
        renderChart('perfTrendChart', 'rendimiento', 'line', sortedMonths, trendData, '% Eficacia', '#38bdf8');

        // Performance Trend by Count
        const trendCountData = sortedMonths.map(m => (trendStats[m].c > 0 ? (trendStats[m].cp / trendStats[m].c) * 100 : 0));
        renderChart('perfTrendCountChart', 'rendimiento', 'line', sortedMonths, trendCountData, '% Eficacia (Cantidad)', '#f59e0b');

        // Charts per Tramo
        const tramoLabels = Object.keys(tramoStats).sort((a, b) => a - b);
        const tramoEff = tramoLabels.map(t => (tramoStats[t].d > 0 ? (tramoStats[t].p / tramoStats[t].d) * 100 : 0));
        renderChart('perfTramoChart', 'rendimiento', 'bar', tramoLabels.map(t => 'Tramo ' + t), tramoEff, '% Eficacia', '#818cf8');

        // Charts per UN
        const unLabels = Object.keys(unStats).sort();
        const unEff = unLabels.map(u => (unStats[u].d > 0 ? (unStats[u].p / unStats[u].d) * 100 : 0));
        renderChart('perfUnChart', 'rendimiento', 'bar', unLabels, unEff, '% Eficacia', '#6366f1');

        // NEW: Charts per Via de Cobro (Intencion)
        const vcLabels = Object.keys(viaCStats).sort();
        const vcEff = vcLabels.map(v => (viaCStats[v].d > 0 ? (viaCStats[v].p / viaCStats[v].d) * 100 : 0));
        renderChart('perfViaCobroChart', 'rendimiento', 'bar', vcLabels, vcEff, '% Eficacia (Intencion)', '#10b981');

        // NEW: Matrix Chart (Stacked Bar)
        const allActualVias = [...new Set(Object.values(matrixStats).flatMap(o => Object.keys(o)))].sort();

        const matrixDatasets = allActualVias.map((vAct, idx) => {
            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
            return {
                label: vAct,
                data: vcLabels.map(vc => matrixStats[vc][vAct] || 0),
                backgroundColor: colors[idx % colors.length]
            };
        });

        const matrixEl = document.getElementById('perfViaMatrixChart');
        if (matrixEl) {
            const matrixCtx = matrixEl.getContext('2d');
            if (state.rendimiento.charts['perfViaMatrixChart']) state.rendimiento.charts['perfViaMatrixChart'].destroy();
            state.rendimiento.charts['perfViaMatrixChart'] = new Chart(matrixCtx, {
                type: 'bar',
                data: { labels: vcLabels, datasets: matrixDatasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: v => formatPYG(v) } } },
                    plugins: {
                        tooltip: { callbacks: { label: c => `${c.dataset.label}: ${formatPYG(c.raw)}` } },
                        legend: { position: 'bottom', labels: { color: '#e2e8f0', font: { family: 'Outfit' } } }
                    }
                }
            });
        }
    }

    function updateCosechaUI(stats) {
        const { totalBase, totalPaid, totalBaseCount, totalPaidCount, trend } = stats;
        const rate = totalBase > 0 ? (totalPaid / totalBase) * 100 : 0;

        document.getElementById('co-recovery-rate').textContent = rate.toFixed(1) + '%';
        document.getElementById('co-total-base-count').textContent = totalBaseCount.toLocaleString();
        document.getElementById('co-total-base').textContent = formatPYG(totalBase);
        document.getElementById('co-total-paid-count').textContent = totalPaidCount.toLocaleString();
        document.getElementById('co-total-paid').textContent = formatPYG(totalPaid);

        const sortedMonths = Object.keys(trend).sort((a, b) => {
            const [m1, y1] = a.split('/'); const [m2, y2] = b.split('/');
            return new Date(y1, m1 - 1) - new Date(y2, m2 - 1);
        });
        const data = sortedMonths.map(m => (trend[m].b > 0 ? (trend[m].p / trend[m].b) * 100 : 0));
        renderChart('coRecoveryChart', 'cosecha', 'line', sortedMonths, data, '% Recuperacion', '#f59e0b');

        const dataCount = sortedMonths.map(m => (trend[m].cBase > 0 ? (trend[m].cPaid / trend[m].cBase) * 100 : 0));
        renderChart('coRecoveryCountChart', 'cosecha', 'line', sortedMonths, dataCount, '% Recuperacion (Cantidad)', '#22c55e');

        const rows = sortedMonths.map(m => ({
            month: m,
            base: trend[m].b,
            paid: trend[m].p,
            cBase: trend[m].cBase || 0,
            cPaid: trend[m].cPaid || 0,
            rate: trend[m].b > 0 ? (trend[m].p / trend[m].b) * 100 : 0
        }));
        renderCosechaTable(rows);
    }

    function renderCosechaTable(rows) {
        const tbody = document.getElementById('co-table-body');
        tbody.innerHTML = '';
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${r.month}</td>
                <td>${r.cBase.toLocaleString()}</td>
                <td>${formatPYG(r.base)}</td>
                <td>${r.cPaid.toLocaleString()}</td>
                <td>${formatPYG(r.paid)}</td>
                <td>${r.rate.toFixed(1)}%</td>
            `;
            tbody.appendChild(tr);
        }
    }

    function updateLtvUI(stats) {
        document.getElementById('ltv-total-contracts').textContent = stats.totalContracts.toLocaleString();
        document.getElementById('ltv-total-cobrar').textContent = formatPYG(stats.totalCobrar);
        document.getElementById('ltv-mora').textContent = stats.mora.toLocaleString();
        document.getElementById('ltv-total-cobrado').textContent = formatPYG(stats.totalCobrado);
        document.getElementById('ltv-financial-value').textContent = stats.ltvScore.toFixed(2);
        document.getElementById('ltv-financial-detail').textContent =
            `%Pago: ${(stats.ratioPago * 100).toFixed(1)}% | Cobrado: ${formatPYG(stats.sumCobrado)} | Deberia: ${formatPYG(stats.sumDeberia)} | Meses: ${stats.mesesPonderados.toFixed(2)} | Corte: ${stats.ltvCutoff}`;

        const tbody = document.getElementById('ltv-status-table-body');
        tbody.innerHTML = '';
        const months = Object.keys(stats.byGestion).sort((a, b) => {
            const [m1, y1] = a.split('/'); const [m2, y2] = b.split('/');
            return new Date(y1, m1 - 1) - new Date(y2, m2 - 1);
        });
        months.forEach(gestion => {
            const row = stats.byGestion[gestion];
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${gestion}</td>
                <td>${row.vigente.toLocaleString()}</td>
                <td>${row.mora.toLocaleString()}</td>
                <td>${row.culminado.toLocaleString()}</td>
                <td>${formatPYG(row.cobrar)}</td>
                <td>${formatPYG(row.cobrado)}</td>
                <td>${(row.ltv || 0).toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // --- SHARED UTILS ---
    function setupFilter(id, options, tab) {
        const container = document.getElementById(`${id}-options`);
        const allCb = document.getElementById(`${id}-all`);
        const countSpan = document.getElementById(`${id}-count`);
        container.innerHTML = '';

        options.forEach(opt => {
            const label = document.createElement('label');
            let text = opt;
            if (id === 'tramo') text = 'Tramo ' + opt;
            if (id === 'mes') text = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][opt - 1] || opt;
            label.innerHTML = `<input type="checkbox" class="${id}-cb" value="${opt}" checked> ${text}`;
            container.appendChild(label);
        });

        const cbs = container.querySelectorAll('input');
        const update = async () => {
            const checked = container.querySelectorAll('input:checked');
            let labelText = 'Todas';
            if (id.includes('anio') || id.includes('tramo') || id.includes('mes') || id.includes('dia')) labelText = 'Todos';
            if (id.includes('fecha') || id.includes('gestion')) labelText = 'Historia';

            countSpan.textContent = checked.length === options.length ? labelText : `${checked.length} sel.`;
            allCb.checked = checked.length === options.length;

            if (tab === 'cartera') applyCarteraFilters();
            else if (tab === 'cobranzas') applyCobranzasFilters();
            else if (tab === 'rendimiento') await calculatePerformance();
            else if (tab === 'ltv') await calculateLtv();
            else if (tab === 'cosecha') await calculateCosecha();
            else if (tab === 'gestores') await calculateGestoresDashboard();
        };

        allCb.addEventListener('change', () => {
            container.querySelectorAll('input').forEach(c => c.checked = allCb.checked);
            update();
        });

        container.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') update();
        });
    }

    function getSelected(id) {
        return new Set([...document.querySelectorAll(`.${id}-cb:checked`)].map(c => String(c.value)));
    }

    function resetFilters(tab) {
        let sel = '#cartera-content';
        if (tab === 'cobranzas') sel = '#cobranzas-content';
        if (tab === 'rendimiento') sel = '#rendimiento-content';
        if (tab === 'ltv') sel = '#ltv-content';
        if (tab === 'cosecha') sel = '#cosecha-content';
        if (tab === 'gestores') sel = '#gestores-content';

        document.querySelectorAll(`${sel} input[type="checkbox"]`).forEach(c => c.checked = true);
        document.querySelectorAll(`${sel} [id$="-count"]`).forEach(s => s.textContent = (s.id.includes('fecha') || s.id.includes('anio') || s.id.includes('gestion')) ? 'Historia' : (tab === 'cartera' ? 'Todas' : 'Todos'));
    }

    function renderChart(canvasId, tab, type, labels, data, label = '', color) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn(`Canvas not found: ${canvasId}`);
            return;
        }
        const ctx = canvas.getContext('2d');
        if (state[tab].charts[canvasId]) state[tab].charts[canvasId].destroy();
        state[tab].charts[canvasId] = new Chart(ctx, {
            type: type,
            data: {
                labels: labels,
                datasets: [{
                    label: label, data: data,
                    backgroundColor: type === 'doughnut' ? ['#38bdf8', '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185', '#94a3b8'] : color,
                    borderColor: type === 'line' ? color : 'transparent', tension: 0.3, borderRadius: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                layout: { padding: { bottom: 10 } }, // Internal padding for labels
                plugins: { legend: { position: type === 'doughnut' ? 'right' : 'top', labels: { color: '#94a3b8', font: { family: 'Outfit' } } } },
                scales: type !== 'doughnut' ? {
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', font: { family: 'Outfit' } } },
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: '#94a3b8',
                            font: { family: 'Outfit', size: 10 },
                            maxRotation: 45,
                            minRotation: 0,
                            autoSkip: false // Force showing all days/months
                        }
                    }
                } : {}
            }
        });
    }

    function formatPYG(num) { return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(num); }

    // Helper to normalize dates (1/2026 -> 01/2026)
    function normD(s) {
        const val = String(s || '').trim();
        if (!val.includes('/')) return val;
        const p = val.replace(/[^0-9/]/g, '').split('/');
        if (p.length < 2) return val;
        return p[0].padStart(2, '0') + '/' + p[1];
    };

    function monthFromDate(dateStr) {
        const val = String(dateStr || '').trim();
        if (!val) return '';

        // MM/YYYY
        if (/^\d{1,2}\/\d{4}$/.test(val)) return normD(val);

        // YYYY-MM-DD or YYYY/MM/DD
        let m = val.match(/^(\d{4})[-/](\d{1,2})[-/]\d{1,2}/);
        if (m) return String(m[2]).padStart(2, '0') + '/' + m[1];

        // DD/MM/YYYY or DD-MM-YYYY
        m = val.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
        if (m) return String(m[2]).padStart(2, '0') + '/' + m[3];

        return '';
    }

    function addMonths(mmYYYY, n) {
        const val = String(mmYYYY || '').trim();
        if (!val.includes('/')) return '';
        const parts = val.split('/');
        if (parts.length < 2) return '';
        let m = parseInt(parts[0], 10);
        let y = parseInt(parts[1], 10);
        if (Number.isNaN(m) || Number.isNaN(y)) return '';

        m += n;
        y += Math.floor((m - 1) / 12);
        m = ((m - 1) % 12 + 12) % 12 + 1;
        return String(m).padStart(2, '0') + '/' + String(y);
    }

    function monthsBetweenDateAndMonth(dateYYYYMMDD, mmYYYY) {
        const dateVal = String(dateYYYYMMDD || '').trim();
        const monthVal = String(mmYYYY || '').trim();

        const d = dateVal.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        const m = monthVal.match(/^(\d{1,2})\/(\d{4})$/);
        if (!d || !m) return 0;

        const contractYear = parseInt(d[1], 10);
        const contractMonth = parseInt(d[2], 10);
        const gestionMonth = parseInt(m[1], 10);
        const gestionYear = parseInt(m[2], 10);
        if ([contractYear, contractMonth, gestionMonth, gestionYear].some(Number.isNaN)) return 0;

        let diff = (gestionYear - contractYear) * 12 + (gestionMonth - contractMonth);
        if (diff < 0) diff = 0;
        return diff === 0 ? 1 : diff;
    }

    function normalizeViaCobro(viaCobro) {
        const rawVia = String(viaCobro || '').trim().toUpperCase();
        return (rawVia === 'COBRADOR' || rawVia === 'COB') ? 'COBRADOR' : 'DEBITO';
    }

    function monthToSerial(mmYYYY) {
        const val = String(mmYYYY || '').trim();
        const m = val.match(/^(\d{1,2})\/(\d{4})$/);
        if (!m) return -1;
        const month = parseInt(m[1], 10);
        const year = parseInt(m[2], 10);
        if (Number.isNaN(month) || Number.isNaN(year)) return -1;
        return year * 12 + month;
    }
    // --- CONFIG & BACKEND LOGIC ---
    async function runExport(type) {
        addLog(`Iniciando generacion de ${type} desde SQL...`, 'system');
        let btnId = 'btn-gen-cartera';
        if (type === 'cobranzas') btnId = 'btn-gen-cob';
        if (type === 'gestores') btnId = 'btn-gen-gestores';
        if (type === 'contratos') btnId = 'btn-gen-contratos';

        const btn = document.getElementById(btnId);
        btn.disabled = true;

        try {
            const res = await fetch(`/api/run-export?type=${type}`);
            const data = await res.json();
            if (data.success) {
                addLog(`Exportacion de ${type} terminada con exito.`, 'success');
            } else {
                addLog(`Error en exportacion: ${data.message}`, 'error');
            }
        } catch (err) {
            addLog(`Error de conexion con el servidor local.`, 'error');
        } finally {
            btn.disabled = false;
        }
    }

    async function syncLocalFiles() {
        loading.classList.remove('hidden');
        progressText.textContent = 'Sincronizando archivos locales...';
        addLog('Iniciando sincronizacion de archivos locales...', 'system');

        try {
            const check = await fetch('/api/check-files');
            const files = await check.json();

            if (files.cartera) {
                await fetchAndProcess('cartera.csv', 'cartera');
            } else {
                addLog('cartera.csv no encontrado en el servidor.', 'error');
            }

            if (files.cobranzas) {
                await fetchAndProcess('cobranzas_prepagas.csv', 'cobranzas');
            } else {
                addLog('cobranzas_prepagas.csv no encontrado.', 'error');
            }

            if (files.gestores) {
                await fetchAndProcess('gestores.csv', 'gestores');
            } else {
                addLog('gestores.csv no encontrado.', 'error');
            }

            if (files.contratos) {
                await fetchAndProcess('contratos.csv', 'contratos');
                addLog(`contratos.csv cargado (${state.contratos.data.length.toLocaleString()} filas).`, 'success');
            } else {
                addLog('contratos.csv no encontrado.', 'error');
            }

            const wasOnStart = tabsNav.classList.contains('hidden');
            loading.classList.add('hidden');

            if (wasOnStart && (files.cartera || files.cobranzas || files.gestores || files.contratos)) {
                tabsNav.classList.remove('hidden');
                dropZone.classList.add('hidden');
                switchTab(files.cartera ? 'cartera' : (files.cobranzas ? 'cobranzas' : (files.contratos ? 'ltv' : 'gestores')));
            }

            addLog('Sincronizacion completada.', 'success');
        } catch (err) {
            addLog(`Error al sincronizar: ${err.message}`, 'error');
            loading.classList.add('hidden');
        }
    }

    async function fetchAndProcess(filename, type) {
        const res = await fetch(filename);
        if (!res.ok) throw new Error(`No se pudo cargar ${filename}`);
        const blob = await res.blob();
        const file = new File([blob], filename);
        await processFile(file, type);
    }

    function addLog(msg, school) {
        const logs = document.getElementById('config-logs');
        const entry = document.createElement('div');
        entry.className = `log-entry ${school}`;
        const time = new Date().toLocaleTimeString();
        entry.textContent = `[${time}] ${msg}`;
        logs.appendChild(entry);
        logs.scrollTop = logs.scrollHeight;
    }

    window.runExport = runExport;
    window.syncLocalFiles = syncLocalFiles;

    // Initial check for bypass/manual-sync choice
    fetch('/api/check-files')
        .then(res => res.json())
        .then(files => {
            if (files.cartera || files.cobranzas || files.gestores || files.contratos) {
                const hint = document.createElement('div');
                hint.className = 'drop-hint';
                hint.style.marginTop = '1.5rem';
                hint.innerHTML = `
                    <p style="margin-bottom:0.5rem">Se detectaron archivos en el servidor.</p>
                    <div style="display:flex; gap:1rem; justify-content:center">
                        <button onclick="syncLocalFiles()" class="btn-secondary" style="font-size:0.8rem">Sincronizar archivos locales</button>
                        <button onclick="enterConfig()" class="btn-secondary" style="font-size:0.8rem">Configuracion</button>
                    </div>
                `;
                dropZone.appendChild(hint);
            }
        }).catch(() => { });

    window.enterConfig = () => {
        tabsNav.classList.remove('hidden');
        dropZone.classList.add('hidden');
        switchTab('config');
    };

    window.toggleDropdown = (id) => {
        const d = document.getElementById(id); const hide = !d.classList.contains('hidden');
        document.querySelectorAll('.dropdown-content').forEach(el => el.classList.add('hidden'));
        if (!hide) d.classList.remove('hidden');
    };

    window.clearAllData = async () => {
        if (!confirm('Seguro que deseas borrar toda la memoria del navegador y reiniciar?')) return;
        const db = await openDB();
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).clear();
        tx.oncomplete = () => window.location.reload();
    };

    window.onclick = (e) => { if (!e.target.closest('.multi-select')) document.querySelectorAll('.dropdown-content').forEach(d => d.classList.add('hidden')); };
});

