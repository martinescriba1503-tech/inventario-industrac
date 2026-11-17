/**
 * SISTEMA DE CONTROL DE ALMACÉN – INDUSTRAC S.A.C.
 * Enrutador de Vistas Single Page Application (SPA Router)
 */

import { renderDashboardView } from './modules/dashboard.js';
import { renderProductsView } from './modules/products.js';
import { renderEntriesView } from './modules/entries.js';
import { renderExitsView } from './modules/exits.js';
import { renderReturnsView } from './modules/returns.js';
import { renderHistoryView } from './modules/history.js';
import { renderReplenishmentView } from './modules/replenishment.js';

// Mapa de rutas activas
const routes = {
    dashboard: renderDashboardView,
    productos: renderProductsView,
    ingresos: renderEntriesView,
    salidas: renderExitsView,
    devoluciones: renderReturnsView,
    historial: renderHistoryView,
    reposicion: renderReplenishmentView
};

/**
 * Navega a una ruta específica o procesa el hash actual
 */
export async function handleNavigation() {
    const rawHash = window.location.hash.slice(2) || 'dashboard';
    const [routeName, queryParams] = rawHash.split('?');
    const targetRoute = routeName.toLowerCase() || 'dashboard';

    // Actualizar enlaces activos en barra lateral
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.route === targetRoute);
    });

    // Actualizar enlaces activos en barra móvil inferior
    document.querySelectorAll('.bottom-bar-item').forEach(el => {
        el.classList.toggle('active', el.dataset.route === targetRoute);
    });

    // Actualizar encabezado dinámico
    const titles = {
        dashboard: 'Dashboard – Panel de Control',
        productos: 'Catálogo Maestro de Productos',
        ingresos: 'Registro de Ingresos de Repuestos',
        salidas: 'Control de Salidas (Escaneo OCR)',
        devoluciones: 'Devolución de Repuestos al Almacén',
        historial: 'Historial Cronológico de Movimientos',
        reposicion: 'Panel de Reposición y Stock Crítico'
    };
    const titleEl = document.getElementById('pageHeaderTitle');
    if (titleEl) {
        titleEl.textContent = titles[targetRoute] || 'INDUSTRAC Almacén';
    }

    // Cerrar menú móvil si está abierto
    const sidebar = document.getElementById('appSidebar');
    if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
    }

    const container = document.getElementById('mainViewContainer');
    if (!container) return;

    if (routes[targetRoute]) {
        try {
            await routes[targetRoute](container, queryParams);
        } catch (err) {
            console.error(`Error al cargar vista ${targetRoute}:`, err);
            container.innerHTML = `
                <div class="card" style="text-align: center; padding: 3rem;">
                    <h3 style="color: var(--status-critical); margin-bottom: 0.5rem;">Error al cargar la sección</h3>
                    <p style="color: var(--color-text-muted);">${err.message}</p>
                </div>
            `;
        }
    } else {
        container.innerHTML = `
            <div class="card" style="text-align: center; padding: 3rem;">
                <h3 style="color: var(--color-primary-dark); margin-bottom: 0.5rem;">Página no encontrada</h3>
                <p style="color: var(--color-text-muted);">La sección solicitada no existe. Regrese al <a href="#/dashboard" style="color: var(--color-accent); font-weight: 600;">Dashboard</a>.</p>
            </div>
        `;
    }
}

/**
 * Inicializa el enrutador
 */
export function initRouter() {
    window.addEventListener('hashchange', handleNavigation);
    handleNavigation();
}
