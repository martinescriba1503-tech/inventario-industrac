/**
 * SISTEMA DE CONTROL DE ALMACÉN – INDUSTRAC S.A.C.
 * Módulo 1: Dashboard y Panel Principal de Indicadores en Tiempo Real
 */

import { getSupabase } from '../config.js';
import { 
    showToast, 
    formatDateTime, 
    getStockStatusBadge 
} from '../utils/ui.js';

/**
 * Renderiza el Dashboard
 */
export async function renderDashboardView(container) {
    container.innerHTML = `
        <!-- Acceso Rápido Operativo (Especialmente visible en Celulares) -->
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

        <!-- Grilla de Indicadores Clave (KPIs) -->
        <div class="kpi-grid">
            <!-- 1. Total Referencias -->
            <div class="kpi-card kpi-blue">
                <div class="kpi-icon-wrapper">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                </div>
                <div class="kpi-details">
                    <span class="kpi-value" id="dashTotalRefs">0</span>
                    <span class="kpi-label">Referencias de Productos</span>
                </div>
            </div>

            <!-- 2. Unidades Registradas -->
            <div class="kpi-card kpi-blue">
                <div class="kpi-icon-wrapper">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>
                </div>
                <div class="kpi-details">
                    <span class="kpi-value" id="dashTotalUnits">0</span>
                    <span class="kpi-label">Total Unidades Físicas</span>
                </div>
            </div>

            <!-- 3. Unidades Disponibles -->
            <div class="kpi-card kpi-green">
                <div class="kpi-icon-wrapper">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <div class="kpi-details">
                    <span class="kpi-value" id="dashAvailableUnits" style="color: var(--status-available);">0</span>
                    <span class="kpi-label">Unidades Disponibles</span>
                </div>
            </div>

            <!-- 4. Unidades Retiradas -->
            <div class="kpi-card">
                <div class="kpi-icon-wrapper">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                </div>
                <div class="kpi-details">
                    <span class="kpi-value" id="dashWithdrawnUnits">0</span>
                    <span class="kpi-label">Unidades Retiradas</span>
                </div>
            </div>

            <!-- 5. Unidades Devueltas -->
            <div class="kpi-card kpi-blue">
                <div class="kpi-icon-wrapper">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                </div>
                <div class="kpi-details">
                    <span class="kpi-value" id="dashReturnedUnits">0</span>
                    <span class="kpi-label">Devoluciones Históricas</span>
                </div>
            </div>

            <!-- 6. Movimientos del Mes -->
            <div class="kpi-card kpi-blue">
                <div class="kpi-icon-wrapper">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                </div>
                <div class="kpi-details">
                    <span class="kpi-value" id="dashMonthMovements">0</span>
                    <span class="kpi-label">Movimientos del Mes</span>
                </div>
            </div>

            <!-- 7. Productos con Stock Bajo -->
            <div class="kpi-card kpi-yellow">
                <div class="kpi-icon-wrapper">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                </div>
                <div class="kpi-details">
                    <span class="kpi-value" id="dashLowStockCount" style="color: var(--status-warning);">0</span>
                    <span class="kpi-label">Stock Próximo al Mínimo</span>
                </div>
            </div>

            <!-- 8. Productos Agotados o Críticos -->
            <div class="kpi-card kpi-red">
                <div class="kpi-icon-wrapper">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
                </div>
                <div class="kpi-details">
                    <span class="kpi-value" id="dashCriticalStockCount" style="color: var(--status-critical);">0</span>
                    <span class="kpi-label">Críticos o Agotados</span>
                </div>
            </div>
        </div>

        <!-- Sección de Dos Columnas: Alertas de Stock y Últimos Movimientos -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 1.5rem;">
            <!-- Columna Izquierda: Alertas de Stock Crítico -->
            <div class="card" style="margin-bottom: 0;">
                <div class="card-header">
                    <h3 class="card-title">
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                        Alertas de Reposición Inmediata
                    </h3>
                    <a href="#/reposicion" class="btn btn-secondary btn-sm">Ver Todo</a>
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

            <!-- Columna Derecha: Últimos Movimientos en Almacén -->
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
                                <th>Repuesto</th>
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
 * Consulta Supabase para poblar los indicadores y tablas del Dashboard
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
            let lowCount = 0;
            let critCount = 0;

            const alertsList = [];

            stockSummary.forEach(p => {
                totalUnits += Number(p.total_registered_units || 0);
                availableUnits += Number(p.available_units || 0);
                withdrawnUnits += Number(p.withdrawn_units || 0);

                if (p.stock_status === 'PROXIMO') {
                    lowCount++;
                    alertsList.push(p);
                } else if (p.stock_status === 'CRITICO' || p.stock_status === 'AGOTADO') {
                    critCount++;
                    alertsList.push(p);
                }
            });

            document.getElementById('dashTotalRefs').textContent = totalRefs;
            document.getElementById('dashTotalUnits').textContent = totalUnits;
            document.getElementById('dashAvailableUnits').textContent = availableUnits;
            document.getElementById('dashWithdrawnUnits').textContent = withdrawnUnits;
            document.getElementById('dashLowStockCount').textContent = lowCount;
            document.getElementById('dashCriticalStockCount').textContent = critCount;

            // Renderizar tabla de alertas
            renderDashboardAlerts(alertsList);
        }

        // 2. Conteo de Movimientos de Devolución
        const { count: returnCount } = await supabase
            .from('inventory_movements')
            .select('*', { count: 'exact', head: true })
            .eq('movement_type', 'DEVOLUCION');

        document.getElementById('dashReturnedUnits').textContent = returnCount || 0;

        // 3. Movimientos del mes en curso
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const { count: monthCount } = await supabase
            .from('inventory_movements')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startOfMonth);

        document.getElementById('dashMonthMovements').textContent = monthCount || 0;

        // 4. Últimos Movimientos
        const { data: recentMovs } = await supabase
            .from('inventory_movements')
            .select(`
                created_at,
                movement_type,
                unit_code,
                products ( description, part_number )
            `)
            .order('created_at', { ascending: false })
            .limit(8);

        renderDashboardRecentMovements(recentMovs || []);

    } catch (err) {
        console.error('Error al actualizar Dashboard:', err);
    }
}

/**
 * Renderiza la tabla de alertas de reposición del dashboard
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
                <strong>${p.part_number}</strong>
                <div style="font-size: 0.78rem; color: var(--color-text-muted);">${p.description}</div>
            </td>
            <td><strong style="color: ${p.available_units > 0 ? 'var(--status-available)' : 'var(--status-critical)'}">${p.available_units}</strong></td>
            <td>${p.min_stock}</td>
            <td>${getStockStatusBadge(p.stock_status)}</td>
        </tr>
    `).join('');
}

/**
 * Renderiza la tabla de últimos movimientos del dashboard
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

        return `
            <tr>
                <td style="font-size: 0.78rem; white-space: nowrap;">${formatDateTime(m.created_at).split(',')[1] || ''}</td>
                <td><span class="badge ${badgeClass}">${m.movement_type}</span></td>
                <td><strong class="code-pill">${m.unit_code}</strong></td>
                <td style="font-size: 0.82rem; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${m.products?.description || '-'}
                </td>
            </tr>
        `;
    }).join('');
}
