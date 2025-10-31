<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TitoFitApp — README</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0d0f14;
      --bg-2: #10131a;
      --fg: #eef2ff;
      --muted: #b9c0d4;
      --card: rgba(255,255,255,0.06);
      --card-2: rgba(255,255,255,0.08);
      --stroke: rgba(255,255,255,0.12);
      --accent: #f8ecdc; /* color de marca */
      --accent-2: #ff9c6f;
      --ok: #a7f3d0;
      --warn: #fde68a;
      --danger: #fecaca;
      --shadow: 0 10px 30px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.06);
      --radius-xl: 22px;
      --radius-lg: 16px;
      --radius-md: 12px;
      --radius-sm: 10px;
      --mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      --sans: 'Inter', ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
    }
    * { box-sizing: border-box }
    html, body { height: 100% }
    body { margin:0; font-family: var(--sans); color: var(--fg); background: radial-gradient(1200px 800px at 10% -10%, #1b2030, transparent), radial-gradient(1200px 800px at 110% 10%, #1b2433, transparent), linear-gradient(180deg, var(--bg), var(--bg-2)); }

    /* Layout */
    .wrap { max-width: 1100px; margin: 0 auto; padding: 24px; }
    header.hero { position: relative; isolation: isolate; border-radius: var(--radius-xl); padding: 42px; background: linear-gradient(135deg, rgba(248,236,220,.09), rgba(255,156,111,.11)); backdrop-filter: blur(8px); border: 1px solid var(--stroke); box-shadow: var(--shadow); overflow: hidden; }
    header .glow { position: absolute; inset: -30%; background: radial-gradient(closest-side, rgba(248,236,220,.20), transparent 70%); filter: blur(40px); z-index: -1; }
    .brand { display:flex; align-items:center; gap:12px; }
    .badge { padding: 6px 10px; border-radius: 999px; background: var(--card-2); border: 1px solid var(--stroke); font-size: 12px; color: var(--muted); }
    h1 { font-size: clamp(28px, 3.6vw, 48px); margin: 6px 0 6px; letter-spacing: -0.02em; }
    .subtitle { color: var(--muted); font-weight: 500; }

    .nav { position: sticky; top: 12px; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin: 18px 0 26px; }
    .nav a { text-decoration: none; color: var(--fg); background: var(--card); border: 1px solid var(--stroke); padding: 12px 14px; border-radius: var(--radius-md); display:flex; align-items:center; gap:10px; transition: .2s transform, .2s background; box-shadow: var(--shadow); }
    .nav a:hover { transform: translateY(-1px); background: var(--card-2); }

    section { margin: 30px 0 22px; background: var(--card); border:1px solid var(--stroke); border-radius: var(--radius-lg); padding: 22px; box-shadow: var(--shadow); }
    section h2 { margin: 0 0 12px; font-size: 22px; letter-spacing: -.01em; }
    p, li { color: #dce3f5; line-height: 1.7; }
    ul { margin: .3rem 0 1rem 1.1rem; }

    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
    .card { background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.03)); border:1px solid var(--stroke); border-radius: var(--radius-lg); padding:16px; box-shadow: var(--shadow); }

    code, pre { font-family: var(--mono); }
    pre { position: relative; background: #0b0e13; border:1px solid #1b2333; border-radius: var(--radius-md); overflow:auto; padding: 14px; margin: 12px 0; }
    .copy-btn { position: absolute; right: 10px; top: 10px; padding: 6px 9px; font-size: 12px; border-radius: 8px; border:1px solid var(--stroke); background: var(--card-2); color: var(--fg); cursor: pointer; }

    .kpi { display:flex; align-items:center; gap:10px; }
    .kpi .dot { width:10px; height:10px; border-radius: 50%; background: var(--accent-2); box-shadow: 0 0 0 4px rgba(255,156,111,.16); }

    .callout { border-left: 4px solid var(--accent); padding: 10px 14px; background: linear-gradient(90deg, rgba(248,236,220,.10), transparent); border-radius: 8px; }

    .timeline { display:grid; gap: 12px; }
    .timeline-item { display:grid; grid-template-columns: 110px 1fr; gap: 14px; align-items: start; }
    .chip { display:inline-flex; align-items:center; gap:8px; padding: 6px 10px; border:1px dashed var(--stroke); border-radius: 999px; color: var(--muted); }

    .footer { text-align:center; color: var(--muted); padding: 20px 0 10px; }

    /* Small screen tweaks */
    @media (max-width: 640px) {
      .timeline-item { grid-template-columns: 1fr; }
    }

    /* Toggle theme (extra) */
    .toolbar { display:flex; gap:10px; align-items:center; justify-content:flex-end; margin-top: 12px; }
    .btn { border:1px solid var(--stroke); background: var(--card-2); padding:8px 10px; border-radius: 10px; color: var(--fg); cursor:pointer; box-shadow: var(--shadow); font-size: 14px; }
    .btn:active { transform: scale(.98); }
    .pill { background: rgba(255,255,255,.06); border:1px solid var(--stroke); padding: 4px 10px; border-radius: 999px; color: var(--muted); font-size: 12px; }

    /* Table */
    table { width:100%; border-collapse: collapse; border:1px solid var(--stroke); }
    th, td { padding:10px 12px; border-bottom:1px solid var(--stroke); text-align:left; }
    thead th { background: rgba(255,255,255,.05); color: #f1f5ff; }
    tbody tr:hover { background: rgba(255,255,255,.03); }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <div class="glow"></div>
      <div class="brand">
        <span class="badge">v1.3.0 · actualizado 31/10/2025</span>
        <span class="pill">Expo · React Native</span>
        <span class="pill">AsyncStorage</span>
        <span class="pill">EAS Build</span>
      </div>
      <h1>TitoFitApp — APK Fitness de TitoGeremito</h1>
      <p class="subtitle">Rutinas personalizadas y genéricas, registro inteligente de series, exportación a Excel, evolución con gráficos y videoteca de ejercicios. Todo en una interfaz rápida y cuidada.</p>
      <div class="toolbar">
        <button class="btn" id="printBtn">🖨️ Exportar a PDF</button>
        <button class="btn" id="themeBtn">🌗 Cambiar tema</button>
      </div>
    </header>

    <nav class="nav">
      <a href="#caracteristicas">⚡ Características</a>
      <a href="#rutinas">🏋️ Rutinas</a>
      <a href="#entreno">📒 Entreno & Excel</a>
      <a href="#evolucion">📈 Evolución</a>
      <a href="#videos">🎬 Videoteca</a>
      <a href="#perfil">👤 Perfil & Navegación</a>
      <a href="#storage">💾 Almacenamiento</a>
      <a href="#csv">🧩 CSV Import</a>
      <a href="#instalacion">⚙️ Instalación</a>
      <a href="#build">🏗️ Build EAS</a>
      <a href="#roadmap">🗺️ Roadmap</a>
      <a href="#changelog">📝 Changelog</a>
    </nav>

    <section id="caracteristicas">
      <h2>Características</h2>
      <div class="grid">
        <div class="card">
          <div class="kpi"><span class="dot"></span><strong>Gestión de Rutinas</strong></div>
          <p>Crear, editar, seleccionar activa, eliminar e <em>importar</em> desde CSV. Rutinas genéricas listas para empezar.</p>
        </div>
        <div class="card">
          <div class="kpi"><span class="dot"></span><strong>Entreno ágil</strong></div>
          <p>Captura rápida de <strong>reps</strong> y <strong>kg</strong>, estado <code>C/NC/OJ</code>, placeholders de la sesión previa y cálculo de <strong>volumen</strong> y <strong>e1RM</strong>.</p>
        </div>
        <div class="card">
          <div class="kpi"><span class="dot"></span><strong>Exportación a Excel</strong></div>
          <p>Un toque para exportar la <strong>semana</strong> actual a XLSX con estructura limpia y compatible.</p>
        </div>
        <div class="card">
          <div class="kpi"><span class="dot"></span><strong>Evolución</strong></div>
          <p>Filtros por músculo/ejercicio, métricas clave y ejes por fecha/sesión/semana para analizar tu progreso.</p>
        </div>
        <div class="card">
          <div class="kpi"><span class="dot"></span><strong>Videoteca</strong></div>
          <p>Reproductor integrado con soporte 16:9 y Shorts 9:16, agrupado por músculo y con más contenido.</p>
        </div>
        <div class="card">
          <div class="kpi"><span class="dot"></span><strong>Login</strong></div>
          <p>Inicio de sesión integrado para preparar el terreno a futuras funciones en la nube.</p>
        </div>
      </div>
      <div class="callout" style="margin-top:14px">
        <strong>Rutas principales:</strong> Entreno · Rutinas · Evolución · Perfil · Videos.
      </div>
    </section>

    <section id="rutinas">
      <h2>Rutinas: crear, seleccionar e importar</h2>
      <ul>
        <li><strong>Crear</strong>: define nombre y nº de días; la app genera la estructura inicial.</li>
        <li><strong>Seleccionar activa</strong>: la rutina elegida queda persistida y se usa en Entreno.</li>
        <li><strong>Editar/Eliminar</strong>: atajos visibles en la lista; confirmaciones seguras.</li>
        <li><strong>Importar CSV</strong>: adjunta tu archivo y la app construye días → ejercicios → series.</li>
        <li><strong>Rutinas genéricas</strong>: paquetes base (p. ej., FullBody 3 días, Torso/Pierna, Push–Pull–Legs) para empezar rápido.</li>
      </ul>

      <details>
        <summary><strong>Consejos rápidos</strong></summary>
        <ul>
          <li>Añade técnicas en el campo <code>extra</code> (ej.: <code>Ninguno</code>, <code>DS</code>, <code>RP</code>).</li>
          <li>Usa nombres consistentes para músculo/ejercicio: facilitan los filtros en Evolución.</li>
          <li>Para migrar rutinas entre dispositivos, exporta el CSV desde tu gestor y vuelve a importarlo.</li>
        </ul>
      </details>
    </section>

    <section id="entreno">
      <h2>Entreno: registro y exportación a Excel</h2>
      <ul>
        <li>Selector de <strong>Semana</strong> y <strong>Día</strong>; tarjetas por ejercicio del día.</li>
        <li>Estado del ejercicio: <code>C</code> (Completado), <code>NC</code> (No completado), <code>OJ</code> (Observaciones/Justo).</li>
        <li>Al completar, se loggea en <code>GLOBAL_LOG</code> (fecha, rutina, semana, músculo, ejercicio, set, reps, kg, volumen, e1RM).</li>
        <li><strong>Exportar Excel</strong>: genera <em>“Semana N”</em> en .xlsx listo para compartir.</li>
      </ul>

      <pre><button class="copy-btn" data-copy>Copiar</button><code>{
  "id": "2025-10-31T18:45:00.000Z-ej_123-0",
  "date": "2025-10-31T18:45:00.000Z",
  "routineName": "Nombre Rutina",
  "week": 3,
  "muscle": "PECTORAL",
  "exercise": "Press Banca",
  "setIndex": 1,
  "reps": 8,
  "load": 80,
  "volume": 640,
  "e1RM": 101.33
}</code></pre>
    </section>

    <section id="evolucion">
      <h2>Evolución: métricas y gráficos</h2>
      <div class="grid">
        <div class="card"><strong>Filtros</strong><p>Músculo → Ejercicio (opcional) para enfocar el análisis.</p></div>
        <div class="card"><strong>Métricas</strong><p>Volumen (reps×kg), e1RM máx, Carga ponderada por rep, Reps totales.</p></div>
        <div class="card"><strong>Eje X</strong><p>Por Fecha, Sesión o Semana. Orden cronológico real.</p></div>
        <div class="card"><strong>Acciones</strong><p>Refrescar datos y Borrar historial (reset de <code>GLOBAL_LOG</code>).</p></div>
      </div>
    </section>

    <section id="videos">
      <h2>Videoteca de ejercicios</h2>
      <ul>
        <li>Listado por <strong>músculo</strong> → ejercicios → <strong>modal</strong> con reproductor YouTube.</li>
        <li>Soporte para <strong>16:9</strong> y <strong>Shorts 9:16</strong> con altura adaptativa.</li>
        <li>Contenido ampliado en la 1.3.0.</li>
      </ul>
    </section>

    <section id="perfil">
      <h2>Perfil y navegación</h2>
      <p>Expo Router con cabeceras cuidadas y acceso directo a pantallas clave (Entreno, Rutinas, Evolución, Perfil, Videos). El <strong>login</strong> está integrado para preparar futuras funciones en la nube.</p>
    </section>

    <section id="storage">
      <h2>Almacenamiento local (AsyncStorage)</h2>
      <div class="grid">
        <div class="card"><strong>Claves</strong>
          <ul>
            <li><code>rutinas</code>: lista de rutinas</li>
            <li><code>active_routine</code>, <code>active_routine_name</code></li>
            <li><code>routine_{ID}</code>: definición completa</li>
            <li><code>progress</code>: datos por serie</li>
            <li><code>last_session</code>: última semana/día visitados</li>
            <li><code>GLOBAL_LOG</code>: histórico para Evolución</li>
          </ul>
        </div>
        <div class="card"><strong>Buenas prácticas</strong>
          <ul>
            <li>Normaliza nombres de ejercicios para evitar duplicados en análisis.</li>
            <li>Realiza exports semanales para backup rápido.</li>
          </ul>
        </div>
      </div>
    </section>

    <section id="csv">
      <h2>Formato CSV para importar rutinas</h2>
      <p>Cabeceras esperadas:</p>
      <pre><button class="copy-btn" data-copy>Copiar</button><code>rutinaNombre,dias,dia,musculo,ejercicio,repMin,repMax,extra</code></pre>
      <p>Ejemplo:</p>
      <pre><button class="copy-btn" data-copy>Copiar</button><code>rutinaNombre,dias,dia,musculo,ejercicio,repMin,repMax,extra
FullBody Novatos,3,1,PECTORAL,Press Banca con Barra,8,10,Ninguno
FullBody Novatos,3,1,ESPALDA,Remo con Barra,8,10,Ninguno
FullBody Novatos,3,2,PIERNA,Sentadilla,6,8,Ninguno</code></pre>
      <div class="callout"><strong>Notas:</strong> <code>dias</code> es el total de días de la rutina, <code>dia</code> es 1‑based, y <code>extra</code> permite técnicas (p. ej. <code>Ninguno</code>, <code>DS</code>, <code>RP</code>).</div>
    </section>

    <section id="instalacion">
      <h2>Instalación y ejecución</h2>
      <div class="grid">
        <div class="card">
          <strong>Requisitos</strong>
          <ul>
            <li>Node 20+, Expo, React Native.</li>
            <li>Dependencias clave: expo-router, @react-native-async-storage/async-storage, react-native-chart-kit, react-native-youtube-iframe, papaparse, xlsx, expo-file-system, expo-sharing.</li>
          </ul>
        </div>
        <div class="card">
          <strong>Instalar</strong>
          <pre><button class="copy-btn" data-copy>Copiar</button><code>pnpm i  # o npm/yarn</code></pre>
          <strong>Desarrollo</strong>
          <pre><button class="copy-btn" data-copy>Copiar</button><code>npx expo start
npx expo start --web  # opcional</code></pre>
        </div>
      </div>
    </section>

    <section id="build">
      <h2>Build (EAS)</h2>
      <p>Compila con EAS Build. Configura <code>EXPO_TOKEN</code> y ejecuta:</p>
      <pre><button class="copy-btn" data-copy>Copiar</button><code>eas build -p android --profile production
eas build -p ios --profile production</code></pre>
    </section>

    <section id="roadmap">
      <h2>Roadmap</h2>
      <ul>
        <li>Exportar <strong>rutinas</strong> a CSV/JSON desde la pantalla de Rutinas.</li>
        <li>Editor avanzado de ejercicios y plantillas personalizadas.</li>
        <li>Más métricas (RPE, tonelaje por sesión), comparativas y vistas acumuladas.</li>
        <li>Videoteca con búsqueda, favoritos y filtros por variante.</li>
      </ul>
    </section>

    <section id="changelog">
      <h2>Changelog</h2>
      <div class="timeline">
        <div class="timeline-item">
          <div><span class="chip">31/10/2025</span></div>
          <div class="card">
            <strong>1.3.0</strong>
            <ul>
              <li>Mejoras visuales en pantallas y cabeceras.</li>
              <li><strong>Rutinas genéricas</strong> añadidas (paquetes base).</li>
              <li>Sección de <strong>Videos</strong> con más contenido y soporte 16:9/9:16.</li>
              <li><strong>Login</strong> insertado.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <section>
      <h2>Licencia</h2>
      <p>MIT — © TitoGeremito.</p>
    </section>

    <p class="footer">Hecho con ♥ para entrenar mejor, no más.</p>
  </div>

  <script>
    // Copiar al portapapeles
    document.querySelectorAll('[data-copy]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pre = btn.parentElement;
        const text = pre.querySelector('code').innerText;
        navigator.clipboard.writeText(text).then(() => {
          const old = btn.innerText; btn.innerText = '✓ Copiado';
          setTimeout(() => btn.innerText = old, 1200);
        });
      });
    });

    // Tema claro/oscuro básico
    const themeBtn = document.getElementById('themeBtn');
    let dark = true;
    themeBtn?.addEventListener('click', () => {
      dark = !dark;
      document.documentElement.style.setProperty('--bg', dark ? '#0d0f14' : '#f7f7fb');
      document.documentElement.style.setProperty('--bg-2', dark ? '#10131a' : '#ffffff');
      document.documentElement.style.setProperty('--fg', dark ? '#eef2ff' : '#0f1222');
      document.documentElement.style.setProperty('--muted', dark ? '#b9c0d4' : '#5a6075');
      document.body.style.background = dark
        ? 'radial-gradient(1200px 800px at 10% -10%, #1b2030, transparent), radial-gradient(1200px 800px at 110% 10%, #1b2433, transparent), linear-gradient(180deg, var(--bg), var(--bg-2))'
        : 'radial-gradient(1200px 800px at 10% -10%, #fff1e6, transparent), radial-gradient(1200px 800px at 110% 10%, #e9f0ff, transparent), linear-gradient(180deg, var(--bg), var(--bg-2))';
    });

    // Imprimir / PDF
    document.getElementById('printBtn')?.addEventListener('click', () => window.print());
  </script>
</body>
</html>
