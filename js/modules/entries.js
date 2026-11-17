/**
 * SISTEMA DE CONTROL DE ALMACÉN – INDUSTRAC S.A.C.
 * Módulo 3: Registro de Ingresos de Unidades Individuales
 */

import { getSupabase } from '../config.js';
import { 
    showToast, 
    showLoading, 
    hideLoading, 
    showConfirm 
} from '../utils/ui.js';

let availableProducts = [];
let pendingUnitCodes = new Set();

/**
 * Renderiza la interfaz de Ingresos
 */
export async function renderEntriesView(container, queryParams = '') {
    // Si viene un productId en los parámetros del query
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
                        Asigne los stickers físicos impresos al producto correspondiente. Cada código individual pasará al estado DISPONIBLE.
                    </p>
                </div>
            </div>

            <form id="entryForm">
                <!-- Paso 1: Selección del Producto -->
                <div style="background-color: #F8FAFC; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.5rem;">
                    <h3 style="font-size: 1rem; font-weight: 700; color: var(--color-primary-dark); margin-bottom: 0.85rem; display: flex; align-items: center; gap: 0.5rem;">
                        <span style="width: 24px; height: 24px; border-radius: 50%; background: var(--color-primary); color: white; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem;">1</span>
                        Seleccionar Referencia de Producto
                    </h3>
                    <div class="form-row">
                        <div class="form-group" style="grid-column: span 2;">
                            <label class="form-label">Buscar Referencia (Part Number, Familia o Descripción) <span class="required">*</span></label>
                            <select id="entryProductSelect" class="form-control" required>
                                <option value="">-- Seleccione un producto del catálogo --</option>
                            </select>
                        </div>
                    </div>
                    <div id="selectedProductDetails" style="display: none; margin-top: 0.75rem; padding: 0.85rem; background: white; border-radius: var(--radius-sm); border-left: 4px solid var(--color-accent); font-size: 0.88rem;">
                        <!-- Información rápida del producto seleccionado -->
                    </div>
                </div>

                <!-- Paso 2: Datos del Documento / Procedencia (Opcional) -->
                <div style="background-color: #F8FAFC; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.5rem;">
                    <h3 style="font-size: 1rem; font-weight: 700; color: var(--color-primary-dark); margin-bottom: 0.85rem; display: flex; align-items: center; gap: 0.5rem;">
                        <span style="width: 24px; height: 24px; border-radius: 50%; background: var(--color-primary); color: white; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem;">2</span>
                        Datos del Ingreso <span class="optional">(Opcional)</span>
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
                        <label class="form-label">Observaciones <span class="optional">(Opcional)</span></label>
                        <input type="text" id="entryNotes" class="form-control" placeholder="ej. Lote recibido conforme en caja sellada">
                    </div>
                </div>

                <!-- Paso 3: Códigos Individuales de los Stickers Físicos -->
                <div style="background-color: #F8FAFC; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.5rem;">
                    <h3 style="font-size: 1rem; font-weight: 700; color: var(--color-primary-dark); margin-bottom: 0.85rem; display: flex; align-items: center; justify-content: space-between;">
                        <span style="display: flex; align-items: center; gap: 0.5rem;">
                            <span style="width: 24px; height: 24px; border-radius: 50%; background: var(--color-primary); color: white; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem;">3</span>
                            Códigos de Stickers Físicos a Ingresar
                        </span>
                        <span id="pendingCountBadge" class="badge badge-disponible">0 Unidades a Registrar</span>
                    </h3>

                    <!-- Entrada rápida de código -->
                    <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem; flex-wrap: wrap;">
                        <input type="text" id="inputUnitCodeSingle" class="form-control" placeholder="Ingresar sticker ej. AF-100-00001" style="flex: 1; min-width: 220px; font-weight: 700; text-transform: uppercase;">
                        <button type="button" class="btn btn-accent" id="btnAddSingleCode">
                            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                            Agregar Código
                        </button>
                        <button type="button" class="btn btn-secondary" id="btnToggleBatchHelper">
                            Generador Correlativo / Pegado Múltiple
                        </button>
                    </div>

                    <!-- Asistente de Lotes Correlativos (Oculto por defecto) -->
                    <div id="batchHelperBox" style="display: none; background: white; border: 1.5px dashed var(--color-accent); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1rem;">
                        <div style="font-size: 0.85rem; font-weight: 700; color: var(--color-primary-dark); margin-bottom: 0.5rem;">
                            Pegar Lista de Códigos o Generar Rango Correlativo de Stickers:
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Prefijo (ej. AF-100-)</label>
                                <input type="text" id="batchPrefix" class="form-control" placeholder="ej. AF-100-">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Número Inicial (ej. 1 o 00001)</label>
                                <input type="number" id="batchStartNum" class="form-control" placeholder="ej. 1">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Cantidad de Unidades</label>
                                <input type="number" id="batchCount" class="form-control" placeholder="ej. 10">
                            </div>
                            <div class="form-group" style="align-self: flex-end;">
                                <button type="button" class="btn btn-primary" id="btnGenerateBatchRange" style="width: 100%;">Generar Rango</button>
                            </div>
                        </div>
                        <div class="form-group" style="margin-bottom: 0; margin-top: 0.5rem;">
                            <label class="form-label">O pegar texto múltiple con códigos (uno por línea o separados por coma):</label>
                            <textarea id="batchTextArea" class="form-control" rows="2" placeholder="AF-100-00001&#10;AF-100-00002&#10;AF-100-00003"></textarea>
                            <button type="button" class="btn btn-secondary btn-sm" id="btnProcessBatchText" style="margin-top: 0.5rem;">Procesar Texto Pegado</button>
                        </div>
                    </div>

                    <!-- Lista de Stickers en Cola para Guardar -->
                    <div id="unitsQueueContainer" style="background: white; border-radius: var(--radius-sm); border: 1px solid var(--color-border); padding: 0.75rem; min-height: 120px; max-height: 260px; overflow-y: auto;">
                        <div id="emptyQueueMsg" style="text-align: center; color: var(--color-text-muted); padding: 2rem 0; font-size: 0.88rem;">
                            No ha agregado ningún código todavía. Escriba o pegue los stickers de las unidades recibidas.
                        </div>
                        <div id="chipsContainer" style="display: flex; flex-wrap: wrap; gap: 0.5rem;"></div>
                    </div>
                </div>

                <!-- Botón de Envío -->
                <div style="display: flex; justify-content: flex-end; gap: 1rem;">
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
    await loadProductsDropdown(preselectedProductId);
    setupEntryListeners();
}

/**
 * Carga el selector de productos
 */
async function loadProductsDropdown(preselectedId = null) {
    const supabase = getSupabase();
    const select = document.getElementById('entryProductSelect');
    if (!supabase || !select) return;

    try {
        const { data, error } = await supabase
            .from('products')
            .select('id, internal_code, part_number, description, unit_of_measure, warehouse_location')
            .order('internal_code', { ascending: true });

        if (error) {
            showToast(`Error cargando referencias: ${error.message}`, 'error');
            return;
        }

        availableProducts = data || [];
        select.innerHTML = `<option value="">-- Seleccione un producto del catálogo (${availableProducts.length}) --</option>` +
            availableProducts.map(p => `
                <option value="${p.id}" ${p.id === preselectedId ? 'selected' : ''}>
                    [${p.internal_code}] ${p.part_number} – ${p.description}
                </option>
            `).join('');

        if (preselectedId) {
            updateSelectedProductBox(preselectedId);
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

/**
 * Muestra el cuadro informativo de la referencia seleccionada
 */
function updateSelectedProductBox(productId) {
    const detailsBox = document.getElementById('selectedProductDetails');
    const batchPrefixInput = document.getElementById('batchPrefix');
    if (!detailsBox) return;

    const prod = availableProducts.find(p => p.id === productId);
    if (!prod) {
        detailsBox.style.display = 'none';
        return;
    }

    detailsBox.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
            <div>
                <strong>Familia / Código:</strong> <span class="code-pill">${prod.internal_code}</span> &nbsp;|&nbsp; 
                <strong>P/N:</strong> <span>${prod.part_number}</span> &nbsp;|&nbsp; 
                <strong>Ubicación:</strong> <span>${prod.warehouse_location || 'No asignada'}</span>
            </div>
            <div style="color: var(--color-primary); font-weight: 600;">
                ${prod.description}
            </div>
        </div>
    `;
    detailsBox.style.display = 'block';

    // Auto-rellenar prefijo sugerido para el generador
    if (batchPrefixInput && !batchPrefixInput.value) {
        batchPrefixInput.value = `${prod.internal_code}-`;
    }
}

/**
 * Escuchadores de eventos para Ingresos
 */
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

    productSelect?.addEventListener('change', () => {
        updateSelectedProductBox(productSelect.value);
    });

    // Agregar código individual
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

    // Mostrar / Ocultar asistente de lote
    toggleBatchBtn?.addEventListener('click', () => {
        batchBox.style.display = batchBox.style.display === 'none' ? 'block' : 'none';
    });

    // Generar rango correlativo respetando el formato de 5 dígitos (ej. 00001)
    genBatchBtn?.addEventListener('click', () => {
        const prefix = document.getElementById('batchPrefix').value.trim().toUpperCase();
        const start = parseInt(document.getElementById('batchStartNum').value, 10);
        const count = parseInt(document.getElementById('batchCount').value, 10);

        if (!prefix || isNaN(start) || isNaN(count) || count <= 0) {
            showToast('Complete el prefijo, número inicial y una cantidad válida.', 'warning');
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

        showToast(`Se agregaron ${addedCount} códigos correlativos a la lista.`, 'info');
        renderChips();
    });

    // Procesar texto pegado
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

    // Limpiar cola
    clearQueueBtn?.addEventListener('click', () => {
        pendingUnitCodes.clear();
        renderChips();
    });

    // Enviar Formulario
    form?.addEventListener('submit', handleEntrySubmit);
}

/**
 * Renderiza los stickers en la lista visual
 */
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
            padding: 0.3rem 0.65rem;
            border-radius: var(--radius-sm);
            font-size: 0.85rem;
            font-weight: 700;
        `;
        chip.innerHTML = `
            <span>${code}</span>
            <button type="button" style="background: none; border: none; color: #DC2626; cursor: pointer; font-size: 1rem; line-height: 1; padding: 0 0.15rem;" title="Quitar">&times;</button>
        `;
        chip.querySelector('button').onclick = () => {
            pendingUnitCodes.delete(code);
            renderChips();
        };
        container.appendChild(chip);
    });
}

/**
 * Envía el ingreso a Supabase ejecutando la función atómica RPC por cada unidad
 */
async function handleEntrySubmit(e) {
    e.preventDefault();
    const supabase = getSupabase();
    if (!supabase) {
        showToast('Supabase no está conectado.', 'error');
        return;
    }

    const productId = document.getElementById('entryProductSelect').value;
    if (!productId) {
        showToast('Debe seleccionar una referencia de producto.', 'warning');
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
        `¿Desea registrar el ingreso de <strong>${pendingUnitCodes.size} unidades físicas</strong> para el producto seleccionado?<br><br>Todos los códigos quedarán con estado <strong>DISPONIBLE</strong>.`,
        'Sí, Registrar Ingreso',
        'Cancelar'
    );

    if (!confirmed) return;

    showLoading(`Registrando ${pendingUnitCodes.size} unidades en Supabase...`);

    const codesArray = Array.from(pendingUnitCodes);
    let successCount = 0;
    const duplicateErrors = [];
    const otherErrors = [];

    // Procesar cada unidad mediante la función atómica RPC
    for (const code of codesArray) {
        try {
            const { data, error } = await supabase.rpc('register_unit_entry', {
                p_product_id: productId,
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
                pendingUnitCodes.delete(code); // Remover los exitosos
            }
        } catch (callErr) {
            otherErrors.push(`${code}: ${callErr.message}`);
        }
    }

    hideLoading();
    renderChips();

    // Mensajes de resultado
    if (successCount > 0) {
        showToast(`¡${successCount} unidades registradas con éxito con estado DISPONIBLE!`, 'success');
    }

    if (duplicateErrors.length > 0) {
        showToast(`ADVERTENCIA: Los siguientes ${duplicateErrors.length} códigos YA EXISTEN en el sistema y no fueron duplicados: ${duplicateErrors.join(', ')}`, 'error', 6000);
    }

    if (otherErrors.length > 0) {
        showToast(`Hubo ${otherErrors.length} errores: ${otherErrors[0]}`, 'warning', 5000);
    }

    // Si todos fueron procesados con éxito
    if (pendingUnitCodes.size === 0) {
        document.getElementById('entrySupplier').value = '';
        document.getElementById('entryDocRef').value = '';
        document.getElementById('entryNotes').value = '';
    }
}
