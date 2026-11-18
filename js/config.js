/**
 * SISTEMA DE CONTROL DE ALMACÉN – INDUSTRAC S.A.C.
 * Configuración central y conexión con Supabase Client
 */

// Configuración de Supabase
// Credenciales oficiales de INDUSTRAC Almacén
export const SUPABASE_CONFIG = {
    // URL oficial del proyecto Supabase
    url: (window.localStorage.getItem('INDUSTRAC_SUPABASE_URL') || 'https://hkenmxtwlguapsjbwwhv.supabase.co')
        .trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, ''),
    // Clave pública oficial (Publishable / Anon Key)
    anonKey: (window.localStorage.getItem('INDUSTRAC_SUPABASE_ANON_KEY') || 'sb_publishable_3Gcb3fzYLWS69zjNYNVnVg_atYJ_Vr0').trim()
};

// Variable global del cliente
let supabaseClient = null;

/**
 * Obtiene o inicializa la instancia de Supabase
 */
export function getSupabase() {
    if (supabaseClient) return supabaseClient;

    const rawUrl = SUPABASE_CONFIG.url || window.localStorage.getItem('INDUSTRAC_SUPABASE_URL') || 'https://hkenmxtwlguapsjbwwhv.supabase.co';
    const rawKey = SUPABASE_CONFIG.anonKey || window.localStorage.getItem('INDUSTRAC_SUPABASE_ANON_KEY') || 'sb_publishable_3Gcb3fzYLWS69zjNYNVnVg_atYJ_Vr0';

    const url = rawUrl.trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
    const key = rawKey ? rawKey.trim() : '';

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
    const cleanUrl = url.trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
    const cleanKey = anonKey.trim();

    window.localStorage.setItem('INDUSTRAC_SUPABASE_URL', cleanUrl);
    window.localStorage.setItem('INDUSTRAC_SUPABASE_ANON_KEY', cleanKey);
    SUPABASE_CONFIG.url = cleanUrl;
    SUPABASE_CONFIG.anonKey = cleanKey;
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

