<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
  <h1>💪 TitoFitApp</h1>
  <p>
    App móvil de <strong>entrenamiento y seguimiento</strong> construida con <strong>Expo + React Native</strong>.<br>
    Permite registrar entrenos diarios, visualizar rutinas por semanas/días y gestionar ejercicios con series/peso.
  </p>
  <hr>

  <h2>🚀 Stack Tecnológico</h2>
  <ul>
    <li>Expo / React Native</li>
    <li>TypeScript / JavaScript</li>
    <li>EAS (Expo Application Services) para builds</li>
    <li>Android nativo mínimo (Kotlin/Gradle) generado por Expo</li>
  </ul>
  <hr>

  <h2>📁 Estructura del Proyecto</h2>
  <pre>
root
├─ app/                         # Pantallas y layouts (Expo Router)
│  ├─ _layout.tsx               # Layout raíz
│  └─ (tabs)/
│     ├─ _layout.tsx            # Tabs (Home, Explore, etc.)
│     ├─ home.tsx               # Pantalla principal
│     └─ explore.tsx            # Pantalla secundaria
├─ components/                  # Componentes reutilizables (UI/UX)
│  ├─ Collapsible.tsx
│  ├─ ParallaxScrollView.tsx
│  ├─ ThemedText.tsx / ThemedView.tsx
│  └─ ui/...
├─ constants/Colors.ts          # Paleta de colores / tema
├─ hooks/                       # Hooks de tema y utilidades
├─ android/                     # Proyecto nativo Android (auto-generado)
├─ index.js                     # Entry point
├─ app.json                     # Config Expo (name, icon, splash, etc.)
├─ eas.json                     # Perfiles de build (EAS)
├─ eslint.config.js             # Linter
├─ package.json                 # Dependencias y scripts
└─ tsconfig.json                # TS config
  </pre>
  <hr>

  <h2>▶️ Arranque Rápido en Local</h2>
  <ol>
    <li><strong>Instalar dependencias</strong>
      <pre>npm install</pre>
    </li>
    <li><strong>Iniciar el proyecto</strong>
      <pre>npx expo start</pre>
      <p>Pulsa <code>a</code> para abrir el emulador Android o escanea el QR con Expo Go.</p>
    </li>
  </ol>
  <blockquote><strong>Requisitos:</strong> Node LTS, Android Studio (si usas emulador), Expo CLI.</blockquote>
  <hr>

  <h2>🧱 Scripts Útiles</h2>
  <pre>
"scripts": {
  "start": "expo start",
  "android": "expo run:android",
  "lint": "eslint .",
  "typecheck": "tsc --noEmit",
  "reset": "node scripts/reset-project.js"
}
  </pre>
  <ul>
    <li><code>npm run android</code> → Compila y lanza app nativa</li>
    <li><code>npm run lint</code> → Pasa el linter</li>
    <li><code>npm run typecheck</code> → Verifica tipos de TypeScript</li>
  </ul>
  <hr>

  <h2>📦 Builds con EAS</h2>
  <ol>
    <li>Login en Expo
      <pre>npx expo login</pre>
    </li>
    <li>Configurar EAS (solo la 1ª vez)
      <pre>npx eas login
npx eas build:configure</pre>
    </li>
    <li>Build de preview (Android)
      <pre>npx eas build --platform android --profile preview</pre>
    </li>
    <li>Build de producción (Android)
      <pre>npx eas build --platform android --profile production</pre>
    </li>
  </ol>
  <blockquote>Perfiles definidos en <code>eas.json</code>. Añadir credenciales si publicas en Google Play.</blockquote>
  <hr>

  <h2>🧭 Navegación y Flujo</h2>
  <ul>
    <li><strong>app/_layout.tsx</strong> → Layout raíz</li>
    <li><strong>app/(tabs)/_layout.tsx</strong> → Pestañas inferiores</li>
    <li><strong>app/(tabs)/home.tsx</strong> → Pantalla principal</li>
    <li><strong>components/*</strong> → UI reutilizable</li>
  </ul>
  <hr>

  <h2>🎯 Roadmap</h2>
  <ul>
    <li>Selector <strong>Rutina → Semana → Día</strong> con carrusel</li>
    <li>Registro de series/peso con flechas</li>
    <li>Estados especiales: NC / OJ</li>
    <li>Persistencia local y futura sync backend</li>
    <li>Theming claro/oscuro + accesibilidad</li>
  </ul>
  <hr>

  <h2>🧹 Calidad del Código</h2>
  <ul>
    <li>Lint: <pre>npm run lint</pre></li>
    <li>Types: <pre>npm run typecheck</pre></li>
  </ul>
  <blockquote>Recomendado: usar Conventional Commits para historial limpio.</blockquote>
  <hr>

  <h2>🛠️ Problemas Comunes (Windows/Android)</h2>
  <ul>
    <li>Metro atascado:
      <pre>npx expo start -c</pre>
    </li>
    <li>ADB no detecta dispositivo:
      <ul>
        <li>Abrir Android Studio → Device Manager → Iniciar emulador</li>
        <li>O conectar físico con Depuración USB activada</li>
      </ul>
    </li>
    <li>Error dependencias nativas:
      <pre>npm install
npx expo prebuild --platform android
npx expo run:android</pre>
    </li>
  </ul>
  <hr>

  <h2>📜 Licencia</h2>
  <p> 📜 Derechos y Propiedad

Este proyecto, incluyendo todo su código fuente, recursos gráficos, textos y
elementos asociados, es propiedad exclusiva de **Titogeremito**.

Queda prohibida la copia, distribución, modificación, publicación o cualquier
uso no autorizado del contenido total o parcial de este software sin el
consentimiento previo y por escrito de su propietario.

© 2025 Titogeremito — Todos los derechos reservados.</p>
</div>
