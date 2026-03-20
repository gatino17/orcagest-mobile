import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import SignatureScreen from 'react-native-signature-canvas';
import { AuthContext } from '../_layout';
import {
  createActaEntrega,
  deleteActaEntrega,
  fetchActasEntrega,
  fetchCentrosPorCliente,
  fetchClientes,
  updateActaEntrega,
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
  empresa?: string;
  cliente?: string;
  centro?: string;
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

export default function InformesScreen() {
  const { token } = useContext(AuthContext);

  const [moduloInforme, setModuloInforme] = useState<ModuloInforme>('instalacion');
  const [tipoInstalacion, setTipoInstalacion] = useState<TipoInstalacion>('acta_entrega');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [centrosFiltro, setCentrosFiltro] = useState<Centro[]>([]);
  const [centrosForm, setCentrosForm] = useState<Centro[]>([]);
  const [actas, setActas] = useState<Acta[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
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

  const cargarClientes = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const listaClientes = await fetchClientes();
      setClientes(Array.isArray(listaClientes) ? listaClientes : []);
    } catch {
      setClientes([]);
      Alert.alert('Informes', 'No se pudieron cargar los clientes.');
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

  useEffect(() => {
    cargarClientes();
  }, [token]);

  useEffect(() => {
    cargarCentrosPorClienteFiltro(filtroClienteId);
    setFiltroCentroId(null);
  }, [filtroClienteId]);

  useEffect(() => {
    cargarCentrosPorClienteForm(clienteIdForm);
    setCentroIdForm(null);
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
  }, [moduloInforme, tipoInstalacion, filtroCentroId, filtroFechaDesde, filtroFechaHasta]);

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

  const nuevaActa = () => {
    resetForm();
    setClienteIdForm(filtroClienteId);
    setCentroIdForm(filtroCentroId);
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
    const centroFromFiltro = centrosFiltro.find((c) => Number(c.id_centro ?? c.id ?? 0) === Number(centroId || 0));
    const clienteIdFromCentro = Number(centroFromFiltro?.cliente_id || 0) || null;
    if (clienteIdFromCentro) setClienteIdForm(clienteIdFromCentro);
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
    } catch {
      Alert.alert('Informes', 'No se pudo guardar el acta.');
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
            <View style={styles.row}>
              <Pressable style={[styles.tabBtn, tipoInstalacion === 'acta_entrega' && styles.tabBtnActive]} onPress={() => setTipoInstalacion('acta_entrega')}>
                <Ionicons name="reader-outline" size={14} color={tipoInstalacion === 'acta_entrega' ? '#fff' : '#1d4ed8'} />
                <Text style={[styles.tabBtnText, tipoInstalacion === 'acta_entrega' && styles.tabBtnTextActive]}>Acta entrega</Text>
              </Pressable>
              <Pressable style={[styles.tabBtn, tipoInstalacion === 'informe_intervencion' && styles.tabBtnActive]} onPress={() => setTipoInstalacion('informe_intervencion')}>
                <Ionicons name="clipboard-outline" size={14} color={tipoInstalacion === 'informe_intervencion' ? '#fff' : '#1d4ed8'} />
                <Text style={[styles.tabBtnText, tipoInstalacion === 'informe_intervencion' && styles.tabBtnTextActive]}>Intervencion</Text>
              </Pressable>
            </View>
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

        {moduloInforme === 'instalacion' && tipoInstalacion === 'informe_intervencion' && (
          <View style={styles.card}>
            <Text style={styles.placeholderTitle}>Informe de intervencion</Text>
            <Text style={styles.placeholderText}>Seccion de referencia (sin formulario por ahora).</Text>
          </View>
        )}

        {moduloInforme === 'instalacion' && tipoInstalacion === 'acta_entrega' && (
          <>
            <View style={[styles.card, styles.headerCard]}>
              <View>
                <Text style={styles.sectionTitle}>Actas de entrega</Text>
                <Text style={styles.sectionSubTitle}>Total: {actasFiltradas.length}</Text>
              </View>
              <Pressable style={styles.newBtn} onPress={nuevaActa}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.newBtnText}>Nueva</Text>
              </Pressable>
            </View>
            <View style={styles.card}>
              {loading ? <ActivityIndicator color="#1d4ed8" /> : !actasFiltradas.length ? <Text style={styles.placeholderText}>No hay actas registradas.</Text> : actasFiltradas.map((acta, idx) => (
                <View key={acta.id_acta_entrega || idx} style={styles.rowItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{acta.centro || 'Centro'}</Text>
                    <Text style={styles.rowSubtitle}>{acta.empresa || '-'}</Text>
                    <Text style={styles.rowMeta}>Fecha: {formatDate(acta.fecha_registro)}</Text>
                  </View>
                  <View style={styles.rowActions}>
                    <Pressable style={styles.actionBtn} onPress={() => abrirActa(acta)}><Ionicons name="folder-open-outline" size={16} color="#1d4ed8" /></Pressable>
                    <Pressable style={[styles.actionBtn, styles.actionBtnDelete]} onPress={() => eliminarActa(acta.id_acta_entrega)}><Ionicons name="trash-outline" size={16} color="#dc2626" /></Pressable>
                  </View>
                </View>
              ))}
            </View>
          </>
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
                      <Pressable key={id} style={[styles.pill, active && styles.pillActive]} onPress={() => setClienteIdForm(id)}>
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
  tabBtnText: { color: '#1d4ed8', fontWeight: '700', fontSize: 12.5 },
  tabBtnTextActive: { color: '#fff' },
  placeholderTitle: { color: '#0f172a', fontWeight: '800', fontSize: 15 },
  placeholderText: { color: '#64748b', fontWeight: '600' },
  selectLabel: { color: '#334155', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  pillsRow: { gap: 8, paddingRight: 8 },
  pill: { borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  pillActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  pillText: { color: '#1d4ed8', fontWeight: '700', fontSize: 12 },
  pillTextActive: { color: '#fff' },
  inputCol: { flex: 1, gap: 6 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, color: '#0f172a', fontWeight: '600', backgroundColor: '#fff' },
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
  saveBtnText: { color: '#fff', fontWeight: '700' },
});
