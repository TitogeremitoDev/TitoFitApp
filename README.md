TitoFitApp · APK Fitness de TitoGeremito

Rutinas personalizadas y genéricas, registro rápido de series (reps/kg), exportación a Excel, evolución con gráficos y videoteca por músculos.
Construido con Expo + React Native.

<p> <a href="https://img.shields.io/badge/version-1.3.0-informational?style=flat-square"> <img src="https://img.shields.io/badge/version-1.3.0-informational?style=flat-square" /> </a> <a href="https://img.shields.io/badge/Expo-Router-000?logo=expo&style=flat-square"> <img src="https://img.shields.io/badge/Expo-Router-000?logo=expo&style=flat-square" /> </a> <a href="https://img.shields.io/badge/Build-EAS-blue?style=flat-square"> <img src="https://img.shields.io/badge/Build-EAS-blue?style=flat-square" /> </a> <a href="https://img.shields.io/badge/Platform-Android-success?style=flat-square"> <img src="https://img.shields.io/badge/Platform-Android-success?style=flat-square" /> </a> <a href="https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square"> <img src="https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square" /> </a> </p>

<!-- Coloca aquí tu banner/screenshot -->

Tabla de contenidos

Características

Navegación de la app

Rutinas (crear/editar/activar/importar)

Entreno (registro) y exportación a Excel

Evolución (métricas y gráficos)

Videoteca de ejercicios

Login

Almacenamiento (AsyncStorage)

Formato CSV de Rutinas (importar)

Instalación y ejecución

Build con EAS

Estructura de carpetas

Solución de problemas

Roadmap

Changelog 1.3.0

Licencia

Características

Gestión de rutinas: crea, edita, activa y elimina; importa desde CSV.

Rutinas genéricas listas para empezar (Full Body, Torso/Pierna, PPL, etc.).

Entreno ágil: reps/kg por serie, estados C/NC/OJ, placeholders de la sesión previa.

Cálculos: volumen (reps×kg) y e1RM estimado por serie.

Exportar a Excel (XLSX): progreso semanal listo para compartir.

Evolución: métricas y gráficos con filtros por músculo/ejercicio y eje Fecha/Sesión/Semana.

Videoteca: reproductor integrado (YouTube) con soporte 16:9 y Shorts 9:16.

Login: inicio de sesión integrado (prepara terreno para funciones en la nube).

Navegación de la app

Pestañas/Secciones principales:

Entreno · Rutinas · Evolución · Perfil · Videos

En Home se muestran accesos directos y la versión de la app.

Rutinas (crear/editar/activar/importar)

Crear: nombre + nº de días → estructura base.

Activar: define la rutina activa para Entreno.

Editar/Eliminar: atajos visibles en la lista, con confirmaciones.

Importar CSV: construye días → ejercicios → series a partir del archivo.

Rutinas genéricas incluidas en 1.3.0 para arrancar rápido.

Entreno (registro) y exportación a Excel

Selector de Semana y Día.

Tarjetas por ejercicio con inputs de reps/kg y estado C/NC/OJ.

Placeholder automático con el último registro para acelerar el flujo.

Exportar a Excel: un toque para generar Semana N.xlsx.

Ejemplo de registro (GLOBAL_LOG):

{
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
}

Evolución (métricas y gráficos)

Filtros: Músculo → (opcional) Ejercicio.

Métricas: Volumen total, e1RM máx, Carga ponderada por rep, Reps totales.

Eje X: Fecha, Sesión o Semana (orden real).

Acciones: Refrescar datos / Borrar historial.

Videoteca de ejercicios

Agrupado por músculo → ejercicios → reproductor YouTube en modal.

Soporta 16:9 y Shorts 9:16 con altura adaptativa.

Más contenido añadido en 1.3.0.

Login

Login insertado en 1.3.0 para preparar futuras features (sincronización/backup, etc.).

Almacenamiento (AsyncStorage)

Claves principales:

Key	Descripción
rutinas	Lista de rutinas
active_routine	ID de rutina activa
active_routine_name	Nombre de la rutina activa
routine_{ID}	Rutina completa (días → ejercicios → series)
progress	Datos de entrada de la sesión (reps/kg por set)
last_session	Última semana/día visitados
GLOBAL_LOG	Histórico de series para Evolución
Formato CSV de Rutinas (importar)

Cabeceras esperadas

rutinaNombre,dias,dia,musculo,ejercicio,repMin,repMax,extra


Ejemplo

rutinaNombre,dias,dia,musculo,ejercicio,repMin,repMax,extra
FullBody Novatos,3,1,PECTORAL,Press Banca con Barra,8,10,Ninguno
FullBody Novatos,3,1,ESPALDA,Remo con Barra,8,10,Ninguno
FullBody Novatos,3,2,PIERNA,Sentadilla,6,8,Ninguno


dias = total de días; dia empieza en 1; extra acepta técnicas (p. ej. Ninguno, DS, RP).

Instalación y ejecución

Requisitos

Node 20+, Expo, React Native.

Dependencias destacadas

expo-router, @react-native-async-storage/async-storage, react-native-chart-kit,
react-native-youtube-iframe, papaparse, xlsx, expo-file-system, expo-sharing.

Pasos

# Instalar deps
pnpm i     # o npm/yarn

# Ejecutar en desarrollo
npx expo start

# Web (opcional)
npx expo start --web

Build con EAS
# Requiere EXPO_TOKEN configurado en entorno
eas build -p android --profile production
eas build -p ios --profile production

Estructura de carpetas
app/
├─ _layout.tsx          # Shell de navegación (Expo Router)
├─ home.tsx             # Home con accesos y versión
├─ entreno.jsx          # Registro de sesiones (reps/kg, C/NC/OJ, export XLSX)
├─ rutina.jsx           # Gestión de rutinas (crear/editar/activar/importar CSV)
├─ evolucion.jsx        # Métricas y gráficos de progreso
├─ perfil.jsx           # Perfil y utilidades
├─ videos.jsx           # Videoteca YouTube (16:9 y Shorts 9:16)
└─ +not-found.tsx


Árbol simplificado; nombres/ubicación pueden variar según el repo.

Solución de problemas
<details> <summary><strong>Pantalla negra en vídeos (Android)</strong></summary>

Asegúrate de tener react-native-webview instalado (Expo instala el módulo nativo).

Si usas enlaces de YouTube, pasa solo el VIDEO_ID en el player nativo.

En Web se usa <iframe> como fallback.

</details> <details> <summary><strong>Excel no se comparte/guarda</strong></summary>

Revisa permisos de escritura/compartir.

En Android 13+, usa el diálogo de Compartir del sistema.

</details> <details> <summary><strong>El emulador no refresca cambios</strong></summary>

Comprueba que estás en modo development (no preview).

Recarga (r) o abre el dev menu (m) según emulador.

Si usas EAS build internal, no hay hot reload (es una build).

</details>
Roadmap

 Exportar rutinas a CSV/JSON desde “Rutinas”.

 Editor avanzado de ejercicios y plantillas.

 Más métricas (RPE, tonelaje/sesión), comparativas y vistas acumuladas.

 Videoteca con búsqueda, favoritos y filtros por variante.

Changelog 1.3.0

31/10/2025

✨ Mejoras visuales en pantallas y cabeceras.

🧩 Rutinas genéricas añadidas (paquetes base).

🎬 Videos con más contenido y soporte 16:9/9:16 en modal.

🔐 Login insertado.

Licencia

MIT — © TitoGeremito.
