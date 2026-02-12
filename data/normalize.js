(function (global) {
    function normD(s) {
        const val = String(s || '').trim();
        if (!val.includes('/')) return val;
        const p = val.replace(/[^0-9/]/g, '').split('/');
        if (p.length < 2) return val;
        return p[0].padStart(2, '0') + '/' + p[1];
    }

    function monthFromDate(dateStr) {
        const val = String(dateStr || '').trim();
        if (!val) return '';
        if (/^\d{1,2}\/\d{4}$/.test(val)) return normD(val);

        let m = val.match(/^(\d{4})[-/](\d{1,2})[-/]\d{1,2}/);
        if (m) return String(m[2]).padStart(2, '0') + '/' + m[1];

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

    function monthCompare(mm1, mm2) {
        return monthToSerial(mm1) - monthToSerial(mm2);
    }

    function isActiveAtCutoff(contract, cutoffMonth) {
        const culm = String((contract || {})._culminacionMonth || '');
        if (!culm) return true;
        return monthCompare(culm, cutoffMonth) > 0;
    }

    function sumCobradoBetweenMonths(contractMonthMap, startMonth, endMonth) {
        const start = monthToSerial(startMonth);
        const end = monthToSerial(endMonth);
        if (start < 0 || end < 0 || end < start) return 0;
        let total = 0;
        for (const mm in (contractMonthMap || {})) {
            const s = monthToSerial(mm);
            if (s >= start && s <= end) total += (parseFloat(contractMonthMap[mm]) || 0);
        }
        return total;
    }

    global.DashboardNormalize = {
        normD,
        monthFromDate,
        addMonths,
        monthsBetweenDateAndMonth,
        normalizeViaCobro,
        monthToSerial,
        monthCompare,
        isActiveAtCutoff,
        sumCobradoBetweenMonths
    };
})(window);
