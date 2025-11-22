# TitoFitApp · APK Fitness de TitoGeremito

> Rutinas personalizadas y genéricas, registro ultra-rápido de series (reps/kg), exportación a Excel, evolución con métricas y videoteca por músculos.  
> Construido con **Expo + React Native**.

![version](https://img.shields.io/badge/version-1.3.1-informational?style=flat-square)
![Expo Router](https://img.shields.io/badge/Expo-Router-000?logo=expo&style=flat-square)
![Build EAS](https://img.shields.io/badge/Build-EAS-blue?style=flat-square)
![Android](https://img.shields.io/badge/Platform-Android-success?style=flat-square)
![Licencia](https://img.shields.io/badge/License-Propietaria%20%7C%20Todos%20los%20derechos%20reservados-critical?style=flat-square)

<!-- Hero banner (opcional): coloca tu imagen en docs/img/hero-banner.png y descomenta
![TitoFitApp – Entrena con precisión](docs/img/hero-banner.png)
-->

## Tabla de contenidos
- [Características](#características)
- [Novedades v1.3.1](#novedades-v131)
- [Navegación principal](#navegación-principal)
- [Rutinas (crear / editar / activar / importar)](#rutinas-crear--editar--activar--importar)
- [Entreno (registro) y exportación a Excel](#entreno-registro-y-exportación-a-excel)
- [Evolución (métricas y gráficos)](#evolución-métricas-y-gráficos)
- [Videoteca de ejercicios](#videoteca-de-ejercicios)
- [Login y modal de changelog](#login-y-modal-de-changelog)
- [Persistencia (AsyncStorage)](#persistencia-asyncstorage)
- [Importar rutinas desde CSV](#importar-rutinas-desde-csv)
- [Instalación y ejecución](#instalación-y-ejecución)
- [Build con EAS](#build-con-eas)
- [Estructura de carpetas](#estructura-de-carpetas)
- [Solución de problemas](#solución-de-problemas)
- [Roadmap](#roadmap)
- [Cómo mejorar este README con imágenes](#cómo-mejorar-este-readme-con-imágenes)
- [Créditos y contacto](#créditos-y-contacto)
- [Licencia y aviso legal](#licencia-y-aviso-legal)

---

## Características
- **Gestión de rutinas**: crear, editar, activar, eliminar e **importar desde CSV** con normalización.
- **Rutinas genéricas** listas para empezar (alineadas con la base de ejercicios para TC/Vídeo).
- **Entreno ágil**: inputs de **reps/kg** por serie, estados **C / NC / OE**, placeholders con tu última sesión.
- **Cálculos**: **volumen** (reps×kg) y **e1RM** estimado; indicadores de tendencia por serie.
- **Exportación a Excel (XLSX)**: genera tu “**Semana N.xlsx**” en un toque.
- **Evolución**: métricas y gráficos con filtros por músculo/ejercicio y eje Fecha/Sesión/Semana.
- **Videoteca**: reproductor YouTube incrustado (16:9 y Shorts 9:16) por músculo/ejercicio.
- **Login visual**: base para futuro backup/sync en la nube.
- **UX** pulida: tipografías, espaciados, consistencia visual y rendimiento.

---

## Novedades v1.3.1
- **Cronómetro** integrado en Entreno con persistencia durante la sesión.  
- **Botones “TC (Técnica Correcta)” y “Vídeo”** por ejercicio (popup con guía + reproductor).  
- **Memoria de sesión por rutina**: vuelve al **último día y semana** usados.  
- **“OE (Otro Ejercicio)”** con compatibilidad retroactiva para antiguos “OJ”.  
- **Sección de Vídeos** renovada: reproductor incrustado y catálogo por músculo.  
- **Rutinas genéricas** actualizadas y **alineadas con `exercises.json`**.  
- **Constructor de rutinas** mejorado: crear, modificar, reordenar e importar CSV con validación.  
- **Acceso de promoción personal** desde la app.  
- **Modal de changelog** tras el login que aparece solo la primera vez por versión.

---

## Navegación principal
Secciones clave: **Entreno** · **Rutinas** · **Evolución** · **Perfil** · **Videos**  
En **Home** se muestran accesos rápidos y la **versión** actual.

---

## Rutinas (crear / editar / activar / importar)
- **Crear**: nombre + nº de días → estructura base auto-generada.  
- **Activar**: define la rutina activa que alimenta Entreno.  
- **Editar / Eliminar**: atajos visibles con confirmaciones seguras.  
- **Importar CSV**: filas → días → ejercicios → series con **normalización de IDs**.  
- **Genéricas incluidas** y ya **mapeadas** a la base de ejercicios (TC/Vídeo).

---

## Entreno (registro) y exportación a Excel
- **Selector Semana / Día** con carruseles táctiles.
- Tarjetas por ejercicio con inputs **reps/kg** y estado **C / NC / OE**.
- **Placeholder** automático con el último registro para agilizar.
- **Exportar a Excel**: genera **Semana N.xlsx** con el histórico.

Ejemplo de entrada en `GLOBAL_LOG`:
```json
{
  "id": "2025-10-31T18:45:00.000Z-ej_123-0",
  "date": "2025-10-31T18:45:00.000Z",
  "routineName": "Nombre Rutina",
  "week": 3,
  "muscle": "PECTORAL",
  "exercise": "Press Banca con Barra",
  "setIndex": 1,
  "reps": 8,
  "load": 80,
  "volume": 640,
  "e1RM": 101.33
}
```

---

## Evolución (métricas y gráficos)
- **Filtros**: Músculo → (opcional) Ejercicio.  
- **Métricas**: Volumen total, e1RM máx, Carga ponderada por rep, Reps totales.  
- **Eje X**: Fecha, Sesión o Semana (orden real).  
- **Acciones**: Refrescar datos / Borrar historial.

---

## Videoteca de ejercicios
- Agrupado por **músculo → ejercicios**, con **modal** y reproductor **YouTube**.  
- Soporta **16:9** y **Shorts 9:16** con altura adaptativa.  
- Coincidencia por nombre con `exercises.json` para TC/Vídeo.

---

## Login y modal de changelog
- **Login visual** (base para futuro SSO/backup).  
- **Modal de novedades**: aparece tras el login **solo la primera vez por versión** (`last_seen_version`).

---

## Persistencia (AsyncStorage)
Claves principales:

| Clave                | Descripción                                                   |
|----------------------|---------------------------------------------------------------|
| `rutinas`            | Lista maestra de rutinas (metadatos).                         |
| `active_routine`     | **ID** de la rutina activa.                                   |
| `active_routine_name`| Nombre humano de la rutina activa (opcional).                 |
| `routine_{ID}`       | Rutina completa (días → ejercicios → series).                 |
| `progress`           | Entradas de sesión (reps/kg por set).                         |
| `last_session_{ID}`  | Última **semana/día** visitados para esa rutina.              |
| `GLOBAL_LOG`         | Histórico de series para Evolución.                           |
| `last_seen_version`  | Versión cuyo changelog ya se mostró.                          |

> Compatibilidad: los estados antiguos `OJ` se interpretan como **OE** automáticamente.

---

## Importar rutinas desde CSV
**Cabeceras esperadas**
```
rutinaNombre,dias,dia,musculo,ejercicio,repMin,repMax,extra
```

**Ejemplo**
```
rutinaNombre,dias,dia,musculo,ejercicio,repMin,repMax,extra
FullBody Novatos,3,1,PECTORAL,Press Banca con Barra,8,10,Ninguno
FullBody Novatos,3,1,ESPALDA,Remo en T (con apoyo),8,10,Ninguno
FullBody Novatos,3,2,PIERNAS,Sentadilla Libre,6,8,Ninguno
```

Notas:
- `dias` = total de días de la rutina; `dia` empieza en **1**.  
- `extra` acepta técnicas: **Ninguno**, **Descendentes**, **Mio Reps**, **Parciales**.  
- Los **nombres** conviene que coincidan con `exercises.json` para habilitar **TC/Vídeo**.

---

## Instalación y ejecución
**Requisitos**
- Node **20+**
- Expo SDK **53**
- Android SDK / Emulador (opcional), iOS Simulator (macOS)

**Dependencias destacadas**
- `expo-router`, `@react-native-async-storage/async-storage`,  
  `react-native-youtube-iframe`, `papaparse`, `xlsx`,  
  `expo-file-system`, `expo-sharing`.

**Pasos**
```bash
# Instalar deps
pnpm i        # o: npm i / yarn

# Ejecutar en desarrollo
npx expo start

# Web (opcional)
npx expo start --web
```

---

## Build con EAS
Asegúrate de tener `EXPO_TOKEN` en entorno.
```bash
# Android
eas build -p android --profile production

# iOS (en macOS con cuenta Apple)
eas build -p ios --profile production
```

> **runtimeVersion (proyectos bare)**: define una versión **fija** (p. ej. `"runtimeVersion": "1.3.1"`) en `app.json`. Las políticas automáticas (`{"policy": "appVersion"}`) no son compatibles en bare.

---

## Estructura de carpetas
```
app/
├─ index.jsx            # Home + modal de changelog
├─ entreno/             # Registro (reps/kg, C/NC/OE, TC/Vídeo, Excel)
├─ rutinas/             # Crear/editar/activar/importar CSV
├─ evolucion/           # Métricas y gráficos
├─ videos.jsx           # Videoteca YouTube
└─ +not-found.tsx
src/
├─ data/
│  ├─ exercises.json    # Base de ejercicios (técnica + videoId)
│  └─ predefinedRoutines.js
docs/
└─ img/                 # Screenshots, banners, GIFs para el README
```

---

## Solución de problemas
<details>
<summary><strong>Pantalla negra en vídeos (Android)</strong></summary>

- Verifica `react-native-webview` instalado (Expo instala el nativo).  
- En nativo, usa **solo el VIDEO_ID** en el player; en Web hay fallback a `<iframe>`.

</details>

<details>
<summary><strong>Excel no se comparte/guarda</strong></summary>

- Revisa permisos de escritura/compartir.  
- En Android 13+, usa el diálogo de **Compartir** del sistema.

</details>

<details>
<summary><strong>El emulador no refresca cambios</strong></summary>

- Asegúrate de estar en modo **development**.  
- Usa “r” para recargar o el **dev menu** (“m” en Android Emulator).

</details>

<details>
<summary><strong>No vuelve al último día/semana</strong></summary>

- Comprueba que existe `last_session_{ID}` y que `active_routine` apunta a la rutina correcta.  
- La persistencia se actualiza al cambiar semana/día y al marcar estados/series.

</details>

---

## Roadmap
- Exportar rutinas a **CSV/JSON** desde “Rutinas”.  
- Editor avanzado de **plantillas** y **ejercicios personalizados**.  
- Más métricas (RPE, tonelaje/sesión), comparativas y vistas acumuladas.  
- Videoteca con **búsqueda**, **favoritos** y filtros por variante.  
- **Backup/sync** en la nube y autenticación real.

---

## Cómo mejorar este README con imágenes
1) **Hero banner**: `docs/img/hero-banner.png` (1080×480 aprox.).  
   ```md
   ![TitoFitApp – Entrena con precisión](docs/img/hero-banner.png)
   ```
2) **Grid de capturas** (4–6 imágenes):
   ```
   docs/img/home.png
   docs/img/entreno.png
   docs/img/rutinas.png
   docs/img/editor-rutina.png
   docs/img/videos.png
   docs/img/evolucion.png
   ```
   ```html
   <p align="center">
     <img src="docs/img/home.png" width="23%" />
     <img src="docs/img/entreno.png" width="23%" />
     <img src="docs/img/rutinas.png" width="23%" />
     <img src="docs/img/videos.png" width="23%" />
   </p>
   ```
3) **GIF de flujo** (12–20s): `docs/img/demo.gif`  
   ```md
   ![Demo de flujo](docs/img/demo.gif)
   ```

---

## Créditos y contacto
- **Autor**: Germán Martínez — *TitoGeremito*  
- **Web/Marca**: *(añade tu URL si procede)*  
- **Contacto**: *(email profesional o formulario)*

> Marcas de terceros: YouTube™ y el logotipo de YouTube™ son marcas de Google LLC.  
> Otras marcas y nombres de productos mencionados son propiedad de sus respectivos titulares.

---

## Licencia y aviso legal
**© 2025 Germán Martínez (TitoGeremito). Todos los derechos reservados.**  
Última actualización: **2 de noviembre de 2025**

Este software, su código fuente, diseño, recursos gráficos y la base de datos de ejercicios se distribuyen bajo **licencia propietaria**. **Queda prohibida** la copia, modificación, ingeniería inversa, redistribución total o parcial, uso comercial o creación de trabajos derivados **sin autorización expresa y por escrito** de su titular.

- **Uso permitido**: evaluación privada y desarrollo interno por el propietario del repositorio y colaboradores autorizados.  
- **No se concede** licencia de uso público ni sublicencia.  
- **Contenido de terceros** (p. ej., vídeos de YouTube) se muestra mediante incrustación, sujeto a los **términos del proveedor**. No se alojan contenidos de terceros ni se reclama titularidad.  
- **Privacidad**: si en futuras versiones se recopilan datos personales (p. ej., login real/bakcup), se publicará una **Política de Privacidad** específica conforme a la normativa aplicable.  
- **Exención de garantías**: el software se proporciona “tal cual”, sin garantías de ningún tipo. El autor no será responsable de daños o pérdidas derivados de su uso.

**Identificación de la obra**  
- Nombre: **TitoFitApp** (APK Fitness)  
- Autor: **Germán Martínez — TitoGeremito**  
- Versión: **1.3.1**  
- Fecha de publicación: **2/11/2025**  
- Repositorio: *(añade la URL si aplica)*

Para solicitudes de licencia o permisos, contacta con el autor.
