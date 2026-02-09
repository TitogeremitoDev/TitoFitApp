// ═══════════════════════════════════════════════════════════════════════════
// IMPERSONATION CONTEXT
// ═══════════════════════════════════════════════════════════════════════════
// Maneja el estado del "Modo Dios" para administradores
// Permite entrar como cualquier usuario y volver al panel de admin
// ═══════════════════════════════════════════════════════════════════════════

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, usePathname } from 'expo-router';
import axios from 'axios';
import { useAuth } from './AuthContext';

const ADMIN_RECOVERY_TOKEN_KEY = 'ADMIN_RECOVERY_TOKEN';
const ADMIN_RECOVERY_USER_KEY = 'ADMIN_RECOVERY_USER';
const ADMIN_LAST_ROUTE_KEY = 'ADMIN_LAST_ROUTE';
const IMPERSONATOR_ROLE_KEY = 'IMPERSONATOR_ROLE';
const TOKEN_KEY = 'totalgains_token';
const USER_KEY = 'totalgains_user';

interface ImpersonatedUser {
    _id: string;
    nombre: string;
    email: string;
    username: string;
    tipoUsuario: string;
}

interface ImpersonationContextData {
    isImpersonating: boolean;
    impersonatedUser: ImpersonatedUser | null;
    impersonatorRole: 'admin' | 'coordinator' | null;
    startImpersonation: (targetUserId: string, currentPath: string, endpoint?: string) => Promise<boolean>;
    exitImpersonation: () => Promise<void>;
    checkImpersonationStatus: () => Promise<void>;
}

const ImpersonationContext = createContext<ImpersonationContextData | null>(null);

export const ImpersonationProvider = ({ children }: { children: React.ReactNode }) => {
    const [isImpersonating, setIsImpersonating] = useState(false);
    const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(null);
    const [impersonatorRole, setImpersonatorRole] = useState<'admin' | 'coordinator' | null>(null);
    const router = useRouter();
    const { reloadSession } = useAuth();

    // Verificar estado de impersonation al montar
    const checkImpersonationStatus = useCallback(async () => {
        try {
            const recoveryToken = await AsyncStorage.getItem(ADMIN_RECOVERY_TOKEN_KEY);
            const impersonatedUserData = await AsyncStorage.getItem(USER_KEY);
            const storedRole = await AsyncStorage.getItem(IMPERSONATOR_ROLE_KEY);

            if (recoveryToken && impersonatedUserData) {
                setIsImpersonating(true);
                const userData = JSON.parse(impersonatedUserData);
                setImpersonatedUser({
                    _id: userData._id,
                    nombre: userData.nombre,
                    email: userData.email,
                    username: userData.username,
                    tipoUsuario: userData.tipoUsuario
                });
                setImpersonatorRole((storedRole as 'admin' | 'coordinator') || 'admin');
            } else {
                setIsImpersonating(false);
                setImpersonatedUser(null);
                setImpersonatorRole(null);
            }
        } catch (error) {
            console.error('[Impersonation] Error checking status:', error);
        }
    }, []);

    useEffect(() => {
        checkImpersonationStatus();
    }, [checkImpersonationStatus]);

    // Iniciar impersonation
    const startImpersonation = useCallback(async (targetUserId: string, currentPath: string, endpoint?: string): Promise<boolean> => {
        // Guardia de re-entrada: prevenir doble-click que corrompa tokens
        if (isImpersonating) {
            console.warn('[Impersonation] Ya se está impersonando, ignorando llamada duplicada');
            return false;
        }

        try {
            // 1. Guardar token actual del admin/supervisor
            const currentToken = await AsyncStorage.getItem(TOKEN_KEY);
            const currentUser = await AsyncStorage.getItem(USER_KEY);

            if (!currentToken || !currentUser) {
                console.error('[Impersonation] No hay sesión actual');
                return false;
            }

            // 2. Llamar al endpoint de impersonation (admin o supervisor)
            const impersonateEndpoint = endpoint || '/admin/impersonate';
            const response = await axios.post(impersonateEndpoint, { targetUserId });

            if (!response.data.success || !response.data.token) {
                console.error('[Impersonation] Respuesta inválida del servidor');
                return false;
            }

            // 3. Guardar token de admin/supervisor para recuperarlo después
            const role = endpoint?.includes('/supervisor/') ? 'coordinator' : 'admin';
            await AsyncStorage.setItem(ADMIN_RECOVERY_TOKEN_KEY, currentToken);
            await AsyncStorage.setItem(ADMIN_RECOVERY_USER_KEY, currentUser);
            await AsyncStorage.setItem(ADMIN_LAST_ROUTE_KEY, currentPath);
            await AsyncStorage.setItem(IMPERSONATOR_ROLE_KEY, role);

            // 4. Reemplazar sesión con el usuario objetivo
            const { token, ...userData } = response.data;
            await AsyncStorage.setItem(TOKEN_KEY, token);
            await AsyncStorage.setItem(USER_KEY, JSON.stringify(userData));

            // 5. Actualizar headers de axios
            axios.defaults.headers.common.Authorization = `Bearer ${token}`;

            // 6. Actualizar estado local
            setIsImpersonating(true);
            setImpersonatedUser({
                _id: userData._id,
                nombre: userData.nombre,
                email: userData.email,
                username: userData.username,
                tipoUsuario: userData.tipoUsuario
            });
            setImpersonatorRole(role);

            // 7. Sincronizar AuthContext con la nueva sesión
            await reloadSession();

            // 8. Navegar al mode-select del cliente
            router.replace('/mode-select');

            return true;
        } catch (error: any) {
            console.error('[Impersonation] Error starting:', error.response?.data || error.message);
            return false;
        }
    }, [router, reloadSession]);

    // Salir de impersonation
    const exitImpersonation = useCallback(async () => {
        try {
            // 1. Recuperar token del admin/supervisor
            const adminToken = await AsyncStorage.getItem(ADMIN_RECOVERY_TOKEN_KEY);
            const adminUser = await AsyncStorage.getItem(ADMIN_RECOVERY_USER_KEY);
            const lastRoute = await AsyncStorage.getItem(ADMIN_LAST_ROUTE_KEY);
            const storedRole = await AsyncStorage.getItem(IMPERSONATOR_ROLE_KEY);

            if (!adminToken || !adminUser) {
                console.error('[Impersonation] No hay token de recuperación');
                return;
            }

            // 2. Restaurar sesión del admin/supervisor
            await AsyncStorage.setItem(TOKEN_KEY, adminToken);
            await AsyncStorage.setItem(USER_KEY, adminUser);

            // 3. Actualizar headers de axios
            axios.defaults.headers.common.Authorization = `Bearer ${adminToken}`;

            // 4. Limpiar datos de impersonation
            await AsyncStorage.multiRemove([
                ADMIN_RECOVERY_TOKEN_KEY,
                ADMIN_RECOVERY_USER_KEY,
                ADMIN_LAST_ROUTE_KEY,
                IMPERSONATOR_ROLE_KEY
            ]);

            // 5. Actualizar estado local
            setIsImpersonating(false);
            setImpersonatedUser(null);
            setImpersonatorRole(null);

            // 6. Sincronizar AuthContext con la sesión restaurada
            await reloadSession();

            // 7. Navegar de vuelta según el rol del impersonator
            if (lastRoute) {
                router.replace(lastRoute as any);
            } else if (storedRole === 'coordinator') {
                router.replace('/(supervisor)/team' as any);
            } else {
                router.replace('/(admin)/clients' as any);
            }

        } catch (error) {
            console.error('[Impersonation] Error exiting:', error);
        }
    }, [router, reloadSession]);

    return (
        <ImpersonationContext.Provider
            value={{
                isImpersonating,
                impersonatedUser,
                impersonatorRole,
                startImpersonation,
                exitImpersonation,
                checkImpersonationStatus
            }}
        >
            {children}
        </ImpersonationContext.Provider>
    );
};

export const useImpersonation = () => {
    const ctx = useContext(ImpersonationContext);
    if (!ctx) throw new Error('useImpersonation debe usarse dentro de <ImpersonationProvider>');
    return ctx;
};
