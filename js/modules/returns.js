/**
 * SISTEMA DE CONTROL DE ALMACÉN – INDUSTRAC S.A.C.
 * Módulo 5: Registro de Devoluciones de Repuestos al Almacén
 */

import { getSupabase } from '../config.js';
import { 
    showToast, 
    showLoading, 
    hideLoading, 
    openModal, 
    closeModal,
    getUnitStatusBadge,
    formatDateTime
} from '../utils/ui.js';

let currentUnitForReturn = null;

/**
 * Renderiza la interfaz de Devoluciones
 */
export async function renderReturnsView(container) {
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <div>
                    <h2 class="card-title">
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                        Registro de Devoluciones al Almacén
                    </h2>
                    <p style="font-size: 0.85rem; color: var(--color-text-muted);">
                        Reintegre al inventario físico repuestos que fueron previamente retirados. Su estado volverá a ser DISPONIBLE conservando toda la trazabilidad anterior.
                    </p>
                </div>
            </div>

            <!-- Búsqueda de Unidad Retirada -->
            <div style="background: #F8FAFC; padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--color-border); margin-bottom: 1.5rem;">
                <label class="form-label">Buscar código de sticker para devolución <span class="required">*</span></label>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <input type="text" id="returnUnitCodeInput" class="form-control" placeholder="ej. AF-100-00001" style="max-width: 320px; font-weight: 700; text-transform: uppercase;">
                    <button type="button" class="btn btn-primary" id="btnSearchReturnUnit">
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        Buscar Unidad
                    </button>
                </div>
            </div>

            <!-- Panel de Información de la Unidad y Formulario de Devolución -->
            <div id="returnDetailsCard" style="display: none; background: white; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 1.5rem;">
                <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--color-primary-dark); margin-bottom: 1rem; border-bottom: 1px solid var(--color-border); padding-bottom: 0.5rem;">
                    Información de la Unidad Identificada
                </h3>

                <div class="form-row" style="margin-bottom: 1rem;">
                    <div>
                        <span style="font-size: 0.8rem; color: var(--color-text-muted);">Código de Sticker:</span>
                        <div id="lblReturnCode" style="font-size: 1.15rem; font-weight: 800; color: var(--color-primary-dark);"></div>
                    </div>
                    <div>
                        <span style="font-size: 0.8rem; color: var(--color-text-muted);">Estado Actual:</span>
                        <div id="lblReturnStatus" style="margin-top: 0.2rem;"></div>
                    </div>
                    <div>
                        <span style="font-size: 0.8rem; color: var(--color-text-muted);">Part Number:</span>
                        <div id="lblReturnPartNumber" style="font-weight: 700;"></div>
                    </div>
                </div>

                <div style="background: #F8FAFC; padding: 1rem; border-radius: var(--radius-sm); margin-bottom: 1.25rem;">
                    <div style="font-size: 0.95rem; font-weight: 700; color: var(--color-primary-dark);" id="lblReturnDescription"></div>
                    <div style="font-size: 0.82rem; color: var(--color-text-muted); margin-top: 0.25rem;">
                        Familia: <span id="lblReturnInternalCode"></span> &nbsp;|&nbsp; 
                        Ubicación: <span id="lblReturnLocation"></span>
                    </div>
                </div>

                <!-- Formulario de Devolución -->
                <form id="returnForm">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Trabajador que Entrega / Devuelve <span class="optional">(Opcional)</span></label>
                            <input type="text" id="returnWorkerName" class="form-control" placeholder="ej. Carlos Mendoza">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Motivo de la Devolución <span class="optional">(Opcional)</span></label>
                            <input type="text" id="returnReason" class="form-control" placeholder="ej. Sobrante de mantenimiento / No utilizado">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Observaciones del Estado Físico <span class="optional">(Opcional)</span></label>
                        <input type="text" id="returnNotes" class="form-control" placeholder="ej. Empaque intacto, repuesto nuevo sin usar">
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
                        <button type="button" class="btn btn-secondary" id="btnCancelReturn">Cancelar</button>
                        <button type="submit" class="btn btn-success btn-large-action" id="btnConfirmReturn" style="max-width: 320px;">
                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                            Confirmar Devolución al Almacén
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    setupReturnListeners();
}

/**
 * Escuchadores de eventos para Devoluciones
 */
function setupReturnListeners() {
    const searchBtn = document.getElementById('btnSearchReturnUnit');
    const input = document.getElementById('returnUnitCodeInput');
    const form = document.getElementById('returnForm');
    const cancelBtn = document.getElementById('btnCancelReturn');

    const executeSearch = () => {
        const code = input.value.trim().toUpperCase();
        if (!code) {
            showToast('Ingrese un código de sticker para buscar.', 'warning');
            return;
        }
        lookupUnitForReturn(code);
    };

    searchBtn?.addEventListener('click', executeSearch);
    input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            executeSearch();
        }
    });

    cancelBtn?.addEventListener('click', () => {
        document.getElementById('returnDetailsCard').style.display = 'none';
        document.getElementById('returnUnitCodeInput').value = '';
    });

    form?.addEventListener('submit', handleReturnSubmit);
}

/**
 * Busca y valida la unidad para devolución
 */
async function lookupUnitForReturn(unitCode) {
    const supabase = getSupabase();
    if (!supabase) return;

    showLoading(`Buscando unidad ${unitCode}...`);

    try {
        const { data, error } = await supabase.rpc('lookup_unit_for_exit', {
            p_unit_code: unitCode
        });

        hideLoading();

        if (error) {
            showToast(`Error al consultar: ${error.message}`, 'error');
            return;
        }

        if (!data || !data.found) {
            showToast('CÓDIGO NO REGISTRADO EN EL INVENTARIO.', 'error', 4500);
            document.getElementById('returnDetailsCard').style.display = 'none';
            return;
        }

        currentUnitForReturn = data;
        const detailsCard = document.getElementById('returnDetailsCard');
        const confirmBtn = document.getElementById('btnConfirmReturn');

        document.getElementById('lblReturnCode').textContent = data.unit_code;
        document.getElementById('lblReturnStatus').innerHTML = getUnitStatusBadge(data.status);
        document.getElementById('lblReturnPartNumber').textContent = data.part_number;
        document.getElementById('lblReturnDescription').textContent = data.description;
        document.getElementById('lblReturnInternalCode').textContent = data.internal_code;
        document.getElementById('lblReturnLocation').textContent = data.warehouse_location || 'No asignada';

        // Solo se puede devolver si actualmente está RETIRADO
        if (data.status !== 'RETIRADO') {
            showToast(`LA UNIDAD NO ESTÁ RETIRADA. Actualmente se encuentra como: ${data.status}`, 'warning', 5000);
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = '0.5';
        } else {
            confirmBtn.disabled = false;
            confirmBtn.style.opacity = '1';
        }

        detailsCard.style.display = 'block';
        detailsCard.scrollIntoView({ behavior: 'smooth' });

    } catch (err) {
        hideLoading();
        showToast(`Error inesperado: ${err.message}`, 'error');
    }
}

/**
 * Confirma la devolución de la unidad mediante la función atómica RPC
 */
async function handleReturnSubmit(e) {
    e.preventDefault();
    if (!currentUnitForReturn) return;

    const supabase = getSupabase();
    if (!supabase) return;

    const unitCode = currentUnitForReturn.unit_code;
    const workerName = document.getElementById('returnWorkerName').value.trim() || null;
    const reason = document.getElementById('returnReason').value.trim() || null;
    const notes = document.getElementById('returnNotes').value.trim() || null;

    showLoading(`Registrando devolución de ${unitCode}...`);

    try {
        const { data, error } = await supabase.rpc('register_unit_return', {
            p_unit_code: unitCode,
            p_worker_name: workerName,
            p_reason: reason,
            p_notes: notes
        });

        hideLoading();

        if (error) {
            showToast(`Error al procesar devolución: ${error.message}`, 'error');
            return;
        }

        if (!data.success) {
            showToast(data.error, 'error');
            return;
        }

        showToast(`¡Devolución registrada con éxito! La unidad ${unitCode} vuelve a estar DISPONIBLE.`, 'success', 5000);

        // Limpiar
        document.getElementById('returnDetailsCard').style.display = 'none';
        document.getElementById('returnUnitCodeInput').value = '';
        document.getElementById('returnWorkerName').value = '';
        document.getElementById('returnReason').value = '';
        document.getElementById('returnNotes').value = '';
        currentUnitForReturn = null;

    } catch (err) {
        hideLoading();
        showToast(`Error: ${err.message}`, 'error');
    }
}
