/* app/entreno/index.jsx -------------------------------------------------- */
import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Dimensions,
  TouchableOpacity, FlatList, ScrollView, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* ───────── constants ───────── */
const { width } = Dimensions.get('window');
const ESTADOS      = ['C', 'NC', 'OJ'];   // radio-botones
const SEMANAS_MAX  = 12;                  // nº máximo de semanas visibles

/* ───────── reusable carousel ───────── */
function Carousel({ data, renderItem, onIndexChange }) {
  const listRef  = useRef(null);
  const idxRef   = useRef(0);

  const move = dir => {
    let next = idxRef.current + dir;
    next = Math.max(0, Math.min(next, data.length - 1));
    idxRef.current = next;
    listRef.current?.scrollToIndex({ index: next, animated: true });
    onIndexChange?.(next);
  };

  return (
    <View style={styles.carouselWrap}>
      {/* flecha ← */}
      <TouchableOpacity style={styles.arrowLeft} onPress={()=>move(-1)}>
        <Text style={styles.arrowTxt}>‹</Text>
      </TouchableOpacity>

      {/* lista horizontal paginada */}
      <FlatList
        ref={listRef}
        data={data}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item,i)=>String(i)}
        renderItem={renderItem}
        getItemLayout={(_,i)=>({ length: width, offset: width*i, index:i })}
        onMomentumScrollEnd={ev=>{
          const i = Math.round(ev.nativeEvent.contentOffset.x / width);
          idxRef.current = i;
          onIndexChange?.(i);
        }}
      />

      {/* flecha → */}
      <TouchableOpacity style={styles.arrowRight} onPress={()=>move(1)}>
        <Text style={styles.arrowTxt}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ───────── carouseles específicos ───────── */
function WeeksCarousel({ selected, onChange }) {
  const data = Array.from({ length: SEMANAS_MAX }, (_,i)=>i+1);
  return (
    <Carousel
      data={data}
      onIndexChange={i=>onChange(i+1)}
      renderItem={({ item })=>(
        <View style={styles.slide}>
          <Text style={[
            styles.bigLabel,
            selected===item && styles.bigLabelSel
          ]}>Semana {item}</Text>
        </View>
      )}
    />
  );
}

function DaysCarousel({ total, selected, onChange }) {
  const data = Array.from({ length: total }, (_,i)=>i+1);
  return (
    <Carousel
      data={data}
      onIndexChange={onChange}
      renderItem={({ item })=>(
        <View style={styles.slide}>
          <Text style={[
            styles.bigLabel,
            selected===item-1 && styles.bigLabelSel
          ]}>Día {item}</Text>
        </View>
      )}
    />
  );
}

/* ───────── main component ───────── */
export default function Entreno() {
  const [rutina, setRutina]     = useState(null); // {id,nombre,dias}
  const [diasEj, setDiasEj]     = useState([]);  // [[ejercicios]]
  const [semana, setSemana]     = useState(1);
  const [diaIdx, setDiaIdx]     = useState(0);
  const [prog, setProg]         = useState({});  // progreso local

  /* cargar rutina activa */
  useEffect(()=>{
    (async()=>{
      const [[, idAct], [, listJSON]] = await AsyncStorage.multiGet(
        ['active_routine','rutinas']
      );
      if (!idAct) {
        Alert.alert('Sin rutina activa','Selecciona una rutina en Rutinas');
        return;
      }
      const lista = JSON.parse(listJSON||'[]');
      const act   = lista.find(r=>r.id===idAct);
      const stored= await AsyncStorage.getItem(`routine_${idAct}`);
      setRutina(act);
      setDiasEj(JSON.parse(stored||'[]'));
    })();
  },[]);

  /* helper para marcar estado */
  const setEstado = (clave, val) =>
    setProg(prev => ({ ...prev, [clave]: val }));

  if (!rutina) return <View style={styles.container} />;   // loading…

  const ejerciciosDia = diasEj[diaIdx] || [];

  return (
    <View style={styles.container}>
      {/* título */}
      <Text style={styles.title}>{rutina.nombre}</Text>

      {/* carrusel semanas */}
      <WeeksCarousel selected={semana} onChange={setSemana} />

      {/* carrusel días */}
      <DaysCarousel total={rutina.dias} selected={diaIdx} onChange={setDiaIdx} />

      {/* lista ejercicios */}
      <FlatList
        style={{ marginTop: 12 }}
        data={ejerciciosDia}
        keyExtractor={it=>it.id}
        renderItem={({item})=>{
          const key = `${semana}|${diaIdx}|${item.id}`;
          return (
            <View style={styles.card}>
              {/* nombre ejercicio */}
              <Text style={styles.cardTxt}>
                {item.musculo} — {item.nombre}
              </Text>

              {/* radios */}
              <View style={styles.radioRow}>
                {ESTADOS.map(e=>(
                  <TouchableOpacity
                    key={e}
                    style={[
                      styles.radio,
                      prog[key]===e && styles.radioSel
                    ]}
                    onPress={()=>setEstado(key,e)}
                  >
                    <Text style={[
                      styles.radioTxt,
                      prog[key]===e && styles.radioTxtSel
                    ]}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={{textAlign:'center'}}>Sin ejercicios</Text>}
      />
    </View>
  );
}

/* ───────── styles ───────── */
const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:'#fafafa', padding:16 },
  title:{ fontSize:18, fontWeight:'bold', marginBottom:8 },

  /* carousel */
  carouselWrap:{ width, height:80, justifyContent:'center' },
  slide:{ width, alignItems:'center', justifyContent:'center' },
  bigLabel:{ fontSize:20, color:'#374151' },
  bigLabelSel:{ color:'#3b82f6', fontWeight:'bold' },
  arrowLeft:{ position:'absolute', left:10, top:'40%', zIndex:10 },
  arrowRight:{ position:'absolute', right:10, top:'40%', zIndex:10 },
  arrowTxt:{ fontSize:32, color:'#374151' },

  /* ejercicio card */
  card:{ flexDirection:'row', alignItems:'center', backgroundColor:'#fff',
         padding:10, borderRadius:8, marginBottom:8, elevation:2 },
  cardTxt:{ flex:1, fontSize:13, fontWeight:'600' },

  /* radios */
  radioRow:{ flexDirection:'row', gap:6 },
  radio:{ borderWidth:1, borderColor:'#9ca3af', borderRadius:6,
          paddingVertical:4, paddingHorizontal:10 },
  radioSel:{ backgroundColor:'#10b981', borderColor:'#10b981' },
  radioTxt:{ fontSize:11, fontWeight:'bold' },
  radioTxtSel:{ color:'#fff' },
});
