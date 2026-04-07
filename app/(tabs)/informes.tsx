import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import SignatureScreen from 'react-native-signature-canvas';
import { AuthContext } from '../_layout';
import {
  createActaEntrega,
  createPermisoTrabajo,
  deleteActaEntrega,
  fetchActasEntrega,
  fetchCentrosPorCliente,
  fetchClientes,
  fetchPermisosTrabajo,
  updateActaEntrega,
  updatePermisoTrabajo,
} from '@/lib/api';

type Cliente = { id_cliente?: number; id?: number; nombre?: string; razon_social?: string };
type Centro = {
  id_centro?: number;
  id?: number;
  nombre?: string;
  nombre_ponton?: string;
  cliente_id?: number;
  area?: string;
  region?: string;
  ubicacion?: string;
  localidad?: string;
  direccion?: string;
};
type Acta = {
  id_acta_entrega?: number;
  centro_id?: number;
  cliente_id?: number;
  empresa?: string;
  cliente?: string;
  centro?: string;
  centro_nombre?: string;
  codigo_ponton?: string;
  fecha_registro?: string;
  region?: string;
  localidad?: string;
  tecnico_1?: string;
  firma_tecnico_1?: string;
  tecnico_2?: string;
  firma_tecnico_2?: string;
  recepciona_nombre?: string;
  firma_recepciona?: string;
  equipos_considerados?: string;
};
type Permiso = {
  id_permiso_trabajo?: number;
  centro_id?: number;
  acta_entrega_id?: number;
  fecha_ingreso?: string;
  fecha_salida?: string;
  correo_centro?: string;
  region?: string;
  localidad?: string;
  tecnico_1?: string;
  tecnico_2?: string;
  recepciona_nombre?: string;
  puntos_gps?: string;
  descripcion_trabajo?: string;
  empresa?: string;
  cliente?: string;
  centro?: string;
};

type ModuloInforme = 'instalacion' | 'mantencion' | 'retiro';
type TipoInstalacion = 'acta_entrega' | 'informe_intervencion';
type FirmaTarget = 'tecnico1' | 'tecnico2' | 'recepciona' | null;

const toInputDate = (value?: string) => {
  if (!value) return '';
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
};

const formatDate = (value?: string) => {
  const iso = toInputDate(value);
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const todayInputDate = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const inputDateToDate = (value?: string) => {
  const normalized = toInputDate(value);
  if (!normalized) return new Date();
  const [y, m, d] = normalized.split('-').map((v) => Number(v));
  return new Date(y, (m || 1) - 1, d || 1);
};

export default function InformesScreen() {
  const { token } = useContext(AuthContext);

  const [moduloInforme, setModuloInforme] = useState<ModuloInforme>('instalacion');
  const [mostrarInstalacionForm, setMostrarInstalacionForm] = useState(false);
  const [tipoInstalacion, setTipoInstalacion] = useState<TipoInstalacion>('acta_entrega');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [centrosFiltro, setCentrosFiltro] = useState<Centro[]>([]);
  const [centrosForm, setCentrosForm] = useState<Centro[]>([]);
  const [actas, setActas] = useState<Acta[]>([]);
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showPermisoModal, setShowPermisoModal] = useState(false);
  const [firmaModalVisible, setFirmaModalVisible] = useState(false);
  const [firmaTarget, setFirmaTarget] = useState<FirmaTarget>(null);

  const [filtroClienteId, setFiltroClienteId] = useState<number | null>(null);
  const [filtroCentroId, setFiltroCentroId] = useState<number | null>(null);
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');

  const [editId, setEditId] = useState<number | null>(null);
  const [clienteIdForm, setClienteIdForm] = useState<number | null>(null);
  const [centroIdForm, setCentroIdForm] = useState<number | null>(null);
  const [buscarCentroForm, setBuscarCentroForm] = useState('');
  const [fechaRegistro, setFechaRegistro] = useState('');
  const [region, setRegion] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [tecnico1, setTecnico1] = useState('');
  const [firmaTecnico1, setFirmaTecnico1] = useState('');
  const [tecnico2, setTecnico2] = useState('');
  const [firmaTecnico2, setFirmaTecnico2] = useState('');
  const [recepcionaNombre, setRecepcionaNombre] = useState('');
  const [firmaRecepciona, setFirmaRecepciona] = useState('');
  const [equiposConsiderados, setEquiposConsiderados] = useState('');

  // Permiso de trabajo
  const [permClienteId, setPermClienteId] = useState<number | null>(null);
  const [permCentros, setPermCentros] = useState<Centro[]>([]);
  const [permCentroId, setPermCentroId] = useState<number | null>(null);
  const [permBuscarCentro, setPermBuscarCentro] = useState('');
  const [permFecha, setPermFecha] = useState(todayInputDate());
  const [permFechaSalida, setPermFechaSalida] = useState('');
  const [showPermFechaPicker, setShowPermFechaPicker] = useState(false);
  const [showPermFechaSalidaPicker, setShowPermFechaSalidaPicker] = useState(false);
  const [permCorreoCentro, setPermCorreoCentro] = useState('');
  const [permRegion, setPermRegion] = useState('');
  const [permLocalidad, setPermLocalidad] = useState('');
  const [permTecnico1, setPermTecnico1] = useState('');
  const [permTecnico2, setPermTecnico2] = useState('');
  const [permRecepciona, setPermRecepciona] = useState('');
  const [permPuntosGps, setPermPuntosGps] = useState('');
  const [permDescripcionTrabajo, setPermDescripcionTrabajo] = useState('');

  const clienteForm = useMemo(
    () => clientes.find((c) => Number(c.id_cliente ?? c.id ?? 0) === Number(clienteIdForm ?? 0)) || null,
    [clientes, clienteIdForm]
  );

  const centroSelForm = useMemo(
    () => centrosForm.find((c) => Number(c.id_centro ?? c.id ?? 0) === Number(centroIdForm ?? 0)) || null,
    [centrosForm, centroIdForm]
  );

  const centrosFormFiltrados = useMemo(() => {
    const q = buscarCentroForm.trim().toLowerCase();
    if (!q) return centrosForm;
    return centrosForm.filter((c) => String(c.nombre || '').toLowerCase().includes(q));
  }, [centrosForm, buscarCentroForm]);

  const permCentroSel = useMemo(
    () => permCentros.find((c) => Number(c.id_centro ?? c.id ?? 0) === Number(permCentroId ?? 0)) || null,
    [permCentros, permCentroId]
  );

  const permCentrosFiltrados = useMemo(() => {
    const q = permBuscarCentro.trim().toLowerCase();
    if (!q) return permCentros;
    return permCentros.filter((c) => String(c.nombre || '').toLowerCase().includes(q));
  }, [permCentros, permBuscarCentro]);

  const actaCentroSeleccionado = useMemo(() => {
    if (!permCentroId) return null;
    const porCentro = actas
      .filter((a) => Number(a.centro_id || 0) === Number(permCentroId))
      .sort((a, b) => {
        const ta = new Date(a.fecha_registro || 0).getTime();
        const tb = new Date(b.fecha_registro || 0).getTime();
        return tb - ta;
      });
    return porCentro[0] || null;
  }, [actas, permCentroId]);
  const actaCompletada = !!actaCentroSeleccionado;
  const permisoCentroSeleccionado = useMemo(() => {
    if (!permCentroId) return null;
    const porCentro = permisos
      .filter((p) => Number(p.centro_id || 0) === Number(permCentroId))
      .sort((a, b) => {
        const ta = new Date(a.fecha_ingreso || 0).getTime();
        const tb = new Date(b.fecha_ingreso || 0).getTime();
        return tb - ta;
      });
    return porCentro[0] || null;
  }, [permisos, permCentroId]);
  const permisoCompletado = !!permisoCentroSeleccionado;
  const instalacionSeleccionada = !!(permClienteId && permCentroId);
  const instalacionesCompletadas = useMemo(() => {
    const ids = permisos
      .map((p) => Number(p.centro_id || 0))
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i);
    return ids.map((centroId) => {
      const acta = actas
        .filter((a) => Number(a.centro_id || 0) === centroId)
        .sort((a, b) => {
          const ta = new Date(a.fecha_registro || 0).getTime();
          const tb = new Date(b.fecha_registro || 0).getTime();
          return tb - ta;
        })[0];
      const centro =
        acta?.centro ||
        permCentros.find((c) => Number(c.id_centro ?? c.id ?? 0) === centroId)?.nombre ||
        centrosFiltro.find((c) => Number(c.id_centro ?? c.id ?? 0) === centroId)?.nombre ||
        `Centro ${centroId}`;
      const cliente = acta?.empresa || acta?.cliente || '-';
      return {
        centroId,
        actaId: Number(acta?.id_acta_entrega || 0) || null,
        permisoId: Number(permisos.find((p) => Number(p.centro_id || 0) === centroId)?.id_permiso_trabajo || 0) || null,
        centro,
        cliente,
        fechaActa: acta?.fecha_registro || '',
        fechaPermiso: permisos.find((p) => Number(p.centro_id || 0) === centroId)?.fecha_ingreso || '',
      };
    });
  }, [permisos, actas, permCentros, centrosFiltro]);

  const cargarClientes = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const listaClientes = await fetchClientes();
      setClientes(Array.isArray(listaClientes) ? listaClientes : []);
    } catch (error: any) {
      setClientes([]);
      const backendMsg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'No se pudieron cargar los clientes.';
      Alert.alert('Informes', backendMsg);
    } finally {
      setLoading(false);
    }
  };

  const cargarCentrosPorClienteFiltro = async (clienteId: number | null) => {
    if (!clienteId) {
      setCentrosFiltro([]);
      return;
    }
    try {
      const lista = await fetchCentrosPorCliente(clienteId);
      setCentrosFiltro(Array.isArray(lista) ? lista : []);
    } catch {
      setCentrosFiltro([]);
      Alert.alert('Informes', 'No se pudieron cargar los centros del cliente.');
    }
  };

  const cargarCentrosPorClienteForm = async (clienteId: number | null) => {
    if (!clienteId) {
      setCentrosForm([]);
      return;
    }
    try {
      const lista = await fetchCentrosPorCliente(clienteId);
      setCentrosForm(Array.isArray(lista) ? lista : []);
    } catch {
      setCentrosForm([]);
      Alert.alert('Informes', 'No se pudieron cargar los centros para el acta.');
    }
  };

  const cargarActas = async () => {
    if (!token || moduloInforme !== 'instalacion' || tipoInstalacion !== 'acta_entrega') return;
    setLoading(true);
    try {
      const data = await fetchActasEntrega({
        centro_id: filtroCentroId || undefined,
        fecha_desde: filtroFechaDesde || undefined,
        fecha_hasta: filtroFechaHasta || undefined,
      });
      setActas(Array.isArray(data) ? data : []);
    } catch {
      setActas([]);
      Alert.alert('Informes', 'No se pudieron cargar las actas.');
    } finally {
      setLoading(false);
    }
  };
  const cargarPermisos = async () => {
    if (!token || moduloInforme !== 'instalacion') return;
    try {
      const data = await fetchPermisosTrabajo({
        centro_id: filtroCentroId || undefined,
        fecha_desde: filtroFechaDesde || undefined,
        fecha_hasta: filtroFechaHasta || undefined,
      });
      setPermisos(Array.isArray(data) ? data : []);
    } catch {
      setPermisos([]);
    }
  };

  useEffect(() => {
    cargarClientes();
  }, [token]);

  useEffect(() => {
    cargarCentrosPorClienteFiltro(filtroClienteId);
    setFiltroCentroId(null);
  }, [filtroClienteId]);

  useEffect(() => {
    cargarCentrosPorClienteForm(clienteIdForm);
    setBuscarCentroForm('');
  }, [clienteIdForm]);

  useEffect(() => {
    if (!centroSelForm) {
      setRegion('');
      setLocalidad('');
      return;
    }
    setRegion(String(centroSelForm.area || centroSelForm.region || ''));
    setLocalidad(String(centroSelForm.ubicacion || centroSelForm.localidad || centroSelForm.direccion || ''));
  }, [centroSelForm]);

  useEffect(() => {
    cargarActas();
    cargarPermisos();
  }, [moduloInforme, tipoInstalacion, filtroCentroId, filtroFechaDesde, filtroFechaHasta]);

  useEffect(() => {
    if (!permClienteId) {
      setPermCentros([]);
      setPermCentroId(null);
      return;
    }
    fetchCentrosPorCliente(permClienteId)
      .then((lista) => setPermCentros(Array.isArray(lista) ? lista : []))
      .catch(() => setPermCentros([]));
  }, [permClienteId]);

  useEffect(() => {
    if (!permCentroSel) {
      setPermRegion('');
      setPermLocalidad('');
      return;
    }
    setPermRegion(String(permCentroSel.area || permCentroSel.region || ''));
    setPermLocalidad(String(permCentroSel.ubicacion || permCentroSel.localidad || permCentroSel.direccion || ''));
  }, [permCentroSel]);

  useEffect(() => {
    if (!actaCentroSeleccionado) return;
    setPermFecha(toInputDate(actaCentroSeleccionado.fecha_registro) || todayInputDate());
    setPermTecnico1(actaCentroSeleccionado.tecnico_1 || '');
    setPermTecnico2(actaCentroSeleccionado.tecnico_2 || '');
    setPermRecepciona(actaCentroSeleccionado.recepciona_nombre || '');
  }, [actaCentroSeleccionado]);
  useEffect(() => {
    if (!permisoCentroSeleccionado) return;
    setPermFecha(toInputDate(permisoCentroSeleccionado.fecha_ingreso) || todayInputDate());
    setPermFechaSalida(toInputDate(permisoCentroSeleccionado.fecha_salida) || '');
    setPermCorreoCentro(permisoCentroSeleccionado.correo_centro || '');
    setPermPuntosGps(permisoCentroSeleccionado.puntos_gps || '');
    setPermDescripcionTrabajo(permisoCentroSeleccionado.descripcion_trabajo || '');
  }, [permisoCentroSeleccionado]);

  const resetForm = () => {
    setEditId(null);
    setClienteIdForm(null);
    setCentroIdForm(null);
    setBuscarCentroForm('');
    setFechaRegistro('');
    setRegion('');
    setLocalidad('');
    setTecnico1('');
    setFirmaTecnico1('');
    setTecnico2('');
    setFirmaTecnico2('');
    setRecepcionaNombre('');
    setFirmaRecepciona('');
    setEquiposConsiderados('');
  };

  const resetPermisoForm = () => {
    setPermFecha(todayInputDate());
    setPermFechaSalida('');
    setShowPermFechaPicker(false);
    setShowPermFechaSalidaPicker(false);
    setPermCorreoCentro('');
    setPermRegion('');
    setPermLocalidad('');
    setPermTecnico1('');
    setPermTecnico2('');
    setPermRecepciona('');
    setPermPuntosGps('');
    setPermDescripcionTrabajo('');
  };

  const nuevaActa = () => {
    resetForm();
    resetPermisoForm();
    setEditId(null);
    setPermClienteId(null);
    setPermCentroId(null);
    setPermBuscarCentro('');
    setClienteIdForm(null);
    setCentroIdForm(null);
    setFechaRegistro(todayInputDate());
    setShowEditor(true);
  };

  const nuevaActaDesdeInstalacion = () => {
    const clienteSeleccionado = permClienteId;
    const centroSeleccionado = permCentroId;
    resetForm();
    setEditId(null);
    setClienteIdForm(clienteSeleccionado || null);
    setCentroIdForm(centroSeleccionado || null);
    setFechaRegistro(todayInputDate());
    setShowEditor(true);
  };

  const abrirActa = (acta: Acta) => {
    setEditId(Number(acta.id_acta_entrega || 0) || null);
    const centroId = Number(acta.centro_id || 0) || null;
    setCentroIdForm(centroId);
    setFechaRegistro(toInputDate(acta.fecha_registro));
    setRegion(acta.region || '');
    setLocalidad(acta.localidad || '');
    setTecnico1(acta.tecnico_1 || '');
    setFirmaTecnico1(acta.firma_tecnico_1 || '');
    setTecnico2(acta.tecnico_2 || '');
    setFirmaTecnico2(acta.firma_tecnico_2 || '');
    setRecepcionaNombre(acta.recepciona_nombre || '');
    setFirmaRecepciona(acta.firma_recepciona || '');
    setEquiposConsiderados(acta.equipos_considerados || '');
    const clienteIdFromActa = Number(acta.cliente_id || 0) || null;
    const centroFromFiltro = centrosFiltro.find((c) => Number(c.id_centro ?? c.id ?? 0) === Number(centroId || 0));
    const clienteIdFromCentro = Number(centroFromFiltro?.cliente_id || 0) || null;
    const nombreClienteActa = String(acta.empresa || acta.cliente || '').trim().toLowerCase();
    const clientePorNombre = clientes.find(
      (c) => String(c.nombre || c.razon_social || '').trim().toLowerCase() === nombreClienteActa
    );
    const clienteIdPorNombre = Number(clientePorNombre?.id_cliente ?? clientePorNombre?.id ?? 0) || null;
    const clienteResuelto = clienteIdFromActa || clienteIdFromCentro || clienteIdPorNombre || filtroClienteId || null;
    if (clienteResuelto) setClienteIdForm(clienteResuelto);
    if (clienteResuelto) setPermClienteId(clienteResuelto);
    if (centroId) setPermCentroId(centroId);
    setShowEditor(true);
  };

  const guardarActa = async () => {
    if (!clienteIdForm || !centroIdForm || !fechaRegistro) {
      Alert.alert('Informes', 'Cliente, centro y fecha de registro son obligatorios.');
      return;
    }
    setSaving(true);
    const payload = {
      centro_id: centroIdForm,
      fecha_registro: fechaRegistro,
      region,
      localidad,
      tecnico_1: tecnico1,
      firma_tecnico_1: firmaTecnico1,
      tecnico_2: tecnico2,
      firma_tecnico_2: firmaTecnico2,
      recepciona_nombre: recepcionaNombre,
      firma_recepciona: firmaRecepciona,
      equipos_considerados: equiposConsiderados,
    };
    try {
      if (editId) await updateActaEntrega(editId, payload);
      else await createActaEntrega(payload);
      await cargarActas();
      setShowEditor(false);
      resetForm();
      Alert.alert('Informes', 'Acta guardada correctamente.');
    } catch (error: any) {
      const backendMsg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'No se pudo guardar el acta.';
      Alert.alert('Informes', backendMsg);
    } finally {
      setSaving(false);
    }
  };

  const eliminarActa = (id?: number) => {
    if (!id) return;
    Alert.alert('Eliminar acta', 'Quieres eliminar esta acta de entrega?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteActaEntrega(id);
            await cargarActas();
          } catch {
            Alert.alert('Informes', 'No se pudo eliminar el acta.');
          }
        },
      },
    ]);
  };

  const actasFiltradas = useMemo(() => {
    if (!filtroClienteId) return actas;
    const cliente = clientes.find((c) => Number(c.id_cliente ?? c.id ?? 0) === Number(filtroClienteId || 0));
    const nombre = String(cliente?.nombre || cliente?.razon_social || '').toLowerCase();
    return actas.filter((a) => String(a.empresa || a.cliente || '').toLowerCase() === nombre);
  }, [actas, filtroClienteId, clientes]);

  const abrirFirma = (target: FirmaTarget) => {
    if (!target) return;
    setFirmaTarget(target);
    setFirmaModalVisible(true);
  };

  const guardarFirma = (signature: string) => {
    if (firmaTarget === 'tecnico1') setFirmaTecnico1(signature);
    if (firmaTarget === 'tecnico2') setFirmaTecnico2(signature);
    if (firmaTarget === 'recepciona') setFirmaRecepciona(signature);
    setFirmaModalVisible(false);
    setFirmaTarget(null);
  };

  const limpiarFirma = (target: 'tecnico1' | 'tecnico2' | 'recepciona') => {
    if (target === 'tecnico1') setFirmaTecnico1('');
    if (target === 'tecnico2') setFirmaTecnico2('');
    if (target === 'recepciona') setFirmaRecepciona('');
  };

  const handlePermFechaChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowPermFechaPicker(false);
    if (selectedDate) {
      setPermFecha(
        `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(
          selectedDate.getDate()
        ).padStart(2, '0')}`
      );
    }
  };

  const handlePermFechaSalidaChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowPermFechaSalidaPicker(false);
    if (selectedDate) {
      setPermFechaSalida(
        `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(
          selectedDate.getDate()
        ).padStart(2, '0')}`
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}><Ionicons name="document-text-outline" size={18} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Informes</Text>
            <Text style={styles.heroSubtitle}>Gestion de informes por centro</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Categorias</Text>
          <View style={styles.row}>
            <Pressable style={[styles.tabBtn, moduloInforme === 'instalacion' && styles.tabBtnActive]} onPress={() => setModuloInforme('instalacion')}>
              <Ionicons name="construct-outline" size={14} color={moduloInforme === 'instalacion' ? '#fff' : '#1d4ed8'} />
              <Text style={[styles.tabBtnText, moduloInforme === 'instalacion' && styles.tabBtnTextActive]}>Instalacion</Text>
            </Pressable>
            <Pressable style={[styles.tabBtn, moduloInforme === 'mantencion' && styles.tabBtnActive]} onPress={() => setModuloInforme('mantencion')}>
              <Ionicons name="build-outline" size={14} color={moduloInforme === 'mantencion' ? '#fff' : '#1d4ed8'} />
              <Text style={[styles.tabBtnText, moduloInforme === 'mantencion' && styles.tabBtnTextActive]}>Mantenciones</Text>
            </Pressable>
            <Pressable style={[styles.tabBtn, moduloInforme === 'retiro' && styles.tabBtnActive]} onPress={() => setModuloInforme('retiro')}>
              <Ionicons name="exit-outline" size={14} color={moduloInforme === 'retiro' ? '#fff' : '#1d4ed8'} />
              <Text style={[styles.tabBtnText, moduloInforme === 'retiro' && styles.tabBtnTextActive]}>Retiro</Text>
            </Pressable>
          </View>
        </View>

        {moduloInforme === 'instalacion' && (
          <View style={styles.card}>
            <Text style={styles.label}>Instalacion</Text>
            <Pressable
              style={styles.addInstallBtn}
              onPress={() => {
                // Nuevo ingreso: limpiar cualquier contexto previo antes de mostrar la tarjeta.
                resetForm();
                resetPermisoForm();
                setEditId(null);
                setShowEditor(false);
                setShowPermisoModal(false);
                setPermClienteId(null);
                setPermCentroId(null);
                setPermBuscarCentro('');
                setClienteIdForm(null);
                setCentroIdForm(null);
                setMostrarInstalacionForm(true);
                setTipoInstalacion('acta_entrega');
              }}>
              <Ionicons name="add-circle-outline" size={16} color="#1d4ed8" />
              <Text style={styles.addInstallBtnText}>Agregar instalacion</Text>
            </Pressable>
          </View>
        )}

        {moduloInforme === 'instalacion' && instalacionesCompletadas.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Instalaciones completadas</Text>
            {instalacionesCompletadas.map((item) => (
              <View key={item.centroId} style={styles.installDoneCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{item.centro}</Text>
                  <Text style={styles.rowSubtitle}>{item.cliente}</Text>
                  <Text style={styles.rowMeta}>
                    Acta: {formatDate(item.fechaActa)} | Permiso: {formatDate(item.fechaPermiso)}
                  </Text>
                </View>
                <View style={styles.rowActions}>
                  {item.actaId ? (
                    <Pressable
                      style={styles.actionBtn}
                      onPress={() => {
                        setTipoInstalacion('acta_entrega');
                        const acta = actas.find((a) => Number(a.id_acta_entrega || 0) === Number(item.actaId || 0));
                        if (acta) abrirActa(acta);
                      }}>
                      <Ionicons name="create-outline" size={16} color="#1d4ed8" />
                    </Pressable>
                  ) : null}
                  {item.permisoId ? (
                    <Pressable
                      style={styles.actionBtn}
                      onPress={() => {
                        const clientePorNombre = clientes.find(
                          (c) =>
                            String(c.nombre || c.razon_social || '').trim().toLowerCase() ===
                            String(item.cliente || '').trim().toLowerCase()
                        );
                        const clienteId = Number(clientePorNombre?.id_cliente ?? clientePorNombre?.id ?? 0) || null;
                        if (clienteId) setPermClienteId(clienteId);
                        setPermCentroId(item.centroId);
                        setTipoInstalacion('informe_intervencion');
                        setShowPermisoModal(true);
                      }}>
                      <Ionicons name="clipboard-outline" size={16} color="#1d4ed8" />
                    </Pressable>
                  ) : null}
                  <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                </View>
              </View>
            ))}
          </View>
        )}

        {moduloInforme === 'instalacion' && mostrarInstalacionForm && (
          <View style={styles.card}>
            <Text style={styles.label}>Instalacion</Text>
            <View style={styles.stepperRow}>
              <View style={styles.stepItem}>
                <View style={[styles.stepDot, instalacionSeleccionada && styles.stepDotDone]}>
                  <Ionicons name="business-outline" size={12} color={instalacionSeleccionada ? '#166534' : '#64748b'} />
                </View>
                <Text style={[styles.stepText, instalacionSeleccionada && styles.stepTextDone]}>Centro</Text>
              </View>
              <View style={styles.stepLine} />
              <View style={styles.stepItem}>
                <View style={[styles.stepDot, actaCompletada && styles.stepDotDone]}>
                  <Ionicons name={actaCompletada ? 'checkmark' : 'reader-outline'} size={12} color={actaCompletada ? '#166534' : '#64748b'} />
                </View>
                <Text style={[styles.stepText, actaCompletada && styles.stepTextDone]}>Acta</Text>
              </View>
              <View style={styles.stepLine} />
              <View style={styles.stepItem}>
                <View style={[styles.stepDot, permisoCompletado && styles.stepDotDone]}>
                  <Ionicons name={permisoCompletado ? 'checkmark' : 'clipboard-outline'} size={12} color={permisoCompletado ? '#166534' : '#64748b'} />
                </View>
                <Text style={[styles.stepText, permisoCompletado && styles.stepTextDone]}>Permiso</Text>
              </View>
            </View>

            <View style={styles.inputBlock}>
              <Text style={styles.selectLabel}>Cliente</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
                {clientes.map((cl) => {
                  const id = Number(cl.id_cliente ?? cl.id ?? 0);
                  const active = id === permClienteId;
                  return (
                    <Pressable key={id} style={[styles.pill, active && styles.pillActive]} onPress={() => { setPermClienteId(id); setPermCentroId(null); setPermBuscarCentro(''); }}>
                      <Text style={[styles.pillText, active && styles.pillTextActive]}>{cl.nombre || cl.razon_social || `Cliente ${id}`}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            <View style={styles.inputBlock}>
              <Text style={styles.selectLabel}>Centro</Text>
              {permCentroSel ? (
                <View style={styles.selectedCenterBox}>
                  <Text style={styles.selectedCenterText}>{permCentroSel.nombre || 'Centro seleccionado'}</Text>
                  <Pressable style={styles.changeCenterBtn} onPress={() => { setPermCentroId(null); setPermBuscarCentro(''); }}>
                    <Text style={styles.changeCenterBtnText}>Cambiar</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <TextInput style={styles.input} value={permBuscarCentro} onChangeText={setPermBuscarCentro} placeholder="Buscar centro..." />
                  <ScrollView style={styles.centerDropdown} nestedScrollEnabled>
                    {permCentrosFiltrados.map((ce) => {
                      const id = Number(ce.id_centro ?? ce.id ?? 0);
                      return (
                        <Pressable key={id} style={styles.centerOption} onPress={() => setPermCentroId(id)}>
                          <Text style={styles.centerOptionText}>{ce.nombre || `Centro ${id}`}</Text>
                        </Pressable>
                      );
                    })}
                    {!permCentrosFiltrados.length && (
                      <Text style={styles.dropdownEmptyText}>
                        {permClienteId ? 'Sin centros para este cliente.' : 'Selecciona un cliente para ver sus centros.'}
                      </Text>
                    )}
                  </ScrollView>
                </>
              )}
            </View>

            <View style={styles.installSummaryBox}>
              <Text style={styles.installSummaryTitle}>{permCentroSel?.nombre || 'Instalacion sin centro seleccionado'}</Text>
              <Text style={styles.installSummaryMeta}>
                {clientes.find((c) => Number(c.id_cliente ?? c.id ?? 0) === Number(permClienteId ?? 0))?.nombre || '-'}
              </Text>
              <View style={styles.installStateRow}>
                <Text style={styles.installStateLabel}>Acta:</Text>
                <Text style={[styles.installStateValue, actaCompletada ? styles.installStateOk : styles.installStateWarn]}>
                  {actaCompletada ? `Completada (${formatDate(actaCentroSeleccionado?.fecha_registro)})` : 'Pendiente'}
                </Text>
              </View>
              <View style={styles.installStateRow}>
                <Text style={styles.installStateLabel}>Permiso:</Text>
                <Text style={[styles.installStateValue, permisoCompletado ? styles.installStateOk : styles.installStateWarn]}>
                  {permisoCompletado ? `Completado (${formatDate(permisoCentroSeleccionado?.fecha_ingreso)})` : 'Pendiente'}
                </Text>
              </View>
            </View>

            {!instalacionSeleccionada ? (
              <Pressable style={[styles.saveBtn, styles.ctaDisabled]} disabled>
                <Text style={styles.saveBtnText}>Selecciona cliente y centro</Text>
              </Pressable>
            ) : !actaCompletada ? (
              <Pressable
                style={styles.saveBtn}
                onPress={() => {
                  setTipoInstalacion('acta_entrega');
                  if (instalacionSeleccionada) nuevaActaDesdeInstalacion();
                  else nuevaActa();
                }}>
                <Text style={styles.saveBtnText}>Crear acta de entrega</Text>
              </Pressable>
            ) : !permisoCompletado ? (
              <View />
            ) : (
              <Pressable style={[styles.saveBtn, styles.ctaDone]} disabled>
                <Text style={styles.saveBtnText}>Instalacion completada</Text>
              </Pressable>
            )}

            <View style={styles.row}>
              <Pressable
                style={[
                  styles.tabBtn,
                  actaCompletada ? styles.tabBtnDone : (tipoInstalacion === 'acta_entrega' && styles.tabBtnActive),
                ]}
                onPress={() => {
                  setTipoInstalacion('acta_entrega');
                  // Flujo esperado:
                  // - Si ya existe acta del centro seleccionado => abrir para editar.
                  // - Si no existe => abrir nueva acta precargada con cliente/centro de la tarjeta.
                  if (actaCentroSeleccionado) {
                    abrirActa(actaCentroSeleccionado);
                    return;
                  }
                  if (instalacionSeleccionada) {
                    nuevaActaDesdeInstalacion();
                    return;
                  }
                  nuevaActa();
                }}>
                <Ionicons
                  name={actaCompletada ? 'checkmark-circle' : 'reader-outline'}
                  size={14}
                  color={actaCompletada ? '#166534' : (tipoInstalacion === 'acta_entrega' ? '#fff' : '#1d4ed8')}
                />
                <Text
                  style={[
                    styles.tabBtnText,
                    actaCompletada ? styles.tabBtnTextDone : (tipoInstalacion === 'acta_entrega' && styles.tabBtnTextActive),
                  ]}>
                  Acta entrega
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.tabBtn,
                  permisoCompletado ? styles.tabBtnDone : (tipoInstalacion === 'informe_intervencion' && styles.tabBtnActive),
                  !actaCompletada && styles.tabBtnDisabled,
                ]}
                onPress={() => {
                  if (!actaCompletada) {
                    Alert.alert(
                      'Instalacion',
                      'Primero completa y guarda el Acta de entrega del centro para habilitar Permiso de trabajo.'
                    );
                    setTipoInstalacion('acta_entrega');
                    return;
                  }
                  setTipoInstalacion('informe_intervencion');
                  setShowPermisoModal(true);
                }}>
                <Ionicons
                  name={permisoCompletado ? 'checkmark-circle' : 'clipboard-outline'}
                  size={14}
                  color={
                    permisoCompletado
                      ? '#166534'
                      : tipoInstalacion === 'informe_intervencion'
                      ? '#fff'
                      : !actaCompletada
                      ? '#94a3b8'
                      : '#1d4ed8'
                  }
                />
                <Text
                  style={[
                    styles.tabBtnText,
                    permisoCompletado ? styles.tabBtnTextDone : (tipoInstalacion === 'informe_intervencion' && styles.tabBtnTextActive),
                  ]}>
                  Permiso de trabajo
                </Text>
              </Pressable>
            </View>
            {!actaCompletada ? (
              <Text style={[styles.flowHint, styles.flowHintWarn]}>
                Paso 1: completa Acta de entrega. Paso 2: se habilita Permiso de trabajo.
              </Text>
            ) : null}
            {actaCompletada && !permisoCompletado ? (
              <Text style={[styles.flowHint, styles.flowHintWarn]}>
                Solo falta completar Permiso de trabajo.
              </Text>
            ) : null}
          </View>
        )}

        {moduloInforme === 'mantencion' && (
          <View style={styles.card}>
            <Text style={styles.label}>Mantenciones</Text>
            <View style={styles.row}><Pressable style={[styles.tabBtn, styles.tabBtnActive]}><Text style={[styles.tabBtnText, styles.tabBtnTextActive]}>Informe de mantencion</Text></Pressable></View>
            <Text style={styles.placeholderText}>Seccion de referencia (sin formulario por ahora).</Text>
          </View>
        )}

        {moduloInforme === 'retiro' && (
          <View style={styles.card}>
            <Text style={styles.label}>Retiro</Text>
            <View style={styles.row}><Pressable style={[styles.tabBtn, styles.tabBtnActive]}><Text style={[styles.tabBtnText, styles.tabBtnTextActive]}>Informe de retiro</Text></Pressable></View>
            <Text style={styles.placeholderText}>Seccion de referencia (sin formulario por ahora).</Text>
          </View>
        )}

      </ScrollView>

      <Modal visible={showEditor} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editId ? 'Editar acta' : 'Nueva acta'}</Text>
              <Pressable onPress={() => { setShowEditor(false); resetForm(); }}><Ionicons name="close" size={20} color="#334155" /></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputBlock}>
                <Text style={styles.selectLabel}>Cliente</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
                  {clientes.map((cl) => {
                    const id = Number(cl.id_cliente ?? cl.id ?? 0);
                    const active = id === clienteIdForm;
                    return (
                      <Pressable
                        key={id}
                        style={[styles.pill, active && styles.pillActive]}
                        onPress={() => {
                          setClienteIdForm(id);
                          setCentroIdForm(null);
                          setBuscarCentroForm('');
                        }}>
                        <Text style={[styles.pillText, active && styles.pillTextActive]}>{cl.nombre || cl.razon_social || `Cliente ${id}`}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
              <View style={styles.inputBlock}>
                <Text style={styles.selectLabel}>Centro</Text>
                {centroSelForm ? (
                  <View style={styles.selectedCenterBox}>
                    <Text style={styles.selectedCenterText}>{centroSelForm.nombre || 'Centro seleccionado'}</Text>
                    <Pressable
                      style={styles.changeCenterBtn}
                      onPress={() => {
                        setCentroIdForm(null);
                        setBuscarCentroForm('');
                      }}>
                      <Text style={styles.changeCenterBtnText}>Cambiar</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <TextInput style={styles.input} value={buscarCentroForm} onChangeText={setBuscarCentroForm} placeholder="Buscar centro..." />
                    <ScrollView style={styles.centerDropdown} nestedScrollEnabled>
                      {centrosFormFiltrados.map((ce) => {
                        const id = Number(ce.id_centro ?? ce.id ?? 0);
                        const active = id === centroIdForm;
                        return (
                          <Pressable key={id} style={[styles.centerOption, active && styles.centerOptionActive]} onPress={() => setCentroIdForm(id)}>
                            <Text style={[styles.centerOptionText, active && styles.centerOptionTextActive]}>{ce.nombre || `Centro ${id}`}</Text>
                          </Pressable>
                        );
                      })}
                      {!centrosFormFiltrados.length && (
                        <Text style={styles.dropdownEmptyText}>
                          {clienteIdForm ? 'Sin centros para este cliente.' : 'Selecciona un cliente para ver sus centros.'}
                        </Text>
                      )}
                    </ScrollView>
                  </>
                )}
              </View>
              <View style={styles.row}>
                <View style={styles.inputCol}><Text style={styles.selectLabel}>Empresa</Text><TextInput style={[styles.input, styles.inputDisabled]} editable={false} value={clienteForm?.nombre || clienteForm?.razon_social || ''} /></View>
                <View style={styles.inputCol}><Text style={styles.selectLabel}>Codigo ponton</Text><TextInput style={[styles.input, styles.inputDisabled]} editable={false} value={centroSelForm?.nombre_ponton || ''} /></View>
              </View>
              <View style={styles.row}>
                <View style={styles.inputCol}><Text style={styles.selectLabel}>Region (Area)</Text><TextInput style={[styles.input, styles.inputDisabled]} editable={false} value={region} /></View>
                <View style={styles.inputCol}><Text style={styles.selectLabel}>Localidad</Text><TextInput style={[styles.input, styles.inputDisabled]} editable={false} value={localidad} /></View>
              </View>

              <View style={styles.techDivider}>
                <View style={styles.techDividerLine} />
                <View style={styles.techDividerBadge}>
                  <Ionicons name="people-outline" size={12} color="#1d4ed8" />
                  <Text style={styles.techDividerText}>Tecnicos y recepcion</Text>
                </View>
                <View style={styles.techDividerLine} />
              </View>

              <View style={styles.personBlock}>
                <Text style={styles.personTitle}>Tecnico 1</Text>
                <TextInput style={styles.input} value={tecnico1} onChangeText={setTecnico1} placeholder="Nombre tecnico 1" />
                <View style={styles.firmaActions}>
                  <Pressable style={styles.firmaBtn} onPress={() => abrirFirma('tecnico1')}><Text style={styles.firmaBtnText}>{firmaTecnico1 ? 'Editar firma' : 'Firmar'}</Text></Pressable>
                  {!!firmaTecnico1 && <Pressable style={styles.firmaClearBtn} onPress={() => limpiarFirma('tecnico1')}><Ionicons name="trash-outline" size={14} color="#dc2626" /></Pressable>}
                </View>
                {!!firmaTecnico1 && <Image source={{ uri: firmaTecnico1 }} style={styles.firmaPreview} resizeMode="contain" />}
              </View>

              <View style={styles.personBlock}>
                <Text style={styles.personTitle}>Tecnico 2</Text>
                <TextInput style={styles.input} value={tecnico2} onChangeText={setTecnico2} placeholder="Nombre tecnico 2" />
                <View style={styles.firmaActions}>
                  <Pressable style={styles.firmaBtn} onPress={() => abrirFirma('tecnico2')}><Text style={styles.firmaBtnText}>{firmaTecnico2 ? 'Editar firma' : 'Firmar'}</Text></Pressable>
                  {!!firmaTecnico2 && <Pressable style={styles.firmaClearBtn} onPress={() => limpiarFirma('tecnico2')}><Ionicons name="trash-outline" size={14} color="#dc2626" /></Pressable>}
                </View>
                {!!firmaTecnico2 && <Image source={{ uri: firmaTecnico2 }} style={styles.firmaPreview} resizeMode="contain" />}
              </View>

              <View style={styles.personBlock}>
                <Text style={styles.personTitle}>Recepciona</Text>
                <TextInput style={styles.input} value={recepcionaNombre} onChangeText={setRecepcionaNombre} placeholder="Nombre quien recepciona" />
                <View style={styles.firmaActions}>
                  <Pressable style={styles.firmaBtn} onPress={() => abrirFirma('recepciona')}><Text style={styles.firmaBtnText}>{firmaRecepciona ? 'Editar firma' : 'Firmar'}</Text></Pressable>
                  {!!firmaRecepciona && <Pressable style={styles.firmaClearBtn} onPress={() => limpiarFirma('recepciona')}><Ionicons name="trash-outline" size={14} color="#dc2626" /></Pressable>}
                </View>
                {!!firmaRecepciona && <Image source={{ uri: firmaRecepciona }} style={styles.firmaPreview} resizeMode="contain" />}
              </View>

              <View style={styles.row}>
                <View style={styles.inputCol}>
                  <Text style={styles.selectLabel}>Fecha registro</Text>
                  <TextInput style={styles.input} value={fechaRegistro} onChangeText={setFechaRegistro} placeholder="YYYY-MM-DD" />
                </View>
              </View>
              <View style={styles.inputBlock}>
                <Text style={styles.selectLabel}>Equipos considerados</Text>
                <TextInput style={[styles.input, styles.textArea]} value={equiposConsiderados} onChangeText={setEquiposConsiderados} multiline textAlignVertical="top" />
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => { setShowEditor(false); resetForm(); }}><Text style={styles.cancelBtnText}>Cancelar</Text></Pressable>
              <Pressable style={styles.saveBtn} onPress={guardarActa} disabled={saving}><Text style={styles.saveBtnText}>{saving ? 'Guardando...' : 'Guardar'}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showPermisoModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Permiso de trabajo</Text>
              <Pressable
                onPress={() => {
                  setShowPermisoModal(false);
                  setTipoInstalacion('acta_entrega');
                }}>
                <Ionicons name="close" size={20} color="#334155" />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.requirementBox}>
                <View style={styles.requirementRow}>
                  <Ionicons name={actaCentroSeleccionado ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={actaCentroSeleccionado ? '#16a34a' : '#64748b'} />
                  <Text style={styles.requirementText}>Acta de entrega {actaCentroSeleccionado ? 'completada' : 'pendiente'}</Text>
                </View>
                <View style={styles.requirementRow}>
                  <Ionicons name="ellipse-outline" size={14} color="#64748b" />
                  <Text style={styles.requirementText}>Permiso de trabajo pendiente</Text>
                </View>
                <Text style={styles.requirementHint}>Para cerrar instalacion, el centro debe tener ambos documentos: Acta + Permiso de trabajo.</Text>
              </View>

              <View style={styles.row}>
                <View style={styles.inputCol}><Text style={styles.selectLabel}>Empresa</Text><TextInput style={[styles.input, styles.inputDisabled]} editable={false} value={clientes.find((c) => Number(c.id_cliente ?? c.id ?? 0) === Number(permClienteId ?? 0))?.nombre || ''} /></View>
                <View style={styles.inputCol}><Text style={styles.selectLabel}>Codigo ponton</Text><TextInput style={[styles.input, styles.inputDisabled]} editable={false} value={permCentroSel?.nombre_ponton || ''} /></View>
              </View>
              <View style={styles.row}>
                <View style={styles.inputCol}><Text style={styles.selectLabel}>Region (Area)</Text><TextInput style={[styles.input, styles.inputDisabled]} editable={false} value={permRegion} /></View>
                <View style={styles.inputCol}><Text style={styles.selectLabel}>Localidad</Text><TextInput style={[styles.input, styles.inputDisabled]} editable={false} value={permLocalidad} /></View>
              </View>
              <View style={styles.row}>
                <View style={styles.inputCol}><Text style={styles.selectLabel}>Tecnico 1</Text><TextInput style={styles.input} value={permTecnico1} onChangeText={setPermTecnico1} /></View>
                <View style={styles.inputCol}><Text style={styles.selectLabel}>Tecnico 2</Text><TextInput style={styles.input} value={permTecnico2} onChangeText={setPermTecnico2} /></View>
              </View>
              <View style={styles.row}>
                <View style={styles.inputCol}><Text style={styles.selectLabel}>Recepciona</Text><TextInput style={styles.input} value={permRecepciona} onChangeText={setPermRecepciona} /></View>
                <View style={styles.inputCol}>
                  <Text style={styles.selectLabel}>Fecha ingreso</Text>
                  <Pressable style={styles.dateInput} onPress={() => setShowPermFechaPicker(true)}>
                    <Text style={styles.dateInputText}>{permFecha || 'Seleccionar fecha'}</Text>
                    <Ionicons name="calendar-outline" size={16} color="#1d4ed8" />
                  </Pressable>
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.inputCol}>
                  <Text style={styles.selectLabel}>Fecha salida</Text>
                  <Pressable style={styles.dateInput} onPress={() => setShowPermFechaSalidaPicker(true)}>
                    <Text style={styles.dateInputText}>{permFechaSalida || 'Seleccionar fecha'}</Text>
                    <Ionicons name="calendar-outline" size={16} color="#1d4ed8" />
                  </Pressable>
                </View>
                <View style={styles.inputCol}><Text style={styles.selectLabel}>Correo centro</Text><TextInput style={styles.input} value={permCorreoCentro} onChangeText={setPermCorreoCentro} placeholder="correo@centro.cl" autoCapitalize="none" /></View>
              </View>
              {showPermFechaPicker && (
                <DateTimePicker
                  value={inputDateToDate(permFecha)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handlePermFechaChange}
                />
              )}
              {showPermFechaSalidaPicker && (
                <DateTimePicker
                  value={inputDateToDate(permFechaSalida || permFecha)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handlePermFechaSalidaChange}
                />
              )}
              <View style={styles.inputBlock}>
                <Text style={styles.selectLabel}>Puntos GPS</Text>
                <TextInput style={styles.input} value={permPuntosGps} onChangeText={setPermPuntosGps} placeholder="Ej: -41.47123, -72.93651" />
              </View>
              <View style={styles.inputBlock}>
                <Text style={styles.selectLabel}>Descripcion del trabajo</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={permDescripcionTrabajo}
                  onChangeText={setPermDescripcionTrabajo}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => {
                  setShowPermisoModal(false);
                  setTipoInstalacion('acta_entrega');
                }}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={styles.saveBtn}
                onPress={async () => {
                  if (!actaCentroSeleccionado) {
                    Alert.alert('Permiso de trabajo', 'Primero debes tener un Acta de entrega para este centro.');
                    return;
                  }
                  if (!permCentroId) {
                    Alert.alert('Permiso de trabajo', 'Selecciona un centro.');
                    return;
                  }
                  if (!permFecha) {
                    Alert.alert('Permiso de trabajo', 'Fecha ingreso es obligatoria.');
                    return;
                  }
                  try {
                    const payload = {
                      centro_id: permCentroId,
                      acta_entrega_id: actaCentroSeleccionado.id_acta_entrega || null,
                      fecha_ingreso: permFecha,
                      fecha_salida: permFechaSalida || null,
                      correo_centro: permCorreoCentro || null,
                      region: permRegion || null,
                      localidad: permLocalidad || null,
                      tecnico_1: permTecnico1 || null,
                      tecnico_2: permTecnico2 || null,
                      recepciona_nombre: permRecepciona || null,
                      puntos_gps: permPuntosGps || null,
                      descripcion_trabajo: permDescripcionTrabajo || null,
                    };
                    if (permisoCentroSeleccionado?.id_permiso_trabajo) {
                      await updatePermisoTrabajo(permisoCentroSeleccionado.id_permiso_trabajo, payload);
                    } else {
                      await createPermisoTrabajo(payload);
                    }
                    await cargarPermisos();
                    setShowPermisoModal(false);
                    setTipoInstalacion('acta_entrega');
                    setMostrarInstalacionForm(false);
                    Alert.alert('Permiso de trabajo', 'Guardado correctamente.');
                  } catch (error: any) {
                    const backendMsg =
                      error?.response?.data?.error ||
                      error?.response?.data?.message ||
                      error?.message ||
                      'No se pudo guardar el permiso de trabajo.';
                    Alert.alert('Permiso de trabajo', backendMsg);
                  }
                }}>
                <Text style={styles.saveBtnText}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={firmaModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.signatureModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Firma</Text>
              <Pressable onPress={() => { setFirmaModalVisible(false); setFirmaTarget(null); }}><Ionicons name="close" size={20} color="#334155" /></Pressable>
            </View>
            <View style={styles.signatureWrap}>
              <SignatureScreen
                onOK={guardarFirma}
                onEmpty={() => Alert.alert('Firma', 'Debes firmar antes de guardar.')}
                descriptionText="Firma aqui"
                clearText="Limpiar"
                confirmText="Guardar"
                webStyle={`
                  .m-signature-pad--footer { display: flex; }
                  .m-signature-pad { box-shadow: none; border: 1px solid #cbd5e1; }
                `}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 16, paddingTop: (RNStatusBar.currentHeight || 24) + 12, gap: 12, backgroundColor: '#fff' },
  hero: { backgroundColor: '#1d4ed8', borderRadius: 14, borderWidth: 1, borderColor: '#1e40af', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#fff', fontWeight: '800', fontSize: 19 },
  heroSubtitle: { color: '#dbeafe', fontWeight: '600', fontSize: 12.5 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, padding: 12, gap: 10 },
  label: { color: '#0f172a', fontWeight: '800', fontSize: 14 },
  row: { flexDirection: 'row', gap: 8 },
  tabBtn: { flex: 1, minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  tabBtnActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  tabBtnDone: { borderColor: '#86efac', backgroundColor: '#f0fdf4' },
  tabBtnDisabled: { borderColor: '#cbd5e1', backgroundColor: '#f8fafc' },
  tabBtnText: { color: '#1d4ed8', fontWeight: '700', fontSize: 12.5 },
  tabBtnTextActive: { color: '#fff' },
  tabBtnTextDone: { color: '#166534' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  stepItem: { alignItems: 'center', gap: 4 },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: { borderColor: '#86efac', backgroundColor: '#f0fdf4' },
  stepText: { color: '#64748b', fontWeight: '700', fontSize: 11.5 },
  stepTextDone: { color: '#166534' },
  stepLine: { flex: 1, height: 1, backgroundColor: '#e2e8f0', marginHorizontal: 6 },
  installSummaryBox: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fbff',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  installSummaryTitle: { color: '#0f172a', fontWeight: '800', fontSize: 14 },
  installSummaryMeta: { color: '#64748b', fontWeight: '600', marginBottom: 3 },
  installStateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  installStateLabel: { color: '#334155', fontWeight: '700', minWidth: 58 },
  installStateValue: { fontWeight: '800' },
  installStateOk: { color: '#166534' },
  installStateWarn: { color: '#b45309' },
  addInstallBtn: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  addInstallBtnText: { color: '#1d4ed8', fontWeight: '800' },
  installDoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginTop: 6,
  },
  flowHint: { marginTop: 8, fontSize: 12.5, fontWeight: '700' },
  flowHintOk: { color: '#166534' },
  flowHintWarn: { color: '#b45309' },
  placeholderTitle: { color: '#0f172a', fontWeight: '800', fontSize: 15 },
  placeholderText: { color: '#64748b', fontWeight: '600' },
  requirementBox: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fbff',
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requirementText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 12.5,
  },
  requirementHint: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  selectLabel: { color: '#334155', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  pillsRow: { gap: 8, paddingRight: 8 },
  pill: { borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  pillActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  pillText: { color: '#1d4ed8', fontWeight: '700', fontSize: 12 },
  pillTextActive: { color: '#fff' },
  inputCol: { flex: 1, gap: 6 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, color: '#0f172a', fontWeight: '600', backgroundColor: '#fff' },
  dateInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateInputText: { color: '#0f172a', fontWeight: '600' },
  inputDisabled: { backgroundColor: '#f8fafc', color: '#64748b' },
  headerCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#0f172a', fontWeight: '800', fontSize: 15 },
  sectionSubTitle: { color: '#64748b', fontWeight: '600', marginTop: 2 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1d4ed8', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 },
  newBtnText: { color: '#fff', fontWeight: '700', fontSize: 12.5 },
  rowItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eef2f7' },
  rowTitle: { color: '#0f172a', fontWeight: '800' },
  rowSubtitle: { color: '#334155', fontWeight: '700', marginTop: 2 },
  rowMeta: { color: '#64748b', fontSize: 12, marginTop: 1 },
  rowActions: { flexDirection: 'row', gap: 6 },
  actionBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  actionBtnDelete: { borderColor: '#fecaca', backgroundColor: '#fef2f2' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', padding: 12 },
  modalCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#dbeafe', maxHeight: '92%', padding: 12, gap: 10 },
  signatureModalCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#dbeafe', height: '72%', padding: 12, gap: 10 },
  signatureWrap: { flex: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 8 },
  modalTitle: { color: '#0f172a', fontWeight: '800', fontSize: 16 },
  inputBlock: { gap: 6, marginBottom: 8 },
  textArea: { minHeight: 88 },
  centerDropdown: { maxHeight: 180, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, backgroundColor: '#fff' },
  centerOption: { paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eef2f7' },
  centerOptionActive: { backgroundColor: '#eff6ff' },
  centerOptionText: { color: '#0f172a', fontWeight: '600' },
  centerOptionTextActive: { color: '#1d4ed8', fontWeight: '800' },
  dropdownEmptyText: { paddingHorizontal: 10, paddingVertical: 12, color: '#64748b', fontWeight: '600' },
  selectedCenterBox: {
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  selectedCenterText: {
    color: '#0f172a',
    fontWeight: '700',
    flex: 1,
  },
  changeCenterBtn: {
    borderWidth: 1,
    borderColor: '#1d4ed8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  changeCenterBtnText: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 12,
  },
  techDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 2,
  },
  techDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#cbd5e1',
  },
  techDividerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
  },
  techDividerText: {
    color: '#1d4ed8',
    fontWeight: '800',
    fontSize: 11.5,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  personBlock: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    padding: 10,
    gap: 8,
  },
  personTitle: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 13,
  },
  firmaActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  firmaBtn: { borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  firmaBtnText: { color: '#1d4ed8', fontWeight: '700', fontSize: 12 },
  firmaClearBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fff1f2', alignItems: 'center', justifyContent: 'center' },
  firmaPreview: { marginTop: 8, width: '100%', height: 90, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, backgroundColor: '#fff' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  cancelBtn: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#f8fafc' },
  cancelBtnText: { color: '#334155', fontWeight: '700' },
  saveBtn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#1d4ed8' },
  ctaDisabled: { backgroundColor: '#94a3b8' },
  ctaDone: { backgroundColor: '#16a34a' },
  saveBtnText: { color: '#fff', fontWeight: '700' },
});
