#!/usr/bin/env node
/**
 * Script para generar iconos de alta calidad para iOS y Android
 * desde el SVG fuente usando sharp.
 * 
 * Uso: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SVG_SOURCE = path.join(__dirname, '../assets/images/mi-logo-icono.svg');
const IMAGES_DIR = path.join(__dirname, '../assets/images');

// Tamaños para Android Adaptive Icons (lienzo completo 108dp base)
const ANDROID_SIZES = {
    mdpi: 108,    // 1x
    hdpi: 162,    // 1.5x
    xhdpi: 216,   // 2x
    xxhdpi: 324,  // 3x
    xxxhdpi: 432, // 4x
};

// iOS requiere 1024x1024 sin transparencia
const IOS_SIZE = 1024;

// Icono general de Expo
const EXPO_ICON_SIZE = 1024;

async function main() {
    console.log('🎯 Generando iconos de alta calidad...\n');

    // Verificar que el SVG existe
    if (!fs.existsSync(SVG_SOURCE)) {
        console.error('❌ Error: No se encontró el archivo SVG en:', SVG_SOURCE);
        process.exit(1);
    }

    const svgBuffer = fs.readFileSync(SVG_SOURCE);

    try {
        // 1. Generar icono principal de Expo (1024x1024)
        console.log('📱 Generando icono principal de Expo...');
        const expoIcon = path.join(IMAGES_DIR, 'icon.png');
        await sharp(svgBuffer, { density: 300 })
            .resize(EXPO_ICON_SIZE, EXPO_ICON_SIZE)
            .png()
            .toFile(expoIcon);
        console.log(`  ✅ icon.png (${EXPO_ICON_SIZE}x${EXPO_ICON_SIZE})`);

        // 2. Generar icono para iOS (1024x1024 con fondo sólido, sin transparencia)
        console.log('\n🍎 Generando icono para iOS (sin transparencia)...');
        const iosIcon = path.join(IMAGES_DIR, 'icon-ios.png');
        await sharp(svgBuffer, { density: 300 })
            .resize(IOS_SIZE, IOS_SIZE)
            .flatten({ background: { r: 4, g: 8, b: 17 } }) // #040811
            .png()
            .toFile(iosIcon);
        console.log(`  ✅ icon-ios.png (${IOS_SIZE}x${IOS_SIZE})`);

        // 3. Generar iconos Android Adaptive (foreground) - todos los tamaños
        console.log('\n🤖 Generando iconos Android Adaptive...');

        for (const [density, size] of Object.entries(ANDROID_SIZES)) {
            const outputPath = path.join(IMAGES_DIR, `adaptive-icon-foreground-${density}.png`);
            await sharp(svgBuffer, { density: 300 })
                .resize(size, size)
                .png()
                .toFile(outputPath);
            console.log(`  ✅ adaptive-icon-foreground-${density}.png (${size}x${size})`);
        }

        // Generar también el foreground principal a tamaño xxxhdpi (432px)
        const androidForeground = path.join(IMAGES_DIR, 'adaptive-icon-foreground.png');
        await sharp(svgBuffer, { density: 300 })
            .resize(432, 432)
            .png()
            .toFile(androidForeground);
        console.log(`  ✅ adaptive-icon-foreground.png (432x432)`);

        console.log('\n✨ ¡Proceso completado!');
        console.log('\n📋 Archivos generados:');
        console.log('  - assets/images/icon.png (icono principal Expo)');
        console.log('  - assets/images/icon-ios.png (icono iOS sin transparencia)');
        console.log('  - assets/images/adaptive-icon-foreground.png (Android foreground)');
        console.log('  - assets/images/adaptive-icon-foreground-[densidad].png (por densidad)');
        console.log('\n💡 Recuerda actualizar app.json si es necesario.');

    } catch (error) {
        console.error('❌ Error durante la generación:', error.message);
        process.exit(1);
    }
}

main();
