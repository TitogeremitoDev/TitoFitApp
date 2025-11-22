/* app/rutinas/index.jsx
   ────────────────────────────────────────────────
   ▸ Pantalla de gestión de rutinas con SectionList
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
  isSyncing 
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
      
      if (storedRutinas) {
        const parsed = JSON.parse(storedRutinas);
        const safePredefined = Array.isArray(predefinedRoutines) ? predefinedRoutines : [];
        const safePremium = Array.isArray(premiumRoutines) ? premiumRoutines : [];
        
        const staticIds = new Set([
          ...safePredefined.map(r => r?.id).filter(Boolean),
          ...safePremium.map(r => r?.id).filter(Boolean),
        ]);
        const filteredRutinas = Array.isArray(parsed) ? parsed.filter(r => r && !staticIds.has(r.id)) : [];
        setRutinas(filteredRutinas);
      }
      if (activeId) {
        setActiveRoutineId(activeId);
      }
    } catch (e) {
      console.error('Error cargando rutinas:', e);
      Alert.alert('Error', 'No se pudieron cargar las rutinas.');
    } finally {
      setIsLoading(false);
    }
  }, []);

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
  }, [newRoutineName, rutinas]);

  const handleDeleteRoutine = useCallback((idToDelete) => {
    Alert.alert(
      'Confirmar eliminación',
      '¿Seguro que quieres eliminar esta rutina?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const newRutinasList = rutinas.filter((r) => r.id !== idToDelete);
              setRutinas(newRutinasList);
              await AsyncStorage.setItem('rutinas', JSON.stringify(newRutinasList));
              await AsyncStorage.multiRemove([`routine_${idToDelete}`, `last_session_${idToDelete}`]);
              if (activeRoutineId === idToDelete) {
                await AsyncStorage.multiRemove(['active_routine', 'active_routine_name']);
                setActiveRoutineId(null);
              }
            } catch (e) {
              Alert.alert('Error', 'No se pudo eliminar la rutina.');
            }
          },
        },
      ]
    );
  }, [rutinas, activeRoutineId]);

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
  }, [tipoUsuario, rutinas]);

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

  /* Secciones */
  const sections = useMemo(() => {
    const data = [];
    const safePredefined = Array.isArray(predefinedRoutines) ? predefinedRoutines : [];
    const safePremium = Array.isArray(premiumRoutines) ? premiumRoutines : [];
    const safeRutinas = Array.isArray(rutinas) ? rutinas : [];
    
    data.push({ title: 'RUTINAS PROPIAS', data: safeRutinas });
    data.push({ title: 'RUTINAS GRATIS', data: safePredefined });

    if (showPremiumRoutines) {
      data.push({ title: 'RUTINAS PREMIUM', data: safePremium });
    } else if (showPremiumTeaser) {
      data.push({ title: 'RUTINAS PREMIUM', data: [] });
    }
    return data;
  }, [rutinas, showPremiumRoutines, showPremiumTeaser]);

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
    const canDelete = isPropia && item.origen !== 'server';
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
          <Text style={[styles.rutinaNombre, { color: theme.text }, isActive && { color: theme.successText }]} numberOfLines={1}>
            {item.origen === 'server' ? '🔒 ' : ''}{item.nombre}
          </Text>

          <View style={styles.rutinaControles}>
            {canEdit && (
              <TouchableOpacity style={[styles.rutinaBtn, styles.rutinaBtnEdit]} onPress={() => router.push(`/rutinas/${item.id}`)}>
                <Ionicons name="pencil" size={18} color={theme.primary} />
              </TouchableOpacity>
            )}
            {canDelete && (
              <TouchableOpacity style={[styles.rutinaBtn, styles.rutinaBtnDelete, { backgroundColor: theme.dangerLight }]} onPress={() => handleDeleteRoutine(item.id)}>
                <Ionicons name="trash" size={18} color={theme.danger} />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  }, [theme, activeRoutineId, handleSelectRoutine, handleDeleteRoutine]);
  
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
        
        /* CORRECCIÓN: Pasamos el componente externo y sus props aquí */
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
          />
        }

        ListEmptyComponent={ListEmpty}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        style={styles.container}
      />
      
      {/* Banner */}
      <TouchableOpacity style={[styles.promoBanner, { backgroundColor: theme.backgroundSecondary, borderTopColor: theme.border }]} onPress={() => setIsOfferModalVisible(true)} activeOpacity={0.8}>
        <Ionicons name="sparkles-outline" size={18} color={theme.premium} style={{ marginRight: 8 }}/>
        <Text style={[styles.promoBannerText, { color: theme.premium }]}>
          Rutinas genéricas... ¿Quieres dar el cambio? ¡Pincha aquí!
        </Text>
        <Ionicons name="arrow-forward-circle-outline" size={18} color={theme.premium} style={{ marginLeft: 8 }}/>
      </TouchableOpacity>

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

      {/* Modal Premium */}
      <Modal animationType="fade" transparent={true} visible={isPremiumOfferModalVisible} onRequestClose={() => setIsPremiumOfferModalVisible(false)}>
        <View style={styles.premiumOfferModalOverlay}>
          <ScrollView contentContainerStyle={styles.premiumOfferModalScroll}>
          <View style={[styles.premiumOfferModalContent, { backgroundColor: theme.cardBackground }]}>
            <TouchableOpacity style={styles.premiumOfferModalCloseButton} onPress={() => setIsPremiumOfferModalVisible(false)}>
              <Ionicons name="close-circle" size={30} color={theme.textSecondary} />
            </TouchableOpacity>
            <Ionicons name="flash-sharp" size={60} color={theme.premium} style={{ marginBottom: 20 }} />
            <Text style={[styles.premiumOfferModalTitle, { color: theme.text }]}>Desbloquea tu Potencial Ilimitado</Text>
            <Text style={[styles.premiumOfferModalSubtitle, { color: theme.textSecondary }]}>
              Las rutinas premium te esperan. Eleva tu entrenamiento al siguiente nivel.
            </Text>

            <View style={[styles.premiumOptionCard, { backgroundColor: theme.backgroundTertiary, borderColor: theme.border }]}>
              <Ionicons name="medal-outline" size={30} color={theme.success} />
              <View style={styles.premiumOptionTextContainer}>
                <Text style={[styles.premiumOptionTitle, { color: theme.text }]}>Conviértete en Cliente VIP</Text>
                <Text style={[styles.premiumOptionDescription, { color: theme.textSecondary }]}>
                  ¿Buscas resultados garantizados y un seguimiento personalizado?
                </Text>
                <TouchableOpacity style={[styles.premiumCtaButton, { backgroundColor: theme.success }]} onPress={() => Linking.openURL('https://forms.gle/MGM5xtFx7hYgSGNW8')}>
                  <Text style={styles.premiumCtaButtonText}>Hablar con un Experto</Text>
                  <Ionicons name="chevron-forward" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={[styles.premiumOrText, { color: theme.textSecondary }]}>— O —</Text>

            <View style={[styles.premiumOptionCard, { backgroundColor: theme.backgroundTertiary, borderColor: theme.border }]}>
              <Ionicons name="diamond-outline" size={30} color={theme.primary} />
              <View style={styles.premiumOptionTextContainer}>
                <Text style={[styles.premiumOptionTitle, { color: theme.text }]}>Suscríbete a Premium</Text>
                <Text style={[styles.premiumOptionDescription, { color: theme.textSecondary }]}>
                  Accede al catálogo completo de rutinas avanzadas.
                </Text>
                <TouchableOpacity style={[styles.premiumCtaButton, { backgroundColor: theme.primary }]} onPress={() => Alert.alert('Suscripción', 'Próximamente...')}>
                  <Text style={styles.premiumCtaButtonText}>Obtener Premium (6.99€/mes)</Text>
                  <Ionicons name="chevron-forward" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
          </ScrollView>
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
  buttonRow: { flexDirection: 'row', gap: 10, justifyContent: 'flex-start' },
  button: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, gap: 8 },
  buttonDisabled: { backgroundColor: '#9ca3af' },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  
  sectionHeader: { paddingHorizontal: 16, paddingVertical: 10, paddingTop: 20, flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', textTransform: 'uppercase' },
  
  sectionHeaderTeaser: { marginTop: 20, paddingHorizontal: 16, paddingVertical: 12, paddingTop: 10, borderTopWidth: 2, borderBottomWidth: 2, borderRadius: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionHeaderTeaserLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitleTeaser: { padding:0, fontSize: 16, fontWeight: '700', textTransform: 'uppercase' },
  premiumTeaserButton: { padding: 2 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, marginTop: 20 },
  emptyText: { fontSize: 16, fontWeight: '500', marginTop: 12, textAlign: 'center' },
  
  rutinaContainer: { paddingHorizontal: 12, marginVertical: 4 },
  rutinaButton: { borderRadius: 12, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  rutinaButtonActive: { borderWidth: 1.5 },
  rutinaNombre: { fontSize: 16, fontWeight: '600', flex: 1, marginRight: 10 },
  rutinaControles: { flexDirection: 'row', gap: 6 },
  rutinaBtn: { padding: 8, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  rutinaBtnEdit: { backgroundColor: '#dbeafe' },
  rutinaBtnDelete: {},

  promoBanner: { paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 25 },
  promoBannerText: { fontSize: 13, fontWeight: '500', textAlign: 'center', flexShrink: 1, marginHorizontal: 5 },

  offerModalContainer: { flex: 1, backgroundColor: '#0B1220' },
  offerModalCloseButton: { position: 'absolute', top: Platform.OS === 'android' ? 45 : 60, right: 15, zIndex: 10, padding: 8, backgroundColor: 'rgba(255, 255, 255, 0.15)', borderRadius: 20 },
  offerRoot: { flex: 1, backgroundColor: '#000' },
  offerBg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  offerFooter: { position: 'absolute', left: 16, right: 16, bottom: 100, alignItems: 'center' },
  ctaBtn: { width: '100%', maxWidth: 420, backgroundColor: '#3b82f6', paddingVertical: 14, paddingHorizontal: 18, borderRadius: 12, elevation: 3 },
  ctaBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  
  premiumOfferModalOverlay: { flex: 1,width:'100%',backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 16 },
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
});