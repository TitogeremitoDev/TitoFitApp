/* components/ActionButton.jsx
    ────────────────────────────────────────────────────────────────────────
    Este es TU componente de botón, extraído de app/index.jsx
    para que puedas usarlo en cualquier pantalla (como Perfil).
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

/* Botón reutilizable con micro-animación.
   - Se usa con <Link asChild> o con onPress normal. */
export default function ActionButton({
  title,
  icon,
  variant = 'primary',
  ...pressableProps // Acepta onPress, onPressIn, onPressOut, etc.
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const animate = (to) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 25,
      bounciness: 6,
    }).start();

  // Determina qué estilos usar (Primario o Secundario)
  const baseStyle =
    variant === 'primary' ? styles.btnPrimary : styles.btnSecondary;
  const textStyle =
    variant === 'primary' ? styles.btnPrimaryTxt : styles.btnSecondaryTxt;
  const iconColor = 
    variant === 'primary' ? '#fff' : '#E5E7EB';

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        {...pressableProps} // Pasa el onPress (de Link o normal)
        onPressIn={() => animate(0.98)}
        onPressOut={() => animate(1)}
        android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
        style={({ pressed }) => [
          baseStyle,
          pressed && Platform.OS === 'ios' ? { opacity: 0.9 } : null,
        ]}
      >
        {icon ? <Ionicons name={icon} size={18} color={iconColor} /> : null}
        <Text style={textStyle}>{title}</Text>
      </Pressable>
    </Animated.View>
  );
}

/* ───────────── Estilos (Extraídos de index.jsx) ───────────── */
const styles = StyleSheet.create({
  /* Botón principal */
  btnPrimary: {
    width: 220,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#3B82F6', // Azul que usabas en "Empezar"
    shadowColor: '#3B82F6',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  btnPrimaryTxt: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  /* Botones secundarios */
  btnSecondary: {
    width: 220,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  btnSecondaryTxt: {
    color: '#E5E7EB',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
