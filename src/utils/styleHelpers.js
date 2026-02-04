/**
 * Style Helpers
 * Utilidades para generar estilos dinámicos de forma optimizada
 */

/**
 * Agrega opacidad a un color hexadecimal
 * @param {string} color - Color en formato hex (#RRGGBB o #RGB)
 * @param {string|number} opacity - Opacidad como string ('15', '20') o número (0-100)
 * @returns {string} Color con opacidad (#RRGGBBAA)
 *
 * @example
 * addColorOpacity('#3B82F6', '15') // '#3B82F615'
 * addColorOpacity('#3B82F6', 20) // '#3B82F620'
 */
export const addColorOpacity = (color, opacity) => {
  if (!color) return color;

  // Normalizar opacidad a string de 2 caracteres
  let opacityStr = typeof opacity === 'number' ? opacity.toString() : opacity;

  // Asegurar que tenga 2 dígitos (ej: '5' -> '05')
  if (opacityStr.length === 1) {
    opacityStr = '0' + opacityStr;
  }

  // Remover # si existe
  const cleanColor = color.startsWith('#') ? color.slice(1) : color;

  return `#${cleanColor}${opacityStr}`;
};

/**
 * Genera variantes de un color con diferentes opacidades
 * Útil para crear estilos theming con useMemo
 *
 * @param {string} color - Color base en hex
 * @returns {Object} Objeto con variantes de opacidad
 *
 * @example
 * const variants = getColorVariants('#3B82F6');
 * // {
 * //   opacity10: '#3B82F610',
 * //   opacity15: '#3B82F615',
 * //   opacity20: '#3B82F620',
 * //   opacity30: '#3B82F630',
 * //   opacity50: '#3B82F650',
 * // }
 */
export const getColorVariants = (color) => ({
  opacity10: addColorOpacity(color, '10'),
  opacity15: addColorOpacity(color, '15'),
  opacity20: addColorOpacity(color, '20'),
  opacity30: addColorOpacity(color, '30'),
  opacity40: addColorOpacity(color, '40'),
  opacity50: addColorOpacity(color, '50'),
  opacity60: addColorOpacity(color, '60'),
  opacity70: addColorOpacity(color, '70'),
  opacity80: addColorOpacity(color, '80'),
  opacity90: addColorOpacity(color, '90'),
});

/**
 * Hook personalizado para generar estilos dinámicos con theme
 * Optimizado con useMemo
 *
 * @example
 * import { useMemo } from 'react';
 * import { getColorVariants } from '../utils/styleHelpers';
 *
 * const MyComponent = () => {
 *   const { theme } = useTheme();
 *
 *   const themedColors = useMemo(() => ({
 *     primary: getColorVariants(theme.primary),
 *     success: getColorVariants(theme.success),
 *   }), [theme.primary, theme.success]);
 *
 *   return (
 *     <View style={{ backgroundColor: themedColors.primary.opacity15 }}>
 *       <Text>Hello</Text>
 *     </View>
 *   );
 * };
 */

/**
 * Genera un objeto de estilos para badges de accuracy
 * Evita triple ternario inline
 *
 * @param {number} accuracy - Porcentaje de accuracy (0-100)
 * @returns {Object} Estilo para el badge
 *
 * @example
 * const badgeStyle = getAccuracyBadgeStyle(85);
 * // { backgroundColor: '#dcfce7' } // Verde para >=80%
 */
export const getAccuracyBadgeStyle = (accuracy) => {
  const baseStyle = {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  };

  if (accuracy >= 80) {
    return { ...baseStyle, backgroundColor: '#dcfce7' }; // Verde
  } else if (accuracy >= 50) {
    return { ...baseStyle, backgroundColor: '#fef9c3' }; // Amarillo
  } else {
    return { ...baseStyle, backgroundColor: '#fee2e2' }; // Rojo
  }
};

/**
 * Genera color de texto para badges de accuracy
 *
 * @param {number} accuracy - Porcentaje de accuracy (0-100)
 * @returns {Object} Estilo para el texto
 */
export const getAccuracyTextStyle = (accuracy) => {
  const baseStyle = {
    fontSize: 11,
    fontWeight: '700',
  };

  if (accuracy >= 80) {
    return { ...baseStyle, color: '#166534' }; // Verde oscuro
  } else if (accuracy >= 50) {
    return { ...baseStyle, color: '#854d0e' }; // Amarillo oscuro
  } else {
    return { ...baseStyle, color: '#991b1b' }; // Rojo oscuro
  }
};

/**
 * Constantes de espaciado reutilizables
 * Para usar con StyleSheet.create
 */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

/**
 * Constantes de border radius reutilizables
 */
export const BORDER_RADIUS = {
  small: 6,
  medium: 10,
  large: 16,
  xlarge: 20,
  round: 999,
};

/**
 * Constantes de tamaños de fuente
 */
export const FONT_SIZES = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  xxxl: 24,
};
