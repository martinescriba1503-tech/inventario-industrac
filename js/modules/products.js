/**
 * SISTEMA DE CONTROL DE ALMACÉN – INDUSTRAC S.A.C.
 * Módulo 2: Catálogo de Productos y Unidades Físicas
 */

import { getSupabase } from '../config.js';
import { isAdmin } from '../auth.js';
import { 
    showToast, 
    showLoading, 
    hideLoading, 
    openModal, 
    closeModal, 
    showConfirm,
    getStockStatusBadge,
    getUnitStatusBadge,
    formatDateTime
} from '../utils/ui.js';
import { parseExcelFile } from '../utils/excel.js';

let productsList = [];
let selectedProductId = null;

/**
 * Renderiza la vista principal del catálogo de productos
 */
export async function renderProductsView(container) {
    const adminMode = isAdmin();

    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <div>
                    <h2 class="card-title">
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
                        Catálogo Maestro de Referencias
                    </h2>
                    <p style="font-size: 0.85rem; color: var(--color-text-muted);">
                        Gestión de productos y consulta de unidades físicas individuales vinculadas.
                    </p>
                </div>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    ${adminMode ? `
                        <button type="button" class="btn btn-secondary" id="btnImportProducts">
                            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                            Importar Excel / CSV
                        </button>
                        <button type="button" class="btn btn-primary" id="btnNewProduct">
                            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                            Nueva Referencia
                        </button>
                    ` : `
                        <span class="badge" style="background:#F1F5F9; color:#64748B;">Modo Consulta (Operador)</span>
                    `}
                </div>
            </div>

            <!-- Barra de Filtros y Búsqueda -->
            <div class="filter-toolbar">
                <div class="search-input-group">
                    <svg class="search-icon" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    <input type="text" id="productSearchInput" class="form-control" placeholder="Buscar por descripción, N° Parte o Familia...">
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <select id="productCategoryFilter" class="form-control" style="width: auto; min-width: 160px;">
                        <option value="">Todas las Categorías</option>
                    </select>
                    <button type="button" class="btn btn-secondary" id="btnRefreshProducts" title="Actualizar lista">
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                    </button>
                </div>
            </div>

            <!-- Tabla de Referencias -->
            <div class="table-responsive">
                <table class="custom-table" id="productsTable">
                    <thead>
                        <tr>
                            <th>Familia / Cód.</th>
                            <th>Part Number</th>
                            <th>Descripción</th>
                            <th>Categoría</th>
                            <th>Stock Disp.</th>
                            <th>Stock Mín.</th>
                            <th>Estado</th>
                            <th>Ubicación</th>
                            <th style="text-align: right;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="productsTableBody">
                        <tr><td colspan="9" style="text-align: center; padding: 2rem;">Cargando referencias...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- MODAL: Crear / Editar Referencia -->
        <div id="productModal" class="modal-backdrop">
            <div class="modal-dialog modal-dialog-large">
                <div class="modal-header">
                    <h3 class="modal-title" id="productModalTitle">Nueva Referencia de Producto</h3>
                    <button type="button" class="modal-close-btn" id="closeProductModal">&times;</button>
                </div>
                <form id="productForm">
                    <input type="hidden" id="formProductId">
                    <div class="modal-body">
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Código Interno / Familia <span class="required">*</span></label>
                                <input type="text" id="formInternalCode" class="form-control" placeholder="ej. AF-100, OSVK-704" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Part Number Original <span class="required">*</span></label>
                                <input type="text" id="formPartNumber" class="form-control" placeholder="ej. 1613610500" required>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Descripción del Repuesto <span class="required">*</span></label>
                            <input type="text" id="formDescription" class="form-control" placeholder="ej. Filtro de Aceite para Compresor" required>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Categoría</label>
                                <input type="text" id="formCategory" class="form-control" placeholder="ej. Filtros, Kits, Válvulas" list="categorySuggestions">
                                <datalist id="categorySuggestions">
                                    <option value="Filtros">
                                    <option value="Separadores">
                                    <option value="Válvulas">
                                    <option value="Kits de Mantenimiento">
                                    <option value="Aceites y Lubricantes">
                                    <option value="Sensores y Eléctricos">
                                </datalist>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Marca / Fabricante</label>
                                <input type="text" id="formBrand" class="form-control" placeholder="ej. Atlas Copco, Ingersoll Rand, Sullair">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Unidad de Medida</label>
                                <select id="formUnitOfMeasure" class="form-control">
                                    <option value="UND">Unidad (UND)</option>
                                    <option value="JGO">Juego / Set (JGO)</option>
                                    <option value="METRO">Metro (MTR)</option>
                                    <option value="GAL">Galón (GAL)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Stock Mínimo de Alerta <span class="required">*</span></label>
                                <input type="number" id="formMinStock" class="form-control" min="0" value="5" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Ubicación en Almacén</label>
                                <input type="text" id="formWarehouseLocation" class="form-control" placeholder="ej. Estante B-3, Nivel 2">
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Observaciones <span class="optional">(Opcional)</span></label>
                            <textarea id="formNotes" class="form-control" rows="2" placeholder="Notas técnicas, compatibilidades, etc."></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" id="cancelProductBtn">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="saveProductBtn">Guardar Referencia</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- MODAL: Ver Unidades Físicas del Producto -->
        <div id="productUnitsModal" class="modal-backdrop">
            <div class="modal-dialog modal-dialog-large">
                <div class="modal-header">
                    <div>
                        <h3 class="modal-title" id="productUnitsTitle">Unidades Físicas Registradas</h3>
                        <p id="productUnitsSubtitle" style="font-size: 0.82rem; color: var(--color-text-muted);"></p>
                    </div>
                    <button type="button" class="modal-close-btn" id="closeUnitsModal">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
                        <input type="text" id="searchUnitCodeInput" class="form-control" placeholder="Filtrar por sticker..." style="max-width: 250px;">
                        <button type="button" class="btn btn-accent" id="btnQuickAddUnit">
                            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                            Registrar Unidad Físicamente
                        </button>
                    </div>
                    <div class="table-responsive" style="max-height: 420px; overflow-y: auto;">
                        <table class="custom-table">
                            <thead>
                                <tr>
                                    <th>Código Único (Sticker)</th>
                                    <th>Estado Actual</th>
                                    <th>Fecha de Registro</th>
                                    <th>Última Actualización</th>
                                </tr>
                            </thead>
                            <tbody id="unitsTableBody">
                                <tr><td colspan="4" style="text-align: center; padding: 2rem;">Cargando unidades...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" id="closeUnitsModalFooter">Cerrar</button>
                </div>
            </div>
        </div>

        <!-- MODAL: Importación Excel / CSV -->
        <div id="importModal" class="modal-backdrop">
            <div class="modal-dialog modal-dialog-large">
                <div class="modal-header">
                    <h3 class="modal-title">Importar Catálogo desde Excel o CSV</h3>
                    <button type="button" class="modal-close-btn" id="closeImportModal">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="background-color: #EFF6FF; border: 1px solid #BFDBFE; border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1.25rem; font-size: 0.85rem; color: #1E3A8A;">
                        <strong>Formato de Columnas requerido en tu Excel/CSV:</strong>
                        <p style="margin-top: 0.35rem;">
                            <code>Familia</code>, <code>Part Number</code>, <code>Descripcion</code>, <code>Categoria</code>, <code>Marca</code>, <code>Unidad</code>, <code>Stock Minimo</code>, <code>Ubicacion</code>.
                        </p>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Seleccionar archivo (.xlsx, .xls o .csv):</label>
                        <input type="file" id="excelFileInput" class="form-control" accept=".xlsx, .xls, .csv">
                    </div>
                    <div id="importPreviewContainer" style="display: none; margin-top: 1rem;">
                        <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem; font-weight: 700;">Vista Previa (<span id="importCount">0</span> registros detectados):</h4>
                        <div class="table-responsive" style="max-height: 250px; overflow-y: auto;">
                            <table class="custom-table" id="importPreviewTable">
                                <thead>
                                    <tr>
                                        <th>Familia</th>
                                        <th>Part Number</th>
                                        <th>Descripción</th>
                                        <th>Stock Mín.</th>
                                    </tr>
                                </thead>
                                <tbody id="importPreviewBody"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" id="cancelImportBtn">Cancelar</button>
                    <button type="button" class="btn btn-primary" id="confirmImportBtn" disabled>Confirmar e Importar</button>
                </div>
            </div>
        </div>
    `;

    // Asignar Eventos
    setupEventListeners();
    await loadProducts();
}

/**
 * Carga productos y stock desde Supabase
 */
async function loadProducts() {
    const supabase = getSupabase();
    const tbody = document.getElementById('productsTableBody');
    if (!supabase) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--status-critical); padding: 2rem;">Supabase no está conectado. Configure sus credenciales.</td></tr>`;
        return;
    }

    try {
        // Consultamos la vista de resumen de stock
        const { data, error } = await supabase
            .from('v_product_stock_summary')
            .select('*')
            .order('internal_code', { ascending: true });

        if (error) {
            console.error('Error cargando catálogo:', error);
            tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--status-critical); padding: 2rem;">Error al cargar datos: ${error.message}</td></tr>`;
            return;
        }

        productsList = data || [];
        populateCategoryFilter(productsList);
        filterAndRenderTable();
    } catch (err) {
        console.error('Error:', err);
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--status-critical); padding: 2rem;">Error inesperado de conexión.</td></tr>`;
    }
}

/**
 * Filtra y renderiza las filas de la tabla de referencias
 */
function filterAndRenderTable() {
    const searchVal = document.getElementById('productSearchInput')?.value.trim().toLowerCase() || '';
    const categoryVal = document.getElementById('productCategoryFilter')?.value || '';
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;

    const filtered = productsList.filter(p => {
        const matchSearch = !searchVal || 
            (p.internal_code && p.internal_code.toLowerCase().includes(searchVal)) ||
            (p.part_number && p.part_number.toLowerCase().includes(searchVal)) ||
            (p.description && p.description.toLowerCase().includes(searchVal));

        const matchCategory = !categoryVal || (p.category === categoryVal);
        return matchSearch && matchCategory;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9">
                    <div class="empty-state">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                        <h3>No se encontraron productos</h3>
                        <p>No existen referencias registradas con los filtros seleccionados.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    const adminMode = isAdmin();
    tbody.innerHTML = filtered.map(p => `
        <tr>
            <td><span class="code-pill">${p.internal_code}</span></td>
            <td><strong>${p.part_number}</strong></td>
            <td>
                <div style="font-weight: 600;">${p.description}</div>
                ${p.brand ? `<span style="font-size: 0.75rem; color: var(--color-text-muted);">${p.brand}</span>` : ''}
            </td>
            <td>${p.category || '-'}</td>
            <td>
                <span style="font-size: 1.05rem; font-weight: 700; color: ${p.available_units > 0 ? 'var(--status-available)' : 'var(--status-critical)'}">
                    ${p.available_units}
                </span>
                <span style="font-size: 0.75rem; color: var(--color-text-muted);">/ ${p.total_registered_units} tot</span>
            </td>
            <td>${p.min_stock} ${p.unit_of_measure}</td>
            <td>${getStockStatusBadge(p.stock_status)}</td>
            <td>${p.warehouse_location || '-'}</td>
            <td style="text-align: right;">
                <div style="display: inline-flex; gap: 0.35rem;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.viewProductUnits('${p.product_id}')" title="Ver Unidades Físicas">
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                        Unidades
                    </button>
                    ${adminMode ? `
                        <button type="button" class="btn btn-secondary btn-sm" onclick="window.editProduct('${p.product_id}')" title="Editar Referencia">
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

/**
 * Llena el selector de categorías dinámicamente
 */
function populateCategoryFilter(products) {
    const select = document.getElementById('productCategoryFilter');
    if (!select) return;
    const currentVal = select.value;
    const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort();

    select.innerHTML = `<option value="">Todas las Categorías (${products.length})</option>` +
        categories.map(c => `<option value="${c}">${c}</option>`).join('');

    select.value = currentVal;
}

/**
 * Asigna los escuchadores de eventos
 */
function setupEventListeners() {
    document.getElementById('productSearchInput')?.addEventListener('input', filterAndRenderTable);
    document.getElementById('productCategoryFilter')?.addEventListener('change', filterAndRenderTable);
    document.getElementById('btnRefreshProducts')?.addEventListener('click', loadProducts);

    // Modal Producto
    document.getElementById('btnNewProduct')?.addEventListener('click', () => {
        document.getElementById('productForm').reset();
        document.getElementById('formProductId').value = '';
        document.getElementById('productModalTitle').textContent = 'Nueva Referencia de Producto';
        openModal('productModal');
    });

    document.getElementById('closeProductModal')?.addEventListener('click', () => closeModal('productModal'));
    document.getElementById('cancelProductBtn')?.addEventListener('click', () => closeModal('productModal'));

    document.getElementById('productForm')?.addEventListener('submit', handleSaveProduct);

    // Modal Unidades
    document.getElementById('closeUnitsModal')?.addEventListener('click', () => closeModal('productUnitsModal'));
    document.getElementById('closeUnitsModalFooter')?.addEventListener('click', () => closeModal('productUnitsModal'));
    document.getElementById('btnQuickAddUnit')?.addEventListener('click', () => {
        // Redirige al módulo de Ingresos preseleccionando este producto
        window.location.hash = `#/ingresos?productId=${selectedProductId}`;
        closeModal('productUnitsModal');
    });

    // Modal Importación Excel
    document.getElementById('btnImportProducts')?.addEventListener('click', () => {
        document.getElementById('excelFileInput').value = '';
        document.getElementById('importPreviewContainer').style.display = 'none';
        document.getElementById('confirmImportBtn').disabled = true;
        openModal('importModal');
    });

    document.getElementById('closeImportModal')?.addEventListener('click', () => closeModal('importModal'));
    document.getElementById('cancelImportBtn')?.addEventListener('click', () => closeModal('importModal'));
    document.getElementById('excelFileInput')?.addEventListener('change', handleExcelFileSelect);
    document.getElementById('confirmImportBtn')?.addEventListener('click', handleConfirmImport);

    // Handlers globales expuestos
    window.viewProductUnits = viewProductUnits;
    window.editProduct = editProduct;
}

/**
 * Guardar o Actualizar Referencia
 */
async function handleSaveProduct(e) {
    e.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;

    const id = document.getElementById('formProductId').value;
    const internal_code = document.getElementById('formInternalCode').value.trim().toUpperCase();
    const part_number = document.getElementById('formPartNumber').value.trim().toUpperCase();
    const description = document.getElementById('formDescription').value.trim();
    const category = document.getElementById('formCategory').value.trim() || 'Repuestos';
    const brand = document.getElementById('formBrand').value.trim();
    const unit_of_measure = document.getElementById('formUnitOfMeasure').value;
    const min_stock = parseInt(document.getElementById('formMinStock').value, 10) || 0;
    const warehouse_location = document.getElementById('formWarehouseLocation').value.trim();
    const notes = document.getElementById('formNotes').value.trim();

    showLoading('Guardando referencia...');

    try {
        const payload = {
            internal_code,
            part_number,
            description,
            category,
            brand,
            unit_of_measure,
            min_stock,
            warehouse_location,
            notes
        };

        let res;
        if (id) {
            res = await supabase.from('products').update(payload).eq('id', id);
        } else {
            res = await supabase.from('products').insert([payload]);
        }

        if (res.error) {
            hideLoading();
            if (res.error.message.includes('uq_product_part_number')) {
                showToast('Ya existe un producto con este Número de Parte.', 'error');
            } else {
                showToast(`Error al guardar: ${res.error.message}`, 'error');
            }
            return;
        }

        hideLoading();
        closeModal('productModal');
        showToast(id ? 'Referencia actualizada correctamente.' : 'Nueva referencia creada.', 'success');
        await loadProducts();
    } catch (err) {
        hideLoading();
        showToast(`Error inesperado: ${err.message}`, 'error');
    }
}

/**
 * Cargar datos de referencia para editar
 */
async function editProduct(productId) {
    const prod = productsList.find(p => p.product_id === productId);
    if (!prod) return;

    document.getElementById('formProductId').value = prod.product_id;
    document.getElementById('formInternalCode').value = prod.internal_code || '';
    document.getElementById('formPartNumber').value = prod.part_number || '';
    document.getElementById('formDescription').value = prod.description || '';
    document.getElementById('formCategory').value = prod.category || '';
    document.getElementById('formBrand').value = prod.brand || '';
    document.getElementById('formUnitOfMeasure').value = prod.unit_of_measure || 'UND';
    document.getElementById('formMinStock').value = prod.min_stock || 0;
    document.getElementById('formWarehouseLocation').value = prod.warehouse_location || '';
    document.getElementById('formNotes').value = prod.notes || '';

    document.getElementById('productModalTitle').textContent = `Editar Referencia: ${prod.internal_code}`;
    openModal('productModal');
}

/**
 * Muestra el listado de unidades físicas individuales asociadas a un producto
 */
async function viewProductUnits(productId) {
    selectedProductId = productId;
    const prod = productsList.find(p => p.product_id === productId);
    if (!prod) return;

    document.getElementById('productUnitsTitle').textContent = `${prod.description}`;
    document.getElementById('productUnitsSubtitle').textContent = `Familia: ${prod.internal_code} | Part Number: ${prod.part_number}`;
    
    openModal('productUnitsModal');
    const tbody = document.getElementById('unitsTableBody');
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 2rem;">Cargando unidades físicas...</td></tr>`;

    const supabase = getSupabase();
    if (!supabase) return;

    try {
        const { data: units, error } = await supabase
            .from('inventory_units')
            .select('*')
            .eq('product_id', productId)
            .order('unit_code', { ascending: true });

        if (error) {
            tbody.innerHTML = `<tr><td colspan="4" style="color: var(--status-critical); text-align: center;">Error: ${error.message}</td></tr>`;
            return;
        }

        if (!units || units.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 2rem; color: var(--color-text-muted);">
                        No hay unidades físicas registradas para esta referencia todavía.<br>
                        Haga clic en <strong>"Registrar Unidad Físicamente"</strong> para ingresar sus stickers.
                    </td>
                </tr>
            `;
            return;
        }

        const renderUnits = (list) => {
            tbody.innerHTML = list.map(u => `
                <tr>
                    <td><strong class="code-pill">${u.unit_code}</strong></td>
                    <td>${getUnitStatusBadge(u.status)}</td>
                    <td>${formatDateTime(u.created_at)}</td>
                    <td>${formatDateTime(u.updated_at)}</td>
                </tr>
            `).join('');
        };

        renderUnits(units);

        // Búsqueda en vivo de sticker en la lista del modal
        const searchInput = document.getElementById('searchUnitCodeInput');
        if (searchInput) {
            searchInput.value = '';
            searchInput.oninput = () => {
                const query = searchInput.value.trim().toUpperCase();
                const filtered = units.filter(u => u.unit_code.includes(query));
                renderUnits(filtered);
            };
        }
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" style="color: var(--status-critical); text-align: center;">Error: ${err.message}</td></tr>`;
    }
}

// Variables temporales para la importación Excel
let parsedImportData = [];

/**
 * Procesa la selección del archivo Excel/CSV
 */
async function handleExcelFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const rawJson = await parseExcelFile(file);
        if (!rawJson || rawJson.length === 0) {
            showToast('El archivo no contiene filas de datos.', 'warning');
            return;
        }

        // Normalizar columnas según encabezados flexibles
        parsedImportData = rawJson.map(row => {
            const getVal = (...keys) => {
                for (const k of keys) {
                    for (const rk of Object.keys(row)) {
                        if (rk.trim().toLowerCase() === k.toLowerCase()) {
                            return String(row[rk]).trim();
                        }
                    }
                }
                return '';
            };

            return {
                internal_code: getVal('Familia', 'Codigo', 'Código', 'Codigo Interno', 'internal_code'),
                part_number: getVal('Part Number', 'Numero Parte', 'Número de Parte', 'part_number', 'P/N'),
                description: getVal('Descripcion', 'Descripción', 'description', 'Producto', 'Nombre'),
                category: getVal('Categoria', 'Categoría', 'category') || 'Repuestos',
                brand: getVal('Marca', 'brand', 'Fabricante'),
                unit_of_measure: getVal('Unidad', 'unit_of_measure', 'UM') || 'UND',
                min_stock: parseInt(getVal('Stock Minimo', 'Stock Mínimo', 'min_stock', 'Minimo'), 10) || 5,
                warehouse_location: getVal('Ubicacion', 'Ubicación', 'warehouse_location', 'Estante')
            };
        }).filter(item => item.part_number && item.description); // Filtra filas válidas

        if (parsedImportData.length === 0) {
            showToast('No se encontraron filas con "Part Number" y "Descripción" válidos.', 'error');
            document.getElementById('confirmImportBtn').disabled = true;
            return;
        }

        // Mostrar vista previa
        document.getElementById('importCount').textContent = parsedImportData.length;
        const previewBody = document.getElementById('importPreviewBody');
        previewBody.innerHTML = parsedImportData.slice(0, 10).map(row => `
            <tr>
                <td><span class="code-pill">${row.internal_code || '-'}</span></td>
                <td><strong>${row.part_number}</strong></td>
                <td>${row.description}</td>
                <td>${row.min_stock}</td>
            </tr>
        `).join('') + (parsedImportData.length > 10 ? `<tr><td colspan="4" style="text-align: center; color: var(--color-text-muted);">... y ${parsedImportData.length - 10} filas más</td></tr>` : '');

        document.getElementById('importPreviewContainer').style.display = 'block';
        document.getElementById('confirmImportBtn').disabled = false;
        showToast(`${parsedImportData.length} productos listos para importar.`, 'info');
    } catch (err) {
        showToast(`Error al leer archivo: ${err.message}`, 'error');
    }
}

/**
 * Confirma la inserción masiva a Supabase
 */
async function handleConfirmImport() {
    if (!parsedImportData || parsedImportData.length === 0) return;

    const supabase = getSupabase();
    if (!supabase) return;

    showLoading(`Importando ${parsedImportData.length} referencias a Supabase...`);

    try {
        // Upsert por part_number
        const { error } = await supabase
            .from('products')
            .upsert(parsedImportData, { onConflict: 'part_number' });

        hideLoading();

        if (error) {
            showToast(`Error en la importación: ${error.message}`, 'error');
            return;
        }

        closeModal('importModal');
        showToast(`¡Se importaron ${parsedImportData.length} referencias correctamente!`, 'success');
        parsedImportData = [];
        await loadProducts();
    } catch (err) {
        hideLoading();
        showToast(`Error inesperado: ${err.message}`, 'error');
    }
}
