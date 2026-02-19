import React, { memo } from 'react';
import { View, Text, StyleSheet, Alert, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  EnhancedTouchable as TouchableOpacity,
  EnhancedTextInput as TextInput,
} from '../ui';
import {
  EXTRA_ABBR,
  NOTE_VALUES,
  getTrendIcon,
  findPrevHelper,
} from './ExerciseCardUtils';

const ExerciseCard = memo(({
  item,
  index,
  semana,
  diaIdx,
  prog,
  theme,
  expanded,
  onToggleExpand,
  setEstadoEjLocal,
  setSerieDato,
  flushProgress,
  onOpenTC,
  onOpenImage,
  onOpenVideo,
  notes,
  setNotesModal,
  exerciseDetails,
  showBiserieConnector,
  scrollToItem
}) => {
  const ejerKey = `${semana}|${diaIdx}|${item.id}`;
  const currentState = prog[ejerKey] === 'OJ' ? 'OE' : prog[ejerKey];
  const { details, hasImage, hasVideo } = exerciseDetails || {};

  return (
    <>
      <View style={[styles.card, {
        backgroundColor: theme.cardBackground,
        borderColor: showBiserieConnector ? '#F59E0B' : theme.cardBorder,
        borderWidth: showBiserieConnector ? 2 : 1,
      }]}>
        {showBiserieConnector && (
          <View style={styles.biserieBadge}>
            <Text style={styles.biserieBadgeText}>BS</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.cardHeader, { borderColor: theme.cardHeaderBorder, backgroundColor: theme.cardHeaderBg }]}
          onPress={onToggleExpand}
        >
          <Text style={[styles.cardTxt, { color: theme.text }]}>
            {item.musculo} — {item.nombre}
          </Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={theme.textSecondary}
          />
        </TouchableOpacity>

        <View style={styles.stateToolsRow}>
          <View style={styles.stateRow}>
            <TouchableOpacity
              style={[
                styles.radio,
                {
                  borderColor: currentState === 'C' ? '#22c55e' : '#bbf7d0',
                  backgroundColor: currentState === 'C' ? '#22c55e' : '#f0fdf4'
                }
              ]}
              onPress={() => setEstadoEjLocal(ejerKey, 'C')}
            >
              <Ionicons
                name="checkmark"
                size={16}
                color={currentState === 'C' ? '#fff' : '#86efac'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.radio,
                {
                  borderColor: currentState === 'NC' ? '#ef4444' : '#fecaca',
                  backgroundColor: currentState === 'NC' ? '#ef4444' : '#fef2f2'
                }
              ]}
              onPress={() => setEstadoEjLocal(ejerKey, 'NC')}
            >
              <Ionicons
                name="close"
                size={16}
                color={currentState === 'NC' ? '#fff' : '#fca5a5'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.radio,
                {
                  borderColor: currentState === 'OE' ? '#f97316' : '#fed7aa',
                  backgroundColor: currentState === 'OE' ? '#f97316' : '#fff7ed'
                }
              ]}
              onPress={() => setEstadoEjLocal(ejerKey, 'OE')}
            >
              <Ionicons
                name="swap-horizontal"
                size={16}
                color={currentState === 'OE' ? '#fff' : '#fdba74'}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.toolsRow}>
            <TouchableOpacity
              onPress={() => onOpenTC(item)}
              style={[styles.toolBtn, {
                backgroundColor: theme.backgroundTertiary,
                borderColor: theme.border
              }]}
              activeOpacity={0.85}
            >
              <Text style={[styles.toolBtnTxt, { color: theme.text }]}>TC</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onOpenImage(item)}
              style={[styles.toolBtn, styles.toolBtnIcon, {
                backgroundColor: theme.backgroundTertiary,
                borderColor: theme.border,
                opacity: hasImage ? 1 : 0.5
              }]}
              activeOpacity={0.85}
            >
              <Text style={{ fontSize: 14 }}>
                {hasImage ? '🖼️' : '🚫'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onOpenVideo(item)}
              style={[styles.toolBtn, styles.toolBtnIcon, {
                backgroundColor: theme.backgroundTertiary,
                borderColor: theme.border,
                opacity: hasVideo ? 1 : 0.5
              }]}
              activeOpacity={0.85}
            >
              <Ionicons
                name={hasVideo ? "videocam-outline" : "videocam-off-outline"}
                size={16}
                color={theme.text}
              />
            </TouchableOpacity>
          </View>
        </View>

        {expanded && (
          <View style={styles.seriesBox}>
            <View style={styles.serieRowHeader}>
              <Text style={[styles.serieLabel, { fontWeight: 'bold', color: theme.textSecondary }]}>#</Text>
              <View style={styles.inputCol}>
                <Text style={[styles.colLabel, { color: theme.textSecondary }]}>Reps</Text>
              </View>
              <View style={styles.inputCol}>
                <Text style={[styles.colLabel, { color: theme.textSecondary }]}>Kg</Text>
              </View>
              <View style={{ flex: 1 }} />
            </View>

            {(item.series || []).map((serie, idx) => {
              const serieKey = `${ejerKey}|${idx}`;
              // Use findPrevHelper instead of local findPrev
              const prevReps = findPrevHelper(prog, semana, diaIdx, item.id, idx, 'reps');
              const prevKg = findPrevHelper(prog, semana, diaIdx, item.id, idx, 'peso');
              const curr = prog[serieKey] || {};

              let bgColor = theme.cardBackground;

              const repMinRaw = serie?.repMin;
              const repMaxRaw = serie?.repMax;
              const isFallo = String(repMinRaw).toLowerCase() === 'fallo' ||
                String(repMaxRaw).toLowerCase() === 'fallo';

              const repMin = !isFallo && repMinRaw != null ? Number(repMinRaw) : null;
              const repMax = !isFallo && repMaxRaw != null ? Number(repMaxRaw) : null;
              const reps = curr?.reps != null ? Number(curr.reps) : null;

              if (!isFallo && reps !== null && repMin !== null && repMax !== null && !isNaN(repMin) && !isNaN(repMax)) {
                if (reps < repMin) bgColor = '#fecaca';
                else if (reps > repMax) bgColor = '#bfdbfe';
                else bgColor = '#bbf7d0';
              }

              const prevExceeded =
                !isFallo && prevReps !== null && repMax !== null && Number(prevReps) > repMax;
              const iconReps = getTrendIcon(curr.reps, prevReps);
              const iconKg = getTrendIcon(curr.peso, prevKg);

              return (
                <View key={idx} style={[styles.serieRow, {
                  backgroundColor: bgColor,
                  borderColor: theme.border
                }]}>
                  <View style={{ width: 70, justifyContent: 'center' }}>
                    <Text style={{ fontSize: 12, color: theme.textSecondary }}>Serie {idx + 1}</Text>
                    {isFallo ? (
                      <Text style={{ fontSize: 10, color: '#ef4444', marginTop: 2, fontWeight: '600' }}>
                        🔥 Fallo
                      </Text>
                    ) : (repMin !== null && repMax !== null && !isNaN(repMin) && !isNaN(repMax)) && (
                      <Text style={{ fontSize: 10, color: theme.textSecondary, marginTop: 2 }}>
                        {repMin}-{repMax}
                      </Text>
                    )}
                    {serie?.nota && serie.nota.trim() !== '' && (
                      <TouchableOpacity
                        onPress={() => Alert.alert('📝 Nota del Coach', serie.nota)}
                        style={{ marginTop: 3 }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 10, color: '#f59e0b' }}>⚠️ Nota</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.inputWithTrend}>
                    <TextInput
                      style={[styles.serieInput, {
                        borderColor: theme.inputBorder,
                        backgroundColor: theme.inputBackground,
                        color: theme.inputText
                      }]}
                      placeholder={prevReps ? String(prevReps) : ''}
                      placeholderTextColor={theme.placeholder}
                      keyboardType="numeric"
                      value={curr.reps || ''}
                      onFocus={() => {
                        scrollToItem?.(index);
                      }}
                      onChangeText={(v) => setSerieDato(serieKey, 'reps', v, item, (item.series || []).length)}
                      onBlur={flushProgress}
                    />
                    {iconReps && (
                      <Ionicons
                        name={iconReps.name}
                        size={14}
                        color={iconReps.color}
                        style={styles.trendIcon}
                      />
                    )}
                  </View>

                  <View style={styles.inputWithTrend}>
                    <TextInput
                      style={[styles.serieInput, {
                        borderColor: theme.inputBorder,
                        backgroundColor: theme.inputBackground,
                        color: theme.inputText
                      }]}
                      placeholder={prevKg ? String(prevKg) : ''}
                      placeholderTextColor={theme.placeholder}
                      keyboardType="numeric"
                      value={curr.peso || ''}
                      onChangeText={(v) => setSerieDato(serieKey, 'peso', v, item, (item.series || []).length)}
                      onBlur={flushProgress}
                    />
                    {iconKg && (
                      <Ionicons
                        name={iconKg.name}
                        size={14}
                        color={iconKg.color}
                        style={styles.trendIcon}
                      />
                    )}
                  </View>

                  {prevExceeded && <Text style={[styles.sp, { color: theme.primary }]}>¡SP!</Text>}

                  <Text style={[styles.extraTxt, { color: theme.textSecondary }]}>
                    {EXTRA_ABBR[serie?.extra] || ''}
                  </Text>

                  <View style={styles.actionBtns}>
                    <TouchableOpacity
                      onPress={async () => {
                        const existingNote = notes[serieKey];
                        let pendingMediaUri = existingNote?.mediaUri || null;
                        let pendingMediaType = existingNote?.mediaType || null;

                        try {
                          const pendingPhotoJson = await AsyncStorage.getItem('pending_photo_feedback');
                          if (pendingPhotoJson) {
                            const pendingPhoto = JSON.parse(pendingPhotoJson);
                            if (pendingPhoto.serieKey === serieKey) {
                              pendingMediaUri = pendingPhoto.photoUri;
                              pendingMediaType = 'photo';
                            }
                            await AsyncStorage.removeItem('pending_photo_feedback');
                          }

                          const pendingVideoJson = await AsyncStorage.getItem('pending_video_feedback');
                          if (pendingVideoJson) {
                            const pendingVideo = JSON.parse(pendingVideoJson);
                            if (pendingVideo.serieKey === serieKey) {
                              pendingMediaUri = pendingVideo.videoPath;
                              pendingMediaType = 'video';
                            }
                            await AsyncStorage.removeItem('pending_video_feedback');
                          }
                        } catch (err) {
                          console.error('[ExerciseCard] Error reading pending media:', err);
                        }

                        setNotesModal({
                          visible: true,
                          serieKey,
                          exerciseId: item.id,
                          exerciseName: item.nombre,
                          value: existingNote?.value || 'low',
                          note: existingNote?.note || '',
                          audioUri: existingNote?.audioUri || null,
                          mediaUri: pendingMediaUri,
                          mediaType: pendingMediaType,
                        });
                      }}
                      style={styles.actionBtn}
                      activeOpacity={0.7}
                    >
                      {notes[serieKey] ? (
                        <View style={[
                          styles.noteDot,
                          { backgroundColor: NOTE_VALUES.find(n => n.key === notes[serieKey]?.value)?.color || '#6b7280' }
                        ]} />
                      ) : (
                        <Ionicons name="chatbubble-ellipses" size={15} color="#10b981" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {showBiserieConnector && (
        <View style={styles.biserieConnector}>
          <View style={styles.biserieLine} />
          <View style={styles.biseriePlusContainer}>
            <Text style={styles.biseriePlusText}>+</Text>
          </View>
          <View style={styles.biserieLine} />
        </View>
      )}
    </>
  );
}, (prevProps, nextProps) => {
  // Custom comparison logic
  if (prevProps.item.id !== nextProps.item.id) return false;
  if (prevProps.expanded !== nextProps.expanded) return false;
  if (prevProps.showBiserieConnector !== nextProps.showBiserieConnector) return false;

  // Theme check - simplified (could be deep check if theme obj changes structurally)
  if (prevProps.theme !== nextProps.theme) return false;

  const week = nextProps.semana;
  const dia = nextProps.diaIdx;
  const ejId = nextProps.item.id;
  const ejerKey = `${week}|${dia}|${ejId}`;

  // Check exercise state changes
  if (prevProps.prog[ejerKey] !== nextProps.prog[ejerKey]) return false;

  // Check series data changes
  if (nextProps.item.series) {
    for (let i = 0; i < nextProps.item.series.length; i++) {
      const serieKey = `${ejerKey}|${i}`;

      // Check series data in prog
      const prevSerie = prevProps.prog[serieKey];
      const nextSerie = nextProps.prog[serieKey];

      // Deep comparison for serie object {reps, peso}
      if (prevSerie !== nextSerie) {
        if (prevSerie?.reps !== nextSerie?.reps) return false;
        if (prevSerie?.peso !== nextSerie?.peso) return false;
      }

      // Check notes
      const prevNote = prevProps.notes[serieKey];
      const nextNote = nextProps.notes[serieKey];
      if (prevNote !== nextNote) {
          // If reference changed, deep check relevant fields
          if (prevNote?.value !== nextNote?.value) return false;
          if (prevNote?.note !== nextNote?.note) return false;
          if (prevNote?.mediaUri !== nextNote?.mediaUri) return false;
      }
    }
  }

  // Also check if exerciseDetails changed (e.g. async load of details)
  if (prevProps.exerciseDetails !== nextProps.exerciseDetails) {
      const p = prevProps.exerciseDetails || {};
      const n = nextProps.exerciseDetails || {};
      if (p.hasImage !== n.hasImage) return false;
      if (p.hasVideo !== n.hasVideo) return false;
  }

  return true;
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    marginBottom: 12,
    elevation: 2,
    borderWidth: 0.6,
    paddingBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderBottomWidth: 0.6,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  cardTxt: { flex: 1, fontSize: 14, fontWeight: '600' },
  stateToolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    marginTop: 8,
    gap: 8,
  },
  stateRow: { flexDirection: 'row', gap: 4, flexShrink: 1, flexWrap: 'nowrap' },
  toolsRow: {
    marginLeft: 'auto',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexShrink: 0,
  },
  radio: { borderWidth: 1, borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8, minWidth: 28 },
  radioTxt: { fontSize: 11, fontWeight: 'bold' },
  toolBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  toolBtnIcon: { paddingHorizontal: 9 },
  toolBtnTxt: { fontWeight: '700', fontSize: 12, letterSpacing: 0.5 },
  seriesBox: { marginTop: 8 },
  serieRowHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingHorizontal: 10 },
  serieLabel: { width: 70, fontSize: 12, flexShrink: 0 },
  inputCol: { width: 55, alignItems: 'center', marginRight: 20 },
  colLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  serieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.6,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  inputWithTrend: {
    position: 'relative',
    width: 75,
    paddingRight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginRight: 0,
    flexShrink: 0,
  },
  trendIcon: {
    position: 'absolute',
    right: 2,
    top: '50%',
    transform: [{ translateY: -7 }],
  },
  serieInput: {
    width: 50,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 4,
    fontSize: 12,
    textAlign: 'center',
  },
  extraTxt: { fontSize: 11, fontWeight: '600', marginRight: 4 },
  sp: { marginLeft: 4, fontSize: 11, fontWeight: '700', flexShrink: 0 },
  actionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    gap: 2,
    backgroundColor: 'rgba(67, 97, 238, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  actionBtn: {
    padding: 5,
    borderRadius: 6,
  },
  noteDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  biserieBadge: {
    position: 'absolute',
    top: -6,
    right: 14,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    zIndex: 10,
  },
  biserieBadgeText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  biserieConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 0,
    marginHorizontal: 20,
    zIndex: 10,
    top: -6,
  },
  biserieLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#F59E0B',
  },
  biseriePlusContainer: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 5,
  },
  biseriePlusText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 20,
    marginTop: -1,
  },
});

export default ExerciseCard;
