/**
 * pdfGenerator.js - Branded PDF Generator for Nutrition Plans
 * Generates A4 Landscape PDFs with coach branding and watermark
 * 
 * DETECTS plan type:
 * - If weekMap/weekSchedule exists with different template IDs per day → DAYS mode
 * - Otherwise → OPTIONS mode
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

/**
 * Convert a remote image URL to a base64 data URI.
 * Returns null if the conversion fails.
 */
const imageUrlToBase64 = async (url) => {
    if (!url) return null;
    // Already a data URI
    if (url.startsWith('data:')) return url;
    try {
        const localUri = FileSystem.cacheDirectory + 'pdf_logo_' + Date.now() + '.tmp';
        console.log('[PDF Generator] Downloading logo from:', url.substring(0, 80) + '...');
        const downloadResult = await FileSystem.downloadAsync(url, localUri);
        console.log('[PDF Generator] Download result status:', downloadResult.status);
        if (downloadResult.status !== 200) {
            console.warn('[PDF Generator] Logo download failed with status:', downloadResult.status);
            return null;
        }
        const base64 = await FileSystem.readAsStringAsync(downloadResult.uri, {
            encoding: FileSystem.EncodingType.Base64,
        });
        // Clean up temp file
        FileSystem.deleteAsync(downloadResult.uri, { idempotent: true }).catch(() => {});
        if (!base64 || base64.length < 100) {
            console.warn('[PDF Generator] Base64 result too small, likely failed');
            return null;
        }
        // Detect mime type from content (first bytes) or fallback to URL extension
        let mime = 'image/png';
        if (base64.startsWith('/9j/')) mime = 'image/jpeg';
        else if (base64.startsWith('UklGR')) mime = 'image/webp';
        else if (base64.startsWith('iVBOR')) mime = 'image/png';
        else {
            const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
            if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
            else if (ext === 'webp') mime = 'image/webp';
        }
        console.log('[PDF Generator] Logo converted to base64 successfully, mime:', mime, 'size:', base64.length);
        return `data:${mime};base64,${base64}`;
    } catch (err) {
        console.warn('[PDF Generator] Failed to convert logo to base64:', err.message);
        return null;
    }
};

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/**
 * Convert hex color to rgba string with given alpha
 */
const hexToRgba = (hex, alpha = 1) => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substr(0, 2), 16);
    const g = parseInt(cleanHex.substr(2, 2), 16);
    const b = parseInt(cleanHex.substr(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Blend a hex color with white at a given alpha, returning a SOLID hex color.
 * PDF renderers (expo-print / WebView) often distort RGBA colors,
 * so we pre-compute the final blended color as a solid hex value.
 * e.g. blendWithWhite('#8B5A2B', 0.35) → '#d9c4ab' (brown at 35% on white)
 */
const blendWithWhite = (hex, alpha = 1) => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substr(0, 2), 16);
    const g = parseInt(cleanHex.substr(2, 2), 16);
    const b = parseInt(cleanHex.substr(4, 2), 16);
    // Blend with white (255): result = color * alpha + 255 * (1 - alpha)
    const br = Math.round(r * alpha + 255 * (1 - alpha));
    const bg = Math.round(g * alpha + 255 * (1 - alpha));
    const bb = Math.round(b * alpha + 255 * (1 - alpha));
    return `#${br.toString(16).padStart(2, '0')}${bg.toString(16).padStart(2, '0')}${bb.toString(16).padStart(2, '0')}`;
};

/**
 * Get relative luminance of a hex color (0 = black, 1 = white)
 */
const getLuminance = (hex) => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substr(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substr(2, 2), 16) / 255;
    const b = parseInt(cleanHex.substr(4, 2), 16) / 255;
    // Perceived brightness (YIQ formula)
    return (r * 0.299 + g * 0.587 + b * 0.114);
};

/**
 * Darken a hex color by a given factor (0-1, where 0 = black)
 */
const darkenHex = (hex, factor) => {
    const cleanHex = hex.replace('#', '');
    const r = Math.round(parseInt(cleanHex.substr(0, 2), 16) * factor);
    const g = Math.round(parseInt(cleanHex.substr(2, 2), 16) * factor);
    const b = Math.round(parseInt(cleanHex.substr(4, 2), 16) * factor);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

/**
 * Ensure a color has enough contrast to be used as TEXT on a light/white background.
 * If the color is too light (like gold, yellow, lime), darken it.
 * Returns a CSS-safe color string.
 */
const ensureTextContrast = (hex) => {
    const lum = getLuminance(hex);
    // If luminance is high (light color), darken it for readability
    if (lum > 0.55) {
        // Darken proportionally: the lighter it is, the more we darken
        const factor = Math.max(0.35, 0.55 / lum);
        return darkenHex(hex, factor);
    }
    return hex;
};

/**
 * Get white or dark text color for use ON a colored background.
 */
const getContrastTextOnColor = (hex) => {
    return getLuminance(hex) > 0.55 ? '#1e293b' : '#ffffff';
};

/**
 * Map internal font names to Google Fonts CSS import URLs and family names
 */
const FONT_MAP = {
    'Montserrat-Bold': { family: 'Montserrat', weight: '700', import: 'Montserrat:wght@400;600;700;800' },
    'PlayfairDisplay-Bold': { family: 'Playfair Display', weight: '700', import: 'Playfair+Display:wght@400;600;700;800' },
    'Oswald-Bold': { family: 'Oswald', weight: '700', import: 'Oswald:wght@400;500;600;700' },
    'Roboto-Bold': { family: 'Roboto', weight: '700', import: 'Roboto:wght@400;500;700' },
};

/**
 * Detect if plan is structured by DAYS or by OPTIONS
 */
const detectPlanType = (plan) => {
    const weekMap = plan?.weekMap || plan?.customPlan?.weekSchedule;
    if (!weekMap) return 'OPTIONS';

    // Check if different days have different template IDs
    const templateIds = DAY_KEYS.map(day => weekMap[day]).filter(Boolean);
    const uniqueTemplates = [...new Set(templateIds)];

    // If there's more than 1 unique template, it's structured by DAYS
    return uniqueTemplates.length > 1 ? 'DAYS' : 'OPTIONS';
};

/**
 * Generate HTML for OPTIONS-based plan (Opción 1, Opción 2, etc as columns)
 */
const generateOptionsHTML = ({ meals, hideMacros, primaryColor }) => {
    // Find max options across all meals
    let maxOptions = 0;
    meals.forEach(meal => {
        const optCount = meal.options?.length || 0;
        if (optCount > maxOptions) maxOptions = optCount;
    });
    maxOptions = Math.max(maxOptions, 1);

    // Header row
    let headerCells = '<th class="meal-header">Comida</th>';
    for (let i = 0; i < maxOptions; i++) {
        headerCells += `<th>Opción ${i + 1}</th>`;
    }

    // Body rows
    let tableRows = '';
    meals.forEach(meal => {
        let row = `<tr>
            <td class="meal-label">
                <span class="meal-icon">${meal.icon || '🍽️'}</span>
                <span class="meal-name">${meal.name || 'Comida'}</span>
            </td>`;

        for (let optIdx = 0; optIdx < maxOptions; optIdx++) {
            row += generateCellHTML(meal.options?.[optIdx], hideMacros, primaryColor);
        }
        row += '</tr>';
        tableRows += row;

        // Supplements row (spans all option columns)
        if (meal.supplements && meal.supplements.length > 0) {
            tableRows += `<tr><td colspan="${maxOptions + 1}" class="supplements-row">
                ${generateSupplementsHTML(meal.supplements)}
            </td></tr>`;
        }
    });

    return { headerCells, tableRows };
};

/**
 * Generate HTML for DAYS-based plan (Lunes, Martes, etc as columns)
 */
const generateDaysHTML = ({ plan, hideMacros, primaryColor }) => {
    const templates = plan?.dayTemplates || plan?.customPlan?.dayTargets || [];
    const weekMap = plan?.weekMap || plan?.customPlan?.weekSchedule || {};

    // Get all unique meals across all templates
    const allMeals = [];
    const mealSet = new Set();
    templates.forEach(template => {
        (template.meals || []).forEach(meal => {
            if (!mealSet.has(meal.name)) {
                mealSet.add(meal.name);
                allMeals.push({ name: meal.name, icon: meal.icon || '🍽️', order: meal.order || 0 });
            }
        });
    });
    allMeals.sort((a, b) => a.order - b.order);

    // Header row (Days)
    let headerCells = '<th class="meal-header">Comida</th>';
    DAY_LABELS.forEach(day => {
        headerCells += `<th>${day}</th>`;
    });

    // Body rows
    let tableRows = '';
    allMeals.forEach(mealDef => {
        let row = `<tr>
            <td class="meal-label">
                <span class="meal-icon">${mealDef.icon}</span>
                <span class="meal-name">${mealDef.name}</span>
            </td>`;

        DAY_KEYS.forEach(dayKey => {
            const templateId = weekMap[dayKey];
            const template = templates.find(t => (t.id || t._id) === templateId) || templates[0];
            const meal = template?.meals?.find(m => m.name === mealDef.name);

            // For day-based, show first option of each meal + supplements
            row += generateCellHTML(meal?.options?.[0], hideMacros, primaryColor, meal?.supplements);
        });

        row += '</tr>';
        tableRows += row;
    });

    return { headerCells, tableRows };
};

/**
 * Generate HTML for supplement pills
 */
const generateSupplementsHTML = (supplements) => {
    return `<div class="supplements-container">
        <span class="supplements-label">💊 Suplementos:</span>
        ${supplements.map(s =>
        `<span class="supplement-pill">${s.name} — ${s.amount} ${s.unit}</span>`
    ).join('')}
    </div>`;
};

/**
 * Generate HTML for a single cell (option)
 */
const generateCellHTML = (option, hideMacros, primaryColor, supplements) => {
    if (!option || !option.foods || option.foods.length === 0) {
        // Even if no foods, show supplements if present
        if (supplements && supplements.length > 0) {
            return `<td class="meal-cell">${generateSupplementsHTML(supplements)}</td>`;
        }
        return `<td class="meal-cell empty">-</td>`;
    }

    const foods = option.foods;
    const optionName = option.name || foods[0]?.name || 'Sin nombre';

    // Ingredients list
    const ingredientsList = foods.map(f => {
        const amount = f.amount || f.quantity || '';
        const unit = f.unit || '';
        const amountStr = unit === 'a_gusto' ? ' (libre)' : (amount ? ` (${amount}${unit})` : '');
        return `<div class="food-item">${f.name || 'Alimento'}${amountStr}</div>`;
    }).join('');

    // Macros (only if not hidden)
    let macroSummary = '';
    if (!hideMacros) {
        const totals = foods.reduce((acc, f) => ({
            kcal: acc.kcal + (f.kcal || 0),
            protein: acc.protein + (f.protein || 0),
            carbs: acc.carbs + (f.carbs || 0),
            fat: acc.fat + (f.fat || 0),
        }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

        macroSummary = `<div class="option-macros">
            <span class="macro-badge">${Math.round(totals.kcal)} kcal</span>
            <span class="macro-detail">P:${Math.round(totals.protein)}g C:${Math.round(totals.carbs)}g G:${Math.round(totals.fat)}g</span>
        </div>`;
    }

    const supplementsSection = (supplements && supplements.length > 0)
        ? generateSupplementsHTML(supplements)
        : '';

    const coachNoteSection = option.coachNote
        ? `<div class="coach-note"><span class="coach-note-icon">📝</span> ${option.coachNote}</div>`
        : '';

    return `<td class="meal-cell">
        <div class="option-name">${optionName}</div>
        <div class="foods-list">${ingredientsList}</div>
        ${macroSummary}
        ${coachNoteSection}
        ${supplementsSection}
    </td>`;
};

/**
 * Generate full HTML template
 */
const generateHTMLTemplate = ({ plan, coachBranding, clientName, hideMacros }) => {
    const primaryColor = coachBranding?.primaryColor || '#3b82f6';
    const secondaryColor = coachBranding?.secondaryColor || primaryColor;
    const fontFamily = coachBranding?.fontFamily || 'System';
    const coachName = coachBranding?.coachName || '';
    const logoUrl = coachBranding?.logoUrl || null;

    // Resolve Google Font import and CSS family
    const fontConfig = FONT_MAP[fontFamily];
    const googleFontImport = fontConfig
        ? `@import url('https://fonts.googleapis.com/css2?family=${fontConfig.import}&display=swap');`
        : '';
    const cssFontFamily = fontConfig
        ? `'${fontConfig.family}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
        : `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

    // Pre-compute SOLID colors (blended with white) for PDF fidelity
    // PDF renderers distort RGBA — solid hex colors render identically everywhere
    const primaryBgLight = blendWithWhite(primaryColor, 0.06);
    const secondaryBgLight = blendWithWhite(secondaryColor, 0.06);
    const primaryBorderColor = blendWithWhite(primaryColor, 0.35);
    const primaryMealLabelBg = blendWithWhite(primaryColor, 0.10);

    // Contrast-safe text colors (darkens light colors like gold/yellow/lime)
    const primaryTextColor = ensureTextContrast(primaryColor);
    const thTextColor = getContrastTextOnColor(primaryColor);

    // Detect plan type
    const planType = detectPlanType(plan);

    // Get meals for OPTIONS mode or generate DAYS structure
    let headerCells, tableRows;

    if (planType === 'DAYS') {
        const result = generateDaysHTML({ plan, hideMacros, primaryColor });
        headerCells = result.headerCells;
        tableRows = result.tableRows;
    } else {
        // OPTIONS mode - use first template's meals
        const templates = plan?.dayTemplates || plan?.customPlan?.dayTargets || [];
        const mainTemplate = templates[0] || {};
        const meals = [...(mainTemplate.meals || [])].sort((a, b) => (a.order || 0) - (b.order || 0));

        const result = generateOptionsHTML({ meals, hideMacros, primaryColor });
        headerCells = result.headerCells;
        tableRows = result.tableRows;
    }

    // Watermark = Coach name (REAL name, not fallback)
    const watermarkText = coachName;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Plan Nutricional - ${clientName}</title>
    <style>
        ${googleFontImport}

        @page {
            size: A4 landscape;
            margin: 8mm;
        }
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body {
            font-family: ${cssFontFamily};
            font-size: 10px;
            color: #1e293b;
            background: #fff;
            position: relative;
            min-height: 100vh;
        }
        
        /* Watermark - COACH NAME */
        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 90px;
            font-weight: 900;
            opacity: 0.06;
            z-index: 1;
            color: ${primaryColor};
            white-space: nowrap;
            pointer-events: none;
            letter-spacing: -2px;
            text-transform: uppercase;
        }

        /* Watermark - LOGO (large centered, visible but non-intrusive) */
        .watermark-logo {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 400px;
            height: 400px;
            opacity: 0.12;
            z-index: 1;
            pointer-events: none;
            object-fit: contain;
        }

        /* Footer logo - bottom right */
        .footer-logo {
            width: 36px;
            height: 36px;
            object-fit: contain;
            border-radius: 6px;
        }
        
        /* Header */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 3px solid ${primaryColor};
            margin-bottom: 12px;
        }
        
        .header-left {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .header-logo {
            width: 50px;
            height: 50px;
            object-fit: contain;
            border-radius: 8px;
        }
        
        .header-logo-placeholder {
            width: 50px;
            height: 50px;
            background: ${primaryColor};
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 900;
            font-size: 26px;
        }
        
        .header-title {
            font-size: 18px;
            font-weight: 800;
            color: ${primaryTextColor};
        }
        
        .header-subtitle {
            font-size: 10px;
            color: #64748b;
        }
        
        .header-right { text-align: right; }
        
        .client-name {
            font-size: 13px;
            font-weight: 700;
            color: #1e293b;
        }
        
        .date-generated {
            font-size: 9px;
            color: #94a3b8;
        }
        
        /* Table */
        table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }
        
        th, td {
            border: 1px solid ${primaryBorderColor};
            padding: 5px 4px;
            text-align: left;
            vertical-align: top;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        
        th {
            background: ${primaryColor};
            color: ${thTextColor};
            font-weight: 700;
            font-size: 9px;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            padding: 7px 4px;
        }
        
        th.meal-header {
            width: 70px;
            background: #1e293b;
        }
        
        tr { page-break-inside: avoid; }
        
        .meal-label {
            background: ${primaryMealLabelBg};
            font-weight: 700;
            font-size: 9px;
            color: ${primaryTextColor};
            text-align: center;
            vertical-align: middle;
            padding: 8px 4px;
        }
        
        .meal-icon { display: block; font-size: 14px; margin-bottom: 2px; }
        .meal-name { display: block; font-size: 8px; text-transform: uppercase; letter-spacing: 0.3px; }
        
        /* Alternate cell colors using branding */
        tr:nth-child(odd) .meal-cell {
            background: ${primaryBgLight};
        }
        tr:nth-child(even) .meal-cell {
            background: ${secondaryBgLight};
        }

        .meal-cell {
            font-size: 8px;
            line-height: 1.3;
            min-height: 50px;
            padding: 4px;
        }
        
        .meal-cell.empty {
            text-align: center;
            color: #cbd5e1;
            vertical-align: middle;
        }
        
        .option-name {
            font-weight: 700;
            font-size: 9px;
            color: ${primaryTextColor};
            margin-bottom: 4px;
            padding-bottom: 3px;
            border-bottom: 1px solid ${blendWithWhite(primaryColor, 0.18)};
        }
        
        .foods-list { margin-bottom: 4px; }
        
        .food-item {
            margin-bottom: 2px;
            color: #334155;
            font-size: 8px;
        }
        
        .option-macros {
            margin-top: 4px;
            padding-top: 3px;
            border-top: 1px dashed ${blendWithWhite(primaryColor, 0.18)};
        }
        
        .macro-badge {
            background: ${blendWithWhite(primaryColor, 0.12)};
            color: ${primaryTextColor};
            padding: 2px 4px;
            border-radius: 3px;
            font-size: 7px;
            font-weight: 700;
        }
        
        .macro-detail {
            font-size: 7px;
            color: #64748b;
            margin-left: 4px;
        }
        
        /* Supplements */
        .supplements-row {
            background: #faf5ff;
            padding: 4px 8px;
        }

        .supplements-container {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 4px;
            margin-top: 4px;
        }

        .supplements-label {
            font-size: 7px;
            font-weight: 700;
            color: #7c3aed;
        }

        .supplement-pill {
            display: inline-block;
            background: #f5f3ff;
            border: 1px solid #e9d5ff;
            border-radius: 8px;
            padding: 1px 6px;
            font-size: 7px;
            color: #7c3aed;
            font-weight: 500;
        }

        .coach-note {
            margin-top: 4px;
            padding: 3px 5px;
            background: #fffbeb;
            border-left: 2px solid #f59e0b;
            border-radius: 0 4px 4px 0;
            font-size: 7px;
            color: #92400e;
            font-style: italic;
            line-height: 1.3;
        }

        .coach-note-icon {
            font-style: normal;
        }

        .footer {
            margin-top: 10px;
            padding-top: 8px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            font-size: 8px;
            color: #94a3b8;
        }
    </style>
</head>
<body>
    ${watermarkText ? `<div class="watermark">${watermarkText}</div>` : ''}
    ${logoUrl ? `<img src="${logoUrl}" class="watermark-logo" alt="" onerror="this.remove()" />` : ''}

    <div class="header">
        <div class="header-left">
            ${logoUrl
            ? `<img src="${logoUrl}" class="header-logo" alt="" onerror="var ph=document.createElement('div');ph.className='header-logo-placeholder';ph.textContent='${(coachName || 'C').charAt(0).toUpperCase()}';this.parentNode.replaceChild(ph,this);" />`
            : `<div class="header-logo-placeholder">${(coachName || 'C').charAt(0).toUpperCase()}</div>`
        }
            <div>
                <div class="header-title">Plan Nutricional</div>
                <div class="header-subtitle">Diseñado por ${coachName || 'Tu Entrenador'}</div>
            </div>
        </div>
        <div class="header-right">
            <div class="client-name">📋 ${clientName || 'Cliente'}</div>
            <div class="date-generated">Generado: ${new Date().toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        })}</div>
        </div>
    </div>
    
    <table>
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${tableRows}</tbody>
    </table>
    
    <div class="footer">
        <div>💪 Plan generado por ${coachName || 'Tu Entrenador'}</div>
        <div style="display: flex; align-items: center; gap: 8px;">
            <span>© ${new Date().getFullYear()}</span>
            ${logoUrl ? `<img src="${logoUrl}" class="footer-logo" alt="" onerror="this.remove()" />` : ''}
        </div>
    </div>
</body>
</html>
    `;
};

/**
 * Generate a PDF from the nutrition plan
 * On native: creates a PDF file and returns { uri }
 * On web: opens browser print dialog (no file URI)
 */
export async function generateNutritionPDF({ plan, coachBranding, clientName, hideMacros = false }) {
    try {
        // Convert remote logo URL to base64 data URI so expo-print can render it
        let brandingWithBase64Logo = coachBranding;
        if (coachBranding?.logoUrl && Platform.OS !== 'web') {
            const base64Logo = await imageUrlToBase64(coachBranding.logoUrl);
            if (base64Logo) {
                brandingWithBase64Logo = { ...coachBranding, logoUrl: base64Logo };
            }
        }

        const html = generateHTMLTemplate({ plan, coachBranding: brandingWithBase64Logo, clientName, hideMacros });

        if (Platform.OS === 'web') {
            // Web: open new window with HTML content, then trigger print
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(html);
                printWindow.document.close();
                // Wait for images to load before printing
                printWindow.onload = () => {
                    printWindow.focus();
                    printWindow.print();
                };
                // Fallback if onload doesn't fire (some browsers)
                setTimeout(() => {
                    printWindow.focus();
                    printWindow.print();
                }, 500);
            }
            return { uri: null };
        }

        const { uri } = await Print.printToFileAsync({
            html,
            width: 842,
            height: 595,
            base64: false,
        });

        return { uri };
    } catch (error) {
        console.error('[PDF Generator] Error generating PDF:', error);
        throw error;
    }
}

/**
 * Generate and share a PDF of the nutrition plan
 * On web: opens print dialog (save as PDF from there)
 * On native: generates file then opens native share sheet
 */
export async function generateAndShareNutritionPDF({ plan, coachBranding, clientName, hideMacros = false }) {
    try {
        const { uri } = await generateNutritionPDF({ plan, coachBranding, clientName, hideMacros });

        // Web already handled via print dialog inside generateNutritionPDF
        if (Platform.OS === 'web') {
            return { success: true, uri: null };
        }

        const isAvailable = await Sharing.isAvailableAsync();

        if (isAvailable) {
            await Sharing.shareAsync(uri, {
                mimeType: 'application/pdf',
                dialogTitle: 'Compartir Plan Nutricional',
                UTI: 'com.adobe.pdf',
            });
            return { success: true, uri };
        } else {
            return { success: false, error: 'Sharing not available', uri };
        }
    } catch (error) {
        console.error('[PDF Generator] Error sharing PDF:', error);
        throw error;
    }
}

export default { generateNutritionPDF, generateAndShareNutritionPDF };
