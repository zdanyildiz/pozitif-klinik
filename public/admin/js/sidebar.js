/**
 * Shared Sidebar & Layout Manager
 */
const Layout = {
    menuItems: [
        {
            title: 'Hizmetler',
            items: [
                { label: 'Hastalar', icon: 'bi-person-heart', url: 'patients.html', id: 'patients' },
                { label: 'Randevular', icon: 'bi-calendar-check', url: 'appointments.html', id: 'appointments' },
                { label: 'Personel', icon: 'bi-people', url: 'clinic-dashboard.html', id: 'staff' }
            ]
        },
        {
            title: 'Kurumsal',
            items: [
                { label: 'Hizmet Tanımları', icon: 'bi-list-check', url: '#', id: 'services' },
                { label: 'Klinik Ayarları', icon: 'bi-gear', url: '#', id: 'settings' }
            ]
        }
    ],

    init: function (activePageIds) {
        this.renderSidebar(activePageIds);
        this.setupMobileToggle();
    },

    renderSidebar: function (activeId) {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;

        let html = `
            <div class="sidebar-header">
                <a href="clinic-dashboard.html" class="sidebar-logo">
                    <div class="sidebar-logo-icon"><i class="bi bi-hospital"></i></div>
                    <div class="sidebar-logo-text">Pozitif<span>Klinik Yönetimi</span></div>
                </a>
                <button class="btn-close-sidebar d-lg-none"><i class="bi bi-x-lg"></i></button>
            </div>
            <nav class="sidebar-nav">`;

        this.menuItems.forEach(section => {
            html += `<div class="nav-section">
                        <div class="nav-section-title">${section.title}</div>`;

            section.items.forEach(item => {
                const isActive = activeId === item.id || window.location.href.includes(item.url);
                const activeClass = isActive ? 'active' : '';
                html += `<a href="${item.url}" class="nav-link-custom ${activeClass}">
                            <i class="bi ${item.icon}"></i>${item.label}
                         </a>`;
            });

            html += `</div>`;
        });

        html += `</nav>`;
        sidebar.innerHTML = html;

        // Close button event
        const closeBtn = sidebar.querySelector('.btn-close-sidebar');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                sidebar.classList.remove('active');
            });
        }
    },

    setupMobileToggle: function () {
        const navbar = document.querySelector('.top-navbar');
        if (!navbar) return;

        // Check if toggle already exists
        if (document.getElementById('sidebarToggle')) return;

        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'sidebarToggle';
        toggleBtn.className = 'btn btn-link text-dark d-lg-none me-2';
        toggleBtn.innerHTML = '<i class="bi bi-list fs-1"></i>';

        // Insert as first child of navbar
        navbar.insertBefore(toggleBtn, navbar.firstChild);

        toggleBtn.addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('active');
        });
    }
};

// Auto-init if script is loaded at bottom and we can guess page
document.addEventListener('DOMContentLoaded', () => {
    // Simple heuristic to determine active page based on filename
    const path = window.location.pathname;
    let activeId = '';
    if (path.includes('patients.html')) activeId = 'patients';
    else if (path.includes('appointments.html')) activeId = 'appointments';
    else if (path.includes('clinic-dashboard.html')) activeId = 'staff';

    Layout.init(activeId);
});
