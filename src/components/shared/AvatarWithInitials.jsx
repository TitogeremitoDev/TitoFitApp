import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

/**
 * AvatarWithInitials
 * 
 * Componente que muestra la foto de perfil del usuario o sus iniciales
 * con un diseño de alto contraste según las guías de estilo.
 * 
 * @param {string} avatarUrl - URL de la imagen (opcional)
 * @param {string} name - Nombre del usuario para generar iniciales
 * @param {number} size - Tamaño del diámetro del avatar (default: 50)
 * @param {boolean} showEditIcon - Si true, muestra icono de cámara/lápiz
 * @param {function} onPress - Función al pulsar el avatar
 * @param {object} style - Estilos extra para el contenedor
 */
const AvatarWithInitials = ({
    avatarUrl,
    name = 'User',
    emoji, // Prop para soporte de avatares legacy (emojis)
    isPremium = false, // Prop para borde dorado premium
    size = 50,
    showEditIcon = false,
    isLoading = false,
    onPress,
    style
}) => {
    // Generar iniciales (Máximo 2 letras)
    const getInitials = (fullName) => {
        if (!fullName) return 'U';
        const updatedName = fullName.trim();
        if (updatedName.length === 0) return 'U';

        const parts = updatedName.split(' ');
        if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }
        return (parts[0][0] + parts[1][0]).toUpperCase();
    };

    const initials = getInitials(name);
    const fontSize = size * 0.4;
    const iconSize = size * 0.25; // Tamaño relativo del icono de edición

    const Content = (
        <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }, style]}>
            {avatarUrl ? (
                <Image
                    source={avatarUrl}
                    style={{ width: size, height: size, borderRadius: size / 2 }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={200}
                    recyclingKey={avatarUrl}
                    placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                />
            ) : emoji ? (
                <View style={[
                    styles.initialsContainer,
                    {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        backgroundColor: '#f1f5f9'
                    }
                ]}>
                    <Text style={{ fontSize: size * 0.5 }}>{emoji}</Text>
                </View>
            ) : (
                <View style={[
                    styles.initialsContainer,
                    {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        backgroundColor: '#dbeafe' // blue-100 (fondo claro)
                    }
                ]}>
                    <Text style={[styles.initialsText, { fontSize, color: '#1e40af' }]}>
                        {initials}
                    </Text>
                </View>
            )}

            {/* Borde corporativo sutil o Premium */}
            <View style={[
                styles.borderOverlay,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderWidth: isPremium ? 3 : (avatarUrl ? 1 : 0),
                    borderColor: isPremium ? '#FFD700' : 'rgba(59, 130, 246, 0.2)'
                }
            ]} />

            {/* Si es premium, añadir sombra extra */}
            {isPremium && (
                <View style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderWidth: 0,
                    shadowColor: '#FFD700',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.8,
                    shadowRadius: 10,
                    elevation: 5,
                    zIndex: -1
                }} />
            )}

            {/* Icono de edición (Overlay) */}
            {showEditIcon && !isLoading && (
                <View style={[styles.editIconContainer, {
                    width: size * 0.3,
                    height: size * 0.3,
                    borderRadius: (size * 0.3) / 2
                }]}>
                    <Ionicons name="camera" size={size * 0.18} color="#fff" />
                </View>
            )}

            {/* Loading Indicator Overlay */}
            {isLoading && (
                <View style={[styles.loadingOverlay, { borderRadius: size / 2 }]}>
                    <ActivityIndicator size="small" color="#fff" />
                </View>
            )}
        </View>
    );

    if (onPress) {
        return (
            <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
                {Content}
            </TouchableOpacity>
        );
    }

    return Content;
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        overflow: 'visible', // Permitir que el icono salga un poco si es necesario, o shadow
    },
    initialsContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    initialsText: {
        fontWeight: '700',
        // El color se define inline para contraste dinámico si se requiere
    },
    borderOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        borderColor: 'rgba(59, 130, 246, 0.2)', // blue-500 con baja opacidad
        backgroundColor: 'transparent',
    },
    editIconContainer: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#3b82f6', // blue-500
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    }
});

export default AvatarWithInitials;
