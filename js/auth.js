/**
 * SISTEMA DE CONTROL DE ALMACÉN – INDUSTRAC S.A.C.
 * Módulo de Autenticación y Control de Roles (Supabase Auth & Profiles)
 */

import { getSupabase } from './config.js';
import { showToast } from './utils/ui.js';

let currentUser = null;
let currentProfile = null;

/**
 * Inicializa el observador de estado de autenticación
 * @param {Function} onAuthChange Callback ejecutado cuando cambia la sesión
 */
export async function initAuth(onAuthChange) {
    const supabase = getSupabase();
    if (!supabase) {
        if (onAuthChange) onAuthChange(null, null);
        return;
    }

    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) console.error('Error recuperando sesión:', error);

        if (session && session.user) {
            currentUser = session.user;
            currentProfile = await fetchProfile(currentUser.id);
        } else {
            currentUser = null;
            currentProfile = null;
        }

        if (onAuthChange) onAuthChange(currentUser, currentProfile);

        // Suscribirse a cambios futuros
        supabase.auth.onAuthStateChange(async (event, session) => {
            if (session && session.user) {
                currentUser = session.user;
                currentProfile = await fetchProfile(currentUser.id);
            } else {
                currentUser = null;
                currentProfile = null;
            }
            if (onAuthChange) onAuthChange(currentUser, currentProfile);
        });

    } catch (err) {
        console.error('Error al iniciar auth:', err);
    }
}

/**
 * Consulta el perfil del usuario desde la tabla profiles
 */
export async function fetchProfile(userId) {
    const supabase = getSupabase();
    if (!supabase || !userId) return null;

    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            console.warn('Perfil no encontrado, creando perfil básico por defecto:', error);
            return {
                id: userId,
                email: currentUser?.email || '',
                full_name: currentUser?.user_metadata?.full_name || 'Usuario',
                role: 'operador'
            };
        }
        return data;
    } catch (e) {
        console.error('Error cargando perfil:', e);
        return null;
    }
}

/**
 * Iniciar Sesión con Correo y Contraseña
 */
export async function signIn(email, password) {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase no está configurado.');

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
    });

    if (error) throw error;
    currentUser = data.user;
    currentProfile = await fetchProfile(currentUser.id);
    return { user: currentUser, profile: currentProfile };
}

/**
 * Registro de Nuevo Usuario
 */
export async function signUp(email, password, fullName) {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase no está configurado.');

    const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
            data: {
                full_name: fullName.trim()
            }
        }
    });

    if (error) throw error;
    return data;
}

/**
 * Cerrar Sesión
 */
export async function signOut() {
    const supabase = getSupabase();
    if (supabase) {
        await supabase.auth.signOut();
    }
    currentUser = null;
    currentProfile = null;
}

/**
 * Obtiene el usuario actual en memoria
 */
export function getCurrentUser() {
    return currentUser;
}

/**
 * Obtiene el perfil actual en memoria
 */
export function getCurrentProfile() {
    return currentProfile;
}

/**
 * Verifica si el usuario actual tiene rol de Administrador
 */
export function isAdmin() {
    return currentProfile && currentProfile.role === 'admin';
}

