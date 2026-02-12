(function (global) {
    const normalize = global.DashboardNormalize || {};

    function monthFromDate(v) {
        if (normalize.monthFromDate) return normalize.monthFromDate(v);
        return '';
    }

    function normD(v) {
        if (normalize.normD) return normalize.normD(v);
        return String(v || '');
    }

    function requiredColumns(type) {
        if (type === 'cartera') return ['id_contrato', 'Fecha gestion', 'UN', 'tramo', 'monto_cuota', 'monto_vencido'];
        if (type === 'cobranzas') return ['monto'];
        if (type === 'gestores') return ['contract_id', 'from_date', 'Gestor'];
        if (type === 'contratos') return [];
        return [];
    }

    function hasAnyColumn(sample, cols) {
        const keys = Object.keys(sample || {}).map(k => String(k || '').trim().toLowerCase());
        for (let i = 0; i < cols.length; i++) {
            const col = String(cols[i] || '').trim().toLowerCase();
            if (keys.includes(col)) return true;
        }
        return false;
    }

    function hasAnyField(row, fields) {
        for (let i = 0; i < fields.length; i++) {
            const v = row[fields[i]];
            if (v !== undefined && v !== null && String(v).trim() !== '') return true;
        }
        return false;
    }

    function validateDataset(type, rows) {
        const issues = { fatal: [], warnings: [] };
        if (!Array.isArray(rows) || rows.length === 0) {
            issues.fatal.push(`El dataset ${type} no tiene filas.`);
            return issues;
        }

        const sample = rows[0] || {};
        const required = requiredColumns(type);
        for (let i = 0; i < required.length; i++) {
            if (!(required[i] in sample)) {
                issues.fatal.push(`Falta columna requerida '${required[i]}' en ${type}.`);
            }
        }
        if (type === 'contratos' && !hasAnyColumn(sample, ['contract_id', 'id', 'id_contrato'])) {
            issues.fatal.push("Falta columna de identificador en contratos. Use 'contract_id', 'id' o 'id_contrato'.");
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
            }
        }

        if (invalidIds > 0) issues.warnings.push(`${type}: ${invalidIds} filas con identificador vacio (muestra ${maxScan}).`);
        if (invalidNumbers > 0) issues.warnings.push(`${type}: ${invalidNumbers} filas con montos no numericos (muestra ${maxScan}).`);
        if (invalidDates > 0) issues.warnings.push(`${type}: ${invalidDates} filas con fecha invalida (muestra ${maxScan}).`);
        return issues;
    }

    global.DataValidator = { validateDataset };
})(window);
