/**
 * SISTEMA DE CONTROL DE ALMACÉN – INDUSTRAC S.A.C.
 * Módulo 4: Salidas de Almacén con Reconocimiento OCR de Stickers
 */

import { getSupabase } from '../config.js';
import { 
    startCameraStream, 
    stopCameraStream, 
    captureAndPreprocessFrame, 
    recognizeStickerCode 
} from '../ocr.js';
import { 
    showToast, 
    showLoading, 
    hideLoading, 
    openModal, 
    closeModal,
    getUnitStatusBadge
} from '../utils/ui.js';

let isCameraActive = false;
let currentLookedUpUnit = null;

/**
 * Renderiza la interfaz de Salidas
 */
export async function renderExitsView(container) {
    container.innerHTML = `
        <div class="card" style="margin-bottom: 1.25rem;">
            <div class="card-header">
                <div>
                    <h2 class="card-title">
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                        Control de Salidas de Almacén
                    </h2>
                    <p style="font-size: 0.85rem; color: var(--color-text-muted);">
                        Escanee el sticker con la cámara del celular o ingrese el código manualmente para autorizar la salida de la unidad.
                    </p>
                </div>
            </div>

            <!-- Botón Gigante de Activación de Cámara OCR -->
            <div style="padding: 1rem 0;">
                <button type="button" class="btn btn-primary btn-large-action" id="btnBigScanCamera" style="background: linear-gradient(135deg, #031240 0%, #18A2D9 100%);">
                    <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    ESCANEAR PRODUCTO CON CÁMARA (OCR)
                </button>
            </div>

            <!-- Visor de Cámara y Enfoque de OCR (Oculto hasta presionar el botón) -->
            <div id="cameraViewfinderContainer" style="display: none; margin-top: 1rem; border: 2px solid var(--color-accent); border-radius: var(--radius-lg); overflow: hidden; background: #000; position: relative;">
                <!-- Video en vivo -->
                <video id="ocrVideoElement" autoplay playsinline muted style="width: 100%; max-height: 440px; object-fit: cover; display: block;"></video>
                
                <!-- Canvas oculto para procesamiento de imagen -->
                <canvas id="ocrCanvasElement" style="display: none;"></canvas>

                <!-- Marco de Enfoque Superpuesto (Guía para el sticker) -->
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <div style="width: 82%; height: 35%; border: 2.5px dashed var(--color-accent-light); border-radius: var(--radius-md); box-shadow: 0 0 0 9999px rgba(3, 18, 64, 0.45); display: flex; align-items: center; justify-content: center; position: relative;">
                        <span style="background: rgba(3, 18, 64, 0.85); color: #fff; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.78rem; font-weight: 600; letter-spacing: 0.5px;">
                            Enfoque el sticker aquí
                        </span>
                    </div>
                    <p style="color: #fff; font-size: 0.8rem; margin-top: 1rem; text-shadow: 0 1px 3px rgba(0,0,0,0.8);">
                        Mantenga firme la cámara sobre el texto del código
                    </p>
                </div>

                <!-- Barra de Controles sobre la Cámara -->
                <div style="position: absolute; bottom: 1rem; left: 0; right: 0; display: flex; justify-content: center; gap: 0.75rem; padding: 0 1rem; z-index: 10;">
                    <button type="button" class="btn btn-secondary btn-sm" id="btnCancelCamera">
                        Cerrar Cámara
                    </button>
                    <button type="button" class="btn btn-accent" id="btnCaptureOcr" style="font-weight: 700; padding: 0.75rem 1.5rem;">
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
                        Capturar y Leer Sticker
                    </button>
                </div>
            </div>

            <!-- Entrada Manual / Fallback si falla OCR -->
            <div style="margin-top: 1.5rem; background: #F8FAFC; padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
                <label class="form-label">O buscar / ingresar código manualmente:</label>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <input type="text" id="manualExitCodeInput" class="form-control" placeholder="ej. AF-100-00001" style="max-width: 320px; font-weight: 700; text-transform: uppercase;">
                    <button type="button" class="btn btn-primary" id="btnLookupManual">
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        Buscar Unidad
                    </button>
                </div>
            </div>
        </div>

        <!-- MODAL: Confirmación de Salida de Unidad (Bloqueo si no está disponible) -->
        <div id="exitConfirmModal" class="modal-backdrop">
            <div class="modal-dialog modal-dialog-large">
                <div class="modal-header">
                    <h3 class="modal-title">Confirmación de Salida de Repuesto</h3>
                    <button type="button" class="modal-close-btn" id="closeExitModal">&times;</button>
                </div>
                <form id="exitForm">
                    <div class="modal-body">
                        <!-- Alerta de Bloqueo si no está disponible -->
                        <div id="exitWarningBanner" style="display: none; padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.25rem; font-weight: 600; font-size: 0.95rem;"></div>

                        <!-- Tarjeta con Información del Producto Escaneado -->
                        <div style="background-color: #F8FAFC; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.25rem;">
                            <div class="form-row">
                                <div class="form-group">
                                    <label class="form-label">Código Individual (Sticker) <span class="required">*</span></label>
                                    <div style="display: flex; gap: 0.5rem;">
                                        <input type="text" id="modalExitUnitCode" class="form-control" style="font-weight: 700; font-size: 1.1rem; text-transform: uppercase;" required>
                                        <button type="button" class="btn btn-secondary btn-sm" id="btnRecheckCode" title="Reconsultar código editado">Verificar</button>
                                    </div>
                                    <span style="font-size: 0.75rem; color: var(--color-text-muted);">Puede corregir el código si el OCR tuvo alguna imprecisión.</span>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Estado Actual en Almacén</label>
                                    <div id="modalUnitStatusBadge" style="padding-top: 0.35rem;">-</div>
                                </div>
                            </div>

                            <div style="margin-top: 0.5rem; padding-top: 0.75rem; border-top: 1px solid var(--color-border);">
                                <div style="font-size: 1.05rem; font-weight: 700; color: var(--color-primary-dark);" id="modalProductDescription">-</div>
                                <div style="font-size: 0.85rem; color: var(--color-text-muted); margin-top: 0.2rem;">
                                    <strong>Part Number:</strong> <span id="modalPartNumber">-</span> &nbsp;|&nbsp;
                                    <strong>Familia:</strong> <span id="modalInternalCode">-</span> &nbsp;|&nbsp;
                                    <strong>Ubicación:</strong> <span id="modalWarehouseLocation">-</span>
                                </div>
                            </div>
                        </div>

                        <!-- Campos Opcionales de Salida -->
                        <div id="exitFieldsSection">
                            <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--color-primary-dark); margin-bottom: 0.75rem;">
                                Datos de la Salida <span class="optional">(Opcionales)</span>:
                            </h4>
                            <div class="form-row">
                                <div class="form-group">
                                    <label class="form-label">Trabajador que Retira <span class="optional">(Opcional)</span></label>
                                    <input type="text" id="exitWorkerName" class="form-control" placeholder="ej. Juan Pérez (Técnico)">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Cliente / Destino <span class="optional">(Opcional)</span></label>
                                    <input type="text" id="exitClientName" class="form-control" placeholder="ej. Minera Las Bambas">
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label class="form-label">Equipo o Modelo <span class="optional">(Opcional)</span></label>
                                    <input type="text" id="exitEquipmentModel" class="form-control" placeholder="ej. Compresor GA-75">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">N° de Serie del Equipo <span class="optional">(Opcional)</span></label>
                                    <input type="text" id="exitEquipmentSerial" class="form-control" placeholder="ej. SN-89210-C">
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label class="form-label">Motivo de Salida <span class="optional">(Opcional)</span></label>
                                    <input type="text" id="exitReason" class="form-control" placeholder="ej. Mantenimiento Preventivo 2000 hrs">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Observaciones <span class="optional">(Opcional)</span></label>
                                    <input type="text" id="exitNotes" class="form-control" placeholder="ej. Entregado con empaque sellado">
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" id="cancelExitModalBtn">Cancelar</button>
                        <button type="submit" class="btn btn-danger btn-large-action" id="btnConfirmExit" style="max-width: 280px;">
                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                            Confirmar Salida
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    setupExitListeners();
}

/**
 * Configura los eventos del módulo de Salidas
 */
function setupExitListeners() {
    const bigScanBtn = document.getElementById('btnBigScanCamera');
    const cancelCameraBtn = document.getElementById('btnCancelCamera');
    const captureOcrBtn = document.getElementById('btnCaptureOcr');
    const manualLookupBtn = document.getElementById('btnLookupManual');
    const manualInput = document.getElementById('manualExitCodeInput');
    const recheckBtn = document.getElementById('btnRecheckCode');
    const exitForm = document.getElementById('exitForm');
    const closeExitModalBtn = document.getElementById('closeExitModal');
    const cancelExitModalBtn = document.getElementById('cancelExitModalBtn');

    // Botón Iniciar Cámara
    bigScanBtn?.addEventListener('click', async () => {
        await activateCamera();
    });

    // Cerrar cámara
    cancelCameraBtn?.addEventListener('click', () => {
        deactivateCamera();
    });

    // Capturar frame y procesar OCR
    captureOcrBtn?.addEventListener('click', async () => {
        await processCameraOcr();
    });

    // Búsqueda Manual
    const executeManualLookup = () => {
        const code = manualInput.value.trim().toUpperCase();
        if (!code) {
            showToast('Ingrese un código de sticker.', 'warning');
            return;
        }
        lookupAndDisplayUnit(code);
    };

    manualLookupBtn?.addEventListener('click', executeManualLookup);
    manualInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            executeManualLookup();
        }
    });

    // Re-verificar código editado en modal
    recheckBtn?.addEventListener('click', () => {
        const code = document.getElementById('modalExitUnitCode').value.trim().toUpperCase();
        if (code) {
            lookupAndDisplayUnit(code);
        }
    });

    // Cerrar Modal
    closeExitModalBtn?.addEventListener('click', () => closeModal('exitConfirmModal'));
    cancelExitModalBtn?.addEventListener('click', () => closeModal('exitConfirmModal'));

    // Enviar confirmación de salida
    exitForm?.addEventListener('submit', handleConfirmExitSubmit);
}

/**
 * Activa la transmisión de cámara
 */
async function activateCamera() {
    const video = document.getElementById('ocrVideoElement');
    const container = document.getElementById('cameraViewfinderContainer');
    if (!video || !container) return;

    try {
        container.style.display = 'block';
        video.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showLoading('Activando cámara trasera...');
        await startCameraStream(video);
        hideLoading();
        isCameraActive = true;
    } catch (err) {
        hideLoading();
        container.style.display = 'none';
        showToast(err.message, 'error', 5000);
    }
}

/**
 * Detiene la cámara
 */
function deactivateCamera() {
    stopCameraStream();
    const container = document.getElementById('cameraViewfinderContainer');
    if (container) container.style.display = 'none';
    isCameraActive = false;
}

/**
 * Captura y ejecuta el OCR sobre el frame de video
 */
async function processCameraOcr() {
    const video = document.getElementById('ocrVideoElement');
    const canvas = document.getElementById('ocrCanvasElement');
    if (!video || !canvas) return;

    showLoading('Leyendo código del sticker mediante OCR...');

    try {
        // Preprocesar imagen (Grayscale + Alto Contraste)
        captureAndPreprocessFrame(video, canvas);

        // Reconocer texto
        const recognizedCode = await recognizeStickerCode(canvas);
        hideLoading();

        if (!recognizedCode) {
            showToast('No se pudo identificar un código claro. Enfoque nuevamente o ingrese el código manualmente.', 'warning', 4000);
            return;
        }

        showToast(`Sticker detectado: ${recognizedCode}`, 'info');
        // Consultar en base de datos
        await lookupAndDisplayUnit(recognizedCode);
    } catch (err) {
        hideLoading();
        showToast(`Error al procesar OCR: ${err.message}`, 'error');
    }
}

/**
 * Consulta el estado de la unidad en Supabase mediante la función RPC lookup_unit_for_exit
 */
async function lookupAndDisplayUnit(unitCode) {
    const supabase = getSupabase();
    if (!supabase) {
        showToast('Supabase no está conectado.', 'error');
        return;
    }

    showLoading(`Consultando unidad ${unitCode}...`);

    try {
        const { data, error } = await supabase.rpc('lookup_unit_for_exit', {
            p_unit_code: unitCode
        });

        hideLoading();

        if (error) {
            showToast(`Error de consulta: ${error.message}`, 'error');
            return;
        }

        // Caso: Código no existe
        if (!data || !data.found) {
            showToast('CÓDIGO NO REGISTRADO EN EL INVENTARIO.', 'error', 5000);
            displayExitModalWithWarning(unitCode, null, 'CÓDIGO NO REGISTRADO EN EL INVENTARIO.');
            return;
        }

        currentLookedUpUnit = data;

        // Caso: Ya está retirado
        if (data.status === 'RETIRADO') {
            displayExitModalWithWarning(
                unitCode, 
                data, 
                'ESTE PRODUCTO YA FUE RETIRADO. NO SE PUEDE REGISTRAR OTRA SALIDA.'
            );
            return;
        }

        // Caso: No disponible por otra razón
        if (!data.is_available) {
            displayExitModalWithWarning(
                unitCode, 
                data, 
                `LA UNIDAD NO ESTÁ DISPONIBLE. (Estado actual: ${data.status})`
            );
            return;
        }

        // Caso: ÉXITO - Unidad Disponible para Salida
        displayExitModalForSuccess(data);

    } catch (err) {
        hideLoading();
        showToast(`Error inesperado: ${err.message}`, 'error');
    }
}

/**
 * Muestra el modal de salida bloqueado con advertencia
 */
function displayExitModalWithWarning(unitCode, unitData, warningMsg) {
    const modal = document.getElementById('exitConfirmModal');
    const warningEl = document.getElementById('exitWarningBanner');
    const confirmBtn = document.getElementById('btnConfirmExit');
    const fieldsSection = document.getElementById('exitFieldsSection');

    warningEl.style.display = 'block';
    warningEl.style.backgroundColor = '#FEF2F2';
    warningEl.style.color = '#991B1B';
    warningEl.style.border = '1.5px solid #FECACA';
    warningEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
            <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            <span>${warningMsg}</span>
        </div>
    `;

    document.getElementById('modalExitUnitCode').value = unitCode;
    document.getElementById('modalUnitStatusBadge').innerHTML = unitData ? getUnitStatusBadge(unitData.status) : '<span class="badge badge-critico">NO EXISTE</span>';
    document.getElementById('modalProductDescription').textContent = unitData?.description || 'Producto No Encontrado';
    document.getElementById('modalPartNumber').textContent = unitData?.part_number || '-';
    document.getElementById('modalInternalCode').textContent = unitData?.internal_code || '-';
    document.getElementById('modalWarehouseLocation').textContent = unitData?.warehouse_location || '-';

    // Deshabilitar campos y botón de confirmación
    confirmBtn.disabled = true;
    confirmBtn.style.opacity = '0.5';
    fieldsSection.style.opacity = '0.5';
    fieldsSection.style.pointerEvents = 'none';

    openModal('exitConfirmModal');
}

/**
 * Muestra el modal habilitado para confirmar la salida
 */
function displayExitModalForSuccess(unitData) {
    const warningEl = document.getElementById('exitWarningBanner');
    const confirmBtn = document.getElementById('btnConfirmExit');
    const fieldsSection = document.getElementById('exitFieldsSection');

    warningEl.style.display = 'none';
    confirmBtn.disabled = false;
    confirmBtn.style.opacity = '1';
    fieldsSection.style.opacity = '1';
    fieldsSection.style.pointerEvents = 'auto';

    document.getElementById('modalExitUnitCode').value = unitData.unit_code;
    document.getElementById('modalUnitStatusBadge').innerHTML = getUnitStatusBadge(unitData.status);
    document.getElementById('modalProductDescription').textContent = unitData.description;
    document.getElementById('modalPartNumber').textContent = unitData.part_number;
    document.getElementById('modalInternalCode').textContent = unitData.internal_code;
    document.getElementById('modalWarehouseLocation').textContent = unitData.warehouse_location || 'No asignada';

    openModal('exitConfirmModal');
}

/**
 * Ejecuta la transacción atómica de salida en Supabase
 */
async function handleConfirmExitSubmit(e) {
    e.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;

    const unitCode = document.getElementById('modalExitUnitCode').value.trim().toUpperCase();
    const workerName = document.getElementById('exitWorkerName').value.trim() || null;
    const clientName = document.getElementById('exitClientName').value.trim() || null;
    const equipmentModel = document.getElementById('exitEquipmentModel').value.trim() || null;
    const equipmentSerial = document.getElementById('exitEquipmentSerial').value.trim() || null;
    const reason = document.getElementById('exitReason').value.trim() || null;
    const notes = document.getElementById('exitNotes').value.trim() || null;

    showLoading(`Registrando salida de ${unitCode}...`);

    try {
        const { data, error } = await supabase.rpc('register_unit_exit', {
            p_unit_code: unitCode,
            p_worker_name: workerName,
            p_client_name: clientName,
            p_equipment_model: equipmentModel,
            p_equipment_serial: equipmentSerial,
            p_reason: reason,
            p_notes: notes
        });

        hideLoading();

        if (error) {
            showToast(`Error al registrar salida: ${error.message}`, 'error', 5000);
            return;
        }

        if (!data.success) {
            showToast(data.error, 'error', 6000);
            return;
        }

        // Salida exitosa
        closeModal('exitConfirmModal');
        showToast(`¡Salida autorizada de ${unitCode}! Estado actualizado a RETIRADO.`, 'success', 4500);

        // Limpiar formulario
        document.getElementById('manualExitCodeInput').value = '';
        document.getElementById('exitWorkerName').value = '';
        document.getElementById('exitClientName').value = '';
        document.getElementById('exitEquipmentModel').value = '';
        document.getElementById('exitEquipmentSerial').value = '';
        document.getElementById('exitReason').value = '';
        document.getElementById('exitNotes').value = '';

        // Si la cámara sigue activa, el usuario puede continuar escaneando el siguiente sticker sin reabrir
        if (isCameraActive) {
            showToast('Puede enfocar el siguiente sticker...', 'info', 2500);
        }

    } catch (err) {
        hideLoading();
        showToast(`Error inesperado: ${err.message}`, 'error');
    }
}
