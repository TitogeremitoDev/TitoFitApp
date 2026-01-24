/**
 * script/seedFoods.js
 * 
 * Operation Seeding: Inject essential system foods.
 * Usage (Backend): node seedFoods.js
 */

const SYSTEM_FOODS = [
    {
        "name": "Arroz con Pollo Clásico",
        "isSystem": true,
        "image": "https://images.unsplash.com/photo-1594970420130-388f8373e0a3?auto=format&fit=crop&w=500&q=60",
        "nutrients": { "kcal": 130, "protein": 12, "carbs": 24, "fat": 2 },
        "servingSize": 300,
        "tags": ["Comida", "Alto Proteína", "Básico"]
    },
    {
        "name": "Tortilla Francesa (2 Huevos)",
        "isSystem": true,
        "image": "https://images.unsplash.com/photo-1587132137056-bfbf0166836e?auto=format&fit=crop&w=500&q=60",
        "nutrients": { "kcal": 154, "protein": 11, "carbs": 1, "fat": 11 },
        "servingSize": 120,
        "tags": ["Desayuno", "Cena", "Rápido"]
    },
    {
        "name": "Gachas de Avena (Porridge)",
        "isSystem": true,
        "image": "https://images.unsplash.com/photo-1517093758364-585a08993206?auto=format&fit=crop&w=500&q=60",
        "nutrients": { "kcal": 360, "protein": 12, "carbs": 60, "fat": 6 },
        "servingSize": 250,
        "tags": ["Desayuno", "Vegano"]
    },
    // --- INGREDIENTES BÁSICOS ---
    {
        "name": "Arroz Basmati (Crudo)",
        "isSystem": true,
        "image": "https://images.openfoodfacts.org/images/products/540/014/105/9253/front_es.18.400.jpg",
        "nutrients": { "kcal": 350, "protein": 8, "carbs": 78, "fat": 1 },
        "servingSize": 100,
        "tags": ["Grano", "Carbohidrato"]
    },
    {
        "name": "Pechuga de Pollo (Cruda)",
        "isSystem": true,
        "image": "https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=500&q=60",
        "nutrients": { "kcal": 110, "protein": 23, "carbs": 0, "fat": 1.2 },
        "servingSize": 100,
        "tags": ["Carne", "Proteína"]
    },
    {
        "name": "Huevo (L - 60g)",
        "isSystem": true,
        "image": "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=500&q=60",
        "nutrients": { "kcal": 155, "protein": 13, "carbs": 1.1, "fat": 11 },
        "servingSize": 60,
        "tags": ["Proteína", "Grasa", "Básico"]
    },
    {
        "name": "Patata (Cruda)",
        "isSystem": true,
        "image": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=500&q=60",
        "nutrients": { "kcal": 77, "protein": 2, "carbs": 17, "fat": 0.1 },
        "servingSize": 200,
        "tags": ["Vegetal", "Carbohidrato"]
    },
    {
        "name": "Salmón (Fresco)",
        "isSystem": true,
        "image": "https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?auto=format&fit=crop&w=500&q=60",
        "nutrients": { "kcal": 208, "protein": 20, "carbs": 0, "fat": 13 },
        "servingSize": 150,
        "tags": ["Pescado", "Grasa", "Proteína"]
    },
    {
        "name": "Aguacate",
        "isSystem": true,
        "image": "https://images.unsplash.com/photo-1523049673856-383665a9477e?auto=format&fit=crop&w=500&q=60",
        "nutrients": { "kcal": 160, "protein": 2, "carbs": 9, "fat": 15 },
        "servingSize": 100,
        "tags": ["Fruta", "Grasa"]
    },
    {
        "name": "Plátano",
        "isSystem": true,
        "image": "https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&w=500&q=60",
        "nutrients": { "kcal": 89, "protein": 1.1, "carbs": 23, "fat": 0.3 },
        "servingSize": 100,
        "tags": ["Fruta", "Carbohidrato"]
    }
];

// Backend logic would go here:
// mongoose.connect(...)
// FoodItem.insertMany(SYSTEM_FOODS)
// console.log("Seeding Complete 🥦");

module.exports = SYSTEM_FOODS;
