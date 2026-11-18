/**
 * SISTEMA DE CONTROL DE ALMACÉN – INDUSTRAC S.A.C.
 * Módulo 1: Dashboard y Panel Principal (Versión 1.3)
 * Conexión reactiva en tiempo real con Supabase y respaldo local instantáneo
 */

import { getSupabase } from '../config.js';
import { 
    showToast, 
    formatDateTime, 
    getStockStatusBadge 
} from '../utils/ui.js';
import { 
    INDUSTRAC_FAMILIES, 
    getLocalProducts, 
    getLocalUnits, 
    getLocalMovements 
} from './products.js';

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

        <!-- SECCIÓN: Inventario Agrupado por Grupos / Familias (AF-100, OF-100, OF-600, etc.) -->
        <div class="card">
            <div class="card-header">
                <div>
                    <h3 class="card-title">
                        <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg>
                        Inventario Agrupado por Familias de Repuestos
                    </h3>
                    <p style="font-size: 0.82rem; color: var(--color-text-muted);">
                        Control consolidado de existencias según los grupos de stickers de almacén.
                    </p>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button type="button" class="btn btn-secondary btn-sm" id="btnRefreshDashboard" title="Actualizar datos">
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                        Actualizar
                    </button>
                    <a href="#/productos" class="btn btn-primary btn-sm">Ver Catálogo</a>
                </div>
            </div>

            <div id="familiesGridContainer" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 1rem;">
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

    document.getElementById('btnRefreshDashboard')?.addEventListener('click', loadDashboardData);
    await loadDashboardData();
}

/**
 * Consulta Supabase o almacenamiento local para sincronizar todos los indicadores
 */
async function loadDashboardData() {
    const supabase = getSupabase();
    let stockSummary = null;
    let recentMovs = [];

    // Intento 1: Consultar Supabase si está disponible
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('v_product_stock_summary')
                .select('*');

            if (!error && data && data.length > 0) {
                stockSummary = data;
            }

            const { data: movs } = await supabase
                .from('inventory_movements')
                .select(`
                    created_at,
                    movement_type,
                    unit_code,
                    products ( name, description, part_number )
                `)
                .order('created_at', { ascending: false })
                .limit(8);

            if (movs && movs.length > 0) {
                recentMovs = movs;
            }
        } catch (err) {
            console.warn('Error leyendo Supabase en Dashboard, usando datos locales:', err);
        }
    }

    // Intento 2: Cargar datos locales (para funcionamiento 100% autónomo)
    if (!stockSummary || stockSummary.length === 0) {
        const localProds = getLocalProducts();
        const localUnits = getLocalUnits();

        stockSummary = localProds.map(p => {
            const pid = p.product_id || p.id;
            const units = localUnits.filter(u => u.product_id === pid);
            const avail = units.filter(u => u.status === 'DISPONIBLE').length;
            const withdr = units.filter(u => u.status === 'RETIRADO').length;
            const total = units.length;

            let status = 'NORMAL';
            if (avail === 0) status = 'AGOTADO';
            else if (avail <= p.min_stock * 0.5) status = 'CRITICO';
            else if (avail <= p.min_stock) status = 'PROXIMO';

            return {
                ...p,
                product_id: pid,
                total_registered_units: total,
                available_units: avail,
                withdrawn_units: withdr,
                stock_status: status
            };
        });

        if (recentMovs.length === 0) {
            recentMovs = getLocalMovements().slice(0, 8);
        }
    }

    // Procesar métricas globales
    let totalRefs = stockSummary.length;
    let totalUnits = 0;
    let availableUnits = 0;
    let withdrawnUnits = 0;
    const alertsList = [];
    const familiesMap = {};

    // Inicializar familias oficiales reconocidas
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
        const pTotal = Number(p.total_registered_units || 0);
        const pAvail = Number(p.available_units || 0);
        const pWithdr = Number(p.withdrawn_units || 0);

        totalUnits += pTotal;
        availableUnits += pAvail;
        withdrawnUnits += pWithdr;

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
        familiesMap[fam].total_units += pTotal;
        familiesMap[fam].available_units += pAvail;
        familiesMap[fam].withdrawn_units += pWithdr;
    });

    // Actualizar Contadores Superiores
    const elRefs = document.getElementById('dashTotalRefs');
    const elTotal = document.getElementById('dashTotalUnits');
    const elAvail = document.getElementById('dashAvailableUnits');
    const elWithdr = document.getElementById('dashWithdrawnUnits');

    if (elRefs) elRefs.textContent = totalRefs;
    if (elTotal) elTotal.textContent = totalUnits;
    if (elAvail) elAvail.textContent = availableUnits;
    if (elWithdr) elWithdr.textContent = withdrawnUnits;

    // Renderizar tarjetas de familias
    renderFamiliesGrid(Object.values(familiesMap));

    // Renderizar alertas
    renderDashboardAlerts(alertsList);

    // Renderizar últimos movimientos
    renderDashboardRecentMovements(recentMovs);
}

/**
 * Renderiza la cuadrícula de tarjetas de familias
 */
function renderFamiliesGrid(families) {
    const container = document.getElementById('familiesGridContainer');
    if (!container) return;

    if (families.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--color-text-muted); padding: 1.5rem; grid-column: 1 / -1;">
                No hay familias de repuestos registradas todavía. Ingrese a <strong>Productos</strong> para registrar la primera.
            </div>
        `;
        return;
    }

    // Filtrar familias: mostrar las que tienen productos/unidades, o las oficiales principales
    const toShow = families.filter(f => f.total_products > 0 || f.total_units > 0 || INDUSTRAC_FAMILIES.includes(f.family_code));

    container.innerHTML = toShow.map(f => {
        const percentAvailable = f.total_units > 0 
            ? Math.round((f.available_units / f.total_units) * 100) 
            : 0;

        return `
            <div style="background: white; border: 1.5px solid var(--color-border); border-radius: var(--radius-md); padding: 1.15rem; box-shadow: var(--shadow-sm); transition: transform var(--transition-fast);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                    <span class="code-pill" style="font-size: 1rem; font-weight: 800; background: var(--color-primary-dark); color: white;">
                        ${f.family_code}
                    </span>
                    <span style="font-size: 0.75rem; color: var(--color-text-muted); font-weight: 600;">
                        ${f.total_products} ${f.total_products === 1 ? 'producto' : 'productos'}
                    </span>
                </div>

                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.35rem; text-align: center; margin-bottom: 0.75rem; background: #F8FAFC; padding: 0.65rem 0.35rem; border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
                    <div>
                        <div style="font-size: 0.68rem; color: var(--color-text-muted); text-transform: uppercase;">Total</div>
                        <div style="font-size: 1.2rem; font-weight: 800; color: var(--color-primary-dark);">${f.total_units}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.68rem; color: var(--status-available); text-transform: uppercase; font-weight: 700;">Disp.</div>
                        <div style="font-size: 1.2rem; font-weight: 800; color: var(--status-available);">${f.available_units}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.68rem; color: #64748B; text-transform: uppercase;">Retiradas</div>
                        <div style="font-size: 1.2rem; font-weight: 800; color: #64748B;">${f.withdrawn_units}</div>
                    </div>
                </div>

                <!-- Barra de disponibilidad física -->
                <div style="width: 100%; height: 6px; background: #E2E8F0; border-radius: 9999px; overflow: hidden; margin-bottom: 0.4rem;">
                    <div style="width: ${percentAvailable}%; height: 100%; background: ${percentAvailable > 0 ? 'var(--status-available)' : '#CBD5E1'}; transition: width 0.4s ease;"></div>
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
