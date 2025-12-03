import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Text, StyleSheet, AppState, Pressable, Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

function formatTime(msTotal) {
  const totalSeconds = Math.floor(msTotal / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function Stopwatch({ style }) {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef(null);
  const intervalRef = useRef(null);
  const appState = useRef(AppState.currentState);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (startRef.current == null) {
      startRef.current = Date.now() - elapsedMs;
    }
    setIsRunning(true);
  }, [elapsedMs]);

  const restart = useCallback(() => {
    // reinicia a 0 y sigue corriendo
    startRef.current = Date.now();
    setElapsedMs(0);
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    if (startRef.current != null) {
      const now = Date.now();
      setElapsedMs(now - startRef.current);
      startRef.current = null;
    }
    setIsRunning(false);
  }, []);

  // --- INICIO DEL CAMBIO ---
  // MODIFICADO: Ahora para y pone a cero (Reset)
  const zeroSoft = useCallback(() => {
    // 1. Paramos el loop de 'setInterval'
    clearTimer();
    // 2. Ponemos el estado a 'pausado'
    setIsRunning(false);
    // 3. Ponemos el tiempo a 0
    setElapsedMs(0);
    // 4. Limpiamos el timestamp de inicio
    startRef.current = null;
  }, [clearTimer]); // <-- Dependencia añadida
  // --- FIN DEL CAMBIO ---

  // Tap principal: si corre → reinicia; si está parado → arranca
  const onPressMain = useCallback(() => {
    if (isRunning) restart();
    else start();
  }, [isRunning, restart, start]);

  const onLongPressMain = pause; // pausa con long press

  // Loop de actualización
  useEffect(() => {
    clearTimer();
    if (isRunning && startRef.current != null) {
      intervalRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startRef.current);
      }, 250); // Intervalo más rápido para mejor fluidez
    }
    return clearTimer;
  }, [isRunning, clearTimer]);

  // ⏱️ MODIFICADO: Ya NO pausa al ir a background
  // El cronómetro sigue contando incluso cuando cambias de app o pantalla
  // porque el cálculo se basa en timestamps (Date.now() - startRef.current)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      // Solo actualizamos el estado de la app, sin pausar
      appState.current = next;
    });
    return () => sub.remove?.();
  }, []);

  return (
    <View style={[styles.wrap, style, Platform.select({ android: { zIndex: 10, elevation: 10 } })]}>
      {/* Botón principal (play/restart) */}
      <Pressable
        onPress={onPressMain}
        onLongPress={onLongPressMain}
        hitSlop={10}
        android_disableSound
        style={styles.timerContainer}
      >
        <Ionicons
          name={isRunning ? 'refresh-circle-outline' : 'play-circle-outline'}
          size={20}
          color="#1f2937"
          style={styles.timerIcon}
        />
        <Text style={styles.timerText}>{formatTime(elapsedMs)}</Text>
      </Pressable>

      {/* Separador vertical */}
      <View style={styles.vDivider} />

      {/* Botón "cero" (ahora es "Reset") */}
      <Pressable
        onPress={(e) => {
          e.stopPropagation?.();
          zeroSoft(); // <-- Llama a la nueva función
        }}
        onLongPress={(e) => {
          e.stopPropagation?.();
        }} // por si haces long press cerca del borde
        hitSlop={8} // más pequeño para no solaparse
        android_disableSound
        accessibilityLabel="Poner a cero y parar"
        style={styles.zeroBtn}
      >
        <Ionicons name="trash-outline" size={18} color="#1f2937" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
    minWidth: 95,
  },
  timerIcon: { marginRight: 6 },
  timerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    fontVariant: ['tabular-nums'],
    textAlignVertical: 'center',
  },
  vDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  zeroBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});