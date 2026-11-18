/**
 * SISTEMA DE CONTROL DE ALMACÉN – INDUSTRAC S.A.C.
 * Punto de Entrada Principal (App Bootstrap)
 */

import { getSupabase, SUPABASE_CONFIG, saveSupabaseCredentials } from './config.js';
import { initAuth, signIn, signUp, signOut, getCurrentUser, getCurrentProfile, isAdmin } from './auth.js';
import { initRouter } from './router.js';
import { showToast, openModal, closeModal, showLoading, hideLoading } from './utils/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    setupMobileMenu();
    setupConfigModal();
    setupAuthModal();
    checkConnectionStatus();

    // Inicializar Auth
    await initAuth((user, profile) => {
        updateUserUI(user, profile);
        checkConnectionStatus();
    });

    // Iniciar enrutador de vistas
    initRouter();
});

/**
 * Control del menú lateral en móviles
 */
function setupMobileMenu() {
    const menuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('appSidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (menuBtn && sidebar && overlay) {
        menuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
        });
    }
}

/**
 * Indicador visual de estado de conexión a Supabase
 */
function checkConnectionStatus() {
    const badge = document.getElementById('connectionStatusBadge');
    const text = document.getElementById('connectionStatusText');
    const supabase = getSupabase();

    if (supabase) {
        badge.classList.remove('disconnected');
        text.textContent = 'Supabase Conectado';
    } else {
        badge.classList.add('disconnected');
        text.textContent = 'Sin Conexión';
    }
}

/**
 * Actualiza la información del usuario en el encabezado
 */
function updateUserUI(user, profile) {
    const avatarEl = document.getElementById('userAvatar');
    const nameEl = document.getElementById('userDisplayName');
    const roleEl = document.getElementById('userDisplayRole');

    if (user) {
        const name = profile?.full_name || user.email.split('@')[0];
        const role = profile?.role || 'operador';
        avatarEl.textContent = name.charAt(0).toUpperCase();
        nameEl.textContent = name;
        roleEl.textContent = role;
    } else {
        avatarEl.textContent = 'U';
        nameEl.textContent = 'Iniciar Sesión';
        roleEl.textContent = 'Sin Conexión';
    }
}

/**
 * Modal de Configuración de Credenciales Supabase
 */
function setupConfigModal() {
    const configBtn = document.getElementById('btnSidebarConfig');
    const badgeBtn = document.getElementById('connectionStatusBadge');
    const closeBtn = document.getElementById('closeConfigModal');
    const cancelBtn = document.getElementById('cancelConfigBtn');
    const form = document.getElementById('configForm');

    const openConfig = () => {
        document.getElementById('cfgSupabaseUrl').value = window.localStorage.getItem('INDUSTRAC_SUPABASE_URL') || '';
        document.getElementById('cfgSupabaseAnonKey').value = window.localStorage.getItem('INDUSTRAC_SUPABASE_ANON_KEY') || '';
        openModal('configModal');
    };

    configBtn?.addEventListener('click', openConfig);
    badgeBtn?.addEventListener('click', openConfig);

    closeBtn?.addEventListener('click', () => closeModal('configModal'));
    cancelBtn?.addEventListener('click', () => closeModal('configModal'));

    form?.addEventListener('submit', (e) => {
        e.preventDefault();
        const url = document.getElementById('cfgSupabaseUrl').value;
        const key = document.getElementById('cfgSupabaseAnonKey').value;

        if (saveSupabaseCredentials(url, key)) {
            showToast('Credenciales guardadas correctamente. Conectando...', 'success');
            closeModal('configModal');
            checkConnectionStatus();
            setTimeout(() => window.location.reload(), 600);
        } else {
            showToast('Por favor ingrese una URL y Clave válidas.', 'error');
        }
    });
}

/**
 * Modal de Autenticación
 */
let isRegisterMode = false;

function setupAuthModal() {
    const profileBtn = document.getElementById('userProfileBtn');
    const closeBtn = document.getElementById('closeAuthModal');
    const form = document.getElementById('authLoginForm');
    const toggleLink = document.getElementById('toggleAuthModeLink');
    const logoutBtn = document.getElementById('btnLogout');

    profileBtn?.addEventListener('click', () => {
        const user = getCurrentUser();
        const profile = getCurrentProfile();

        if (user) {
            // Mostrar vista de sesión activa
            document.getElementById('authSessionActiveView').style.display = 'block';
            document.getElementById('authLoginForm').style.display = 'none';
            document.getElementById('authActiveAvatar').textContent = (profile?.full_name || user.email).charAt(0).toUpperCase();
            document.getElementById('authActiveEmail').textContent = user.email;
            document.getElementById('authActiveRole').textContent = `Rol: ${profile?.role || 'operador'}`;
            document.getElementById('authModalTitle').textContent = 'Perfil de Usuario';
        } else {
            document.getElementById('authSessionActiveView').style.display = 'none';
            document.getElementById('authLoginForm').style.display = 'block';
            setAuthMode(false);
        }
        openModal('authModal');
    });

    closeBtn?.addEventListener('click', () => closeModal('authModal'));

    toggleLink?.addEventListener('click', () => {
        setAuthMode(!isRegisterMode);
    });

    logoutBtn?.addEventListener('click', async () => {
        await signOut();
        closeModal('authModal');
        showToast('Sesión cerrada correctamente.', 'info');
        window.location.reload();
    });

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        showLoading(isRegisterMode ? 'Registrando cuenta...' : 'Iniciando sesión...');

        try {
            if (isRegisterMode) {
                const fullName = document.getElementById('registerFullName').value;
                await signUp(email, password, fullName);
                hideLoading();
                showToast('Cuenta creada con éxito. Puede iniciar sesión.', 'success');
                setAuthMode(false);
            } else {
                await signIn(email, password);
                hideLoading();
                closeModal('authModal');
                showToast('¡Bienvenido al Sistema INDUSTRAC!', 'success');
                window.location.reload();
            }
        } catch (err) {
            hideLoading();
            showToast(`Error de autenticación: ${err.message}`, 'error');
        }
    });
}

function setAuthMode(register) {
    isRegisterMode = register;
    const titleEl = document.getElementById('authModalTitle');
    const extraFields = document.getElementById('registerExtraFields');
    const submitBtn = document.getElementById('btnSubmitAuth');
    const toggleLink = document.getElementById('toggleAuthModeLink');
    const fullNameInput = document.getElementById('registerFullName');

    if (isRegisterMode) {
        titleEl.textContent = 'Crear Cuenta – INDUSTRAC';
        extraFields.style.display = 'block';
        fullNameInput.required = true;
        submitBtn.textContent = 'Registrarse';
        toggleLink.textContent = '¿Ya tienes una cuenta? Inicia sesión aquí';
    } else {
        titleEl.textContent = 'Iniciar Sesión – INDUSTRAC';
        extraFields.style.display = 'none';
        fullNameInput.required = false;
        submitBtn.textContent = 'Ingresar al Sistema';
        toggleLink.textContent = '¿Nuevo usuario? Regístrate aquí';
    }
}

