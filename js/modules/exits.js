/**
 * SISTEMA DE CONTROL DE ALMACÉN – INDUSTRAC S.A.C.
 * Módulo 4: Salidas de Almacén con Reconocimiento OCR de Stickers (Versión 1.3)
 * Soporta cámara en vivo, foto nativa de celular, consulta Supabase + local híbrida
 */

import { getSupabase } from '../config.js';
import { 
    startCameraStream, 
    stopCameraStream, 
    captureAndPreprocessFrame, 
    recognizeStickerCode,
    preprocessImageFile
} from '../ocr.js';
import { 
    showToast, 
    showLoading, 
    hideLoading, 
    openModal, 
    closeModal,
    getUnitStatusBadge
} from '../utils/ui.js';
import { getLocalProducts, getLocalUnits, saveLocalUnits, getLocalMovements, saveLocalMovements } from './products.js';

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
                        Escanee el sticker con la cámara de su celular o ingrese el código para autorizar el retiro de la unidad física.
                    </p>
                </div>
            </div>

            <!-- Botones Principales de Escaneo -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; padding: 1rem 0;">
                <!-- Opción 1: Cámara en vivo con visor -->
                <button type="button" class="btn btn-primary btn-large-action" id="btnBigScanCamera" style="background: linear-gradient(135deg, #031240 0%, #18A2D9 100%);">
                    <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    ABRIR VISOR DE CÁMARA
                </button>

                <!-- Opción 2: Tomar Foto Nítida con la Cámara Nativa del Celular -->
                <label for="nativeCameraInput" class="btn btn-accent btn-large-action" style="cursor: pointer; margin: 0; color: #031240;">
                    <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    TOMAR FOTO CON CÁMARA
                </label>
                <!-- Input de archivo con capture para invocar la cámara del smartphone con macro / flash -->
                <input type="file" id="nativeCameraInput" accept="image/*" capture="environment" style="display: none;">
            </div>

            <!-- Visor de Cámara Web en Vivo (Oculto hasta presionar el botón) -->
            <div id="cameraViewfinderContainer" style="display: none; margin-top: 1rem; border: 2.5px solid var(--color-accent); border-radius: var(--radius-lg); overflow: hidden; background: #000; position: relative;">
                <video id="ocrVideoElement" autoplay playsinline muted style="width: 100%; max-height: 440px; object-fit: cover; display: block;"></video>
                <canvas id="ocrCanvasElement" style="display: none;"></canvas>

                <!-- Marco de Enfoque Superpuesto -->
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <div style="width: 85%; height: 45%; border: 2.5px dashed var(--color-accent-light); border-radius: var(--radius-md); box-shadow: 0 0 0 9999px rgba(3, 18, 64, 0.45); display: flex; align-items: center; justify-content: center; position: relative;">
                        <span style="background: rgba(3, 18, 64, 0.85); color: #fff; padding: 0.35rem 0.85rem; border-radius: 9999px; font-size: 0.82rem; font-weight: 700; letter-spacing: 0.5px;">
                            Enfoque el código del sticker aquí
                        </span>
                    </div>
                    <p style="color: #fff; font-size: 0.8rem; margin-top: 0.75rem; text-shadow: 0 1px 3px rgba(0,0,0,0.8);">
                        Mantenga firme la cámara a 10-15 cm de distancia
                    </p>
                </div>

                <!-- Controles sobre la Cámara -->
                <div style="position: absolute; bottom: 1rem; left: 0; right: 0; display: flex; justify-content: center; gap: 0.75rem; padding: 0 1rem; z-index: 10;">
                    <button type="button" class="btn btn-secondary btn-sm" id="btnCancelCamera">
                        Cerrar Cámara
                    </button>
                    <button type="button" class="btn btn-accent" id="btnCaptureOcr" style="font-weight: 800; padding: 0.75rem 1.75rem; font-size: 1rem;">
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
                        Capturar y Leer Código
                    </button>
                </div>
            </div>

            <!-- Entrada Manual / Fallback si el sticker está dañado o no hay buena luz -->
            <div style="margin-top: 1.5rem; background: #F8FAFC; padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
                <label class="form-label">O buscar / ingresar sticker manualmente:</label>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <input type="text" id="manualExitCodeInput" class="form-control" placeholder="ej. OF-600-00001 o AF-100-00001" style="max-width: 320px; font-weight: 800; font-size: 1.05rem; text-transform: uppercase;">
                    <button type="button" class="btn btn-primary" id="btnLookupManual" style="font-weight: 700;">
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        Buscar Unidad
                    </button>
                </div>
            </div>
        </div>

        <!-- MODAL: Confirmación de Salida de Unidad (Bloqueo si ya fue retirado) -->
        <div id="exitConfirmModal" class="modal-backdrop">
            <div class="modal-dialog modal-dialog-large">
                <div class="modal-header">
                    <h3 class="modal-title">Confirmación de Salida de Repuesto</h3>
                    <button type="button" class="modal-close-btn" id="closeExitModal">&times;</button>
                </div>
                <form id="exitForm">
                    <div class="modal-body">
                        <!-- Alerta de Bloqueo si no está disponible -->
                        <div id="exitWarningBanner" style="display: none; padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.25rem; font-weight: 700; font-size: 0.95rem;"></div>

                        <!-- Tarjeta con Información del Producto Identificado -->
                        <div style="background-color: #F8FAFC; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.25rem;">
                            <div class="form-row">
                                <div class="form-group">
                                    <label class="form-label">Código Individual (Sticker) <span class="required">*</span></label>
                                    <div style="display: flex; gap: 0.5rem;">
                                        <input type="text" id="modalExitUnitCode" class="form-control" style="font-weight: 800; font-size: 1.15rem; text-transform: uppercase;" required>
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
                                <div style="font-size: 1.15rem; font-weight: 800; color: var(--color-primary-dark);" id="modalProductDescription">-</div>
                                <div style="font-size: 0.85rem; color: var(--color-text-muted); margin-top: 0.25rem;">
                                    <strong>Part Number:</strong> <span id="modalPartNumber">-</span> &nbsp;|&nbsp;
                                    <strong>Grupo / Familia:</strong> <span id="modalInternalCode">-</span> &nbsp;|&nbsp;
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
                        <button type="submit" class="btn btn-danger btn-large-action" id="btnConfirmExit" style="max-width: 280px; font-weight: 800;">
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
    const nativeCameraInput = document.getElementById('nativeCameraInput');
    const manualLookupBtn = document.getElementById('btnLookupManual');
    const manualInput = document.getElementById('manualExitCodeInput');
    const recheckBtn = document.getElementById('btnRecheckCode');
    const exitForm = document.getElementById('exitForm');
    const closeExitModalBtn = document.getElementById('closeExitModal');
    const cancelExitModalBtn = document.getElementById('cancelExitModalBtn');

    // Botón Iniciar Cámara en vivo
    bigScanBtn?.addEventListener('click', async () => {
        await activateCamera();
    });

    // Cerrar cámara
    cancelCameraBtn?.addEventListener('click', () => {
        deactivateCamera();
    });

    // Capturar frame de video y procesar OCR
    captureOcrBtn?.addEventListener('click', async () => {
        await processCameraOcr();
    });

    // Captura mediante Foto Nativa de Celular (resolución máxima)
    nativeCameraInput?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        showLoading('Procesando fotografía y reconociendo código OCR...');
        const tempCanvas = document.createElement('canvas');

        try {
            await preprocessImageFile(file, tempCanvas);
            const recognized = await recognizeStickerCode(tempCanvas);
            hideLoading();

            if (!recognized) {
                showToast('No se pudo identificar el código en la foto. Intente con mejor iluminación o ingrese el código manualmente.', 'warning', 5000);
                return;
            }

            showToast(`Sticker detectado: ${recognized}`, 'success');
            await lookupAndDisplayUnit(recognized);
        } catch (err) {
            hideLoading();
            showToast(`Error al procesar foto: ${err.message}`, 'error');
        } finally {
            nativeCameraInput.value = '';
        }
    });

    // Búsqueda Manual
    const executeManualLookup = () => {
        const code = manualInput.value.trim().toUpperCase();
        if (!code) {
            showToast('Ingrese un código de sticker para buscar.', 'warning');
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
    const modalUnitInput = document.getElementById('modalExitUnitCode');
    const triggerRecheck = () => {
        const code = modalUnitInput?.value.trim().toUpperCase();
        if (code) {
            lookupAndDisplayUnit(code);
        }
    };

    recheckBtn?.addEventListener('click', triggerRecheck);
    modalUnitInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            triggerRecheck();
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
        showLoading('Activando cámara con autoenfoque...');
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
        // Preprocesar imagen
        captureAndPreprocessFrame(video, canvas);

        // Reconocer texto
        const recognizedCode = await recognizeStickerCode(canvas);
        hideLoading();

        if (!recognizedCode) {
            showToast('No se pudo leer el código con claridad. Acerque la cámara o use el botón "TOMAR FOTO CON CÁMARA".', 'warning', 5000);
            return;
        }

        showToast(`Sticker detectado: ${recognizedCode}`, 'info');
        await lookupAndDisplayUnit(recognizedCode);
    } catch (err) {
        hideLoading();
        showToast(`Error al procesar OCR: ${err.message}`, 'error');
    }
}

/**
 * Consulta el estado de la unidad (Supabase + Respaldo Local Autónomo)
 */
async function lookupAndDisplayUnit(unitCode) {
    const cleanCode = unitCode.trim().toUpperCase();
    showLoading(`Consultando unidad ${cleanCode}...`);

    const supabase = getSupabase();

    // 1. Si Supabase está conectado, consultamos la función RPC
    if (supabase) {
        try {
            const { data, error } = await supabase.rpc('lookup_unit_for_exit', {
                p_unit_code: cleanCode
            });

            if (!error && data) {
                hideLoading();

                if (!data.found) {
                    showToast(`Código no encontrado: ${cleanCode}`, 'error', 5000);
                    displayExitModalWithWarning(
                        cleanCode, 
                        null, 
                        `CÓDIGO NO REGISTRADO: '${cleanCode}'. Si el sticker físico es diferente (ej. OF-600-00050), corríjalo abajo y pulse "Verificar".`
                    );
                    return;
                }

                currentLookedUpUnit = data;

                if (data.status === 'RETIRADO') {
                    displayExitModalWithWarning(
                        cleanCode, 
                        data, 
                        'ESTE PRODUCTO YA FUE RETIRADO. NO SE PUEDE REGISTRAR OTRA SALIDA.'
                    );
                    return;
                }

                if (!data.is_available) {
                    displayExitModalWithWarning(
                        cleanCode, 
                        data, 
                        `LA UNIDAD NO ESTÁ DISPONIBLE. (Estado actual: ${data.status})`
                    );
                    return;
                }

                displayExitModalForSuccess(data);
                return;
            }
        } catch (err) {
            console.warn('Error consultando Supabase, intentando con datos locales:', err);
        }
    }

    // 2. Consulta en almacenamiento local (modo autónomo)
    const localUnits = getLocalUnits();
    const localProds = getLocalProducts();
    const unit = localUnits.find(u => u.unit_code.toUpperCase() === cleanCode);

    hideLoading();

    if (!unit) {
        showToast(`Código no encontrado: ${cleanCode}`, 'error', 5000);
        displayExitModalWithWarning(
            cleanCode, 
            null, 
            `CÓDIGO NO REGISTRADO: '${cleanCode}'. Si el sticker físico es diferente (ej. OF-600-00050), corríjalo abajo y pulse "Verificar".`
        );
        return;
    }

    const prod = localProds.find(p => p.id === unit.product_id || p.product_id === unit.product_id) || {};

    const unitInfo = {
        unit_id: unit.id,
        unit_code: unit.unit_code,
        status: unit.status,
        product_id: unit.product_id,
        internal_code: prod.internal_code || 'SIN_GRUPO',
        part_number: prod.part_number || '-',
        name: prod.name || prod.description || 'Producto',
        description: prod.description || '-',
        category: prod.category || '-',
        warehouse_location: prod.warehouse_location || 'No asignada',
        is_available: (unit.status === 'DISPONIBLE')
    };

    currentLookedUpUnit = unitInfo;

    if (unit.status === 'RETIRADO') {
        displayExitModalWithWarning(
            cleanCode, 
            unitInfo, 
            'ESTE PRODUCTO YA FUE RETIRADO. NO SE PUEDE REGISTRAR OTRA SALIDA.'
        );
        return;
    }

    if (!unitInfo.is_available) {
        displayExitModalWithWarning(
            cleanCode, 
            unitInfo, 
            `LA UNIDAD NO ESTÁ DISPONIBLE. (Estado actual: ${unit.status})`
        );
        return;
    }

    displayExitModalForSuccess(unitInfo);
}

/**
 * Muestra el modal de salida bloqueado con advertencia
 */
function displayExitModalWithWarning(unitCode, unitData, warningMsg) {
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
    document.getElementById('modalProductDescription').textContent = unitData ? `${unitData.name || ''} ${unitData.description ? `– ${unitData.description}` : ''}`.trim() : 'Producto No Encontrado';
    document.getElementById('modalPartNumber').textContent = unitData?.part_number || '-';
    document.getElementById('modalInternalCode').textContent = unitData?.internal_code || '-';
    document.getElementById('modalWarehouseLocation').textContent = unitData?.warehouse_location || '-';

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
    document.getElementById('modalProductDescription').textContent = `${unitData.name || ''} ${unitData.description ? `– ${unitData.description}` : ''}`.trim();
    document.getElementById('modalPartNumber').textContent = unitData.part_number;
    document.getElementById('modalInternalCode').textContent = unitData.internal_code;
    document.getElementById('modalWarehouseLocation').textContent = unitData.warehouse_location || 'No asignada';

    openModal('exitConfirmModal');
}

/**
 * Ejecuta la transacción de salida (Supabase + Respaldo Local)
 */
async function handleConfirmExitSubmit(e) {
    e.preventDefault();

    const unitCode = document.getElementById('modalExitUnitCode').value.trim().toUpperCase();
    const workerName = document.getElementById('exitWorkerName').value.trim() || null;
    const clientName = document.getElementById('exitClientName').value.trim() || null;
    const equipmentModel = document.getElementById('exitEquipmentModel').value.trim() || null;
    const equipmentSerial = document.getElementById('exitEquipmentSerial').value.trim() || null;
    const reason = document.getElementById('exitReason').value.trim() || null;
    const notes = document.getElementById('exitNotes').value.trim() || null;

    showLoading(`Registrando salida de ${unitCode}...`);

    const supabase = getSupabase();

    if (supabase) {
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

            if (!error && data) {
                hideLoading();

                if (!data.success) {
                    showToast(data.error, 'error', 6000);
                    return;
                }

                closeModal('exitConfirmModal');
                showToast(`¡Salida autorizada de ${unitCode}! Estado actualizado a RETIRADO.`, 'success', 4500);
                resetExitForm();
                return;
            }
        } catch (err) {
            console.warn('Error en salida Supabase, recurriendo a local:', err);
        }
    }

    // Modo local
    const localUnits = getLocalUnits();
    const unitIdx = localUnits.findIndex(u => u.unit_code.toUpperCase() === unitCode);

    if (unitIdx === -1) {
        hideLoading();
        showToast('CÓDIGO NO REGISTRADO EN EL INVENTARIO.', 'error');
        return;
    }

    if (localUnits[unitIdx].status === 'RETIRADO') {
        hideLoading();
        showToast('ESTE PRODUCTO YA FUE RETIRADO. NO SE PUEDE REGISTRAR OTRA SALIDA.', 'error', 5000);
        return;
    }

    localUnits[unitIdx].status = 'RETIRADO';
    localUnits[unitIdx].updated_at = new Date().toISOString();
    saveLocalUnits(localUnits);

    const localMovs = getLocalMovements();
    localMovs.unshift({
        id: 'mov_' + Date.now(),
        movement_type: 'SALIDA',
        unit_code: unitCode,
        worker_name: workerName,
        client_name: clientName,
        equipment_model: equipmentModel,
        equipment_serial: equipmentSerial,
        reason: reason,
        notes: notes,
        products: {
            name: currentLookedUpUnit?.name || '',
            description: currentLookedUpUnit?.description || '',
            part_number: currentLookedUpUnit?.part_number || ''
        },
        created_at: new Date().toISOString()
    });
    saveLocalMovements(localMovs);

    hideLoading();
    closeModal('exitConfirmModal');
    showToast(`¡Salida autorizada de ${unitCode}! Estado actualizado a RETIRADO.`, 'success', 4500);
    resetExitForm();
}

function resetExitForm() {
    document.getElementById('manualExitCodeInput').value = '';
    document.getElementById('exitWorkerName').value = '';
    document.getElementById('exitClientName').value = '';
    document.getElementById('exitEquipmentModel').value = '';
    document.getElementById('exitEquipmentSerial').value = '';
    document.getElementById('exitReason').value = '';
    document.getElementById('exitNotes').value = '';

    if (isCameraActive) {
        showToast('Puede enfocar el siguiente sticker...', 'info', 2500);
    }
}
