// src/utils/recipePlaceholder.js

/**
 * Genera un placeholder visual (URL de imagen) basado en el nombre de la comida.
 * Usa imágenes de alta calidad de Unsplash para dar un toque premium.
 * 
 * @param {string} name - Nombre de la comida/receta
 * @returns {string} URL de la imagen (Unsplash)
 */
export const getRecipePlaceholder = (name) => {
    if (!name) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400'; // Generic Healthy Bowl
    const n = name.toLowerCase();

    // 1. Frutas (Fruits)
    if (n.includes('manzana') || n.includes('platano') || n.includes('plátano') || n.includes('fruta') || n.includes('naranja') || n.includes('pera') || n.includes('fruit') || n.includes('fresa') || n.includes('piña'))
        return 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400';

    // 2. Ensaladas / Vegetales (Salad/Veg)
    if (n.includes('ensalada') || n.includes('lechuga') || n.includes('tomate') || n.includes('verdura') || n.includes('pepino') || n.includes('salad') || n.includes('vegetal') || n.includes('aguacate'))
        return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400';

    // 3. Proteína / Carne (Protein/Meat)
    if (n.includes('pollo') || n.includes('pavo') || n.includes('carne') || n.includes('ternera') || n.includes('cerdo') || n.includes('chicken') || n.includes('meat') || n.includes('steak') || n.includes('solomillo'))
        return 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400';

    // 4. Pescado (Fish)
    if (n.includes('pescado') || n.includes('atun') || n.includes('atún') || n.includes('salmon') || n.includes('salmón') || n.includes('merluza') || n.includes('fish') || n.includes('lubina') || n.includes('dorada'))
        return 'https://images.unsplash.com/photo-1519708227418-c8fd9a3a277d?w=400';

    // 5. Carbohidratos (Rice/Pasta/Potato/Bread)
    if (n.includes('arroz') || n.includes('rice') || n.includes('paella') || n.includes('risotto'))
        return 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400';

    if (n.includes('pasta') || n.includes('espagueti') || n.includes('macarrones') || n.includes('fideos'))
        return 'https://images.unsplash.com/photo-1598965675045-45c5e72c77a6?w=400';

    if (n.includes('patata') || n.includes('potato') || n.includes('puré') || n.includes('pure'))
        return 'https://images.unsplash.com/photo-1518977676601-b53f82a6b696?w=400';

    if (n.includes('pan') || n.includes('bread') || n.includes('tostada') || n.includes('toast') || n.includes('sandwich') || n.includes('bocadillo'))
        return 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400'; // Toast/Bread

    // 6. Huevos / Desayuno (Eggs)
    if (n.includes('huevo') || n.includes('clara') || n.includes('tortilla') || n.includes('egg') || n.includes('revuelto') || n.includes('omelette'))
        return 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=400';

    // 7. Postres / Dulces / Batidos
    if (n.includes('batido') || n.includes('shake') || n.includes('smoothie') || n.includes('proteína') || n.includes('proteina') || n.includes('whey'))
        return 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=400';

    if (n.includes('yogur') || n.includes('yogurt') || n.includes('kefir'))
        return 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400';

    if (n.includes('chocolate') || n.includes('cacao') || n.includes('galleta') || n.includes('cookie'))
        return 'https://images.unsplash.com/photo-1499195333224-3ce974eecb47?w=400';

    // Default Fallback
    return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400';
};
