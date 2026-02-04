/**
 * components/ui/index.ts
 * ═══════════════════════════════════════════════════════════════════════════
 * Exportaciones centralizadas de componentes UI mejorados para iOS
 *
 * Uso:
 * ```tsx
 * import {
 *   EnhancedPressable,
 *   EnhancedTouchable,
 *   EnhancedTextInput,
 *   EnhancedScrollView
 * } from '../components/ui';
 * ```
 * ═══════════════════════════════════════════════════════════════════════════
 */

export { default as EnhancedPressable } from './EnhancedPressable';
export { default as EnhancedTouchable } from './EnhancedTouchable';
export { default as EnhancedTextInput } from './EnhancedTextInput';
export { default as EnhancedScrollView } from './EnhancedScrollView';

// Re-exportar componentes existentes
export { default as IconSymbol } from './IconSymbol';
export { default as TabBarBackground } from './TabBarBackground';
