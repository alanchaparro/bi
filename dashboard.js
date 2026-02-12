// Dashboard Logic with IndexedDB Persistence
document.addEventListener('DOMContentLoaded', async () => {
    const fileInput = document.getElementById('file-input');
    const dropZone = document.getElementById('drop-zone');
    const loading = document.getElementById('loading');
    const progressText = document.getElementById('progress-text');
    const tabsNav = document.getElementById('tabs-nav');
    const menuToggle = document.getElementById('menu-toggle');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const btnProceed = document.getElementById('btn-proceed');
    const normalizeUtils = window.DashboardNormalize || {};
    const dataValidator = window.DataValidator || {};
    const uiNotify = window.UINotifications || {};
    const analyticsApi = window.AnalyticsApiClient || null;
    const featureFlags = window.FeatureFlags || {};
    const tabModules = window.TabModules || {};
    const ANALYTICS_MODE_KEY = 'use_analytics_api';
    const SYNC_MODE_KEY = 'sync_mode';
    const ACA_CHART_LABELS_KEY = 'aca_chart_labels_enabled';
    const PERF_CHART_LABELS_KEY = 'perf_chart_labels_enabled';
    const analyticsToggle = document.getElementById('analytics-api-toggle');
    const analyticsModeStatus = document.getElementById('analytics-mode-status');
    const syncModeSelect = document.getElementById('sync-mode-select');
    const syncModeStatus = document.getElementById('sync-mode-status');
    const exportAcaPdfBtn = document.getElementById('export-aca-pdf');
    const acaLabelsToggle = document.getElementById('aca-labels-toggle');
    const acaLabelsStatus = document.getElementById('aca-labels-status');
    const perfLabelsToggle = document.getElementById('perf-labels-toggle');
    const perfLabelsStatus = document.getElementById('perf-labels-status');
    let useAnalyticsApi = true;
    let syncMode = 'fast';
    let showAcaChartLabels = true;
    let showPerfChartLabels = true;
    const enableMovementSeriesV2 = featureFlags.FF_MOVEMENT_SERIES_V2 !== false;
    const enableLineLabelSmartLayout = featureFlags.FF_LINE_LABELS_SMART_LAYOUT !== false;
    const useApiAnalisisCartera = featureFlags.FF_API_ANALISIS_CARTERA !== false;
    const useApiMovimiento = featureFlags.FF_API_MOVIMIENTO !== false;
    const useApiRendimiento = featureFlags.FF_API_RENDIMIENTO !== false;
    const debugMode = featureFlags.DEBUG_MODE === true;

    function readAnalyticsModePreference() {
        if (window.USE_ANALYTICS_API !== undefined) return !!window.USE_ANALYTICS_API;
        try {
            const raw = localStorage.getItem(ANALYTICS_MODE_KEY);
            if (raw === null) return true;
            return raw === 'true';
        } catch (e) {
            return true;
        }
    }

    function persistAnalyticsModePreference(enabled) {
        try {
            localStorage.setItem(ANALYTICS_MODE_KEY, enabled ? 'true' : 'false');
        } catch (e) {
            // Ignore localStorage write issues and keep runtime state.
        }
    }

    function updateAnalyticsModeUI() {
        if (analyticsToggle) analyticsToggle.checked = !!useAnalyticsApi;
        if (analyticsModeStatus) {
            if (useAnalyticsApi) {
                analyticsModeStatus.textContent = analyticsApi
                    ? 'Estado: API habilitada'
                    : 'Estado: API habilitada, pero cliente API no está disponible.';
            } else {
                analyticsModeStatus.textContent = 'Estado: fallback local habilitado';
            }
        }
    }

    function setAnalyticsMode(enabled, opts = {}) {
        const shouldNotify = opts.notify !== false;
        const shouldRefresh = opts.refreshTab !== false;
        useAnalyticsApi = !!enabled;
        window.USE_ANALYTICS_API = useAnalyticsApi;
        persistAnalyticsModePreference(useAnalyticsApi);
        updateAnalyticsModeUI();
        if (shouldNotify) {
            showInfo(useAnalyticsApi ? 'Modo analítico: API habilitada.' : 'Modo analítico: fallback local habilitado.');
        }
        if (shouldRefresh && uiState.activeTab && uiState.activeTab !== 'config') {
            switchTab(uiState.activeTab);
        }
    }

    function readSyncModePreference() {
        try {
            const raw = localStorage.getItem(SYNC_MODE_KEY);
            return raw === 'full' ? 'full' : 'fast';
        } catch (e) {
            return 'fast';
        }
    }

    function persistSyncModePreference(mode) {
        try {
            localStorage.setItem(SYNC_MODE_KEY, mode === 'full' ? 'full' : 'fast');
        } catch (e) {
            // Ignore localStorage write issues and keep runtime state.
        }
    }

    function updateSyncModeUI() {
        const mode = syncMode === 'full' ? 'full' : 'fast';
        if (syncModeSelect) syncModeSelect.value = mode;
        if (syncModeStatus) {
            syncModeStatus.textContent = mode === 'full'
                ? 'Estado: sincronización completa (raw + analytics)'
                : 'Estado: sincronización rápida (analytics)';
        }
    }

    function setSyncMode(mode, opts = {}) {
        const shouldNotify = opts.notify !== false;
        syncMode = mode === 'full' ? 'full' : 'fast';
        persistSyncModePreference(syncMode);
        updateSyncModeUI();
        if (shouldNotify) {
            showInfo(syncMode === 'full'
                ? 'Modo de sincronización: completa (raw + analytics).'
                : 'Modo de sincronización: rápida (analytics).');
        }
    }

    function readAcaChartLabelsPreference() {
        try {
            const raw = localStorage.getItem(ACA_CHART_LABELS_KEY);
            if (raw === null) return true;
            return raw === 'true';
        } catch (e) {
            return true;
        }
    }

    function persistAcaChartLabelsPreference(enabled) {
        try {
            localStorage.setItem(ACA_CHART_LABELS_KEY, enabled ? 'true' : 'false');
        } catch (e) {
            // Ignore localStorage write issues and keep runtime state.
        }
    }

    function updateAcaChartLabelsUI() {
        if (acaLabelsToggle) acaLabelsToggle.checked = !!showAcaChartLabels;
        if (acaLabelsStatus) {
            acaLabelsStatus.textContent = showAcaChartLabels ? 'Estado: visibles' : 'Estado: ocultas';
        }
    }

    function setAcaChartLabelsMode(enabled, opts = {}) {
        const shouldNotify = opts.notify !== false;
        const shouldRefresh = opts.refreshTab !== false;
        showAcaChartLabels = !!enabled;
        persistAcaChartLabelsPreference(showAcaChartLabels);
        updateAcaChartLabelsUI();
        if (shouldNotify) {
            showInfo(showAcaChartLabels
                ? 'Etiquetas de graficos activadas.'
                : 'Etiquetas de graficos ocultas.');
        }
        if (shouldRefresh && uiState.activeTab === 'analisisCartera' && state && state.analisisCartera) {
            state.analisisCartera.lastComputeSignature = '';
            applyTabFilters('analisisCartera').catch((e) => showError('No se pudo refrescar Analisis Cartera.', e));
        }
    }

    function readPerfChartLabelsPreference() {
        try {
            const raw = localStorage.getItem(PERF_CHART_LABELS_KEY);
            if (raw === null) return true;
            return raw === 'true';
        } catch (e) {
            return true;
        }
    }

    function persistPerfChartLabelsPreference(enabled) {
        try {
            localStorage.setItem(PERF_CHART_LABELS_KEY, enabled ? 'true' : 'false');
        } catch (e) {
            // Ignore localStorage write issues and keep runtime state.
        }
    }

    function updatePerfChartLabelsUI() {
        if (perfLabelsToggle) perfLabelsToggle.checked = !!showPerfChartLabels;
        if (perfLabelsStatus) {
            perfLabelsStatus.textContent = showPerfChartLabels ? 'Estado: visibles' : 'Estado: ocultas';
        }
    }

    function setPerfChartLabelsMode(enabled, opts = {}) {
        const shouldNotify = opts.notify !== false;
        const shouldRefresh = opts.refreshTab !== false;
        showPerfChartLabels = !!enabled;
        persistPerfChartLabelsPreference(showPerfChartLabels);
        updatePerfChartLabelsUI();
        if (shouldNotify) {
            showInfo(showPerfChartLabels
                ? 'Etiquetas de Rendimiento activadas.'
                : 'Etiquetas de Rendimiento ocultas.');
        }
        if (shouldRefresh && uiState.activeTab === 'rendimiento' && state && state.rendimiento) {
            state.rendimiento.lastComputeSignature = '';
            applyTabFilters('rendimiento').catch((e) => showError('No se pudo refrescar Rendimiento.', e));
        }
    }

    const uiState = {
        sidebar: 'closed',
        activeTab: 'config',
        filters: { draft: {}, applied: {} },
        dataReadiness: { cartera: false, cobranzas: false, gestores: false, contratos: false, analytics: false }
    };

    function showInfo(message) {
        if (uiNotify.showInfo) uiNotify.showInfo(message);
        console.info(message);
    }

    function showWarning(message) {
        if (uiNotify.showWarning) uiNotify.showWarning(message);
        console.warn(message);
    }

    function showError(message, errorObj) {
        if (uiNotify.showError) uiNotify.showError(message, errorObj);
        console.error(message, errorObj || '');
    }

    function debugLog(event, payload) {
        if (!debugMode) return;
        console.debug(`[debug:${event}]`, payload || {});
    }

    function trackApiOutcome(tab, outcome) {
        const key = 'analytics_api_metrics_v1';
        try {
            const raw = localStorage.getItem(key);
            const metrics = raw ? JSON.parse(raw) : {};
            if (!metrics[tab]) metrics[tab] = { api_success: 0, fallback_local: 0 };
            if (outcome === 'api_success') metrics[tab].api_success += 1;
            if (outcome === 'fallback_local') metrics[tab].fallback_local += 1;
            localStorage.setItem(key, JSON.stringify(metrics));
            debugLog('api.outcome', { tab, outcome, counters: metrics[tab] });
        } catch (e) {
            // Keep app behavior resilient if localStorage is not available.
        }
    }

    async function exportAnalisisCarteraPdf() {
        const section = document.getElementById('analisis-cartera-content');
        if (!section || section.classList.contains('hidden')) {
            showWarning('Abre la pestaña "Análisis Cartera" para exportar el informe.');
            return;
        }
        if (!window.html2canvas || !window.jspdf || !window.jspdf.jsPDF) {
            showError('No se pudieron cargar las librerías para exportar PDF.');
            return;
        }

        const wasLoadingHidden = loading.classList.contains('hidden');
        if (exportAcaPdfBtn) exportAcaPdfBtn.disabled = true;
        try {
            loading.classList.remove('hidden');
            progressText.textContent = 'Generando informe PDF de Análisis Cartera...';
            await new Promise(r => setTimeout(r, 60));

            const canvas = await window.html2canvas(section, {
                backgroundColor: '#0f172a',
                scale: 2,
                useCORS: true,
                allowTaint: true,
                scrollX: 0,
                scrollY: -window.scrollY
            });

            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 8;
            const printableWidth = pageWidth - margin * 2;
            const printableHeight = pageHeight - margin * 2;
            const pxPerMm = canvas.width / printableWidth;
            const pageHeightPx = Math.max(1, Math.floor(printableHeight * pxPerMm));

            let offsetY = 0;
            let page = 0;
            while (offsetY < canvas.height) {
                const sliceHeight = Math.min(pageHeightPx, canvas.height - offsetY);
                const pageCanvas = document.createElement('canvas');
                pageCanvas.width = canvas.width;
                pageCanvas.height = sliceHeight;
                const pageCtx = pageCanvas.getContext('2d');
                pageCtx.drawImage(canvas, 0, offsetY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
                const pageImg = pageCanvas.toDataURL('image/png');
                const imgHeightMm = sliceHeight / pxPerMm;

                if (page > 0) pdf.addPage();
                pdf.addImage(pageImg, 'PNG', margin, margin, printableWidth, imgHeightMm, undefined, 'FAST');

                offsetY += sliceHeight;
                page += 1;
            }

            const now = new Date();
            const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
            pdf.save(`informe_analisis_cartera_${stamp}.pdf`);
            showInfo('Informe PDF generado correctamente.');
        } catch (e) {
            showError('No se pudo generar el PDF de Análisis Cartera.', e);
        } finally {
            if (exportAcaPdfBtn) exportAcaPdfBtn.disabled = false;
            if (wasLoadingHidden) loading.classList.add('hidden');
            progressText.textContent = 'Procesando datos...';
        }
    }

    useAnalyticsApi = readAnalyticsModePreference();
    window.USE_ANALYTICS_API = useAnalyticsApi;
    updateAnalyticsModeUI();
    if (analyticsToggle) {
        analyticsToggle.addEventListener('change', () => setAnalyticsMode(analyticsToggle.checked));
    }
    syncMode = readSyncModePreference();
    updateSyncModeUI();
    if (syncModeSelect) {
        syncModeSelect.addEventListener('change', () => setSyncMode(syncModeSelect.value));
    }
    showAcaChartLabels = readAcaChartLabelsPreference();
    updateAcaChartLabelsUI();
    if (acaLabelsToggle) {
        acaLabelsToggle.addEventListener('change', () => setAcaChartLabelsMode(acaLabelsToggle.checked));
    }
    showPerfChartLabels = readPerfChartLabelsPreference();
    updatePerfChartLabelsUI();
    if (perfLabelsToggle) {
        perfLabelsToggle.addEventListener('change', () => setPerfChartLabelsMode(perfLabelsToggle.checked));
    }
    if (exportAcaPdfBtn) {
        exportAcaPdfBtn.addEventListener('click', () => {
            exportAnalisisCarteraPdf().catch((e) => showError('No se pudo iniciar la exportación PDF.', e));
        });
    }

    function setDataReady(dataset, ready) {
        if (Object.prototype.hasOwnProperty.call(uiState.dataReadiness, dataset)) {
            uiState.dataReadiness[dataset] = !!ready;
        }
    }

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

    const MAX_IDB_ROWS = 250000;
    const NON_PERSISTENT_DATASETS = new Set(['cobranzas']);

    function shouldPersistDataset(key, val) {
        if (NON_PERSISTENT_DATASETS.has(key)) return false;
        if (Array.isArray(val) && val.length > MAX_IDB_ROWS) return false;
        return true;
    }

    function isOutOfMemoryIdbError(err) {
        const msg = String((err && (err.message || err.name)) || '').toLowerCase();
        return msg.includes('out of memory') || msg.includes('cannot be cloned') || msg.includes('quota') || msg.includes('memory');
    }

    async function persistDatasetSafe(key, val, label) {
        if (!shouldPersistDataset(key, val)) {
            addLog(`${label}: no se guarda en memoria del navegador (dataset grande).`, 'warn');
            return false;
        }
        try {
            await saveData(key, val);
            return true;
        } catch (err) {
            if (isOutOfMemoryIdbError(err)) {
                addLog(`${label}: guardado local omitido por memoria del navegador. La sesión actual sigue operativa.`, 'warn');
                console.warn(`IndexedDB memory limit for ${key}`, err);
                return false;
            }
            throw err;
        }
    }

    const getData = async (key) => {
        const db = await openDB();
        const req = db.transaction(storeName).objectStore(storeName).get(key);
        return new Promise((res) => req.onsuccess = () => res(req.result));
    };

    function buildDatasetStamp(rows, sampleKeys = []) {
        if (!Array.isArray(rows) || rows.length === 0) return '0';
        const first = rows[0] || {};
        const last = rows[rows.length - 1] || {};
        const firstKey = sampleKeys.map(k => String(first[k] || '')).join('|');
        const lastKey = sampleKeys.map(k => String(last[k] || '')).join('|');
        return `${rows.length}:${firstKey}:${lastKey}`;
    }

    function getCobranzasAggregates() {
        const rows = state.cobranzas.data;
        const stamp = buildDatasetStamp(rows, ['_cId', '_feNorm', 'monto']);
        if (memo.cobranzas.stamp === stamp && memo.cobranzas.value) return memo.cobranzas.value;

        const byKeyAmount = {};
        const byKeyDetailed = {};
        const byContractMonth = {};
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            if (!r._cId || !r._feNorm) continue;
            const key = `${r._cId}_${r._feNorm}`;
            const monto = parseFloat(r.monto) || 0;
            const viaPagoReal = String(r.VP || 'S/D').trim();

            byKeyAmount[key] = (byKeyAmount[key] || 0) + monto;
            if (!byKeyDetailed[key]) byKeyDetailed[key] = { total: 0, byVia: {} };
            byKeyDetailed[key].total += monto;
            byKeyDetailed[key].byVia[viaPagoReal] = (byKeyDetailed[key].byVia[viaPagoReal] || 0) + monto;

            if (!byContractMonth[r._cId]) byContractMonth[r._cId] = {};
            byContractMonth[r._cId][r._feNorm] = (byContractMonth[r._cId][r._feNorm] || 0) + monto;
        }

        memo.cobranzas = { stamp, value: { byKeyAmount, byKeyDetailed, byContractMonth } };
        return memo.cobranzas.value;
    }

    function getContractsByIdMap() {
        const rows = state.contratos.data;
        const stamp = buildDatasetStamp(rows, ['_cId', 'date', '_culminacionMonth']);
        if (memo.contratos.stamp === stamp && memo.contratos.value) return memo.contratos.value;

        const byId = {};
        for (let i = 0; i < rows.length; i++) {
            const c = rows[i];
            const id = String(c._cId || '');
            if (!id) continue;
            byId[id] = c;
        }
        memo.contratos = { stamp, value: byId };
        return memo.contratos.value;
    }

    function invalidateMemo(dataset) {
        if (dataset === 'cobranzas') memo.cobranzas = { stamp: '', value: null };
        if (dataset === 'contratos') memo.contratos = { stamp: '', value: null };
    }

    function setToSortedArray(setObj) {
        return Array.from(setObj || []).map(v => String(v)).sort();
    }

    function getTabComputeSignature(tab) {
        const filterIds = tabFilterIds[tab] || [];
        const applied = state[tab] && state[tab].filtersApplied ? state[tab].filtersApplied : {};
        const filterSig = {};
        for (let i = 0; i < filterIds.length; i++) {
            const id = filterIds[i];
            filterSig[id] = setToSortedArray(applied[id] || new Set());
        }

        // Include relevant dataset stamps so cache invalidates when data changes.
        const stamps = {
            cartera: buildDatasetStamp(state.cartera.data, ['_cId', '_feNorm', 'tramo']),
            cobranzas: buildDatasetStamp(state.cobranzas.data, ['_cId', '_feNorm', 'monto']),
            gestores: buildDatasetStamp(state.gestores.data, ['_cId', '_feNorm', 'Gestor']),
            contratos: buildDatasetStamp(state.contratos.data, ['_cId', 'date', '_culminacionMonth']),
            analytics: buildDatasetStamp(state.analytics.data, ['gestion_month', 'un', 'tramo', 'categoria', 'via_cobro'])
        };
        return JSON.stringify({ tab, filterSig, stamps });
    }

    // File State
    let pendingFiles = { cartera: null, cobranzas: null, gestores: null, analytics: null };

    // Content Containers
    const contents = {
        cartera: document.getElementById('cartera-content'),
        cobranzas: document.getElementById('cobranzas-content'),
        analisisCartera: document.getElementById('analisis-cartera-content'),
        acaMovimiento: document.getElementById('aca-mov-content'),
        acaAnuales: document.getElementById('aca-anuales-content'),
        rendimiento: document.getElementById('rendimiento-content'),
        cosecha: document.getElementById('cosecha-content'),
        ltv: document.getElementById('ltv-content'),
        ltvAge: document.getElementById('ltv-age-content'),
        analisisCobranza: document.getElementById('analisis-cobranza-content'),
        culminados: document.getElementById('culminados-content'),
        gestores: document.getElementById('gestores-content'),
        config: document.getElementById('config-content')
    };

    // Data State
    let state = {
        cartera: { data: [], filters: {}, filtersApplied: {}, charts: {}, dirty: false },
        cobranzas: { data: [], filters: {}, filtersApplied: {}, charts: {}, dirty: false },
        analytics: { data: [], filters: {}, filtersApplied: {}, dirty: false },
        analisisCartera: { filters: {}, filtersApplied: {}, charts: {}, dirty: false },
        acaMovimiento: { filters: {}, filtersApplied: {}, charts: {}, dirty: false },
        acaAnuales: { filters: {}, filtersApplied: {}, charts: {}, dirty: false },
        gestores: { data: [], filters: {}, filtersApplied: {}, charts: {}, dirty: false },
        rendimiento: { data: [], filters: {}, filtersApplied: {}, charts: {}, dirty: false },
        cosecha: { data: [], filters: {}, filtersApplied: {}, charts: {}, dirty: false },
        contratos: { data: [] },
        ltv: { filters: {}, filtersApplied: {}, charts: {}, dirty: false },
        ltvAge: { filters: {}, filtersApplied: {}, charts: {}, dirty: false },
        analisisCobranza: { filters: {}, filtersApplied: {}, charts: {}, dirty: false, defaultCutoff: '' },
        culminados: { filters: {}, filtersApplied: {}, charts: {}, dirty: false, defaultCutoff: '' }
    };

    const memo = {
        cobranzas: { stamp: '', value: null },
        contratos: { stamp: '', value: null }
    };

    const tabFilterIds = {
        cartera: ['un', 'tramo', 'cat', 'fecha'],
        cobranzas: ['vp', 'suc', 'anio', 'mes', 'dia', 'cob-super'],
        analisisCartera: ['aca-un', 'aca-anio', 'aca-fecha', 'aca-via-cobro', 'aca-super', 'aca-cat'],
        acaMovimiento: ['acam-un', 'acam-anio', 'acam-fecha', 'acam-via-cobro', 'acam-cat'],
        acaAnuales: ['acaa-un', 'acaa-anio', 'acaa-mes-contrato'],
        rendimiento: ['perf-un', 'perf-tramo', 'perf-fecha', 'perf-via-cobro', 'perf-via-pago', 'perf-cat', 'perf-super'],
        cosecha: ['co-un', 'co-tramo', 'co-anio', 'co-mes', 'co-fecha-gest', 'co-via-cobro', 'co-via-pago', 'co-cat'],
        ltv: ['ltv-un', 'ltv-anio', 'ltv-fecha', 'ltv-gestion', 'ltv-via-cobro', 'ltv-super'],
        ltvAge: ['ltva-un', 'ltva-anio', 'ltva-fecha', 'ltva-via-cobro', 'ltva-super', 'ltva-antiguedad'],
        analisisCobranza: ['ac-cutoff', 'ac-un', 'ac-via-cobro', 'ac-cat', 'ac-super'],
        culminados: ['cu-cutoff', 'cu-un', 'cu-fecha', 'cu-cat', 'cu-via-cobro'],
        gestores: ['gs-gestor', 'gs-un', 'gs-fecha']
    };

    const applyButtonByTab = {
        cartera: 'apply-cartera',
        cobranzas: 'apply-cobranzas',
        analisisCartera: 'apply-aca',
        acaMovimiento: 'apply-acam',
        acaAnuales: 'apply-acaa',
        rendimiento: 'apply-perf',
        cosecha: 'apply-co',
        ltv: 'apply-ltv',
        ltvAge: 'apply-ltva',
        analisisCobranza: 'apply-ac',
        culminados: 'apply-cu',
        gestores: 'apply-gs'
    };

    function switchTab(tabId) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            const onclick = btn.getAttribute('onclick') || '';
            const m = onclick.match(/switchTab\('([^']+)'\)/);
            btn.classList.toggle('active', m && m[1] === tabId);
        });
        Object.keys(contents).forEach(key => {
            contents[key].classList.toggle('hidden', key !== tabId);
        });

        if (tabId === 'gestores' && !state.gestores.dashboardInitialized) state.gestores.dashboardInitialized = true;
        if (tabId === 'analisisCartera' && !state.analisisCartera.dashboardInitialized) state.analisisCartera.dashboardInitialized = true;
        if (tabId === 'acaMovimiento' && !state.acaMovimiento.dashboardInitialized) state.acaMovimiento.dashboardInitialized = true;
        if (tabId === 'acaAnuales' && !state.acaAnuales.dashboardInitialized) state.acaAnuales.dashboardInitialized = true;
        if (tabId === 'cosecha' && !state.cosecha.dashboardInitialized) state.cosecha.dashboardInitialized = true;
        if (tabId === 'ltv' && !state.ltv.dashboardInitialized) state.ltv.dashboardInitialized = true;
        if (tabId === 'ltvAge' && !state.ltvAge.dashboardInitialized) state.ltvAge.dashboardInitialized = true;
        if (tabId === 'analisisCobranza' && !state.analisisCobranza.dashboardInitialized) state.analisisCobranza.dashboardInitialized = true;
        if (tabId === 'culminados' && !state.culminados.dashboardInitialized) state.culminados.dashboardInitialized = true;
        uiState.activeTab = tabId;
        if (tabId === 'acaMovimiento' && (state.acaMovimiento.dirty || !state.acaMovimiento.filtersInitialized)) {
            applyTabFilters('acaMovimiento').catch((e) => showError('No se pudo calcular Movimiento de Cartera.', e));
        }
        if (tabId === 'acaAnuales' && (state.acaAnuales.dirty || !state.acaAnuales.filtersInitialized)) {
            applyTabFilters('acaAnuales').catch((e) => showError('No se pudo calcular Análisis Anuales.', e));
        }
    }
    window.switchTab = switchTab;

    const setSidebarOpen = (open) => {
        const shouldOpen = !!open;
        document.body.classList.toggle('sidebar-open', shouldOpen);
        if (menuToggle) menuToggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
        if (sidebarOverlay) sidebarOverlay.classList.toggle('hidden', !shouldOpen);
        uiState.sidebar = shouldOpen ? 'open' : 'closed';
    };

    const showTabsNav = () => {
        tabsNav.classList.remove('hidden');
        if (menuToggle) menuToggle.classList.remove('hidden');
    };

    if (menuToggle) {
        menuToggle.addEventListener('click', () => setSidebarOpen(!document.body.classList.contains('sidebar-open')));
    }
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => setSidebarOpen(false));
    }
    if (tabsNav) {
        tabsNav.addEventListener('click', (e) => {
            if (e.target.closest('button')) setSidebarOpen(false);
        });
    }
    setSidebarOpen(false);
    // -- INIT: Load from Persistent Storage --
    try {
        const aData = await getData('analytics');
        const cData = await getData('cartera');
        const cobData = await getData('cobranzas');
        const gData = await getData('gestores');
        const ctData = await getData('contratos');

        const hasLocalData = (Array.isArray(aData) && aData.length > 0)
            || (Array.isArray(cData) && cData.length > 0)
            || (Array.isArray(cobData) && cobData.length > 0)
            || (Array.isArray(gData) && gData.length > 0)
            || (Array.isArray(ctData) && ctData.length > 0);

        if (hasLocalData) {
            loading.classList.remove('hidden');
            progressText.textContent = 'Restaurando sesion...';
            // Let UI render the message
            await new Promise(r => setTimeout(r, 50));

            if (aData) await processAnalytics(aData, { skipAuto: true });
            if (cData) await processCartera(cData, { skipAuto: true });
            if (cobData) await processCobranzas(cobData, { skipAuto: true });
            if (gData) await processGestores(gData, { skipAuto: true });
            if (ctData) await processContratos(ctData, { skipAuto: true });

            showTabsNav();
            dropZone.classList.add('hidden');

            // Auto-navigate to Performance if all exist
            if (aData) {
                switchTab('analisisCartera');
            } else if (cData && cobData) {
                switchTab('rendimiento');
            } else {
                switchTab(cData ? 'cartera' : (cobData ? 'cobranzas' : (ctData ? 'ltv' : 'config')));
            }

            loading.classList.add('hidden');
        } else {
            // Never force upload screen on refresh; keep local-first flow via Config
            showTabsNav();
            dropZone.classList.add('hidden');
            switchTab('config');
        }
    } catch (e) {
        console.error('Error loading from IDB:', e);
        loading.classList.add('hidden');
        showTabsNav();
        dropZone.classList.add('hidden');
        switchTab('config');
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
            } else if (file.name.toLowerCase().includes('analytics_monthly')) {
                pendingFiles.analytics = file;
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

    function getRequiredColumns(type) {
        if (type === 'cartera') return ['id_contrato', 'Fecha gestion', 'UN', 'tramo', 'monto_cuota', 'monto_vencido'];
        if (type === 'cobranzas') return ['monto'];
        if (type === 'gestores') return ['contract_id', 'from_date', 'Gestor'];
        if (type === 'contratos') return [];
        if (type === 'analytics') return ['gestion_month', 'un', 'tramo', 'categoria', 'via_cobro', 'supervisor', 'contracts_total', 'contracts_paid', 'debt_total', 'paid_total'];
        return [];
    }

    function hasAnyField(row, fields) {
        for (let i = 0; i < fields.length; i++) {
            const v = row[fields[i]];
            if (v !== undefined && v !== null && String(v).trim() !== '') return true;
        }
        return false;
    }

    function validateDataset(type, rows) {
        if (dataValidator.validateDataset) {
            return dataValidator.validateDataset(type, rows);
        }
        const issues = { fatal: [], warnings: [] };
        if (!Array.isArray(rows) || rows.length === 0) {
            issues.fatal.push(`El dataset ${type} no tiene filas.`);
            return issues;
        }

        const sample = rows[0] || {};
        const required = getRequiredColumns(type);
        for (let i = 0; i < required.length; i++) {
            if (!(required[i] in sample)) {
                issues.fatal.push(`Falta columna requerida '${required[i]}' en ${type}.`);
            }
        }
        if (type === 'contratos') {
            const sampleKeys = Object.keys(sample).map(k => String(k || '').trim().toLowerCase());
            const hasId = sampleKeys.includes('contract_id') || sampleKeys.includes('id') || sampleKeys.includes('id_contrato');
            if (!hasId) {
                issues.fatal.push("Falta columna de identificador en contratos. Use 'contract_id', 'id' o 'id_contrato'.");
            }
        }

        let invalidIds = 0;
        let invalidNumbers = 0;
        let invalidDates = 0;
        const maxScan = Math.min(rows.length, 5000);
        for (let i = 0; i < maxScan; i++) {
            const r = rows[i];
            if (type === 'cartera') {
                if (!hasAnyField(r, ['id_contrato'])) invalidIds++;
                if (Number.isNaN(parseFloat(r.monto_cuota)) || Number.isNaN(parseFloat(r.monto_vencido))) invalidNumbers++;
                if (!monthFromDate(r['Fecha gestion']) && !normD(r['Fecha gestion'])) invalidDates++;
            } else if (type === 'cobranzas') {
                if (!hasAnyField(r, ['contract_id', 'id_contrato'])) invalidIds++;
                if (Number.isNaN(parseFloat(r.monto))) invalidNumbers++;
            } else if (type === 'gestores') {
                if (!hasAnyField(r, ['contract_id'])) invalidIds++;
                if (!monthFromDate(r.from_date)) invalidDates++;
            } else if (type === 'contratos') {
                if (!hasAnyField(r, ['contract_id', 'id', 'id_contrato'])) invalidIds++;
                const dt = r.fecha_contrato || r.date || '';
                if (dt && !monthFromDate(dt)) invalidDates++;
            } else if (type === 'analytics') {
                if (!/^\d{1,2}\/\d{4}$/.test(String(r.gestion_month || '').trim())) invalidDates++;
                if (Number.isNaN(parseFloat(r.contracts_total)) || Number.isNaN(parseFloat(r.contracts_paid))) invalidNumbers++;
                if (Number.isNaN(parseFloat(r.debt_total)) || Number.isNaN(parseFloat(r.paid_total))) invalidNumbers++;
            }
        }

        if (invalidIds > 0) issues.warnings.push(`${type}: ${invalidIds} filas con identificador vacio (muestra ${maxScan}).`);
        if (invalidNumbers > 0) issues.warnings.push(`${type}: ${invalidNumbers} filas con montos no numericos (muestra ${maxScan}).`);
        if (invalidDates > 0) issues.warnings.push(`${type}: ${invalidDates} filas con fecha invalida (muestra ${maxScan}).`);
        return issues;
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
            showTabsNav();
            dropZone.classList.add('hidden');
            switchTab('cartera');
        } catch (err) {
            showError('Error al procesar archivos seleccionados.', err);
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
                        const validation = validateDataset(type, loadedData);
                        if (validation.fatal.length > 0) {
                            validation.fatal.forEach(msg => showError(msg));
                            reject(new Error(`Validacion fallida para ${type}`));
                            return;
                        }
                        validation.warnings.forEach(msg => showWarning(msg));

                        if (type === 'cartera') await processCartera(loadedData);
                        else if (type === 'cobranzas') await processCobranzas(loadedData);
                        else if (type === 'gestores') {
                            await processGestores(loadedData);
                        } else if (type === 'contratos') {
                            await processContratos(loadedData);
                        } else if (type === 'analytics') {
                            await processAnalytics(loadedData);
                        }
                        resolve();
                    } catch (e) {
                        showError(`Error en procesamiento de ${type}: ${e.message || e}`, e);
                        reject(e);
                    }
                },
                error: (err) => reject(err)
            });
        });
    }

    // Tab Switching

    function normalizeAnalyticsRow(row) {
        const gm = normD(String(row.gestion_month || '')) || String(row.gestion_month || '').trim();
        const via = String(row.via_cobro || '').trim().toUpperCase() === 'COBRADOR' ? 'COBRADOR' : 'DEBITO';
        const catRaw = String(row.categoria || '').trim().toUpperCase();
        const cat = catRaw.startsWith('VIG') ? 'VIGENTE' : 'MOROSO';
        const tramoVal = String(row.tramo ?? '0').trim();
        const numOrZero = (v) => {
            const n = parseFloat(v);
            return Number.isFinite(n) ? n : 0;
        };
        const intOrZero = (v) => {
            const n = parseInt(v, 10);
            return Number.isFinite(n) ? n : 0;
        };
        return {
            gestion_month: gm,
            un: String(row.un || 'S/D').trim() || 'S/D',
            tramo: tramoVal || '0',
            categoria: cat,
            via_cobro: via,
            supervisor: String(row.supervisor || 'S/D').trim() || 'S/D',
            contracts_total: intOrZero(row.contracts_total),
            contracts_paid: intOrZero(row.contracts_paid),
            debt_total: numOrZero(row.debt_total),
            paid_total: numOrZero(row.paid_total),
            paid_via_debito: numOrZero(row.paid_via_debito),
            paid_via_cobrador: numOrZero(row.paid_via_cobrador),
            contracts_paid_via_debito: intOrZero(row.contracts_paid_via_debito),
            contracts_paid_via_cobrador: intOrZero(row.contracts_paid_via_cobrador)
        };
    }

    async function processAnalytics(data, options = {}) {
        const skipAuto = options.skipAuto !== undefined ? !!options.skipAuto : true;
        const out = [];
        for (let i = 0; i < data.length; i++) {
            const normalized = normalizeAnalyticsRow(data[i]);
            if (/^\d{2}\/\d{4}$/.test(normalized.gestion_month)) out.push(normalized);
            if (i % 50000 === 0) {
                progressText.textContent = `Procesando analytics: ${i.toLocaleString()} / ${data.length.toLocaleString()}...`;
                await new Promise(r => setTimeout(r, 0));
            }
        }
        state.analytics.data = out;
        setDataReady('analytics', true);
        await persistDatasetSafe('analytics', out, 'Analytics mensual');
        state.analisisCartera.filtersInitialized = false;
        state.acaMovimiento.filtersInitialized = false;
        state.acaAnuales.filtersInitialized = false;
        state.rendimiento.filtersInitialized = false;
        setTabDirty('analisisCartera', true);
        setTabDirty('acaMovimiento', true);
        setTabDirty('acaAnuales', true);
        setTabDirty('rendimiento', true);
        if (!skipAuto) {
            addLog(`analytics_monthly.csv cargado (${out.length.toLocaleString()} filas).`, 'success');
        }
    }

    function getAnalyticsRowsFiltered(sel) {
        const selUn = sel.selUn || new Set();
        const selTramo = sel.selTramo || new Set();
        const selAnio = sel.selAnio || new Set();
        const selFecha = sel.selFecha || new Set();
        const selViaCobro = sel.selViaCobro || new Set();
        const selViaPago = sel.selViaPago || new Set();
        const selCat = sel.selCat || new Set();
        const selSuper = sel.selSuper || new Set();

        const rows = [];
        const src = state.analytics.data;
        for (let i = 0; i < src.length; i++) {
            const r = src[i];
            if (selUn.size > 0 && !selUn.has(r.un)) continue;
            if (selTramo.size > 0 && !selTramo.has(String(r.tramo))) continue;
            if (selAnio.size > 0 && !selAnio.has(getYearFromGestionMonth(r.gestion_month))) continue;
            if (selFecha.size > 0 && !selFecha.has(r.gestion_month)) continue;
            if (selViaCobro.size > 0 && !selViaCobro.has(r.via_cobro)) continue;
            if (selCat.size > 0 && !selCat.has(r.categoria)) continue;
            if (selSuper.size > 0 && !selSuper.has(r.supervisor)) continue;

            let paidAmount = r.paid_total || 0;
            let contractsPaid = r.contracts_paid || 0;
            if (selViaPago.size > 0) {
                paidAmount = 0;
                contractsPaid = 0;
                if (selViaPago.has('DEBITO')) {
                    paidAmount += r.paid_via_debito || 0;
                    contractsPaid += r.contracts_paid_via_debito || 0;
                }
                if (selViaPago.has('COBRADOR')) {
                    paidAmount += r.paid_via_cobrador || 0;
                    contractsPaid += r.contracts_paid_via_cobrador || 0;
                }
                if (contractsPaid > (r.contracts_total || 0)) contractsPaid = r.contracts_total || 0;
            }
            rows.push({
                ...r,
                _paid_selected: paidAmount,
                _contracts_paid_selected: contractsPaid
            });
        }
        return rows;
    }

    // --- CARTERA LOGIC ---
    async function processCartera(data, options = {}) {
        const skipAuto = options.skipAuto !== undefined ? !!options.skipAuto : true;
        state.cartera.data = data;
        setDataReady('cartera', true);

        const uns = new Set(), tramos = new Set(), cats = new Set(), fechas = new Set();

        console.log("Optimizing Cartera process (Single-pass + Normalization)...");
        for (let i = 0; i < data.length; i++) {
            const r = data[i];

            // Pre-normalize (handle multiple date formats)
            const rawFe = r['Fecha gestion'];
            const feNorm = monthFromDate(rawFe || '');
            r._feNorm = feNorm || rawFe || 'S/D';

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
        await persistDatasetSafe('cartera', data, 'Cartera');

        const sortedFechas = Array.from(fechas).sort((a, b) => {
            const [m1, y1] = a.split('/'); const [m2, y2] = b.split('/');
            return new Date(y1, m1 - 1) - new Date(y2, m2 - 1);
        });

        setupFilter('un', Array.from(uns).sort(), 'cartera');
        setupFilter('tramo', Array.from(tramos).sort((a, b) => a - b), 'cartera');
        setupFilter('cat', Array.from(cats).sort(), 'cartera');
        setupFilter('fecha', sortedFechas, 'cartera');

        document.getElementById('reset-cartera').onclick = () => { resetFilters('cartera'); };
        snapshotAppliedFilters('cartera');
        state.acaAnuales.filtersInitialized = false;
        setTabDirty('acaAnuales', true);
        if (!skipAuto) applyCarteraFilters();

        // Only trigger if both are ready
        if (!skipAuto && state.cobranzas.data.length) {
            await calculatePerformance();
            await calculateCosecha();
        }
    }

    function applyCarteraFilters() {
        const selUn = getAppliedSelected('cartera', 'un');
        const selTramo = getAppliedSelected('cartera', 'tramo');
        const selCat = getAppliedSelected('cartera', 'cat');
        const selFecha = getAppliedSelected('cartera', 'fecha');

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

    async function processCobranzas(data, options = {}) {
        const skipAuto = options.skipAuto !== undefined ? !!options.skipAuto : true;
        state.cobranzas.data = data;
        setDataReady('cobranzas', true);
        invalidateMemo('cobranzas');

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
        await persistDatasetSafe('cobranzas', data, 'Cobranzas');

        setupFilter('vp', Array.from(vps).sort(), 'cobranzas');
        setupFilter('suc', Array.from(sucs).sort(), 'cobranzas');
        setupFilter('anio', Array.from(anios).sort(), 'cobranzas');
        setupFilter('mes', Array.from(meses).sort((a, b) => a - b), 'cobranzas');
        setupFilter('dia', Array.from(dias).sort((a, b) => a - b), 'cobranzas');
        setupFilter('cob-super', getSupervisorOptions(), 'cobranzas');

        document.getElementById('reset-cobranzas').onclick = () => { resetFilters('cobranzas'); };
        snapshotAppliedFilters('cobranzas');
        state.acaAnuales.filtersInitialized = false;
        setTabDirty('acaAnuales', true);
        if (!skipAuto) applyCobranzasFilters();

        if (!skipAuto && state.cartera.data.length) {
            await calculatePerformance();
            await calculateCosecha();
        }
    }

    async function processGestores(data, options = {}) {
        const skipAuto = options.skipAuto !== undefined ? !!options.skipAuto : true;
        state.gestores.data = data;
        setDataReady('gestores', true);

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
        await persistDatasetSafe('gestores', data, 'Gestores');
        console.log("Gestores processed and normalized.");

        if (!skipAuto && state.cartera.data.length && state.cobranzas.data.length) await calculatePerformance();
    }

    async function processContratos(data, options = {}) {
        const skipAuto = options.skipAuto !== undefined ? !!options.skipAuto : true;
        setDataReady('contratos', true);
        invalidateMemo('contratos');
        const parseLooseNumber = (val) => {
            if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
            let s = String(val || '').trim();
            if (!s) return 0;
            s = s.replace(/[^\d,.\-]/g, '');
            if (!s) return 0;

            if (s.includes(',') && s.includes('.')) {
                if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
                    s = s.replace(/\./g, '').replace(',', '.');
                } else {
                    s = s.replace(/,/g, '');
                }
            } else if (s.includes(',')) {
                const parts = s.split(',');
                if (parts.length === 2 && parts[1].length <= 2) {
                    s = parts[0].replace(/\./g, '') + '.' + parts[1];
                } else {
                    s = s.replace(/,/g, '');
                }
            }
            const n = Number(s);
            return Number.isFinite(n) ? n : 0;
        };
        for (let i = 0; i < data.length; i++) {
            const r = data[i];
            r._cId = String(r.id || r.contract_id || r.id_contrato || '').replace(/[^0-9]/g, '');
            r._contractMonth = monthFromDate(r.date || r.fecha_contrato || '') || 'S/D';
            const parts = r._contractMonth.split('/');
            r._contractYear = parts.length === 2 ? String(parts[1]) : 'S/D';
            r._statusNum = parseInt(r.status, 10);
            r._statusName = r._statusNum === 6 ? 'CULMINADO' : (r._statusNum === 5 ? 'ACTIVO' : 'OTRO');
            r._montoCuota = parseLooseNumber(r.monto_cuota || r.amount || 0);
            r._culminacionMonth = monthFromDate(r.fecha_de_culminacion || r.fecha_culminacion || '') || '';
            r._supervisor = String(r.Supervisor || r.supervisor || 'S/D').trim() || 'S/D';
        }
        state.contratos.data = data;
        await persistDatasetSafe('contratos', data, 'Contratos');
        console.log("Contratos processed and stored.");
        state.acaAnuales.filtersInitialized = false;
        setTabDirty('acaAnuales', true);

        // Rebuild supervisor filter in Cobranzas once contratos are available.
        if (state.cobranzas.data.length) {
            setupFilter('cob-super', getSupervisorOptions(), 'cobranzas');
        }
        if (!skipAuto) await calculateLtv();
    }

    async function ensureContratosLoaded() {
        if (state.contratos.data.length) return;
        setDataReady('contratos', false);
        addLog('Datos de contratos no estan en local. Sincroniza desde Configuracion.', 'error');
    }

    async function ensureCarteraLoaded() {
        if (state.cartera.data.length) return;
        setDataReady('cartera', false);
        addLog('Datos de cartera no estan en local. Sincroniza desde Configuracion.', 'error');
    }

    async function ensureCobranzasLoaded() {
        if (state.cobranzas.data.length) return;
        setDataReady('cobranzas', false);
        addLog('Datos de cobranzas no estan en local. Sincroniza desde Configuracion.', 'error');
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
            const supervisors = getSupervisorOptions();

            setupFilter('ltv-un', uns, 'ltv');
            setupFilter('ltv-anio', anios, 'ltv');
            setupFilter('ltv-fecha', fechas, 'ltv');
            setupFilter('ltv-gestion', gestiones, 'ltv');
            setupFilter('ltv-via-cobro', viasCobro, 'ltv');
            setupFilter('ltv-super', supervisors, 'ltv');

            document.getElementById('reset-ltv').onclick = async () => {
                resetFilters('ltv');
            };
            snapshotAppliedFilters('ltv');
            state.ltv.filtersInitialized = true;
        }

        const selUn = getAppliedSelected('ltv', 'ltv-un');
        const selAnio = getAppliedSelected('ltv', 'ltv-anio');
        const selFecha = getAppliedSelected('ltv', 'ltv-fecha');
        const selGestion = getAppliedSelected('ltv', 'ltv-gestion');
        const selViaCobro = getAppliedSelected('ltv', 'ltv-via-cobro');
        const selSuper = getAppliedSelected('ltv', 'ltv-super');
        updateLtvSelectionSummary(selUn, selAnio, selFecha, selGestion, selViaCobro, selSuper);

        const stats = {
            totalContracts: 0,
            totalContractsSold: 0,
            vigente: 0,
            totalCobrar: 0,
            totalCobrarTeorico: 0,
            mora: 0,
            moraCutoff: 0,
            totalCobrado: 0,
            retentionBaseOriginal: 0,
            retentionVigenteCutoff: 0,
            activosRateCutoff: 0,
            morososRateCutoff: 0,
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
            (selFecha.size === 0 || selFecha.has(String(r._contractMonth || 'S/D'))) &&
            (selSuper.size === 0 || selSuper.has(String(r._supervisor || 'S/D')))
        );
        const contractIds = new Set(filteredContracts.map(r => r._cId).filter(Boolean));
        const contractCulminacionMonthById = {};
        const contractDateById = {};
        for (let i = 0; i < filteredContracts.length; i++) {
            const c = filteredContracts[i];
            contractCulminacionMonthById[c._cId] = String(c._culminacionMonth || '');
            contractDateById[c._cId] = String(c.date || '');
        }
        const filteredCartera = state.cartera.data.filter(r =>
            contractIds.has(r._cId) &&
            (selGestion.size === 0 || selGestion.has(String(r._feNorm || 'S/D'))) &&
            (selViaCobro.size === 0 || selViaCobro.has(normalizeViaCobro(r.via_de_cobro)))
        );
        const cohortCarteraAllGestiones = state.cartera.data.filter(r =>
            contractIds.has(r._cId) &&
            (selViaCobro.size === 0 || selViaCobro.has(normalizeViaCobro(r.via_de_cobro)))
        );
        // Total vendido del cohorte (mes/año contrato), respetando filtro de vía cuando aplica.
        stats.totalContractsSold = new Set(cohortCarteraAllGestiones.map(r => r._cId).filter(Boolean)).size;

        const cobMaps = getCobranzasAggregates();
        const cobAggr = cobMaps.byKeyAmount;
        const cobByContractMonth = cobMaps.byContractMonth;

        for (let i = 0; i < filteredCartera.length; i++) {
            const r = filteredCartera[i];
            const gestion = String(r._feNorm || 'S/D');
            const montoCobrar = (parseFloat(r.monto_cuota) || 0) + (parseFloat(r.monto_vencido) || 0);
            const montoCobrado = cobAggr[`${r._cId}_${gestion}`] || 0;
            const fechaContrato = contractDateById[r._cId] || '';
            const mesesAntiguedad = monthsBetweenDateAndMonth(fechaContrato, gestion);
            const deberiaFila = (parseFloat(r.monto_cuota) || 0) * mesesAntiguedad;
            const tramoNum = parseInt(r.tramo, 10) || 0;
            const isMora = tramoNum >= 4;

            stats.totalContracts += 1;
            stats.totalCobrar += montoCobrar;
            stats.totalCobrado += montoCobrado;
            if (isMora) stats.mora += 1;
            else stats.vigente += 1;

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
            stats.byGestion[gestion].cobrar += montoCobrar;
            stats.byGestion[gestion].cobrado += montoCobrado;
            stats.byGestion[gestion].deberia += deberiaFila;
            stats.byGestion[gestion].weightedMonthsNumerator += (mesesAntiguedad * deberiaFila);
        }

        // Culminados por corte: contar contratos unicos del cohorte (no filas de cartera).
        const cohortContractIds = [...contractIds];
        const byGestionKeys = Object.keys(stats.byGestion);
        for (let i = 0; i < byGestionKeys.length; i++) {
            const gestion = byGestionKeys[i];
            const gestionSerial = monthToSerial(gestion);
            let culminadoCount = 0;
            for (let j = 0; j < cohortContractIds.length; j++) {
                const cid = cohortContractIds[j];
                const culmMonth = contractCulminacionMonthById[cid] || '';
                const culmSerial = monthToSerial(culmMonth);
                if (culmSerial > 0 && gestionSerial > 0 && culmSerial <= gestionSerial) culminadoCount += 1;
            }
            stats.byGestion[gestion].culminado = culminadoCount;
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
            stats.totalCobrarTeorico = calc.sumDeberia;
            // "Total cobrado (gestion)" debe reflejar acumulado al corte del cohorte.
            stats.totalCobrado = calc.sumCobrado;
            stats.sumCobrado = calc.sumCobrado;
            stats.ratioPago = calc.ratioPago;
            stats.mesesPonderados = calc.mesesPonderados;
            stats.ltvScore = calc.ltvScore;

            // Mora al corte: último mes de gestión seleccionado, tramo > 4.
            const moraIdsCutoff = new Set();
            for (let i = 0; i < filteredCartera.length; i++) {
                const r = filteredCartera[i];
                if (String(r._feNorm || '') !== cutoff) continue;
                if ((parseInt(r.tramo, 10) || 0) >= 4 && r._cId) moraIdsCutoff.add(r._cId);
            }
            stats.moraCutoff = moraIdsCutoff.size;

            const cutoffStats = stats.byGestion[cutoff] || { culminado: 0, vigente: 0, mora: 0 };
            const activosCutoff = (cutoffStats.vigente || 0) + (cutoffStats.mora || 0);
            stats.activosRateCutoff = activosCutoff > 0 ? ((cutoffStats.vigente || 0) / activosCutoff) : 0;
            stats.morososRateCutoff = activosCutoff > 0 ? ((cutoffStats.mora || 0) / activosCutoff) : 0;
            const baseOriginal = stats.totalContractsSold || 0;
            const activosNoCulminados = Math.max(0, baseOriginal - (cutoffStats.culminado || 0));
            stats.retentionBaseOriginal = baseOriginal;
            stats.retentionVigenteCutoff = activosNoCulminados;
        }

        // Tarjeta de total contratos: cohorte vendido (no suma de historia por gestión).
        stats.totalContracts = stats.totalContractsSold;

        updateLtvUI(stats);
    }

    async function calculateLtvAge() {
        await ensureContratosLoaded();
        await ensureCarteraLoaded();
        await ensureCobranzasLoaded();
        if (!state.contratos.data.length || !state.cartera.data.length) return;

        if (!state.ltvAge.filtersInitialized) {
            const uns = [...new Set(state.contratos.data.map(r => String(r.UN || 'S/D')).filter(Boolean))].sort();
            const anios = [...new Set(state.contratos.data.map(r => String(r._contractYear || 'S/D')).filter(Boolean))].sort();
            const fechas = [...new Set(state.contratos.data.map(r => String(r._contractMonth || 'S/D')).filter(Boolean))].sort((a, b) => monthToSerial(a) - monthToSerial(b));
            const viasCobro = ['COBRADOR', 'DEBITO'];
            const supervisors = getSupervisorOptions();
            const antiguedades = Array.from({ length: 36 }, (_, i) => String(i + 1));

            setupFilter('ltva-un', uns, 'ltvAge');
            setupFilter('ltva-anio', anios, 'ltvAge');
            setupFilter('ltva-fecha', fechas, 'ltvAge');
            setupFilter('ltva-via-cobro', viasCobro, 'ltvAge');
            setupFilter('ltva-super', supervisors, 'ltvAge');
            setupSingleSelectFilter('ltva-antiguedad', antiguedades, 'ltvAge', '12');

            document.getElementById('reset-ltva').onclick = () => {
                resetLtvAgeFilters();
            };
            snapshotAppliedFilters('ltvAge');
            state.ltvAge.filtersInitialized = true;
        }

        const selUn = getAppliedSelected('ltvAge', 'ltva-un');
        const selAnio = getAppliedSelected('ltvAge', 'ltva-anio');
        const selFecha = getAppliedSelected('ltvAge', 'ltva-fecha');
        const selViaCobro = getAppliedSelected('ltvAge', 'ltva-via-cobro');
        const selSuper = getAppliedSelected('ltvAge', 'ltva-super');
        const selAntiguedad = getAppliedSelected('ltvAge', 'ltva-antiguedad');
        const nMonths = Math.max(1, parseInt([...selAntiguedad][0] || '12', 10) || 12);

        updateLtvAgeSelectionSummary(selUn, selAnio, selFecha, selViaCobro, selSuper, nMonths);

        const filteredContracts = state.contratos.data.filter(r =>
            (selUn.size === 0 || selUn.has(String(r.UN || 'S/D'))) &&
            (selAnio.size === 0 || selAnio.has(String(r._contractYear || 'S/D'))) &&
            (selFecha.size === 0 || selFecha.has(String(r._contractMonth || 'S/D'))) &&
            (selSuper.size === 0 || selSuper.has(String(r._supervisor || 'S/D')))
        );

        const carteraByContractMonth = {};
        for (let i = 0; i < state.cartera.data.length; i++) {
            const r = state.cartera.data[i];
            const cId = String(r._cId || '');
            const mm = String(r._feNorm || '');
            if (!cId || !mm) continue;
            if (!carteraByContractMonth[cId]) carteraByContractMonth[cId] = {};
            if (!carteraByContractMonth[cId][mm]) carteraByContractMonth[cId][mm] = r;
        }

        const cobByContractMonth = getCobranzasAggregates().byContractMonth;

        const stats = {
            totalContracts: 0,
            totalDeberia: 0,
            totalCobrado: 0,
            payRate: 0,
            ltvValue: 0,
            nMonths,
            bySaleMonth: {}
        };

        for (let i = 0; i < filteredContracts.length; i++) {
            const c = filteredContracts[i];
            const cId = String(c._cId || '');
            if (!cId) continue;

            const saleMonth = monthFromDate(c.date);
            if (!saleMonth) continue;
            const cutoffMonth = addMonths(saleMonth, nMonths);
            if (!cutoffMonth) continue;

            const cutoffRow = carteraByContractMonth[cId] ? carteraByContractMonth[cId][cutoffMonth] : null;
            if (!cutoffRow) continue;
            if (selViaCobro.size > 0 && !selViaCobro.has(normalizeViaCobro(cutoffRow.via_de_cobro))) continue;

            const cuota = parseFloat(cutoffRow.monto_cuota) || 0;
            const deberia = cuota * nMonths;
            if (deberia <= 0) continue;

            const cobrado = sumCobradoBetweenMonths(cobByContractMonth[cId] || {}, saleMonth, cutoffMonth);
            const ratio = deberia > 0 ? (cobrado / deberia) : 0;
            const ltv = ratio * nMonths;

            stats.totalContracts += 1;
            stats.totalDeberia += deberia;
            stats.totalCobrado += cobrado;

            if (!stats.bySaleMonth[saleMonth]) {
                stats.bySaleMonth[saleMonth] = {
                    contracts: 0,
                    deberia: 0,
                    cobrado: 0,
                    payRate: 0,
                    ltv: 0
                };
            }
            stats.bySaleMonth[saleMonth].contracts += 1;
            stats.bySaleMonth[saleMonth].deberia += deberia;
            stats.bySaleMonth[saleMonth].cobrado += cobrado;
            stats.bySaleMonth[saleMonth].payRate = stats.bySaleMonth[saleMonth].deberia > 0 ? (stats.bySaleMonth[saleMonth].cobrado / stats.bySaleMonth[saleMonth].deberia) : 0;
            stats.bySaleMonth[saleMonth].ltv = stats.bySaleMonth[saleMonth].payRate * nMonths;
        }

        stats.payRate = stats.totalDeberia > 0 ? (stats.totalCobrado / stats.totalDeberia) : 0;
        stats.ltvValue = stats.payRate * nMonths;
        updateLtvAgeUI(stats);
    }

    async function calculateAnalisisCobranza() {
        await ensureContratosLoaded();
        await ensureCarteraLoaded();
        await ensureCobranzasLoaded();
        if (!state.contratos.data.length || !state.cartera.data.length || !state.cobranzas.data.length) return;

        if (!state.analisisCobranza.filtersInitialized) {
            const cutoffs = [...new Set(state.cobranzas.data.map(r => String(r._feNorm || '')).filter(v => /^\d{2}\/\d{4}$/.test(v)))]
                .sort((a, b) => monthToSerial(a) - monthToSerial(b));
            const uns = [...new Set(state.contratos.data.map(r => String(r.UN || 'S/D')).filter(Boolean))].sort();
            const viasCobro = ['COBRADOR', 'DEBITO'];
            const supervisors = getSupervisorOptions();
            const cats = ['VIGENTE', 'MOROSO'];
            const defaultCutoff = cutoffs.length ? cutoffs[cutoffs.length - 1] : 'S/D';
            state.analisisCobranza.defaultCutoff = defaultCutoff;

            setupSingleSelectFilter('ac-cutoff', cutoffs, 'analisisCobranza', defaultCutoff);
            setupFilter('ac-un', uns, 'analisisCobranza');
            setupFilter('ac-via-cobro', viasCobro, 'analisisCobranza');
            setupFilter('ac-cat', cats, 'analisisCobranza');
            setupFilter('ac-super', supervisors, 'analisisCobranza');

            document.getElementById('reset-ac').onclick = () => {
                resetAnalisisCobranzaFilters();
            };
            snapshotAppliedFilters('analisisCobranza');
            state.analisisCobranza.filtersInitialized = true;
        }

        const selCutoff = getAppliedSelected('analisisCobranza', 'ac-cutoff');
        const selUn = getAppliedSelected('analisisCobranza', 'ac-un');
        const selViaCobro = getAppliedSelected('analisisCobranza', 'ac-via-cobro');
        const selCat = getAppliedSelected('analisisCobranza', 'ac-cat');
        const selSuper = getAppliedSelected('analisisCobranza', 'ac-super');
        const cutoff = [...selCutoff][0] || state.analisisCobranza.defaultCutoff || 'S/D';
        const cutoffSerial = monthToSerial(cutoff);

        const contractsById = {};
        const contractIdsBySaleMonth = {};
        for (let i = 0; i < state.contratos.data.length; i++) {
            const c = state.contratos.data[i];
            const cId = String(c._cId || '');
            if (!cId) continue;
            const un = String(c.UN || 'S/D');
            if (selUn.size > 0 && !selUn.has(un)) continue;
            const superv = String(c._supervisor || 'S/D');
            if (selSuper.size > 0 && !selSuper.has(superv)) continue;

            const saleMonth = String(c._contractMonth || monthFromDate(c.date) || 'S/D');
            if (!saleMonth || saleMonth === 'S/D') continue;
            if (cutoffSerial > 0 && monthToSerial(saleMonth) > cutoffSerial) continue;
            contractsById[cId] = c;
            if (!contractIdsBySaleMonth[saleMonth]) contractIdsBySaleMonth[saleMonth] = new Set();
            contractIdsBySaleMonth[saleMonth].add(cId);
        }

        const carteraCutoffById = {};
        for (let i = 0; i < state.cartera.data.length; i++) {
            const r = state.cartera.data[i];
            const cId = String(r._cId || '');
            if (!cId || !contractsById[cId]) continue;
            if (String(r._feNorm || '') !== cutoff) continue;
            if (!carteraCutoffById[cId]) carteraCutoffById[cId] = r;
        }

        const cobCutoffById = {};
        const cobByKeyAmount = getCobranzasAggregates().byKeyAmount;
        const contractKeys = Object.keys(contractsById);
        for (let i = 0; i < contractKeys.length; i++) {
            const cId = contractKeys[i];
            cobCutoffById[cId] = cobByKeyAmount[`${cId}_${cutoff}`] || 0;
        }

        const bySaleMonth = {};
        const saleMonths = Object.keys(contractIdsBySaleMonth).sort((a, b) => monthToSerial(a) - monthToSerial(b));
        for (let i = 0; i < saleMonths.length; i++) {
            const saleMonth = saleMonths[i];
            const ids = [...contractIdsBySaleMonth[saleMonth]];
            bySaleMonth[saleMonth] = {
                activos: 0,
                pagaron: 0,
                deberia: 0,
                cobrado: 0
            };

            for (let j = 0; j < ids.length; j++) {
                const cId = ids[j];
                const contract = contractsById[cId];
                if (!contract) continue;

                const cartRow = carteraCutoffById[cId] || null;
                if (!cartRow) continue;
                const via = normalizeViaCobro(cartRow.via_de_cobro);
                if (selViaCobro.size > 0 && !selViaCobro.has(via)) continue;
                const tramoNum = parseInt(cartRow.tramo, 10) || 0;
                const cat = tramoNum <= 3 ? 'VIGENTE' : 'MOROSO';
                if (selCat.size > 0 && !selCat.has(cat)) continue;

                if (!isActiveAtCutoff(contract, cutoff)) continue;

                bySaleMonth[saleMonth].activos += 1;
                if (cartRow) {
                    bySaleMonth[saleMonth].deberia += (parseFloat(cartRow.monto_cuota) || 0) + (parseFloat(cartRow.monto_vencido) || 0);
                }
                const paid = cobCutoffById[cId] || 0;
                bySaleMonth[saleMonth].cobrado += paid;
                if (paid > 0) bySaleMonth[saleMonth].pagaron += 1;
            }
        }

        updateAnalisisCobranzaUI({
            cutoff,
            bySaleMonth,
            selUn,
            selViaCobro,
            selCat,
            selSuper
        });
    }

    async function calculateCulminados() {
        await ensureContratosLoaded();
        await ensureCarteraLoaded();
        await ensureCobranzasLoaded();
        if (!state.contratos.data.length || !state.cartera.data.length || !state.cobranzas.data.length) return;

        if (!state.culminados.filtersInitialized) {
            const contractsCul = state.contratos.data.filter(r => String(r._culminacionMonth || '').trim() !== '');
            const cutoffs = [...new Set([
                ...state.cartera.data.map(r => String(r._feNorm || '')),
                ...contractsCul.map(r => String(r._culminacionMonth || ''))
            ].filter(v => /^\d{2}\/\d{4}$/.test(v)))].sort((a, b) => monthToSerial(a) - monthToSerial(b));
            const uns = [...new Set(contractsCul.map(r => String(r.UN || 'S/D')).filter(Boolean))].sort();
            const fechas = [...new Set(contractsCul.map(r => String(r._contractMonth || 'S/D')).filter(v => /^\d{2}\/\d{4}$/.test(v)))]
                .sort((a, b) => monthToSerial(a) - monthToSerial(b));
            const viasCobroDetalle = [...new Set(state.cartera.data.map(r => String(r.via_de_cobro || 'S/D').trim() || 'S/D'))].sort();
            const defaultCutoff = cutoffs.length ? cutoffs[cutoffs.length - 1] : 'S/D';
            state.culminados.defaultCutoff = defaultCutoff;
            setupSingleSelectFilter('cu-cutoff', cutoffs, 'culminados', defaultCutoff);
            setupFilter('cu-un', uns, 'culminados');
            setupFilter('cu-fecha', fechas, 'culminados');
            setupFilter('cu-cat', ['VIGENTE', 'MOROSO'], 'culminados');
            setupFilter('cu-via-cobro', viasCobroDetalle, 'culminados');

            document.getElementById('reset-cu').onclick = () => { resetCulminadosFilters(); };
            snapshotAppliedFilters('culminados');
            state.culminados.filtersInitialized = true;
        }

        const selCutoff = getAppliedSelected('culminados', 'cu-cutoff');
        const selUn = getAppliedSelected('culminados', 'cu-un');
        const selFecha = getAppliedSelected('culminados', 'cu-fecha');
        const selCat = getAppliedSelected('culminados', 'cu-cat');
        const selViaCobro = getAppliedSelected('culminados', 'cu-via-cobro');
        const cutoff = [...selCutoff][0] || state.culminados.defaultCutoff || 'S/D';
        const cutoffSerial = monthToSerial(cutoff);

        const summary = document.getElementById('cu-selection-summary');
        if (summary) {
            const unLabel = getSelectionLabel('cu-un', selUn, 'Todas');
            const fechaLabel = getSelectionLabel('cu-fecha', selFecha, 'Historia');
            const catLabel = getSelectionLabel('cu-cat', selCat, 'Todas');
            const viaLabel = getSelectionLabel('cu-via-cobro', selViaCobro, 'Todas');
            summary.innerHTML = `<strong>Selección actual:</strong> Corte: ${cutoff} | UN: ${unLabel} | Mes/Año Venta: ${fechaLabel} | Categoría: ${catLabel} | Vía Cobro: ${viaLabel}`;
        }

        const carteraByContractMonth = {};
        for (let i = 0; i < state.cartera.data.length; i++) {
            const r = state.cartera.data[i];
            const cId = String(r._cId || '');
            const mm = String(r._feNorm || '');
            if (!cId || !mm) continue;
            if (!carteraByContractMonth[cId]) carteraByContractMonth[cId] = {};
            if (!carteraByContractMonth[cId][mm]) carteraByContractMonth[cId][mm] = r;
        }

        const cobByContractMonth = getCobranzasAggregates().byContractMonth;

        const stats = {
            totalContracts: 0,
            totalCobrado: 0,
            totalDeberia: 0,
            totalMonths: 0,
            avgMonthlyCobro: 0,
            payRate: 0,
            ltv: 0,
            monthsWeighted: 0,
            byGestionStatus: {},
            rows: []
        };
        const group = {};
        let weightedMonthsNumerator = 0;

        for (let i = 0; i < state.contratos.data.length; i++) {
            const c = state.contratos.data[i];
            const cId = String(c._cId || '');
            const un = String(c.UN || 'S/D');
            const saleMonth = String(c._contractMonth || monthFromDate(c.date) || '');
            const culmMonth = String(c._culminacionMonth || '');
            if (!cId || !saleMonth || !culmMonth) continue;
            const culmSerial = monthToSerial(culmMonth);
            // Filtros base del informe de culminados.
            if (selUn.size > 0 && !selUn.has(un)) continue;
            if (selFecha.size > 0 && !selFecha.has(saleMonth)) continue;

            const monthRows = carteraByContractMonth[cId] || {};
            const culmRow = monthRows[culmMonth] || null;
            const tramoCulm = parseInt(culmRow ? culmRow.tramo : NaN, 10);
            const catCulm = Number.isNaN(tramoCulm) ? 'S/D' : (tramoCulm <= 3 ? 'VIGENTE' : 'MOROSO');
            const viaCulm = culmRow ? (String(culmRow.via_de_cobro || 'S/D').trim() || 'S/D') : 'S/D';
            if (selCat.size > 0 && !selCat.has(catCulm)) continue;
            if (selViaCobro.size > 0 && !selViaCobro.has(viaCulm)) continue;

            if (/^\d{2}\/\d{4}$/.test(culmMonth)) {
                if (!stats.byGestionStatus[culmMonth]) stats.byGestionStatus[culmMonth] = { vigente: 0, moroso: 0 };
                if (catCulm === 'VIGENTE') stats.byGestionStatus[culmMonth].vigente += 1;
                if (catCulm === 'MOROSO') stats.byGestionStatus[culmMonth].moroso += 1;
            }

            // Mantener comportamiento histórico del bloque principal: corte mensual exacto.
            if (cutoffSerial > 0 && culmSerial !== cutoffSerial) continue;

            const cutoffRow = monthRows[cutoff] || null;
            const tramo = parseInt(cutoffRow ? cutoffRow.tramo : NaN, 10);
            const cat = Number.isNaN(tramo) ? 'S/D' : (tramo <= 3 ? 'VIGENTE' : 'MOROSO');
            const via = cutoffRow ? (String(cutoffRow.via_de_cobro || 'S/D').trim() || 'S/D') : 'S/D';
            if (selCat.size > 0 && !selCat.has(cat)) continue;
            if (selViaCobro.size > 0 && !selViaCobro.has(via)) continue;

            const cuota = cutoffRow ? (parseFloat(cutoffRow.monto_cuota) || 0) : (parseFloat(c._montoCuota) || 0);
            const months = monthsBetweenDateAndMonth(String(c.date || ''), culmMonth);
            const deberia = cuota * months;
            const cobrado = sumCobradoBetweenMonths(cobByContractMonth[cId] || {}, saleMonth, culmMonth);
            const key = `${saleMonth}||${un}||${cat}`;
            if (!group[key]) group[key] = { saleMonth, un, cat, contracts: 0, cobrado: 0, deberia: 0, monthsNum: 0, monthsSum: 0 };

            group[key].contracts += 1;
            group[key].cobrado += cobrado;
            group[key].deberia += deberia;
            group[key].monthsNum += (months * deberia);
            group[key].monthsSum += months;

            stats.totalContracts += 1;
            stats.totalCobrado += cobrado;
            stats.totalDeberia += deberia;
            stats.totalMonths += months;
            weightedMonthsNumerator += (months * deberia);
        }

        stats.payRate = stats.totalDeberia > 0 ? (stats.totalCobrado / stats.totalDeberia) : 0;
        stats.monthsWeighted = stats.totalDeberia > 0 ? (weightedMonthsNumerator / stats.totalDeberia) : 0;
        stats.ltv = stats.payRate * stats.monthsWeighted;
        stats.avgMonthlyCobro = stats.totalMonths > 0 ? (stats.totalCobrado / stats.totalMonths) : 0;

        stats.rows = Object.values(group).map(r => {
            const pct = r.deberia > 0 ? (r.cobrado / r.deberia) : 0;
            const monthsPond = r.deberia > 0 ? (r.monthsNum / r.deberia) : 0;
            const avgMonthlyCobro = r.monthsSum > 0 ? (r.cobrado / r.monthsSum) : 0;
            return {
                saleMonth: r.saleMonth,
                un: r.un,
                cat: r.cat,
                contracts: r.contracts,
                cobrado: r.cobrado,
                avgMonthlyCobro,
                payRate: pct,
                ltv: pct * monthsPond
            };
        }).sort((a, b) => {
            const m = monthToSerial(a.saleMonth) - monthToSerial(b.saleMonth);
            if (m !== 0) return m;
            if (a.un !== b.un) return a.un.localeCompare(b.un);
            return a.cat.localeCompare(b.cat);
        });

        updateCulminadosUI(stats);
    }

    function updateLtvSelectionSummary(selUn, selAnio, selFecha, selGestion, selViaCobro, selSuper) {
        const el = document.getElementById('ltv-selection-summary');
        if (!el) return;

        const labels = {
            un: getSelectionLabel('ltv-un', selUn, 'Todas'),
            anio: getSelectionLabel('ltv-anio', selAnio, 'Todos'),
            fecha: getSelectionLabel('ltv-fecha', selFecha, 'Historia'),
            gestion: getSelectionLabel('ltv-gestion', selGestion, 'Historia'),
            viaCobro: getSelectionLabel('ltv-via-cobro', selViaCobro, 'Todas'),
            super: getSelectionLabel('ltv-super', selSuper, 'Todos')
        };

        el.innerHTML = `<strong>Seleccion actual:</strong> UN: ${labels.un} | Anio: ${labels.anio} | Mes/Anio: ${labels.fecha} | Gestion: ${labels.gestion} | Via Cobro: ${labels.viaCobro} | Supervisor: ${labels.super}`;
    }

    function getSelectionLabel(filterId, selectedSet, allLabel) {
        const allOptions = [...document.querySelectorAll(`.${filterId}-cb`)]
            .filter(c => !c.disabled)
            .map(c => String(c.value));
        const selected = allOptions.filter(v => selectedSet.has(v));

        if (selected.length === 0 || selected.length === allOptions.length) return allLabel;
        if (selected.length <= 3) return selected.join(', ');
        return `${selected.length} seleccionados`;
    }

    function getYearFromGestionMonth(mmYYYY) {
        const m = String(mmYYYY || '').match(/^\d{2}\/(\d{4})$/);
        return m ? m[1] : '';
    }

    function syncAcaFechaByYear(opts = {}) {
        const markDirty = opts.markDirty === true;
        const ensureSelection = opts.ensureSelection !== false;
        const selectedYears = getSelected('aca-anio');
        const fechaOptions = document.getElementById('aca-fecha-options');
        const fechaAll = document.getElementById('aca-fecha-all');
        const fechaCount = document.getElementById('aca-fecha-count');
        if (!fechaOptions || !fechaAll || !fechaCount) return;

        const labels = [...fechaOptions.querySelectorAll('label')];
        let visibleCount = 0;
        let checkedVisibleCount = 0;

        for (let i = 0; i < labels.length; i++) {
            const label = labels[i];
            const cb = label.querySelector('input.aca-fecha-cb');
            if (!cb) continue;
            const year = getYearFromGestionMonth(cb.value);
            const visible = selectedYears.size === 0 || selectedYears.has(year);
            label.style.display = visible ? '' : 'none';
            cb.disabled = !visible;
            if (!visible && cb.checked) cb.checked = false;
            if (visible) {
                visibleCount += 1;
                if (cb.checked) checkedVisibleCount += 1;
            }
        }

        if (ensureSelection && visibleCount > 0 && checkedVisibleCount === 0) {
            for (let i = 0; i < labels.length; i++) {
                const label = labels[i];
                if (label.style.display === 'none') continue;
                const cb = label.querySelector('input.aca-fecha-cb');
                if (!cb) continue;
                cb.checked = true;
            }
            checkedVisibleCount = visibleCount;
        }

        fechaAll.checked = visibleCount > 0 && checkedVisibleCount === visibleCount;
        fechaCount.textContent = (visibleCount > 0 && checkedVisibleCount === visibleCount)
            ? 'Historia'
            : `${checkedVisibleCount} sel.`;

        if (markDirty) setTabDirty('analisisCartera', true);
    }

    function bindAcaYearToFechaSync() {
        if (state.analisisCartera.yearFechaSyncBound) return;
        const anioOptions = document.getElementById('aca-anio-options');
        const anioAll = document.getElementById('aca-anio-all');
        const fechaOptions = document.getElementById('aca-fecha-options');
        const fechaAll = document.getElementById('aca-fecha-all');

        if (anioOptions) {
            anioOptions.addEventListener('change', (e) => {
                if (!e.target || e.target.type !== 'checkbox') return;
                syncAcaFechaByYear({ markDirty: true, ensureSelection: true });
            });
        }
        if (anioAll) {
            anioAll.addEventListener('change', () => {
                syncAcaFechaByYear({ markDirty: true, ensureSelection: true });
            });
        }
        if (fechaOptions) {
            fechaOptions.addEventListener('change', (e) => {
                if (!e.target || e.target.type !== 'checkbox') return;
                syncAcaFechaByYear({ markDirty: true, ensureSelection: false });
            });
        }
        if (fechaAll) {
            fechaAll.addEventListener('change', () => {
                syncAcaFechaByYear({ markDirty: true, ensureSelection: false });
            });
        }

        state.analisisCartera.yearFechaSyncBound = true;
    }

    function syncAcamFechaByYear(opts = {}) {
        const markDirty = opts.markDirty === true;
        const ensureSelection = opts.ensureSelection !== false;
        const selectedYears = getSelected('acam-anio');
        const fechaOptions = document.getElementById('acam-fecha-options');
        const fechaAll = document.getElementById('acam-fecha-all');
        const fechaCount = document.getElementById('acam-fecha-count');
        if (!fechaOptions || !fechaAll || !fechaCount) return;

        const labels = [...fechaOptions.querySelectorAll('label')];
        let visibleCount = 0;
        let checkedVisibleCount = 0;

        for (let i = 0; i < labels.length; i++) {
            const label = labels[i];
            const cb = label.querySelector('input.acam-fecha-cb');
            if (!cb) continue;
            const year = getYearFromGestionMonth(cb.value);
            const visible = selectedYears.size === 0 || selectedYears.has(year);
            label.style.display = visible ? '' : 'none';
            cb.disabled = !visible;
            if (!visible && cb.checked) cb.checked = false;
            if (visible) {
                visibleCount += 1;
                if (cb.checked) checkedVisibleCount += 1;
            }
        }

        if (ensureSelection && visibleCount > 0 && checkedVisibleCount === 0) {
            for (let i = 0; i < labels.length; i++) {
                const label = labels[i];
                if (label.style.display === 'none') continue;
                const cb = label.querySelector('input.acam-fecha-cb');
                if (!cb) continue;
                cb.checked = true;
            }
            checkedVisibleCount = visibleCount;
        }

        fechaAll.checked = visibleCount > 0 && checkedVisibleCount === visibleCount;
        fechaCount.textContent = (visibleCount > 0 && checkedVisibleCount === visibleCount)
            ? 'Historia'
            : `${checkedVisibleCount} sel.`;

        if (markDirty) setTabDirty('acaMovimiento', true);
    }

    function bindAcamYearToFechaSync() {
        if (state.acaMovimiento.yearFechaSyncBound) return;
        const anioOptions = document.getElementById('acam-anio-options');
        const anioAll = document.getElementById('acam-anio-all');
        const fechaOptions = document.getElementById('acam-fecha-options');
        const fechaAll = document.getElementById('acam-fecha-all');

        if (anioOptions) {
            anioOptions.addEventListener('change', (e) => {
                if (!e.target || e.target.type !== 'checkbox') return;
                syncAcamFechaByYear({ markDirty: true, ensureSelection: true });
            });
        }
        if (anioAll) {
            anioAll.addEventListener('change', () => {
                syncAcamFechaByYear({ markDirty: true, ensureSelection: true });
            });
        }
        if (fechaOptions) {
            fechaOptions.addEventListener('change', (e) => {
                if (!e.target || e.target.type !== 'checkbox') return;
                syncAcamFechaByYear({ markDirty: true, ensureSelection: false });
            });
        }
        if (fechaAll) {
            fechaAll.addEventListener('change', () => {
                syncAcamFechaByYear({ markDirty: true, ensureSelection: false });
            });
        }
        state.acaMovimiento.yearFechaSyncBound = true;
    }

    function syncAcaaMesContratoByYear(opts = {}) {
        const markDirty = opts.markDirty === true;
        const ensureSelection = opts.ensureSelection !== false;
        const selectedYears = getSelected('acaa-anio');
        const mesOptions = document.getElementById('acaa-mes-contrato-options');
        const mesAll = document.getElementById('acaa-mes-contrato-all');
        const mesCount = document.getElementById('acaa-mes-contrato-count');
        if (!mesOptions || !mesAll || !mesCount) return;

        const labels = [...mesOptions.querySelectorAll('label')];
        let visibleCount = 0;
        let checkedVisibleCount = 0;

        for (let i = 0; i < labels.length; i++) {
            const label = labels[i];
            const cb = label.querySelector('input.acaa-mes-contrato-cb');
            if (!cb) continue;
            const year = getYearFromGestionMonth(cb.value);
            const visible = selectedYears.size === 0 || selectedYears.has(year);
            label.style.display = visible ? '' : 'none';
            cb.disabled = !visible;
            if (!visible && cb.checked) cb.checked = false;
            if (visible) {
                visibleCount += 1;
                if (cb.checked) checkedVisibleCount += 1;
            }
        }

        if (ensureSelection && visibleCount > 0 && checkedVisibleCount === 0) {
            for (let i = 0; i < labels.length; i++) {
                const label = labels[i];
                if (label.style.display === 'none') continue;
                const cb = label.querySelector('input.acaa-mes-contrato-cb');
                if (!cb) continue;
                cb.checked = true;
            }
            checkedVisibleCount = visibleCount;
        }

        mesAll.checked = visibleCount > 0 && checkedVisibleCount === visibleCount;
        mesCount.textContent = (visibleCount > 0 && checkedVisibleCount === visibleCount)
            ? 'Todos'
            : `${checkedVisibleCount} sel.`;

        if (markDirty) setTabDirty('acaAnuales', true);
    }

    function bindAcaaYearToMesContratoSync() {
        if (state.acaAnuales.yearMesContratoSyncBound) return;
        const anioOptions = document.getElementById('acaa-anio-options');
        const anioAll = document.getElementById('acaa-anio-all');
        const mesOptions = document.getElementById('acaa-mes-contrato-options');
        const mesAll = document.getElementById('acaa-mes-contrato-all');

        if (anioOptions) {
            anioOptions.addEventListener('change', (e) => {
                if (!e.target || e.target.type !== 'checkbox') return;
                syncAcaaMesContratoByYear({ markDirty: true, ensureSelection: true });
            });
        }
        if (anioAll) {
            anioAll.addEventListener('change', () => {
                syncAcaaMesContratoByYear({ markDirty: true, ensureSelection: true });
            });
        }
        if (mesOptions) {
            mesOptions.addEventListener('change', (e) => {
                if (!e.target || e.target.type !== 'checkbox') return;
                syncAcaaMesContratoByYear({ markDirty: true, ensureSelection: false });
            });
        }
        if (mesAll) {
            mesAll.addEventListener('change', () => {
                syncAcaaMesContratoByYear({ markDirty: true, ensureSelection: false });
            });
        }
        state.acaAnuales.yearMesContratoSyncBound = true;
    }

    function updateLtvAgeSelectionSummary(selUn, selAnio, selFecha, selViaCobro, selSuper, nMonths) {
        const el = document.getElementById('ltva-selection-summary');
        if (!el) return;
        const labels = {
            un: getSelectionLabel('ltva-un', selUn, 'Todas'),
            anio: getSelectionLabel('ltva-anio', selAnio, 'Todos'),
            fecha: getSelectionLabel('ltva-fecha', selFecha, 'Historia'),
            viaCobro: getSelectionLabel('ltva-via-cobro', selViaCobro, 'Todas'),
            super: getSelectionLabel('ltva-super', selSuper, 'Todos')
        };
        el.innerHTML = `<strong>Seleccion actual:</strong> UN: ${labels.un} | Anio: ${labels.anio} | Mes/Anio: ${labels.fecha} | Via Cobro: ${labels.viaCobro} | Supervisor: ${labels.super} | Antiguedad: ${nMonths} meses`;
    }

    function updateLtvAgeUI(stats) {
        document.getElementById('ltva-total-contracts').textContent = (stats.totalContracts || 0).toLocaleString();
        document.getElementById('ltva-total-deberia').textContent = formatPYG(stats.totalDeberia || 0);
        document.getElementById('ltva-total-cobrado').textContent = formatPYG(stats.totalCobrado || 0);
        document.getElementById('ltva-pay-rate').textContent = `${((stats.payRate || 0) * 100).toFixed(1)}%`;
        document.getElementById('ltva-ltv-value').textContent = (stats.ltvValue || 0).toFixed(2);
        renderLtvAgeTable(stats.bySaleMonth || {}, stats.nMonths || 12);
    }

    function renderLtvAgeTable(bySaleMonth, nMonths) {
        const tbody = document.getElementById('ltva-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        const months = Object.keys(bySaleMonth).sort((a, b) => monthToSerial(a) - monthToSerial(b));
        for (let i = 0; i < months.length; i++) {
            const m = months[i];
            const row = bySaleMonth[m];
            const payRate = row.deberia > 0 ? (row.cobrado / row.deberia) : 0;
            const ltv = payRate * nMonths;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${m}</td>
                <td>${(row.contracts || 0).toLocaleString()}</td>
                <td>${formatPYG(row.deberia || 0)}</td>
                <td>${formatPYG(row.cobrado || 0)}</td>
                <td>${(payRate * 100).toFixed(1)}%</td>
                <td>${ltv.toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        }
    }

    function updateAnalisisCobranzaUI(payload) {
        const cutoff = String(payload.cutoff || 'S/D');
        const bySaleMonth = payload.bySaleMonth || {};
        const selUn = payload.selUn || new Set();
        const selViaCobro = payload.selViaCobro || new Set();
        const selCat = payload.selCat || new Set();
        const selSuper = payload.selSuper || new Set();

        const summary = document.getElementById('ac-selection-summary');
        if (summary) {
            const unLabel = getSelectionLabel('ac-un', selUn, 'Todas');
            const viaLabel = getSelectionLabel('ac-via-cobro', selViaCobro, 'Todas');
            const catLabel = getSelectionLabel('ac-cat', selCat, 'Todas');
            const superLabel = getSelectionLabel('ac-super', selSuper, 'Todos');
            summary.innerHTML = `<strong>Seleccion actual:</strong> Corte: ${cutoff} | UN: ${unLabel} | Via Cobro: ${viaLabel} | Categoria: ${catLabel} | Supervisor: ${superLabel}`;
        }

        const cardsGrid = document.getElementById('ac-cards-grid');
        if (cardsGrid) {
            cardsGrid.innerHTML = '';
            cardsGrid.classList.add('ac-year-grid');
        }

        const tbody = document.getElementById('ac-table-body');
        if (tbody) tbody.innerHTML = '';

        const months = Object.keys(bySaleMonth).sort((a, b) => monthToSerial(a) - monthToSerial(b));
        const byYear = {};
        let totalActivos = 0;
        let totalPagaron = 0;
        let totalDeberia = 0;
        let totalCobrado = 0;
        for (let i = 0; i < months.length; i++) {
            const saleMonth = months[i];
            const baseRow = bySaleMonth[saleMonth] || {};
            totalActivos += baseRow.activos || 0;
            totalPagaron += baseRow.pagaron || 0;
            totalDeberia += baseRow.deberia || 0;
            totalCobrado += baseRow.cobrado || 0;
            const parts = saleMonth.split('/');
            const year = parts.length === 2 ? parts[1] : 'S/D';
            if (!byYear[year]) byYear[year] = [];
            byYear[year].push(saleMonth);
        }

        const monthName = (mm) => {
            const n = parseInt(mm, 10) || 0;
            return ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][n - 1] || mm;
        };

        const years = Object.keys(byYear).sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
        const setTxt = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        setTxt('ac-total-cobrado-monto', formatPYG(totalCobrado));
        setTxt('ac-total-cobrado-cant', `${totalPagaron.toLocaleString()} contratos pagaron`);
        setTxt('ac-total-deberia-monto', formatPYG(totalDeberia));
        setTxt('ac-total-deberia-cant', `${totalActivos.toLocaleString()} contratos activos`);

        for (let y = 0; y < years.length; y++) {
            const year = years[y];
            const saleMonthsOfYear = byYear[year].slice().sort((a, b) => {
                const ma = parseInt(String(a).split('/')[0], 10) || 0;
                const mb = parseInt(String(b).split('/')[0], 10) || 0;
                return mb - ma; // Descendente: Dic -> Ene
            });
            let yActivos = 0;
            let yPagaron = 0;
            let yDeberia = 0;
            let yCobrado = 0;

            for (let i = 0; i < saleMonthsOfYear.length; i++) {
                const row = bySaleMonth[saleMonthsOfYear[i]] || {};
                yActivos += row.activos || 0;
                yPagaron += row.pagaron || 0;
                yDeberia += row.deberia || 0;
                yCobrado += row.cobrado || 0;
            }
            const yPayContractsRate = yActivos > 0 ? (yPagaron / yActivos) : 0;
            const yCoverage = yDeberia > 0 ? (yCobrado / yDeberia) : 0;

            if (cardsGrid) {
                const yearCard = document.createElement('div');
                yearCard.className = 'ac-year-card';
                yearCard.innerHTML = `
                    <div class="ac-year-header">
                        <h3>${year}</h3>
                        <div class="ac-year-meta">${yPagaron.toLocaleString()} / ${yActivos.toLocaleString()} pagaron</div>
                    </div>
                    <div class="ac-year-kpis">
                        <span>%Pago Contratos: ${(yPayContractsRate * 100).toFixed(1)}%</span>
                        <span>Cobrado: ${formatPYG(yCobrado)}</span>
                        <span>Deberia: ${formatPYG(yDeberia)}</span>
                        <span>Cobertura: ${(yCoverage * 100).toFixed(1)}%</span>
                    </div>
                    <div class="ac-legend">
                        <span class="ac-dot ac-dot-low"></span><span>Baja &lt; 30%</span>
                        <span class="ac-dot ac-dot-mid"></span><span>Media 30% - 70%</span>
                        <span class="ac-dot ac-dot-high"></span><span>Alta &gt; 70%</span>
                    </div>
                    <div class="ac-honeycomb"></div>
                `;
                const honey = yearCard.querySelector('.ac-honeycomb');
                for (let i = 0; i < saleMonthsOfYear.length; i++) {
                    const saleMonth = saleMonthsOfYear[i];
                    const row = bySaleMonth[saleMonth];
                    const activos = row.activos || 0;
                    const pagaron = row.pagaron || 0;
                    const deberia = row.deberia || 0;
                    const cobrado = row.cobrado || 0;
                    const coverage = deberia > 0 ? (cobrado / deberia) : 0;
                    const payContractsRate = activos > 0 ? (pagaron / activos) : 0;
                    const mm = saleMonth.split('/')[0];
                    const hex = document.createElement('div');
                    let covClass = 'ac-hex-low';
                    if (coverage >= 0.7) covClass = 'ac-hex-high';
                    else if (coverage >= 0.3) covClass = 'ac-hex-mid';
                    hex.className = `ac-hex ${covClass}`;
                    hex.innerHTML = `
                        <div class="ac-hex-inner">
                            <span class="ac-hex-month">${monthName(mm)}</span>
                            <span class="ac-hex-value">${(coverage * 100).toFixed(1)}%</span>
                            <span class="ac-hex-sub">${(payContractsRate * 100).toFixed(0)}% ctr</span>
                        </div>
                    `;
                    honey.appendChild(hex);
                }
                cardsGrid.appendChild(yearCard);
            }
        }

        for (let i = 0; i < months.length; i++) {
            const saleMonth = months[i];
            const row = bySaleMonth[saleMonth];
            const activos = row.activos || 0;
            const pagaron = row.pagaron || 0;
            const deberia = row.deberia || 0;
            const cobrado = row.cobrado || 0;
            const payContractsRate = activos > 0 ? (pagaron / activos) : 0;
            const coverage = deberia > 0 ? (cobrado / deberia) : 0;

            if (tbody) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${saleMonth}</td>
                    <td>${activos.toLocaleString()}</td>
                    <td>${pagaron.toLocaleString()}</td>
                    <td>${(payContractsRate * 100).toFixed(1)}%</td>
                    <td>${formatPYG(deberia)}</td>
                    <td>${formatPYG(cobrado)}</td>
                    <td>${(coverage * 100).toFixed(1)}%</td>
                `;
                tbody.appendChild(tr);
            }
        }
    }

    function buildAcaMorosoMovement(selUn, selAnio, selFecha, selViaCobro, selCat) {
        if (tabModules.acaMovimiento && typeof tabModules.acaMovimiento.computeLocalMovement === 'function') {
            return tabModules.acaMovimiento.computeLocalMovement({
                state,
                selUn,
                selAnio,
                selFecha,
                selViaCobro,
                selCat,
                monthToSerial,
                getYearFromGestionMonth,
                normalizeViaCobro,
                addMonths
            });
        }
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

        if (!state.cartera.data.length) {
            result.reason = 'Movimiento de cartera requiere cartera.csv en memoria. Usa sincronizacion completa.';
            result.culVigReason = 'Culminados por estado requiere cartera.csv en memoria. Usa sincronizacion completa.';
            return result;
        }

        const byContractMonth = {};
        const byContractTimeline = {};
        for (let i = 0; i < state.cartera.data.length; i++) {
            const r = state.cartera.data[i];
            const cId = String(r._cId || '');
            const fe = String(r._feNorm || '');
            if (!cId || !/^\d{2}\/\d{4}$/.test(fe)) continue;

            const key = `${cId}_${fe}`;
            const tramo = parseInt(r.tramo, 10);
            const tramoNum = Number.isFinite(tramo) ? tramo : 0;
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
                continue;
            }

            const curr = byContractMonth[key];
            if (tramoNum > curr.tramo) curr.tramo = tramoNum;
            if ((curr.un === 'S/D' || !curr.un) && unVal) curr.un = unVal;
            if (viaVal === 'COBRADOR') curr.via = 'COBRADOR';
            curr.cuotaTotal += cuotaVal;
            curr.cuotaCount += cuotaCount;
        }

        const byContractMonthKeys = Object.keys(byContractMonth);
        for (let i = 0; i < byContractMonthKeys.length; i++) {
            const key = byContractMonthKeys[i];
            const row = byContractMonth[key];
            if (!row || !row.cId || !row.gestion) continue;
            if (!byContractTimeline[row.cId]) byContractTimeline[row.cId] = [];
            byContractTimeline[row.cId].push(row);
        }
        const timelineIds = Object.keys(byContractTimeline);
        for (let i = 0; i < timelineIds.length; i++) {
            const cId = timelineIds[i];
            byContractTimeline[cId].sort((a, b) => monthToSerial(a.gestion) - monthToSerial(b.gestion));
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
        }

        for (let i = 0; i < keys.length; i++) {
            const curr = byContractMonth[keys[i]];
            if (!curr || curr.tramo > 3) continue;

            const gestion = String(curr.gestion || '');
            if (!/^\d{2}\/\d{4}$/.test(gestion)) continue;
            if (selAnio.size > 0 && !selAnio.has(getYearFromGestionMonth(gestion))) continue;
            if (selFecha.size > 0 && !selFecha.has(gestion)) continue;
            if (selUn.size > 0 && !selUn.has(String(curr.un || 'S/D'))) continue;
            if (selViaCobro.size > 0 && !selViaCobro.has(String(curr.via || 'DEBITO'))) continue;

            byGestionVigenteCounts[gestion] = (byGestionVigenteCounts[gestion] || 0) + 1;
        }

        rows.sort((a, b) => {
            const monthCmp = monthToSerial(a.gestion) - monthToSerial(b.gestion);
            if (monthCmp !== 0) return monthCmp;
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

        if (!state.contratos.data.length) {
            result.culVigReason = 'Culminados por estado requiere contratos.csv en memoria. Sincroniza contratos.';
            return result;
        }

        const culStatusByGestion = {};
        const culUnknownByGestion = {};
        const culVigCandidateMonths = new Set();
        for (let i = 0; i < state.contratos.data.length; i++) {
            const c = state.contratos.data[i];
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
            const tramo = Number.isFinite(tramoRaw) ? tramoRaw : 0;
            culVigCandidateMonths.add(culmMonth);
            if (!culStatusByGestion[culmMonth]) culStatusByGestion[culmMonth] = { vigente: 0, moroso: 0 };
            if (!row || !Number.isFinite(tramoRaw)) {
                if (!allKnownCatsSelected) continue;
                culUnknownByGestion[culmMonth] = (culUnknownByGestion[culmMonth] || 0) + 1;
            } else {
                const catCulm = tramo <= 3 ? 'VIGENTE' : 'MOROSO';
                if (selCat.size > 0 && !selCat.has(catCulm)) continue;
                if (catCulm === 'VIGENTE') culStatusByGestion[culmMonth].vigente += 1;
                else culStatusByGestion[culmMonth].moroso += 1;
            }
        }

        const candidateMonths = Array.from(culVigCandidateMonths);
        for (let i = 0; i < candidateMonths.length; i++) {
            const month = candidateMonths[i];
            if (!Object.prototype.hasOwnProperty.call(culStatusByGestion, month)) {
                culStatusByGestion[month] = { vigente: 0, moroso: 0 };
            }
            if (!Object.prototype.hasOwnProperty.call(culUnknownByGestion, month)) {
                culUnknownByGestion[month] = 0;
            }
        }

        result.culVigAvailable = true;
        result.culStatusByGestion = culStatusByGestion;
        result.culUnknownByGestion = culUnknownByGestion;
        result.culVigByGestion = Object.fromEntries(
            Object.keys(culStatusByGestion).map((m) => [m, culStatusByGestion[m].vigente || 0])
        );
        if (Object.keys(culStatusByGestion).length === 0) {
            result.culVigReason = 'No se encontraron culminados para los filtros actuales.';
        }
        return result;
    }

    function mapMovementApiPayloadToUi(payload) {
        if (tabModules.acaMovimiento && typeof tabModules.acaMovimiento.mapApiPayloadToUi === 'function') {
            return tabModules.acaMovimiento.mapApiPayloadToUi(payload);
        }
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

    async function calculateAcaMovimiento() {
        await ensureContratosLoaded();
        await ensureCarteraLoaded();
        await ensureCobranzasLoaded();

        if (!state.acaMovimiento.filtersInitialized) {
            const uns = [...new Set(state.cartera.data.map(r => String(r.UN || 'S/D')).filter(Boolean))].sort();
            const fechasSet = new Set();
            for (let i = 0; i < state.cartera.data.length; i++) {
                const fe = String(state.cartera.data[i]._feNorm || '');
                if (/^\d{2}\/\d{4}$/.test(fe)) fechasSet.add(fe);
            }
            for (let i = 0; i < state.contratos.data.length; i++) {
                const fe = String(state.contratos.data[i]._culminacionMonth || '');
                if (/^\d{2}\/\d{4}$/.test(fe)) fechasSet.add(fe);
            }
            const fechas = [...fechasSet];
            fechas.sort((a, b) => monthToSerial(a) - monthToSerial(b));
            const anios = [...new Set(fechas.map(getYearFromGestionMonth).filter(Boolean))].sort();
            const viasCobro = ['COBRADOR', 'DEBITO'];
            setupFilter('acam-un', uns, 'acaMovimiento');
            setupFilter('acam-anio', anios, 'acaMovimiento');
            setupFilter('acam-fecha', fechas, 'acaMovimiento');
            setupFilter('acam-via-cobro', viasCobro, 'acaMovimiento');
            setupFilter('acam-cat', ['VIGENTE', 'MOROSO'], 'acaMovimiento');
            bindAcamYearToFechaSync();
            syncAcamFechaByYear({ markDirty: false, ensureSelection: true });
            document.getElementById('reset-acam').onclick = () => {
                resetFilters('acaMovimiento');
                syncAcamFechaByYear({ markDirty: false, ensureSelection: true });
            };
            snapshotAppliedFilters('acaMovimiento');
            state.acaMovimiento.filtersInitialized = true;
        }

        const selUn = getAppliedSelected('acaMovimiento', 'acam-un');
        const selAnio = getAppliedSelected('acaMovimiento', 'acam-anio');
        const selFecha = getAppliedSelected('acaMovimiento', 'acam-fecha');
        const selViaCobro = getAppliedSelected('acaMovimiento', 'acam-via-cobro');
        const selCat = getAppliedSelected('acaMovimiento', 'acam-cat');
        const summary = document.getElementById('acam-selection-summary');
        if (summary) {
            const unLabel = getSelectionLabel('acam-un', selUn, 'Todas');
            const anioLabel = getSelectionLabel('acam-anio', selAnio, 'Todos');
            const fechaLabel = getSelectionLabel('acam-fecha', selFecha, 'Historia');
            const viaLabel = getSelectionLabel('acam-via-cobro', selViaCobro, 'Todas');
            const catLabel = getSelectionLabel('acam-cat', selCat, 'Todas');
            if (tabModules.acaMovimiento && typeof tabModules.acaMovimiento.buildSelectionSummary === 'function') {
                summary.innerHTML = tabModules.acaMovimiento.buildSelectionSummary({
                    un: unLabel,
                    anio: anioLabel,
                    fecha: fechaLabel,
                    via: viaLabel,
                    cat: catLabel
                });
            } else {
                summary.innerHTML = `<strong>Selección actual:</strong> UN: ${unLabel} | Año Gestión: ${anioLabel} | Gestión: ${fechaLabel} | Vía Cobro: ${viaLabel} | Categoría: ${catLabel}`;
            }
        }

        let movement = null;
        const canUseMovementApi = useAnalyticsApi && analyticsApi && useApiMovimiento && tabModules.acaMovimientoApi;
        if (canUseMovementApi && enableMovementSeriesV2) {
            try {
                const apiPayload = await tabModules.acaMovimientoApi.fetch({
                    un: selUn,
                    anio: selAnio,
                    gestionMonth: selFecha,
                    viaCobro: selViaCobro,
                    categoria: selCat,
                    debug: debugMode ? '1' : ''
                });
                movement = mapMovementApiPayloadToUi(apiPayload);
                debugLog('acaMovimiento.api', {
                    filters: {
                        un: [...selUn],
                        anio: [...selAnio],
                        gestion: [...selFecha],
                        via: [...selViaCobro],
                        cat: [...selCat]
                    },
                    months: Object.keys(movement.byGestion || {}).length
                });
                trackApiOutcome('acaMovimiento', 'api_success');
            } catch (e) {
                trackApiOutcome('acaMovimiento', 'fallback_local');
                showWarning(`API analitica no disponible para Movimiento de Cartera. Fallback local: ${e.message || e}`);
            }
        }
        if (!movement) {
            movement = buildAcaMorosoMovement(selUn, selAnio, selFecha, selViaCobro, selCat);
            debugLog('acaMovimiento.local', {
                filters: {
                    un: [...selUn],
                    anio: [...selAnio],
                    gestion: [...selFecha],
                    via: [...selViaCobro],
                    cat: [...selCat]
                },
                months: Object.keys(movement.byGestion || {}).length
            });
        }
        updateAcaMovementUI(movement);
    }

    function updateAcaAnualesUI(rows) {
        const tbody = document.getElementById('acaa-table-body');
        if (!tbody) return;
        if (tabModules.acaAnuales && typeof tabModules.acaAnuales.renderTable === 'function') {
            tabModules.acaAnuales.renderTable(tbody, rows, { number: formatNumber, pyg: formatPYG });
            return;
        }
        tbody.innerHTML = '';
        if (!rows || rows.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="13" style="text-align:center; color:#94a3b8;">Sin datos para filtros seleccionados.</td>`;
            tbody.appendChild(tr);
            return;
        }
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${r.year}</td>
                <td>${formatNumber(r.contracts)}</td>
                <td>${formatNumber(r.contractsVigentes)}</td>
                <td>${formatPYG(r.tkpContrato)}</td>
                <td>${formatPYG(r.tkpTransaccional)}</td>
                <td>${formatPYG(r.tkpPago)}</td>
                <td>${formatNumber(r.culminados)}</td>
                <td>${formatNumber(r.culminadosVigentes)}</td>
                <td>${formatPYG(r.tkpContratoCulminado)}</td>
                <td>${formatPYG(r.tkpPagoCulminado)}</td>
                <td>${formatPYG(r.tkpContratoCulminadoVigente)}</td>
                <td>${formatPYG(r.tkpPagoCulminadoVigente)}</td>
                <td>${(r.ltvCulminadoVigente || 0).toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        }
    }

    async function calculateAcaAnuales() {
        await ensureContratosLoaded();
        await ensureCarteraLoaded();
        await ensureCobranzasLoaded();
        if (!state.cartera.data.length || !state.cobranzas.data.length || !state.contratos.data.length) {
            updateAcaAnualesUI([]);
            return;
        }

        if (!state.acaAnuales.filtersInitialized) {
            const uns = [...new Set(state.contratos.data.map(r => String(r.UN || 'S/D')).filter(Boolean))].sort();
            const mesesContrato = [...new Set(state.contratos.data
                .map(r => String(r._contractMonth || ''))
                .filter(v => /^\d{2}\/\d{4}$/.test(v))
            )].sort((a, b) => monthToSerial(a) - monthToSerial(b));
            const anios = [...new Set(mesesContrato.map(getYearFromGestionMonth).filter(Boolean))].sort();
            setupFilter('acaa-un', uns, 'acaAnuales');
            setupFilter('acaa-anio', anios, 'acaAnuales');
            setupFilter('acaa-mes-contrato', mesesContrato, 'acaAnuales');
            bindAcaaYearToMesContratoSync();
            syncAcaaMesContratoByYear({ markDirty: false, ensureSelection: true });
            document.getElementById('reset-acaa').onclick = () => {
                resetFilters('acaAnuales');
                syncAcaaMesContratoByYear({ markDirty: false, ensureSelection: true });
            };
            snapshotAppliedFilters('acaAnuales');
            state.acaAnuales.filtersInitialized = true;
        }

        const selUn = getAppliedSelected('acaAnuales', 'acaa-un');
        const selAnio = getAppliedSelected('acaAnuales', 'acaa-anio');
        const selMesContrato = getAppliedSelected('acaAnuales', 'acaa-mes-contrato');

        const allGestionMonths = [...new Set(state.cartera.data
            .map(r => String(r._feNorm || ''))
            .filter(v => /^\d{2}\/\d{4}$/.test(v))
        )].sort((a, b) => monthToSerial(a) - monthToSerial(b));
        const cutoffMonth = allGestionMonths.length ? allGestionMonths[allGestionMonths.length - 1] : '';
        const cutoffSerial = monthToSerial(cutoffMonth);
        if (cutoffSerial <= 0) {
            updateAcaAnualesUI([]);
            return;
        }

        const summary = document.getElementById('acaa-selection-summary');
        if (summary) {
            const unLabel = getSelectionLabel('acaa-un', selUn, 'Todas');
            const anioLabel = getSelectionLabel('acaa-anio', selAnio, 'Todos');
            const mesContratoLabel = getSelectionLabel('acaa-mes-contrato', selMesContrato, 'Todos');
            if (tabModules.acaAnuales && typeof tabModules.acaAnuales.buildSelectionSummary === 'function') {
                summary.innerHTML = tabModules.acaAnuales.buildSelectionSummary({
                    un: unLabel,
                    anio: anioLabel,
                    mesContrato: mesContratoLabel,
                    corte: cutoffMonth
                });
            } else {
                summary.innerHTML = `<strong>Selección actual:</strong> UN: ${unLabel} | Año: ${anioLabel} | Mes/Año Contrato: ${mesContratoLabel} | Corte: ${cutoffMonth}`;
            }
        }

        if (useAnalyticsApi && analyticsApi && useApiAnuales && tabModules.acaAnualesApi) {
            try {
                const payload = await tabModules.acaAnualesApi.fetch({
                    un: selUn,
                    anio: selAnio,
                    contractMonth: selMesContrato,
                    debug: debugMode ? '1' : ''
                });
                const apiRows = Array.isArray(payload && payload.rows) ? payload.rows : [];
                const apiCutoff = String((payload && payload.cutoff) || cutoffMonth || '');
                if (summary) {
                    const unLabel = getSelectionLabel('acaa-un', selUn, 'Todas');
                    const anioLabel = getSelectionLabel('acaa-anio', selAnio, 'Todos');
                    const mesContratoLabel = getSelectionLabel('acaa-mes-contrato', selMesContrato, 'Todos');
                    if (tabModules.acaAnuales && typeof tabModules.acaAnuales.buildSelectionSummary === 'function') {
                        summary.innerHTML = tabModules.acaAnuales.buildSelectionSummary({
                            un: unLabel,
                            anio: anioLabel,
                            mesContrato: mesContratoLabel,
                            corte: apiCutoff
                        });
                    } else {
                        summary.innerHTML = `<strong>Selección actual:</strong> UN: ${unLabel} | Año: ${anioLabel} | Mes/Año Contrato: ${mesContratoLabel} | Corte: ${apiCutoff}`;
                    }
                }
                debugLog('acaAnuales.api', {
                    filters: {
                        un: [...selUn],
                        anio: [...selAnio],
                        contractMonth: [...selMesContrato]
                    },
                    rows: apiRows.length,
                    cutoff: apiCutoff
                });
                trackApiOutcome('acaAnuales', 'api_success');
                updateAcaAnualesUI(apiRows);
                return;
            } catch (e) {
                trackApiOutcome('acaAnuales', 'fallback_local');
                showWarning(`API analitica no disponible para Analisis Anuales. Fallback local: ${e.message || e}`);
            }
        }

        const rows = (tabModules.acaAnuales && typeof tabModules.acaAnuales.computeLocalRows === 'function')
            ? tabModules.acaAnuales.computeLocalRows({
                carteraData: state.cartera.data,
                cobranzasData: state.cobranzas.data,
                contratosData: state.contratos.data,
                selUn,
                selAnio,
                selMesContrato,
                cutoffMonth,
                cutoffSerial,
                monthToSerial,
                getYearFromGestionMonth,
                monthFromDate,
                monthsBetweenDateAndMonth,
                sumCobradoBetweenMonths,
                getCobranzasAggregates
            })
            : [];
        updateAcaAnualesUI(rows);
    }

    async function calculateAnalisisCartera() {
        const hasAnalytics = state.analytics.data.length > 0;
        if (!hasAnalytics) {
            await ensureCarteraLoaded();
            await ensureContratosLoaded();
            await ensureCobranzasLoaded();
            if (!state.cartera.data.length) return;
        }

        if (!state.analisisCartera.filtersInitialized) {
            const uns = hasAnalytics
                ? [...new Set(state.analytics.data.map(r => String(r.un || 'S/D')).filter(Boolean))].sort()
                : [...new Set(state.cartera.data.map(r => String(r.UN || 'S/D')).filter(Boolean))].sort();
            const fechas = hasAnalytics
                ? [...new Set(state.analytics.data.map(r => String(r.gestion_month || '')).filter(v => /^\d{2}\/\d{4}$/.test(v)))]
                : [...new Set(state.cartera.data.map(r => String(r._feNorm || '')).filter(v => /^\d{2}\/\d{4}$/.test(v)))];
            fechas.sort((a, b) => monthToSerial(a) - monthToSerial(b));
            const anios = [...new Set(fechas.map(getYearFromGestionMonth).filter(Boolean))].sort();
            const viasCobro = ['COBRADOR', 'DEBITO'];
            const supervisors = hasAnalytics
                ? [...new Set(state.analytics.data.map(r => String(r.supervisor || 'S/D')).filter(Boolean))].sort()
                : getSupervisorOptions();
            setupFilter('aca-un', uns, 'analisisCartera');
            setupFilter('aca-anio', anios, 'analisisCartera');
            setupFilter('aca-fecha', fechas, 'analisisCartera');
            setupFilter('aca-via-cobro', viasCobro, 'analisisCartera');
            setupFilter('aca-super', supervisors, 'analisisCartera');
            setupFilter('aca-cat', ['VIGENTE', 'MOROSO'], 'analisisCartera');
            bindAcaYearToFechaSync();
            syncAcaFechaByYear({ markDirty: false, ensureSelection: true });
            document.getElementById('reset-aca').onclick = () => {
                resetFilters('analisisCartera');
                syncAcaFechaByYear({ markDirty: false, ensureSelection: true });
            };
            snapshotAppliedFilters('analisisCartera');
            state.analisisCartera.filtersInitialized = true;
        }

        const selUn = getAppliedSelected('analisisCartera', 'aca-un');
        const selAnio = getAppliedSelected('analisisCartera', 'aca-anio');
        const selFecha = getAppliedSelected('analisisCartera', 'aca-fecha');
        const selViaCobro = getAppliedSelected('analisisCartera', 'aca-via-cobro');
        const selSuper = getAppliedSelected('analisisCartera', 'aca-super');
        const selCat = getAppliedSelected('analisisCartera', 'aca-cat');
        const summary = document.getElementById('aca-selection-summary');
        if (summary) {
            const unLabel = getSelectionLabel('aca-un', selUn, 'Todas');
            const anioLabel = getSelectionLabel('aca-anio', selAnio, 'Todos');
            const fechaLabel = getSelectionLabel('aca-fecha', selFecha, 'Historia');
            const viaLabel = getSelectionLabel('aca-via-cobro', selViaCobro, 'Todas');
            const superLabel = getSelectionLabel('aca-super', selSuper, 'Todos');
            const catLabel = getSelectionLabel('aca-cat', selCat, 'Todas');
            summary.innerHTML = `<strong>Selección actual:</strong> UN: ${unLabel} | Año Gestión: ${anioLabel} | Gestión: ${fechaLabel} | Vía Cobro: ${viaLabel} | Supervisor: ${superLabel} | Categoría: ${catLabel}`;
        }

        const initTramoMetric = () => ({ debt: 0, paid: 0, contractsTotal: 0, contractsPaid: 0 });
        const initByGestionTramo = () => ({});

        const ensureByGestionTramoMonth = (container, gestionMonth) => {
            if (!container[gestionMonth]) {
                container[gestionMonth] = {
                    '0': initTramoMetric(),
                    '1': initTramoMetric(),
                    '2': initTramoMetric(),
                    '3': initTramoMetric()
                };
            }
            return container[gestionMonth];
        };

        const summarizeByGestionTramoFromAnalyticsRows = (rows) => {
            const byGestionTramo = initByGestionTramo();
            for (let i = 0; i < rows.length; i++) {
                const r = rows[i];
                const gestion = String(r.gestion_month || '');
                const tramoKey = String(parseInt(r.tramo, 10));
                if (!/^\d{2}\/\d{4}$/.test(gestion)) continue;
                const monthBucket = ensureByGestionTramoMonth(byGestionTramo, gestion);
                if (!(tramoKey in monthBucket)) continue;
                monthBucket[tramoKey].debt += r.debt_total || 0;
                monthBucket[tramoKey].paid += r._paid_selected || 0;
                monthBucket[tramoKey].contractsTotal += r.contracts_total || 0;
                monthBucket[tramoKey].contractsPaid += r._contracts_paid_selected || 0;
            }
            return byGestionTramo;
        };

        const summarizeByGestionTramoFromRawRows = () => {
            const byGestionTramo = initByGestionTramo();
            const cobAggr = getCobranzasAggregates().byKeyAmount;
            const paidSeenByBucket = {};
            const supervisorById = getSupervisorByContractId();

            for (let i = 0; i < state.cartera.data.length; i++) {
                const r = state.cartera.data[i];
                const un = String(r.UN || 'S/D');
                const fe = String(r._feNorm || '');
                if (selUn.size > 0 && !selUn.has(un)) continue;
                if (selAnio.size > 0 && !selAnio.has(getYearFromGestionMonth(fe))) continue;
                if (selFecha.size > 0 && !selFecha.has(fe)) continue;
                if (!/^\d{2}\/\d{4}$/.test(fe)) continue;

                const tramo = parseInt(r.tramo, 10) || 0;
                const tramoKey = String(tramo);
                const isVigente = tramo <= 3;
                const cat = isVigente ? 'VIGENTE' : 'MOROSO';
                const via = normalizeViaCobro(r.via_de_cobro);
                if (selViaCobro.size > 0 && !selViaCobro.has(via)) continue;
                if (selCat.size > 0 && !selCat.has(cat)) continue;
                const cId = String(r._cId || '');
                const supervisor = supervisorById[cId] || 'S/D';
                if (selSuper.size > 0 && !selSuper.has(supervisor)) continue;

                const monthBucket = ensureByGestionTramoMonth(byGestionTramo, fe);
                if (!(tramoKey in monthBucket)) continue;

                const debtRow = (parseFloat(r.monto_cuota) || 0) + (parseFloat(r.monto_vencido) || 0);
                monthBucket[tramoKey].contractsTotal += 1;
                monthBucket[tramoKey].debt += debtRow;

                if (!cId) continue;
                const paidKey = `${cId}_${fe}`;
                const bucketKey = `${fe}|${tramoKey}`;
                if (!paidSeenByBucket[bucketKey]) paidSeenByBucket[bucketKey] = new Set();
                if (paidSeenByBucket[bucketKey].has(paidKey)) continue;
                const paidAmt = cobAggr[paidKey] || 0;
                monthBucket[tramoKey].paid += paidAmt;
                if (paidAmt > 0) monthBucket[tramoKey].contractsPaid += 1;
                paidSeenByBucket[bucketKey].add(paidKey);
            }
            return byGestionTramo;
        };

        const filteredAnalytics = hasAnalytics
            ? getAnalyticsRowsFiltered({
                selUn,
                selAnio,
                selFecha,
                selViaCobro,
                selSuper,
                selCat
            })
            : null;
        const byGestionTramoFromAnalytics = hasAnalytics ? summarizeByGestionTramoFromAnalyticsRows(filteredAnalytics) : initByGestionTramo();
        const byGestionTramoFromRaw = hasAnalytics ? null : summarizeByGestionTramoFromRawRows();

        if (useAnalyticsApi && analyticsApi && useApiAnalisisCartera) {
            try {
                let apiSelFecha = selFecha;
                if (apiSelFecha.size === 0 && selAnio.size > 0) {
                    apiSelFecha = new Set(
                        [...document.querySelectorAll('.aca-fecha-cb')]
                            .map(c => String(c.value))
                            .filter(v => selAnio.has(getYearFromGestionMonth(v)))
                    );
                }
                const filters = {
                    un: selUn,
                    gestionMonth: apiSelFecha,
                    viaCobro: selViaCobro,
                    categoria: selCat,
                    supervisor: selSuper,
                    debug: debugMode ? '1' : ''
                };
                const apiAdapter = tabModules.analisisCarteraApi;
                let summaryApi;
                let trendApi;
                if (apiAdapter && apiAdapter.fetch) {
                    const payload = await apiAdapter.fetch(filters);
                    summaryApi = payload.summary || {};
                    trendApi = payload.trend || {};
                } else {
                    [summaryApi, trendApi] = await Promise.all([
                        analyticsApi.getSummary(filters),
                        analyticsApi.getTrend(filters)
                    ]);
                }

                updateAnalisisCarteraUI({
                    byGestion: trendApi.byGestion || {},
                    total: summaryApi.total || 0,
                    vigente: summaryApi.vigente || 0,
                    moroso: summaryApi.moroso || 0,
                    cobrador: summaryApi.cobrador || 0,
                    debito: summaryApi.debito || 0,
                    byGestionTramo: hasAnalytics ? byGestionTramoFromAnalytics : byGestionTramoFromRaw
                });
                trackApiOutcome('analisisCartera', 'api_success');
                return;
            } catch (e) {
                trackApiOutcome('analisisCartera', 'fallback_local');
                showWarning(`API analitica no disponible para Analisis Cartera. Fallback local: ${e.message || e}`);
            }
        }

        if (hasAnalytics) {
            const filtered = filteredAnalytics || [];
            const byGestion = {};
            let total = 0;
            let vigente = 0;
            let moroso = 0;
            let cobrador = 0;
            let debito = 0;
            for (let i = 0; i < filtered.length; i++) {
                const r = filtered[i];
                const m = r.gestion_month;
                if (!byGestion[m]) {
                    byGestion[m] = {
                        total: 0,
                        vigente: 0,
                        moroso: 0,
                        cobrador: 0,
                        debito: 0,
                        debt: 0,
                        paid: 0,
                        paidContracts: 0
                    };
                }
                const ct = r.contracts_total || 0;
                const cp = r._contracts_paid_selected || 0;
                const debt = r.debt_total || 0;
                const paid = r._paid_selected || 0;

                byGestion[m].total += ct;
                byGestion[m].debt += debt;
                byGestion[m].paid += paid;
                byGestion[m].paidContracts += cp;

                if (r.categoria === 'VIGENTE') byGestion[m].vigente += ct;
                else byGestion[m].moroso += ct;
                if (r.via_cobro === 'COBRADOR') byGestion[m].cobrador += ct;
                else byGestion[m].debito += ct;

                total += ct;
                if (r.categoria === 'VIGENTE') vigente += ct;
                else moroso += ct;
                if (r.via_cobro === 'COBRADOR') cobrador += ct;
                else debito += ct;
            }
            updateAnalisisCarteraUI({
                byGestion,
                total,
                vigente,
                moroso,
                cobrador,
                debito,
                byGestionTramo: byGestionTramoFromAnalytics
            });
            return;
        }

        const contractById = getContractsByIdMap();
        const supervisorById = getSupervisorByContractId();

        const byGestion = {};
        const cobAggr = getCobranzasAggregates().byKeyAmount;
        let total = 0;
        let vigente = 0;
        let moroso = 0;
        let cobrador = 0;
        let debito = 0;

        for (let i = 0; i < state.cartera.data.length; i++) {
            const r = state.cartera.data[i];
            const un = String(r.UN || 'S/D');
            const fe = String(r._feNorm || '');
            if (selUn.size > 0 && !selUn.has(un)) continue;
            if (selAnio.size > 0 && !selAnio.has(getYearFromGestionMonth(fe))) continue;
            if (selFecha.size > 0 && !selFecha.has(fe)) continue;
            if (!/^\d{2}\/\d{4}$/.test(fe)) continue;

            const tramo = parseInt(r.tramo, 10) || 0;
            const isVigente = tramo <= 3;
            const cat = isVigente ? 'VIGENTE' : 'MOROSO';
            const via = normalizeViaCobro(r.via_de_cobro);
            if (selViaCobro.size > 0 && !selViaCobro.has(via)) continue;
            if (selCat.size > 0 && !selCat.has(cat)) continue;
            const cId = String(r._cId || '');
            const supervisor = supervisorById[cId] || 'S/D';
            if (selSuper.size > 0 && !selSuper.has(supervisor)) continue;

            if (!byGestion[fe]) {
                byGestion[fe] = {
                    total: 0, vigente: 0, moroso: 0, cobrador: 0, debito: 0,
                    culminadosMes: 0, entradas: 0, pasoVigMor: 0,
                    debt: 0, paid: 0,
                    ids: new Set(), vigIds: new Set(), morIds: new Set(), entryIds: new Set(), paidIds: new Set(),
                    paidContracts: 0
                };
            }
            byGestion[fe].total += 1;
            if (isVigente) byGestion[fe].vigente += 1;
            else byGestion[fe].moroso += 1;
            if (via === 'COBRADOR') byGestion[fe].cobrador += 1;
            else byGestion[fe].debito += 1;
            byGestion[fe].debt += (parseFloat(r.monto_cuota) || 0) + (parseFloat(r.monto_vencido) || 0);
            if (cId) {
                byGestion[fe].ids.add(cId);
                if (isVigente) byGestion[fe].vigIds.add(cId);
                else byGestion[fe].morIds.add(cId);
                const paidKey = `${cId}_${fe}`;
                if (!byGestion[fe].paidIds.has(paidKey)) {
                    const paidAmt = cobAggr[paidKey] || 0;
                    byGestion[fe].paid += paidAmt;
                    if (paidAmt > 0) byGestion[fe].paidContracts += 1;
                    byGestion[fe].paidIds.add(paidKey);
                }
                // Regla de ingreso: venta del mes comparada contra fecha de cierre del registro
                // (no contra fecha de gestion, por el desfase cierre->gestion).
                if (String(r._saleMonth || '') && String(r._cierreMonth || '') && String(r._saleMonth) === String(r._cierreMonth)) {
                    byGestion[fe].entryIds.add(cId);
                }
            }

            total += 1;
            if (isVigente) vigente += 1;
            else moroso += 1;
            if (via === 'COBRADOR') cobrador += 1;
            else debito += 1;
        }

        const months = Object.keys(byGestion).sort((a, b) => monthToSerial(a) - monthToSerial(b));
        let prevVigIds = new Set();
        for (let i = 0; i < months.length; i++) {
            const m = months[i];
            const row = byGestion[m];
            const currIds = row.ids || new Set();
            const currVigIds = row.vigIds || new Set();
            const currMorIds = row.morIds || new Set();
            row.entradas = (row.entryIds && row.entryIds.size) ? row.entryIds.size : 0;

            let culminadosMes = 0;
            currIds.forEach(id => {
                const c = contractById[id];
                if (c && String(c._culminacionMonth || '') === m) culminadosMes += 1;
            });
            row.culminadosMes = culminadosMes;

            let pasoVigMor = 0;
            currMorIds.forEach(id => { if (prevVigIds.has(id)) pasoVigMor += 1; });
            row.pasoVigMor = pasoVigMor;

            prevVigIds = new Set(currVigIds);
        }

        updateAnalisisCarteraUI({
            byGestion,
            total,
            vigente,
            moroso,
            cobrador,
            debito,
            byGestionTramo: byGestionTramoFromRaw
        });
    }

    function updateAnalisisCarteraUI(stats) {
        const setTxt = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        setTxt('aca-total', (stats.total || 0).toLocaleString());
        setTxt('aca-vigente', (stats.vigente || 0).toLocaleString());
        setTxt('aca-moroso', (stats.moroso || 0).toLocaleString());
        setTxt('aca-cobrador', (stats.cobrador || 0).toLocaleString());
        setTxt('aca-debito', (stats.debito || 0).toLocaleString());

        const months = Object.keys(stats.byGestion || {}).sort((a, b) => monthToSerial(a) - monthToSerial(b));
        const vigenteData = months.map(m => stats.byGestion[m].vigente || 0);
        const morosoData = months.map(m => stats.byGestion[m].moroso || 0);
        const cobradorData = months.map(m => stats.byGestion[m].cobrador || 0);
        const debitoData = months.map(m => stats.byGestion[m].debito || 0);
        const debtData = months.map(m => stats.byGestion[m].debt || 0);
        const paidData = months.map(m => stats.byGestion[m].paid || 0);
        const complianceData = months.map((m, i) => {
            const d = debtData[i] || 0;
            const p = paidData[i] || 0;
            return d > 0 ? Math.round((p / d) * 1000) / 10 : 0;
        });
        const totalContractsData = months.map(m => stats.byGestion[m].total || 0);
        const paidContractsData = months.map(m => stats.byGestion[m].paidContracts || 0);
        const complianceContractsData = months.map((m, i) => {
            const d = totalContractsData[i] || 0;
            const p = paidContractsData[i] || 0;
            return d > 0 ? Math.round((p / d) * 1000) / 10 : 0;
        });
        renderStackedChart('acaCatChart', 'analisisCartera', months, [
            { label: 'Vigente', data: vigenteData, backgroundColor: '#22c55e' },
            { label: 'Moroso', data: morosoData, backgroundColor: '#f59e0b' }
        ]);
        renderStackedChart('acaViaChart', 'analisisCartera', months, [
            { label: 'Cobrador', data: cobradorData, backgroundColor: '#38bdf8' },
            { label: 'Debito', data: debitoData, backgroundColor: '#a78bfa' }
        ]);

        const bubbleStyle = {
            padX: 7,
            padY: 4,
            radius: 6,
            font: '700 13px Outfit',
            textSize: 13
        };

        const getPercentBubbleMetrics = (ctx, text) => {
            ctx.save();
            ctx.font = bubbleStyle.font;
            const textW = ctx.measureText(text).width;
            ctx.restore();
            return {
                textW,
                boxW: textW + bubbleStyle.padX * 2,
                boxH: bubbleStyle.textSize + bubbleStyle.padY * 2
            };
        };

        const rectsOverlap = (a, b, pad = 2) => (
            a.left < b.right + pad &&
            a.right > b.left - pad &&
            a.top < b.bottom + pad &&
            a.bottom > b.top - pad
        );

        const overlapArea = (a, b) => {
            const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
            const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
            return w * h;
        };

        const placePercentBubble = (ctx, text, pt, chartArea, occupiedRects, sideOrder, yOffsets) => {
            const metrics = getPercentBubbleMetrics(ctx, text);
            const minX = chartArea.left + 2;
            const maxX = chartArea.right - metrics.boxW - 2;
            const minY = chartArea.top + metrics.boxH / 2 + 2;
            const maxY = chartArea.bottom - metrics.boxH / 2 - 2;
            let bestCandidate = null;
            let bestOverlap = Number.POSITIVE_INFINITY;

            for (let s = 0; s < sideOrder.length; s++) {
                const side = sideOrder[s];
                for (let yi = 0; yi < yOffsets.length; yi++) {
                    const dy = yOffsets[yi];
                    let x = pt.x + 8;
                    if (side === 'left') x = pt.x - metrics.boxW - 8;
                    if (side === 'center') x = pt.x - metrics.boxW / 2;
                    let y = pt.y + dy;

                    x = Math.max(minX, Math.min(maxX, x));
                    y = Math.max(minY, Math.min(maxY, y));

                    const rect = {
                        left: x,
                        right: x + metrics.boxW,
                        top: y - metrics.boxH / 2,
                        bottom: y + metrics.boxH / 2
                    };

                    let overlapScore = 0;
                    for (let r = 0; r < occupiedRects.length; r++) {
                        if (rectsOverlap(rect, occupiedRects[r], 2)) {
                            overlapScore += overlapArea(rect, occupiedRects[r]);
                        }
                    }

                    if (overlapScore === 0) {
                        occupiedRects.push(rect);
                        return { x, y };
                    }
                    if (overlapScore < bestOverlap) {
                        bestOverlap = overlapScore;
                        bestCandidate = { x, y, rect };
                    }
                }
            }

            if (bestCandidate) {
                occupiedRects.push(bestCandidate.rect);
                return { x: bestCandidate.x, y: bestCandidate.y };
            }

            const fallbackX = Math.max(minX, Math.min(maxX, pt.x + 8));
            const fallbackY = Math.max(minY, Math.min(maxY, pt.y - 12));
            occupiedRects.push({
                left: fallbackX,
                right: fallbackX + metrics.boxW,
                top: fallbackY - metrics.boxH / 2,
                bottom: fallbackY + metrics.boxH / 2
            });
            return { x: fallbackX, y: fallbackY };
        };

        const drawPercentBubble = (ctx, text, x, y) => {
            const metrics = getPercentBubbleMetrics(ctx, text);
            const left = x;
            const top = y - metrics.boxH / 2;

            ctx.save();
            ctx.font = bubbleStyle.font;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.beginPath();
            ctx.moveTo(left + bubbleStyle.radius, top);
            ctx.lineTo(left + metrics.boxW - bubbleStyle.radius, top);
            ctx.quadraticCurveTo(left + metrics.boxW, top, left + metrics.boxW, top + bubbleStyle.radius);
            ctx.lineTo(left + metrics.boxW, top + metrics.boxH - bubbleStyle.radius);
            ctx.quadraticCurveTo(left + metrics.boxW, top + metrics.boxH, left + metrics.boxW - bubbleStyle.radius, top + metrics.boxH);
            ctx.lineTo(left + bubbleStyle.radius, top + metrics.boxH);
            ctx.quadraticCurveTo(left, top + metrics.boxH, left, top + metrics.boxH - bubbleStyle.radius);
            ctx.lineTo(left, top + bubbleStyle.radius);
            ctx.quadraticCurveTo(left, top, left + bubbleStyle.radius, top);
            ctx.closePath();

            ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
            ctx.fill();
            ctx.lineWidth = 1.2;
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.95)';
            ctx.stroke();
            ctx.fillStyle = '#fbbf24';
            ctx.fillText(text, left + bubbleStyle.padX, y);
            ctx.restore();
        };

        const complianceLabelPlugin = {
            id: 'acaComplianceLabels',
            afterDatasetsDraw(chart) {
                const ctx = chart.ctx;
                const chartArea = chart.chartArea;
                const occupiedRects = [];
                const datasetIndex = chart.data.datasets.findIndex(d => d.label === 'Cumplimiento (%)');
                if (datasetIndex < 0) return;
                const meta = chart.getDatasetMeta(datasetIndex);
                if (!meta || !meta.data) return;

                for (let i = 0; i < meta.data.length; i++) {
                    const pt = meta.data[i];
                    const val = complianceData[i];
                    if (pt && Number.isFinite(val)) {
                        const text = `${val.toFixed(1)}%`;
                        const pos = placePercentBubble(
                            ctx,
                            text,
                            pt,
                            chartArea,
                            occupiedRects,
                            ['right', 'left', 'center'],
                            [-12, -24, 12, 24, -36, 36, 0]
                        );
                        drawPercentBubble(ctx, text, pos.x, pos.y);
                    }
                }
            }
        };

        const complianceLabelPluginContracts = {
            id: 'acaComplianceLabelsContracts',
            afterDatasetsDraw(chart) {
                const ctx = chart.ctx;
                const chartArea = chart.chartArea;
                const occupiedRects = [];
                const datasetIndex = chart.data.datasets.findIndex(d => d.label === 'Cumplimiento (%)');
                if (datasetIndex < 0) return;
                const meta = chart.getDatasetMeta(datasetIndex);
                if (!meta || !meta.data) return;

                for (let i = 0; i < meta.data.length; i++) {
                    const pt = meta.data[i];
                    const val = complianceContractsData[i];
                    if (pt && Number.isFinite(val)) {
                        const text = `${val.toFixed(1)}%`;
                        const pos = placePercentBubble(
                            ctx,
                            text,
                            pt,
                            chartArea,
                            occupiedRects,
                            ['right', 'left', 'center'],
                            [-12, -24, 12, 24, -36, 36, 0]
                        );
                        drawPercentBubble(ctx, text, pos.x, pos.y);
                    }
                }
            }
        };

        const barValueLabelPluginMoney = {
            id: 'acaBarValueLabelsMoney',
            afterDatasetsDraw(chart) {
                const ctx = chart.ctx;
                ctx.save();
                ctx.font = '11px Outfit';
                ctx.fillStyle = '#e2e8f0';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                chart.data.datasets.forEach((ds, datasetIndex) => {
                    if (ds.type !== 'bar') return;
                    const meta = chart.getDatasetMeta(datasetIndex);
                    if (!meta || meta.hidden) return;
                    for (let i = 0; i < meta.data.length; i++) {
                        const bar = meta.data[i];
                        const val = ds.data[i];
                        if (!bar || !Number.isFinite(val)) continue;
                        const x = bar.x;
                        const y = bar.y + (bar.base - bar.y) / 2;
                        const label = formatNumber(val);
                        ctx.save();
                        ctx.translate(x, y);
                        ctx.rotate(-Math.PI / 2);
                        ctx.fillText(label, 0, 0);
                        ctx.restore();
                    }
                });
                ctx.restore();
            }
        };

        const barValueLabelPluginContracts = {
            id: 'acaBarValueLabelsContracts',
            afterDatasetsDraw(chart) {
                const ctx = chart.ctx;
                ctx.save();
                ctx.font = '11px Outfit';
                ctx.fillStyle = '#e2e8f0';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                chart.data.datasets.forEach((ds, datasetIndex) => {
                    if (ds.type !== 'bar') return;
                    const meta = chart.getDatasetMeta(datasetIndex);
                    if (!meta || meta.hidden) return;
                    for (let i = 0; i < meta.data.length; i++) {
                        const bar = meta.data[i];
                        const val = ds.data[i];
                        if (!bar || !Number.isFinite(val)) continue;
                        const x = bar.x;
                        const y = bar.y + (bar.base - bar.y) / 2;
                        const label = formatNumber(val);
                        ctx.save();
                        ctx.translate(x, y);
                        ctx.rotate(-Math.PI / 2);
                        ctx.fillText(label, 0, 0);
                        ctx.restore();
                    }
                });
                ctx.restore();
            }
        };

        const lineTopPluginMoney = {
            id: 'acaComplianceLineTopMoney',
            afterDatasetsDraw(chart) {
                const idx = chart.data.datasets.findIndex(d => d.label === 'Cumplimiento (%)');
                if (idx < 0) return;
                const meta = chart.getDatasetMeta(idx);
                if (!meta || meta.hidden) return;
                const ctx = chart.ctx;
                ctx.save();
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#f59e0b';
                ctx.fillStyle = '#f59e0b';
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                ctx.beginPath();
                for (let i = 0; i < meta.data.length; i++) {
                    const pt = meta.data[i];
                    if (!pt) continue;
                    if (i === 0) ctx.moveTo(pt.x, pt.y);
                    else ctx.lineTo(pt.x, pt.y);
                }
                ctx.stroke();
                for (let i = 0; i < meta.data.length; i++) {
                    const pt = meta.data[i];
                    if (!pt) continue;
                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }
        };

        const lineTopPluginContracts = {
            id: 'acaComplianceLineTopContracts',
            afterDatasetsDraw(chart) {
                const idx = chart.data.datasets.findIndex(d => d.label === 'Cumplimiento (%)');
                if (idx < 0) return;
                const meta = chart.getDatasetMeta(idx);
                if (!meta || meta.hidden) return;
                const ctx = chart.ctx;
                ctx.save();
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#f59e0b';
                ctx.fillStyle = '#f59e0b';
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                ctx.beginPath();
                for (let i = 0; i < meta.data.length; i++) {
                    const pt = meta.data[i];
                    if (!pt) continue;
                    if (i === 0) ctx.moveTo(pt.x, pt.y);
                    else ctx.lineTo(pt.x, pt.y);
                }
                ctx.stroke();
                for (let i = 0; i < meta.data.length; i++) {
                    const pt = meta.data[i];
                    if (!pt) continue;
                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }
        };

        const moneyChartPlugins = showAcaChartLabels
            ? [barValueLabelPluginMoney, complianceLabelPlugin, lineTopPluginMoney]
            : [lineTopPluginMoney];

        renderMixedChart(
            'acaMoneyChart',
            'analisisCartera',
            months,
            [
                { type: 'bar', label: 'Monto a cobrar (Vencido + Cuota)', data: debtData, backgroundColor: '#0ea5e9', yAxisID: 'y', order: 1 },
                { type: 'bar', label: 'Monto cobrado', data: paidData, backgroundColor: '#22c55e', yAxisID: 'y', order: 2 },
                {
                    type: 'line',
                    label: 'Cumplimiento (%)',
                    data: complianceData,
                    borderColor: '#f59e0b',
                    backgroundColor: '#f59e0b',
                    yAxisID: 'y1',
                    tension: 0.25,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    pointBackgroundColor: '#f59e0b',
                    pointBorderColor: '#f59e0b',
                    order: 999,
                    borderWidth: 0
                }
            ],
            {
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: (v) => formatNumber(v) }
                    },
                    y1: {
                        beginAtZero: true,
                        min: 0,
                        max: 100,
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: {
                            callback: (v) => `${v}%`
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const label = ctx.dataset.label || '';
                                const val = ctx.parsed.y;
                                if (label.includes('%')) return `${label}: ${val.toFixed(1)}%`;
                                return `${label}: ${formatNumber(val)}`;
                            }
                        }
                    }
                }
            },
            moneyChartPlugins
        );

        const contractsChartPlugins = showAcaChartLabels
            ? [barValueLabelPluginContracts, complianceLabelPluginContracts, lineTopPluginContracts]
            : [lineTopPluginContracts];

        renderMixedChart(
            'acaContractsChart',
            'analisisCartera',
            months,
            [
                { type: 'bar', label: 'Contratos a cobrar', data: totalContractsData, backgroundColor: '#0ea5e9', yAxisID: 'y', order: 1 },
                { type: 'bar', label: 'Contratos cobrados', data: paidContractsData, backgroundColor: '#22c55e', yAxisID: 'y', order: 2 },
                {
                    type: 'line',
                    label: 'Cumplimiento (%)',
                    data: complianceContractsData,
                    borderColor: '#f59e0b',
                    backgroundColor: '#f59e0b',
                    yAxisID: 'y1',
                    tension: 0.25,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    pointBackgroundColor: '#f59e0b',
                    pointBorderColor: '#f59e0b',
                    order: 999,
                    borderWidth: 0
                }
            ],
            {
                scales: {
                    y: {
                        beginAtZero: true
                    },
                    y1: {
                        beginAtZero: true,
                        min: 0,
                        max: 100,
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: {
                            callback: (v) => `${v}%`
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const label = ctx.dataset.label || '';
                                const val = ctx.parsed.y;
                                if (label.includes('%')) return `${label}: ${val.toFixed(1)}%`;
                                return `${label}: ${formatNumber(val)}`;
                            }
                        }
                    }
                }
            },
            contractsChartPlugins
        );

        const tramoKeys = ['0', '1', '2', '3'];
        const tramoColors = {
            '0': '#22c55e',
            '1': '#38bdf8',
            '2': '#a78bfa',
            '3': '#f59e0b'
        };
        const byGestionTramo = stats.byGestionTramo || {};
        const tramoMonths = Object.keys(byGestionTramo).sort((a, b) => monthToSerial(a) - monthToSerial(b));

        const buildTramoComplianceSeries = (tramoKey, mode) => {
            return tramoMonths.map((m) => {
                const bucket = (byGestionTramo[m] && byGestionTramo[m][tramoKey]) ? byGestionTramo[m][tramoKey] : null;
                if (!bucket) return 0;
                if (mode === 'money') {
                    const d = bucket.debt || 0;
                    const p = bucket.paid || 0;
                    return d > 0 ? Math.round((p / d) * 1000) / 10 : 0;
                }
                const d = bucket.contractsTotal || 0;
                const p = bucket.contractsPaid || 0;
                return d > 0 ? Math.round((p / d) * 1000) / 10 : 0;
            });
        };

        const makeTramoLabelPlugin = (idSuffix) => ({
            id: `acaTramoComplianceLabels_${idSuffix}`,
            afterDatasetsDraw(chart) {
                if (!showAcaChartLabels) return;
                const ctx = chart.ctx;
                const chartArea = chart.chartArea;
                const occupiedRects = [];
                const points = [];
                const sideOrders = [
                    ['right', 'left', 'center'],
                    ['left', 'right', 'center'],
                    ['right', 'center', 'left'],
                    ['left', 'center', 'right']
                ];
                const yOffsetsByDataset = [
                    [-16, -30, 16, 30, -44, 44, 0],
                    [16, 30, -16, -30, 44, -44, 0],
                    [-10, 10, -24, 24, -38, 38, 0],
                    [10, -10, 24, -24, 38, -38, 0]
                ];

                for (let di = 0; di < chart.data.datasets.length; di++) {
                    const meta = chart.getDatasetMeta(di);
                    if (!meta || meta.hidden || !meta.data) continue;
                    const ds = chart.data.datasets[di];
                    for (let i = 0; i < meta.data.length; i++) {
                        const pt = meta.data[i];
                        const val = ds.data[i];
                        if (!pt || !Number.isFinite(val)) continue;
                        points.push({ di, i, pt, val: Number(val) });
                    }
                }

                points.sort((a, b) => {
                    if (a.i !== b.i) return a.i - b.i;
                    return a.pt.y - b.pt.y;
                });

                for (let pi = 0; pi < points.length; pi++) {
                    const p = points[pi];
                    const text = `${p.val.toFixed(1)}%`;
                    const sideOrder = sideOrders[p.di % sideOrders.length];
                    const yOffsets = yOffsetsByDataset[p.di % yOffsetsByDataset.length];
                    const pos = placePercentBubble(ctx, text, p.pt, chartArea, occupiedRects, sideOrder, yOffsets);
                    drawPercentBubble(ctx, text, pos.x, pos.y);
                }
            }
        });

        const renderTramoComplianceChart = (canvasId, mode, idSuffix) => {
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (state.analisisCartera.charts[canvasId]) state.analisisCartera.charts[canvasId].destroy();

            const datasets = tramoKeys.map((tramoKey) => ({
                type: 'line',
                label: `Tramo ${tramoKey}`,
                data: buildTramoComplianceSeries(tramoKey, mode),
                borderColor: tramoColors[tramoKey],
                backgroundColor: tramoColors[tramoKey],
                tension: 0.25,
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 4,
                fill: false
            }));

            state.analisisCartera.charts[canvasId] = new Chart(ctx, {
                type: 'line',
                data: { labels: tramoMonths, datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            min: 0,
                            max: 100,
                            ticks: {
                                color: '#94a3b8',
                                font: { family: 'Outfit' },
                                callback: (v) => `${v}%`
                            },
                            grid: { color: 'rgba(255,255,255,0.05)' }
                        },
                        x: {
                            ticks: { color: '#94a3b8', font: { family: 'Outfit', size: 10 } },
                            grid: { display: false }
                        }
                    },
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Outfit' } } },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.y || 0).toFixed(1)}%`
                            }
                        }
                    }
                },
                plugins: showAcaChartLabels ? [makeTramoLabelPlugin(idSuffix)] : []
            });
        };

        renderTramoComplianceChart('acaMoneyByTramoChart', 'money', 'money');
        renderTramoComplianceChart('acaContractsByTramoChart', 'contracts', 'contracts');
    }

    function updateAcaMovementUI(movement) {
        const chartWrap = document.getElementById('aca-movement-chart-wrap');
        const statusEl = document.getElementById('aca-movement-status');
        const culVigWrap = document.getElementById('aca-cul-vig-chart-wrap');
        const culVigStatusEl = document.getElementById('aca-cul-vig-status');
        const chartId = 'acaMovementMorosoChart';
        const culVigChartId = 'acaMovementCulVigChart';

        if (!statusEl || !culVigStatusEl) return;

        const destroyMovementChart = () => {
            if (state.acaMovimiento.charts[chartId]) {
                state.acaMovimiento.charts[chartId].destroy();
                delete state.acaMovimiento.charts[chartId];
            }
        };
        const destroyCulVigChart = () => {
            if (state.acaMovimiento.charts[culVigChartId]) {
                state.acaMovimiento.charts[culVigChartId].destroy();
                delete state.acaMovimiento.charts[culVigChartId];
            }
        };

        const available = movement && movement.available === true;
        const movementVm = (tabModules.acaMovimiento && typeof tabModules.acaMovimiento.prepareViewModel === 'function')
            ? tabModules.acaMovimiento.prepareViewModel(movement, { monthToSerial, formatNumber })
            : null;
        if (!available) {
            destroyMovementChart();
            statusEl.textContent = movementVm
                ? movementVm.movementStatus
                : (movement && movement.reason ? movement.reason : 'Movimiento de cartera no disponible.');
            if (chartWrap) chartWrap.classList.add('hidden');
        } else {
            const labels = movementVm ? movementVm.labels : [];
            const values = movementVm ? movementVm.values : [];
            const avgCuotaValues = movementVm ? movementVm.avgCuotaValues : [];
            const percentValues = movementVm ? movementVm.percentValues : [];

            destroyMovementChart();
            if (labels.length > 0) {
                const movementBarLabelsPlugin = (tabModules.acaMovimiento && typeof tabModules.acaMovimiento.createMovementBarLabelsPlugin === 'function')
                    ? tabModules.acaMovimiento.createMovementBarLabelsPlugin({ values, avgCuotaValues, formatNumber })
                    : { id: 'acaMovementBarLabels', afterDatasetsDraw() {} };

                if (chartWrap) chartWrap.classList.remove('hidden');
                const movementLineLabelsPlugin = {
                    id: 'acaMovementLineLabels',
                    afterDatasetsDraw(chart) {
                        const dsIndex = chart.data.datasets.findIndex(d => d.type === 'line');
                        if (dsIndex < 0) return;
                        const meta = chart.getDatasetMeta(dsIndex);
                        if (!meta || !meta.data) return;
                        const ctx = chart.ctx;
                        const chartArea = chart.chartArea;
                        const barMeta = chart.getDatasetMeta(0);
                        const lineColor = '#38bdf8';
                        const lineFont = '700 11px Outfit';
                        const barFont = '700 13px Outfit';
                        const occupied = [];
                        const labelsToDraw = new Set();

                        const measureBox = (text, font, padX, padY) => {
                            ctx.save();
                            ctx.font = font;
                            const w = ctx.measureText(text).width;
                            ctx.restore();
                            return {
                                w: w + padX * 2,
                                h: (parseInt(font, 10) || 11) + padY * 2
                            };
                        };

                        const getBubbleRect = (left, centerY, text) => {
                            const box = measureBox(text, lineFont, 6, 3);
                            return {
                                left,
                                right: left + box.w,
                                top: centerY - box.h / 2,
                                bottom: centerY + box.h / 2,
                                boxW: box.w,
                                boxH: box.h
                            };
                        };

                        const placeLineBubble = (pt, text, index) => {
                            const box = measureBox(text, lineFont, 6, 3);
                            const minX = chartArea.left + 2;
                            const maxX = chartArea.right - box.w - 2;
                            const minY = chartArea.top + box.h / 2 + 2;
                            const maxY = chartArea.bottom - box.h / 2 - 2;
                            const sideOrder = index % 2 === 0 ? ['right', 'left', 'center'] : ['left', 'right', 'center'];
                            const yOffsets = [-14, -26, 14, 26, -38, 38, 0, 50, -50];
                            let best = null;
                            let bestScore = Number.POSITIVE_INFINITY;

                            for (let s = 0; s < sideOrder.length; s++) {
                                const side = sideOrder[s];
                                for (let y = 0; y < yOffsets.length; y++) {
                                    const dy = yOffsets[y];
                                    let x = pt.x - box.w / 2;
                                    if (side === 'right') x = pt.x + 8;
                                    if (side === 'left') x = pt.x - box.w - 8;
                                    let centerY = pt.y + dy;

                                    x = Math.max(minX, Math.min(maxX, x));
                                    centerY = Math.max(minY, Math.min(maxY, centerY));
                                    const rect = getBubbleRect(x, centerY, text);

                                    let score = 0;
                                    for (let r = 0; r < occupied.length; r++) {
                                        if (rectsOverlap(rect, occupied[r], 2)) {
                                            score += overlapArea(rect, occupied[r]);
                                        }
                                    }

                                    // Penalize labels that still sit inside the bar zone.
                                    const bar = barMeta && barMeta.data ? barMeta.data[index] : null;
                                    if (bar) {
                                        const barTop = Math.min(bar.y, bar.base);
                                        const barBottom = Math.max(bar.y, bar.base);
                                        if (rect.bottom >= barTop - 2 && rect.top <= barBottom + 2) {
                                            score += (rect.bottom - rect.top) * 10;
                                        }
                                    }

                                    if (score === 0) {
                                        occupied.push(rect);
                                        return { x, y: centerY };
                                    }
                                    if (score < bestScore) {
                                        bestScore = score;
                                        best = { x, y: centerY, rect };
                                    }
                                }
                            }

                            // If collision is too high, skip label to keep chart readable.
                            if (!best || bestScore > (box.w * box.h * 0.35)) return null;
                            occupied.push(best.rect);
                            return { x: best.x, y: best.y };
                        };

                        // Reserve bar label areas (count + Prom)
                        if (barMeta && barMeta.data) {
                            ctx.save();
                            ctx.font = barFont;
                            for (let i = 0; i < barMeta.data.length; i++) {
                                const bar = barMeta.data[i];
                                if (!bar) continue;
                                const countText = formatNumber(Number(values[i] || 0));
                                const box = measureBox(countText, barFont, 4, 2);
                                occupied.push({
                                    left: bar.x - box.w / 2,
                                    right: bar.x + box.w / 2,
                                    top: bar.y + 2,
                                    bottom: bar.y + 2 + box.h
                                });
                                const barHeight = Math.abs((bar.base || 0) - (bar.y || 0));
                                if (barHeight >= 64) {
                                    const avgVal = Number(avgCuotaValues[i] || 0);
                                    const avgText = `Prom: ${formatNumber(avgVal)}`;
                                    const avgFont = '600 12px Outfit';
                                    ctx.font = avgFont;
                                    const textW = ctx.measureText(avgText).width;
                                    const boxW = (parseInt(avgFont, 10) || 12) + 6;
                                    const boxH = textW + 6;
                                    const yMid = bar.y + (bar.base - bar.y) / 2;
                                    occupied.push({
                                        left: bar.x - boxW / 2,
                                        right: bar.x + boxW / 2,
                                        top: yMid - boxH / 2,
                                        bottom: yMid + boxH / 2
                                    });
                                }
                            }
                            ctx.restore();
                        }

                        const yScale = chart.scales.y1 || chart.scales.y;
                        if (!yScale) return;

                        const points = [];
                        for (let i = 0; i < meta.data.length; i++) {
                            const val = Number(percentValues[i] || 0);
                            if (!Number.isFinite(val)) {
                                points.push(null);
                                continue;
                            }
                            const pt = meta.data[i];
                            if (!pt) {
                                points.push(null);
                                continue;
                            }
                            const bar = barMeta && barMeta.data ? barMeta.data[i] : null;
                            const rawY = yScale.getPixelForValue(val);
                            let y = rawY;
                            if (bar) {
                                const barTop = Math.min(bar.y, bar.base);
                                const barBottom = Math.max(bar.y, bar.base);
                                if (y >= barTop - 6 && y <= barBottom + 6) {
                                    y = barTop - 10;
                                }
                            }
                            if (y < chartArea.top + 6) y = chartArea.top + 6;
                            points.push({ x: pt.x, y });
                        }

                        const validIndices = [];
                        let maxIdx = -1;
                        let maxVal = Number.NEGATIVE_INFINITY;
                        for (let i = 0; i < points.length; i++) {
                            const p = points[i];
                            const val = Number(percentValues[i] || 0);
                            if (!p || !Number.isFinite(val) || val === 0) continue;
                            validIndices.push(i);
                            if (val > maxVal) {
                                maxVal = val;
                                maxIdx = i;
                            }
                        }
                        if (validIndices.length) {
                            const avgSpacing = chartArea.width / Math.max(1, validIndices.length - 1);
                            const step = avgSpacing < 34 ? Math.ceil(34 / Math.max(1, avgSpacing)) : 1;
                            for (let k = 0; k < validIndices.length; k++) {
                                const idx = validIndices[k];
                                if (k % step === 0 || idx === validIndices[0] || idx === validIndices[validIndices.length - 1] || idx === maxIdx) {
                                    labelsToDraw.add(idx);
                                }
                            }
                        }

                        // Draw adjusted line
                        ctx.save();
                        ctx.strokeStyle = lineColor;
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        let started = false;
                        for (let i = 0; i < points.length; i++) {
                            const p = points[i];
                            if (!p) { started = false; continue; }
                            if (!started) {
                                ctx.moveTo(p.x, p.y);
                                started = true;
                            } else {
                                ctx.lineTo(p.x, p.y);
                            }
                        }
                        ctx.stroke();

                        // Draw points + labels above
                        const bubbleStyle = {
                            padX: 6,
                            padY: 3,
                            radius: 6,
                            font: lineFont,
                            textSize: 11,
                            fill: 'rgba(15, 23, 42, 0.92)',
                            stroke: 'rgba(56, 189, 248, 0.95)',
                            text: '#e2e8f0'
                        };

                        const drawBubble = (text, x, y) => {
                            ctx.save();
                            ctx.font = bubbleStyle.font;
                            const textW = ctx.measureText(text).width;
                            const boxW = textW + bubbleStyle.padX * 2;
                            const boxH = bubbleStyle.textSize + bubbleStyle.padY * 2;
                            const left = x - boxW / 2;
                            const top = y - boxH;
                            ctx.beginPath();
                            ctx.moveTo(left + bubbleStyle.radius, top);
                            ctx.lineTo(left + boxW - bubbleStyle.radius, top);
                            ctx.quadraticCurveTo(left + boxW, top, left + boxW, top + bubbleStyle.radius);
                            ctx.lineTo(left + boxW, top + boxH - bubbleStyle.radius);
                            ctx.quadraticCurveTo(left + boxW, top + boxH, left + boxW - bubbleStyle.radius, top + boxH);
                            ctx.lineTo(left + bubbleStyle.radius, top + boxH);
                            ctx.quadraticCurveTo(left, top + boxH, left, top + boxH - bubbleStyle.radius);
                            ctx.lineTo(left, top + bubbleStyle.radius);
                            ctx.quadraticCurveTo(left, top, left + bubbleStyle.radius, top);
                            ctx.closePath();
                            ctx.fillStyle = bubbleStyle.fill;
                            ctx.fill();
                            ctx.lineWidth = 1.2;
                            ctx.strokeStyle = bubbleStyle.stroke;
                            ctx.stroke();
                            ctx.fillStyle = bubbleStyle.text;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(text, x, top + boxH / 2);
                            ctx.restore();
                        };

                        ctx.fillStyle = lineColor;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.font = lineFont;
                        for (let i = 0; i < points.length; i++) {
                            const p = points[i];
                            const val = Number(percentValues[i] || 0);
                            if (!p || !Number.isFinite(val) || val === 0) continue;
                            ctx.beginPath();
                            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
                            ctx.fill();
                            if (!labelsToDraw.has(i)) continue;
                            const text = `${val.toFixed(1)}%`;
                            const pos = placeLineBubble(p, text, i);
                            if (pos) drawBubble(text, pos.x + measureBox(text, lineFont, bubbleStyle.padX, bubbleStyle.padY).w / 2, pos.y + measureBox(text, lineFont, bubbleStyle.padX, bubbleStyle.padY).h / 2);
                        }
                        ctx.restore();
                    }
                };

                renderMixedChart(
                    chartId,
                    'acaMovimiento',
                    labels,
                    (tabModules.acaMovimiento && typeof tabModules.acaMovimiento.buildMovementDatasets === 'function')
                        ? tabModules.acaMovimiento.buildMovementDatasets(movementVm || { values, percentValues })
                        : [
                            {
                                type: 'bar',
                                label: 'Contratos que pasaron a moroso',
                                data: values,
                                backgroundColor: '#f97316',
                                borderRadius: 6,
                                yAxisID: 'y'
                            },
                            {
                                type: 'line',
                                label: '% sobre Vigentes',
                                data: percentValues,
                                borderColor: 'rgba(0,0,0,0)',
                                backgroundColor: 'rgba(0,0,0,0)',
                                tension: 0.35,
                                pointRadius: 0,
                                yAxisID: 'y1'
                            }
                        ],
                    {
                        plugins: {
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => {
                                        if (ctx.dataset && ctx.dataset.type === 'line') {
                                            return `${ctx.dataset.label}: ${Number(ctx.parsed.y || 0).toFixed(1)}%`;
                                        }
                                        return `${ctx.dataset.label}: ${formatNumber(ctx.parsed.y || 0)}`;
                                    }
                                }
                            }
                        }
                    },
                    enableLineLabelSmartLayout
                        ? [movementBarLabelsPlugin, movementLineLabelsPlugin]
                        : [movementBarLabelsPlugin]
                );
            } else if (chartWrap) {
                chartWrap.classList.add('hidden');
            }

            statusEl.textContent = movementVm
                ? movementVm.movementStatus
                : (movement.reason || 'No se encontraron contratos que pasaron a moroso con los filtros actuales.');
        }

        const culVigAvailable = movement && movement.culVigAvailable === true;
        if (!culVigAvailable) {
            destroyCulVigChart();
            culVigStatusEl.textContent = movementVm
                ? movementVm.culVigStatus
                : (movement && movement.culVigReason ? movement.culVigReason : 'Culminados por estado no disponible.');
            if (culVigWrap) culVigWrap.classList.remove('hidden');
        } else {
            const culVigLabels = movementVm ? movementVm.culVigLabels : [];
            const culVigData = movementVm ? movementVm.culVigData : [];
            const culMorData = movementVm ? movementVm.culMorData : [];
            const culUnknownData = movementVm ? movementVm.culUnknownData : [];

            const culVigLabelsPlugin = (tabModules.acaMovimiento && typeof tabModules.acaMovimiento.createCulVigLabelsPlugin === 'function')
                ? tabModules.acaMovimiento.createCulVigLabelsPlugin(formatNumber)
                : { id: 'acaCulVigBarLabels', afterDatasetsDraw() {} };

            destroyCulVigChart();
            if (culVigLabels.length > 0) {
                if (culVigWrap) culVigWrap.classList.remove('hidden');
                const datasets = (tabModules.acaMovimiento && typeof tabModules.acaMovimiento.buildCulVigDatasets === 'function')
                    ? tabModules.acaMovimiento.buildCulVigDatasets(movementVm || { culVigData, culMorData, culUnknownData })
                    : [
                        { label: 'Culminados vigentes', data: culVigData, backgroundColor: '#22c55e', borderRadius: 6 },
                        { label: 'Culminados morosos', data: culMorData, backgroundColor: '#ef4444', borderRadius: 6 }
                    ];

                renderGroupedChart(
                    culVigChartId,
                    'acaMovimiento',
                    culVigLabels,
                    datasets,
                    [culVigLabelsPlugin]
                );
                culVigStatusEl.textContent = movementVm
                    ? movementVm.culVigStatus
                    : `Total culminados: ${formatNumber(totalCulVig + totalCulMor + totalCulUnknown)} | Vigentes: ${formatNumber(totalCulVig)} | Morosos: ${formatNumber(totalCulMor)} | Sin tramo: ${formatNumber(totalCulUnknown)}.`;
            } else {
                if (culVigWrap) culVigWrap.classList.remove('hidden');
                culVigStatusEl.textContent = movementVm
                    ? movementVm.culVigStatus
                    : (movement.culVigReason || 'No se encontraron culminados por estado para los filtros actuales.');
            }
        }
    }

    function updateCulminadosUI(stats) {
        const setTxt = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        const rows = stats.rows || [];
        const byGestionStatus = stats.byGestionStatus || {};

        setTxt('cu-total-contracts', (stats.totalContracts || 0).toLocaleString());
        setTxt('cu-total-cobrado', formatPYG(stats.totalCobrado || 0));
        const totalPromedioCohortes = rows.reduce((acc, r) => acc + (r.avgMonthlyCobro || 0), 0);
        setTxt('cu-total-deberia', formatPYG(totalPromedioCohortes || 0));
        setTxt('cu-pay-rate', `${((stats.payRate || 0) * 100).toFixed(1)}%`);
        setTxt('cu-ltv', (stats.ltv || 0).toFixed(2));

        const tbody = document.getElementById('cu-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${r.saleMonth}</td>
                <td>${r.un}</td>
                <td>${r.cat}</td>
                <td>${r.contracts.toLocaleString()}</td>
                <td>${formatPYG(r.cobrado)}</td>
                <td>${formatPYG(r.avgMonthlyCobro)}</td>
                <td>${(r.ltv || 0).toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        }

        const statusEl = document.getElementById('cu-gestion-status');
        const labels = Object.keys(byGestionStatus).sort((a, b) => monthToSerial(a) - monthToSerial(b));
        const vigData = labels.map((m) => byGestionStatus[m] ? (byGestionStatus[m].vigente || 0) : 0);
        const morData = labels.map((m) => byGestionStatus[m] ? (byGestionStatus[m].moroso || 0) : 0);

        const cuGestionBarLabelsPlugin = {
            id: 'cuGestionBarLabels',
            afterDatasetsDraw(chart) {
                const ctx = chart.ctx;
                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                for (let di = 0; di < chart.data.datasets.length; di++) {
                    const meta = chart.getDatasetMeta(di);
                    if (!meta || meta.hidden || !meta.data) continue;
                    const ds = chart.data.datasets[di];
                    for (let i = 0; i < meta.data.length; i++) {
                        const bar = meta.data[i];
                        const val = Number(ds.data[i] || 0);
                        if (!bar || !Number.isFinite(val) || val <= 0) continue;
                        const txt = formatNumber(val);
                        const y = bar.y + 12;
                        ctx.font = '700 12px Outfit';
                        ctx.strokeStyle = 'rgba(2,6,23,0.75)';
                        ctx.lineWidth = 3;
                        ctx.strokeText(txt, bar.x, y);
                        ctx.fillStyle = '#f8fafc';
                        ctx.fillText(txt, bar.x, y);
                    }
                }
                ctx.restore();
            }
        };

        renderGroupedChart(
            'cuByGestionChart',
            'culminados',
            labels,
            [
                { label: 'Culminados vigentes', data: vigData, backgroundColor: '#22c55e' },
                { label: 'Culminados morosos', data: morData, backgroundColor: '#f97316' }
            ],
            [cuGestionBarLabelsPlugin]
        );

        if (statusEl) {
            const totalVig = vigData.reduce((acc, v) => acc + v, 0);
            const totalMor = morData.reduce((acc, v) => acc + v, 0);
            if (labels.length === 0) {
                statusEl.textContent = 'Sin datos de culminados por fecha de gestión para los filtros seleccionados.';
            } else {
                statusEl.textContent = `Totales por gestión: Vigentes ${formatNumber(totalVig)} | Morosos ${formatNumber(totalMor)}.`;
            }
        }
    }

    function applyCobranzasFilters() {
        const selVp = getAppliedSelected('cobranzas', 'vp');
        const selSuc = getAppliedSelected('cobranzas', 'suc');
        const selAnio = getAppliedSelected('cobranzas', 'anio');
        const selMes = getAppliedSelected('cobranzas', 'mes');
        const selDia = getAppliedSelected('cobranzas', 'dia');
        const selSuper = getAppliedSelected('cobranzas', 'cob-super');
        const supervisorById = getSupervisorByContractId();

        const filtered = state.cobranzas.data.filter(r => {
            const sup = String(supervisorById[String(r._cId || '')] || 'S/D');
            return selVp.has(String(r.VP || '').trim()) &&
                selSuc.has(String(r.Suc || '').trim()) &&
                selAnio.has(String(r['A\u00f1o'] || '').trim()) &&
                selMes.has(String(r.Mes || '').trim()) &&
                selDia.has(String(r.Dia || '').trim()) &&
                selSuper.has(sup);
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
        const hasAnalytics = state.analytics.data.length > 0;
        if (!hasAnalytics && (!state.cartera.data.length || !state.cobranzas.data.length)) return;

        console.log("Rendimiento: Iniciando calculo robusto optimizado (V7)...");
        let matches = 0, nonMatches = 0;
        let totalMatchedAmount = 0;

        progressText.textContent = "Analizando cruce de datos (1/3)...";
        await new Promise(r => setTimeout(r, 50));

        // 1. Aggregate collections track Via de Pago (Real)
        const cobAggr = getCobranzasAggregates().byKeyDetailed;

        progressText.textContent = "Analizando cruce de datos (2/3)...";
        await new Promise(r => setTimeout(r, 50));

        // 2. Setup Rendimiento Filters
        if (!state.rendimiento.filtersInitialized) {
            console.log("Rendimiento: Inicializando filtros por primera vez...");
            const uns = hasAnalytics
                ? [...new Set(state.analytics.data.map(r => String(r.un || 'S/D')).filter(Boolean))].sort()
                : [...new Set(state.cartera.data.map(r => String(r.UN || 'S/D')).filter(Boolean))].sort();
            const tramos = hasAnalytics
                ? [...new Set(state.analytics.data.map(r => String(r.tramo || '0')).filter(v => v !== null))].sort((a, b) => a - b)
                : [...new Set(state.cartera.data.map(r => String(r.tramo || '0')).filter(v => v !== null))].sort((a, b) => a - b);
            const fechas = hasAnalytics
                ? [...new Set(state.analytics.data.map(r => String(r.gestion_month || '')).filter(Boolean))].sort((a, b) => {
                    const [m1, y1] = String(a).split('/'); const [m2, y2] = String(b).split('/');
                    return new Date(y1, m1 - 1) - new Date(y2, m2 - 1);
                })
                : [...new Set(state.cartera.data.map(r => r._feNorm).filter(Boolean))].sort((a, b) => {
                    const [m1, y1] = a.split('/'); const [m2, y2] = b.split('/');
                    return new Date(y1, m1 - 1) - new Date(y2, m2 - 1);
                });
            const viasPagoReal = hasAnalytics
                ? ['COBRADOR', 'DEBITO']
                : [...new Set(state.cobranzas.data.map(r => String(r.VP || 'S/D')).filter(Boolean))].sort();
            const viasCobroInt = ['COBRADOR', 'DEBITO'];
            const supervisors = hasAnalytics
                ? [...new Set(state.analytics.data.map(r => String(r.supervisor || 'S/D')).filter(Boolean))].sort()
                : getSupervisorOptions();

            setupFilter('perf-un', uns, 'rendimiento');
            setupFilter('perf-tramo', tramos, 'rendimiento');
            setupFilter('perf-fecha', fechas, 'rendimiento');
            setupFilter('perf-via-cobro', viasCobroInt, 'rendimiento');
            setupFilter('perf-via-pago', viasPagoReal, 'rendimiento');
            setupFilter('perf-cat', ['VIGENTE', 'MOROSO'], 'rendimiento');
            setupFilter('perf-super', supervisors, 'rendimiento');

            document.getElementById('reset-perf').onclick = async () => {
                resetFilters('rendimiento');
            };
            snapshotAppliedFilters('rendimiento');
            state.rendimiento.filtersInitialized = true;
        }

        const selUn = getAppliedSelected('rendimiento', 'perf-un');
        const selTramo = getAppliedSelected('rendimiento', 'perf-tramo');
        const selFecha = getAppliedSelected('rendimiento', 'perf-fecha');
        const selViaCobroInt = getAppliedSelected('rendimiento', 'perf-via-cobro');
        const selViaPagoReal = getAppliedSelected('rendimiento', 'perf-via-pago');
        const selCat = getAppliedSelected('rendimiento', 'perf-cat');
        const selSuper = getAppliedSelected('rendimiento', 'perf-super');
        const supervisorById = getSupervisorByContractId();

        if (useAnalyticsApi && analyticsApi && useApiRendimiento) {
            try {
                const filters = {
                    un: selUn,
                    tramo: selTramo,
                    gestionMonth: selFecha,
                    viaCobro: selViaCobroInt,
                    viaPago: selViaPagoReal,
                    categoria: selCat,
                    supervisor: selSuper,
                    debug: debugMode ? '1' : ''
                };
                const apiAdapter = tabModules.rendimientoApi;
                const apiStats = (apiAdapter && apiAdapter.fetch)
                    ? await apiAdapter.fetch(filters)
                    : await analyticsApi.getPerformanceByManagementMonth(filters);
                updatePerformanceUI(apiStats);
                trackApiOutcome('rendimiento', 'api_success');
                return;
            } catch (e) {
                trackApiOutcome('rendimiento', 'fallback_local');
                showWarning(`API analitica no disponible para Rendimiento. Fallback local: ${e.message || e}`);
            }
        }

        if (hasAnalytics) {
            const filtered = getAnalyticsRowsFiltered({
                selUn,
                selTramo,
                selFecha,
                selViaCobro: selViaCobroInt,
                selViaPago: selViaPagoReal,
                selCat,
                selSuper
            });

            const stats = {
                totalDebt: 0,
                totalPaid: 0,
                totalContracts: 0,
                totalContractsPaid: 0,
                tramoStats: {},
                unStats: {},
                viaCStats: {},
                gestorStats: {},
                matrixStats: {},
                trendStats: {}
            };

            for (let i = 0; i < filtered.length; i++) {
                const r = filtered[i];
                const debt = r.debt_total || 0;
                const paid = r._paid_selected || 0;
                const ct = r.contracts_total || 0;
                const cp = r._contracts_paid_selected || 0;
                const fe = r.gestion_month;

                stats.totalDebt += debt;
                stats.totalPaid += paid;
                stats.totalContracts += ct;
                stats.totalContractsPaid += cp;

                if (!stats.trendStats[fe]) stats.trendStats[fe] = { d: 0, p: 0, c: 0, cp: 0 };
                stats.trendStats[fe].d += debt;
                stats.trendStats[fe].p += paid;
                stats.trendStats[fe].c += ct;
                stats.trendStats[fe].cp += cp;

                const t = String(r.tramo || '0');
                const u = String(r.un || 'S/D');
                const vc = String(r.via_cobro || 'DEBITO');
                const g = String(r.supervisor || 'S/D');

                if (!stats.tramoStats[t]) stats.tramoStats[t] = { d: 0, p: 0 };
                stats.tramoStats[t].d += debt;
                stats.tramoStats[t].p += paid;

                if (!stats.unStats[u]) stats.unStats[u] = { d: 0, p: 0 };
                stats.unStats[u].d += debt;
                stats.unStats[u].p += paid;

                if (!stats.viaCStats[vc]) stats.viaCStats[vc] = { d: 0, p: 0 };
                stats.viaCStats[vc].d += debt;
                stats.viaCStats[vc].p += paid;

                if (!stats.gestorStats[g]) stats.gestorStats[g] = { d: 0, p: 0 };
                stats.gestorStats[g].d += debt;
                stats.gestorStats[g].p += paid;

                if (!stats.matrixStats[vc]) stats.matrixStats[vc] = {};
                if (selViaPagoReal.size === 0 || selViaPagoReal.has('DEBITO')) {
                    const dPay = r.paid_via_debito || 0;
                    if (dPay > 0) stats.matrixStats[vc].DEBITO = (stats.matrixStats[vc].DEBITO || 0) + dPay;
                }
                if (selViaPagoReal.size === 0 || selViaPagoReal.has('COBRADOR')) {
                    const cPay = r.paid_via_cobrador || 0;
                    if (cPay > 0) stats.matrixStats[vc].COBRADOR = (stats.matrixStats[vc].COBRADOR || 0) + cPay;
                }
            }

            updatePerformanceUI(stats);
            return;
        }

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
            const sup = String(supervisorById[String(r._cId || '')] || 'S/D');

            if ((selUn.size === 0 || selUn.has(unVal)) &&
                (selTramo.size === 0 || selTramo.has(trVal)) &&
                (selCat.size === 0 || selCat.has(catVal)) &&
                (selViaCobroInt.size === 0 || selViaCobroInt.has(viaCInt)) &&
                (selSuper.size === 0 || selSuper.has(sup)) &&
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
        const cobAggr = getCobranzasAggregates().byKeyDetailed;

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
            };
            snapshotAppliedFilters('cosecha');
            state.cosecha.filtersInitialized = true;
        }

        const selUn = getAppliedSelected('cosecha', 'co-un');
        const selTramo = getAppliedSelected('cosecha', 'co-tramo');
        const selAnio = getAppliedSelected('cosecha', 'co-anio');
        const selMes = getAppliedSelected('cosecha', 'co-mes');
        const selFechaGest = getAppliedSelected('cosecha', 'co-fecha-gest');
        const selViaCobroInt = getAppliedSelected('cosecha', 'co-via-cobro');
        const selViaPagoReal = getAppliedSelected('cosecha', 'co-via-pago');
        const selCat = getAppliedSelected('cosecha', 'co-cat');

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
            };
            snapshotAppliedFilters('gestores');
            state.gestores.filtersInitialized = true;
        }

        const selGestor = getAppliedSelected('gestores', 'gs-gestor');
        const selUn = getAppliedSelected('gestores', 'gs-un');
        const selFecha = getAppliedSelected('gestores', 'gs-fecha');

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
        const cobAggr = getCobranzasAggregates().byKeyAmount;

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

        const drawPerfPercentBubble = (ctx, text, x, y) => {
            const padX = 6;
            const padY = 3;
            const radius = 6;
            const font = '700 12px Outfit';
            ctx.save();
            ctx.font = font;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            const textW = ctx.measureText(text).width;
            const boxW = textW + padX * 2;
            const boxH = 12 + padY * 2;
            const left = x;
            const top = y - boxH / 2;

            ctx.beginPath();
            ctx.moveTo(left + radius, top);
            ctx.lineTo(left + boxW - radius, top);
            ctx.quadraticCurveTo(left + boxW, top, left + boxW, top + radius);
            ctx.lineTo(left + boxW, top + boxH - radius);
            ctx.quadraticCurveTo(left + boxW, top + boxH, left + boxW - radius, top + boxH);
            ctx.lineTo(left + radius, top + boxH);
            ctx.quadraticCurveTo(left, top + boxH, left, top + boxH - radius);
            ctx.lineTo(left, top + radius);
            ctx.quadraticCurveTo(left, top, left + radius, top);
            ctx.closePath();
            ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(14, 165, 233, 0.9)';
            ctx.stroke();

            ctx.fillStyle = '#e2e8f0';
            ctx.fillText(text, left + padX, y);
            ctx.restore();
        };

        const perfLineValueLabelsPlugin = {
            id: 'perfLineValueLabels',
            afterDatasetsDraw(chart) {
                const meta = chart.getDatasetMeta(0);
                if (!meta || meta.hidden) return;
                const data = chart.data.datasets && chart.data.datasets[0] ? chart.data.datasets[0].data : [];
                const ctx = chart.ctx;
                ctx.save();
                ctx.font = '11px Outfit';
                ctx.fillStyle = '#e2e8f0';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                for (let i = 0; i < meta.data.length; i++) {
                    const pt = meta.data[i];
                    const val = parseFloat(data[i]) || 0;
                    if (!pt) continue;
                    ctx.beginPath();
                    ctx.fillStyle = '#f59e0b';
                    ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
                    ctx.fill();
                    drawPerfPercentBubble(ctx, `${val.toFixed(1)}%`, pt.x + 7, pt.y - 12);
                }
                ctx.restore();
            }
        };

        const perfBarValueLabelsPlugin = {
            id: 'perfBarValueLabels',
            afterDatasetsDraw(chart) {
                const meta = chart.getDatasetMeta(0);
                if (!meta || meta.hidden) return;
                const data = chart.data.datasets && chart.data.datasets[0] ? chart.data.datasets[0].data : [];
                const ctx = chart.ctx;
                ctx.save();
                ctx.font = '11px Outfit';
                ctx.fillStyle = '#e2e8f0';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                for (let i = 0; i < meta.data.length; i++) {
                    const bar = meta.data[i];
                    const val = parseFloat(data[i]) || 0;
                    if (!bar) continue;
                    const y = bar.y + (bar.base - bar.y) / 2;
                    ctx.save();
                    ctx.translate(bar.x, y);
                    ctx.rotate(-Math.PI / 2);
                    ctx.fillText(`${val.toFixed(1)}%`, 0, 0);
                    ctx.restore();
                }
                ctx.restore();
            }
        };

        const perfLinePlugins = showPerfChartLabels ? [perfLineValueLabelsPlugin] : [];
        const perfBarPlugins = showPerfChartLabels ? [perfBarValueLabelsPlugin] : [];

        // Performance Trend Chart
        const sortedMonths = Object.keys(trendStats).sort((a, b) => {
            const [m1, y1] = a.split('/'); const [m2, y2] = b.split('/');
            return new Date(y1, m1 - 1) - new Date(y2, m2 - 1);
        });
        const trendData = sortedMonths.map(m => (trendStats[m].d > 0 ? (trendStats[m].p / trendStats[m].d) * 100 : 0));
        renderChart('perfTrendChart', 'rendimiento', 'line', sortedMonths, trendData, '% Eficacia', '#38bdf8', perfLinePlugins);

        // Performance Trend by Count
        const trendCountData = sortedMonths.map(m => (trendStats[m].c > 0 ? (trendStats[m].cp / trendStats[m].c) * 100 : 0));
        renderChart('perfTrendCountChart', 'rendimiento', 'line', sortedMonths, trendCountData, '% Eficacia (Cantidad)', '#f59e0b', perfLinePlugins);

        // Charts per Tramo
        const tramoLabels = Object.keys(tramoStats).sort((a, b) => a - b);
        const tramoEff = tramoLabels.map(t => (tramoStats[t].d > 0 ? (tramoStats[t].p / tramoStats[t].d) * 100 : 0));
        renderChart('perfTramoChart', 'rendimiento', 'bar', tramoLabels.map(t => 'Tramo ' + t), tramoEff, '% Eficacia', '#818cf8', perfBarPlugins);

        // Charts per UN
        const unLabels = Object.keys(unStats).sort();
        const unEff = unLabels.map(u => (unStats[u].d > 0 ? (unStats[u].p / unStats[u].d) * 100 : 0));
        renderChart('perfUnChart', 'rendimiento', 'bar', unLabels, unEff, '% Eficacia', '#6366f1', perfBarPlugins);

        // NEW: Charts per Via de Cobro (Intencion)
        const vcLabels = Object.keys(viaCStats).sort();
        const vcEff = vcLabels.map(v => (viaCStats[v].d > 0 ? (viaCStats[v].p / viaCStats[v].d) * 100 : 0));
        renderChart('perfViaCobroChart', 'rendimiento', 'bar', vcLabels, vcEff, '% Eficacia (Intencion)', '#10b981', perfBarPlugins);

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
        const activosRate = (stats.activosRateCutoff || 0) * 100;
        const morososRate = (stats.morososRateCutoff || 0) * 100;
        document.getElementById('ltv-total-contracts').textContent = stats.totalContracts.toLocaleString();
        document.getElementById('ltv-total-cobrar').textContent = formatPYG(stats.totalCobrarTeorico || 0);
        document.getElementById('ltv-mora').textContent = (stats.moraCutoff || 0).toLocaleString();
        document.getElementById('ltv-vigente-rate').textContent = `${activosRate.toFixed(1)}%`;
        document.getElementById('ltv-moroso-rate').textContent = `${morososRate.toFixed(1)}%`;
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
            const totalSold = stats.totalContractsSold || 0;
            const saldoActivo = Math.max(0, totalSold - (row.culminado || 0));
            const activosTotal = (row.vigente || 0) + (row.mora || 0);
            const activosPct = totalSold > 0 ? (saldoActivo / totalSold) * 100 : 0;
            const vigentePct = activosTotal > 0 ? ((row.vigente || 0) / activosTotal) * 100 : 0;
            const moraPct = activosTotal > 0 ? ((row.mora || 0) / activosTotal) * 100 : 0;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${gestion}</td>
                <td>${activosTotal.toLocaleString()}</td>
                <td>${row.vigente.toLocaleString()}</td>
                <td>${row.mora.toLocaleString()}</td>
                <td>${row.culminado.toLocaleString()}</td>
                <td>${activosPct.toFixed(1)}%</td>
                <td>${vigentePct.toFixed(1)}%</td>
                <td>${formatPYG(row.cobrar)}</td>
                <td>${formatPYG(row.cobrado)}</td>
                <td>${(row.ltv || 0).toFixed(2)}</td>
                <td>${moraPct.toFixed(1)}%</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function setTabDirty(tab, dirty) {
        if (!state[tab]) return;
        state[tab].dirty = dirty;
        const btn = document.getElementById(applyButtonByTab[tab]);
        if (btn) btn.disabled = !dirty;
    }

    function snapshotAppliedFilters(tab) {
        if (!state[tab]) return;
        const ids = tabFilterIds[tab] || [];
        state[tab].filtersApplied = state[tab].filtersApplied || {};
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            state[tab].filtersApplied[id] = getSelected(id);
        }
        setTabDirty(tab, false);
    }

    function getAppliedSelected(tab, id) {
        const m = state[tab] && state[tab].filtersApplied ? state[tab].filtersApplied[id] : null;
        if (m && m.size !== undefined) {
            const available = new Set([...document.querySelectorAll(`.${id}-cb`)].map(c => String(c.value)));
            const cleaned = new Set([...m].filter(v => available.has(v)));
            if (cleaned.size === 0) return new Set();
            return cleaned;
        }
        return getSelected(id);
    }

    async function applyTabFilters(tab) {
        snapshotAppliedFilters(tab);
        const signature = getTabComputeSignature(tab);
        debugLog('applyTabFilters.start', { tab, signature });
        if (state[tab] && state[tab].lastComputeSignature === signature) {
            debugLog('applyTabFilters.skip_cached', { tab, signature });
            return;
        }
        if (tab === 'cartera') applyCarteraFilters();
        else if (tab === 'cobranzas') applyCobranzasFilters();
        else if (tab === 'analisisCartera') await calculateAnalisisCartera();
        else if (tab === 'acaMovimiento') await calculateAcaMovimiento();
        else if (tab === 'acaAnuales') await calculateAcaAnuales();
        else if (tab === 'rendimiento') await calculatePerformance();
        else if (tab === 'ltv') await calculateLtv();
        else if (tab === 'ltvAge') await calculateLtvAge();
        else if (tab === 'analisisCobranza') await calculateAnalisisCobranza();
        else if (tab === 'culminados') await calculateCulminados();
        else if (tab === 'cosecha') await calculateCosecha();
        else if (tab === 'gestores') await calculateGestoresDashboard();
        if (state[tab]) state[tab].lastComputeSignature = signature;
        debugLog('applyTabFilters.done', {
            tab,
            signature,
            datasetSizes: {
                cartera: state.cartera.data.length,
                cobranzas: state.cobranzas.data.length,
                contratos: state.contratos.data.length,
                analytics: state.analytics.data.length
            }
        });
    }

    function initApplyButtons() {
        Object.keys(applyButtonByTab).forEach(tab => {
            const btn = document.getElementById(applyButtonByTab[tab]);
            if (!btn) return;
            btn.onclick = async () => { await applyTabFilters(tab); };
            btn.disabled = false;
        });
    }

    // --- SHARED UTILS ---
    function setupFilter(id, options, tab) {
        const container = document.getElementById(`${id}-options`);
        const allCb = document.getElementById(`${id}-all`);
        const countSpan = document.getElementById(`${id}-count`);
        if (!container || !allCb || !countSpan) return;
        container.innerHTML = '';

        options.forEach(opt => {
            const label = document.createElement('label');
            let text = opt;
            if (id === 'tramo') text = 'Tramo ' + opt;
            if (id === 'mes') text = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][opt - 1] || opt;
            label.innerHTML = `<input type="checkbox" class="${id}-cb" value="${opt}" checked> ${text}`;
            container.appendChild(label);
        });

        const update = (markDirty = true) => {
            const checked = container.querySelectorAll('input:checked');
            let labelText = 'Todas';
            if (id.includes('anio') || id.includes('tramo') || id.includes('mes') || id.includes('dia')) labelText = 'Todos';
            if (id.includes('fecha') || id.includes('gestion')) labelText = 'Historia';

            countSpan.textContent = checked.length === options.length ? labelText : `${checked.length} sel.`;
            allCb.checked = checked.length === options.length;
            if (markDirty) setTabDirty(tab, true);
        };

        allCb.addEventListener('change', () => {
            container.querySelectorAll('input').forEach(c => c.checked = allCb.checked);
            update(true);
        });

        container.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') update(true);
        });

        update(false);
        if (!state[tab].filtersApplied[id]) {
            state[tab].filtersApplied[id] = getSelected(id);
        }
    }

    function setupSingleSelectFilter(id, options, tab, defaultValue) {
        const container = document.getElementById(`${id}-options`);
        const allCb = document.getElementById(`${id}-all`);
        const countSpan = document.getElementById(`${id}-count`);
        if (!container || !allCb || !countSpan) return;
        container.innerHTML = '';

        const normalizedDefault = String(defaultValue);
        const available = new Set(options.map(v => String(v)));
        const selectedDefault = available.has(normalizedDefault) ? normalizedDefault : String(options[0] || '');

        options.forEach(opt => {
            const val = String(opt);
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" class="${id}-cb" value="${val}" ${val === selectedDefault ? 'checked' : ''}> ${val}`;
            container.appendChild(label);
        });

        allCb.checked = false;
        allCb.disabled = true;

        const update = (markDirty = true) => {
            let checked = [...container.querySelectorAll('input:checked')];
            if (checked.length === 0) {
                const first = container.querySelector('input');
                if (first) first.checked = true;
                checked = first ? [first] : [];
            }
            if (checked.length > 1) {
                const keep = checked[checked.length - 1];
                container.querySelectorAll('input').forEach(c => c.checked = c === keep);
                checked = [keep];
            }
            const selected = checked[0] ? String(checked[0].value) : selectedDefault;
            countSpan.textContent = id.includes('antiguedad') ? `${selected} meses` : selected;
            if (markDirty) setTabDirty(tab, true);
        };

        container.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') update(true);
        });

        update(false);
        if (!state[tab].filtersApplied[id]) {
            state[tab].filtersApplied[id] = new Set([selectedDefault]);
        }
    }

    function getSelected(id) {
        return new Set([...document.querySelectorAll(`.${id}-cb:checked`)].map(c => String(c.value)));
    }

    function resetFilters(tab) {
        let sel = '#cartera-content';
        if (tab === 'cobranzas') sel = '#cobranzas-content';
        if (tab === 'analisisCartera') sel = '#analisis-cartera-content';
        if (tab === 'acaMovimiento') sel = '#aca-mov-content';
        if (tab === 'acaAnuales') sel = '#aca-anuales-content';
        if (tab === 'rendimiento') sel = '#rendimiento-content';
        if (tab === 'ltv') sel = '#ltv-content';
        if (tab === 'ltvAge') sel = '#ltv-age-content';
        if (tab === 'analisisCobranza') sel = '#analisis-cobranza-content';
        if (tab === 'culminados') sel = '#culminados-content';
        if (tab === 'cosecha') sel = '#cosecha-content';
        if (tab === 'gestores') sel = '#gestores-content';

        const ids = tabFilterIds[tab] || [];
        const getDefaultCountLabel = (id) => {
            if (id.includes('fecha') || id.includes('gestion')) return 'Historia';
            if (id.includes('un') || id.includes('via-cobro') || id.includes('via-pago') || id.includes('cat')) return 'Todas';
            return 'Todos';
        };

        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const allCb = document.getElementById(`${id}-all`);
            if (allCb && !allCb.disabled) allCb.checked = true;
            document.querySelectorAll(`${sel} .${id}-cb`).forEach(c => c.checked = true);
            const countSpan = document.getElementById(`${id}-count`);
            if (countSpan) countSpan.textContent = getDefaultCountLabel(id);
        }
        setTabDirty(tab, true);
    }

    function renderChart(canvasId, tab, type, labels, data, label = '', color, extraPlugins = []) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            showWarning(`Canvas no encontrado: ${canvasId}`);
            return;
        }
        try {
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
                    layout: { padding: { bottom: 10 } },
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
                                autoSkip: false
                            }
                        }
                    } : {}
                },
                plugins: extraPlugins
            });
        } catch (e) {
            showError(`No se pudo renderizar el grafico ${canvasId}.`, e);
        }
    }

    function renderStackedChart(canvasId, tab, labels, datasets) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        try {
            const ctx = canvas.getContext('2d');
            if (state[tab].charts[canvasId]) state[tab].charts[canvasId].destroy();
            state[tab].charts[canvasId] = new Chart(ctx, {
                type: 'bar',
                data: { labels, datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { stacked: true, ticks: { color: '#94a3b8', font: { family: 'Outfit', size: 10 } } },
                        y: { stacked: true, beginAtZero: true, ticks: { color: '#94a3b8', font: { family: 'Outfit' } } }
                    },
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Outfit' } } }
                    }
                }
            });
        } catch (e) {
            showError(`No se pudo renderizar el grafico apilado ${canvasId}.`, e);
        }
    }

    function renderGroupedChart(canvasId, tab, labels, datasets, extraPlugins = []) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        try {
            const ctx = canvas.getContext('2d');
            if (state[tab].charts[canvasId]) state[tab].charts[canvasId].destroy();
            state[tab].charts[canvasId] = new Chart(ctx, {
                type: 'bar',
                data: { labels, datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { stacked: false, ticks: { color: '#94a3b8', font: { family: 'Outfit', size: 10 } } },
                        y: { beginAtZero: true, ticks: { color: '#94a3b8', font: { family: 'Outfit' } } }
                    },
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Outfit' } } }
                    }
                },
                plugins: extraPlugins
            });
        } catch (e) {
            showError(`No se pudo renderizar el grafico agrupado ${canvasId}.`, e);
        }
    }

    function renderMixedChart(canvasId, tab, labels, datasets, options = {}, plugins = []) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        try {
            const ctx = canvas.getContext('2d');
            if (state[tab].charts[canvasId]) state[tab].charts[canvasId].destroy();
            state[tab].charts[canvasId] = new Chart(ctx, {
                data: { labels, datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { ticks: { color: '#94a3b8', font: { family: 'Outfit', size: 10 } }, grid: { z: -1 } },
                        y: { beginAtZero: true, ticks: { color: '#94a3b8', font: { family: 'Outfit' } }, grid: { z: -1 } },
                        y1: {
                            beginAtZero: true,
                            position: 'right',
                            grid: { drawOnChartArea: false, z: -1 },
                            ticks: {
                                color: '#94a3b8',
                                font: { family: 'Outfit' },
                                callback: (v) => `${v}%`
                            }
                        }
                    },
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Outfit' } } }
                    },
                    ...options
                },
                plugins
            });
        } catch (e) {
            showError(`No se pudo renderizar el grafico mixto ${canvasId}.`, e);
        }
    }

    function formatPYG(num) { return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(num); }
    function formatNumber(num) { return new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(num); }

    // Helper to normalize dates (1/2026 -> 01/2026)
    function normD(s) {
        if (normalizeUtils.normD) return normalizeUtils.normD(s);
        const val = String(s || '').trim();
        if (!val.includes('/')) return val;
        const p = val.replace(/[^0-9/]/g, '').split('/');
        if (p.length < 2) return val;
        return p[0].padStart(2, '0') + '/' + p[1];
    };

    function monthFromDate(dateStr) {
        if (normalizeUtils.monthFromDate) return normalizeUtils.monthFromDate(dateStr);
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
        if (normalizeUtils.addMonths) return normalizeUtils.addMonths(mmYYYY, n);
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
        if (normalizeUtils.monthsBetweenDateAndMonth) return normalizeUtils.monthsBetweenDateAndMonth(dateYYYYMMDD, mmYYYY);
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
        if (normalizeUtils.normalizeViaCobro) return normalizeUtils.normalizeViaCobro(viaCobro);
        const rawVia = String(viaCobro || '').trim().toUpperCase();
        return (rawVia === 'COBRADOR' || rawVia === 'COB') ? 'COBRADOR' : 'DEBITO';
    }

    function getSupervisorOptions() {
        const set = new Set();
        for (let i = 0; i < state.contratos.data.length; i++) {
            const s = String(state.contratos.data[i]._supervisor || state.contratos.data[i].Supervisor || 'S/D').trim() || 'S/D';
            set.add(s);
        }
        // Keep an explicit fallback option for contracts not present in contratos.csv
        // (or without supervisor), so filters don't unintentionally hide all rows.
        set.add('S/D');
        return [...set].sort();
    }

    function getSupervisorByContractId() {
        const map = {};
        for (let i = 0; i < state.contratos.data.length; i++) {
            const c = state.contratos.data[i];
            const cId = String(c._cId || c.id || c.contract_id || '').replace(/[^0-9]/g, '');
            if (!cId) continue;
            map[cId] = String(c._supervisor || c.Supervisor || 'S/D').trim() || 'S/D';
        }
        return map;
    }

    function monthToSerial(mmYYYY) {
        if (normalizeUtils.monthToSerial) return normalizeUtils.monthToSerial(mmYYYY);
        const val = String(mmYYYY || '').trim();
        const m = val.match(/^(\d{1,2})\/(\d{4})$/);
        if (!m) return -1;
        const month = parseInt(m[1], 10);
        const year = parseInt(m[2], 10);
        if (Number.isNaN(month) || Number.isNaN(year)) return -1;
        return year * 12 + month;
    }

    function monthCompare(mm1, mm2) {
        if (normalizeUtils.monthCompare) return normalizeUtils.monthCompare(mm1, mm2);
        return monthToSerial(mm1) - monthToSerial(mm2);
    }

    function isActiveAtCutoff(contract, cutoffMonth) {
        if (normalizeUtils.isActiveAtCutoff) return normalizeUtils.isActiveAtCutoff(contract, cutoffMonth);
        const culm = String(contract._culminacionMonth || '');
        if (!culm) return true;
        return monthCompare(culm, cutoffMonth) > 0;
    }

    function sumCobradoBetweenMonths(contractMonthMap, startMonth, endMonth) {
        if (normalizeUtils.sumCobradoBetweenMonths) return normalizeUtils.sumCobradoBetweenMonths(contractMonthMap, startMonth, endMonth);
        const start = monthToSerial(startMonth);
        const end = monthToSerial(endMonth);
        if (start < 0 || end < 0 || end < start) return 0;
        let total = 0;
        for (const mm in contractMonthMap) {
            const s = monthToSerial(mm);
            if (s >= start && s <= end) total += (parseFloat(contractMonthMap[mm]) || 0);
        }
        return total;
    }

    function resetLtvAgeFilters() {
        resetFilters('ltvAge');
        const antChecks = [...document.querySelectorAll('.ltva-antiguedad-cb')];
        antChecks.forEach(cb => cb.checked = String(cb.value) === '12');
        const antCount = document.getElementById('ltva-antiguedad-count');
        if (antCount) antCount.textContent = '12 meses';
        setTabDirty('ltvAge', true);
    }

    function resetAnalisisCobranzaFilters() {
        resetFilters('analisisCobranza');
        const cutoffChecks = [...document.querySelectorAll('.ac-cutoff-cb')];
        const def = String(state.analisisCobranza.defaultCutoff || '');
        cutoffChecks.forEach(cb => cb.checked = String(cb.value) === def);
        const cutoffCount = document.getElementById('ac-cutoff-count');
        if (cutoffCount && def) cutoffCount.textContent = def;
        setTabDirty('analisisCobranza', true);
    }

    function resetCulminadosFilters() {
        resetFilters('culminados');
        const cutoffChecks = [...document.querySelectorAll('.cu-cutoff-cb')];
        const def = String(state.culminados.defaultCutoff || '');
        cutoffChecks.forEach(cb => cb.checked = String(cb.value) === def);
        const cutoffCount = document.getElementById('cu-cutoff-count');
        if (cutoffCount && def) cutoffCount.textContent = def;
        setTabDirty('culminados', true);
    }
    // --- CONFIG & BACKEND LOGIC ---
    async function runExport(type) {
        addLog(`Iniciando generacion de ${type} desde SQL...`, 'system');
        let btnId = 'btn-gen-cartera';
        if (type === 'cobranzas') btnId = 'btn-gen-cob';
        if (type === 'gestores') btnId = 'btn-gen-gestores';
        if (type === 'contratos') btnId = 'btn-gen-contratos';
        if (type === 'analytics') btnId = 'btn-gen-analytics';

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
            const isFullSync = syncMode === 'full';
            let analyticsLoaded = false;
            let loadedAny = false;

            if (isFullSync) {
                addLog('Modo de sincronizacion completo: se cargaran datasets raw y analytics si esta disponible.', 'system');

                if (files.analytics) {
                    await fetchAndProcess('analytics_monthly.csv', 'analytics');
                    analyticsLoaded = state.analytics.data.length > 0;
                    loadedAny = loadedAny || analyticsLoaded;
                    if (analyticsLoaded) {
                        addLog(`analytics_monthly.csv cargado (${state.analytics.data.length.toLocaleString()} filas).`, 'success');
                    }
                } else {
                    state.analytics.data = [];
                    setDataReady('analytics', false);
                    addLog('analytics_monthly.csv no encontrado.', 'warn');
                }

                if (files.cartera) {
                    await fetchAndProcess('cartera.csv', 'cartera');
                    loadedAny = true;
                } else {
                    addLog('cartera.csv no encontrado en el servidor.', 'error');
                }

                if (files.cobranzas) {
                    await fetchAndProcess('cobranzas_prepagas.csv', 'cobranzas');
                    loadedAny = true;
                } else {
                    addLog('cobranzas_prepagas.csv no encontrado.', 'error');
                }

                if (files.gestores) {
                    await fetchAndProcess('gestores.csv', 'gestores');
                    loadedAny = true;
                } else {
                    addLog('gestores.csv no encontrado.', 'error');
                }

                if (files.contratos) {
                    await fetchAndProcess('contratos.csv', 'contratos');
                    addLog(`contratos.csv cargado (${state.contratos.data.length.toLocaleString()} filas).`, 'success');
                    loadedAny = true;
                } else {
                    addLog('contratos.csv no encontrado.', 'error');
                }
            } else {
                if (files.analytics) {
                    await fetchAndProcess('analytics_monthly.csv', 'analytics');
                    analyticsLoaded = state.analytics.data.length > 0;
                    loadedAny = loadedAny || analyticsLoaded;
                    if (analyticsLoaded) {
                        addLog(`analytics_monthly.csv cargado (${state.analytics.data.length.toLocaleString()} filas).`, 'success');
                    }
                } else {
                    state.analytics.data = [];
                    setDataReady('analytics', false);
                    addLog('analytics_monthly.csv no encontrado. Se usara flujo raw tradicional.', 'warn');
                }

                if (analyticsLoaded) {
                    addLog('Modo optimizado activado: tabs criticas usan dataset agregado mensual.', 'system');
                    if (files.gestores) {
                        await fetchAndProcess('gestores.csv', 'gestores');
                        loadedAny = true;
                    } else {
                        addLog('gestores.csv no encontrado.', 'warn');
                    }
                    if (files.contratos) {
                        await fetchAndProcess('contratos.csv', 'contratos');
                        addLog(`contratos.csv cargado (${state.contratos.data.length.toLocaleString()} filas).`, 'success');
                        loadedAny = true;
                    } else {
                        addLog('contratos.csv no encontrado.', 'warn');
                    }
                    addLog('Se omite carga pesada de cartera/cobranzas en sincronizacion rapida.', 'system');
                } else {
                    if (files.cartera) {
                        await fetchAndProcess('cartera.csv', 'cartera');
                        loadedAny = true;
                    } else {
                        addLog('cartera.csv no encontrado en el servidor.', 'error');
                    }

                    if (files.cobranzas) {
                        await fetchAndProcess('cobranzas_prepagas.csv', 'cobranzas');
                        loadedAny = true;
                    } else {
                        addLog('cobranzas_prepagas.csv no encontrado.', 'error');
                    }

                    if (files.gestores) {
                        await fetchAndProcess('gestores.csv', 'gestores');
                        loadedAny = true;
                    } else {
                        addLog('gestores.csv no encontrado.', 'error');
                    }

                    if (files.contratos) {
                        await fetchAndProcess('contratos.csv', 'contratos');
                        addLog(`contratos.csv cargado (${state.contratos.data.length.toLocaleString()} filas).`, 'success');
                        loadedAny = true;
                    } else {
                        addLog('contratos.csv no encontrado.', 'error');
                    }
                }
            }

            // Rebuild filters from fresh synced data to avoid stale applied sets
            ['analisisCartera', 'acaMovimiento', 'acaAnuales', 'rendimiento', 'cosecha', 'ltv', 'ltvAge', 'analisisCobranza', 'culminados', 'gestores'].forEach(t => {
                state[t].filtersInitialized = false;
                state[t].filtersApplied = {};
            });
            ['cartera', 'cobranzas'].forEach(t => {
                state[t].filtersApplied = {};
            });

            loading.classList.add('hidden');

            if (loadedAny) {
                showTabsNav();
                dropZone.classList.add('hidden');
                if (isFullSync && state.cartera.data.length) {
                    switchTab('cartera');
                } else {
                    switchTab(analyticsLoaded ? 'analisisCartera' : 'cartera');
                }
            }

            ['cartera', 'cobranzas', 'analisisCartera', 'acaMovimiento', 'acaAnuales', 'rendimiento', 'cosecha', 'ltv', 'ltvAge', 'analisisCobranza', 'culminados', 'gestores'].forEach(t => setTabDirty(t, true));
            if (isFullSync && state.cartera.data.length) {
                await applyTabFilters('cartera');
            } else if (analyticsLoaded) {
                await applyTabFilters('analisisCartera');
            } else if (files.cartera) {
                await applyTabFilters('cartera');
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
    initApplyButtons();

    window.enterConfig = () => {
        showTabsNav();
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






