/**
 * useOverQuotaInterceptor.js
 * Hook que intercepta errores 403 OVER_QUOTA y activa el modal de bloqueo
 * Debe usarse en el layout del coach para interceptar todas las peticiones
 */

import { useEffect, useRef } from 'react';
import axios from 'axios';

export function useOverQuotaInterceptor(onOverQuotaError) {
    const interceptorId = useRef(null);

    useEffect(() => {
        // Agregar interceptor de respuesta
        interceptorId.current = axios.interceptors.response.use(
            (response) => response,
            (error) => {
                // Verificar si es error 403 con código OVER_QUOTA
                if (
                    error.response?.status === 403 &&
                    error.response?.data?.error === 'OVER_QUOTA'
                ) {
                    console.log('[OverQuota Interceptor] 🚫 Operación bloqueada:', error.config?.url);

                    // Llamar callback con la info de quota
                    if (onOverQuotaError) {
                        onOverQuotaError(error.response.data);
                    }
                }

                return Promise.reject(error);
            }
        );

        // Cleanup: remover interceptor al desmontar
        return () => {
            if (interceptorId.current !== null) {
                axios.interceptors.response.eject(interceptorId.current);
            }
        };
    }, [onOverQuotaError]);
}

export default useOverQuotaInterceptor;
