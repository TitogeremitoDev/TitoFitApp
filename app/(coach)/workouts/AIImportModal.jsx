/* app/(coach)/workouts/AIImportModal.jsx - Modal de Importación de Rutinas con IA */

import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Platform,
    Alert,
    Dimensions
} from 'react-native';
import { EnhancedTextInput } from '../../../components/ui';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../../context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_HEIGHT = Math.min(SCREEN_HEIGHT * 0.85, SCREEN_HEIGHT - 100);

// Componente para el indicador de estado (semáforo)
const MatchStatusIndicator = ({ status, confidence }) => {
    const colors = {
        green: { bg: '#dcfce7', border: '#22c55e', icon: 'checkmark-circle' },
        yellow: { bg: '#fef9c3', border: '#eab308', icon: 'alert-circle' },
        red: { bg: '#fee2e2', border: '#ef4444', icon: 'close-circle' }
    };
    const style = colors[status] || colors.red;

    return (
        <View style={[styles.statusIndicator, { backgroundColor: style.bg, borderColor: style.border }]}>
            <Ionicons name={style.icon} size={16} color={style.border} />
            {confidence > 0 && <Text style={[styles.confidenceText, { color: style.border }]}>{confidence}%</Text>}
        </View>
    );
};

// Componente para cada ejercicio en la preview
const ExercisePreviewItem = ({ exercise, onSelectExercise, allExercises, searchQuery, setSearchQuery }) => {
    const [showDropdown, setShowDropdown] = useState(false);
    const [localSearch, setLocalSearch] = useState('');

    const suggestions = exercise._suggestions || exercise._alternatives || [];
    const filteredExercises = allExercises.filter(ex =>
        ex.nombre.toLowerCase().includes(localSearch.toLowerCase()) ||
        ex.musculo.toLowerCase().includes(localSearch.toLowerCase())
    ).slice(0, 10);

    return (
        <View style={styles.exerciseItem}>
            <View style={styles.exerciseHeader}>
                <MatchStatusIndicator status={exercise._matchStatus} confidence={exercise._confidence} />
                <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>{exercise.nombre || exercise._originalName}</Text>
                    <Text style={styles.exerciseMuscle}>{exercise.musculo}</Text>
                </View>
                <View style={styles.seriesInfo}>
                    <Text style={styles.seriesCount}>{exercise.series?.length || 0} series</Text>
                </View>
            </View>

            {/* Mostrar nombre original si hay diferencia */}
            {exercise._originalName && exercise.nombre !== exercise._originalName && (
                <View style={styles.originalNameRow}>
                    <Text style={styles.originalNameLabel}>PDF:</Text>
                    <Text style={styles.originalNameText}>{exercise._originalName}</Text>
                </View>
            )}

            {/* Series preview */}
            <View style={styles.seriesPreview}>
                {exercise.series?.map((serie, idx) => (
                    <View key={idx} style={styles.serieChip}>
                        <Text style={styles.serieText}>
                            {serie.repMin}-{serie.repMax}
                            {serie.extra !== 'Ninguno' && ` (${serie.extra})`}
                        </Text>
                    </View>
                ))}
            </View>

            {/* Sugerencias o selector para ejercicios sin match */}
            {(exercise._matchStatus === 'red' || exercise._matchStatus === 'yellow') && (
                <View style={styles.suggestionsContainer}>
                    <TouchableOpacity
                        style={styles.changeExerciseBtn}
                        onPress={() => setShowDropdown(!showDropdown)}
                    >
                        <Ionicons name="swap-horizontal" size={16} color="#6366f1" />
                        <Text style={styles.changeExerciseText}>Cambiar ejercicio</Text>
                    </TouchableOpacity>

                    {showDropdown && (
                        <View style={styles.dropdownContainer}>
                            {/* Buscador */}
                            <View style={styles.searchContainer}>
                                <Ionicons name="search" size={16} color="#94a3b8" />
                                <EnhancedTextInput
                                    style={styles.searchInputText}
                                    containerStyle={styles.searchInputContainer}
                                    placeholder="Buscar ejercicio..."
                                    placeholderTextColor="#94a3b8"
                                    value={localSearch}
                                    onChangeText={setLocalSearch}
                                />
                            </View>

                            {/* Lista de sugerencias */}
                            {suggestions.length > 0 && !localSearch && (
                                <>
                                    <Text style={styles.suggestionLabel}>Sugerencias de IA:</Text>
                                    {suggestions.map((sug, idx) => (
                                        <TouchableOpacity
                                            key={idx}
                                            style={styles.suggestionItem}
                                            onPress={() => {
                                                onSelectExercise(sug);
                                                setShowDropdown(false);
                                            }}
                                        >
                                            <Text style={styles.suggestionName}>{sug.nombre}</Text>
                                            <Text style={styles.suggestionMuscle}>{sug.musculo}</Text>
                                            <Text style={styles.suggestionConfidence}>{sug.confidence}%</Text>
                                        </TouchableOpacity>
                                    ))}
                                </>
                            )}

                            {/* Resultados de búsqueda */}
                            {localSearch && (
                                <>
                                    <Text style={styles.suggestionLabel}>Resultados:</Text>
                                    {filteredExercises.map((ex, idx) => (
                                        <TouchableOpacity
                                            key={idx}
                                            style={styles.suggestionItem}
                                            onPress={() => {
                                                onSelectExercise({ id: ex.id, nombre: ex.nombre, musculo: ex.musculo });
                                                setShowDropdown(false);
                                                setLocalSearch('');
                                            }}
                                        >
                                            <Text style={styles.suggestionName}>{ex.nombre}</Text>
                                            <Text style={styles.suggestionMuscle}>{ex.musculo}</Text>
                                        </TouchableOpacity>
                                    ))}
                                    {filteredExercises.length === 0 && (
                                        <Text style={styles.noResults}>Sin resultados</Text>
                                    )}
                                </>
                            )}
                        </View>
                    )}
                </View>
            )}
        </View>
    );
};

export default function AIImportModal({ visible, onClose, onRoutineSaved }) {
    const { token, user } = useAuth();
    const [step, setStep] = useState(1); // 1: Upload, 2: Preview
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [routineName, setRoutineName] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [parsedRoutine, setParsedRoutine] = useState(null);
    const [allExercises, setAllExercises] = useState([]);
    const [error, setError] = useState(null);

    // Input mode: 'file' or 'text'
    const [inputMode, setInputMode] = useState('file');
    const [directText, setDirectText] = useState('');

    // Seleccionar archivo
    const handleSelectFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: [
                    'application/pdf',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel',
                    'text/csv',
                    'text/plain'
                ],
                copyToCacheDirectory: true
            });

            if (result.assets && result.assets.length > 0) {
                setSelectedFile(result.assets[0]);
                setError(null);
            } else if (result.type === 'success') {
                setSelectedFile(result);
                setError(null);
            }
        } catch (err) {
            console.error('Error selecting file:', err);
            setError('Error al seleccionar archivo');
        }
    };

    // Cargar todos los ejercicios para el dropdown
    const fetchAllExercises = async () => {
        try {
            const response = await fetch(`${API_URL}/api/ai/exercises`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setAllExercises(data.exercises);
            }
        } catch (err) {
            console.error('Error fetching exercises:', err);
        }
    };

    // Procesar archivo o texto con IA
    const handleAnalyze = async () => {
        // Validación según el modo
        if (inputMode === 'file' && !selectedFile) {
            setError('Por favor selecciona un archivo');
            return;
        }
        if (inputMode === 'text' && !directText.trim()) {
            setError('Por favor escribe o pega el contenido de tu rutina');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Crear FormData
            const formData = new FormData();

            if (inputMode === 'file') {
                // Paso 1: Leer archivo
                setLoadingMessage('Leyendo archivo...');

                // Manejar diferencias entre web y nativo
                if (Platform.OS === 'web') {
                    // En web, selectedFile.file contiene el File object
                    if (selectedFile.file) {
                        formData.append('file', selectedFile.file);
                    } else {
                        // Fallback: intentar fetch del URI y convertir a blob
                        const response = await fetch(selectedFile.uri);
                        const blob = await response.blob();
                        formData.append('file', blob, selectedFile.name || 'routine.pdf');
                    }
                } else {
                    // En nativo, usamos el objeto típico de React Native
                    formData.append('file', {
                        uri: selectedFile.uri,
                        type: selectedFile.mimeType || 'application/octet-stream',
                        name: selectedFile.name || 'routine.pdf'
                    });
                }
            } else {
                // Modo texto: crear un "archivo" de texto
                setLoadingMessage('Preparando texto...');

                if (Platform.OS === 'web') {
                    const blob = new Blob([directText], { type: 'text/plain' });
                    formData.append('file', blob, 'routine.txt');
                } else {
                    // En nativo, enviamos como texto plano
                    formData.append('file', {
                        uri: `data:text/plain;base64,${btoa(unescape(encodeURIComponent(directText)))}`,
                        type: 'text/plain',
                        name: 'routine.txt'
                    });
                }
            }

            if (routineName) {
                formData.append('routineName', routineName);
            }

            // Paso 2: Enviar a la API
            setLoadingMessage('Analizando con IA...');
            const response = await fetch(`${API_URL}/api/ai/parse-routine`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    // No incluir Content-Type, FormData lo maneja
                },
                body: formData
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Error al procesar el archivo');
            }

            // Paso 3: Cargar ejercicios para el dropdown
            setLoadingMessage('Verificando ejercicios...');
            await fetchAllExercises();

            setParsedRoutine(data.routine);
            setStep(2);

        } catch (err) {
            console.error('Error analyzing file:', err);
            setError(err.message || 'Error al procesar el archivo');
        } finally {
            setLoading(false);
            setLoadingMessage('');
        }
    };

    // Actualizar ejercicio en la rutina parseada
    const handleUpdateExercise = (dayIndex, exerciseIndex, newExercise) => {
        setParsedRoutine(prev => {
            const updated = { ...prev };
            updated.diasArr = [...prev.diasArr];
            updated.diasArr[dayIndex] = [...prev.diasArr[dayIndex]];
            updated.diasArr[dayIndex][exerciseIndex] = {
                ...prev.diasArr[dayIndex][exerciseIndex],
                id: newExercise.id,
                nombre: newExercise.nombre,
                musculo: newExercise.musculo,
                _matchStatus: 'green',
                _confidence: 100
            };
            return updated;
        });
    };

    // Guardar rutina
    const handleSave = async () => {
        if (!parsedRoutine) return;

        // Verificar si hay ejercicios sin match
        const hasUnmatched = parsedRoutine.diasArr.some(day =>
            day.some(ex => ex._matchStatus === 'red' && !ex.id)
        );

        if (hasUnmatched) {
            const msg = 'Hay ejercicios sin asignar. ¿Deseas continuar de todos modos?';
            if (Platform.OS === 'web') {
                if (!window.confirm(msg)) return;
            } else {
                return Alert.alert(
                    'Ejercicios sin asignar',
                    msg,
                    [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Continuar', onPress: () => doSave() }
                    ]
                );
            }
        }

        await doSave();
    };

    const doSave = async () => {
        setLoading(true);
        setLoadingMessage('Guardando rutina...');

        try {
            // Limpiar campos internos de matching antes de guardar
            const cleanRoutine = {
                nombre: parsedRoutine.nombre || routineName || 'Rutina Importada IA',
                dias: parsedRoutine.dias,
                diasArr: parsedRoutine.diasArr.map(day =>
                    day.map(ex => ({
                        id: ex.id || `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                        musculo: ex.musculo,
                        nombre: ex.nombre || ex._originalName,
                        series: ex.series?.map(s => ({
                            repMin: String(s.repMin || '8'),
                            repMax: String(s.repMax || '12'),
                            extra: s.extra || 'Ninguno'
                        })) || []
                    }))
                ),
                division: 'IA Import',
                enfoque: 'General',
                nivel: 'Intermedio'
            };

            // 🆕 Verificar si es usuario FREE
            const isFreeUser = user?.tipoUsuario === 'FREEUSER';

            if (isFreeUser) {
                // ══════════════════════════════════════════════════════════════
                // FREEUSER: Guardar solo localmente en AsyncStorage
                // ══════════════════════════════════════════════════════════════
                const localId = `r-${Date.now()}-${Math.random().toString(36).slice(2)}`;

                // Convertir diasArr a formato {dia1: [], dia2: [], ...}
                const routineDataForLocal = {};
                cleanRoutine.diasArr.forEach((dayExercises, idx) => {
                    routineDataForLocal[`dia${idx + 1}`] = dayExercises || [];
                });

                // Guardar datos de la rutina
                await AsyncStorage.setItem(`routine_${localId}`, JSON.stringify(routineDataForLocal));

                // Actualizar lista de rutinas
                const rutinasStr = await AsyncStorage.getItem('rutinas');
                let rutinas = rutinasStr ? JSON.parse(rutinasStr) : [];
                rutinas.push({
                    id: localId,
                    nombre: cleanRoutine.nombre,
                    origen: 'local',
                    updatedAt: new Date().toISOString(),
                    folder: null
                });
                await AsyncStorage.setItem('rutinas', JSON.stringify(rutinas));

                console.log('[AIImportModal] ✅ Rutina guardada localmente (FREEUSER):', localId);

                if (Platform.OS === 'web') {
                    alert(`⚠️ Rutina "${cleanRoutine.nombre}" guardada localmente.\n\nComo usuario gratuito, tu rutina se guarda solo en este dispositivo. Mejora a Premium para sincronizar en la nube.`);
                } else {
                    Alert.alert(
                        '⚠️ Guardado Local',
                        `Rutina "${cleanRoutine.nombre}" guardada en tu dispositivo.\n\nComo usuario gratuito, no se sincroniza en la nube. Mejora a Premium para acceder desde cualquier lugar.`,
                        [{ text: 'Entendido', style: 'default' }]
                    );
                }
                onRoutineSaved?.();
                handleClose();
                return;
            }

            // ══════════════════════════════════════════════════════════════
            // USUARIOS PREMIUM/CLIENTE/ADMIN: Guardar en MongoDB
            // ══════════════════════════════════════════════════════════════
            const response = await fetch(`${API_URL}/api/routines`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(cleanRoutine)
            });

            const data = await response.json();

            if (data.success) {
                // 🔧 FIX: Cachear la rutina en AsyncStorage para evitar bug de refresh
                // Esto permite que entreno.jsx la cargue inmediatamente sin esperar a la API
                const savedRoutineId = data.routine?._id;
                if (savedRoutineId) {
                    try {
                        // Convertir diasArr a formato {dia1: [], dia2: [], ...}
                        const routineDataForCache = {};
                        cleanRoutine.diasArr.forEach((dayExercises, idx) => {
                            routineDataForCache[`dia${idx + 1}`] = dayExercises || [];
                        });
                        await AsyncStorage.setItem(`routine_${savedRoutineId}`, JSON.stringify(routineDataForCache));
                        console.log('[AIImportModal] ✅ Rutina guardada en nube y cacheada:', savedRoutineId);
                    } catch (cacheError) {
                        console.warn('[AIImportModal] No se pudo cachear la rutina:', cacheError);
                    }
                }

                if (Platform.OS === 'web') {
                    alert(`Rutina "${cleanRoutine.nombre}" guardada correctamente en la nube ☁️`);
                } else {
                    Alert.alert('Éxito', `Rutina "${cleanRoutine.nombre}" guardada correctamente en la nube ☁️`);
                }
                onRoutineSaved?.();
                handleClose();
            } else {
                throw new Error(data.message || 'Error al guardar la rutina');
            }
        } catch (err) {
            console.error('Error saving routine:', err);
            setError(err.message || 'Error al guardar');
        } finally {
            setLoading(false);
            setLoadingMessage('');
        }
    };

    // Cerrar y resetear
    const handleClose = () => {
        setStep(1);
        setLoading(false);
        setLoadingMessage('');
        setRoutineName('');
        setSelectedFile(null);
        setParsedRoutine(null);
        setError(null);
        onClose();
    };

    // Calcular estadísticas
    const getStats = () => {
        if (!parsedRoutine) return null;
        return parsedRoutine.stats || {
            totalExercises: 0,
            green: 0,
            yellow: 0,
            red: 0
        };
    };

    const stats = getStats();

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={handleClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <Ionicons name="sparkles" size={24} color="#8b5cf6" />
                            <Text style={styles.headerTitle}>
                                {step === 1 ? 'Importar con IA' : 'Revisar Rutina'}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {step === 1 ? (
                            /* STEP 1: Upload */
                            <View style={styles.uploadSection}>
                                <View style={styles.uploadIcon}>
                                    <Ionicons name="sparkles" size={48} color="#8b5cf6" />
                                </View>
                                <Text style={styles.uploadTitle}>Importar Rutina con IA</Text>

                                {/* Tab selector */}
                                <View style={styles.tabSelector}>
                                    <TouchableOpacity
                                        style={[styles.tab, inputMode === 'file' && styles.tabActive]}
                                        onPress={() => setInputMode('file')}
                                    >
                                        <Ionicons name="document-attach" size={16} color={inputMode === 'file' ? '#8b5cf6' : '#64748b'} />
                                        <Text style={[styles.tabText, inputMode === 'file' && styles.tabTextActive]}>Archivo</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.tab, inputMode === 'text' && styles.tabActive]}
                                        onPress={() => setInputMode('text')}
                                    >
                                        <Ionicons name="create" size={16} color={inputMode === 'text' ? '#8b5cf6' : '#64748b'} />
                                        <Text style={[styles.tabText, inputMode === 'text' && styles.tabTextActive]}>Escribir/Pegar</Text>
                                    </TouchableOpacity>
                                </View>

                                {inputMode === 'file' ? (
                                    <>
                                        {/* Tipos de archivo soportados */}
                                        <View style={styles.fileTypesRow}>
                                            <View style={styles.fileTypeBadge}>
                                                <Ionicons name="document-text" size={14} color="#ef4444" />
                                                <Text style={styles.fileTypeText}>PDF</Text>
                                            </View>
                                            <View style={styles.fileTypeBadge}>
                                                <Ionicons name="grid" size={14} color="#22c55e" />
                                                <Text style={styles.fileTypeText}>Excel</Text>
                                            </View>
                                            <View style={styles.fileTypeBadge}>
                                                <Ionicons name="document" size={14} color="#3b82f6" />
                                                <Text style={styles.fileTypeText}>TXT</Text>
                                            </View>
                                        </View>

                                        {/* Warning Alert - before button */}
                                        <View style={styles.warningAlert}>
                                            <Ionicons name="information-circle" size={18} color="#f59e0b" />
                                            <Text style={styles.warningText}>
                                                ¡Esto no es magia! Limpia tu archivo lo máximo posible para una respuesta óptima.
                                            </Text>
                                        </View>

                                        <TouchableOpacity
                                            style={styles.selectFileBtn}
                                            onPress={handleSelectFile}
                                        >
                                            <Ionicons name="document-attach-outline" size={20} color="#fff" />
                                            <Text style={styles.selectFileBtnText}>Seleccionar archivo</Text>
                                        </TouchableOpacity>

                                        {selectedFile && (
                                            <View style={styles.selectedFileRow}>
                                                <Ionicons name="document-text" size={20} color="#10b981" />
                                                <Text style={styles.selectedFileName} numberOfLines={1}>
                                                    {selectedFile.name}
                                                </Text>
                                                <TouchableOpacity onPress={() => setSelectedFile(null)}>
                                                    <Ionicons name="close-circle" size={20} color="#ef4444" />
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {/* Text Input Mode */}
                                        <Text style={styles.textInputLabel}>
                                            Escribe o pega el contenido de tu rutina:
                                        </Text>
                                        <EnhancedTextInput
                                            style={styles.textAreaText}
                                            containerStyle={styles.textAreaContainer}
                                            multiline
                                            numberOfLines={8}
                                            placeholder="Ejemplo:
DÍA 1 - PECHO Y TRÍCEPS
Press banca 4x10
Aperturas inclinado 3x12
Fondos 3x8-10

DÍA 2 - ESPALDA Y BÍCEPS
Dominadas 4xfallo
Remo con barra 4x10..."
                                            placeholderTextColor="#94a3b8"
                                            value={directText}
                                            onChangeText={setDirectText}
                                            textAlignVertical="top"
                                        />

                                        {/* Warning Alert for text mode */}
                                        <View style={styles.warningAlert}>
                                            <Ionicons name="information-circle" size={18} color="#f59e0b" />
                                            <Text style={styles.warningText}>
                                                ¡Esto no es magia! Escribe de forma clara y ordenada para una respuesta óptima.
                                            </Text>
                                        </View>
                                    </>
                                )}

                                <View style={styles.nameInputContainer}>
                                    <Text style={styles.inputLabel}>Nombre de la rutina (opcional)</Text>
                                    <EnhancedTextInput
                                        style={styles.nameInputText}
                                        containerStyle={styles.nameInputContainer}
                                        placeholder="Se detectará automáticamente"
                                        placeholderTextColor="#94a3b8"
                                        value={routineName}
                                        onChangeText={setRoutineName}
                                    />
                                </View>

                                {error && (
                                    <View style={styles.errorContainer}>
                                        <Ionicons name="alert-circle" size={16} color="#ef4444" />
                                        <Text style={styles.errorText}>{error}</Text>
                                    </View>
                                )}
                            </View>
                        ) : (
                            /* STEP 2: Preview */
                            <View style={styles.previewSection}>
                                {/* Nombre de la rutina */}
                                <View style={styles.routineNameRow}>
                                    <EnhancedTextInput
                                        style={styles.routineNameInputText}
                                        containerStyle={styles.routineNameInputContainer}
                                        value={parsedRoutine?.nombre || ''}
                                        onChangeText={(text) => setParsedRoutine(prev => ({ ...prev, nombre: text }))}
                                        placeholder="Nombre de la rutina"
                                        placeholderTextColor="#94a3b8"
                                    />
                                </View>

                                {/* Stats */}
                                {stats && (
                                    <View style={styles.statsRow}>
                                        <View style={[styles.statBadge, { backgroundColor: '#dcfce7' }]}>
                                            <Text style={[styles.statText, { color: '#22c55e' }]}>
                                                🟢 {stats.green}
                                            </Text>
                                        </View>
                                        <View style={[styles.statBadge, { backgroundColor: '#fef9c3' }]}>
                                            <Text style={[styles.statText, { color: '#eab308' }]}>
                                                🟡 {stats.yellow}
                                            </Text>
                                        </View>
                                        <View style={[styles.statBadge, { backgroundColor: '#fee2e2' }]}>
                                            <Text style={[styles.statText, { color: '#ef4444' }]}>
                                                🔴 {stats.red}
                                            </Text>
                                        </View>
                                        <Text style={styles.totalExercises}>
                                            {stats.totalExercises} ejercicios
                                        </Text>
                                    </View>
                                )}

                                {/* Días */}
                                {parsedRoutine?.diasArr?.map((day, dayIndex) => (
                                    <View key={dayIndex} style={styles.dayContainer}>
                                        <Text style={styles.dayTitle}>Día {dayIndex + 1}</Text>
                                        {day.map((exercise, exIndex) => (
                                            <ExercisePreviewItem
                                                key={exIndex}
                                                exercise={exercise}
                                                allExercises={allExercises}
                                                onSelectExercise={(newEx) => handleUpdateExercise(dayIndex, exIndex, newEx)}
                                            />
                                        ))}
                                    </View>
                                ))}

                                {error && (
                                    <View style={styles.errorContainer}>
                                        <Ionicons name="alert-circle" size={16} color="#ef4444" />
                                        <Text style={styles.errorText}>{error}</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </ScrollView>

                    {/* Footer */}
                    <View style={styles.footer}>
                        {step === 2 && (
                            <TouchableOpacity
                                style={styles.backBtn}
                                onPress={() => setStep(1)}
                            >
                                <Ionicons name="arrow-back" size={20} color="#64748b" />
                                <Text style={styles.backBtnText}>Atrás</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[styles.actionBtn, loading && styles.actionBtnDisabled]}
                            onPress={step === 1 ? handleAnalyze : handleSave}
                            disabled={loading || (step === 1 && inputMode === 'file' && !selectedFile) || (step === 1 && inputMode === 'text' && !directText.trim())}
                        >
                            {loading ? (
                                <>
                                    <ActivityIndicator size="small" color="#fff" />
                                    <Text style={styles.actionBtnText}>{loadingMessage}</Text>
                                </>
                            ) : (
                                <>
                                    <Ionicons name={step === 1 ? "sparkles" : "save"} size={20} color="#fff" />
                                    <Text style={styles.actionBtnText}>
                                        {step === 1 ? 'Analizar con IA' : 'Guardar Rutina'}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        width: '100%',
        maxWidth: 600,
        height: MODAL_HEIGHT,
        overflow: 'hidden'
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0'
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b'
    },
    closeBtn: {
        padding: 4
    },
    content: {
        flex: 1,
        padding: 20
    },
    uploadSection: {
        alignItems: 'center',
        paddingVertical: 20
    },
    uploadIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#f3e8ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16
    },
    uploadTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 8
    },
    uploadSubtitle: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 24
    },
    fileTypesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 16
    },
    fileTypeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16
    },
    fileTypeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569'
    },
    warningAlert: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        backgroundColor: '#fef3c7',
        padding: 12,
        borderRadius: 8,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#fcd34d'
    },
    warningText: {
        flex: 1,
        fontSize: 13,
        color: '#92400e',
        lineHeight: 18
    },
    tabSelector: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
        padding: 4,
        marginBottom: 16,
        width: '100%'
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 6
    },
    tabActive: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2
    },
    tabText: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500'
    },
    tabTextActive: {
        color: '#8b5cf6',
        fontWeight: '600'
    },
    textInputLabel: {
        fontSize: 14,
        color: '#475569',
        marginBottom: 8,
        fontWeight: '500'
    },
    textAreaContainer: {
        width: '100%',
        minHeight: 180,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
    },
    textAreaText: {
        fontSize: 14,
        color: '#1e293b',
        textAlignVertical: 'top',
    },
    selectFileBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#8b5cf6',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8
    },
    selectFileBtnText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16
    },
    selectedFileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 16,
        backgroundColor: '#f0fdf4',
        padding: 12,
        borderRadius: 8,
        maxWidth: '100%'
    },
    selectedFileName: {
        flex: 1,
        color: '#166534',
        fontWeight: '500'
    },
    nameInputContainer: {
        width: '100%',
        marginTop: 24
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8
    },
    nameInputContainer: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        padding: 12,
    },
    nameInputText: {
        fontSize: 16,
        color: '#1e293b',
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#fee2e2',
        padding: 12,
        borderRadius: 8,
        marginTop: 16
    },
    errorText: {
        color: '#dc2626',
        fontSize: 14
    },
    previewSection: {
        flex: 1
    },
    routineNameRow: {
        marginBottom: 16
    },
    routineNameInputContainer: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        padding: 12,
    },
    routineNameInputText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16
    },
    statBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12
    },
    statText: {
        fontSize: 12,
        fontWeight: '600'
    },
    totalExercises: {
        marginLeft: 'auto',
        fontSize: 14,
        color: '#64748b'
    },
    dayContainer: {
        marginBottom: 20
    },
    dayTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 12,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0'
    },
    exerciseItem: {
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8
    },
    exerciseHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
    },
    statusIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1
    },
    confidenceText: {
        fontSize: 11,
        fontWeight: '600'
    },
    exerciseInfo: {
        flex: 1
    },
    exerciseName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b'
    },
    exerciseMuscle: {
        fontSize: 12,
        color: '#64748b'
    },
    seriesInfo: {
        alignItems: 'flex-end'
    },
    seriesCount: {
        fontSize: 12,
        color: '#8b5cf6',
        fontWeight: '600'
    },
    originalNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0'
    },
    originalNameLabel: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: '500'
    },
    originalNameText: {
        fontSize: 11,
        color: '#64748b',
        fontStyle: 'italic'
    },
    seriesPreview: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 8
    },
    serieChip: {
        backgroundColor: '#e2e8f0',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4
    },
    serieText: {
        fontSize: 11,
        color: '#475569'
    },
    suggestionsContainer: {
        marginTop: 10
    },
    changeExerciseBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    changeExerciseText: {
        fontSize: 13,
        color: '#6366f1',
        fontWeight: '500'
    },
    dropdownContainer: {
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginTop: 8,
        padding: 10,
        maxHeight: 200
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#f1f5f9',
        borderRadius: 6,
        paddingHorizontal: 10,
        marginBottom: 8
    },
    searchInputContainer: {
        flex: 1,
        padding: 8,
    },
    searchInputText: {
        fontSize: 14,
        color: '#1e293b',
    },
    suggestionLabel: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: '600',
        marginBottom: 6,
        marginTop: 4
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 6,
        backgroundColor: '#f8fafc',
        marginBottom: 4
    },
    suggestionName: {
        flex: 1,
        fontSize: 13,
        color: '#1e293b',
        fontWeight: '500'
    },
    suggestionMuscle: {
        fontSize: 11,
        color: '#64748b',
        marginRight: 8
    },
    suggestionConfidence: {
        fontSize: 11,
        color: '#22c55e',
        fontWeight: '600'
    },
    noResults: {
        fontSize: 13,
        color: '#94a3b8',
        textAlign: 'center',
        padding: 10
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0'
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        padding: 10
    },
    backBtnText: {
        color: '#64748b',
        fontWeight: '500'
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#8b5cf6',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        marginLeft: 'auto'
    },
    actionBtnDisabled: {
        opacity: 0.6
    },
    actionBtnText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16
    }
});
