/**
 * components/ui/EnhancedTextInput.tsx
 * ═══════════════════════════════════════════════════════════════════════════
 * TextInput mejorado SOLO para iOS con:
 * - Área táctil más grande mediante un wrapper Pressable (SOLO iOS)
 * - clearButtonMode para limpiar texto fácilmente en iOS
 * - Mejor manejo del teclado
 * - returnKeyType consistente
 * - InputAccessoryView con botón "Done" para campos multiline en iOS
 *
 * IMPORTANTE: En web y Android devuelve el TextInput SIN modificaciones
 * para evitar problemas de layout (bordes blancos, width incorrecto, etc.)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { forwardRef, useRef, useImperativeHandle, useId, useMemo } from 'react';
import {
  TextInput,
  TextInputProps,
  Platform,
  Pressable,
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
  InputAccessoryView,
  Keyboard,
} from 'react-native';

interface EnhancedTextInputProps extends TextInputProps {
  /** Estilo del contenedor wrapper (para añadir padding táctil) */
  containerStyle?: StyleProp<ViewStyle>;
  /** Estilo del contenedor interno del input */
  inputContainerStyle?: StyleProp<ViewStyle>;
  /** Padding táctil alrededor del input (default: 8) */
  touchPadding?: number;
  /** Desactiva el wrapper táctil */
  disableTouchWrapper?: boolean;
  /** Mostrar barra con botón "Done" encima del teclado para multiline (default: true en iOS) */
  showDoneAccessory?: boolean;
  /** Texto del botón de cerrar teclado (default: "Listo") */
  doneButtonText?: string;
  /** Color del botón Done (default: #007AFF - azul iOS) */
  doneButtonColor?: string;
}

/**
 * EnhancedTextInput - TextInput con mejoras para iOS
 *
 * Uso:
 * ```tsx
 * <EnhancedTextInput
 *   placeholder="Escribe aquí..."
 *   value={text}
 *   onChangeText={setText}
 * />
 * ```
 *
 * Es un reemplazo directo de TextInput con mejor experiencia en iOS.
 */
const EnhancedTextInput = forwardRef<TextInput, EnhancedTextInputProps>(
  (
    {
      containerStyle,
      inputContainerStyle,
      touchPadding = 8,
      disableTouchWrapper = false,
      showDoneAccessory,
      doneButtonText = 'Listo',
      doneButtonColor = '#007AFF',
      clearButtonMode,
      returnKeyType,
      enablesReturnKeyAutomatically,
      autoCorrect,
      spellCheck,
      multiline,
      style,
      inputAccessoryViewID,
      ...props
    },
    ref
  ) => {
    const inputRef = useRef<TextInput>(null);
    // Generar ID único para el InputAccessoryView
    const generatedId = useId();
    const accessoryViewId = inputAccessoryViewID ?? `enhanced-input-${generatedId}`;

    // Exponer el ref del TextInput
    useImperativeHandle(ref, () => inputRef.current as TextInput);

    // clearButtonMode: no activar por defecto (ocupa espacio en inputs pequeños)
    const defaultClearButtonMode = clearButtonMode ?? undefined;

    // returnKeyType consistente (solo para inputs de una línea)
    const defaultReturnKeyType = returnKeyType ?? (multiline ? 'default' : 'done');

    // Habilitar/deshabilitar return key automáticamente
    const defaultEnablesReturnKey =
      enablesReturnKeyAutomatically ?? Platform.OS === 'ios';

    // Autocorrección: desactivada por defecto para inputs de datos
    const defaultAutoCorrect = autoCorrect ?? false;
    const defaultSpellCheck = spellCheck ?? false;

    // Mostrar InputAccessoryView con botón Done para multiline en iOS
    const shouldShowDoneAccessory =
      showDoneAccessory ?? (Platform.OS === 'ios' && multiline);

    // Separar propiedades de layout (para el wrapper) de las visuales (para el TextInput)
    // Esto es necesario porque en flexDirection: 'row', el wrapper necesita flex: 1
    // para expandirse, no solo el TextInput interno.
    const { wrapperStyle, inputStyle } = useMemo(() => {
      const flat = StyleSheet.flatten(style) || {};
      const layoutKeys = new Set([
        'flex', 'flexGrow', 'flexShrink', 'flexBasis',
        'width', 'minWidth', 'maxWidth',
        'height', 'minHeight', 'maxHeight',
        'alignSelf',
        'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
        'marginHorizontal', 'marginVertical',
      ]);
      const layout: Record<string, any> = {};
      const visual: Record<string, any> = {};
      for (const [key, value] of Object.entries(flat)) {
        if (layoutKeys.has(key)) {
          layout[key] = value;
        } else {
          visual[key] = value;
        }
      }
      return { wrapperStyle: layout as ViewStyle, inputStyle: visual as TextStyle };
    }, [style]);

    const handleContainerPress = () => {
      inputRef.current?.focus();
    };

    const handleDonePress = () => {
      Keyboard.dismiss();
      inputRef.current?.blur();
    };

    const textInput = (
      <TextInput
        ref={inputRef}
        clearButtonMode={defaultClearButtonMode}
        returnKeyType={defaultReturnKeyType}
        enablesReturnKeyAutomatically={defaultEnablesReturnKey}
        autoCorrect={defaultAutoCorrect}
        spellCheck={defaultSpellCheck}
        multiline={multiline}
        inputAccessoryViewID={shouldShowDoneAccessory ? accessoryViewId : undefined}
        style={Platform.OS === 'ios' && !disableTouchWrapper ? [{ width: '100%' }, inputStyle] : style}
        {...props}
      />
    );

    // Renderizar el InputAccessoryView para iOS
    const renderAccessoryView = () => {
      if (!shouldShowDoneAccessory || Platform.OS !== 'ios') {
        return null;
      }

      return (
        <InputAccessoryView nativeID={accessoryViewId}>
          <View style={styles.accessoryContainer}>
            <View style={styles.accessorySpacer} />
            <Pressable
              onPress={handleDonePress}
              style={styles.doneButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.doneButtonText, { color: doneButtonColor }]}>
                {doneButtonText}
              </Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      );
    };

    // ════════════════════════════════════════════════════════════════════════
    // IMPORTANTE: Solo aplicar wrapper táctil en iOS
    // En web y Android devolver el TextInput sin modificaciones
    // para evitar problemas de layout (bordes, width, outline, etc.)
    // ════════════════════════════════════════════════════════════════════════

    // En web o Android: devolver TextInput directo sin wrapper
    if (Platform.OS !== 'ios') {
      return textInput;
    }

    // Si el wrapper está desactivado, devolver solo el TextInput
    if (disableTouchWrapper) {
      return (
        <>
          {textInput}
          {renderAccessoryView()}
        </>
      );
    }

    // iOS ONLY: Wrapper con área táctil extendida
    return (
      <>
        <Pressable
          onPress={handleContainerPress}
          style={[
            styles.touchWrapper,
            wrapperStyle,
            containerStyle,
          ]}
          hitSlop={{ top: touchPadding + 10, bottom: touchPadding + 10, left: touchPadding + 10, right: touchPadding + 10 }}
        >
          <View style={[styles.inputContainer, { flex: 1 }, inputContainerStyle]} pointerEvents="box-none">
            {textInput}
          </View>
        </Pressable>
        {renderAccessoryView()}
      </>
    );
  }
);

const styles = StyleSheet.create({
  touchWrapper: {
    // Sin defaults - el sizing viene del style/containerStyle del usuario
  },
  inputContainer: {
    // Contenedor para el input
  },
  accessoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: '#F2F2F7',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#C6C6C8',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  accessorySpacer: {
    flex: 1,
  },
  doneButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  doneButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
});

EnhancedTextInput.displayName = 'EnhancedTextInput';

export default EnhancedTextInput;
