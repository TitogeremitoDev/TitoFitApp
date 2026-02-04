/**
 * components/ui/EnhancedPressable.tsx
 * ═══════════════════════════════════════════════════════════════════════════
 * Pressable mejorado SOLO para iOS con:
 * - hitSlop por defecto para áreas táctiles más grandes (SOLO iOS)
 * - delayPressIn optimizado para distinguir scroll de tap (SOLO iOS)
 * - Preservación de handlers originales
 *
 * IMPORTANTE: En web devuelve el Pressable SIN modificaciones de hitSlop
 * para evitar problemas de layout y comportamiento inesperado
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { forwardRef } from 'react';
import {
  Pressable,
  PressableProps,
  Platform,
  View,
} from 'react-native';

interface EnhancedPressableProps extends PressableProps {
  /** Desactiva las mejoras de hitSlop (por si necesitas el comportamiento original) */
  disableHitSlop?: boolean;
  /** Tamaño del hitSlop (default: 10) */
  hitSlopSize?: number;
  /** Delay antes de activar onPressIn (default: 0 en iOS para respuesta inmediata) */
  delayPressIn?: number;
}

/**
 * EnhancedPressable - Pressable con mejoras para iOS
 *
 * Uso:
 * ```tsx
 * <EnhancedPressable onPress={handlePress}>
 *   <Text>Click me</Text>
 * </EnhancedPressable>
 * ```
 *
 * Es un reemplazo directo de Pressable con mejor experiencia táctil en iOS.
 */
const EnhancedPressable = forwardRef<any, EnhancedPressableProps>(
  (
    {
      hitSlop,
      disableHitSlop = false,
      hitSlopSize = 10,
      delayPressIn,
      android_ripple,
      children,
      ...props
    },
    ref
  ) => {
    // ════════════════════════════════════════════════════════════════════════
    // IMPORTANTE: Solo aplicar mejoras táctiles en iOS
    // En web, devolver Pressable sin hitSlop por defecto para evitar
    // problemas de layout y comportamiento
    // ════════════════════════════════════════════════════════════════════════

    // hitSlop por defecto SOLO en iOS si no se proporciona y no está desactivado
    const defaultHitSlop =
      Platform.OS === 'web' || disableHitSlop
        ? hitSlop // En web: usar solo si se proporciona explícitamente
        : hitSlop ?? {
            top: hitSlopSize,
            bottom: hitSlopSize,
            left: hitSlopSize,
            right: hitSlopSize,
          };

    // delayPressIn: 0 en iOS para respuesta inmediata, undefined en web/Android
    const defaultDelayPressIn =
      delayPressIn ?? (Platform.OS === 'ios' ? 0 : undefined);

    // android_ripple por defecto si no se proporciona
    const defaultRipple =
      android_ripple ?? { color: 'rgba(0,0,0,0.08)', borderless: false };

    // Usar type assertion para delayPressIn (prop válida pero no en tipos)
    const pressableProps = {
      ref,
      hitSlop: defaultHitSlop,
      delayPressIn: defaultDelayPressIn,
      android_ripple: Platform.OS === 'android' ? defaultRipple : undefined,
      ...props,
    } as PressableProps & { ref: typeof ref };

    return (
      <Pressable {...pressableProps}>
        {children}
      </Pressable>
    );
  }
);

EnhancedPressable.displayName = 'EnhancedPressable';

export default EnhancedPressable;
