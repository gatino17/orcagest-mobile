import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

import {
  closeInventarioBodegaToma,
  createInventarioBodegaEquipos,
  createInventarioBodegaEscaneo,
  createInventarioBodegaToma,
  deleteInventarioBodegaEscaneo,
  fetchInventarioBodegaEquipos,
  fetchInventarioBodegaToma,
  fetchInventarioBodegaTomas,
  fetchInventarioBodegaTipos,
} from '@/lib/api';

type ResumenToma = {
  total_esperado?: number;
  total_escaneos?: number;
  encontrados?: number;
  faltantes?: number;
  no_esperados?: number;
  duplicados?: number;
  no_corresponden?: number;
  cumplimiento?: number;
  faltantes_detalle?: any[];
};

type EquipoTipo = {
  categoria?: string;
  equipo_nombre: string;
  total_esperado: number;
};

const CATALOGO_INVENTARIO_FALLBACK: EquipoTipo[] = [
  ...['PC', 'Monitor', 'Mouse', 'Teclado', 'Router', 'Switch', 'Switch (Cisco)', 'Switch raqueable', 'Camara Interior', 'Parlantes', 'Sensor Magnetico', 'Rack 9U - tuercas - tornillos', 'Zapatilla Rack (PDU)'].map((equipo_nombre) => ({ categoria: 'Oficina', equipo_nombre, total_esperado: 0 })),
  ...['PC cliente', 'Rack 2', 'Ubiquiti TX', 'Ubiquiti RX', 'Pantalla'].map((equipo_nombre) => ({ categoria: 'Base tierra', equipo_nombre, total_esperado: 0 })),
  ...['Tablero 500x400x200', 'Baliza Interior', 'Bocina Interior', 'Baliza Exterior', 'Bocina Exterior', 'Foco led 150W', 'Foco led 50W', 'Fuente poder 12V', 'Axis P8221'].map((equipo_nombre) => ({ categoria: 'Tablero Alarma', equipo_nombre, total_esperado: 0 })),
  ...['Tablero 1200x800x300', 'Tablero 1000x600x300', 'Inversor cargador Victron', 'Panel Victron', 'Bateria 1', 'Bateria 2', 'Bateria 3', 'Bateria 4', 'Bateria 5', 'Bateria 6', 'Switch POE', 'Sensor magnetico respaldo', 'Sensor magnetico cargador', 'Cargador 1', 'Cargador 2', 'Tablero Cargador 750x500x250', 'UPS online'].map((equipo_nombre) => ({ categoria: 'Tablero Respaldo', equipo_nombre, total_esperado: 0 })),
  ...['Tablero Derivacion (400x300x200)', 'Radar 1', 'Radar 2', 'Cable rj radar 1', 'Cable rj radar 2', 'Soporte radar 1', 'Soporte radar 2', 'Camara PTZ termal', 'Camara PTZ Laser', 'Camara PTZ Laser 2', 'Camara Modulo', 'Camara Silo 1', 'Camara Silo 2', 'Camara Ensinerador', 'Ensilaje interior', 'Ensilaje exterior', 'Camara Popa', 'Camara acceso 1', 'Camara acceso 2', 'Camara acceso 3', 'Camara acceso 4', 'Enlace Ubiquiti'].map((equipo_nombre) => ({ categoria: 'Mastil', equipo_nombre, total_esperado: 0 })),
  ...['Tablero Camara (500x700x250)', 'Poe Power 1', 'Poe Power 2', 'Poe Power 3', 'Poe Power 4', 'Poe Power 5', 'Switch POE 1', 'Switch POE 2', 'Mass', 'Tablero 750x500x250', 'Switch 1', 'Switch 2', 'Switch 3', 'Switch 4', 'Netio'].map((equipo_nombre) => ({ categoria: 'Tablero Camara', equipo_nombre, total_esperado: 0 })),
];

type TomaInventario = {
  id_toma: number;
  nombre?: string;
  ubicacion?: string;
  estado?: string;
  responsable_nombre?: string;
  fecha_inicio?: string;
  fecha_cierre?: string | null;
  observacion?: string;
  resumen?: ResumenToma;
  escaneos?: any[];
};

const estadoTexto = (value?: string) => (String(value || '').toLowerCase() === 'cerrado' ? 'Cerrada' : 'Abierta');

const resultadoTexto = (value?: string) => {
  const raw = String(value || '').toLowerCase();
  if (raw === 'encontrado') return 'Encontrado';
  if (raw === 'manual') return 'Manual';
  if (raw === 'duplicado') return 'Duplicado';
  if (raw === 'no_esperado') return 'No esperado';
  if (raw === 'no_corresponde') return 'No corresponde';
  return 'Registrado';
};

const formatFecha = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatHora = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
};

export default function InventarioBodegaScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [tomas, setTomas] = useState<TomaInventario[]>([]);
  const [tiposEquipo, setTiposEquipo] = useState<EquipoTipo[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('Oficina');
  const [tipoSeleccionado, setTipoSeleccionado] = useState('');
  const [tomaActiva, setTomaActiva] = useState<TomaInventario | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [crearInformeModalVisible, setCrearInformeModalVisible] = useState(false);
  const [verInformeModalVisible, setVerInformeModalVisible] = useState(false);
  const [informeDetalle, setInformeDetalle] = useState<TomaInventario | null>(null);
  const [informeDetalleLoading, setInformeDetalleLoading] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<'informe' | 'bodega'>('informe');
  const [valorManual, setValorManual] = useState('');
  const [nombreToma, setNombreToma] = useState('');
  const [ubicacion, setUbicacion] = useState('Bodega central');
  const [observacion, setObservacion] = useState('');
  const [modo, setModo] = useState<'informe' | 'bodega'>('informe');
  const [busquedaEquipo, setBusquedaEquipo] = useState('');
  const [bodegaCodigo, setBodegaCodigo] = useState('');
  const [bodegaSerie, setBodegaSerie] = useState('');
  const [bodegaObs, setBodegaObs] = useState('');
  const [bodegaSaving, setBodegaSaving] = useState(false);
  const scanLockRef = useRef(false);
  const tomaActivaIdRef = useRef<number>(0);

  const resumen = tomaActiva?.resumen || {};
  const escaneos = Array.isArray(tomaActiva?.escaneos) ? tomaActiva.escaneos : [];
  const faltantes = Array.isArray(resumen.faltantes_detalle) ? resumen.faltantes_detalle : [];
  const resumenInformeDetalle = informeDetalle?.resumen || {};
  const escaneosInformeDetalle = Array.isArray(informeDetalle?.escaneos) ? informeDetalle.escaneos : [];
  const faltantesInformeDetalle = Array.isArray(resumenInformeDetalle.faltantes_detalle) ? resumenInformeDetalle.faltantes_detalle : [];
  const tomaAbierta = String(tomaActiva?.estado || '').toLowerCase() !== 'cerrado';
  const abiertas = useMemo(() => tomas.filter((item) => String(item.estado || '').toLowerCase() !== 'cerrado').length, [tomas]);
  const cerradas = Math.max(tomas.length - abiertas, 0);
  const totalTipoSeleccionado = useMemo(() => {
    const item = tiposEquipo.find((tipo) => String(tipo.equipo_nombre || '').trim().toLowerCase() === tipoSeleccionado.trim().toLowerCase());
    return Number(item?.total_esperado || 0);
  }, [tipoSeleccionado, tiposEquipo]);
  const categoriasInventario = useMemo(() => {
    const out: string[] = [];
    tiposEquipo.forEach((tipo) => {
      const categoria = String(tipo.categoria || 'Sin categoria').trim() || 'Sin categoria';
      if (!out.includes(categoria)) out.push(categoria);
    });
    return out;
  }, [tiposEquipo]);
  const tiposCategoria = useMemo(
    () => tiposEquipo.filter((tipo) => String(tipo.categoria || 'Sin categoria').trim() === categoriaSeleccionada),
    [categoriaSeleccionada, tiposEquipo]
  );
  const normalizarBusqueda = useCallback(
    (valor: string) => String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase(),
    []
  );
  const tiposVisibles = useMemo(() => {
    const term = normalizarBusqueda(busquedaEquipo);
    if (!term) return tiposCategoria;
    return tiposEquipo.filter((tipo) => {
      const nombre = normalizarBusqueda(tipo.equipo_nombre);
      const categoria = normalizarBusqueda(tipo.categoria);
      return nombre.includes(term) || categoria.includes(term);
    });
  }, [busquedaEquipo, normalizarBusqueda, tiposCategoria, tiposEquipo]);
  const separarCodigoSerieEscaneado = useCallback((valor: string) => {
    const serie = String(valor || '').trim();
    const numeros = serie.replace(/\D/g, '');
    const codigo = (numeros.slice(0, 5) || serie.slice(0, 5)).trim();
    return { codigo, serie };
  }, []);
  const mostrarEquipoExistente = useCallback((existente: any, serieFallback = '') => {
    const ubicacionExistente = existente?.ubicacion || 'Bodega';
    const equipoExistente = existente?.equipo_nombre || 'Equipo';
    const serieExistente = existente?.numero_serie || serieFallback || '-';
    const estadoExistente = existente?.estado_equipo || '-';
    Alert.alert(
      'Equipo ya registrado',
      `Ya existe en ${ubicacionExistente}.\n\nEquipo: ${equipoExistente}\nN serie: ${serieExistente}\nEstado: ${estadoExistente}`
    );
  }, []);

  const detalleParams = useCallback(
    () => (tipoSeleccionado ? { tipo_equipo: tipoSeleccionado } : undefined),
    [tipoSeleccionado]
  );

  const seleccionarToma = useCallback(async (idToma: number) => {
    if (!idToma) return;
    setLoading(true);
    try {
      const detalle = await fetchInventarioBodegaToma(idToma, detalleParams());
      tomaActivaIdRef.current = Number(detalle?.id_toma || idToma || 0);
      setTomaActiva(detalle);
    } catch (error: any) {
      Alert.alert('Inventario bodega', error?.response?.data?.error || 'No se pudo cargar el detalle.');
    } finally {
      setLoading(false);
    }
  }, [detalleParams]);

  const verInformeHistorial = useCallback(async (idToma: number) => {
    if (!idToma) return;
    setVerInformeModalVisible(true);
    setInformeDetalleLoading(true);
    setInformeDetalle(null);
    try {
      const detalle = await fetchInventarioBodegaToma(idToma);
      setInformeDetalle(detalle || null);
    } catch (error: any) {
      Alert.alert('Inventario bodega', error?.response?.data?.error || 'No se pudo cargar el informe.');
      setVerInformeModalVisible(false);
    } finally {
      setInformeDetalleLoading(false);
    }
  }, []);

  const cargarTomas = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const lista = await fetchInventarioBodegaTomas();
      let tiposRows: EquipoTipo[] = [];
      try {
        const tipos = await fetchInventarioBodegaTipos();
        tiposRows = Array.isArray(tipos) ? tipos : [];
      } catch {
        tiposRows = CATALOGO_INVENTARIO_FALLBACK;
      }
      const rows = Array.isArray(lista) ? lista : [];
      setTomas(rows);
      setTiposEquipo(tiposRows.length ? tiposRows : CATALOGO_INVENTARIO_FALLBACK);

      const actualId = Number(tomaActivaIdRef.current || 0);
      const candidata =
        rows.find((item: TomaInventario) => Number(item.id_toma) === actualId) ||
        rows.find((item: TomaInventario) => String(item.estado || '').toLowerCase() !== 'cerrado') ||
        rows[0];

      if (candidata?.id_toma) {
        const detalle = await fetchInventarioBodegaToma(candidata.id_toma, detalleParams());
        tomaActivaIdRef.current = Number(detalle?.id_toma || candidata.id_toma || 0);
        setTomaActiva(detalle);
      } else {
        tomaActivaIdRef.current = 0;
        setTomaActiva(null);
      }
    } catch (error: any) {
      Alert.alert('Inventario bodega', error?.response?.data?.error || 'No se pudo cargar el inventario.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [detalleParams]);

  useEffect(() => {
    cargarTomas();
  }, [cargarTomas]);

  useEffect(() => {
    if (!categoriasInventario.length) return;
    if (!categoriasInventario.includes(categoriaSeleccionada)) {
      setCategoriaSeleccionada(categoriasInventario[0]);
      setTipoSeleccionado('');
    }
  }, [categoriaSeleccionada, categoriasInventario]);

  useEffect(() => {
    if (!tipoSeleccionado) return;
    const existeEnCategoria = tiposCategoria.some(
      (tipo) => String(tipo.equipo_nombre || '').trim().toLowerCase() === tipoSeleccionado.trim().toLowerCase()
    );
    if (!existeEnCategoria) setTipoSeleccionado('');
  }, [tipoSeleccionado, tiposCategoria]);

  const refrescar = useCallback(() => {
    setRefreshing(true);
    cargarTomas(true);
  }, [cargarTomas]);

  const crearToma = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        nombre: nombreToma.trim() || undefined,
        ubicacion: ubicacion.trim() || 'Bodega central',
        observacion: observacion.trim() || undefined,
      };
      const data = await createInventarioBodegaToma(payload);
      const nueva = data?.toma || data;
      tomaActivaIdRef.current = Number(nueva?.id_toma || 0);
      setTomaActiva(nueva);
      setCrearInformeModalVisible(false);
      setNombreToma('');
      setObservacion('');
      const lista = await fetchInventarioBodegaTomas();
      setTomas(Array.isArray(lista) ? lista : []);
      try {
        const tipos = await fetchInventarioBodegaTipos();
        const tiposRows = Array.isArray(tipos) ? tipos : [];
        setTiposEquipo(tiposRows.length ? tiposRows : CATALOGO_INVENTARIO_FALLBACK);
      } catch {
        setTiposEquipo(CATALOGO_INVENTARIO_FALLBACK);
      }
    } catch (error: any) {
      Alert.alert('Inventario bodega', error?.response?.data?.error || 'No se pudo crear el informe.');
    } finally {
      setSaving(false);
    }
  }, [nombreToma, observacion, saving, ubicacion]);

  const registrarValor = useCallback(async (valor: string) => {
    const limpio = String(valor || '').trim();
    if (!limpio || !tomaActiva?.id_toma || saving || !tomaAbierta) return;
    if (!tipoSeleccionado) {
      Alert.alert('Inventario bodega', 'Selecciona primero el tipo de equipo que vas a escanear.');
      return;
    }
    setSaving(true);
    try {
      const data = await createInventarioBodegaEscaneo(tomaActiva.id_toma, {
        valor: limpio,
        tipo_equipo: tipoSeleccionado,
        categoria: categoriaSeleccionada,
      });
      const toma = data?.toma || null;
      if (toma) {
        tomaActivaIdRef.current = Number(toma?.id_toma || tomaActiva?.id_toma || 0);
        setTomaActiva(toma);
      }
      setValorManual('');
    } catch (error: any) {
      Alert.alert('Inventario bodega', error?.response?.data?.error || 'No se pudo registrar el escaneo.');
    } finally {
      setSaving(false);
      scanLockRef.current = false;
    }
  }, [categoriaSeleccionada, saving, tipoSeleccionado, tomaAbierta, tomaActiva?.id_toma]);

  const abrirScanner = useCallback(async (target: 'informe' | 'bodega' = 'informe') => {
    if (target === 'informe' && !tomaAbierta) return;
    if (!tipoSeleccionado) {
      Alert.alert('Inventario bodega', 'Selecciona primero el tipo de equipo que vas a escanear.');
      return;
    }
    if (permission?.status !== 'granted') {
      const result = await requestPermission();
      if (result.status !== 'granted') {
        Alert.alert('Inventario bodega', 'Necesitas permiso de camara para escanear.');
        return;
      }
    }
    scanLockRef.current = false;
    setScannerTarget(target);
    setScannerVisible(true);
  }, [permission?.status, requestPermission, tipoSeleccionado, tomaAbierta]);

	  const handleBarcodeScanned = useCallback(async (event: any) => {
	    if (scanLockRef.current) return;
	    scanLockRef.current = true;
	    setScannerVisible(false);
	    if (scannerTarget === 'bodega') {
	      const { codigo, serie } = separarCodigoSerieEscaneado(event?.data || '');
	      setBodegaCodigo(codigo);
	      setBodegaSerie(serie);
	      try {
	        const rows = await fetchInventarioBodegaEquipos({ q: serie || codigo });
	        const existente = Array.isArray(rows)
	          ? rows.find((item) => normalizarBusqueda(item?.numero_serie) === normalizarBusqueda(serie || codigo))
	          : null;
	        if (existente) mostrarEquipoExistente(existente, serie || codigo);
	      } catch {
	        // Si la consulta preventiva falla, el guardado mantiene la validacion final del backend.
	      }
	      scanLockRef.current = false;
	      return;
	    }
	    registrarValor(event?.data || '');
	  }, [mostrarEquipoExistente, normalizarBusqueda, registrarValor, scannerTarget, separarCodigoSerieEscaneado]);

  const cerrarToma = useCallback(() => {
    if (!tomaActiva?.id_toma || !tomaAbierta) return;
    Alert.alert(
      'Cerrar inventario',
      'El informe quedara como historial y no permitira nuevos escaneos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar informe',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await closeInventarioBodegaToma(tomaActiva.id_toma);
              const detalle = await fetchInventarioBodegaToma(tomaActiva.id_toma, detalleParams());
              tomaActivaIdRef.current = Number(detalle?.id_toma || tomaActiva.id_toma || 0);
              setTomaActiva(detalle);
              const lista = await fetchInventarioBodegaTomas();
              setTomas(Array.isArray(lista) ? lista : []);
            } catch (error: any) {
              Alert.alert('Inventario bodega', error?.response?.data?.error || 'No se pudo finalizar el informe.');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  }, [detalleParams, tomaAbierta, tomaActiva?.id_toma]);

  const eliminarEscaneo = useCallback((idEscaneo: number) => {
    if (!idEscaneo || !tomaActiva?.id_toma || !tomaAbierta) return;
    Alert.alert('Eliminar escaneo', 'Se quitara este registro del informe actual.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteInventarioBodegaEscaneo(idEscaneo);
            const detalle = await fetchInventarioBodegaToma(tomaActiva.id_toma, detalleParams());
            setTomaActiva(detalle);
          } catch (error: any) {
            Alert.alert('Inventario bodega', error?.response?.data?.error || 'No se pudo eliminar el escaneo.');
          }
        },
      },
    ]);
  }, [detalleParams, tomaAbierta, tomaActiva?.id_toma]);

  const agregarEquipoBodega = useCallback(async () => {
    const codigo = bodegaCodigo.trim();
    if (!codigo || !tipoSeleccionado || bodegaSaving) {
      if (!tipoSeleccionado) Alert.alert('Inventario bodega', 'Selecciona categoria y equipo.');
      return;
    }
    setBodegaSaving(true);
    try {
      await createInventarioBodegaEquipos({
        items: [
          {
            codigo,
            numero_serie: bodegaSerie.trim() || codigo,
            equipo_nombre: tipoSeleccionado,
            descripcion_producto: bodegaObs.trim() || undefined,
            ubicacion: 'Bodega central',
            estado_equipo: 'Operativo',
          },
        ],
      });
      setBodegaCodigo('');
      setBodegaSerie('');
      setBodegaObs('');
      Alert.alert('Inventario bodega', 'Equipo agregado a bodega central.');
	    } catch (error: any) {
	      const data = error?.response?.data || {};
	      if (data?.duplicado && data?.existente) {
	        mostrarEquipoExistente(data.existente, bodegaSerie.trim() || codigo);
	      } else {
	        Alert.alert('Inventario bodega', data?.error || 'No se pudo agregar el equipo a bodega.');
	      }
	    } finally {
	      setBodegaSaving(false);
	    }
	  }, [bodegaCodigo, bodegaObs, bodegaSaving, bodegaSerie, mostrarEquipoExistente, tipoSeleccionado]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refrescar} tintColor="#0b3b8c" />}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="barcode-outline" size={28} color="#d9f2ff" />
          </View>
          <Text style={styles.heroKicker}>CONTROL TRIMESTRAL</Text>
          <Text style={styles.heroTitle}>Inventario bodega</Text>
          <Text style={styles.heroText}>Crea informes, escanea por tipo de equipo y conserva el historial de bodega.</Text>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNumber}>{abiertas}</Text>
              <Text style={styles.heroStatLabel}>abiertas</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNumber}>{cerradas}</Text>
              <Text style={styles.heroStatLabel}>cerradas</Text>
            </View>
          </View>
        </View>

        <View style={styles.modeSwitch}>
          <Pressable
            style={[styles.modeBtn, modo === 'informe' && styles.modeBtnActive]}
            onPress={() => setModo('informe')}
          >
            <Ionicons name="clipboard-outline" size={17} color={modo === 'informe' ? '#ffffff' : '#334155'} />
            <Text style={[styles.modeBtnText, modo === 'informe' && styles.modeBtnTextActive]}>Crear informe</Text>
          </Pressable>
          <Pressable
            style={[styles.modeBtn, modo === 'bodega' && styles.modeBtnBodegaActive]}
            onPress={() => setModo('bodega')}
          >
            <Ionicons name="file-tray-full-outline" size={17} color={modo === 'bodega' ? '#ffffff' : '#334155'} />
            <Text style={[styles.modeBtnText, modo === 'bodega' && styles.modeBtnTextActive]}>Agregar a bodega</Text>
          </Pressable>
        </View>

        {modo === 'bodega' ? (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.kicker}>BODEGA CENTRAL</Text>
                <Text style={styles.sectionTitle}>Agregar equipo</Text>
              </View>
            </View>
	            <Text style={styles.scanHint}>Selecciona categoria y equipo. El registro quedara en Bodega central y aparecera en En bodega.</Text>
	            <View style={styles.typeBox}>
	              <Text style={styles.selectorLabel}>Selecciona categoria</Text>
	              {categoriasInventario.length ? (
	                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
                  {categoriasInventario.map((categoria) => {
                    const selected = categoria === categoriaSeleccionada;
                    return (
                      <Pressable
	                        key={categoria}
	                        style={[styles.categoryPill, selected && styles.categoryPillActive]}
	                        onPress={() => {
	                          setCategoriaSeleccionada(categoria);
	                          setTipoSeleccionado('');
	                          setBusquedaEquipo('');
	                        }}
	                      >
                        <Text style={[styles.categoryPillText, selected && styles.categoryPillTextActive]}>{categoria}</Text>
                      </Pressable>
                    );
		                  })}
		                </ScrollView>
		              ) : null}
		              <Text style={styles.selectorLabel}>Busca o selecciona equipo</Text>
		              <View style={styles.searchBox}>
	                <Ionicons name="search-outline" size={17} color="#64748b" />
	                <TextInput
	                  style={styles.searchInput}
	                  value={busquedaEquipo}
	                  onChangeText={setBusquedaEquipo}
	                  placeholder="Buscar equipo, ejemplo: router"
	                  placeholderTextColor="#94a3b8"
	                />
	                {!!busquedaEquipo.trim() && (
	                  <Pressable onPress={() => setBusquedaEquipo('')}>
	                    <Ionicons name="close-circle" size={18} color="#94a3b8" />
	                  </Pressable>
	                )}
	              </View>
	              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeList}>
	                {tiposVisibles.map((tipo) => {
	                  const nombre = String(tipo.equipo_nombre || '').trim();
	                  const categoria = String(tipo.categoria || 'Sin categoria').trim() || 'Sin categoria';
	                  const selected = nombre.toLowerCase() === tipoSeleccionado.trim().toLowerCase();
	                  return (
	                    <Pressable
	                      key={`${categoria}-${nombre}`}
	                      style={[styles.typePill, selected && styles.typePillActive]}
	                      onPress={() => {
	                        setCategoriaSeleccionada(categoria);
	                        setTipoSeleccionado(selected ? '' : nombre);
	                      }}
	                    >
	                      <Text style={[styles.typePillTitle, selected && styles.typePillTitleActive]} numberOfLines={1}>
	                        {nombre}
	                      </Text>
	                      <Text style={[styles.typePillMeta, selected && styles.typePillMetaActive]}>{busquedaEquipo.trim() ? categoria : 'Bodega central'}</Text>
	                    </Pressable>
	                  );
	                })}
	              </ScrollView>
            </View>
            <View style={styles.bodegaFieldsRow}>
              <View style={styles.bodegaFieldCard}>
                <View style={styles.bodegaFieldLabelRow}>
                  <Ionicons name="pricetag-outline" size={14} color="#16a34a" />
                  <Text style={styles.bodegaFieldLabel}>Codigo</Text>
                </View>
                <TextInput
                  style={styles.bodegaInlineInput}
                  value={bodegaCodigo}
                  onChangeText={setBodegaCodigo}
                  placeholder="5 digitos"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="characters"
                />
              </View>
              <View style={styles.bodegaFieldCard}>
                <View style={styles.bodegaFieldLabelRow}>
                  <Ionicons name="barcode-outline" size={14} color="#0b3b8c" />
                  <Text style={styles.bodegaFieldLabel}>N serie</Text>
                </View>
                <TextInput
                  style={styles.bodegaInlineInput}
                  value={bodegaSerie}
                  onChangeText={setBodegaSerie}
                  placeholder="Serie completa"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="characters"
                />
              </View>
            </View>
            <Pressable
              style={[styles.scanBtn, styles.scanBtnSuccess, !tipoSeleccionado && styles.btnDisabled, { marginBottom: 10 }]}
              disabled={!tipoSeleccionado}
              onPress={() => abrirScanner('bodega')}
            >
              <Ionicons name="scan-outline" size={18} color="#fff" />
              <Text style={styles.scanBtnText}>Escanear codigo</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryBtn, styles.primaryBtnSuccess, styles.bodegaSubmitBtn, (bodegaSaving || !tipoSeleccionado || !bodegaCodigo.trim()) && styles.btnDisabled]}
              disabled={bodegaSaving || !tipoSeleccionado || !bodegaCodigo.trim()}
              onPress={agregarEquipoBodega}
            >
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>{bodegaSaving ? 'Guardando...' : 'Agregar a bodega'}</Text>
            </Pressable>
          </View>
        ) : (
        <>
	        <View style={styles.createInformeCard}>
	          <View style={styles.createInformeIcon}>
	            <Ionicons name="clipboard-outline" size={24} color="#ffffff" />
	          </View>
	          <View style={styles.createInformeContent}>
	            <Text style={styles.kicker}>NUEVO INFORME</Text>
	            <Text style={styles.sectionTitle}>Crear informe</Text>
	            <Text style={styles.createInformeText}>Registra una nueva toma fisica para escanear equipos por categoria.</Text>
	          </View>
	          <Pressable style={styles.createInformeBtn} onPress={() => setCrearInformeModalVisible(true)}>
	            <Ionicons name="add-circle-outline" size={18} color="#fff" />
	            <Text style={styles.primaryBtnText}>Crear</Text>
	          </Pressable>
	        </View>

        {!!tomas.length && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.kicker}>HISTORIAL</Text>
                <Text style={styles.sectionTitle}>Informes registrados</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tomaList}>
              {tomas.map((item) => {
                const selected = Number(item.id_toma) === Number(tomaActiva?.id_toma || 0);
                const abierta = String(item.estado || '').toLowerCase() !== 'cerrado';
                return (
	                  <View
	                    key={item.id_toma}
	                    style={[styles.tomaPill, selected && styles.tomaPillActive]}
	                  >
	                    <View style={styles.tomaPillTop}>
	                      <Pressable style={styles.tomaPillMain} onPress={() => seleccionarToma(item.id_toma)}>
	                        <Text style={[styles.tomaPillTitle, selected && styles.tomaPillTitleActive]} numberOfLines={1}>
	                          {item.nombre || `Informe ${item.id_toma}`}
	                        </Text>
	                        <Text style={[styles.tomaPillMeta, selected && styles.tomaPillMetaActive]}>
	                          {formatFecha(item.fecha_inicio)} - {abierta ? 'Abierto' : 'Finalizado'}
	                        </Text>
	                      </Pressable>
	                      <Pressable
	                        style={[styles.tomaViewBtn, selected && styles.tomaViewBtnActive]}
	                        onPress={() => verInformeHistorial(item.id_toma)}
	                      >
	                        <Ionicons name="eye-outline" size={16} color={selected ? '#ffffff' : '#0b3b8c'} />
	                      </Pressable>
	                    </View>
	                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#0b3b8c" />
            <Text style={styles.loadingText}>Cargando inventario...</Text>
          </View>
        ) : tomaActiva ? (
          <>
            <View style={styles.activeCard}>
              <View style={styles.activeHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.kicker}>INFORME ACTUAL</Text>
                  <Text style={styles.activeTitle}>{tomaActiva.nombre || `Informe ${tomaActiva.id_toma}`}</Text>
                  <Text style={styles.activeMeta}>{tomaActiva.ubicacion || 'Bodega central'} - {formatFecha(tomaActiva.fecha_inicio)}</Text>
                </View>
                <View style={[styles.stateBadge, tomaAbierta ? styles.stateOpen : styles.stateClosed]}>
                  <Text style={[styles.stateText, tomaAbierta ? styles.stateOpenText : styles.stateClosedText]}>
                    {estadoTexto(tomaActiva.estado)}
                  </Text>
                </View>
              </View>

              <View style={styles.progressWrap}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${Math.min(Number(resumen.cumplimiento || 0), 100)}%` }]} />
                </View>
                <Text style={styles.progressText}>{Number(resumen.cumplimiento || 0).toFixed(1)}% cumplimiento</Text>
              </View>

              <View style={styles.kpiGrid}>
                <Kpi label="Esperados" value={resumen.total_esperado || 0} color="#0b3b8c" />
                <Kpi label="Encontrados" value={resumen.encontrados || 0} color="#16a34a" />
                <Kpi label="Faltantes" value={resumen.faltantes || 0} color="#dc2626" />
                <Kpi label="No esperados" value={resumen.no_esperados || 0} color="#f59e0b" />
                <Kpi label="No corresponde" value={resumen.no_corresponden || 0} color="#b91c1c" />
              </View>

	              <View style={styles.typeBox}>
	                <View style={styles.sectionHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.kicker}>CATEGORIA Y EQUIPO</Text>
                    <Text style={styles.scanTitle}>Selecciona categoria, luego equipo</Text>
                  </View>
                  {tipoSeleccionado ? (
                    <View style={styles.typeCounter}>
                      <Text style={styles.typeCounterNumber}>{totalTipoSeleccionado}</Text>
                      <Text style={styles.typeCounterLabel}>esperados</Text>
                    </View>
	                  ) : null}
	                </View>
	                <Text style={styles.selectorLabel}>Selecciona categoria</Text>
	                {categoriasInventario.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
                    {categoriasInventario.map((categoria) => {
                      const selected = categoria === categoriaSeleccionada;
                      return (
                        <Pressable
	                          key={categoria}
	                          style={[styles.categoryPill, selected && styles.categoryPillActive]}
	                          onPress={() => {
	                            setCategoriaSeleccionada(categoria);
	                            setTipoSeleccionado('');
	                            setBusquedaEquipo('');
	                          }}
	                        >
                          <Text style={[styles.categoryPillText, selected && styles.categoryPillTextActive]}>
                            {categoria}
                          </Text>
                        </Pressable>
                      );
                    })}
		                  </ScrollView>
		                ) : null}
		                <Text style={styles.selectorLabel}>Busca o selecciona equipo</Text>
		                <View style={styles.searchBox}>
	                  <Ionicons name="search-outline" size={17} color="#64748b" />
	                  <TextInput
	                    style={styles.searchInput}
	                    value={busquedaEquipo}
	                    onChangeText={setBusquedaEquipo}
	                    placeholder="Buscar equipo, ejemplo: router"
	                    placeholderTextColor="#94a3b8"
	                  />
	                  {!!busquedaEquipo.trim() && (
	                    <Pressable onPress={() => setBusquedaEquipo('')}>
	                      <Ionicons name="close-circle" size={18} color="#94a3b8" />
	                    </Pressable>
	                  )}
	                </View>
	                {tiposVisibles.length ? (
	                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeList}>
	                    {tiposVisibles.map((tipo) => {
	                      const nombre = String(tipo.equipo_nombre || '').trim();
	                      const categoria = String(tipo.categoria || 'Sin categoria').trim() || 'Sin categoria';
	                      const selected = nombre.toLowerCase() === tipoSeleccionado.trim().toLowerCase();
	                      return (
	                        <Pressable
	                          key={`${categoria}-${nombre}`}
	                          style={[styles.typePill, selected && styles.typePillActive]}
	                          onPress={() => {
	                            setCategoriaSeleccionada(categoria);
	                            setTipoSeleccionado(selected ? '' : nombre);
	                          }}
	                        >
                          <Text style={[styles.typePillTitle, selected && styles.typePillTitleActive]} numberOfLines={1}>
                            {nombre}
	                          </Text>
	                          <Text style={[styles.typePillMeta, selected && styles.typePillMetaActive]}>
	                            {busquedaEquipo.trim() ? categoria : `${Number(tipo.total_esperado || 0)} en bodega`}
	                          </Text>
	                        </Pressable>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <Text style={styles.emptyText}>No hay equipos disponibles para esta categoria.</Text>
                )}
              </View>

              {tomaAbierta ? (
                <View style={styles.scanBox}>
                  <Text style={styles.scanTitle}>Registrar equipo</Text>
                  <Text style={styles.scanHint}>
                    {tipoSeleccionado
                      ? `Escaneando: ${tipoSeleccionado}`
                      : 'Selecciona un tipo para habilitar el escaneo.'}
                  </Text>
                  <View style={styles.scanRow}>
                    <TextInput
                      style={[styles.input, styles.scanInput]}
                      value={valorManual}
                      onChangeText={setValorManual}
                      placeholder="Codigo o N serie"
                      placeholderTextColor="#94a3b8"
                      autoCapitalize="characters"
                    />
                    <Pressable
                      style={[styles.iconBtn, (saving || !tipoSeleccionado) && styles.btnDisabled]}
                      disabled={saving || !tipoSeleccionado}
                      onPress={() => registrarValor(valorManual)}
                    >
                      <Ionicons name="checkmark" size={21} color="#fff" />
                    </Pressable>
                  </View>
                  <View style={styles.actionsRow}>
                    <Pressable style={[styles.scanBtn, !tipoSeleccionado && styles.btnDisabled]} disabled={!tipoSeleccionado} onPress={() => abrirScanner('informe')}>
                      <Ionicons name="scan-outline" size={18} color="#fff" />
                      <Text style={styles.scanBtnText}>Escanear</Text>
                    </Pressable>
                    <Pressable style={[styles.closeBtn, saving && styles.btnDisabled]} disabled={saving} onPress={cerrarToma}>
                      <Ionicons name="lock-closed-outline" size={17} color="#991b1b" />
                      <Text style={styles.closeBtnText}>Finalizar informe</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.readOnlyBox}>
                  <Ionicons name="lock-closed-outline" size={18} color="#64748b" />
                  <Text style={styles.readOnlyText}>Informe finalizado. Disponible solo como historial.</Text>
                </View>
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.kicker}>ESCANEOS</Text>
                  <Text style={styles.sectionTitle}>Equipos registrados</Text>
                </View>
                <Text style={styles.countBadge}>{escaneos.length}</Text>
              </View>
              {escaneos.length ? (
                escaneos.map((item) => (
                  <View key={item.id_escaneo || `${item.codigo}-${item.created_at}`} style={styles.scanItem}>
                    <View style={styles.scanItemMain}>
                      <Text style={styles.itemTitle}>{item.equipo_nombre || 'Equipo no identificado'}</Text>
                      <Text style={styles.itemMeta}>Codigo: {item.codigo || '-'}</Text>
                      <Text style={styles.itemMeta}>Serie: {item.numero_serie || '-'}</Text>
                      <Text style={styles.itemDate}>
                        {formatFecha(item.created_at)} {formatHora(item.created_at)}
                      </Text>
                    </View>
                    <View style={styles.scanItemSide}>
                      <Badge resultado={item.resultado} />
                      {tomaAbierta ? (
                        <Pressable style={styles.deleteBtn} onPress={() => eliminarEscaneo(Number(item.id_escaneo || 0))}>
                          <Ionicons name="trash-outline" size={16} color="#dc2626" />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>Aun no hay escaneos en este informe.</Text>
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.kicker}>CONTROL</Text>
                  <Text style={styles.sectionTitle}>Faltantes del sistema</Text>
                </View>
                <Text style={styles.countBadge}>{faltantes.length}</Text>
              </View>
              {faltantes.length ? (
                faltantes.slice(0, 40).map((item) => (
                  <View key={item.id_bodega_equipo || `${item.codigo}-${item.numero_serie}`} style={styles.missingItem}>
                    <Ionicons name="alert-circle-outline" size={19} color="#dc2626" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{item.equipo_nombre || 'Equipo'}</Text>
                      <Text style={styles.itemMeta}>Codigo: {item.codigo || '-'} - Serie: {item.numero_serie || '-'}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>Sin faltantes para el informe y tipo seleccionado.</Text>
              )}
              {faltantes.length > 40 ? (
                <Text style={styles.limitText}>Mostrando 40 de {faltantes.length}. Revisa el detalle completo en la web.</Text>
              ) : null}
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={32} color="#64748b" />
            <Text style={styles.emptyTitle}>Sin informes registrados</Text>
            <Text style={styles.emptyText}>Crea un informe para comenzar el inventario de bodega.</Text>
          </View>
        )}
        </>
        )}
	      </ScrollView>

	      <Modal visible={crearInformeModalVisible} animationType="fade" transparent>
	        <View style={styles.formModalOverlay}>
	          <View style={styles.formModalCard}>
	            <View style={styles.formModalHeader}>
	              <View style={styles.formModalTitleWrap}>
	                <View style={styles.formModalIcon}>
	                  <Ionicons name="clipboard-outline" size={22} color="#ffffff" />
	                </View>
	                <View style={{ flex: 1 }}>
	                  <Text style={styles.kicker}>NUEVO INFORME</Text>
	                  <Text style={styles.formModalTitle}>Crear informe</Text>
	                  <Text style={styles.formModalSubtitle}>Define los datos base antes de iniciar el escaneo.</Text>
	                </View>
	              </View>
	              <Pressable onPress={() => setCrearInformeModalVisible(false)} disabled={saving}>
	                <Ionicons name="close-circle" size={27} color="#64748b" />
	              </Pressable>
	            </View>
	            <Text style={styles.formFieldLabel}>Nombre del informe</Text>
	            <TextInput
	              style={styles.input}
	              value={nombreToma}
	              onChangeText={setNombreToma}
	              placeholder="Nombre del informe"
	              placeholderTextColor="#94a3b8"
	            />
	            <Text style={styles.formFieldLabel}>Ubicacion</Text>
	            <TextInput
	              style={styles.input}
	              value={ubicacion}
	              onChangeText={setUbicacion}
	              placeholder="Ubicacion"
	              placeholderTextColor="#94a3b8"
	            />
	            <Text style={styles.formFieldLabel}>Observacion</Text>
	            <TextInput
	              style={[styles.input, styles.textArea]}
	              value={observacion}
	              onChangeText={setObservacion}
	              placeholder="Observacion opcional"
	              placeholderTextColor="#94a3b8"
	              multiline
	            />
	            <View style={styles.formModalActions}>
	              <Pressable
	                style={[styles.secondaryBtn, saving && styles.btnDisabled]}
	                disabled={saving}
	                onPress={() => setCrearInformeModalVisible(false)}
	              >
	                <Text style={styles.secondaryBtnText}>Cancelar</Text>
	              </Pressable>
	              <Pressable
	                style={[styles.primaryBtn, styles.formModalSubmit, saving && styles.btnDisabled]}
	                disabled={saving}
	                onPress={crearToma}
	              >
	                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
	                <Text style={styles.primaryBtnText}>{saving ? 'Creando...' : 'Crear informe'}</Text>
	              </Pressable>
	            </View>
	          </View>
	        </View>
	      </Modal>

	      <Modal visible={verInformeModalVisible} animationType="fade" transparent>
	        <View style={styles.formModalOverlay}>
	          <View style={styles.reportModalCard}>
	            <View style={styles.formModalHeader}>
	              <View style={styles.formModalTitleWrap}>
	                <View style={styles.reportModalIcon}>
	                  <Ionicons name="document-text-outline" size={22} color="#ffffff" />
	                </View>
	                <View style={{ flex: 1 }}>
	                  <Text style={styles.kicker}>HISTORIAL</Text>
	                  <Text style={styles.formModalTitle} numberOfLines={2}>
	                    {informeDetalle?.nombre || 'Informe de inventario'}
	                  </Text>
	                  <Text style={styles.formModalSubtitle}>
	                    {informeDetalle ? `${estadoTexto(informeDetalle.estado)} - ${formatFecha(informeDetalle.fecha_inicio)}` : 'Cargando informe...'}
	                  </Text>
	                </View>
	              </View>
	              <Pressable onPress={() => setVerInformeModalVisible(false)} disabled={informeDetalleLoading}>
	                <Ionicons name="close-circle" size={27} color="#64748b" />
	              </Pressable>
	            </View>

	            {informeDetalleLoading ? (
	              <View style={styles.reportLoadingBox}>
	                <ActivityIndicator color="#0b3b8c" />
	                <Text style={styles.loadingText}>Cargando informe...</Text>
	              </View>
	            ) : informeDetalle ? (
	              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.reportModalContent}>
	                <View style={styles.reportInfoGrid}>
	                  <View style={styles.reportInfoItem}>
	                    <Text style={styles.reportInfoLabel}>Ubicacion</Text>
	                    <Text style={styles.reportInfoValue}>{informeDetalle.ubicacion || 'Bodega central'}</Text>
	                  </View>
	                  <View style={styles.reportInfoItem}>
	                    <Text style={styles.reportInfoLabel}>Responsable</Text>
	                    <Text style={styles.reportInfoValue}>{informeDetalle.responsable_nombre || '-'}</Text>
	                  </View>
	                  <View style={styles.reportInfoItem}>
	                    <Text style={styles.reportInfoLabel}>Inicio</Text>
	                    <Text style={styles.reportInfoValue}>{formatFecha(informeDetalle.fecha_inicio)}</Text>
	                  </View>
	                  <View style={styles.reportInfoItem}>
	                    <Text style={styles.reportInfoLabel}>Cierre</Text>
	                    <Text style={styles.reportInfoValue}>{formatFecha(informeDetalle.fecha_cierre)}</Text>
	                  </View>
	                </View>

	                {!!informeDetalle.observacion && (
	                  <View style={styles.reportNote}>
	                    <Text style={styles.reportInfoLabel}>Observacion</Text>
	                    <Text style={styles.reportNoteText}>{informeDetalle.observacion}</Text>
	                  </View>
	                )}

	                <View style={styles.reportKpiGrid}>
	                  <Kpi label="Esperados" value={resumenInformeDetalle.total_esperado || 0} color="#0b3b8c" />
	                  <Kpi label="Encontrados" value={resumenInformeDetalle.encontrados || 0} color="#16a34a" />
	                  <Kpi label="Faltantes" value={resumenInformeDetalle.faltantes || 0} color="#dc2626" />
	                  <Kpi label="No esperados" value={resumenInformeDetalle.no_esperados || 0} color="#f59e0b" />
	                </View>

	                <Text style={styles.reportSectionTitle}>Ultimos escaneos</Text>
	                {escaneosInformeDetalle.length ? (
	                  escaneosInformeDetalle.slice(0, 6).map((item) => (
	                    <View key={item.id_escaneo || `${item.codigo}-${item.created_at}`} style={styles.reportListItem}>
	                      <Ionicons name="barcode-outline" size={17} color="#0b3b8c" />
	                      <View style={{ flex: 1 }}>
	                        <Text style={styles.itemTitle}>{item.equipo_nombre || 'Equipo'}</Text>
	                        <Text style={styles.itemMeta}>Codigo: {item.codigo || '-'} - Serie: {item.numero_serie || '-'}</Text>
	                      </View>
	                      <Badge resultado={item.resultado} />
	                    </View>
	                  ))
	                ) : (
	                  <Text style={styles.emptyText}>Sin escaneos registrados.</Text>
	                )}

	                <Text style={styles.reportSectionTitle}>Faltantes</Text>
	                {faltantesInformeDetalle.length ? (
	                  faltantesInformeDetalle.slice(0, 6).map((item) => (
	                    <View key={item.id_bodega_equipo || `${item.codigo}-${item.numero_serie}`} style={styles.reportListItem}>
	                      <Ionicons name="alert-circle-outline" size={17} color="#dc2626" />
	                      <View style={{ flex: 1 }}>
	                        <Text style={styles.itemTitle}>{item.equipo_nombre || 'Equipo'}</Text>
	                        <Text style={styles.itemMeta}>Codigo: {item.codigo || '-'} - Serie: {item.numero_serie || '-'}</Text>
	                      </View>
	                    </View>
	                  ))
	                ) : (
	                  <Text style={styles.emptyText}>Sin faltantes en este informe.</Text>
	                )}
	              </ScrollView>
	            ) : null}
	          </View>
	        </View>
	      </Modal>

	      <Modal visible={scannerVisible} animationType="fade" transparent>
	        <View style={styles.camOverlay}>
          <View style={styles.camBox}>
            {permission?.status !== 'granted' ? (
              <View style={styles.cameraFallback}>
                <Text style={styles.emptyText}>Sin permiso de camara.</Text>
              </View>
            ) : (
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                onBarcodeScanned={scannerVisible ? handleBarcodeScanned : undefined}
              />
            )}
            <View pointerEvents="none" style={styles.scanFrame} />
            <View style={styles.camHeader}>
              <Text style={styles.camTitle}>Escanea codigo o serie</Text>
              <Pressable onPress={() => setScannerVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#fff" />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Kpi({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
    </View>
  );
}

function Badge({ resultado }: { resultado?: string }) {
  const raw = String(resultado || '').toLowerCase();
  const style =
    raw === 'encontrado'
      ? styles.badgeOk
      : raw === 'manual'
        ? styles.badgeManual
      : raw === 'duplicado'
        ? styles.badgeWarn
        : raw === 'no_esperado' || raw === 'no_corresponde'
          ? styles.badgeDanger
          : styles.badgeNeutral;
  return (
    <View style={[styles.resultBadge, style]}>
      <Text style={styles.resultBadgeText}>{resultadoTexto(resultado)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#eef3f6',
  },
  content: {
    padding: 16,
    paddingBottom: 34,
    gap: 14,
  },
  hero: {
    borderRadius: 28,
    padding: 20,
    overflow: 'hidden',
    backgroundColor: '#071527',
    shadowColor: '#0f172a',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b3b8c',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    marginBottom: 18,
  },
  heroKicker: {
    color: '#7dd3fc',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 27,
    fontWeight: '900',
    marginTop: 4,
  },
  heroText: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  heroStat: {
    flex: 1,
    borderRadius: 18,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroStatNumber: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
  },
  heroStatLabel: {
    color: '#9bdcff',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  createInformeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 24,
    padding: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#c7ddff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 9 },
    elevation: 3,
  },
  createInformeIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b3b8c',
  },
  createInformeContent: {
    flex: 1,
  },
  createInformeText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
    marginTop: 4,
  },
  createInformeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 11,
    backgroundColor: '#0b3b8c',
  },
  modeSwitch: {
    flexDirection: 'row',
    gap: 10,
    padding: 6,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 17,
    paddingVertical: 12,
    backgroundColor: '#f1f5f9',
  },
  modeBtnActive: {
    backgroundColor: '#0b3b8c',
  },
  modeBtnBodegaActive: {
    backgroundColor: '#16a34a',
  },
  modeBtnText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '900',
  },
  modeBtnTextActive: {
    color: '#ffffff',
  },
  activeCard: {
    borderRadius: 26,
    padding: 16,
    backgroundColor: '#f8fbff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  kicker: {
    color: '#2563eb',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  bodegaFieldsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  bodegaFieldCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bodegaFieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 5,
  },
  bodegaFieldLabel: {
    color: '#334155',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },
  bodegaInlineInput: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
    paddingVertical: 2,
  },
  textArea: {
    minHeight: 78,
    textAlignVertical: 'top',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#0b3b8c',
  },
  primaryBtnSuccess: {
    backgroundColor: '#16a34a',
  },
  bodegaSubmitBtn: {
    justifyContent: 'center',
    marginTop: 2,
    minHeight: 48,
  },
  secondaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  secondaryBtnText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '900',
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  btnDisabled: {
    opacity: 0.55,
  },
  tomaList: {
    gap: 10,
    paddingRight: 6,
  },
  tomaPill: {
    width: 190,
    borderRadius: 18,
    padding: 13,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  tomaPillTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tomaPillMain: {
    flex: 1,
  },
  tomaPillActive: {
    backgroundColor: '#0b3b8c',
    borderColor: '#0b3b8c',
  },
  tomaViewBtn: {
    width: 30,
    height: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eaf2ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  tomaViewBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.28)',
  },
  tomaPillTitle: {
    flex: 1,
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
  },
  tomaPillTitleActive: {
    color: '#ffffff',
  },
  tomaPillMeta: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  tomaPillMetaActive: {
    color: '#bfdbfe',
  },
  loadingBox: {
    borderRadius: 22,
    padding: 18,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  activeTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '900',
  },
  activeMeta: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  stateBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  stateOpen: {
    backgroundColor: '#dcfce7',
  },
  stateClosed: {
    backgroundColor: '#e2e8f0',
  },
  stateText: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  stateOpenText: {
    color: '#166534',
  },
  stateClosedText: {
    color: '#334155',
  },
  progressWrap: {
    marginTop: 16,
  },
  progressBar: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#0ea5e9',
  },
  progressText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 7,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  kpiCard: {
    width: '47%',
    borderRadius: 18,
    padding: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  kpiLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 3,
  },
  typeBox: {
    marginTop: 16,
    borderRadius: 22,
    padding: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  selectorLabel: {
    color: '#0f172a',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.45,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  categoryList: {
    gap: 8,
    paddingRight: 6,
    marginBottom: 12,
  },
  categoryPill: {
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: '#eef2f7',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  categoryPillActive: {
    backgroundColor: '#0b3b8c',
    borderColor: '#0b3b8c',
  },
  categoryPillText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '900',
  },
  categoryPillTextActive: {
    color: '#ffffff',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
    paddingVertical: 4,
  },
  typeList: {
    gap: 10,
    paddingRight: 6,
  },
  typePill: {
    width: 160,
    borderRadius: 18,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  typePillActive: {
    backgroundColor: '#082f65',
    borderColor: '#0ea5e9',
  },
  typePillTitle: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '900',
  },
  typePillTitleActive: {
    color: '#ffffff',
  },
  typePillMeta: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 5,
  },
  typePillMetaActive: {
    color: '#bae6fd',
  },
  typeCounter: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 78,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#dbeafe',
  },
  typeCounterNumber: {
    color: '#0b3b8c',
    fontSize: 20,
    fontWeight: '900',
  },
  typeCounterLabel: {
    color: '#1e3a8a',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  scanBox: {
    marginTop: 16,
    borderRadius: 22,
    padding: 14,
    backgroundColor: '#eef6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  scanTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 10,
  },
  scanHint: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 10,
  },
  scanRow: {
    flexDirection: 'row',
    gap: 10,
  },
  scanInput: {
    flex: 1,
    marginBottom: 0,
  },
  iconBtn: {
    width: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  scanBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    borderRadius: 16,
    paddingVertical: 12,
    backgroundColor: '#0b3b8c',
  },
  scanBtnSuccess: {
    backgroundColor: '#16a34a',
  },
  scanBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  closeBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    borderRadius: 16,
    paddingVertical: 12,
    backgroundColor: '#fee2e2',
  },
  closeBtnText: {
    color: '#991b1b',
    fontSize: 13,
    fontWeight: '900',
  },
  readOnlyBox: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    marginTop: 16,
    borderRadius: 17,
    padding: 12,
    backgroundColor: '#f1f5f9',
  },
  readOnlyText: {
    flex: 1,
    color: '#475569',
    fontSize: 13,
    fontWeight: '800',
  },
  countBadge: {
    minWidth: 38,
    textAlign: 'center',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#0b3b8c',
    backgroundColor: '#dbeafe',
    fontSize: 14,
    fontWeight: '900',
  },
  scanItem: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  scanItemMain: {
    flex: 1,
  },
  scanItemSide: {
    alignItems: 'flex-end',
    gap: 8,
  },
  itemTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
  },
  itemMeta: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  itemDate: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 6,
  },
  resultBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  badgeOk: {
    backgroundColor: '#dcfce7',
  },
  badgeManual: {
    backgroundColor: '#e0f2fe',
  },
  badgeWarn: {
    backgroundColor: '#fef3c7',
  },
  badgeDanger: {
    backgroundColor: '#fee2e2',
  },
  badgeNeutral: {
    backgroundColor: '#e2e8f0',
  },
  resultBadgeText: {
    color: '#0f172a',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff1f2',
  },
  missingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    padding: 11,
    marginBottom: 8,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  emptyState: {
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  emptyTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 8,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  limitText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  formModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.58)',
    justifyContent: 'center',
    padding: 18,
  },
  formModalCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    shadowColor: '#0f172a',
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  reportModalCard: {
    maxHeight: '86%',
    borderRadius: 28,
    padding: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    shadowColor: '#0f172a',
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  formModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  formModalTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  formModalIcon: {
    width: 46,
    height: 46,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b3b8c',
  },
  reportModalIcon: {
    width: 46,
    height: 46,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
  },
  formModalTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },
  formModalSubtitle: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
    marginTop: 3,
  },
  formFieldLabel: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.35,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  formModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  formModalSubmit: {
    flex: 1.2,
    justifyContent: 'center',
  },
  reportLoadingBox: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportModalContent: {
    paddingBottom: 6,
  },
  reportInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  reportInfoItem: {
    width: '47%',
    borderRadius: 16,
    padding: 11,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  reportInfoLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },
  reportInfoValue: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 4,
  },
  reportNote: {
    borderRadius: 16,
    padding: 11,
    marginBottom: 12,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  reportNoteText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },
  reportKpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  reportSectionTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 8,
    marginBottom: 8,
  },
  reportListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    padding: 11,
    marginBottom: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  camOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  camBox: {
    width: '100%',
    height: 430,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  camHeader: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  camTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  scanFrame: {
    position: 'absolute',
    left: 50,
    right: 50,
    top: 145,
    height: 140,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#38bdf8',
  },
  cameraFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
});
