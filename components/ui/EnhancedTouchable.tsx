/**
 * components/ui/EnhancedTouchable.tsx
 * ═══════════════════════════════════════════════════════════════════════════
 * TouchableOpacity mejorado para iOS con:
 * - hitSlop por defecto para áreas táctiles más grandes
 * - delayPressIn optimizado para distinguir scroll de tap
 * - activeOpacity optimizado para feedback visual
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { forwardRef } from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  Platform,
} from 'react-native';

interface EnhancedTouchableProps extends TouchableOpacityProps {
  /** Desactiva las mejoras de hitSlop (por si necesitas el comportamiento original) */
  disableHitSlop?: boolean;
  /** Tamaño del hitSlop (default: 10) */
  hitSlopSize?: number;
}

/**
 * EnhancedTouchable - TouchableOpacity con mejoras para iOS
 *
 * Uso:
 * ```tsx
 * <EnhancedTouchable onPress={handlePress}>
 *   <Text>Click me</Text>
 * </EnhancedTouchable>
 * ```
 *
 * Es un reemplazo directo de TouchableOpacity con mejor experiencia táctil en iOS.
 */
const EnhancedTouchable = forwardRef<any, EnhancedTouchableProps>(
  (
    {
      hitSlop,
      disableHitSlop = false,
      hitSlopSize = 10,
      delayPressIn,
      activeOpacity,
      children,
      ...props
    },
    ref
  ) => {
    // hitSlop por defecto si no se proporciona y no está desactivado
    const defaultHitSlop = disableHitSlop
      ? hitSlop
      : hitSlop ?? {
          top: hitSlopSize,
          bottom: hitSlopSize,
          left: hitSlopSize,
          right: hitSlopSize,
        };

    // delayPressIn: 0 en iOS para respuesta inmediata
    const defaultDelayPressIn =
      delayPressIn ?? (Platform.OS === 'ios' ? 0 : undefined);

    // activeOpacity: feedback visual más sutil en iOS
    const defaultActiveOpacity =
      activeOpacity ?? (Platform.OS === 'ios' ? 0.7 : 0.6);

    return (
      <TouchableOpacity
        ref={ref}
        hitSlop={defaultHitSlop}
        delayPressIn={defaultDelayPressIn}
        activeOpacity={defaultActiveOpacity}
        {...props}
      >
        {children}
      </TouchableOpacity>
    );
  }
);

EnhancedTouchable.displayName = 'EnhancedTouchable';

export default EnhancedTouchable;
