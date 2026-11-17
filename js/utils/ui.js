/**
 * SISTEMA DE CONTROL DE ALMACÉN – INDUSTRAC S.A.C.
 * Utilidades de Interfaz de Usuario: Toasts, Modales, Diálogos y Formateadores
 */

// Contenedor dinámico de toasts
let toastContainer = null;

function ensureToastContainer() {
    if (!toastContainer) {
        toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }
    }
    return toastContainer;
}

/**
 * Muestra una notificación emergente (Toast)
 * @param {string} message Texto del mensaje
 * @param {'success' | 'error' | 'warning' | 'info'} type Tipo de toast
 * @param {number} duration Milisegundos visible
 */
export function showToast(message, type = 'info', duration = 3500) {
    const container = ensureToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
        iconSvg = `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
    } else if (type === 'error') {
        iconSvg = `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;
    } else if (type === 'warning') {
        iconSvg = `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
    } else {
        iconSvg = `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    }

    toast.innerHTML = `
        <div style="flex-shrink:0;">${iconSvg}</div>
        <div style="flex:1; word-break: break-word;">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Control de Modales
 */
export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

/**
 * Cuadro de confirmación modal
 * @param {string} title 
 * @param {string} message 
 * @param {string} confirmText 
 * @param {string} cancelText 
 * @returns {Promise<boolean>}
 */
export function showConfirm(title, message, confirmText = 'Confirmar', cancelText = 'Cancelar') {
    return new Promise((resolve) => {
        let confirmModal = document.getElementById('globalConfirmModal');
        if (!confirmModal) {
            confirmModal = document.createElement('div');
            confirmModal.id = 'globalConfirmModal';
            confirmModal.className = 'modal-backdrop';
            confirmModal.innerHTML = `
                <div class="modal-dialog" style="max-width: 440px;">
                    <div class="modal-header">
                        <h3 class="modal-title" id="globalConfirmTitle">Confirmación</h3>
                    </div>
                    <div class="modal-body">
                        <p id="globalConfirmMessage" style="font-size: 0.95rem; color: var(--color-text-main);"></p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" id="globalConfirmCancelBtn">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="globalConfirmOkBtn">Confirmar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(confirmModal);
        }

        const titleEl = document.getElementById('globalConfirmTitle');
        const msgEl = document.getElementById('globalConfirmMessage');
        const okBtn = document.getElementById('globalConfirmOkBtn');
        const cancelBtn = document.getElementById('globalConfirmCancelBtn');

        titleEl.textContent = title;
        msgEl.innerHTML = message;
        okBtn.textContent = confirmText;
        cancelBtn.textContent = cancelText;

        const cleanUp = () => {
            confirmModal.classList.remove('active');
            document.body.style.overflow = '';
            okBtn.onclick = null;
            cancelBtn.onclick = null;
        };

        okBtn.onclick = () => {
            cleanUp();
            resolve(true);
        };

        cancelBtn.onclick = () => {
            cleanUp();
            resolve(false);
        };

        confirmModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    });
}

/**
 * Indicador de Carga Global (Spinner)
 */
let loadingOverlay = null;

export function showLoading(text = 'Procesando operación...') {
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'globalLoadingOverlay';
        loadingOverlay.className = 'modal-backdrop active';
        loadingOverlay.style.zIndex = '3000';
        loadingOverlay.innerHTML = `
            <div style="background: white; padding: 2rem; border-radius: var(--radius-lg); display: flex; flex-direction: column; align-items: center; gap: 1rem; box-shadow: var(--shadow-lg);">
                <div style="width: 40px; height: 40px; border: 4px solid var(--color-border); border-top-color: var(--color-accent); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
                <div id="globalLoadingText" style="font-weight: 600; color: var(--color-primary-dark); font-size: 0.95rem;"></div>
            </div>
            <style>
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        `;
        document.body.appendChild(loadingOverlay);
    }
    document.getElementById('globalLoadingText').textContent = text;
    loadingOverlay.style.display = 'flex';
}

export function hideLoading() {
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

/**
 * Renderizador de Badges de Estado de Stock
 */
export function getStockStatusBadge(status) {
    switch (status) {
        case 'NORMAL':
            return `<span class="badge badge-normal">● Stock Normal</span>`;
        case 'PROXIMO':
            return `<span class="badge badge-proximo">▲ Próximo a Mínimo</span>`;
        case 'CRITICO':
            return `<span class="badge badge-critico">▼ Stock Crítico</span>`;
        case 'AGOTADO':
            return `<span class="badge badge-agotado">✖ Agotado</span>`;
        default:
            return `<span class="badge">${status || 'N/A'}</span>`;
    }
}

/**
 * Renderizador de Badges de Estado de Unidad
 */
export function getUnitStatusBadge(status) {
    if (status === 'DISPONIBLE') {
        return `<span class="badge badge-disponible">DISPONIBLE</span>`;
    } else if (status === 'RETIRADO') {
        return `<span class="badge badge-retirado">RETIRADO</span>`;
    }
    return `<span class="badge">${status}</span>`;
}

/**
 * Formateador de Fecha y Hora local
 */
export function formatDateTime(isoString) {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleString('es-PE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
}
