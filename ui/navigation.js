(function (global) {
    function createNavigationState() {
        return {
            sidebar: 'closed',
            activeTab: 'config',
            setSidebar(isOpen) {
                this.sidebar = isOpen ? 'open' : 'closed';
            },
            setTab(tabId) {
                this.activeTab = tabId;
            }
        };
    }

    global.UINavigation = { createNavigationState };
})(window);
