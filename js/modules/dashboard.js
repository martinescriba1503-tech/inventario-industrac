/**
 * SISTEMA DE CONTROL DE ALMACÉN – INDUSTRAC S.A.C.
 * Módulo 1: Dashboard y Panel Principal (Versión 1.1)
 * Incluye visualización de Inventario Agrupado por Familias (AF-100, OF-100, etc.)
 */

import { getSupabase } from '../config.js';
import { 
    showToast, 
    formatDateTime, 
    getStockStatusBadge 
} from '../utils/ui.js';
import { INDUSTRAC_FAMILIES } from './products.js';

/**
 * Renderiza el Dashboard
 */
export async function renderDashboardView(container) {
    container.innerHTML = `
        <!-- Acceso Rápido Operativo (Móviles y Escritorio) -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
            <a href="#/salidas" class="btn btn-primary btn-large-action" style="background: linear-gradient(135deg, #031240 0%, #18A2D9 100%);">
                <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
                SALIDA (ESCANEAR OCR)
            </a>
            <a href="#/ingresos" class="btn btn-accent btn-large-action" style="color: #031240;">
                <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                REGISTRAR INGRESO
            </a>
        </div>

        <!-- Grilla de Indicadores Globales (KPIs) -->
        <div class="kpi-grid">
            <div class="kpi-card kpi-blue">
                <div class="kpi-icon-wrapper">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                </div>
                <div class="kpi-details">
                    <span class="kpi-value" id="dashTotalRefs">0</span>
                    <span class="kpi-label">Referencias Registradas</span>
                </div>
            </div>

            <div class="kpi-card kpi-blue">
                <div class="kpi-icon-wrapper">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>
                </div>
                <div class="kpi-details">
                    <span class="kpi-value" id="dashTotalUnits">0</span>
                    <span class="kpi-label">Total Unidades Físicas</span>
                </div>
            </div>

            <div class="kpi-card kpi-green">
                <div class="kpi-icon-wrapper">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <div class="kpi-details">
                    <span class="kpi-value" id="dashAvailableUnits" style="color: var(--status-available);">0</span>
                    <span class="kpi-label">Existencias Disponibles</span>
                </div>
            </div>

            <div class="kpi-card">
                <div class="kpi-icon-wrapper">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                </div>
                <div class="kpi-details">
                    <span class="kpi-value" id="dashWithdrawnUnits">0</span>
                    <span class="kpi-label">Unidades Retiradas</span>
                </div>
            </div>
        </div>

        <!-- NUEVA SECCIÓN: Inventario Agrupado por Grupos / Familias (AF-100, OF-100, etc.) -->
        <div class="card">
            <div class="card-header">
                <div>
                    <h3 class="card-title">
                        <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg>
                        Inventario Agrupado por Familias de Repuestos
                    </h3>
                    <p style="font-size: 0.82rem; color: var(--color-text-muted);">
                        Control de existencias consolidado según los grupos de stickers de almacén.
                    </p>
                </div>
                <a href="#/productos" class="btn btn-secondary btn-sm">Ver Catálogo Completo</a>
            </div>

            <div id="familiesGridContainer" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;">
                <div style="text-align: center; color: var(--color-text-muted); padding: 1.5rem; grid-column: 1 / -1;">
                    Cargando existencias por familias...
                </div>
            </div>
        </div>

        <!-- Sección de Dos Columnas: Alertas de Stock y Últimos Movimientos -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 1.5rem;">
            <!-- Columna Izquierda: Alertas de Reposición -->
            <div class="card" style="margin-bottom: 0;">
                <div class="card-header">
                    <h3 class="card-title">
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                        Alertas de Reposición Inmediata
                    </h3>
                    <a href="#/reposicion" class="btn btn-secondary btn-sm">Ir a Reposición</a>
                </div>
                <div class="table-responsive" style="max-height: 380px; overflow-y: auto;">
                    <table class="custom-table">
                        <thead>
                            <tr>
                                <th>Referencia</th>
                                <th>Disp.</th>
                                <th>Mín.</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody id="dashStockAlertsBody">
                            <tr><td colspan="4" style="text-align: center; padding: 2rem;">Cargando alertas...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Columna Derecha: Últimos Movimientos -->
            <div class="card" style="margin-bottom: 0;">
                <div class="card-header">
                    <h3 class="card-title">
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        Últimos Movimientos Registrados
                    </h3>
                    <a href="#/historial" class="btn btn-secondary btn-sm">Ver Historial</a>
                </div>
                <div class="table-responsive" style="max-height: 380px; overflow-y: auto;">
                    <table class="custom-table">
                        <thead>
                            <tr>
                                <th>Hora</th>
                                <th>Tipo</th>
                                <th>Sticker</th>
                                <th>Producto</th>
                            </tr>
                        </thead>
                        <tbody id="dashRecentMovementsBody">
                            <tr><td colspan="4" style="text-align: center; padding: 2rem;">Cargando movimientos...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    await loadDashboardData();
}

/**
 * Consulta Supabase para poblar los indicadores y las tarjetas de familias
 */
async function loadDashboardData() {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
        // 1. Resumen de Productos y Stock
        const { data: stockSummary, error: stockErr } = await supabase
            .from('v_product_stock_summary')
            .select('*');

        if (!stockErr && stockSummary) {
            let totalRefs = stockSummary.length;
            let totalUnits = 0;
            let availableUnits = 0;
            let withdrawnUnits = 0;
            const alertsList = [];

            // Diccionario para agrupar por familia de manera local y ultra rápida
            const familiesMap = {};

            // Inicializar las familias oficiales de INDUSTRAC
            INDUSTRAC_FAMILIES.forEach(f => {
                familiesMap[f] = {
                    family_code: f,
                    total_products: 0,
                    total_units: 0,
                    available_units: 0,
                    withdrawn_units: 0
                };
            });

            stockSummary.forEach(p => {
                totalUnits += Number(p.total_registered_units || 0);
                availableUnits += Number(p.available_units || 0);
                withdrawnUnits += Number(p.withdrawn_units || 0);

                if (p.stock_status === 'PROXIMO' || p.stock_status === 'CRITICO' || p.stock_status === 'AGOTADO') {
                    alertsList.push(p);
                }

                const fam = p.internal_code || 'SIN_GRUPO';
                if (!familiesMap[fam]) {
                    familiesMap[fam] = {
                        family_code: fam,
                        total_products: 0,
                        total_units: 0,
                        available_units: 0,
                        withdrawn_units: 0
                    };
                }

                familiesMap[fam].total_products++;
                familiesMap[fam].total_units += Number(p.total_registered_units || 0);
                familiesMap[fam].available_units += Number(p.available_units || 0);
                familiesMap[fam].withdrawn_units += Number(p.withdrawn_units || 0);
            });

            document.getElementById('dashTotalRefs').textContent = totalRefs;
            document.getElementById('dashTotalUnits').textContent = totalUnits;
            document.getElementById('dashAvailableUnits').textContent = availableUnits;
            document.getElementById('dashWithdrawnUnits').textContent = withdrawnUnits;

            // Renderizar tarjetas por familias
            renderFamiliesGrid(Object.values(familiesMap));

            // Renderizar alertas
            renderDashboardAlerts(alertsList);
        }

        // 2. Últimos Movimientos
        const { data: recentMovs } = await supabase
            .from('inventory_movements')
            .select(`
                created_at,
                movement_type,
                unit_code,
                products ( name, description, part_number )
            `)
            .order('created_at', { ascending: false })
            .limit(8);

        renderDashboardRecentMovements(recentMovs || []);

    } catch (err) {
        console.error('Error al actualizar Dashboard:', err);
    }
}

/**
 * Renderiza la cuadrícula de tarjetas de familias (AF-100, OF-100, OSVK-704, etc.)
 */
function renderFamiliesGrid(families) {
    const container = document.getElementById('familiesGridContainer');
    if (!container) return;

    if (families.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--color-text-muted); padding: 1.5rem; grid-column: 1 / -1;">
                No hay familias de repuestos registradas todavía.
            </div>
        `;
        return;
    }

    container.innerHTML = families.map(f => {
        const percentAvailable = f.total_units > 0 
            ? Math.round((f.available_units / f.total_units) * 100) 
            : 0;

        return `
            <div style="background: #F8FAFC; border: 1.5px solid var(--color-border); border-radius: var(--radius-md); padding: 1.15rem; transition: transform var(--transition-fast), box-shadow var(--transition-fast);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                    <span class="code-pill" style="font-size: 1rem; font-weight: 800; background: var(--color-primary-dark); color: white;">
                        ${f.family_code}
                    </span>
                    <span style="font-size: 0.75rem; color: var(--color-text-muted); font-weight: 600;">
                        ${f.total_products} ref.
                    </span>
                </div>

                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.35rem; text-align: center; margin-bottom: 0.75rem; background: white; padding: 0.65rem 0.35rem; border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
                    <div>
                        <div style="font-size: 0.7rem; color: var(--color-text-muted); text-transform: uppercase;">Total</div>
                        <div style="font-size: 1.15rem; font-weight: 800; color: var(--color-primary-dark);">${f.total_units}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.7rem; color: var(--status-available); text-transform: uppercase; font-weight: 700;">Disp.</div>
                        <div style="font-size: 1.15rem; font-weight: 800; color: var(--status-available);">${f.available_units}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.7rem; color: #64748B; text-transform: uppercase;">Retiradas</div>
                        <div style="font-size: 1.15rem; font-weight: 800; color: #64748B;">${f.withdrawn_units}</div>
                    </div>
                </div>

                <!-- Barra de disponibilidad física -->
                <div style="width: 100%; height: 6px; background: #E2E8F0; border-radius: 9999px; overflow: hidden; margin-bottom: 0.5rem;">
                    <div style="width: ${percentAvailable}%; height: 100%; background: ${percentAvailable > 20 ? 'var(--status-available)' : 'var(--status-critical)'}; transition: width 0.4s ease;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--color-text-muted);">
                    <span>Disponibilidad</span>
                    <strong style="color: var(--color-primary-dark);">${percentAvailable}%</strong>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Renderiza la tabla de alertas
 */
function renderDashboardAlerts(alerts) {
    const tbody = document.getElementById('dashStockAlertsBody');
    if (!tbody) return;

    if (alerts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: var(--status-available); padding: 1.5rem; font-weight: 600;">
                    ✓ Todos los productos cuentan con stock suficiente.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = alerts.slice(0, 8).map(p => `
        <tr>
            <td>
                <strong>${p.name || p.description}</strong>
                <div style="font-size: 0.75rem; color: var(--color-text-muted);">
                    [${p.internal_code}] P/N: ${p.part_number}
                </div>
            </td>
            <td><strong style="color: ${p.available_units > 0 ? 'var(--status-available)' : 'var(--status-critical)'}">${p.available_units}</strong></td>
            <td>${p.min_stock}</td>
            <td>${getStockStatusBadge(p.stock_status)}</td>
        </tr>
    `).join('');
}

/**
 * Renderiza la tabla de últimos movimientos
 */
function renderDashboardRecentMovements(movements) {
    const tbody = document.getElementById('dashRecentMovementsBody');
    if (!tbody) return;

    if (movements.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: var(--color-text-muted); padding: 1.5rem;">
                    No se han registrado movimientos todavía.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = movements.map(m => {
        let badgeClass = 'badge-ingreso';
        if (m.movement_type === 'SALIDA') badgeClass = 'badge-salida';
        if (m.movement_type === 'DEVOLUCION') badgeClass = 'badge-devolucion';

        const prodName = m.products?.name || m.products?.description || '-';

        return `
            <tr>
                <td style="font-size: 0.78rem; white-space: nowrap;">${formatDateTime(m.created_at).split(',')[1] || ''}</td>
                <td><span class="badge ${badgeClass}">${m.movement_type}</span></td>
                <td><strong class="code-pill">${m.unit_code}</strong></td>
                <td style="font-size: 0.82rem; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${prodName}">
                    ${prodName}
                </td>
            </tr>
        `;
    }).join('');
}
