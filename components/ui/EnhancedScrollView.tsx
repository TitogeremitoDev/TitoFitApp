/**
 * components/ui/EnhancedScrollView.tsx
 * ═══════════════════════════════════════════════════════════════════════════
 * ScrollView mejorado para iOS con:
 * - keyboardShouldPersistTaps="handled" por defecto
 * - keyboardDismissMode optimizado
 * - Bounce controlado
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { forwardRef } from 'react';
import {
  ScrollView,
  ScrollViewProps,
  Platform,
} from 'react-native';

interface EnhancedScrollViewProps extends ScrollViewProps {
  /** Desactiva keyboardShouldPersistTaps (por si necesitas el comportamiento original) */
  disableKeyboardPersist?: boolean;
}

/**
 * EnhancedScrollView - ScrollView con mejoras para iOS
 *
 * Uso:
 * ```tsx
 * <EnhancedScrollView>
 *   <YourContent />
 * </EnhancedScrollView>
 * ```
 *
 * Es un reemplazo directo de ScrollView con mejor experiencia en iOS.
 * Los toques en botones dentro del ScrollView funcionarán correctamente.
 */
const EnhancedScrollView = forwardRef<ScrollView, EnhancedScrollViewProps>(
  (
    {
      keyboardShouldPersistTaps,
      keyboardDismissMode,
      bounces,
      showsVerticalScrollIndicator,
      showsHorizontalScrollIndicator,
      disableKeyboardPersist = false,
      children,
      ...props
    },
    ref
  ) => {
    // keyboardShouldPersistTaps: "handled" permite que los toques en botones funcionen
    // incluso cuando el teclado está visible
    const defaultKeyboardPersist = disableKeyboardPersist
      ? keyboardShouldPersistTaps
      : keyboardShouldPersistTaps ?? 'handled';

    // keyboardDismissMode: "on-drag" cierra el teclado al hacer scroll
    const defaultKeyboardDismiss =
      keyboardDismissMode ?? (Platform.OS === 'ios' ? 'interactive' : 'on-drag');

    // Bounce: habilitado por defecto en iOS (experiencia nativa)
    const defaultBounces = bounces ?? Platform.OS === 'ios';

    // Ocultar indicadores de scroll por defecto (más limpio)
    const defaultShowVertical = showsVerticalScrollIndicator ?? false;
    const defaultShowHorizontal = showsHorizontalScrollIndicator ?? false;

    return (
      <ScrollView
        ref={ref}
        keyboardShouldPersistTaps={defaultKeyboardPersist}
        keyboardDismissMode={defaultKeyboardDismiss}
        bounces={defaultBounces}
        showsVerticalScrollIndicator={defaultShowVertical}
        showsHorizontalScrollIndicator={defaultShowHorizontal}
        {...props}
      >
        {children}
      </ScrollView>
    );
  }
);

EnhancedScrollView.displayName = 'EnhancedScrollView';

export default EnhancedScrollView;
