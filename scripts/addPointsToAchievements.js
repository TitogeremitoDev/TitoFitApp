/**
 * Script para añadir horizon, difficulty y points a todos los logros
 * 
 * Este script procesa el archivo achievements.js y añade los campos necesarios
 * basándose en reglas heurísticas por categoría y tipo de logro.
 */

const fs = require('fs');
const path = require('path');

const filePath = '/home/german/Escritorio/APKFITNESS/TotalGains_App/src/data/achievements.js';
let content = fs.readFileSync(filePath, 'utf8');

// Multiplicadores por horizonte
const MULT = { DAY: 5, WEEK: 10, BLOCK: 20, LIFETIME: 40 };

// ═══════════════════════════════════════════════════════════════════════════
// REGLAS POR ID DE LOGRO
// ═══════════════════════════════════════════════════════════════════════════
const rules = {
    // VOLUMEN - Reps acumuladas (BLOCK a LIFETIME según cantidad)
    'canijo': ['BLOCK', 1],              // 1000 reps - inicio
    'no_tan_canijo': ['BLOCK', 2],       // 5000 reps
    'reps_machine': ['BLOCK', 3],        // 10000 reps
    'reps_legend': ['LIFETIME', 3],      // 50000 reps
    'reps_god': ['LIFETIME', 5],         // 100000 reps

    // VOLUMEN - Sesión (DAY)
    'tonelada_uno': ['DAY', 1],          // 1000kg/sesión
    'tonelada_cinco': ['DAY', 2],        // 5000kg/sesión
    'tonelada_diez': ['DAY', 3],         // 10000kg/sesión
    'tonelada_quince': ['DAY', 4],       // 15000kg/sesión
    'tonelada_veinte': ['DAY', 5],       // 20000kg/sesión

    // VOLUMEN - Acumulado total (BLOCK a LIFETIME)
    'despegue': ['BLOCK', 2],            // 50000kg total
    'cohete': ['BLOCK', 3],              // 100000kg
    'satelite': ['LIFETIME', 3],         // 500000kg
    'asteroide': ['LIFETIME', 4],        // 1M kg
    'planeta': ['LIFETIME', 5],          // 5M kg

    // VOLUMEN - Incrementos
    'ultra_volumen_semana': ['WEEK', 3], // +30% semana
    'ultra_volumen_mes': ['BLOCK', 4],   // +30% mes

    // VOLUMEN - Por grupo muscular
    'piernas_1000': ['BLOCK', 1],
    'piernas_5000': ['BLOCK', 2],
    'piernas_10000': ['BLOCK', 3],
    'piernas_50000': ['LIFETIME', 3],
    'push_1000': ['BLOCK', 1],
    'push_5000': ['BLOCK', 2],
    'push_10000': ['BLOCK', 3],
    'push_50000': ['LIFETIME', 3],
    'pull_1000': ['BLOCK', 1],
    'pull_5000': ['BLOCK', 2],
    'pull_10000': ['BLOCK', 3],
    'pull_50000': ['LIFETIME', 3],

    // CONSTANCIA - Primer entreno
    'day_one_war': ['DAY', 1],           // primer entreno

    // CONSTANCIA - Streaks cortos (WEEK)
    'three_in_a_row': ['WEEK', 1],       // 3 días seguidos
    'week_streak': ['WEEK', 2],          // 4+ en semana
    'two_weeks_streak': ['WEEK', 2],     // 2 semanas objetivo

    // CONSTANCIA - Streaks largos (BLOCK a LIFETIME)
    'month_streak': ['BLOCK', 3],        // 30 días
    'quarter_streak': ['BLOCK', 4],      // 90 días
    'half_year_streak': ['LIFETIME', 4], // 180 días
    'year_streak': ['LIFETIME', 5],      // 365 días

    // CONSTANCIA - Especiales
    'comeback': ['DAY', 1],              // volver tras 14 días
    'media_luna': ['DAY', 1],            // entreno nocturno
    'amanecer_hierros': ['DAY', 2],      // entreno madrugada
    'lunes_warrior': ['DAY', 1],         // entreno lunes
    'lunes_perfecto': ['WEEK', 2],       // 4 lunes seguidos
    'viernes_hierro': ['DAY', 1],        // entreno viernes
    'viernes_dominado': ['WEEK', 2],     // 4 viernes seguidos

    // CONSTANCIA - Workouts totales
    'workouts_10': ['WEEK', 1],
    'workouts_25': ['BLOCK', 1],
    'workouts_50': ['BLOCK', 2],
    'workouts_100': ['BLOCK', 3],
    'workouts_250': ['LIFETIME', 3],
    'workouts_500': ['LIFETIME', 4],
    'workouts_1000': ['LIFETIME', 5],

    // INTENSIDAD - PRs logrados
    'pr_primero': ['DAY', 1],
    'prs_primeros': ['DAY', 1],
    'prs_5': ['WEEK', 2],
    'prs_cinco': ['WEEK', 2],
    'prs_10': ['BLOCK', 2],
    'prs_diez': ['BLOCK', 2],
    'prs_20': ['BLOCK', 3],
    'prs_veinte': ['BLOCK', 3],
    'prs_50': ['LIFETIME', 3],
    'prs_cincuenta': ['LIFETIME', 3],
    'prs_100': ['LIFETIME', 4],
    'prs_cien': ['LIFETIME', 4],

    // INTENSIDAD - PRs en sesión
    'pr_session': ['DAY', 2],
    'doble_pr': ['DAY', 3],
    'pr_triple': ['DAY', 4],
    'triple_pr': ['DAY', 4],
    'pr_en_cada_musculo': ['DAY', 5],

    // INTENSIDAD - Pesos específicos
    'primer_plato': ['BLOCK', 2],        // 60kg
    'segundo_plato': ['BLOCK', 3],       // 100kg
    'tercer_plato': ['LIFETIME', 4],     // 140kg
    'centurion': ['LIFETIME', 5],        // 100kg en básicos

    // INTENSIDAD - PRs por ejercicio (BLOCK a LIFETIME)
    'bench_60': ['BLOCK', 2],
    'bench_80': ['BLOCK', 3],
    'bench_100': ['LIFETIME', 4],
    'bench_120': ['LIFETIME', 5],
    'squat_80': ['BLOCK', 2],
    'squat_100': ['BLOCK', 3],
    'squat_140': ['LIFETIME', 4],
    'squat_180': ['LIFETIME', 5],
    'deadlift_100': ['BLOCK', 2],
    'deadlift_140': ['BLOCK', 3],
    'deadlift_180': ['LIFETIME', 4],
    'deadlift_220': ['LIFETIME', 5],
    'legpress_100': ['BLOCK', 1],
    'legpress_200': ['BLOCK', 2],
    'legpress_300': ['BLOCK', 3],
    'legpress_400': ['LIFETIME', 4],
    'ohp_40': ['BLOCK', 2],
    'ohp_60': ['BLOCK', 3],
    'ohp_80': ['LIFETIME', 4],
    'ohp_100': ['LIFETIME', 5],

    // INTENSIDAD - Big Three
    'big_three_200': ['BLOCK', 2],
    'big_three_300': ['BLOCK', 3],
    'big_three_400': ['LIFETIME', 4],
    'big_three_500': ['LIFETIME', 5],

    // HÁBITOS
    'warmup_one': ['DAY', 1],
    'warmup_five': ['WEEK', 1],
    'warmup_master': ['BLOCK', 2],
    'mobility_one': ['DAY', 1],
    'mobility_five': ['WEEK', 1],
    'mobility_master': ['BLOCK', 2],
    'hydration_streak': ['WEEK', 2],
    'sleep_streak': ['WEEK', 2],
    'injury_free_month': ['BLOCK', 2],
    'injury_free_year': ['LIFETIME', 4],

    // MENTALIDAD
    'sin_skip_uno': ['DAY', 1],
    'sin_skip_diez': ['BLOCK', 2],
    'sin_skip_cien': ['LIFETIME', 4],
    'determinacion': ['DAY', 2],
    'disciplina_total': ['BLOCK', 3],

    // SOCIAL
    'share_workout': ['DAY', 1],
    'share_five': ['WEEK', 1],
    'influencer': ['BLOCK', 3],
    'referral_one': ['DAY', 1],
    'referral_five': ['BLOCK', 2],
    'referral_ten': ['BLOCK', 3],
    'coach_assign': ['WEEK', 3],

    // ═══════════════════════════════════════════════════════════════════════════
    // SEGUIMIENTO - PASOS
    // ═══════════════════════════════════════════════════════════════════════════
    'pasos_5k': ['DAY', 1],
    'pasos_8k': ['DAY', 2],
    'pasos_10k': ['DAY', 2],
    'pasos_15k': ['DAY', 3],
    'pasos_20k': ['DAY', 4],
    'pasos_semana_50k': ['WEEK', 2],
    'pasos_semana_70k': ['WEEK', 3],
    'pasos_semana_100k': ['WEEK', 4],
    'dias_5k_7': ['WEEK', 2],
    'dias_8k_7': ['WEEK', 3],
    'dias_10k_7': ['WEEK', 4],
    'dias_10k_30': ['BLOCK', 5],
    'semanas_10k_diario': ['BLOCK', 5],
    'pasos_100k_total': ['BLOCK', 2],
    'pasos_500k_total': ['BLOCK', 3],
    'pasos_1m_total': ['LIFETIME', 3],

    // CHECK-IN
    'checkin_primero': ['DAY', 1],
    'checkin_primer': ['DAY', 1],
    'checkin_semana': ['WEEK', 1],
    'checkin_7': ['WEEK', 1],
    'checkin_mes': ['BLOCK', 2],
    'checkin_30': ['BLOCK', 2],
    'checkin_streak_3': ['WEEK', 1],
    'checkin_streak_7': ['WEEK', 2],
    'checkin_streak_14': ['WEEK', 3],
    'checkin_streak_30': ['BLOCK', 4],
    'checkin_streak_60': ['BLOCK', 5],
    'checkin_50': ['BLOCK', 2],
    'checkin_100': ['LIFETIME', 3],
    'checkin_365': ['LIFETIME', 4],

    // CHECK-IN SEMANAL
    'weekly_checkin_primero': ['WEEK', 1],
    'weekly_checkin_4': ['BLOCK', 2],
    'weekly_checkin_12': ['BLOCK', 3],
    'weekly_checkin_streak_4': ['BLOCK', 3],
    'weekly_checkin_streak_8': ['BLOCK', 4],
    'weekly_checkin_52': ['LIFETIME', 4],

    // SUEÑO
    'sueno_7h': ['DAY', 1],
    'sueno_7h_dia': ['DAY', 1],
    'sueno_8h': ['DAY', 2],
    'sueno_8h_dia': ['DAY', 2],
    'sueno_9h': ['DAY', 2],
    'sueno_streak_3_7h': ['WEEK', 2],
    'sueno_streak_7_7h': ['WEEK', 3],
    'sueno_streak_7_8h': ['WEEK', 4],
    'sueno_streak_14_7h': ['BLOCK', 3],
    'sueno_streak_30_7h': ['BLOCK', 5],
    'sueno_7_dias_7h': ['WEEK', 2],
    'sueno_7_dias_8h': ['WEEK', 3],
    'sueno_30_dias_7h': ['BLOCK', 4],
    'sueno_promedio_7h': ['WEEK', 2],
    'sueno_promedio_8h': ['BLOCK', 3],

    // ÁNIMO
    'animo_positivo': ['DAY', 1],
    'animo_4': ['DAY', 1],
    'animo_excelente': ['DAY', 2],
    'animo_5': ['DAY', 2],
    'animo_bueno_3': ['WEEK', 1],
    'animo_bueno_7': ['WEEK', 2],
    'animo_streak_3': ['WEEK', 2],
    'animo_streak_7': ['WEEK', 3],
    'animo_streak_14': ['BLOCK', 3],
    'animo_streak_30': ['BLOCK', 4],
    'animo_mes_positivo': ['BLOCK', 3],
    'animo_excelente_10': ['BLOCK', 3],
    'animo_excelente_30': ['LIFETIME', 4],

    // ENERGÍA
    'energia_alta': ['DAY', 1],
    'energia_4': ['DAY', 1],
    'energia_maxima': ['DAY', 2],
    'energia_5': ['DAY', 2],
    'energia_buena_3': ['WEEK', 1],
    'energia_buena_7': ['WEEK', 2],
    'energia_streak_3': ['WEEK', 2],
    'energia_streak_7': ['WEEK', 3],
    'energia_streak_14': ['BLOCK', 3],
    'energia_alta_10': ['BLOCK', 2],
    'energia_alta_30': ['BLOCK', 4],

    // NUTRICIÓN
    'nutri_adherencia_8': ['WEEK', 2],
    'nutri_8': ['WEEK', 2],
    'nutri_adherencia_9': ['WEEK', 3],
    'nutri_adherencia_10': ['WEEK', 4],
    'nutri_10': ['WEEK', 4],
    'nutri_perfecta': ['WEEK', 4],
    'nutri_streak_2': ['WEEK', 2],
    'nutri_streak_4': ['BLOCK', 3],
    'nutri_streak_8': ['BLOCK', 4],
    'nutri_streak_12': ['BLOCK', 5],
    'nutri_perfecta_mes': ['BLOCK', 5],
    'nutri_perfecta_4_semanas': ['BLOCK', 5],

    // PESO
    'peso_primero': ['DAY', 1],
    'peso_primer': ['DAY', 1],
    'peso_seguimiento_primero': ['DAY', 1],
    'peso_semana': ['WEEK', 1],
    'peso_7_dias': ['WEEK', 1],
    'peso_mes': ['BLOCK', 2],
    'peso_30_dias': ['BLOCK', 2],
    'peso_estable': ['BLOCK', 3],
    'peso_estable_mes': ['BLOCK', 3],
    'peso_objetivo': ['BLOCK', 4],
    'peso_meta': ['BLOCK', 4],
    'peso_100_logs': ['LIFETIME', 3],

    // REFLEXIÓN
    'reflexion_primera': ['WEEK', 1],
    'reflexion_primer': ['WEEK', 1],
    'reflexion_4': ['BLOCK', 2],
    'reflexion_mes': ['BLOCK', 2],
    'reflexion_12': ['BLOCK', 3],
    'reflexion_streak_4': ['BLOCK', 3],
    'reflexion_streak_8': ['BLOCK', 4],
    'mejora_identificada': ['WEEK', 1],
    'mejora_primera': ['WEEK', 1],
    'reflexion_52': ['LIFETIME', 4],

    // COMBOS
    'combo_diario_completo': ['DAY', 3],
    'combo_diario': ['DAY', 3],
    'combo_semanal_completo': ['WEEK', 4],
    'combo_semanal': ['WEEK', 4],
    'combo_entreno_checkin': ['DAY', 2],
    'combo_mes_perfecto': ['BLOCK', 5],
    'combo_perfecto_mes': ['BLOCK', 5],
    'combo_triple': ['DAY', 3],
    'combo_cuadruple': ['DAY', 4],
    'combo_quintuple': ['DAY', 5],
    'combo_semana_perfecta': ['WEEK', 5],

    // EASTER EGGS
    'usuario_antiguo': ['LIFETIME', 3],
    'progresando': ['LIFETIME', 4],
    'año_entrenando': ['LIFETIME', 3],
    'veterano': ['LIFETIME', 4],
    'leyenda': ['LIFETIME', 5],
    'misterioso': ['DAY', 2],
    'nocturno': ['DAY', 2],
    'madrugador': ['DAY', 2],
};

// ═══════════════════════════════════════════════════════════════════════════
// VALORES POR DEFECTO POR CATEGORÍA (para logros no definidos)
// ═══════════════════════════════════════════════════════════════════════════
const categoryDefaults = {
    'volumen': ['BLOCK', 2],
    'constancia': ['WEEK', 2],
    'intensidad': ['BLOCK', 3],
    'habitos': ['WEEK', 2],
    'mentalidad': ['BLOCK', 2],
    'social': ['WEEK', 2],
    'pasos': ['DAY', 2],
    'checkin': ['WEEK', 2],
    'sueno': ['WEEK', 2],
    'animo': ['DAY', 2],
    'energia': ['DAY', 2],
    'nutricion': ['WEEK', 3],
    'peso': ['WEEK', 2],
    'reflexion': ['WEEK', 2],
    'combos': ['DAY', 3],
    'easter_egg': ['LIFETIME', 3],
};

// ═══════════════════════════════════════════════════════════════════════════
// PROCESAR ARCHIVO
// ═══════════════════════════════════════════════════════════════════════════

// Regex para encontrar logros
const achievementRegex = /\{\s*id:\s*'([^']+)',\s*\n\s*name:/g;
let match;
let processed = 0;
let usedDefault = 0;

// Crear mapa de posiciones
const positions = [];
while ((match = achievementRegex.exec(content)) !== null) {
    positions.push({
        id: match[1],
        index: match.index,
        fullMatch: match[0]
    });
}

console.log(`Encontrados ${positions.length} logros`);

// Procesar de atrás hacia adelante para no afectar índices
positions.reverse().forEach(pos => {
    let horizon, difficulty;

    if (rules[pos.id]) {
        [horizon, difficulty] = rules[pos.id];
    } else {
        // Buscar categoría en el contexto cercano
        const nearbyContent = content.slice(Math.max(0, pos.index - 200), pos.index + 500);
        const catMatch = nearbyContent.match(/category:\s*'([^']+)'/);
        const category = catMatch ? catMatch[1] : 'volumen';
        [horizon, difficulty] = categoryDefaults[category] || ['WEEK', 2];
        usedDefault++;
    }

    const points = MULT[horizon] * difficulty;

    // Insertar los nuevos campos
    const insertion = `{\n        id: '${pos.id}',\n        horizon: '${horizon}',\n        difficulty: ${difficulty},\n        points: ${points},\n        name:`;

    content = content.slice(0, pos.index) + insertion + content.slice(pos.index + pos.fullMatch.length);
    processed++;
});

console.log(`Procesados: ${processed} logros`);
console.log(`Con valores por defecto: ${usedDefault}`);

// Guardar
fs.writeFileSync(filePath, content);
console.log('✅ Archivo guardado correctamente');

// Verificar
const verification = content.match(/horizon: '/g);
console.log(`Verificación: ${verification ? verification.length : 0} campos 'horizon' añadidos`);
