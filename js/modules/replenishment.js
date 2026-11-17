/**
 * SISTEMA DE CONTROL DE ALMACÉN – INDUSTRAC S.A.C.
 * Módulo 7: Panel de Reposición y Alertas de Stock Crítico
 */

import { getSupabase } from '../config.js';
import { isAdmin } from '../auth.js';
import { 
    showToast, 
    showLoading, 
    hideLoading, 
    openModal, 
    closeModal,
    getStockStatusBadge 
} from '../utils/ui.js';
import { exportToExcel } from '../utils/excel.js';

let replenishmentData = [];

/**
 * Renderiza la interfaz de Reposición
 */
export async function renderReplenishmentView(container) {
    const adminMode = isAdmin();

    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <div>
                    <h2 class="card-title">
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                        Panel de Reposición de Almacén
                    </h2>
                    <p style="font-size: 0.85rem; color: var(--color-text-muted);">
                        Monitoreo preventivo por referencia comercial para emitir órdenes de compra y evitar desabastecimiento.
                    </p>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button type="button" class="btn btn-secondary" id="btnExportReplenishmentExcel">
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        Exportar Requisición a Excel
                    </button>
                </div>
            </div>

            <!-- Resumen de Alertas en Tarjetas -->
            <div class="kpi-grid">
                <div class="kpi-card kpi-red">
                    <div class="kpi-icon-wrapper">
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
                    </div>
                    <div class="kpi-details">
                        <span class="kpi-value" id="kpiAgotados">0</span>
                        <span class="kpi-label">Productos Agotados</span>
                    </div>
                </div>

                <div class="kpi-card kpi-red">
                    <div class="kpi-icon-wrapper">
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    </div>
                    <div class="kpi-details">
                        <span class="kpi-value" id="kpiCriticos">0</span>
                        <span class="kpi-label">Stock Crítico (≤ 50% mín)</span>
                    </div>
                </div>

                <div class="kpi-card kpi-yellow">
                    <div class="kpi-icon-wrapper">
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </div>
                    <div class="kpi-details">
                        <span class="kpi-value" id="kpiProximos">0</span>
                        <span class="kpi-label">Próximos a Mínimo</span>
                    </div>
                </div>

                <div class="kpi-card kpi-blue">
                    <div class="kpi-icon-wrapper">
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                    </div>
                    <div class="kpi-details">
                        <span class="kpi-value" id="kpiTotalSugerido">0</span>
                        <span class="kpi-label">Unidades Totales a Reponer</span>
                    </div>
                </div>
            </div>

            <!-- Filtros de Estado -->
            <div class="filter-toolbar">
                <div class="search-input-group">
                    <svg class="search-icon" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    <input type="text" id="replenishSearchInput" class="form-control" placeholder="Buscar por producto, P/N o familia...">
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <select id="replenishStatusFilter" class="form-control" style="width: auto;">
                        <option value="REPOSICION">Solo los que Requieren Reposición</option>
                        <option value="TODOS">Todos los Productos</option>
                        <option value="AGOTADO">Solo Agotados</option>
                        <option value="CRITICO">Solo Críticos</option>
                        <option value="PROXIMO">Solo Próximos</option>
                    </select>
                    <button type="button" class="btn btn-secondary" id="btnRefreshReplenishment" title="Actualizar">
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                    </button>
                </div>
            </div>

            <!-- Tabla de Reposición -->
            <div class="table-responsive">
                <table class="custom-table" id="replenishmentTable">
                    <thead>
                        <tr>
                            <th>Familia</th>
                            <th>Part Number</th>
                            <th>Descripción</th>
                            <th>Stock Disponible</th>
                            <th>Stock Mínimo</th>
                            <th>Estado de Alerta</th>
                            <th>Sugerencia de Reposición</th>
                            <th>Ubicación</th>
                            ${adminMode ? '<th style="text-align: right;">Ajustar Mínimo</th>' : ''}
                        </tr>
                    </thead>
                    <tbody id="replenishmentTableBody">
                        <tr><td colspan="9" style="text-align: center; padding: 2rem;">Calculando estado de reposición...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- MODAL: Ajustar Stock Mínimo (Admin) -->
        <div id="modalAdjustMinStock" class="modal-backdrop">
            <div class="modal-dialog" style="max-width: 420px;">
                <div class="modal-header">
                    <h3 class="modal-title">Configurar Stock Mínimo</h3>
                    <button type="button" class="modal-close-btn" id="closeMinStockModal">&times;</button>
                </div>
                <form id="minStockForm">
                    <input type="hidden" id="adjustProductId">
                    <div class="modal-body">
                        <p style="font-size: 0.88rem; color: var(--color-text-main); margin-bottom: 1rem;" id="adjustProductDescription"></p>
                        <div class="form-group">
                            <label class="form-label">Nuevo Stock Mínimo de Alerta <span class="required">*</span></label>
                            <input type="number" id="newMinStockValue" class="form-control" min="0" required style="font-size: 1.1rem; font-weight: 700;">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" id="cancelMinStockBtn">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Guardar Cambios</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    setupReplenishmentListeners();
    await loadReplenishment();
}

/**
 * Consulta la vista v_product_stock_summary
 */
async function loadReplenishment() {
    const supabase = getSupabase();
    const tbody = document.getElementById('replenishmentTableBody');
    if (!supabase || !tbody) return;

    try {
        const { data, error } = await supabase
            .from('v_product_stock_summary')
            .select('*')
            .order('suggested_replenishment', { ascending: false });

        if (error) {
            tbody.innerHTML = `<tr><td colspan="9" style="color: var(--status-critical); text-align: center;">Error al cargar datos: ${error.message}</td></tr>`;
            return;
        }

        replenishmentData = data || [];
        updateKpis(replenishmentData);
        filterAndRenderReplenishment();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="9" style="color: var(--status-critical); text-align: center;">Error: ${err.message}</td></tr>`;
    }
}

/**
 * Actualiza los contadores de alerta
 */
function updateKpis(data) {
    let agotados = 0;
    let criticos = 0;
    let proximos = 0;
    let totalSugerido = 0;

    data.forEach(p => {
        if (p.stock_status === 'AGOTADO') agotados++;
        else if (p.stock_status === 'CRITICO') criticos++;
        else if (p.stock_status === 'PROXIMO') proximos++;

        if (p.suggested_replenishment > 0) {
            totalSugerido += Number(p.suggested_replenishment);
        }
    });

    const elAgotados = document.getElementById('kpiAgotados');
    const elCriticos = document.getElementById('kpiCriticos');
    const elProximos = document.getElementById('kpiProximos');
    const elTotalSugerido = document.getElementById('kpiTotalSugerido');

    if (elAgotados) elAgotados.textContent = agotados;
    if (elCriticos) elCriticos.textContent = criticos;
    if (elProximos) elProximos.textContent = proximos;
    if (elTotalSugerido) elTotalSugerido.textContent = totalSugerido;
}

/**
 * Filtra y renderiza la tabla de reposición
 */
function filterAndRenderReplenishment() {
    const tbody = document.getElementById('replenishmentTableBody');
    if (!tbody) return;

    const search = document.getElementById('replenishSearchInput')?.value.trim().toLowerCase() || '';
    const filterStatus = document.getElementById('replenishStatusFilter')?.value || 'REPOSICION';
    const adminMode = isAdmin();

    const filtered = replenishmentData.filter(p => {
        // Filtro por estado
        if (filterStatus === 'REPOSICION') {
            if (p.stock_status === 'NORMAL') return false;
        } else if (filterStatus !== 'TODOS') {
            if (p.stock_status !== filterStatus) return false;
        }

        // Búsqueda
        if (search) {
            const match = (p.internal_code && p.internal_code.toLowerCase().includes(search)) ||
                          (p.part_number && p.part_number.toLowerCase().includes(search)) ||
                          (p.description && p.description.toLowerCase().includes(search));
            if (!match) return false;
        }

        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9">
                    <div class="empty-state">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <h3>¡Inventario en Niveles Óptimos!</h3>
                        <p>No se registran productos que requieran reposición bajo los criterios seleccionados.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(p => `
        <tr>
            <td><span class="code-pill">${p.internal_code}</span></td>
            <td><strong>${p.part_number}</strong></td>
            <td>
                <div style="font-weight: 600;">${p.description}</div>
                ${p.brand ? `<span style="font-size: 0.75rem; color: var(--color-text-muted);">${p.brand}</span>` : ''}
            </td>
            <td>
                <span style="font-size: 1.1rem; font-weight: 800; color: ${p.available_units > 0 ? 'var(--status-available)' : 'var(--status-critical)'}">
                    ${p.available_units}
                </span> ${p.unit_of_measure}
            </td>
            <td>${p.min_stock} ${p.unit_of_measure}</td>
            <td>${getStockStatusBadge(p.stock_status)}</td>
            <td>
                ${p.suggested_replenishment > 0 ? `
                    <span style="font-weight: 800; color: var(--status-critical); font-size: 1.05rem;">
                        + ${p.suggested_replenishment} ${p.unit_of_measure}
                    </span>
                ` : `
                    <span style="color: var(--status-available); font-weight: 600;">Cubierto</span>
                `}
            </td>
            <td>${p.warehouse_location || '-'}</td>
            ${adminMode ? `
                <td style="text-align: right;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.openAdjustMinStock('${p.product_id}', '${p.description.replace(/'/g, "\\'")}', ${p.min_stock})">
                        Editar Mínimo
                    </button>
                </td>
            ` : ''}
        </tr>
    `).join('');
}

/**
 * Escuchadores de eventos para Reposición
 */
function setupReplenishmentListeners() {
    document.getElementById('replenishSearchInput')?.addEventListener('input', filterAndRenderReplenishment);
    document.getElementById('replenishStatusFilter')?.addEventListener('change', filterAndRenderReplenishment);
    document.getElementById('btnRefreshReplenishment')?.addEventListener('click', loadReplenishment);

    // Modal Ajustar Stock
    document.getElementById('closeMinStockModal')?.addEventListener('click', () => closeModal('modalAdjustMinStock'));
    document.getElementById('cancelMinStockBtn')?.addEventListener('click', () => closeModal('modalAdjustMinStock'));
    document.getElementById('minStockForm')?.addEventListener('submit', handleSaveMinStock);

    // Exportar Requisición a Excel
    document.getElementById('btnExportReplenishmentExcel')?.addEventListener('click', () => {
        if (!replenishmentData || replenishmentData.length === 0) {
            showToast('No hay datos para exportar.', 'warning');
            return;
        }

        const toExport = replenishmentData.filter(p => p.suggested_replenishment > 0).map(p => ({
            'Familia': p.internal_code,
            'Part Number': p.part_number,
            'Descripción del Repuesto': p.description,
            'Marca': p.brand || '',
            'Categoría': p.category || '',
            'Stock Disponible': p.available_units,
            'Stock Mínimo': p.min_stock,
            'Unidad de Medida': p.unit_of_measure,
            'Estado': p.stock_status,
            'Cantidad Sugerida a Reponer': p.suggested_replenishment,
            'Ubicación en Almacén': p.warehouse_location || ''
        }));

        if (toExport.length === 0) {
            showToast('No hay productos que requieran reposición actualmente.', 'info');
            return;
        }

        exportToExcel(toExport, 'Requisicion_Reposicion_INDUSTRAC', 'Reposición');
        showToast(`Se exportaron ${toExport.length} referencias para reposición.`, 'success');
    });

    window.openAdjustMinStock = (productId, description, currentMin) => {
        document.getElementById('adjustProductId').value = productId;
        document.getElementById('adjustProductDescription').textContent = `Producto: ${description}`;
        document.getElementById('newMinStockValue').value = currentMin;
        openModal('modalAdjustMinStock');
    };
}

/**
 * Guarda el nuevo stock mínimo en Supabase
 */
async function handleSaveMinStock(e) {
    e.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;

    const productId = document.getElementById('adjustProductId').value;
    const newMin = parseInt(document.getElementById('newMinStockValue').value, 10);

    if (isNaN(newMin) || newMin < 0) {
        showToast('Ingrese un valor numérico válido mayor o igual a 0.', 'warning');
        return;
    }

    showLoading('Actualizando stock mínimo...');

    try {
        const { error } = await supabase
            .from('products')
            .update({ min_stock: newMin })
            .eq('id', productId);

        hideLoading();

        if (error) {
            showToast(`Error al actualizar: ${error.message}`, 'error');
            return;
        }

        closeModal('modalAdjustMinStock');
        showToast('Stock mínimo actualizado correctamente.', 'success');
        await loadReplenishment();
    } catch (err) {
        hideLoading();
        showToast(`Error: ${err.message}`, 'error');
    }
}
