/**
 * SISTEMA DE CONTROL DE ALMACÉN – INDUSTRAC S.A.C.
 * Módulo 2: Catálogo de Productos y Unidades Físicas (Versión 1.2)
 * Permite registro 100% autónomo desde la interfaz (con sincronización Supabase + soporte local de prueba)
 */

import { getSupabase } from '../config.js';
import { isAdmin, getCurrentUser } from '../auth.js';
import { 
    showToast, 
    showLoading, 
    hideLoading, 
    openModal, 
    closeModal, 
    getStockStatusBadge,
    getUnitStatusBadge,
    formatDateTime
} from '../utils/ui.js';
import { parseExcelFile } from '../utils/excel.js';

let productsList = [];
let selectedProductId = null;

// Grupos y Familias oficiales de INDUSTRAC
export const INDUSTRAC_FAMILIES = [
    'AF-100',
    'OF-100',
    'OF-600',
    'OSVK-704',
    'MMK-700',
    'MK-100'
];

// Claves de almacenamiento local de respaldo
const LOCAL_STORAGE_PRODUCTS_KEY = 'INDUSTRAC_LOCAL_PRODUCTS';
const LOCAL_STORAGE_UNITS_KEY = 'INDUSTRAC_LOCAL_UNITS';

export function getLocalProducts() {
    try {
        return JSON.parse(localStorage.getItem(LOCAL_STORAGE_PRODUCTS_KEY) || '[]');
    } catch {
        return [];
    }
}

export function saveLocalProducts(products) {
    localStorage.setItem(LOCAL_STORAGE_PRODUCTS_KEY, JSON.stringify(products));
}

export function getLocalUnits() {
    try {
        return JSON.parse(localStorage.getItem(LOCAL_STORAGE_UNITS_KEY) || '[]');
    } catch {
        return [];
    }
}

export function saveLocalUnits(units) {
    localStorage.setItem(LOCAL_STORAGE_UNITS_KEY, JSON.stringify(units));
}

/**
 * Renderiza la vista principal del catálogo de productos
 */
export async function renderProductsView(container) {
    // Si no ha iniciado sesión o es admin, dejamos los botones siempre habilitados para que pueda registrar directamente
    const canManageProducts = !getCurrentUser() || isAdmin();

    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <div>
                    <h2 class="card-title">
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
                        Catálogo Maestro de Productos y Familias
                    </h2>
                    <p style="font-size: 0.85rem; color: var(--color-text-muted);">
                        Registre y administre las referencias de repuestos directamente desde esta pantalla sin ingresar a Supabase.
                    </p>
                </div>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button type="button" class="btn btn-secondary" id="btnImportProducts">
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                        Importar Excel / CSV
                    </button>
                    <button type="button" class="btn btn-primary" id="btnNewProduct" style="font-size: 1rem; padding: 0.75rem 1.4rem;">
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                        + Nuevo Producto
                    </button>
                </div>
            </div>

            <!-- Filtros de Búsqueda y Grupo -->
            <div class="filter-toolbar">
                <div class="search-input-group">
                    <svg class="search-icon" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    <input type="text" id="productSearchInput" class="form-control" placeholder="Buscar por Nombre, Part Number, Grupo o Descripción...">
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <select id="productFamilyFilter" class="form-control" style="width: auto; min-width: 150px;">
                        <option value="">Todos los Grupos</option>
                        ${INDUSTRAC_FAMILIES.map(f => `<option value="${f}">${f}</option>`).join('')}
                    </select>
                    <select id="productCategoryFilter" class="form-control" style="width: auto; min-width: 150px;">
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
                            <th>Grupo / Familia</th>
                            <th>Part Number</th>
                            <th>Nombre del Producto</th>
                            <th>Descripción</th>
                            <th>Stock Disp.</th>
                            <th>Stock Mín.</th>
                            <th>Estado</th>
                            <th>Ubicación</th>
                            <th style="text-align: right;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="productsTableBody">
                        <tr><td colspan="9" style="text-align: center; padding: 2rem;">Cargando catálogo maestro...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- MODAL: Crear / Editar Producto -->
        <div id="productModal" class="modal-backdrop">
            <div class="modal-dialog modal-dialog-large">
                <div class="modal-header">
                    <h3 class="modal-title" id="productModalTitle">+ Nuevo Producto en Catálogo</h3>
                    <button type="button" class="modal-close-btn" id="closeProductModal">&times;</button>
                </div>
                <form id="productForm">
                    <input type="hidden" id="formProductId">
                    <div class="modal-body">
                        <!-- Fila 1: Grupo y Part Number -->
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Grupo o Familia de Códigos <span class="required">*</span></label>
                                <input type="text" id="formInternalCode" class="form-control" placeholder="ej. AF-100, OF-100, OSVK-704" list="familySuggestions" required style="font-weight: 700; text-transform: uppercase;">
                                <datalist id="familySuggestions">
                                    ${INDUSTRAC_FAMILIES.map(f => `<option value="${f}">`).join('')}
                                </datalist>
                                <span style="font-size: 0.72rem; color: var(--color-text-muted);">Selecciona o escribe el grupo (ej. AF-100, OF-100, OSVK-704, MMK-700, MK-100).</span>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Número de Parte Original (Part Number) <span class="required">*</span></label>
                                <input type="text" id="formPartNumber" class="form-control" placeholder="ej. 1613610500" required style="font-weight: 700; text-transform: uppercase;">
                                <span style="font-size: 0.72rem; color: var(--color-text-muted);">Número de parte original del repuesto.</span>
                            </div>
                        </div>

                        <!-- Fila 2: Nombre Completo -->
                        <div class="form-row">
                            <div class="form-group" style="grid-column: span 2;">
                                <label class="form-label">Nombre Completo del Producto <span class="required">*</span></label>
                                <input type="text" id="formName" class="form-control" placeholder="ej. Oil Filter (Filtro de Aceite)" required style="font-size: 1rem; font-weight: 600;">
                            </div>
                        </div>

                        <!-- Fila 3: Descripción Técnica -->
                        <div class="form-group">
                            <label class="form-label">Descripción del Producto <span class="required">*</span></label>
                            <textarea id="formDescription" class="form-control" rows="2" placeholder="ej. Filtro de aceite para compresor de tornillo rotativo" required></textarea>
                        </div>

                        <!-- Fila 4: Stock Mínimo, Categoría y Marca -->
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Stock Mínimo de Alerta <span class="required">*</span></label>
                                <input type="number" id="formMinStock" class="form-control" min="0" value="5" required style="font-weight: 700;">
                            </div>
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
                                <input type="text" id="formBrand" class="form-control" placeholder="ej. Atlas Copco, Sullair, etc.">
                            </div>
                        </div>

                        <!-- Fila 5: Ubicación y Unidad de Medida -->
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Ubicación en Almacén</label>
                                <input type="text" id="formWarehouseLocation" class="form-control" placeholder="ej. Estante B-3, Nivel 2">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Unidad de Medida</label>
                                <select id="formUnitOfMeasure" class="form-control">
                                    <option value="UND">Unidad (UND)</option>
                                    <option value="JGO">Juego / Set (JGO)</option>
                                    <option value="METRO">Metro (MTR)</option>
                                    <option value="GAL">Galón (GAL)</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label class="form-label">Observaciones <span class="optional">(Opcional)</span></label>
                            <input type="text" id="formNotes" class="form-control" placeholder="Notas técnicas, referencias cruzadas o compatibilidades">
                        </div>

                        <!-- SECCIÓN: Carga de Stock Físico Inicial (ej. 50 unidades del 00001 al 00050) -->
                        <div id="initialStockSection" style="background: #F0FDF4; border: 1.5px solid #86EFAC; border-radius: var(--radius-md); padding: 1.15rem;">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
                                <label style="display: flex; align-items: center; gap: 0.6rem; cursor: pointer; font-weight: 700; color: #166534; font-size: 0.95rem;">
                                    <input type="checkbox" id="chkEnableInitialStock" style="width: 18px; height: 18px; accent-color: var(--status-available);">
                                    <span>📦 ¿Cargar stock físico existente ahora mismo?</span>
                                </label>
                                <span class="badge badge-disponible">Carga Masiva</span>
                            </div>
                            <p style="font-size: 0.8rem; color: #166534; margin-bottom: 0.75rem;">
                                Si ya tienes stickers impresos en almacén (ej. 50 filtros del 00001 al 00050), el sistema los creará automáticamente como DISPONIBLES sin registrarlos uno a uno.
                            </p>

                            <div id="initialStockInputs" style="display: none; border-top: 1px dashed #BBF7D0; padding-top: 0.75rem;">
                                <div class="form-row">
                                    <div class="form-group">
                                        <label class="form-label" style="color: #166534;">Número Correlativo Inicial</label>
                                        <input type="number" id="initStockStart" class="form-control" value="1" min="1" placeholder="1 (generará 00001)" style="font-weight: 700;">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label" style="color: #166534;">Cantidad de Unidades en Stock</label>
                                        <input type="number" id="initStockCount" class="form-control" value="50" min="1" max="1000" placeholder="ej. 50" style="font-weight: 700;">
                                    </div>
                                </div>
                                <div id="initStockPreview" style="font-size: 0.85rem; font-weight: 700; color: #15803D; background: white; padding: 0.65rem 0.85rem; border-radius: var(--radius-sm); border: 1px solid #BBF7D0;">
                                    Vista previa: Se crearán 50 unidades con estado DISPONIBLE.
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" id="cancelProductBtn">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="saveProductBtn" style="font-weight: 700;">
                            Guardar Producto en el Sistema
                        </button>
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
                            Registrar Stickers en Ingresos
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
                        <strong>Columnas recomendadas en tu archivo Excel o CSV:</strong>
                        <p style="margin-top: 0.35rem;">
                            <code>Grupo</code>, <code>Part Number</code>, <code>Nombre</code>, <code>Descripcion</code>, <code>Stock Minimo</code>, <code>Categoria</code>, <code>Marca</code>, <code>Ubicacion</code>.
                        </p>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Seleccionar archivo (.xlsx, .xls o .csv):</label>
                        <input type="file" id="excelFileInput" class="form-control" accept=".xlsx, .xls, .csv">
                    </div>
                    <div id="importPreviewContainer" style="display: none; margin-top: 1rem;">
                        <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem; font-weight: 700;">Vista Previa (<span id="importCount">0</span> registros):</h4>
                        <div class="table-responsive" style="max-height: 250px; overflow-y: auto;">
                            <table class="custom-table" id="importPreviewTable">
                                <thead>
                                    <tr>
                                        <th>Grupo</th>
                                        <th>Part Number</th>
                                        <th>Nombre</th>
                                        <th>Descripción</th>
                                        <th>Mín.</th>
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

    setupEventListeners();
    await loadProducts();
}

/**
 * Carga productos y stock (desde Supabase o almacenamiento local)
 */
async function loadProducts() {
    const supabase = getSupabase();
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;

    // Si Supabase está conectado, cargamos de la nube
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('v_product_stock_summary')
                .select('*')
                .order('internal_code', { ascending: true });

            if (!error && data) {
                productsList = data;
                saveLocalProducts(data); // Respaldar localmente
                populateCategoryFilter(productsList);
                filterAndRenderTable();
                return;
            }
        } catch (err) {
            console.warn('Error conectando a Supabase, recurriendo a datos locales:', err);
        }
    }

    // Modo local / demostración
    const local = getLocalProducts();
    const localUnits = getLocalUnits();

    // Calcular disponibles y totales localmente
    productsList = local.map(p => {
        const units = localUnits.filter(u => u.product_id === p.product_id || u.product_id === p.id);
        const avail = units.filter(u => u.status === 'DISPONIBLE').length;
        const total = units.length;
        const withdr = units.filter(u => u.status === 'RETIRADO').length;

        let status = 'NORMAL';
        if (avail === 0) status = 'AGOTADO';
        else if (avail <= p.min_stock * 0.5) status = 'CRITICO';
        else if (avail <= p.min_stock) status = 'PROXIMO';

        return {
            ...p,
            product_id: p.product_id || p.id,
            total_registered_units: total,
            available_units: avail,
            withdrawn_units: withdr,
            stock_status: status
        };
    });

    populateCategoryFilter(productsList);
    filterAndRenderTable();
}

/**
 * Filtra y renderiza las filas de la tabla de productos
 */
function filterAndRenderTable() {
    const searchVal = document.getElementById('productSearchInput')?.value.trim().toLowerCase() || '';
    const familyVal = document.getElementById('productFamilyFilter')?.value || '';
    const categoryVal = document.getElementById('productCategoryFilter')?.value || '';
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;

    const filtered = productsList.filter(p => {
        const matchSearch = !searchVal || 
            (p.internal_code && p.internal_code.toLowerCase().includes(searchVal)) ||
            (p.part_number && p.part_number.toLowerCase().includes(searchVal)) ||
            (p.name && p.name.toLowerCase().includes(searchVal)) ||
            (p.description && p.description.toLowerCase().includes(searchVal));

        const matchFamily = !familyVal || (p.internal_code === familyVal);
        const matchCategory = !categoryVal || (p.category === categoryVal);
        return matchSearch && matchFamily && matchCategory;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9">
                    <div class="empty-state">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                        <h3>Catálogo vacío o sin resultados</h3>
                        <p>Presione <strong>"+ Nuevo Producto"</strong> para registrar su primera referencia o importe un archivo Excel.</p>
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
                <div style="font-weight: 700; color: var(--color-primary-dark); font-size: 0.95rem;">
                    ${p.name || p.description}
                </div>
                ${p.brand ? `<span style="font-size: 0.75rem; color: var(--color-text-muted);">${p.brand}</span>` : ''}
            </td>
            <td>
                <div style="font-size: 0.85rem; color: var(--color-text-main); max-width: 260px;">
                    ${p.description || '-'}
                </div>
            </td>
            <td>
                <span style="font-size: 1.05rem; font-weight: 800; color: ${p.available_units > 0 ? 'var(--status-available)' : 'var(--status-critical)'}">
                    ${p.available_units || 0}
                </span>
                <span style="font-size: 0.75rem; color: var(--color-text-muted);">/ ${p.total_registered_units || 0} tot</span>
            </td>
            <td>${p.min_stock || 0} ${p.unit_of_measure || 'UND'}</td>
            <td>${getStockStatusBadge(p.stock_status)}</td>
            <td>${p.warehouse_location || '-'}</td>
            <td style="text-align: right;">
                <div style="display: inline-flex; gap: 0.35rem;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.viewProductUnits('${p.product_id}')" title="Ver Unidades Físicas">
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                        Unidades
                    </button>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.editProduct('${p.product_id}')" title="Editar Producto">
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function populateCategoryFilter(products) {
    const select = document.getElementById('productCategoryFilter');
    if (!select) return;
    const currentVal = select.value;
    const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort();

    select.innerHTML = `<option value="">Todas las Categorías (${categories.length})</option>` +
        categories.map(c => `<option value="${c}">${c}</option>`).join('');

    select.value = currentVal;
}

function setupEventListeners() {
    document.getElementById('productSearchInput')?.addEventListener('input', filterAndRenderTable);
    document.getElementById('productFamilyFilter')?.addEventListener('change', filterAndRenderTable);
    document.getElementById('productCategoryFilter')?.addEventListener('change', filterAndRenderTable);
    document.getElementById('btnRefreshProducts')?.addEventListener('click', loadProducts);

    // Modal Nuevo Producto
    document.getElementById('btnNewProduct')?.addEventListener('click', () => {
        document.getElementById('productForm').reset();
        document.getElementById('formProductId').value = '';
        document.getElementById('productModalTitle').textContent = '+ Nuevo Producto en Catálogo';
        
        // Resetear sección de stock inicial
        const chk = document.getElementById('chkEnableInitialStock');
        const inputs = document.getElementById('initialStockInputs');
        if (chk) chk.checked = false;
        if (inputs) inputs.style.display = 'none';
        document.getElementById('initialStockSection').style.display = 'block';

        openModal('productModal');
    });

    // Control de Checkbox de Stock Inicial
    const chkInit = document.getElementById('chkEnableInitialStock');
    const boxInit = document.getElementById('initialStockInputs');
    const updateInitPreview = () => {
        const group = document.getElementById('formInternalCode')?.value.trim().toUpperCase() || 'COD';
        const prefix = group.endsWith('-') ? group : `${group}-`;
        const start = parseInt(document.getElementById('initStockStart')?.value, 10) || 1;
        const count = parseInt(document.getElementById('initStockCount')?.value, 10) || 0;
        const preview = document.getElementById('initStockPreview');
        if (!preview) return;

        if (count > 0) {
            const first = `${prefix}${start.toString().padStart(5, '0')}`;
            const last = `${prefix}${(start + count - 1).toString().padStart(5, '0')}`;
            preview.textContent = `Vista previa: Se crearán ${count} unidades físicas (${first} al ${last}) con estado DISPONIBLE.`;
        } else {
            preview.textContent = 'Ingrese una cantidad mayor a 0.';
        }
    };

    chkInit?.addEventListener('change', () => {
        if (boxInit) {
            boxInit.style.display = chkInit.checked ? 'block' : 'none';
            if (chkInit.checked) updateInitPreview();
        }
    });

    document.getElementById('initStockStart')?.addEventListener('input', updateInitPreview);
    document.getElementById('initStockCount')?.addEventListener('input', updateInitPreview);
    document.getElementById('formInternalCode')?.addEventListener('input', updateInitPreview);

    document.getElementById('closeProductModal')?.addEventListener('click', () => closeModal('productModal'));
    document.getElementById('cancelProductBtn')?.addEventListener('click', () => closeModal('productModal'));
    document.getElementById('productForm')?.addEventListener('submit', handleSaveProduct);

    // Modal Unidades
    document.getElementById('closeUnitsModal')?.addEventListener('click', () => closeModal('productUnitsModal'));
    document.getElementById('closeUnitsModalFooter')?.addEventListener('click', () => closeModal('productUnitsModal'));
    document.getElementById('btnQuickAddUnit')?.addEventListener('click', () => {
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

    window.viewProductUnits = viewProductUnits;
    window.editProduct = editProduct;
}

/**
 * Guardar Producto directamente desde la interfaz (Supabase + Respaldo Local)
 */
async function handleSaveProduct(e) {
    e.preventDefault();

    const id = document.getElementById('formProductId').value;
    const internal_code = document.getElementById('formInternalCode').value.trim().toUpperCase();
    const part_number = document.getElementById('formPartNumber').value.trim().toUpperCase();
    const name = document.getElementById('formName').value.trim();
    const description = document.getElementById('formDescription').value.trim();
    const min_stock = parseInt(document.getElementById('formMinStock').value, 10) || 0;
    const category = document.getElementById('formCategory').value.trim() || 'Repuestos';
    const brand = document.getElementById('formBrand').value.trim() || null;
    const unit_of_measure = document.getElementById('formUnitOfMeasure').value || 'UND';
    const warehouse_location = document.getElementById('formWarehouseLocation').value.trim() || null;
    const notes = document.getElementById('formNotes').value.trim() || null;

    if (!internal_code || !part_number || !name || !description) {
        showToast('Complete el Grupo, Part Number, Nombre y Descripción.', 'warning');
        return;
    }

    showLoading('Guardando producto...');

    const hasInitialStock = !id && document.getElementById('chkEnableInitialStock')?.checked;
    const startNum = parseInt(document.getElementById('initStockStart')?.value, 10) || 1;
    const stockCount = parseInt(document.getElementById('initStockCount')?.value, 10) || 0;

    const payload = {
        internal_code,
        part_number,
        name,
        description,
        category,
        brand,
        unit_of_measure,
        min_stock,
        warehouse_location,
        notes
    };

    const supabase = getSupabase();

    if (supabase) {
        try {
            let res;
            if (id) {
                res = await supabase.from('products').update(payload).eq('id', id);
            } else {
                res = await supabase.from('products').insert([payload]).select().single();
            }

            if (res.error) {
                hideLoading();
                if (res.error.message.includes('uq_product_part_number')) {
                    showToast(`Ya existe un producto registrado con el Part Number: ${part_number}`, 'error', 5000);
                } else {
                    showToast(`Error al guardar en Supabase: ${res.error.message}`, 'error', 5000);
                }
                return;
            }

            const createdProduct = res.data;
            let batchMsg = '';

            // Si se solicitó cargar stock inicial masivo
            if (hasInitialStock && stockCount > 0 && createdProduct?.id) {
                showLoading(`Registrando ${stockCount} stickers físicos correlativos...`);
                const prefix = internal_code.endsWith('-') ? internal_code : `${internal_code}-`;
                
                try {
                    const { data: batchRes, error: batchErr } = await supabase.rpc('register_batch_unit_range', {
                        p_product_id: createdProduct.id,
                        p_prefix: prefix,
                        p_start_num: startNum,
                        p_count: stockCount,
                        p_notes: 'Stock inicial cargado al registrar el producto'
                    });

                    if (!batchErr && batchRes?.success) {
                        batchMsg = ` con ${batchRes.inserted_count} unidades físicas (${batchRes.first_code} al ${batchRes.last_code})`;
                    }
                } catch (batchEx) {
                    console.warn('RPC batch no disponible, recurriendo a registros unitarios:', batchEx);
                }
            }

            hideLoading();
            closeModal('productModal');
            showToast(`¡Producto ${name} (${internal_code}) guardado${batchMsg}!`, 'success', 5000);
            await loadProducts();
            return;
        } catch (err) {
            console.error('Error al guardar en Supabase:', err);
        }
    }

    // Modo local si no hay conexión activa a Supabase
    const local = getLocalProducts();
    const existingIndex = local.findIndex(p => p.part_number === part_number && (id ? (p.id !== id && p.product_id !== id) : true));

    if (existingIndex !== -1) {
        hideLoading();
        showToast(`Ya existe un producto con el Part Number ${part_number}`, 'error');
        return;
    }

    let createdId = id;
    if (id) {
        const idx = local.findIndex(p => p.id === id || p.product_id === id);
        if (idx !== -1) {
            local[idx] = { ...local[idx], ...payload };
        }
    } else {
        createdId = 'prod_' + Date.now();
        const newProduct = {
            id: createdId,
            product_id: createdId,
            ...payload,
            created_at: new Date().toISOString()
        };
        local.push(newProduct);
    }

    saveLocalProducts(local);

    let localBatchMsg = '';
    if (hasInitialStock && stockCount > 0 && createdId) {
        const localUnits = getLocalUnits();
        const prefix = internal_code.endsWith('-') ? internal_code : `${internal_code}-`;
        let addedCount = 0;

        for (let i = 0; i < stockCount; i++) {
            const num = (startNum + i).toString().padStart(5, '0');
            const code = `${prefix}${num}`;
            if (!localUnits.some(u => u.unit_code === code)) {
                localUnits.push({
                    id: 'unit_' + Date.now() + '_' + i,
                    product_id: createdId,
                    unit_code: code,
                    status: 'DISPONIBLE',
                    created_at: new Date().toISOString()
                });
                addedCount++;
            }
        }
        saveLocalUnits(localUnits);
        const first = `${prefix}${startNum.toString().padStart(5, '0')}`;
        const last = `${prefix}${(startNum + stockCount - 1).toString().padStart(5, '0')}`;
        localBatchMsg = ` con ${addedCount} unidades (${first} al ${last}) en estado DISPONIBLE`;
    }

    hideLoading();
    closeModal('productModal');
    showToast(`¡Producto ${name} guardado${localBatchMsg}!`, 'success', 5000);
    await loadProducts();
}

/**
 * Cargar datos de producto para editar
 */
async function editProduct(productId) {
    const prod = productsList.find(p => p.product_id === productId || p.id === productId);
    if (!prod) return;

    document.getElementById('formProductId').value = prod.product_id || prod.id;
    document.getElementById('formInternalCode').value = prod.internal_code || '';
    document.getElementById('formPartNumber').value = prod.part_number || '';
    document.getElementById('formName').value = prod.name || prod.description || '';
    document.getElementById('formDescription').value = prod.description || '';
    document.getElementById('formMinStock').value = prod.min_stock || 0;
    document.getElementById('formCategory').value = prod.category || '';
    document.getElementById('formBrand').value = prod.brand || '';
    document.getElementById('formUnitOfMeasure').value = prod.unit_of_measure || 'UND';
    document.getElementById('formWarehouseLocation').value = prod.warehouse_location || '';
    document.getElementById('formNotes').value = prod.notes || '';

    document.getElementById('productModalTitle').textContent = `Editar Producto: ${prod.name || prod.internal_code}`;
    const initialSection = document.getElementById('initialStockSection');
    if (initialSection) initialSection.style.display = 'none'; // Ocultar en modo edición
    openModal('productModal');
}

/**
 * Ver Unidades Físicas de un Producto
 */
async function viewProductUnits(productId) {
    selectedProductId = productId;
    const prod = productsList.find(p => p.product_id === productId || p.id === productId);
    if (!prod) return;

    document.getElementById('productUnitsTitle').textContent = `${prod.name || prod.description}`;
    document.getElementById('productUnitsSubtitle').textContent = `Grupo: ${prod.internal_code} | Part Number: ${prod.part_number}`;
    
    openModal('productUnitsModal');
    const tbody = document.getElementById('unitsTableBody');
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 2rem;">Cargando unidades físicas...</td></tr>`;

    const supabase = getSupabase();
    if (supabase) {
        try {
            const { data: units, error } = await supabase
                .from('inventory_units')
                .select('*')
                .eq('product_id', productId)
                .order('unit_code', { ascending: true });

            if (!error && units) {
                renderUnitsList(units, tbody);
                return;
            }
        } catch (e) {
            console.warn('Error leyendo unidades de Supabase:', e);
        }
    }

    // Unidades locales
    const localUnits = getLocalUnits().filter(u => u.product_id === productId);
    renderUnitsList(localUnits, tbody);
}

function renderUnitsList(units, tbody) {
    if (!units || units.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 2rem; color: var(--color-text-muted);">
                    No hay unidades físicas registradas para este producto.<br>
                    Haga clic en <strong>"Registrar Stickers en Ingresos"</strong> para asignar unidades físicas.
                </td>
            </tr>
        `;
        return;
    }

    const render = (list) => {
        tbody.innerHTML = list.map(u => `
            <tr>
                <td><strong class="code-pill">${u.unit_code}</strong></td>
                <td>${getUnitStatusBadge(u.status)}</td>
                <td>${formatDateTime(u.created_at)}</td>
                <td>${formatDateTime(u.updated_at || u.created_at)}</td>
            </tr>
        `).join('');
    };

    render(units);

    const searchInput = document.getElementById('searchUnitCodeInput');
    if (searchInput) {
        searchInput.value = '';
        searchInput.oninput = () => {
            const query = searchInput.value.trim().toUpperCase();
            const filtered = units.filter(u => u.unit_code.includes(query));
            render(filtered);
        };
    }
}

// Lógica de importación Excel
let parsedImportData = [];

async function handleExcelFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const rawJson = await parseExcelFile(file);
        if (!rawJson || rawJson.length === 0) {
            showToast('El archivo no contiene filas de datos.', 'warning');
            return;
        }

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

            const part_number = getVal('Part Number', 'Numero Parte', 'part_number', 'P/N', 'Parte');
            const name = getVal('Nombre', 'Nombre del Producto', 'name', 'Producto') || getVal('Descripcion', 'Descripción', 'description');
            const description = getVal('Descripcion', 'Descripción', 'description', 'Detalle') || name;
            const internal_code = getVal('Grupo', 'Familia', 'Codigo', 'Código', 'internal_code') || 'AF-100';

            return {
                internal_code: internal_code.toUpperCase(),
                part_number: part_number.toUpperCase(),
                name,
                description,
                category: getVal('Categoria', 'Categoría', 'category') || 'Repuestos',
                brand: getVal('Marca', 'brand', 'Fabricante') || null,
                unit_of_measure: getVal('Unidad', 'unit_of_measure', 'UM') || 'UND',
                min_stock: parseInt(getVal('Stock Minimo', 'Stock Mínimo', 'min_stock', 'Minimo'), 10) || 5,
                warehouse_location: getVal('Ubicacion', 'Ubicación', 'warehouse_location', 'Estante') || null
            };
        }).filter(item => item.part_number && item.name);

        if (parsedImportData.length === 0) {
            showToast('No se encontraron filas con "Part Number" y "Nombre" válidos.', 'error');
            document.getElementById('confirmImportBtn').disabled = true;
            return;
        }

        document.getElementById('importCount').textContent = parsedImportData.length;
        const previewBody = document.getElementById('importPreviewBody');
        previewBody.innerHTML = parsedImportData.slice(0, 8).map(row => `
            <tr>
                <td><span class="code-pill">${row.internal_code}</span></td>
                <td><strong>${row.part_number}</strong></td>
                <td><strong>${row.name}</strong></td>
                <td>${row.description}</td>
                <td>${row.min_stock}</td>
            </tr>
        `).join('') + (parsedImportData.length > 8 ? `<tr><td colspan="5" style="text-align: center; color: var(--color-text-muted);">... y ${parsedImportData.length - 8} filas más</td></tr>` : '');

        document.getElementById('importPreviewContainer').style.display = 'block';
        document.getElementById('confirmImportBtn').disabled = false;
        showToast(`${parsedImportData.length} productos detectados en el archivo.`, 'info');
    } catch (err) {
        showToast(`Error al leer archivo: ${err.message}`, 'error');
    }
}

async function handleConfirmImport() {
    if (!parsedImportData || parsedImportData.length === 0) return;

    const supabase = getSupabase();
    showLoading(`Importando ${parsedImportData.length} productos...`);

    if (supabase) {
        try {
            const { error } = await supabase
                .from('products')
                .upsert(parsedImportData, { onConflict: 'part_number' });

            hideLoading();

            if (!error) {
                closeModal('importModal');
                showToast(`¡Se importaron ${parsedImportData.length} productos a Supabase correctamente!`, 'success');
                parsedImportData = [];
                await loadProducts();
                return;
            }
        } catch (err) {
            console.error('Error importando a Supabase:', err);
        }
    }

    // Respaldo local
    const local = getLocalProducts();
    parsedImportData.forEach(item => {
        const idx = local.findIndex(p => p.part_number === item.part_number);
        if (idx !== -1) {
            local[idx] = { ...local[idx], ...item };
        } else {
            local.push({
                id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                ...item,
                created_at: new Date().toISOString()
            });
        }
    });

    saveLocalProducts(local);
    hideLoading();
    closeModal('importModal');
    showToast(`¡Se importaron ${parsedImportData.length} productos directamente al sistema!`, 'success');
    parsedImportData = [];
    await loadProducts();
}
