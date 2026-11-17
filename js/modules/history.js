/**
 * SISTEMA DE CONTROL DE ALMACÉN – INDUSTRAC S.A.C.
 * Módulo 6: Historial Cronológico de Movimientos y Auditoría Inmutable
 */

import { getSupabase } from '../config.js';
import { showToast, formatDateTime } from '../utils/ui.js';
import { exportToExcel } from '../utils/excel.js';

let movementsData = [];

/**
 * Renderiza la interfaz de Historial
 */
export async function renderHistoryView(container) {
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <div>
                    <h2 class="card-title">
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        Historial Cronológico de Movimientos
                    </h2>
                    <p style="font-size: 0.85rem; color: var(--color-text-muted);">
                        Registro inmutable de trazabilidad: Ingresos, Salidas y Devoluciones de cada unidad individual.
                    </p>
                </div>
                <div>
                    <button type="button" class="btn btn-secondary" id="btnExportHistoryExcel">
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        Exportar a Excel
                    </button>
                </div>
            </div>

            <!-- Filtros Avanzados -->
            <div class="filter-toolbar" style="background: #F8FAFC; padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--color-border); margin-bottom: 1.25rem;">
                <div class="search-input-group" style="max-width: 320px;">
                    <svg class="search-icon" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    <input type="text" id="historySearchInput" class="form-control" placeholder="Buscar código, repuesto, P/N, trabajador...">
                </div>

                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
                    <select id="filterMovementType" class="form-control" style="width: auto;">
                        <option value="">Todos los Movimientos</option>
                        <option value="INGRESO">Solo INGRESOS</option>
                        <option value="SALIDA">Solo SALIDAS</option>
                        <option value="DEVOLUCION">Solo DEVOLUCIONES</option>
                    </select>

                    <div style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; color: var(--color-text-muted);">
                        <span>Desde:</span>
                        <input type="date" id="filterDateFrom" class="form-control" style="width: auto; padding: 0.45rem 0.65rem;">
                        <span>Hasta:</span>
                        <input type="date" id="filterDateTo" class="form-control" style="width: auto; padding: 0.45rem 0.65rem;">
                    </div>

                    <button type="button" class="btn btn-secondary btn-sm" id="btnResetHistoryFilters" title="Limpiar Filtros">
                        Limpiar
                    </button>
                    <button type="button" class="btn btn-secondary btn-sm" id="btnRefreshHistory" title="Actualizar">
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                    </button>
                </div>
            </div>

            <!-- Tabla de Historial -->
            <div class="table-responsive">
                <table class="custom-table" id="historyTable">
                    <thead>
                        <tr>
                            <th>Fecha y Hora</th>
                            <th>Tipo</th>
                            <th>Código (Sticker)</th>
                            <th>Descripción</th>
                            <th>Part Number</th>
                            <th>Trabajador</th>
                            <th>Cliente / Destino</th>
                            <th>Equipo / Serie</th>
                            <th>Registrado Por</th>
                            <th>Observaciones</th>
                        </tr>
                    </thead>
                    <tbody id="historyTableBody">
                        <tr><td colspan="10" style="text-align: center; padding: 2rem;">Cargando movimientos...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    setupHistoryListeners();
    await loadHistory();
}

/**
 * Consulta la tabla inventory_movements unida con products
 */
async function loadHistory() {
    const supabase = getSupabase();
    const tbody = document.getElementById('historyTableBody');
    if (!supabase || !tbody) return;

    try {
        const { data, error } = await supabase
            .from('inventory_movements')
            .select(`
                id,
                created_at,
                movement_type,
                unit_code,
                worker_name,
                client_name,
                equipment_model,
                equipment_serial,
                reason,
                supplier,
                document_reference,
                notes,
                user_email,
                products (
                    internal_code,
                    part_number,
                    name,
                    description,
                    category
                )
            `)
            .order('created_at', { ascending: false })
            .limit(300);

        if (error) {
            tbody.innerHTML = `<tr><td colspan="10" style="color: var(--status-critical); text-align: center; padding: 2rem;">Error al cargar historial: ${error.message}</td></tr>`;
            return;
        }

        movementsData = data || [];
        filterAndRenderHistory();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="10" style="color: var(--status-critical); text-align: center; padding: 2rem;">Error: ${err.message}</td></tr>`;
    }
}

/**
 * Filtra y renderiza los registros en pantalla
 */
function filterAndRenderHistory() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    const search = document.getElementById('historySearchInput')?.value.trim().toLowerCase() || '';
    const typeFilter = document.getElementById('filterMovementType')?.value || '';
    const dateFrom = document.getElementById('filterDateFrom')?.value || '';
    const dateTo = document.getElementById('filterDateTo')?.value || '';

    const filtered = movementsData.filter(m => {
        // Filtro por tipo
        if (typeFilter && m.movement_type !== typeFilter) return false;

        // Filtro por fecha desde / hasta
        if (dateFrom) {
            const mDate = m.created_at.slice(0, 10);
            if (mDate < dateFrom) return false;
        }
        if (dateTo) {
            const mDate = m.created_at.slice(0, 10);
            if (mDate > dateTo) return false;
        }

        // Filtro por búsqueda
        if (search) {
            const prod = m.products || {};
            const textToMatch = [
                m.unit_code,
                prod.description,
                prod.part_number,
                prod.internal_code,
                m.worker_name,
                m.client_name,
                m.equipment_model,
                m.reason,
                m.notes,
                m.user_email
            ].filter(Boolean).join(' ').toLowerCase();

            if (!textToMatch.includes(search)) return false;
        }

        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10">
                    <div class="empty-state">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                        <h3>No hay movimientos para mostrar</h3>
                        <p>No se encontraron registros con los filtros seleccionados.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(m => {
        const prod = m.products || {};
        let typeBadge = '';
        if (m.movement_type === 'INGRESO') {
            typeBadge = `<span class="badge badge-ingreso">INGRESO</span>`;
        } else if (m.movement_type === 'SALIDA') {
            typeBadge = `<span class="badge badge-salida">SALIDA</span>`;
        } else if (m.movement_type === 'DEVOLUCION') {
            typeBadge = `<span class="badge badge-devolucion">DEVOLUCIÓN</span>`;
        }

        return `
            <tr>
                <td style="white-space: nowrap; font-size: 0.82rem;">${formatDateTime(m.created_at)}</td>
                <td>${typeBadge}</td>
                <td><strong class="code-pill">${m.unit_code}</strong></td>
                <td>
                    <div style="font-weight: 600;">${prod.name || prod.description || '-'}</div>
                    <span style="font-size: 0.75rem; color: var(--color-text-muted);">${prod.internal_code || ''} ${prod.name && prod.description ? `• ${prod.description}` : ''}</span>
                </td>
                <td><strong>${prod.part_number || '-'}</strong></td>
                <td>${m.worker_name ? `<strong>${m.worker_name}</strong>` : '<span style="color: var(--color-text-muted);">-</span>'}</td>
                <td>${m.client_name || '-'}</td>
                <td>${m.equipment_model ? `${m.equipment_model} ${m.equipment_serial ? `(${m.equipment_serial})` : ''}` : '-'}</td>
                <td style="font-size: 0.78rem; color: var(--color-text-muted);">${m.user_email ? m.user_email.split('@')[0] : '-'}</td>
                <td style="font-size: 0.8rem; max-width: 200px; word-break: break-word;">${m.notes || m.reason || m.document_reference || '-'}</td>
            </tr>
        `;
    }).join('');
}

/**
 * Configura los eventos de la vista de historial
 */
function setupHistoryListeners() {
    document.getElementById('historySearchInput')?.addEventListener('input', filterAndRenderHistory);
    document.getElementById('filterMovementType')?.addEventListener('change', filterAndRenderHistory);
    document.getElementById('filterDateFrom')?.addEventListener('change', filterAndRenderHistory);
    document.getElementById('filterDateTo')?.addEventListener('change', filterAndRenderHistory);

    document.getElementById('btnResetHistoryFilters')?.addEventListener('click', () => {
        document.getElementById('historySearchInput').value = '';
        document.getElementById('filterMovementType').value = '';
        document.getElementById('filterDateFrom').value = '';
        document.getElementById('filterDateTo').value = '';
        filterAndRenderHistory();
    });

    document.getElementById('btnRefreshHistory')?.addEventListener('click', loadHistory);

    // Exportar a Excel
    document.getElementById('btnExportHistoryExcel')?.addEventListener('click', () => {
        if (!movementsData || movementsData.length === 0) {
            showToast('No hay datos en el historial para exportar.', 'warning');
            return;
        }

        const exportRows = movementsData.map(m => ({
            'Fecha y Hora': formatDateTime(m.created_at),
            'Tipo de Movimiento': m.movement_type,
            'Código Individual (Sticker)': m.unit_code,
            'Descripción del Repuesto': m.products?.description || '',
            'Part Number': m.products?.part_number || '',
            'Familia': m.products?.internal_code || '',
            'Trabajador': m.worker_name || '',
            'Cliente': m.client_name || '',
            'Equipo / Modelo': m.equipment_model || '',
            'Nro Serie': m.equipment_serial || '',
            'Motivo': m.reason || '',
            'Proveedor / Procedencia': m.supplier || '',
            'Nro Guía / Doc': m.document_reference || '',
            'Observaciones': m.notes || '',
            'Usuario Sistema': m.user_email || ''
        }));

        exportToExcel(exportRows, 'Historial_Movimientos_Almacen_INDUSTRAC', 'Movimientos');
        showToast('Exportación de historial completada.', 'success');
    });
}

