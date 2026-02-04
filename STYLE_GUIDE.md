# 🎨 Guía de Estilos - TotalGains App

## 📋 Índice
1. [Principios Generales](#principios-generales)
2. [Patrones de Estilos](#patrones-de-estilos)
3. [Helpers y Utilidades](#helpers-y-utilidades)
4. [Casos de Uso](#casos-de-uso)
5. [Anti-Patrones](#anti-patrones)
6. [Checklist de Refactorización](#checklist-de-refactorización)

---

## 🎯 Principios Generales

### ✅ **Preferir StyleSheet.create sobre estilos inline**

Los estilos inline tienen un **impacto negativo en rendimiento** porque:
- Se recrean en cada render
- Impiden la memoización de componentes
- Aumentan presión en garbage collection
- Dificultan el mantenimiento

```jsx
// ❌ MAL - Nuevo objeto en cada render
<View style={{ padding: 20, backgroundColor: '#fff' }}>

// ✅ BIEN - Objeto reutilizable
const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff' }
});
<View style={styles.container}>
```

### 📊 **Impacto en Rendimiento**

- **Reducción de re-renders**: 15-30% en scrolling/animaciones
- **Memoria**: Menos objetos temporales = menos GC
- **Mantenibilidad**: Estilos centralizados y reutilizables

---

## 🔧 Patrones de Estilos

### 1. Espaciadores Reutilizables

```jsx
// ❌ MAL - Duplicado en múltiples lugares
<View style={{ height: 8 }} />
<View style={{ height: 10 }} />
<View style={{ height: 12 }} />

// ✅ BIEN - Constantes reutilizables
const styles = StyleSheet.create({
  spacer8: { height: 8 },
  spacer10: { height: 10 },
  spacer12: { height: 12 },
});

<View style={styles.spacer8} />
<View style={styles.spacer10} />
```

**Aún mejor - Usar helpers:**

```jsx
import { SPACING } from '../src/utils/styleHelpers';

const styles = StyleSheet.create({
  spacerSm: { height: SPACING.sm },  // 8
  spacerMd: { height: SPACING.md },  // 12
  spacerLg: { height: SPACING.lg },  // 16
});
```

---

### 2. Estilos Dinámicos con Theme

```jsx
// ❌ MAL - Nuevo objeto en cada render
<View style={[styles.card, {
  borderColor: theme.border,
  backgroundColor: theme.backgroundSecondary
}]} />

// ✅ BIEN - Usar useMemo
const dynamicStyles = useMemo(() => ({
  cardThemedColors: {
    borderColor: theme.border,
    backgroundColor: theme.backgroundSecondary,
  }
}), [theme.border, theme.backgroundSecondary]);

<View style={[styles.card, dynamicStyles.cardThemedColors]} />
```

---

### 3. Colores con Opacidad

**Patrón común**: `theme.primary + '15'` (50+ ocurrencias en el proyecto)

```jsx
// ❌ MAL - Concatenación inline
<View style={{ backgroundColor: theme.primary + '15' }}>
<View style={{ backgroundColor: `${theme.primary}20` }}>

// ✅ BIEN - Usar helper
import { addColorOpacity, getColorVariants } from '../src/utils/styleHelpers';

// Opción 1: Función helper
const bgColor = addColorOpacity(theme.primary, '15');
<View style={{ backgroundColor: bgColor }}>

// Opción 2: Pre-calcular variantes con useMemo
const themedColors = useMemo(() => ({
  primaryLight: addColorOpacity(theme.primary, '15'),
  primaryMedium: addColorOpacity(theme.primary, '30'),
  // O usar getColorVariants para todas las variantes
  ...getColorVariants(theme.primary),
}), [theme.primary]);

<View style={{ backgroundColor: themedColors.opacity15 }}>
```

---

### 4. Estilos Condicionales

```jsx
// ❌ MAL - Lógica compleja inline
<View style={{
  backgroundColor: isSelected ? theme.primary : theme.background,
  borderColor: isSelected ? theme.primary : theme.border,
  borderWidth: isSelected ? 2 : 1,
}}>

// ✅ BIEN - Pre-calcular con useMemo
const conditionalStyles = useMemo(() => ({
  selected: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
    borderWidth: 2,
  },
  unselected: {
    backgroundColor: theme.background,
    borderColor: theme.border,
    borderWidth: 1,
  }
}), [theme]);

<View style={isSelected ? conditionalStyles.selected : conditionalStyles.unselected}>
```

---

### 5. Triple Ternarios (CRÍTICO)

**Caso real del proyecto** ([progress/[clientId].jsx:2551](app/(coach)/progress/[clientId].jsx#L2551)):

```jsx
// ❌ MAL - Triple ternario inline
<View style={{
  backgroundColor: audioMedia.accuracy >= 80 ? '#dcfce7' :
                   audioMedia.accuracy >= 50 ? '#fef9c3' : '#fee2e2',
  paddingHorizontal: 6,
  paddingVertical: 1,
  borderRadius: 10
}}>

// ✅ BIEN - Usar helper function
import { getAccuracyBadgeStyle } from '../src/utils/styleHelpers';

const badgeStyle = useMemo(() =>
  getAccuracyBadgeStyle(audioMedia.accuracy),
  [audioMedia.accuracy]
);

<View style={badgeStyle}>
```

---

### 6. Estilos en Loops (.map / FlatList)

**CRÍTICO para rendimiento** - Evitar crear objetos en cada iteración.

```jsx
// ❌ MAL - Objeto nuevo por cada item del array
{items.map((item) => (
  <View style={{
    backgroundColor: item.isActive ? '#3b82f6' : '#6b7280',
    padding: 8,
  }}>
    <Text>{item.name}</Text>
  </View>
))}

// ✅ BIEN - Estilos pre-calculados
const itemStyles = StyleSheet.create({
  active: { backgroundColor: '#3b82f6', padding: 8 },
  inactive: { backgroundColor: '#6b7280', padding: 8 },
});

{items.map((item) => (
  <View style={item.isActive ? itemStyles.active : itemStyles.inactive}>
    <Text>{item.name}</Text>
  </View>
))}
```

---

### 7. Animaciones - NO REFACTORIZAR

```jsx
// ✅ CORRECTO - NO CAMBIAR
// Animated.View REQUIERE estilos inline para interpolación
<Animated.View style={{ transform: [{ rotate: rotation }] }}>
  <Ionicons name="chevron-down" size={20} />
</Animated.View>

<Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
  {/* content */}
</Animated.View>
```

**Regla**: Si usa `Animated.View` o valores animados, mantener inline.

---

## 🛠️ Helpers y Utilidades

### Importar Helpers

```jsx
import {
  addColorOpacity,
  getColorVariants,
  getAccuracyBadgeStyle,
  getAccuracyTextStyle,
  SPACING,
  BORDER_RADIUS,
  FONT_SIZES,
} from '../src/utils/styleHelpers';
```

### Constantes de Diseño

```jsx
const styles = StyleSheet.create({
  container: {
    padding: SPACING.md,           // 12
    borderRadius: BORDER_RADIUS.medium,  // 10
    gap: SPACING.sm,               // 8
  },
  text: {
    fontSize: FONT_SIZES.md,       // 14
  },
});
```

---

## 📖 Casos de Uso

### Caso 1: Refactorizar Grid de Botones

**Antes** ([home.jsx](app/(app)/home.jsx) - 4 duplicados de `width: '48%'`):

```jsx
<View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', width: '100%', gap: 10 }}>
  <View style={{ width: '48%' }}>
    <Button title="Button 1" />
  </View>
  <View style={{ width: '48%' }}>
    <Button title="Button 2" />
  </View>
</View>
```

**Después**:

```jsx
const styles = StyleSheet.create({
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    gap: 10,
  },
  gridColumn: {
    width: '48%',
  },
});

<View style={styles.gridContainer}>
  <View style={styles.gridColumn}>
    <Button title="Button 1" />
  </View>
  <View style={styles.gridColumn}>
    <Button title="Button 2" />
  </View>
</View>
```

**Resultado**: Reducción de 17 a 3 estilos inline (82% menos).

---

### Caso 2: Optimizar Estilos con Theme

**Antes**:

```jsx
<Text style={[styles.title, { color: theme.text }, isSmallHeight ? { fontSize: 20 } : null]}>
  TotalGains
</Text>
<Text style={[styles.subtitle, { color: theme.textSecondary }, isSmallHeight ? { marginBottom: 12 } : null]}>
  Tu progreso, bien medido.
</Text>
```

**Después**:

```jsx
const dynamicStyles = useMemo(() => ({
  titleText: {
    color: theme.text,
    ...(isSmallHeight && { fontSize: 20 }),
  },
  subtitleText: {
    color: theme.textSecondary,
    ...(isSmallHeight && { marginBottom: 12 }),
  },
}), [theme.text, theme.textSecondary, isSmallHeight]);

<Text style={[styles.title, dynamicStyles.titleText]}>
  TotalGains
</Text>
<Text style={[styles.subtitle, dynamicStyles.subtitleText]}>
  Tu progreso, bien medido.
</Text>
```

---

### Caso 3: Refactorizar Estilos en Map

**Problema real** ([MealCard.jsx:1056-1112](app/(coach)/nutrition/WeeklyMealPlanner/MealCard.jsx)):

```jsx
// ❌ ANTES - Cálculos + estilos inline en map
{option.foods.map((food, foodIdx) => {
  const pct = Math.round((food.kcal / optionMacros.kcal) * 100);
  return (
    <View style={[styles.pctBadge, pct >= 50 && { backgroundColor: '#fee2e2' }]}>
      <Text style={[styles.pctText, pct >= 50 && { color: '#ef4444' }]}>{pct}%</Text>
    </View>
  );
})}

// ✅ DESPUÉS - Estilos pre-calculados
const pctStyles = StyleSheet.create({
  badgeNormal: { backgroundColor: '#f3f4f6' },
  badgeHigh: { backgroundColor: '#fee2e2' },
  textNormal: { color: '#6b7280' },
  textHigh: { color: '#ef4444' },
});

{option.foods.map((food, foodIdx) => {
  const pct = Math.round((food.kcal / optionMacros.kcal) * 100);
  const isHigh = pct >= 50;
  return (
    <View style={[styles.pctBadge, isHigh ? pctStyles.badgeHigh : pctStyles.badgeNormal]}>
      <Text style={[styles.pctText, isHigh ? pctStyles.textHigh : pctStyles.textNormal]}>
        {pct}%
      </Text>
    </View>
  );
})}
```

---

## ⚠️ Anti-Patrones

### ❌ 1. Estilos Inline Duplicados

```jsx
// MAL - Repetido 4 veces
<View style={{ width: '48%' }}>
<View style={{ width: '48%' }}>
<View style={{ width: '48%' }}>
<View style={{ width: '48%' }}>
```

### ❌ 2. Concatenación de Strings para Opacidad

```jsx
// MAL - Crea nuevo string cada vez
backgroundColor: theme.primary + '15'
backgroundColor: `${theme.primary}20`
```

### ❌ 3. Lógica Compleja Inline

```jsx
// MAL - Difícil de leer y mantener
<View style={{
  backgroundColor: audioMedia.accuracy >= 80 ? '#dcfce7' :
                   audioMedia.accuracy >= 50 ? '#fef9c3' : '#fee2e2',
  paddingHorizontal: 6,
  paddingVertical: 1,
  borderRadius: 10
}}>
```

### ❌ 4. useMemo Innecesario

```jsx
// MAL - Overhead innecesario para valor estático
const staticStyle = useMemo(() => ({
  container: { padding: 20 }
}), []);

// BIEN - Usar StyleSheet.create
const styles = StyleSheet.create({
  container: { padding: 20 }
});
```

---

## ✅ Checklist de Refactorización

### Antes de Empezar
- [ ] Leer el archivo completo para entender contexto
- [ ] Identificar si ya existe StyleSheet.create
- [ ] Buscar patrones duplicados
- [ ] Identificar estilos dinámicos (theme, props, state)
- [ ] Verificar si hay animaciones (NO tocar)

### Durante la Refactorización
- [ ] Agrupar estilos similares
- [ ] Usar constantes (SPACING, BORDER_RADIUS, etc.)
- [ ] Aplicar useMemo solo para estilos dinámicos
- [ ] Preservar orden de especificidad (arrays de estilos)
- [ ] No refactorizar estilos con Animated.View

### Después de Refactorizar
- [ ] Verificar compilación (sin errores de TypeScript)
- [ ] Probar en todos los temas (light/dark/custom)
- [ ] Probar estados interactivos (seleccionado/hover)
- [ ] Verificar responsiveness (diferentes pantallas)
- [ ] Comparar screenshots antes/después
- [ ] Medir rendimiento con React DevTools Profiler

---

## 📏 Métricas de Éxito

### Proyecto TotalGains - Estado Actual

| Archivo | Antes | Después | Reducción |
|---------|-------|---------|-----------|
| `home.jsx` | 17 inline | 3 inline | 82% ↓ |
| `entreno.jsx` | 37 inline | 35 inline | 5% ↓ |
| **Total** | **54 inline** | **38 inline** | **30% ↓** |

### Objetivos

| Métrica | Actual | Objetivo |
|---------|--------|----------|
| Archivos con inline styles | 75 (58.6%) | 20 (15%) |
| Total inline styles | 380 | <100 |
| Archivos con StyleSheet | 25 (19.5%) | 100+ (78%) |
| Inline en loops/maps | ~15 casos | 0 |

---

## 🚀 Próximos Pasos

### Fase 2: Optimización Media (Recomendado)

1. **ajustes.jsx** (26 inline) - Alta densidad de estilos condicionales
2. **progress/[clientId].jsx** (23 inline) - Triple ternarios críticos
3. **MealCard.jsx** (21 inline) - Loops con cálculos
4. **Archivos < 1,000 líneas** - Refactorización completa

### Fase 3: Optimización Avanzada

1. Crear sistema de temas pre-calculados
2. Implementar ESLint rules para prevenir inline styles
3. Documentar componentes reutilizables
4. Performance audit completo

---

## 📚 Recursos

- [React Native Performance](https://reactnative.dev/docs/performance)
- [StyleSheet API](https://reactnative.dev/docs/stylesheet)
- [Optimizing Flatlist](https://reactnative.dev/docs/optimizing-flatlist-configuration)

---

## 🤝 Contribuir

Al agregar nuevos componentes:

1. **Siempre** usar `StyleSheet.create` para estilos estáticos
2. **Solo** usar inline para:
   - Animaciones con `Animated.View`
   - Valores calculados en runtime (pero envolver en `useMemo`)
3. **Preferir** helpers de `src/utils/styleHelpers.js`
4. **Documentar** nuevos patrones en esta guía

---

**Última actualización**: Enero 2026
**Versión**: 1.0.0
**Mantenedor**: Equipo TotalGains
