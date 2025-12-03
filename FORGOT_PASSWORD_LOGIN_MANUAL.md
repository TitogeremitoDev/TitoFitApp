## MANUAL: Añadir enlace "¿Olvidaste tu contraseña?" al Login

Para completar la implementación del sistema de recuperación de contraseñas, necesitas añadir UNA SOLA LÍNEA en el archivo de login:

### Archivo: app/(auth)/login.tsx

Busca la sección donde está el "Link registro" (línea ~377) que dice:

```tsx
            {/* Link registro */}
            <View style={styles.bottomRow}>
              <Text style={{ color: '#9CA3AF' }}>¿No tienes cuenta? </Text>
              <Link href="/register">
                <Text style={styles.link}>Regístrate</Text>
              </Link>
            </View>
```

ANTES de esa sección, añade este código:

```tsx
            {/* Link olvid contraseña */}
            <View style={styles.forgotPasswordRow}>
              <Link href="/forgot-password">
                <Text style={styles.forgotPasswordLink}>¿Olvidaste tu contraseña?</Text>
              </Link>
            </View>

```

Y al final de los estilos (después de la línea `bottomRow:`), añade:

```tsx
  forgotPasswordRow: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  forgotPasswordLink: {
    color: '#60A5FA',
    fontSize: 14,
    fontWeight: '600',
  },
```

---

## ✅ LO QUE YA ESTÁ LISTO:

### Backend:
- ✅ Modelo User.js actualizado con campos de recuperación
- ✅ Endpoints `/api/auth/forgot-password` y `/api/auth/change-password` 
- ✅ Nodemailer instalado

### Frontend:
- ✅ Pantalla `forgot-password.tsx` creada
- ⚠️ Solo falta añadir el enlace en login.tsx (ver arriba)
- ⏳ Falta añadir cambio de contraseña en ajustes.jsx

Continúo con la implementación del cambio de contraseña en ajustes...
