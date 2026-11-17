/**
 * SISTEMA DE CONTROL DE ALMACÉN – INDUSTRAC S.A.C.
 * Configuración central y conexión con Supabase Client
 */

// Configuración de Supabase
// Puedes configurar tus credenciales aquí o guardarlas desde la interfaz del sistema
export const SUPABASE_CONFIG = {
    // URL de tu proyecto Supabase (ej: https://xyzcompany.supabase.co)
    url: window.localStorage.getItem('INDUSTRAC_SUPABASE_URL') || '',
    // Clave anónima pública (anon key) de Supabase
    anonKey: window.localStorage.getItem('INDUSTRAC_SUPABASE_ANON_KEY') || ''
};

// Variable global del cliente
let supabaseClient = null;

/**
 * Obtiene o inicializa la instancia de Supabase
 */
export function getSupabase() {
    if (supabaseClient) return supabaseClient;

    const url = SUPABASE_CONFIG.url || window.localStorage.getItem('INDUSTRAC_SUPABASE_URL');
    const key = SUPABASE_CONFIG.anonKey || window.localStorage.getItem('INDUSTRAC_SUPABASE_ANON_KEY');

    if (!url || !key) {
        return null;
    }

    if (window.supabase) {
        supabaseClient = window.supabase.createClient(url, key, {
            auth: {
                persistSession: true,
                autoRefreshToken: true
            }
        });
        return supabaseClient;
    } else {
        console.error('El script de Supabase no ha cargado aún.');
        return null;
    }
}

/**
 * Guarda las credenciales de conexión en almacenamiento local seguro del navegador
 */
export function saveSupabaseCredentials(url, anonKey) {
    if (!url || !anonKey) return false;
    window.localStorage.setItem('INDUSTRAC_SUPABASE_URL', url.trim());
    window.localStorage.setItem('INDUSTRAC_SUPABASE_ANON_KEY', anonKey.trim());
    SUPABASE_CONFIG.url = url.trim();
    SUPABASE_CONFIG.anonKey = anonKey.trim();
    supabaseClient = null; // Reiniciar para que tome las nuevas credenciales
    return getSupabase();
}

/**
 * Limpia las credenciales almacenadas
 */
export function clearSupabaseCredentials() {
    window.localStorage.removeItem('INDUSTRAC_SUPABASE_URL');
    window.localStorage.removeItem('INDUSTRAC_SUPABASE_ANON_KEY');
    SUPABASE_CONFIG.url = '';
    SUPABASE_CONFIG.anonKey = '';
    supabaseClient = null;
}

