/**
 * SISTEMA DE CONTROL DE ALMACÉN – INDUSTRAC S.A.C.
 * Módulo 3: Registro de Ingresos de Unidades Individuales (Versión 1.2)
 * Carga automática de ficha, cálculo de correlativos y guardado directo
 */

import { getSupabase } from '../config.js';
import { 
    showToast, 
    showLoading, 
    hideLoading, 
    showConfirm 
} from '../utils/ui.js';
import { getLocalProducts, getLocalUnits, saveLocalUnits } from './products.js';

let availableProducts = [];
let pendingUnitCodes = new Set();
let currentSelectedProduct = null;
let currentCorrelativeInfo = null;

/**
 * Renderiza la interfaz de Ingresos
 */
export async function renderEntriesView(container, queryParams = '') {
    const urlParams = new URLSearchParams(queryParams);
    const preselectedProductId = urlParams.get('productId');

    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <div>
                    <h2 class="card-title">
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        Registro de Ingreso de Repuestos al Almacén
                    </h2>
                    <p style="font-size: 0.85rem; color: var(--color-text-muted);">
                        Seleccione el producto del catálogo para cargar su ficha y asigne los stickers alfanuméricos físicos individuales.
                    </p>
                </div>
            </div>

            <form id="entryForm">
                <!-- Paso 1: Selección del Producto -->
                <div style="background-color: #F8FAFC; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.5rem;">
                    <h3 style="font-size: 1rem; font-weight: 700; color: var(--color-primary-dark); margin-bottom: 0.85rem; display: flex; align-items: center; gap: 0.5rem;">
                        <span style="width: 24px; height: 24px; border-radius: 50%; background: var(--color-primary); color: white; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem;">1</span>
                        Seleccionar Producto del Catálogo Maestro
                    </h3>
                    
                    <div class="form-group" style="margin-bottom: 0.75rem;">
                        <label class="form-label">Buscar Referencia (por Nombre, Part Number o Grupo) <span class="required">*</span></label>
                        <select id="entryProductSelect" class="form-control" required style="font-size: 0.95rem; font-weight: 600;">
                            <option value="">-- Seleccione un producto del catálogo --</option>
                        </select>
                    </div>

                    <!-- Ficha Automática del Producto Seleccionado -->
                    <div id="selectedProductCard" style="display: none; margin-top: 1rem; background: white; border: 1.5px solid var(--color-accent); border-radius: var(--radius-md); padding: 1.25rem; box-shadow: var(--shadow-sm);">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.75rem; border-bottom: 1px solid var(--color-border); padding-bottom: 0.75rem; margin-bottom: 0.75rem;">
                            <div>
                                <span style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase; font-weight: 700;">Nombre del Producto:</span>
                                <div id="cardProductName" style="font-size: 1.2rem; font-weight: 800; color: var(--color-primary-dark);">-</div>
                            </div>
                            <div style="text-align: right;">
                                <span style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase; font-weight: 700;">Grupo / Familia:</span>
                                <div><span class="code-pill" id="cardProductGroup" style="font-size: 1rem; font-weight: 800; color: var(--color-primary);">-</span></div>
                            </div>
                        </div>

                        <div class="form-row" style="margin-bottom: 0.75rem;">
                            <div>
                                <span style="font-size: 0.78rem; color: var(--color-text-muted); font-weight: 600;">Part Number Original:</span>
                                <div id="cardProductPartNumber" style="font-size: 1rem; font-weight: 700; color: var(--color-text-main);">-</div>
                            </div>
                            <div>
                                <span style="font-size: 0.78rem; color: var(--color-text-muted); font-weight: 600;">Ubicación en Almacén:</span>
                                <div id="cardProductLocation" style="font-size: 0.95rem; font-weight: 500;">-</div>
                            </div>
                        </div>

                        <div style="margin-bottom: 0.75rem;">
                            <span style="font-size: 0.78rem; color: var(--color-text-muted); font-weight: 600;">Descripción Técnica:</span>
                            <div id="cardProductDescription" style="font-size: 0.9rem; color: var(--color-text-main);">-</div>
                        </div>

                        <!-- Panel Informativo de Correlativos -->
                        <div id="correlativeStatusBanner" style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: var(--radius-sm); padding: 0.75rem 1rem; font-size: 0.85rem; color: #1E3A8A; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
                            <div>
                                <strong>Control de Correlativo:</strong>
                                <span id="correlativeText">Consultando correlativo...</span>
                            </div>
                            <span class="badge badge-disponible" id="badgeNextCode" style="font-size: 0.82rem;">Siguiente: -</span>
                        </div>
                    </div>
                </div>

                <!-- Paso 2: Datos de Documentación (Opcionales) -->
                <div style="background-color: #F8FAFC; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.5rem;">
                    <h3 style="font-size: 1rem; font-weight: 700; color: var(--color-primary-dark); margin-bottom: 0.85rem; display: flex; align-items: center; gap: 0.5rem;">
                        <span style="width: 24px; height: 24px; border-radius: 50%; background: var(--color-primary); color: white; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem;">2</span>
                        Datos de Recepción <span class="optional">(Opcional)</span>
                    </h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Proveedor / Procedencia <span class="optional">(Opcional)</span></label>
                            <input type="text" id="entrySupplier" class="form-control" placeholder="ej. Atlas Copco Perú S.A.C.">
                        </div>
                        <div class="form-group">
                            <label class="form-label">N° Guía de Remisión u Orden de Compra <span class="optional">(Opcional)</span></label>
                            <input type="text" id="entryDocRef" class="form-control" placeholder="ej. GR-001-9482 / OC-2026-44">
                        </div>
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label class="form-label">Observaciones de Recepción <span class="optional">(Opcional)</span></label>
                        <input type="text" id="entryNotes" class="form-control" placeholder="ej. Cajas selladas recibidas en buen estado">
                    </div>
                </div>

                <!-- Paso 3: Códigos de Stickers Físicos a Ingresar -->
                <div style="background-color: #F8FAFC; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.5rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.85rem; flex-wrap: wrap; gap: 0.5rem;">
                        <h3 style="font-size: 1rem; font-weight: 700; color: var(--color-primary-dark); display: flex; align-items: center; gap: 0.5rem;">
                            <span style="width: 24px; height: 24px; border-radius: 50%; background: var(--color-primary); color: white; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem;">3</span>
                            Asignación de Stickers Físicos a Ingresar
                        </h3>
                        <span id="pendingCountBadge" class="badge badge-disponible">0 Unidades a Registrar</span>
                    </div>

                    <!-- MODO A: Generador por Rango y Cantidad (Abierto y Visible por Defecto) -->
                    <div id="batchHelperBox" style="background: white; border: 1.5px solid var(--color-accent); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1rem; box-shadow: var(--shadow-sm);">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
                            <span style="font-size: 0.95rem; font-weight: 800; color: var(--color-primary-dark);">
                                ⚡ Carga Masiva por Rango Correlativo (ej. 50 unidades del 00001 al 00050)
                            </span>
                            <span class="badge badge-proximo" style="font-size: 0.75rem;">Rápido y Seguro</span>
                        </div>
                        <p style="font-size: 0.82rem; color: var(--color-text-muted); margin-bottom: 0.85rem;">
                            Indique el número inicial y la cantidad que tiene en almacén. El sistema generará los códigos correlativos exactos sin que tenga que escribirlos uno por uno.
                        </p>

                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Prefijo del Grupo</label>
                                <input type="text" id="batchPrefix" class="form-control" placeholder="ej. OF-600-" style="font-weight: 800; font-size: 1rem; text-transform: uppercase;">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Número Inicial (5 dígitos)</label>
                                <input type="number" id="batchStartNum" class="form-control" min="1" value="1" placeholder="1" style="font-weight: 800; font-size: 1rem;">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Cantidad de Unidades</label>
                                <input type="number" id="batchCount" class="form-control" min="1" max="1000" value="50" placeholder="ej. 50" style="font-weight: 800; font-size: 1rem;">
                            </div>
                            <div class="form-group" style="align-self: flex-end;">
                                <button type="button" class="btn btn-primary" id="btnGenerateBatchRange" style="width: 100%; font-weight: 700; padding: 0.75rem 1rem;">
                                    Generar Stickers en Lote
                                </button>
                            </div>
                        </div>

                        <div id="batchLivePreviewText" style="font-size: 0.85rem; font-weight: 700; color: var(--color-primary); background: #EFF6FF; padding: 0.65rem 0.85rem; border-radius: var(--radius-sm); border: 1px solid #BFDBFE; margin-top: 0.5rem;">
                            Vista previa: Se agregarán 50 stickers a la lista.
                        </div>
                    </div>

                    <!-- MODO B: Entrada individual / Pegado de texto (Opcional) -->
                    <div style="background: white; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1rem;">
                        <div style="font-size: 0.85rem; font-weight: 700; color: var(--color-text-main); margin-bottom: 0.5rem;">
                            O ingresar stickers manualmente uno a uno:
                        </div>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <input type="text" id="inputUnitCodeSingle" class="form-control" placeholder="Ingresar código ej. OF-600-00001" style="flex: 1; min-width: 240px; font-weight: 700; text-transform: uppercase;">
                            <button type="button" class="btn btn-secondary" id="btnAddSingleCode">
                                + Agregar Individual
                            </button>
                        </div>
                    </div>

                    <!-- Lista de Stickers en Espera de Guardado -->
                    <div id="unitsQueueContainer" style="background: white; border-radius: var(--radius-sm); border: 1px solid var(--color-border); padding: 0.85rem; min-height: 120px; max-height: 260px; overflow-y: auto;">
                        <div id="emptyQueueMsg" style="text-align: center; color: var(--color-text-muted); padding: 2rem 0; font-size: 0.88rem;">
                            No ha agregado stickers todavía. Ingrese los códigos de las unidades físicas que ingresarán con estado <strong>DISPONIBLE</strong>.
                        </div>
                        <div id="chipsContainer" style="display: flex; flex-wrap: wrap; gap: 0.5rem;"></div>
                    </div>
                </div>

                <!-- Botones de Acción -->
                <div style="display: flex; justify-content: flex-end; gap: 1rem; align-items: center;">
                    <button type="button" class="btn btn-secondary" id="btnClearQueue">Limpiar Lista</button>
                    <button type="submit" class="btn btn-primary btn-large-action" id="btnSubmitEntry" style="max-width: 320px;" disabled>
                        <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                        Guardar Ingreso al Almacén
                    </button>
                </div>
            </form>
        </div>
    `;

    pendingUnitCodes.clear();
    currentSelectedProduct = null;
    currentCorrelativeInfo = null;

    await loadProductsDropdown(preselectedProductId);
    setupEntryListeners();
}

/**
 * Carga el selector de productos con datos de nombre y grupo
 */
async function loadProductsDropdown(preselectedId = null) {
    const select = document.getElementById('entryProductSelect');
    if (!select) return;

    const supabase = getSupabase();
    availableProducts = [];

    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('id, internal_code, part_number, name, description, unit_of_measure, warehouse_location')
                .order('internal_code', { ascending: true });

            if (!error && data) {
                availableProducts = data;
            }
        } catch (err) {
            console.warn('Error leyendo catálogo de Supabase:', err);
        }
    }

    if (availableProducts.length === 0) {
        availableProducts = getLocalProducts().map(p => ({
            id: p.id || p.product_id,
            internal_code: p.internal_code,
            part_number: p.part_number,
            name: p.name,
            description: p.description,
            unit_of_measure: p.unit_of_measure,
            warehouse_location: p.warehouse_location
        }));
    }

    select.innerHTML = `<option value="">-- Seleccione un producto del catálogo (${availableProducts.length}) --</option>` +
        availableProducts.map(p => `
            <option value="${p.id}" ${p.id === preselectedId ? 'selected' : ''}>
                [${p.internal_code}] ${p.part_number} – ${p.name || p.description}
            </option>
        `).join('');

    if (preselectedId) {
        await handleProductSelection(preselectedId);
    }
}

/**
 * Al seleccionar producto: muestra su ficha automática y calcula el próximo correlativo
 */
async function handleProductSelection(productId) {
    const card = document.getElementById('selectedProductCard');
    const prefixInput = document.getElementById('batchPrefix');
    const startNumInput = document.getElementById('batchStartNum');
    const correlativeText = document.getElementById('correlativeText');
    const badgeNext = document.getElementById('badgeNextCode');
    const singleCodeInput = document.getElementById('inputUnitCodeSingle');

    currentSelectedProduct = availableProducts.find(p => p.id === productId);

    if (!currentSelectedProduct) {
        card.style.display = 'none';
        return;
    }

    // Llenar ficha del producto automáticamente
    document.getElementById('cardProductName').textContent = currentSelectedProduct.name || currentSelectedProduct.description;
    document.getElementById('cardProductGroup').textContent = currentSelectedProduct.internal_code;
    document.getElementById('cardProductPartNumber').textContent = currentSelectedProduct.part_number;
    document.getElementById('cardProductLocation').textContent = currentSelectedProduct.warehouse_location || 'No asignada';
    document.getElementById('cardProductDescription').textContent = currentSelectedProduct.description;

    card.style.display = 'block';

    const groupPrefix = `${currentSelectedProduct.internal_code}-`;

    // Consultar el próximo correlativo seguro
    const supabase = getSupabase();
    let correlativeFound = false;

    if (supabase) {
        correlativeText.textContent = 'Calculando correlativo más alto registrado...';
        try {
            const { data, error } = await supabase.rpc('get_next_correlative', {
                p_family_code: currentSelectedProduct.internal_code
            });

            if (!error && data) {
                currentCorrelativeInfo = data;
                correlativeFound = true;
                if (data.has_existing_units) {
                    correlativeText.textContent = `Último código registrado: ${data.last_code}.`;
                } else {
                    correlativeText.textContent = `No hay unidades previas. Inicia en 00001.`;
                }

                badgeNext.textContent = `Siguiente: ${data.next_code}`;
                if (prefixInput) prefixInput.value = data.family_prefix;
                if (startNumInput) startNumInput.value = data.next_correlative_number;
                if (singleCodeInput && !singleCodeInput.value) {
                    singleCodeInput.placeholder = `ej. ${data.next_code}`;
                }
            }
        } catch (e) {
            console.warn('Error calculando correlativo RPC:', e);
        }
    }

    if (!correlativeFound) {
        // Cálculo local de correlativo
        const localUnits = getLocalUnits().filter(u => u.unit_code.startsWith(groupPrefix));
        let maxNum = 0;
        let lastCode = null;

        localUnits.forEach(u => {
            const suffix = u.unit_code.replace(groupPrefix, '');
            const n = parseInt(suffix, 10);
            if (!isNaN(n) && n > maxNum) {
                maxNum = n;
                lastCode = u.unit_code;
            }
        });

        const nextNum = maxNum + 1;
        const nextCode = `${groupPrefix}${nextNum.toString().padStart(5, '0')}`;

        if (maxNum > 0) {
            correlativeText.textContent = `Último código registrado: ${lastCode}.`;
        } else {
            correlativeText.textContent = `No hay unidades previas. Inicia en 00001.`;
        }

        badgeNext.textContent = `Siguiente: ${nextCode}`;
        if (prefixInput) prefixInput.value = groupPrefix;
        if (startNumInput) startNumInput.value = nextNum;
        if (singleCodeInput && !singleCodeInput.value) {
            singleCodeInput.placeholder = `ej. ${nextCode}`;
        }
    }
}

function setupEntryListeners() {
    const productSelect = document.getElementById('entryProductSelect');
    const singleCodeInput = document.getElementById('inputUnitCodeSingle');
    const addSingleBtn = document.getElementById('btnAddSingleCode');
    const toggleBatchBtn = document.getElementById('btnToggleBatchHelper');
    const batchBox = document.getElementById('batchHelperBox');
    const genBatchBtn = document.getElementById('btnGenerateBatchRange');
    const processBatchTextBtn = document.getElementById('btnProcessBatchText');
    const clearQueueBtn = document.getElementById('btnClearQueue');
    const form = document.getElementById('entryForm');

    const updateBatchLivePreview = () => {
        let prefix = document.getElementById('batchPrefix')?.value.trim().toUpperCase() || 'COD-';
        if (!prefix.endsWith('-')) prefix += '-';
        const start = parseInt(document.getElementById('batchStartNum')?.value, 10) || 1;
        const count = parseInt(document.getElementById('batchCount')?.value, 10) || 0;
        const previewEl = document.getElementById('batchLivePreviewText');
        if (!previewEl) return;

        if (count > 0) {
            const first = `${prefix}${start.toString().padStart(5, '0')}`;
            const last = `${prefix}${(start + count - 1).toString().padStart(5, '0')}`;
            previewEl.textContent = `Vista previa: Se generarán ${count} stickers físicos (${first} al ${last}).`;
        } else {
            previewEl.textContent = 'Indique una cantidad mayor a 0.';
        }
    };

    document.getElementById('batchPrefix')?.addEventListener('input', updateBatchLivePreview);
    document.getElementById('batchStartNum')?.addEventListener('input', updateBatchLivePreview);
    document.getElementById('batchCount')?.addEventListener('input', updateBatchLivePreview);

    productSelect?.addEventListener('change', async () => {
        await handleProductSelection(productSelect.value);
        updateBatchLivePreview();
    });

    const addCodeFromInput = () => {
        const code = singleCodeInput.value.trim().toUpperCase();
        if (!code) return;

        if (pendingUnitCodes.has(code)) {
            showToast(`El código ${code} ya está en la lista de ingreso actual.`, 'warning');
            return;
        }

        pendingUnitCodes.add(code);
        singleCodeInput.value = '';
        renderChips();
        singleCodeInput.focus();
    };

    addSingleBtn?.addEventListener('click', addCodeFromInput);
    singleCodeInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addCodeFromInput();
        }
    });

    toggleBatchBtn?.addEventListener('click', () => {
        batchBox.style.display = batchBox.style.display === 'none' ? 'block' : 'none';
    });

    genBatchBtn?.addEventListener('click', () => {
        let prefix = document.getElementById('batchPrefix').value.trim().toUpperCase();
        const start = parseInt(document.getElementById('batchStartNum').value, 10);
        const count = parseInt(document.getElementById('batchCount').value, 10);

        if (!prefix) {
            showToast('Especifique el prefijo del grupo (ej. AF-100-)', 'warning');
            return;
        }

        if (!prefix.endsWith('-')) {
            prefix += '-';
        }

        if (isNaN(start) || isNaN(count) || count <= 0) {
            showToast('Indique un número inicial y una cantidad de unidades válida.', 'warning');
            return;
        }

        let addedCount = 0;
        for (let i = 0; i < count; i++) {
            const num = (start + i).toString().padStart(5, '0');
            const code = `${prefix}${num}`;
            if (!pendingUnitCodes.has(code)) {
                pendingUnitCodes.add(code);
                addedCount++;
            }
        }

        showToast(`Se agregaron ${addedCount} stickers correlativos a la cola.`, 'info');
        renderChips();
    });

    processBatchTextBtn?.addEventListener('click', () => {
        const text = document.getElementById('batchTextArea').value;
        if (!text.trim()) return;

        const codes = text.split(/[\r\n,;]+/)
            .map(c => c.trim().toUpperCase())
            .filter(c => c.length > 2);

        let addedCount = 0;
        codes.forEach(code => {
            if (!pendingUnitCodes.has(code)) {
                pendingUnitCodes.add(code);
                addedCount++;
            }
        });

        document.getElementById('batchTextArea').value = '';
        showToast(`Se agregaron ${addedCount} códigos desde el texto.`, 'info');
        renderChips();
    });

    clearQueueBtn?.addEventListener('click', () => {
        pendingUnitCodes.clear();
        renderChips();
    });

    form?.addEventListener('submit', handleEntrySubmit);
}

function renderChips() {
    const container = document.getElementById('chipsContainer');
    const emptyMsg = document.getElementById('emptyQueueMsg');
    const badge = document.getElementById('pendingCountBadge');
    const submitBtn = document.getElementById('btnSubmitEntry');
    if (!container) return;

    container.innerHTML = '';
    const total = pendingUnitCodes.size;

    if (total === 0) {
        emptyMsg.style.display = 'block';
        badge.textContent = '0 Unidades a Registrar';
        submitBtn.disabled = true;
        return;
    }

    emptyMsg.style.display = 'none';
    badge.textContent = `${total} Unidades a Registrar`;
    submitBtn.disabled = false;

    pendingUnitCodes.forEach(code => {
        const chip = document.createElement('div');
        chip.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            background: #EFF6FF;
            color: #1E3A8A;
            border: 1px solid #BFDBFE;
            padding: 0.35rem 0.65rem;
            border-radius: var(--radius-sm);
            font-size: 0.85rem;
            font-weight: 700;
        `;
        chip.innerHTML = `
            <span>${code}</span>
            <button type="button" style="background: none; border: none; color: #DC2626; cursor: pointer; font-size: 1.1rem; line-height: 1; padding: 0 0.2rem;" title="Quitar">&times;</button>
        `;
        chip.querySelector('button').onclick = () => {
            pendingUnitCodes.delete(code);
            renderChips();
        };
        container.appendChild(chip);
    });
}

/**
 * Envía el ingreso (Supabase + Respaldo Local)
 */
async function handleEntrySubmit(e) {
    e.preventDefault();

    if (!currentSelectedProduct) {
        showToast('Debe seleccionar un producto del catálogo.', 'warning');
        return;
    }

    if (pendingUnitCodes.size === 0) {
        showToast('Debe ingresar al menos un código de sticker.', 'warning');
        return;
    }

    const supplier = document.getElementById('entrySupplier').value.trim() || null;
    const docRef = document.getElementById('entryDocRef').value.trim() || null;
    const notes = document.getElementById('entryNotes').value.trim() || null;

    const confirmed = await showConfirm(
        'Confirmar Ingreso al Almacén',
        `¿Desea registrar el ingreso de <strong>${pendingUnitCodes.size} unidades físicas</strong> para:<br><br>
        <strong>Producto:</strong> ${currentSelectedProduct.name || currentSelectedProduct.description}<br>
        <strong>Part Number:</strong> ${currentSelectedProduct.part_number}<br>
        <strong>Grupo:</strong> ${currentSelectedProduct.internal_code}<br><br>
        Cada unidad pasará inmediatamente a estado <strong>DISPONIBLE</strong>.`,
        'Sí, Registrar Ingreso',
        'Cancelar'
    );

    if (!confirmed) return;

    showLoading(`Registrando ${pendingUnitCodes.size} unidades...`);

    const codesArray = Array.from(pendingUnitCodes);
    let successCount = 0;
    const duplicateErrors = [];
    const otherErrors = [];

    const supabase = getSupabase();

    if (supabase) {
        for (const code of codesArray) {
            try {
                const { data, error } = await supabase.rpc('register_unit_entry', {
                    p_product_id: currentSelectedProduct.id,
                    p_unit_code: code,
                    p_supplier: supplier,
                    p_document_reference: docRef,
                    p_notes: notes
                });

                if (error) {
                    otherErrors.push(`${code}: ${error.message}`);
                } else if (data && !data.success) {
                    if (data.error.includes('YA EXISTE')) {
                        duplicateErrors.push(code);
                    } else {
                        otherErrors.push(`${code}: ${data.error}`);
                    }
                } else {
                    successCount++;
                    pendingUnitCodes.delete(code);
                }
            } catch (callErr) {
                otherErrors.push(`${code}: ${callErr.message}`);
            }
        }
    } else {
        // Modo local
        const localUnits = getLocalUnits();
        codesArray.forEach(code => {
            if (localUnits.some(u => u.unit_code === code)) {
                duplicateErrors.push(code);
            } else {
                localUnits.push({
                    id: 'unit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                    product_id: currentSelectedProduct.id,
                    unit_code: code,
                    status: 'DISPONIBLE',
                    created_at: new Date().toISOString()
                });
                successCount++;
                pendingUnitCodes.delete(code);
            }
        });
        saveLocalUnits(localUnits);
    }

    hideLoading();
    renderChips();

    if (successCount > 0) {
        showToast(`¡${successCount} unidades registradas con éxito con estado DISPONIBLE!`, 'success');
        await handleProductSelection(currentSelectedProduct.id);
    }

    if (duplicateErrors.length > 0) {
        showToast(`ADVERTENCIA: Los siguientes ${duplicateErrors.length} códigos YA EXISTEN y no fueron duplicados: ${duplicateErrors.join(', ')}`, 'error', 7000);
    }

    if (otherErrors.length > 0) {
        showToast(`Hubo ${otherErrors.length} errores: ${otherErrors[0]}`, 'warning', 5000);
    }

    if (pendingUnitCodes.size === 0) {
        document.getElementById('entrySupplier').value = '';
        document.getElementById('entryDocRef').value = '';
        document.getElementById('entryNotes').value = '';
    }
}
