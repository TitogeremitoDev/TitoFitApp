/* components/ActionButton.jsx
    ────────────────────────────────────────────────────────────────────────
    Este es TU componente de botón, extraído de app/index.jsx
    para que puedas usarlo en cualquier pantalla (como Perfil).
    Ahora con soporte para tema dinámico.
    ──────────────────────────────────────────────────────────────────────── */

import { useRef } from 'react';
import {
  Pressable,
  Animated,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

/* Botón reutilizable con micro-animación.
   - Se usa con <Link asChild> o con onPress normal. */
export default function ActionButton({
  title,
  icon,
  variant = 'primary',
  compact = false,
  onPressIn: onPressInProp,
  onPressOut: onPressOutProp,
  ...pressableProps // Acepta onPress, onPressIn, onPressOut, etc.
}) {
  const { theme } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const animate = (to) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 25,
      bounciness: 6,
    }).start();

  // Preservar handlers originales (importante para Link asChild en iOS)
  const handlePressIn = (e) => {
    animate(0.98);
    onPressInProp?.(e);
  };

  const handlePressOut = (e) => {
    animate(1);
    onPressOutProp?.(e);
  };

  // Determina qué estilos usar (Primario o Secundario)
  const isPrimary = variant === 'primary';

  const baseStyle = isPrimary
    ? [styles.btnPrimary, {
      backgroundColor: theme.primary,
      shadowColor: theme.primary,
    }]
    : [styles.btnSecondary, {
      backgroundColor: theme.cardBackground,
      borderColor: theme.border,
    }];

  // Estilos compactos para grid
  const compactStyle = compact ? styles.btnCompact : null;

  const textStyle = isPrimary
    ? [styles.btnPrimaryTxt, { color: theme.primaryText || '#FFFFFF' }]
    : [styles.btnSecondaryTxt, { color: theme.text }, compact ? styles.btnCompactTxt : null];

  const iconColor = isPrimary ? (theme.primaryText || '#FFFFFF') : theme.text;

  return (
    <Animated.View
      style={[{ transform: [{ scale }] }, compact ? { width: '100%' } : null]}
      pointerEvents="box-none"
    >
      <Pressable
        {...pressableProps}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        delayPressIn={Platform.OS === 'ios' ? 0 : undefined}
        style={({ pressed }) => [
          baseStyle,
          compactStyle,
          pressed && Platform.OS === 'ios' ? { opacity: 0.9 } : null,
          typeof pressableProps.style === 'function' ? pressableProps.style({ pressed }) : pressableProps.style,
        ]}
      >
        {icon ? <Ionicons name={icon} size={compact ? 16 : 18} color={iconColor} /> : null}
        <Text style={textStyle}>{title}</Text>
      </Pressable>
    </Animated.View>
  );
}

/* ───────────── Estilos Base ───────────── */
const styles = StyleSheet.create({
  /* Botón principal */
  btnPrimary: {
    width: 280,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    // backgroundColor aplicado dinámicamente
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  btnPrimaryTxt: {
    // color aplicado dinámicamente
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  /* Botones secundarios */
  btnSecondary: {
    width: 280,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    // backgroundColor aplicado dinámicamente
    borderWidth: 1,
    // borderColor aplicado dinámicamente
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  btnSecondaryTxt: {
    // color aplicado dinámicamente
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  /* Estilos compactos para grid de 2 columnas */
  btnCompact: {
    width: '100%',
    height: 40,
    borderRadius: 12,
    gap: 6,
  },
  btnCompactTxt: {
    fontSize: 13,
    letterSpacing: 0.2,
  },
});