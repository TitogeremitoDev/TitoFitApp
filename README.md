TitoFitApp — APK Fitness de TitoGeremito

App de entrenamiento con rutinas personalizadas y genéricas, registro de series (reps/kg), exportación de progreso a Excel, dashboard de evolución y videoteca por músculos.

Navegación principal: Entreno, Rutinas, Evolución, Perfil, Videos (Expo Router).

Tabla de contenidos

Características

Rutinas: crear, seleccionar, importar CSV

Entreno: registro y exportación Excel

Evolución: métricas y gráficos

Videoteca de ejercicios

Perfil y navegación

Almacenamiento local (AsyncStorage)

Formato CSV para importar rutinas

Instalación y ejecución

Build (EAS)

Roadmap

Changelog

Licencia

Características

Gestión de rutinas: crear, seleccionar activa, eliminar y modificar (atajo Mod). Persistencia local.

Importar rutinas (CSV) con series y técnicas (ej. DESC/MR). Compatible con , y ;.

Entreno semanal y por días con estados C / NC / OJ, captura de reps y kg, cálculo de e1RM y volumen, y placeholders de la sesión previa.

Exportación a Excel (XLSX) del progreso semanal (móvil & web) vía expo-file-system, expo-sharing y xlsx.

Dashboard de Evolución: filtros por músculo/ejercicio, métricas (Volumen, e1RM máx, Carga ponderada, Reps), ejes por Fecha/Sesión/Semana y botón de refresco.

Videoteca por grupo muscular con reproductor modal de YouTube y soporte para 16:9 y Shorts 9:16.

UI moderna con temas claros/oscuros y headers configurados (Expo Router + Safe Area).

La Home enlaza directamente a Entreno, Rutinas, Perfil y Videos, e incluye versión visible.

Rutinas: crear, seleccionar, importar CSV

Crear: nombre + nº de días/semana → guarda en rutinas.

Seleccionar activa: persiste active_routine y active_routine_name.

Modificar (Mod): abre editor para el ID seleccionado.

Eliminar: confirmación nativa y limpieza de persistencia.

Importar CSV: lee archivo, parsea con PapaParse y construye los días con ejercicios/series.

Entreno: registro y exportación Excel

Carrousels de Semana (1–12) y Día; tarjetas de ejercicios por día.

Estado del ejercicio: C / NC / OJ. Al marcar C con datos, se loggea en GLOBAL_LOG (fecha, rutina, semana, músculo, ejercicio, set, reps, kg, volumen, e1RM).

Placeholders de la sesión previa y trend icons (↑/↓) por reps/kg.

Exportar Excel “Semana N” con estructura limpia (anchos de columna, hoja por semana).

Evolución: métricas y gráficos

Filtros: Músculo → Ejercicio (opcional).

Métricas: Volumen (Reps×Carga), e1RM máx, Carga ponderada por rep, Reps totales.

Ejes X: Fecha / Sesión / Semana (agregación y orden por fecha real).

UI: botón Refrescar (recarga GLOBAL_LOG) y Borrar Historial (reset).

Videoteca de ejercicios

Lista por músculo → ejercicios → modal con YouTube.

Altura dinámica según formato (16:9 o 9:16) y limitación al 85% de la pantalla para Shorts.

Perfil y navegación

Perfil: acceso directo a Evolución y acciones de cuenta (placeholders).

Navegación: Stack + Tabs con headers transparentes y status bar configurado.

Almacenamiento local (AsyncStorage)

Claves principales utilizadas:

rutinas: lista de rutinas.

active_routine, active_routine_name: rutina activa.

routine_{ID}: definición completa (días → ejercicios → series).

progress: datos introducidos por serie (reps/kg).

last_session: última semana/día visitados.

GLOBAL_LOG: histórico de series para Evolución.

Ejemplo de entrada en GLOBAL_LOG (generada al completar un ejercicio):

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


Formato CSV para importar rutinas

Cabeceras esperadas:

rutinaNombre,dias,dia,musculo,ejercicio,repMin,repMax,extra


dias: total de días de la rutina (entero).

dia: 1-based (1…n).

extra: técnica opcional (Ninguno por defecto).

El import agrupa por día y por par (músculo, ejercicio) y apila las series.

Ejemplo:

rutinaNombre,dias,dia,musculo,ejercicio,repMin,repMax,extra
FullBody Novatos,3,1,PECTORAL,Press Banca con Barra,8,10,Ninguno
FullBody Novatos,3,1,ESPALDA,Remo con Barra,8,10,Ninguno
FullBody Novatos,3,2,PIERNA,Sentadilla,6,8,Ninguno


Instalación y ejecución

Requisitos

Node 20+, Expo, React Native.

Dependencias destacadas: expo-router, @react-native-async-storage/async-storage, @react-native-picker/picker, react-native-chart-kit, react-native-youtube-iframe, papaparse, xlsx, expo-file-system, expo-sharing.

Pasos

# Instalar
pnpm i   # o npm/yarn

# Ejecutar en desarrollo
npx expo start

# Web (opcional)
npx expo start --web

Build (EAS)

Compilación recomendada con EAS Build (Android/iOS). Configura tu EXPO_TOKEN y ejecuta:

eas build -p android --profile production
eas build -p ios --profile production


(El proyecto ya usa Expo Router y StatusBar/headers adaptados para Android/iOS.)

Roadmap

Exportar rutinas a CSV/JSON desde “Rutinas”.

Editor avanzado de ejercicios y plantillas.

Más métricas (RPE, tonelaje por sesión), filtros y comparativas en Evolución.

Videoteca ampliada con búsqueda y favoritos.

Changelog
1.3.0 — 2025-10-31

Mejoras visuales en pantallas y headers.

Rutinas genéricas añadidas (paquetes base para arrancar más rápido). (nuevo)

Sección de Videos con más contenido y soporte 16:9/9:16 en modal.

Login insertado. (nuevo; autenticación integrada en la app)

Cambios previos relevantes: Home con acceso directo a Videos y banner motivacional, versión visible; nueva pantalla de Evolución con métricas; exportación semanal a Excel desde Entreno.

Licencia

MIT — © TitoGeremito.
