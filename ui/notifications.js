(function (global) {
    function ensureBox() {
        let el = document.getElementById('ui-message-box');
        if (el) return el;
        el = document.createElement('div');
        el.id = 'ui-message-box';
        el.style.position = 'fixed';
        el.style.right = '16px';
        el.style.bottom = '16px';
        el.style.zIndex = '9999';
        el.style.display = 'flex';
        el.style.flexDirection = 'column';
        el.style.gap = '8px';
        document.body.appendChild(el);
        return el;
    }

    function pushMessage(kind, message, errorObj) {
        if (!message) return;
        const box = ensureBox();
        const item = document.createElement('div');
        item.textContent = message;
        item.style.padding = '10px 12px';
        item.style.borderRadius = '8px';
        item.style.fontFamily = 'Outfit, sans-serif';
        item.style.fontSize = '12px';
        item.style.maxWidth = '420px';
        item.style.border = '1px solid rgba(255,255,255,0.2)';
        item.style.background = kind === 'error' ? 'rgba(239,68,68,0.22)' : (kind === 'warning' ? 'rgba(245,158,11,0.22)' : 'rgba(56,189,248,0.22)');
        item.style.color = '#e2e8f0';
        box.appendChild(item);
        setTimeout(() => item.remove(), 6000);
        if (kind === 'error') console.error(message, errorObj || '');
        else if (kind === 'warning') console.warn(message);
        else console.info(message);
    }

    global.UINotifications = {
        showInfo: (message) => pushMessage('info', message),
        showWarning: (message) => pushMessage('warning', message),
        showError: (message, errorObj) => pushMessage('error', message, errorObj)
    };
})(window);
