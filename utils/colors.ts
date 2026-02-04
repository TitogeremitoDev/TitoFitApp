export const isDarkColor = (color: string): boolean => {
    if (!color || !color.startsWith('#')) return false;

    const hex = color.replace('#', '');
    // Handle short hex codes (e.g. #FFF)
    if (hex.length === 3) {
        const r = parseInt(hex[0] + hex[0], 16);
        const g = parseInt(hex[1] + hex[1], 16);
        const b = parseInt(hex[2] + hex[2], 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return yiq < 128;
    }

    if (hex.length !== 6) return false;

    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Calculate brightness (YIQ formula)
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq < 128;
};

export const adjustColor = (color: string, amount: number): string => {
    if (!color || !color.startsWith('#')) return color;

    const hex = color.replace('#', '');
    const num = parseInt(hex, 16);

    let r = (num >> 16) + amount;
    let g = ((num >> 8) & 0x00FF) + amount;
    let b = (num & 0x0000FF) + amount;

    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));

    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

export const adjustOpacity = (color: string, opacity: number): string => {
    if (!color) return color;

    if (color.startsWith('#')) {
        const hex = color.replace('#', '');
        let r, g, b;

        if (hex.length === 3) {
            r = parseInt(hex[0] + hex[0], 16);
            g = parseInt(hex[1] + hex[1], 16);
            b = parseInt(hex[2] + hex[2], 16);
        } else {
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
        }
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    return color;
};

/**
 * Returns a high contrast text color (black or white) based on the background color.
 * @param bgColor The background color (hex)
 * @param darkText Optional text color to use on light backgrounds (default: black)
 * @param lightText Optional text color to use on dark backgrounds (default: white)
 */
export const getContrastColor = (bgColor: string, darkText: string = '#000000', lightText: string = '#ffffff'): string => {
    return isDarkColor(bgColor) ? lightText : darkText;
};
