/* app/rutinas/index.jsx
   ────────────────────────────────────────────────
   ▸ Pantalla de gestión de rutinas con SectionList, búsqueda y carpetas
   ▸ CORRECCIÓN: ListHeaderComponent fuera para evitar pérdida de foco en TextInput
*/
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, Linking, ImageBackground,
  TouchableOpacity, SectionList, Alert, Platform,
  ActivityIndicator, Modal, SafeAreaView,
  ScrollView
} from 'react-native';
import { router, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import Papa from 'papaparse';
import { decode as atob } from 'base-64';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';

import { useAuth } from '../../../context/AuthContext';
import { syncRoutinesFromServer } from '../../../src/lib/syncRoutines';
import { predefinedRoutines } from '../../../src/data/predefinedRoutines';
import { premiumRoutines } from '../../../src/data/premiumRoutines';

const EXTRAS = ['Ninguno', 'Descendentes', 'Mio Reps', 'Parciales'];

/* ─────────────────────────────
   PLANES / ROLES DE USUARIO
   ───────────────────────────── */
const PLAN = {
  FREEUSER: 'FREEUSER',
  PREMIUM: 'PREMIUM',
  CLIENTE: 'CLIENTE',
  ADMIN: 'ADMINISTRADOR',
};

// Helpers
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(4);

const normalizeCSVRow = (row, ejId, sIdx) => ({
  id: `s-${ejId}-${sIdx}-${uid()}`,
  repMin: String(row.REPMIN ?? row.REPS ?? '6').trim(),
  repMax: String(row.REPMAX ?? row.REPS ?? '8').trim(),
  extra: EXTRAS.find((e) => e.toUpperCase() === String(row.EXTRA ?? '').toUpperCase()) || 'Ninguno',
});

const normalizeCSV = (parsedData) => {
  const rutina = {};
  const ejerciciosMap = new Map();

  parsedData.forEach((row) => {
    const diaKey = `dia${String(row.DIA ?? '1').trim()}`;
    if (!rutina[diaKey]) rutina[diaKey] = [];
    const nombre = String(row.EJERCICIO ?? 'Ejercicio sin nombre').trim();
    const musculo = String(row.MUSCULO ?? '').trim().toUpperCase();
    const extraEj = String(row.EXTRA_EJERCICIO ?? '').trim();
    const mapKey = `${diaKey}-${musculo}-${nombre}-${extraEj}`;

    if (!ejerciciosMap.has(mapKey)) {
      const ejId = `ej-${uid()}`;
      const newEj = { id: ejId, musculo, nombre, extra: extraEj, series: [] };
      ejerciciosMap.set(mapKey, newEj);
      rutina[diaKey].push(newEj);
    }
    const ej = ejerciciosMap.get(mapKey);
    ej.series.push(normalizeCSVRow(row, ej.id, ej.series.length));
  });
  return rutina;
};

/* ─────────────────────────────
   COMPONENTES FUERA DE LA PANTALLA PRINCIPAL
   (Para evitar re-renders y pérdida de foco)
   ───────────────────────────── */

const ListHeaderComponent = React.memo(function ListHeaderComponent({
  theme,
  newRoutineName,
  onNameChange,
  onAddRoutine,
  onPickDocument,
  onSync,
  tipoUsuario,
  canSync,
  isSyncing,
  searchQuery,
  onSearchChange,
  folders,
  selectedFolder,
  onFolderSelect,
  onCreateFolder
}) {
  return (
    <View style={[styles.header, {
      backgroundColor: theme.cardBackground,
      borderBottomColor: theme.cardBorder
    }]}>
      <Text style={[styles.headerTitle, { color: theme.text }]}>Crear Nueva Rutina</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, {
            borderColor: theme.inputBorder,
            backgroundColor: theme.inputBackground,
            color: theme.inputText
          }]}
          placeholder="Nombre de la nueva rutina..."
          placeholderTextColor={theme.placeholder}
          value={newRoutineName}
          onChangeText={onNameChange}
        />
        <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.success }]} onPress={onAddRoutine}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      <View style={styles.buttonRow}>
        {tipoUsuario !== PLAN.FREEUSER && (
          <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary }]} onPress={onPickDocument}>
            <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
            <Text style={styles.buttonText}>Importar (CSV)</Text>
          </TouchableOpacity>
        )}

        {canSync && (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary }, isSyncing && styles.buttonDisabled]}
            onPress={onSync}
            disabled={isSyncing}
          >
            {isSyncing ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="sync-outline" size={18} color="#fff" />}
            <Text style={styles.buttonText}>{isSyncing ? 'Sinc...' : 'Sincronizar'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
        <Ionicons name="search" size={18} color={theme.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Buscar rutinas..."
          placeholderTextColor={theme.placeholder}
          value={searchQuery}
          onChangeText={onSearchChange}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => onSearchChange('')}>
            <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Folder Filter with Fixed Icon */}
      <View style={styles.folderContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.folderScroll}
          contentContainerStyle={styles.folderScrollContent}
        >
          <TouchableOpacity
            style={[
              styles.folderChip,
              { backgroundColor: theme.backgroundTertiary, borderColor: theme.border },
              selectedFolder === null && { backgroundColor: theme.primaryLight, borderColor: theme.primary }
            ]}
            onPress={() => onFolderSelect(null)}
          >
            <Text style={[
              styles.folderChipText,
              { color: theme.text },
              selectedFolder === null && { color: theme.primary, fontWeight: '600' }
            ]}>
              Todas
            </Text>
          </TouchableOpacity>
          {folders.map((folder, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.folderChip,
                { backgroundColor: theme.backgroundTertiary, borderColor: theme.border },
                selectedFolder === folder && { backgroundColor: theme.primaryLight, borderColor: theme.primary }
              ]}
              onPress={() => onFolderSelect(folder)}
            >
              <Ionicons
                name="folder"
                size={14}
                color={selectedFolder === folder ? theme.primary : theme.textSecondary}
              />
              <Text style={[
                styles.folderChipText,
                { color: theme.text },
                selectedFolder === folder && { color: theme.primary, fontWeight: '600' }
              ]}>
                {folder}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {/* Fixed Create Folder Button */}
        <TouchableOpacity onPress={onCreateFolder} style={[styles.fixedIconContainer, { backgroundColor: theme.backgroundTertiary, borderRadius: 8 }]}>
          <Ionicons name="folder-outline" size={22} color={theme.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

/* ─────────────────────────────
   PANTALLA PRINCIPAL
   ───────────────────────────── */
export default function RutinasScreen() {
  const { theme } = useTheme();
  const [rutinas, setRutinas] = useState([]);
  const [activeRoutineId, setActiveRoutineId] = useState(null);
  const [newRoutineName, setNewRoutineName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOfferModalVisible, setIsOfferModalVisible] = useState(false);
  const [isPremiumOfferModalVisible, setIsPremiumOfferModalVisible] = useState(false);

  // Search and folder state
  const [searchQuery, setSearchQuery] = useState('');
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [folderModalVisible, setFolderModalVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [moveFolderModalVisible, setMoveFolderModalVisible] = useState(false);
  const [routineToMove, setRoutineToMove] = useState(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [routineToDelete, setRoutineToDelete] = useState(null);

  const { user, token } = useAuth();
  const tipoUsuario = user?.tipoUsuario;
  const canSync = tipoUsuario === PLAN.CLIENTE || tipoUsuario === PLAN.ADMIN;
  const showPremiumTeaser = tipoUsuario === PLAN.FREEUSER;
  const showPremiumRoutines = tipoUsuario === PLAN.PREMIUM || tipoUsuario === PLAN.CLIENTE || tipoUsuario === PLAN.ADMIN;

  /* Carga inicial */
  const loadRutinasAndActiveId = useCallback(async () => {
    setIsLoading(true);
    try {
      const [storedRutinas, activeId] = await Promise.all([
        AsyncStorage.getItem('rutinas'),
        AsyncStorage.getItem('active_routine'),
      ]);

      let localRutinas = [];
      if (storedRutinas) {
        const parsed = JSON.parse(storedRutinas);
        localRutinas = Array.isArray(parsed) ? parsed : [];
      }

      // Cargar rutinas desde el servidor (MongoDB)
      let serverRutinas = [];
      if (token) {
        try {
          const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';
          const response = await fetch(`${apiBaseUrl}/api/routines`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && Array.isArray(data.routines)) {
              serverRutinas = data.routines.map(r => ({
                id: r._id,
                nombre: r.nombre,
                origen: 'server',
                updatedAt: r.updatedAt,
                folder: r.folder || null,
              }));
            }
          }
        } catch (error) {
          console.error('Error cargando rutinas del servidor:', error);
        }
      }

      // Filtrar rutinas estáticas (predefined y premium)
      const safePredefined = Array.isArray(predefinedRoutines) ? predefinedRoutines : [];
      const safePremium = Array.isArray(premiumRoutines) ? premiumRoutines : [];

      const staticIds = new Set([
        ...safePredefined.map(r => r?.id).filter(Boolean),
        ...safePremium.map(r => r?.id).filter(Boolean),
      ]);

      // Combinar rutinas: solo locales que no sean estáticas + todas las del servidor
      const filteredLocalRutinas = localRutinas.filter(r => r && !staticIds.has(r.id) && r.origen !== 'server');

      // Combinar y eliminar duplicados (priorizar servidor)
      const serverIds = new Set(serverRutinas.map(r => r.id));
      const finalLocalRutinas = filteredLocalRutinas.filter(r => !serverIds.has(r.id));

      const allRutinas = [...serverRutinas, ...finalLocalRutinas];
      setRutinas(allRutinas);

      // Actualizar AsyncStorage con la lista combinada
      await AsyncStorage.setItem('rutinas', JSON.stringify(allRutinas));

      // Extract folders
      const uniqueFolders = [...new Set(allRutinas.map(r => r.folder).filter(Boolean))];
      setFolders(uniqueFolders);

      if (activeId) {
        setActiveRoutineId(activeId);
      }
    } catch (e) {
      console.error('Error cargando rutinas:', e);
      Alert.alert('Error', 'No se pudieron cargar las rutinas.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);
  useEffect(() => {
    loadRutinasAndActiveId();
  }, [loadRutinasAndActiveId]);

  /* Gestión de rutinas (CRUD) */
  const handleAddRoutine = useCallback(async () => {
    if (newRoutineName.trim() === '') {
      Alert.alert('Error', 'El nombre de la rutina no puede estar vacío.');
      return;
    }
    const newRoutine = {
      id: `r-${uid()}`,
      nombre: newRoutineName.trim(),
      origen: 'local',
      updatedAt: new Date().toISOString(),
      folder: selectedFolder || null,
    };
    try {
      const newRutinasList = [...rutinas, newRoutine];
      setRutinas(newRutinasList);
      await AsyncStorage.setItem('rutinas', JSON.stringify(newRutinasList));
      const initialContent = { dia1: [] };
      await AsyncStorage.setItem(`routine_${newRoutine.id}`, JSON.stringify(initialContent));
      setNewRoutineName('');
      router.push(`/rutinas/${newRoutine.id}`);
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar la rutina.');
    }
  }, [newRoutineName, rutinas, selectedFolder]);

  const handleDeleteRoutine = useCallback((idToDelete) => {
    setRoutineToDelete(idToDelete);
    setDeleteModalVisible(true);
  }, []);

  const confirmDeleteRoutine = useCallback(async () => {
    if (!routineToDelete) return;

    try {
      const newRutinasList = rutinas.filter((r) => r.id !== routineToDelete);
      setRutinas(newRutinasList);
      await AsyncStorage.setItem('rutinas', JSON.stringify(newRutinasList));
      await AsyncStorage.multiRemove([`routine_${routineToDelete}`, `last_session_${routineToDelete}`]);
      if (activeRoutineId === routineToDelete) {
        await AsyncStorage.multiRemove(['active_routine', 'active_routine_name']);
        setActiveRoutineId(null);
      }
      setDeleteModalVisible(false);
      setRoutineToDelete(null);
    } catch (e) {
      Alert.alert('Error', 'No se pudo eliminar la rutina.');
      setDeleteModalVisible(false);
      setRoutineToDelete(null);
    }
  }, [rutinas, activeRoutineId, routineToDelete]);

  const handleSelectRoutine = useCallback(async (id, nombre, section) => {
    try {
      const isGratis = section?.title === 'RUTINAS GRATIS';
      const isPremium = section?.title === 'RUTINAS PREMIUM';

      if (isGratis || isPremium) {
        const sourceArray = isGratis ? predefinedRoutines : premiumRoutines;
        const rutinaCompleta = sourceArray.find(r => r.id === id);
        if (rutinaCompleta && rutinaCompleta.diasArr) {
          const rutinaData = {};
          rutinaCompleta.diasArr.forEach((diaEjercicios, index) => {
            rutinaData[`dia${index + 1}`] = diaEjercicios;
          });
          await AsyncStorage.setItem(`routine_${id}`, JSON.stringify(rutinaData));
        }
      }
      await AsyncStorage.multiSet([['active_routine', id], ['active_routine_name', nombre || '']]);
      setActiveRoutineId(id);
      router.push('/entreno');
    } catch (e) {
      Alert.alert('Error', 'No se pudo seleccionar la rutina.');
    }
  }, []);

  /* Importación CSV */
  const handlePickDocument = useCallback(async () => {
    if (tipoUsuario === PLAN.FREEUSER) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values'],
        copyToCacheDirectory: true,
      });

      let fileUri = null;
      let fileName = 'Rutina importada';

      if (result.assets && result.assets.length > 0) {
        fileUri = result.assets[0].uri;
        fileName = result.assets[0].name;
      } else if (result.type === 'success' && result.uri) {
        fileUri = result.uri;
        fileName = result.name;
      }

      if (!fileUri) return;

      const fileContentBase64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const fileContent = atob(fileContentBase64);
      const cleanContent = fileContent.startsWith('\uFEFF') ? fileContent.substring(1) : fileContent;

      Papa.parse(cleanContent, {
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: (h) => h.trim().toUpperCase(),
        complete: async (results) => {
          if (results.errors.length > 0) {
            Alert.alert('Error CSV', `Error al leer fila: ${results.errors[0].message}`);
            return;
          }
          const required = ['DIA', 'MUSCULO', 'EJERCICIO'];
          const missing = required.filter((h) => !results.meta.fields.includes(h));
          if (missing.length > 0) {
            Alert.alert('Error de formato', `Faltan columnas obligatorias: ${missing.join(', ')}`);
            return;
          }

          const normalizedRutina = normalizeCSV(results.data);
          const newRoutineName = fileName.replace(/\.(csv|txt)$/i, '') || 'Rutina importada';
          const newId = `r-${uid()}`;
          const newRoutineMeta = {
            id: newId,
            nombre: newRoutineName,
            origen: 'local',
            updatedAt: new Date().toISOString(),
            folder: selectedFolder || null,
          };
          const newRutinasList = [...rutinas, newRoutineMeta];

          await AsyncStorage.setItem(`routine_${newId}`, JSON.stringify(normalizedRutina));
          await AsyncStorage.setItem('rutinas', JSON.stringify(newRutinasList));

          setRutinas(newRutinasList);
          Alert.alert('Éxito', `Rutina "${newRoutineName}" importada.`);
          router.push(`/rutinas/${newId}`);
        },
        error: (err) => Alert.alert('Error', `No se pudo procesar el CSV: ${err.message}`),
      });
    } catch (e) {
      Alert.alert('Error', `No se pudo importar el archivo: ${e.message}`);
    }
  }, [tipoUsuario, rutinas, selectedFolder]);

  /* Sincronización */
  const onSync = useCallback(async () => {
    if (!token || !canSync) {
      Alert.alert('Acción no permitida', 'La sincronización solo está disponible para clientes.');
      return;
    }
    if (isSyncing) return;

    setIsSyncing(true);
    try {
      const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://consistent-donna-titogeremito-29c943bc.koyeb.app';
      const { synced, error } = await syncRoutinesFromServer(
        apiBaseUrl.replace(/\/api$/, ''),
        token
      );
      if (error) {
        Alert.alert('Error de Sincronización', error);
      } else {
        Alert.alert('Sincronización Completa', `Se actualizaron ${synced.length} rutinas.`);
        await loadRutinasAndActiveId();
      }
    } catch (e) {
      Alert.alert('Error', `No se pudo completar la sincronización: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  }, [token, canSync, isSyncing, loadRutinasAndActiveId]);

  /* Folder Management */
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      Alert.alert('Error', 'El nombre de la carpeta no puede estar vacío');
      return;
    }

    if (folders.includes(newFolderName.trim())) {
      Alert.alert('Error', 'Ya existe una carpeta con ese nombre');
      return;
    }

    setFolders(prev => [...prev, newFolderName.trim()]);
    setNewFolderName('');
    setFolderModalVisible(false);
    Alert.alert('Éxito', 'Carpeta creada correctamente');
  };

  const handleMoveToFolder = async (folder) => {
    if (!routineToMove) return;

    try {
      const updatedRoutines = rutinas.map(r =>
        r.id === routineToMove.id ? { ...r, folder } : r
      );
      setRutinas(updatedRoutines);
      await AsyncStorage.setItem('rutinas', JSON.stringify(updatedRoutines));

      setMoveFolderModalVisible(false);
      setRoutineToMove(null);
      Alert.alert('Éxito', 'Rutina movida correctamente');
    } catch (error) {
      console.error('Error moving routine:', error);
      Alert.alert('Error', 'Error al mover la rutina');
    }
  };

  const openMoveModal = (routine) => {
    setRoutineToMove(routine);
    setMoveFolderModalVisible(true);
  };

  /* Filter routines */
  const filteredRutinas = useMemo(() => {
    return rutinas.filter(routine => {
      const matchesSearch = routine.nombre.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFolder = selectedFolder === null || routine.folder === selectedFolder;
      return matchesSearch && matchesFolder;
    });
  }, [rutinas, searchQuery, selectedFolder]);

  /* Secciones */
  const sections = useMemo(() => {
    const data = [];
    const safePredefined = Array.isArray(predefinedRoutines) ? predefinedRoutines : [];
    const safePremium = Array.isArray(premiumRoutines) ? premiumRoutines : [];

    data.push({ title: 'RUTINAS PROPIAS', data: filteredRutinas });
    data.push({ title: 'RUTINAS GRATIS', data: safePredefined });

    if (showPremiumRoutines) {
      data.push({ title: 'RUTINAS PREMIUM', data: safePremium });
    } else if (showPremiumTeaser) {
      data.push({ title: 'RUTINAS PREMIUM', data: [] });
    }
    return data;
  }, [filteredRutinas, showPremiumRoutines, showPremiumTeaser]);

  /* Renderizadores */
  const RenderSectionHeader = useCallback(({ title, data }) => {
    if (title === 'RUTINAS PREMIUM' && data.length === 0 && showPremiumTeaser) {
      return (
        <View style={[styles.sectionHeaderTeaser, { backgroundColor: theme.premiumLight, borderColor: theme.premium }]}>
          <View style={styles.sectionHeaderTeaserLeft}>
            <Ionicons name="lock-closed" size={20} color={theme.premium} />
            <Text style={[styles.sectionTitleTeaser, { color: theme.premiumDark }]}>{title}</Text>
          </View>
          <TouchableOpacity style={styles.premiumTeaserButton} onPress={() => setIsPremiumOfferModalVisible(true)}>
            <Ionicons name="add-circle" size={26} color={theme.premium} />
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={[styles.sectionHeader, { backgroundColor: theme.sectionHeader }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
        {title === 'RUTINAS GRATIS' && <Ionicons name="gift-outline" size={18} color={theme.success} style={{ marginLeft: 6 }} />}
        {title === 'RUTINAS PREMIUM' && <Ionicons name="star" size={18} color={theme.premium} style={{ marginLeft: 6 }} />}
      </View>
    );
  }, [theme, showPremiumTeaser, setIsPremiumOfferModalVisible]);

  const RenderRutina = useCallback(({ item, section }) => {
    const isActive = activeRoutineId === item.id;
    const isPropia = section.title === 'RUTINAS PROPIAS';
    const canDelete = isPropia;
    const canEdit = isPropia;

    return (
      <View style={styles.rutinaContainer}>
        <TouchableOpacity
          style={[
            styles.rutinaButton,
            { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
            isActive && [styles.rutinaButtonActive, { backgroundColor: theme.successLight, borderColor: theme.success }]
          ]}
          onPress={() => handleSelectRoutine(item.id, item.nombre, section)}
          activeOpacity={0.8}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.rutinaNombre, { color: theme.text }, isActive && { color: theme.successText }]} numberOfLines={1}>
              {item.nombre}
            </Text>
            {item.folder && (
              <View style={styles.folderTag}>
                <Ionicons name="folder" size={11} color={theme.textSecondary} />
                <Text style={[styles.folderText, { color: theme.textSecondary }]}>{item.folder}</Text>
              </View>
            )}
          </View>

          <View style={styles.rutinaControles}>
            {isPropia && (
              <TouchableOpacity
                style={[styles.rutinaBtn, { backgroundColor: theme.backgroundTertiary }]}
                onPress={(e) => {
                  e.stopPropagation();
                  openMoveModal(item);
                }}
              >
                <Ionicons name="folder-outline" size={16} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
            {canEdit && (
              <TouchableOpacity style={[styles.rutinaBtn, styles.rutinaBtnEdit]} onPress={() => router.push(`/rutinas/${item.id}?name=${encodeURIComponent(item.nombre)}`)}>
                <Ionicons name="pencil" size={16} color={theme.primary} />
              </TouchableOpacity>
            )}
            {canDelete && (
              <TouchableOpacity
                style={[styles.rutinaBtn, styles.rutinaBtnDelete, { backgroundColor: theme.dangerLight }]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleDeleteRoutine(item.id);
                }}
              >
                <Ionicons name="trash" size={16} color={theme.danger} />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  }, [theme, activeRoutineId, handleSelectRoutine, handleDeleteRoutine, openMoveModal]);

  const ListEmpty = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Cargando rutinas...</Text>
        </View>
      );
    }
    return null;
  }, [isLoading, theme]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: 'Gestión de Rutinas', headerTitleAlign: 'center' }} />

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item, section }) => <RenderRutina item={item} section={section} />}
        renderSectionHeader={({ section: { title, data } }) => <RenderSectionHeader title={title} data={data} />}

        ListHeaderComponent={
          <ListHeaderComponent
            theme={theme}
            newRoutineName={newRoutineName}
            onNameChange={setNewRoutineName}
            onAddRoutine={handleAddRoutine}
            onPickDocument={handlePickDocument}
            onSync={onSync}
            tipoUsuario={tipoUsuario}
            canSync={canSync}
            isSyncing={isSyncing}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            folders={folders}
            selectedFolder={selectedFolder}
            onFolderSelect={setSelectedFolder}
            onCreateFolder={() => setFolderModalVisible(true)}
          />
        }

        ListEmptyComponent={ListEmpty}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        style={styles.container}
      />

      {/* Banner */}
      <TouchableOpacity style={[styles.promoBanner, { backgroundColor: theme.backgroundSecondary, borderTopColor: theme.border }]} onPress={() => setIsOfferModalVisible(true)} activeOpacity={0.8}>
        <Ionicons name="sparkles-outline" size={18} color={theme.premium} style={{ marginRight: 8 }} />
        <Text style={[styles.promoBannerText, { color: theme.premium }]}>
          Rutinas genéricas... ¿Quieres dar el cambio? ¡Pincha aquí!
        </Text>
        <Ionicons name="arrow-forward-circle-outline" size={18} color={theme.premium} style={{ marginLeft: 8 }} />
      </TouchableOpacity>

      {/* Create Folder Modal */}
      <Modal
        visible={folderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFolderModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Nueva Carpeta</Text>
            <TextInput
              style={[styles.modalInput, {
                borderColor: theme.inputBorder,
                backgroundColor: theme.inputBackground,
                color: theme.text
              }]}
              placeholder="Nombre de la carpeta"
              placeholderTextColor={theme.placeholder}
              value={newFolderName}
              onChangeText={setNewFolderName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { backgroundColor: theme.backgroundTertiary }]}
                onPress={() => {
                  setFolderModalVisible(false);
                  setNewFolderName('');
                }}
              >
                <Text style={[styles.modalButtonTextCancel, { color: theme.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, { backgroundColor: theme.primary }]}
                onPress={handleCreateFolder}
              >
                <Text style={styles.modalButtonText}>Crear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Move to Folder Modal */}
      <Modal
        visible={moveFolderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMoveFolderModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Mover a Carpeta</Text>
            <ScrollView style={styles.folderList}>
              <TouchableOpacity
                style={[styles.folderItem, { backgroundColor: theme.backgroundTertiary }]}
                onPress={() => handleMoveToFolder(null)}
              >
                <Ionicons name="folder-outline" size={20} color={theme.textSecondary} />
                <Text style={[styles.folderItemText, { color: theme.text }]}>Sin carpeta</Text>
              </TouchableOpacity>
              {folders.map((folder, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.folderItem, { backgroundColor: theme.backgroundTertiary }]}
                  onPress={() => handleMoveToFolder(folder)}
                >
                  <Ionicons name="folder" size={20} color={theme.primary} />
                  <Text style={[styles.folderItemText, { color: theme.text }]}>{folder}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonCancel, { marginTop: 16, backgroundColor: theme.backgroundTertiary }]}
              onPress={() => {
                setMoveFolderModalVisible(false);
                setRoutineToMove(null);
              }}
            >
              <Text style={[styles.modalButtonTextCancel, { color: theme.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Confirmar eliminación</Text>
            <Text style={[styles.modalDescription, { color: theme.textSecondary }]}>
              ¿Seguro que quieres eliminar esta rutina? Esta acción no se puede deshacer.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { backgroundColor: theme.backgroundTertiary }]}
                onPress={() => {
                  setDeleteModalVisible(false);
                  setRoutineToDelete(null);
                }}
              >
                <Text style={[styles.modalButtonTextCancel, { color: theme.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, { backgroundColor: theme.danger }]}
                onPress={confirmDeleteRoutine}
              >
                <Text style={styles.modalButtonText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Promo */}
      <Modal animationType="slide" transparent={false} visible={isOfferModalVisible} onRequestClose={() => setIsOfferModalVisible(false)} statusBarTranslucent={true}>
        <SafeAreaView style={styles.offerModalContainer}>
          <TouchableOpacity style={styles.offerModalCloseButton} onPress={() => setIsOfferModalVisible(false)}>
            <Ionicons name="close-circle" size={32} color="#cccccc" />
          </TouchableOpacity>
          <View style={styles.offerRoot}>
            <ImageBackground source={require('../../../assets/images/fitness/promocion.png')} style={styles.offerBg} resizeMode="cover" />
            <View style={styles.offerFooter}>
              <TouchableOpacity style={styles.ctaBtn} onPress={() => Linking.openURL('https://forms.gle/MGM5xtFx7hYgSGNW8')} activeOpacity={0.9}>
                <Text style={styles.ctaBtnText}>Quiero mi plan personalizado</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Modal Premium - Diseño Mejorado */}
      <Modal animationType="fade" transparent={true} visible={isPremiumOfferModalVisible} onRequestClose={() => setIsPremiumOfferModalVisible(false)}>
        <View style={styles.premiumModalOverlay}>
          <View style={[styles.premiumModalContainer, { backgroundColor: theme.cardBackground }]}>
            {/* Botón cerrar */}
            <TouchableOpacity
              style={styles.premiumModalCloseBtn}
              onPress={() => setIsPremiumOfferModalVisible(false)}
            >
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>

            {/* Header con icono */}
            <View style={styles.premiumModalHeader}>
              <View style={[styles.premiumIconBg, { backgroundColor: theme.premiumLight || 'rgba(234, 179, 8, 0.15)' }]}>
                <Ionicons name="diamond" size={40} color={theme.premium || '#EAB308'} />
              </View>
              <Text style={[styles.premiumModalTitle, { color: theme.text }]}>
                🚀 ¡Desbloquea Premium!
              </Text>
              <Text style={[styles.premiumModalDesc, { color: theme.textSecondary }]}>
                Accede a rutinas avanzadas diseñadas por expertos
              </Text>
            </View>

            {/* Beneficios */}
            <View style={[styles.premiumBenefitsList, { backgroundColor: theme.backgroundTertiary, borderColor: theme.border }]}>
              <View style={styles.premiumBenefitItem}>
                <Ionicons name="checkmark-circle" size={20} color={theme.success || '#22C55E'} />
                <Text style={[styles.premiumBenefitText, { color: theme.text }]}>Rutinas premium ilimitadas</Text>
              </View>
              <View style={styles.premiumBenefitItem}>
                <Ionicons name="checkmark-circle" size={20} color={theme.success || '#22C55E'} />
                <Text style={[styles.premiumBenefitText, { color: theme.text }]}>Vídeos de técnica correcta</Text>
              </View>
              <View style={styles.premiumBenefitItem}>
                <Ionicons name="checkmark-circle" size={20} color={theme.success || '#22C55E'} />
                <Text style={[styles.premiumBenefitText, { color: theme.text }]}>Sincronización en la nube</Text>
              </View>
              <View style={styles.premiumBenefitItem}>
                <Ionicons name="checkmark-circle" size={20} color={theme.success || '#22C55E'} />
                <Text style={[styles.premiumBenefitText, { color: theme.text }]}>Estadísticas avanzadas</Text>
              </View>
            </View>

            {/* Botón principal */}
            <TouchableOpacity
              style={[styles.premiumMainBtn, { backgroundColor: theme.premium || '#EAB308' }]}
              onPress={() => {
                setIsPremiumOfferModalVisible(false);
                router.push('/payment');
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="flash" size={20} color="#fff" />
              <Text style={styles.premiumMainBtnText}>Ver Planes Premium</Text>
            </TouchableOpacity>

            {/* Separador */}
            <View style={styles.premiumSeparator}>
              <View style={[styles.premiumSeparatorLine, { backgroundColor: theme.border }]} />
              <Text style={[styles.premiumSeparatorText, { color: theme.textSecondary }]}>o</Text>
              <View style={[styles.premiumSeparatorLine, { backgroundColor: theme.border }]} />
            </View>

            {/* Opción VIP */}
            <TouchableOpacity
              style={[styles.premiumVipBtn, { borderColor: theme.success || '#22C55E' }]}
              onPress={() => {
                setIsPremiumOfferModalVisible(false);
                Linking.openURL('https://forms.gle/MGM5xtFx7hYgSGNW8');
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="medal" size={18} color={theme.success || '#22C55E'} />
              <Text style={[styles.premiumVipBtnText, { color: theme.success || '#22C55E' }]}>
                Quiero un entrenador personal
              </Text>
            </TouchableOpacity>

            {/* Botón cancelar */}
            <TouchableOpacity
              style={styles.premiumCancelBtn}
              onPress={() => setIsPremiumOfferModalVisible(false)}
            >
              <Text style={[styles.premiumCancelText, { color: theme.textSecondary }]}>
                Tal vez más tarde
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

/* ─────────────────
   Estilos
   ───────────────── */
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  header: { padding: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  inputContainer: { flexDirection: 'row', marginBottom: 12 },
  input: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  addButton: { marginLeft: 10, borderRadius: 8, padding: 10, justifyContent: 'center', alignItems: 'center' },
  buttonRow: { flexDirection: 'row', gap: 10, justifyContent: 'flex-start', marginBottom: 12 },
  button: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, gap: 8 },
  iconButton: { padding: 10, borderRadius: 8 },
  buttonDisabled: { backgroundColor: '#9ca3af' },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '500' },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15 },

  folderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    gap: 12,
  },
  folderScroll: { flex: 1, maxHeight: 40 }, folderScrollContent: { gap: 8 },
  folderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  folderChipText: { fontSize: 13, fontWeight: '500' },
  fixedIconContainer: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  sectionHeader: { paddingHorizontal: 16, paddingVertical: 10, paddingTop: 20, flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', textTransform: 'uppercase' },

  sectionHeaderTeaser: { marginTop: 20, paddingHorizontal: 16, paddingVertical: 12, paddingTop: 10, borderTopWidth: 2, borderBottomWidth: 2, borderRadius: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionHeaderTeaserLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitleTeaser: { padding: 0, fontSize: 16, fontWeight: '700', textTransform: 'uppercase' },
  premiumTeaserButton: { padding: 2 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, marginTop: 20 },
  emptyText: { fontSize: 16, fontWeight: '500', marginTop: 12, textAlign: 'center' },

  rutinaContainer: { paddingHorizontal: 12, marginVertical: 4 },
  rutinaButton: { borderRadius: 10, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  rutinaButtonActive: { borderWidth: 1.5 },
  rutinaNombre: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  folderTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  folderText: { fontSize: 11 },
  rutinaControles: { flexDirection: 'row', gap: 6 },
  rutinaBtn: { padding: 6, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  rutinaBtnEdit: { backgroundColor: '#dbeafe' },
  rutinaBtnDelete: {},

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  modalDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {},
  modalButtonConfirm: {},
  modalButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  modalButtonTextCancel: {
    fontWeight: '600',
    fontSize: 15,
  },
  folderList: {
    maxHeight: 300,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  folderItemText: {
    fontSize: 15,
    fontWeight: '500',
  },

  promoBanner: { paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 25 },
  promoBannerText: { fontSize: 13, fontWeight: '500', textAlign: 'center', flexShrink: 1, marginHorizontal: 5 },

  offerModalContainer: { flex: 1, backgroundColor: '#0B1220' },
  offerModalCloseButton: { position: 'absolute', top: Platform.OS === 'android' ? 45 : 60, right: 15, zIndex: 10, padding: 8, backgroundColor: 'rgba(255, 255, 255, 0.15)', borderRadius: 20 },
  offerRoot: { flex: 1, backgroundColor: '#000' },
  offerBg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  offerFooter: { position: 'absolute', left: 16, right: 16, bottom: 100, alignItems: 'center' },
  ctaBtn: { width: '100%', maxWidth: 420, backgroundColor: '#3b82f6', paddingVertical: 14, paddingHorizontal: 18, borderRadius: 12, elevation: 3 },
  ctaBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' },

  premiumOfferModalOverlay: { flex: 1, width: '100%', backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  premiumOfferModalScroll: { justifyContent: 'center', alignItems: 'center', width: '100%' },
  premiumOfferModalContent: { width: '90%', maxWidth: "100%", borderRadius: 16, padding: 15, paddingTop: 25, alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.30, shadowRadius: 12, elevation: 10, marginVertical: 20 },
  premiumOfferModalCloseButton: { position: 'absolute', top: 12, right: 12, zIndex: 10, padding: 6 },
  premiumOfferModalTitle: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  premiumOfferModalSubtitle: { fontSize: 16, textAlign: 'center', marginBottom: 24 },
  premiumOptionCard: { borderRadius: 12, borderWidth: 1, padding: 20, flexDirection: 'row', alignItems: 'flex-start', width: '100%', marginBottom: 16, gap: 16 },
  premiumOptionTextContainer: { flex: 1 },
  premiumOptionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  premiumOptionDescription: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  premiumCtaButton: { borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  premiumCtaButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  premiumOrText: { fontSize: 14, fontWeight: '600', marginVertical: 8 },

  // Nuevos estilos para el modal premium mejorado
  premiumModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  premiumModalContainer: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  premiumModalCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  premiumModalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  premiumIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  premiumModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  premiumModalDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  premiumBenefitsList: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  premiumBenefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  premiumBenefitText: {
    fontSize: 14,
    fontWeight: '500',
  },
  premiumMainBtn: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  premiumMainBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  premiumSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
    gap: 12,
  },
  premiumSeparatorLine: {
    flex: 1,
    height: 1,
  },
  premiumSeparatorText: {
    fontSize: 13,
    fontWeight: '500',
  },
  premiumVipBtn: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
  },
  premiumVipBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  premiumCancelBtn: {
    paddingVertical: 8,
  },
  premiumCancelText: {
    fontSize: 13,
    fontWeight: '500',
  },
});