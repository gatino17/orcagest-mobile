import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
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
import { CameraView, useCameraPermissions } from 'expo-camera';
import { AuthContext } from '../_layout';
import {
  createActaEntrega,
  createCambioEquipoMantencion,
  createMantencionTerreno,
  createPermisoTrabajo,
  createRetiroTerreno,
  deleteActaEntrega,
  deleteRetiroTerreno,
  fetchMantencionesTerreno,
  fetchActividadesMias,
  fetchActividades,
  fetchActasEntrega,
  fetchCentrosPorCliente,
  fetchClientes,
  fetchPermisosTrabajo,
  fetchRetirosTerreno,
  getArmados,
  getEquipos,
  updateActaEntrega,
  updateActividadCalendario,
  updateMantencionTerreno,
  updatePermisoTrabajo,
  updateRetiroTerreno,
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
  correo_centro?: string;
  correo?: string;
  telefono?: string;
  telefono_centro?: string;
  base_tierra?: string | boolean;
  cantidad_radares?: number;
};
type Acta = {
  id_acta_entrega?: number;
  centro_id?: number;
  armado_id?: number;
  actividad_id?: number;
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
  firmas_tecnicos_adicionales?: Array<{ nombre?: string; firma?: string }> | string;
  recepciona_nombre?: string;
  firma_recepciona?: string;
  equipos_considerados?: string;
  centro_origen_traslado?: string;
  tipo_instalacion?: 'instalacion' | 'reapuntamiento' | string;
};
type FirmaTecnicoExtra = { nombre: string; firma: string };
type ArmadoResumen = {
  id_armado?: number;
  centro_id?: number;
  estado?: string;
  fecha_cierre?: string;
  centro?: {
    id_centro?: number;
    nombre?: string;
    cliente?: string;
  };
};
type Permiso = {
  id_permiso_trabajo?: number;
  id_mantencion_terreno?: number;
  id_retiro_terreno?: number;
  centro_id?: number;
  acta_entrega_id?: number;
  fecha_ingreso?: string;
  fecha_salida?: string;
  fecha_retiro?: string;
  correo_centro?: string;
  region?: string;
  localidad?: string;
  responsabilidad?: string;
  tecnico_1?: string;
  firma_tecnico_1?: string;
  tecnico_2?: string;
  firma_tecnico_2?: string;
  recepciona_nombre?: string;
  recepciona_rut?: string;
  firma_recepciona?: string;
  telefono_centro?: string;
  puntos_gps?: string;
  medicion_fase_neutro?: string;
  medicion_neutro_tierra?: string;
  hertz?: string;
  sellos?: string;
  descripcion_trabajo?: string;
  evidencia_foto?: string;
  checklist_equipos?: string;
  firmas_tecnicos_adicionales?: Array<{ nombre?: string; firma?: string }> | string;
  tipo_retiro?: string;
  estado_logistico?: string;
  observacion?: string;
  empresa?: string;
  cliente?: string;
  centro?: string;
  equipos?: RetiroEquipoChecklist[];
};
type GpsPoint = { lat: string; lng: string };
type SelloItem = { ubicacion: string; numeroAnterior: string; numeroNuevo: string };
type EquipoCentro = {
  id_equipo?: number;
  nombre?: string;
  numero_serie?: string;
  codigo?: string;
  centro_id?: number;
};
type RetiroEquipoChecklist = {
  id_retiro_equipo?: number;
  equipo_id?: number;
  equipo_nombre?: string;
  numero_serie?: string;
  codigo?: string;
  retirado?: boolean;
};
type MantencionEquipoChecklist = {
  equipo_id?: number;
  equipo_nombre?: string;
  numero_serie?: string;
  codigo?: string;
  revisado?: boolean;
  observacion?: string;
};
type ActividadAsignada = {
  id_actividad?: number;
  nombre_actividad?: string;
  area?: string;
  estado?: string;
  fecha_inicio?: string;
  fecha_termino?: string;
  centro_id?: number;
  centro?: {
    id_centro?: number;
    nombre?: string;
    cliente?: string;
    cliente_id?: number;
    area?: string;
    ubicacion?: string;
    correo_centro?: string;
    telefono?: string;
  };
  encargado_principal?: {
    id_encargado?: number;
    nombre_encargado?: string;
  };
  encargado_ayudante?: {
    id_encargado?: number;
    nombre_encargado?: string;
  };
  tecnicos_asignados?: Array<{
    id_encargado?: number;
    nombre_encargado?: string;
  }>;
};

type ModuloInforme = 'instalacion' | 'mantencion' | 'retiro';
type TipoInstalacion = 'acta_entrega' | 'informe_intervencion';
type TipoRegistroInstalacion = 'instalacion' | 'reapuntamiento';
type FirmaTarget =
  | 'tecnico1'
  | 'tecnico2'
  | 'tecnico_extra'
  | 'recepciona'
  | 'perm_recepciona'
  | 'perm_tecnico1'
  | 'perm_tecnico2'
  | null;
type PermisoContexto = 'instalacion' | 'mantencion' | 'retiro';

const toInputDate = (value?: string) => {
  if (!value) return '';
  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const latam = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (latam) return `${latam[3]}-${latam[2]}-${latam[1]}`;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    // Si la fecha viene con zona horaria (GMT/UTC/Z), usar UTC para evitar desfase de -1 dia en mobile.
    const hasTimezoneInfo = /(?:gmt|utc|z|[+\-]\d{2}:?\d{2})/i.test(raw);
    const y = hasTimezoneInfo ? parsed.getUTCFullYear() : parsed.getFullYear();
    const m = String((hasTimezoneInfo ? parsed.getUTCMonth() : parsed.getMonth()) + 1).padStart(2, '0');
    const d = String(hasTimezoneInfo ? parsed.getUTCDate() : parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return '';
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

const parseGpsPoints = (value?: string): GpsPoint[] => {
  const raw = String(value || '');
  if (!raw.trim()) return [{ lat: '', lng: '' }];
  const parts = raw
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean);
  const points = parts
    .map((p) => {
      const [latRaw = '', lngRaw = ''] = p.split(',');
      return { lat: latRaw.trim(), lng: lngRaw.trim() };
    })
    .filter((p) => p.lat || p.lng);
  return points.length ? points : [{ lat: '', lng: '' }];
};

const normalizeMeasureInput = (value?: string) => {
  let text = String(value || '').replace(/,/g, '.').replace(/[^\d.]/g, '');
  const firstDot = text.indexOf('.');
  if (firstDot !== -1) {
    text = text.slice(0, firstDot + 1) + text.slice(firstDot + 1).replace(/\./g, '');
  }
  return text;
};

const normalizeGpsPointInput = (value?: string) => {
  let text = String(value || '').replace(/[^\d.\-]/g, '');
  const minusCount = (text.match(/-/g) || []).length;
  if (minusCount > 1) text = `-${text.replace(/-/g, '')}`;
  if (text.includes('-') && !text.startsWith('-')) text = `-${text.replace(/-/g, '')}`;
  const firstDot = text.indexOf('.');
  if (firstDot !== -1) {
    text = text.slice(0, firstDot + 1) + text.slice(firstDot + 1).replace(/\./g, '');
  }
  if (text && !text.startsWith('-')) text = `-${text}`;
  return text;
};

const normalizeSelloNumero = (value?: string) => String(value || '').replace(/\D/g, '');

const parseSellos = (value?: string): SelloItem[] => {
  const raw = String(value || '').trim();
  if (!raw) return [{ ubicacion: '', numeroAnterior: '', numeroNuevo: '' }];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [{ ubicacion: '', numeroAnterior: '', numeroNuevo: '' }];
    const items = parsed
      .map((it: any) => ({
        ubicacion: String(it?.ubicacion || '').trim(),
        numeroAnterior: String(it?.numero_anterior || it?.numero || '').trim(),
        numeroNuevo: String(it?.numero_nuevo || '').trim(),
      }))
      .filter((it) => it.ubicacion || it.numeroAnterior || it.numeroNuevo);
    return items.length ? items : [{ ubicacion: '', numeroAnterior: '', numeroNuevo: '' }];
  } catch {
    return [{ ubicacion: '', numeroAnterior: '', numeroNuevo: '' }];
  }
};

const parseEvidencePhotos = (value?: string): string[] => {
  const raw = String(value || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((v) => String(v || '').trim())
        .filter(Boolean)
        .slice(0, 3);
    }
  } catch {
    // fallback below
  }
  return [raw];
};

const serializeEvidencePhotos = (photos: string[]): string | null => {
  const clean = photos.map((p) => String(p || '').trim()).filter(Boolean).slice(0, 3);
  if (!clean.length) return null;
  return JSON.stringify(clean);
};

const parseMantencionChecklist = (value?: string): MantencionEquipoChecklist[] => {
  const raw = String(value || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row: any) => ({
        equipo_id: Number(row?.equipo_id || 0) || undefined,
        equipo_nombre: String(row?.equipo_nombre || ''),
        numero_serie: String(row?.numero_serie || ''),
        codigo: String(row?.codigo || ''),
        revisado: !!row?.revisado,
        observacion: String(row?.observacion || ''),
      }))
      .filter((row: any) => row.equipo_id || row.equipo_nombre || row.numero_serie || row.codigo);
  } catch {
    return [];
  }
};

const parseFirmasTecnicosAdicionales = (
  value?: Array<{ nombre?: string; firma?: string }> | string
): FirmaTecnicoExtra[] => {
  if (!value) return [];
  try {
    const raw = Array.isArray(value) ? value : JSON.parse(String(value));
    if (!Array.isArray(raw)) return [];
    return raw
      .map((row) => ({
        nombre: String(row?.nombre || '').trim(),
        firma: String(row?.firma || ''),
      }))
      .filter((row) => !!row.nombre);
  } catch {
    return [];
  }
};

const parseRetiroEquipos = (value?: RetiroEquipoChecklist[] | string): RetiroEquipoChecklist[] => {
  if (!value) return [];
  try {
    const raw = Array.isArray(value) ? value : JSON.parse(String(value));
    if (!Array.isArray(raw)) return [];
    return raw
      .map((row: any) => ({
        id_retiro_equipo: Number(row?.id_retiro_equipo || 0) || undefined,
        equipo_id: Number(row?.equipo_id || 0) || undefined,
        equipo_nombre: String(row?.equipo_nombre || row?.nombre || '').trim(),
        numero_serie: String(row?.numero_serie || '').trim(),
        codigo: String(row?.codigo || '').trim(),
        retirado: !!row?.retirado,
      }))
      .filter((row: RetiroEquipoChecklist) => row.equipo_nombre || row.numero_serie || row.codigo);
  } catch {
    return [];
  }
};

export default function InformesScreen() {
  const { token, role, userId, name } = useContext(AuthContext);

  const [moduloInforme, setModuloInforme] = useState<ModuloInforme>('instalacion');
  const [mostrarInstalacionForm, setMostrarInstalacionForm] = useState(false);
  const [tipoInstalacion, setTipoInstalacion] = useState<TipoInstalacion>('acta_entrega');
  const [tipoRegistroInstalacion, setTipoRegistroInstalacion] = useState<TipoRegistroInstalacion>('instalacion');
  const [showInstalacionTipoModal, setShowInstalacionTipoModal] = useState(false);
  const [actividadesAsignadas, setActividadesAsignadas] = useState<ActividadAsignada[]>([]);
  const [loadingActividadesAsignadas, setLoadingActividadesAsignadas] = useState(false);
  const [actividadAsignadaActiva, setActividadAsignadaActiva] = useState<ActividadAsignada | null>(null);
  const [tecnicosAsignadosExtra, setTecnicosAsignadosExtra] = useState<string[]>([]);
  const [firmasTecnicosExtra, setFirmasTecnicosExtra] = useState<FirmaTecnicoExtra[]>([]);
  const [firmaExtraIndex, setFirmaExtraIndex] = useState<number | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [centrosFiltro, setCentrosFiltro] = useState<Centro[]>([]);
  const [centrosForm, setCentrosForm] = useState<Centro[]>([]);
  const [actas, setActas] = useState<Acta[]>([]);
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [mantencionesTerreno, setMantencionesTerreno] = useState<Permiso[]>([]);
  const [retirosTerreno, setRetirosTerreno] = useState<Permiso[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showPermisoModal, setShowPermisoModal] = useState(false);
  const [permisoContexto, setPermisoContexto] = useState<PermisoContexto>('instalacion');
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
  const [showActaFechaPicker, setShowActaFechaPicker] = useState(false);
  const [codigoPontonActa, setCodigoPontonActa] = useState('');
  const [region, setRegion] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [tecnico1, setTecnico1] = useState('');
  const [firmaTecnico1, setFirmaTecnico1] = useState('');
  const [tecnico2, setTecnico2] = useState('');
  const [firmaTecnico2, setFirmaTecnico2] = useState('');
  const [recepcionaNombre, setRecepcionaNombre] = useState('');
  const [firmaRecepciona, setFirmaRecepciona] = useState('');
  const [equiposConsiderados, setEquiposConsiderados] = useState('');
  const [centroOrigenTraslado, setCentroOrigenTraslado] = useState('');

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
  const [permTelefonoCentro, setPermTelefonoCentro] = useState('');
  const [permBaseTierra, setPermBaseTierra] = useState('');
  const [permCantidadRadares, setPermCantidadRadares] = useState('');
  const [permResponsabilidad, setPermResponsabilidad] = useState('');
  const [permRegion, setPermRegion] = useState('');
  const [permLocalidad, setPermLocalidad] = useState('');
  const [permTecnico1, setPermTecnico1] = useState('');
  const [permFirmaTecnico1, setPermFirmaTecnico1] = useState('');
  const [permTecnico2, setPermTecnico2] = useState('');
  const [permFirmaTecnico2, setPermFirmaTecnico2] = useState('');
  const [permRecepciona, setPermRecepciona] = useState('');
  const [permRecepcionaRut, setPermRecepcionaRut] = useState('');
  const [permFirmaRecepciona, setPermFirmaRecepciona] = useState('');
  const [permPuntosGpsList, setPermPuntosGpsList] = useState<GpsPoint[]>([{ lat: '', lng: '' }]);
  const [permSellosList, setPermSellosList] = useState<SelloItem[]>([
    { ubicacion: '', numeroAnterior: '', numeroNuevo: '' },
  ]);
  const [permMedicionFaseNeutro, setPermMedicionFaseNeutro] = useState('');
  const [permMedicionNeutroTierra, setPermMedicionNeutroTierra] = useState('');
  const [permHertz, setPermHertz] = useState('');
  const [permDescripcionTrabajo, setPermDescripcionTrabajo] = useState('');
  const [permEvidenciaFotos, setPermEvidenciaFotos] = useState<string[]>([]);
  const [evidenciaTargetIndex, setEvidenciaTargetIndex] = useState<number | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showSerieScannerModal, setShowSerieScannerModal] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('back');
  const cameraRef = useRef<CameraView | null>(null);
  const scannedSerieOnce = useRef(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [armadosFinalizadosCentro, setArmadosFinalizadosCentro] = useState<ArmadoResumen[]>([]);
  const [armadoSeleccionadoId, setArmadoSeleccionadoId] = useState<number | null>(null);
  const [showArmadosModal, setShowArmadosModal] = useState(false);
  const [vinculoActaId, setVinculoActaId] = useState<number | null>(null);
  const [mantencionEditandoId, setMantencionEditandoId] = useState<number | null>(null);
  const [retiroEditandoId, setRetiroEditandoId] = useState<number | null>(null);
  const [showAllMantencionesRecientes, setShowAllMantencionesRecientes] = useState(false);
  const [showAllRetirosRecientes, setShowAllRetirosRecientes] = useState(false);
  const [showRetiroTipoModal, setShowRetiroTipoModal] = useState(false);
  const [showMantencionChecklistModal, setShowMantencionChecklistModal] = useState(false);
  const [showRetiroChecklistModal, setShowRetiroChecklistModal] = useState(false);
  const [showRetiroChecklistReadModal, setShowRetiroChecklistReadModal] = useState(false);
  const [retiroChecklistReadOnly, setRetiroChecklistReadOnly] = useState<RetiroEquipoChecklist[]>([]);
  const [showCambioEquipoModal, setShowCambioEquipoModal] = useState(false);
  const [equiposCentro, setEquiposCentro] = useState<EquipoCentro[]>([]);
  const [retiroEquiposChecklist, setRetiroEquiposChecklist] = useState<RetiroEquipoChecklist[]>([]);
  const [retiroTipo, setRetiroTipo] = useState<'parcial' | 'completo'>('parcial');
  const [retiroEstado, setRetiroEstado] = useState<'retirado_centro' | 'en_transito'>('en_transito');
  const [cambioEquipoEnabled, setCambioEquipoEnabled] = useState(false);
  const [equipoCambioId, setEquipoCambioId] = useState<number | null>(null);
  const [serieNuevaCambio, setSerieNuevaCambio] = useState('');
  const [mantencionChecklistEnabled, setMantencionChecklistEnabled] = useState(false);
  const [mantencionEquiposChecklist, setMantencionEquiposChecklist] = useState<MantencionEquipoChecklist[]>([]);
  const [mantencionChecklistQuery, setMantencionChecklistQuery] = useState('');

  const clienteForm = useMemo(
    () => clientes.find((c) => Number(c.id_cliente ?? c.id ?? 0) === Number(clienteIdForm ?? 0)) || null,
    [clientes, clienteIdForm]
  );
  const clientePermSel = useMemo(
    () => clientes.find((c) => Number(c.id_cliente ?? c.id ?? 0) === Number(permClienteId ?? 0)) || null,
    [clientes, permClienteId]
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
    const tipoObjetivo = tipoRegistroInstalacion;
    const porCentro = actas
      .filter((a) => Number(a.centro_id || 0) === Number(permCentroId))
      .filter((a) => {
        const tipo = String(a.tipo_instalacion || 'instalacion').toLowerCase();
        return tipoObjetivo === 'reapuntamiento' ? tipo === 'reapuntamiento' : tipo !== 'reapuntamiento';
      })
      .sort((a, b) => {
        const ta = new Date(a.fecha_registro || 0).getTime();
        const tb = new Date(b.fecha_registro || 0).getTime();
        return tb - ta;
      });
    return porCentro[0] || null;
  }, [actas, permCentroId, tipoRegistroInstalacion]);
  const actaCompletada = !!actaCentroSeleccionado;
  const permisosInstalacion = useMemo(
    () => permisos.filter((p) => Number(p.acta_entrega_id || 0) > 0),
    [permisos]
  );
  const permisosMantencion = useMemo(
    () => mantencionesTerreno,
    [mantencionesTerreno]
  );
  const permisosRetiro = useMemo(
    () => retirosTerreno,
    [retirosTerreno]
  );
  const permisoCentroSeleccionado = useMemo(() => {
    if (!permCentroId) return null;
    const actaId = Number(actaCentroSeleccionado?.id_acta_entrega || 0);
    const porCentro = permisosInstalacion
      .filter((p) => Number(p.centro_id || 0) === Number(permCentroId))
      .filter((p) => (actaId ? Number(p.acta_entrega_id || 0) === actaId : true))
      .sort((a, b) => {
        const ta = new Date(a.fecha_ingreso || 0).getTime();
        const tb = new Date(b.fecha_ingreso || 0).getTime();
        return tb - ta;
      });
    return porCentro[0] || null;
  }, [permisosInstalacion, permCentroId, actaCentroSeleccionado]);
  const permisoCompletado = !!permisoCentroSeleccionado;
  const mantencionEditandoSeleccionada = useMemo(() => {
    if (!mantencionEditandoId) return null;
    return (
      permisosMantencion.find(
        (p) => Number(p.id_mantencion_terreno || 0) === Number(mantencionEditandoId)
      ) || null
    );
  }, [permisosMantencion, mantencionEditandoId]);
  const retiroEditandoSeleccionado = useMemo(() => {
    if (!retiroEditandoId) return null;
    return (
      permisosRetiro.find(
        (p) => Number(p.id_retiro_terreno || 0) === Number(retiroEditandoId)
      ) || null
    );
  }, [permisosRetiro, retiroEditandoId]);
  const equipoCambioSeleccionado = useMemo(
    () =>
      equiposCentro.find((e) => Number(e.id_equipo || 0) === Number(equipoCambioId || 0)) || null,
    [equiposCentro, equipoCambioId]
  );
  const armadoVinculadoId = Number(actaCentroSeleccionado?.armado_id || armadoSeleccionadoId || 0) || null;
  const armadoVinculado = armadosFinalizadosCentro.find((a) => Number(a.id_armado || 0) === Number(armadoVinculadoId || 0)) || null;
  const instalacionSeleccionada = !!(permClienteId && permCentroId);
  const instalacionesCompletadas = useMemo(() => {
    const ids = permisosInstalacion
      .map((p) => Number(p.centro_id || 0))
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i);
    return ids.map((centroId) => {
      const actasCentro = actas.filter((a) => Number(a.centro_id || 0) === centroId);
      const acta = actasCentro
        .sort((a, b) => {
          const ta = new Date(a.fecha_registro || 0).getTime();
          const tb = new Date(b.fecha_registro || 0).getTime();
          return tb - ta;
        })[0];
      const actaConArmado = actasCentro.find((a) => Number(a.armado_id || 0) > 0);
      const hasArmadoVinculado = !!actaConArmado;
      const centro =
        acta?.centro ||
        permCentros.find((c) => Number(c.id_centro ?? c.id ?? 0) === centroId)?.nombre ||
        centrosFiltro.find((c) => Number(c.id_centro ?? c.id ?? 0) === centroId)?.nombre ||
        `Centro ${centroId}`;
      const cliente = acta?.empresa || acta?.cliente || '-';
      const tipoInstalacionItem =
        String(acta?.tipo_instalacion || '').toLowerCase() === 'reapuntamiento'
          ? 'reapuntamiento'
          : 'instalacion';
      return {
        centroId,
        actaId: Number(acta?.id_acta_entrega || 0) || null,
        permisoId: Number(permisosInstalacion.find((p) => Number(p.centro_id || 0) === centroId)?.id_permiso_trabajo || 0) || null,
        armadoId: Number((actaConArmado?.armado_id || acta?.armado_id || 0)) || null,
        hasArmadoVinculado,
        centro,
        cliente,
        tipoInstalacion: tipoInstalacionItem,
        fechaActa: acta?.fecha_registro || '',
        fechaPermiso: permisosInstalacion.find((p) => Number(p.centro_id || 0) === centroId)?.fecha_ingreso || '',
      };
    });
  }, [permisosInstalacion, actas, permCentros, centrosFiltro]);
  const instalacionesEnProceso = useMemo(() => {
    const actividadesVigentes = new Set(
      actividadesAsignadas
        .map((a) => Number(a.id_actividad || 0))
        .filter((id) => id > 0)
    );
    const actasConPermiso = new Set(
      permisosInstalacion
        .map((p) => Number(p.acta_entrega_id || 0))
        .filter((id) => id > 0)
    );
    const base = actas
      .filter((a) => {
        const actaId = Number(a.id_acta_entrega || 0);
        if (!actaId) return false;
        const actividadId = Number(a.actividad_id || 0);
        // Si el acta viene de una actividad programada y esa actividad ya no existe,
        // ocultar el registro de "en proceso" para evitar residuos por asignacion eliminada.
        if (actividadId > 0 && !actividadesVigentes.has(actividadId)) return false;
        return !actasConPermiso.has(actaId);
      })
      .sort((a, b) => {
        const ta = new Date(a.fecha_registro || 0).getTime();
        const tb = new Date(b.fecha_registro || 0).getTime();
        return tb - ta;
      })
      .map((acta) => {
        const centroId = Number(acta.centro_id || 0) || null;
        const tipoInstalacionItem =
          String(acta?.tipo_instalacion || '').toLowerCase() === 'reapuntamiento'
            ? 'reapuntamiento'
            : 'instalacion';
        const centro =
          acta.centro ||
          permCentros.find((c) => Number(c.id_centro ?? c.id ?? 0) === Number(centroId || 0))?.nombre ||
          centrosFiltro.find((c) => Number(c.id_centro ?? c.id ?? 0) === Number(centroId || 0))?.nombre ||
          `Centro ${centroId || '-'}`;
        return {
          centroId,
          actaId: Number(acta.id_acta_entrega || 0) || null,
          armadoId: Number(acta.armado_id || 0) || null,
          hasArmadoVinculado: Number(acta.armado_id || 0) > 0,
          centro,
          cliente: acta.empresa || acta.cliente || '-',
          tipoInstalacion: tipoInstalacionItem,
          fechaActa: acta.fecha_registro || '',
        };
      });
    const porCentro = new Map<number, (typeof base)[number]>();
    base.forEach((item) => {
      const key = Number(item.centroId || 0);
      if (!key) return;
      if (!porCentro.has(key)) porCentro.set(key, item);
    });
    return Array.from(porCentro.values());
  }, [actas, permisosInstalacion, permCentros, centrosFiltro, actividadesAsignadas]);
  const mostrarAsignadasEnProceso = moduloInforme !== 'instalacion';
  const mostrarAsignadasCompletadas = false;
  const mantencionesRecientesVisibles = useMemo(
    () => (showAllMantencionesRecientes ? permisosMantencion : permisosMantencion.slice(0, 3)),
    [showAllMantencionesRecientes, permisosMantencion]
  );
  const retirosRecientesVisibles = useMemo(
    () => (showAllRetirosRecientes ? permisosRetiro : permisosRetiro.slice(0, 3)),
    [showAllRetirosRecientes, permisosRetiro]
  );
  const checklistRevisadosCount = useMemo(
    () => mantencionEquiposChecklist.filter((item) => !!item.revisado).length,
    [mantencionEquiposChecklist]
  );
  const mantencionChecklistFiltrado = useMemo(() => {
    const q = String(mantencionChecklistQuery || '').trim().toLowerCase();
    const base = mantencionEquiposChecklist.map((item, idx) => ({ ...item, _idx: idx }));
    if (!q) return base;
    return base.filter((item) => {
      const nombre = String(item.equipo_nombre || '').toLowerCase();
      const serie = String(item.numero_serie || '').toLowerCase();
      return nombre.includes(q) || serie.includes(q);
    });
  }, [mantencionEquiposChecklist, mantencionChecklistQuery]);
  const nombreRegistroInstalacion =
    tipoRegistroInstalacion === 'reapuntamiento' ? 'Reapuntamiento' : 'Instalacion';
  const nombreDocumentoActa =
    tipoRegistroInstalacion === 'reapuntamiento' ? 'Acta de reapuntamiento' : 'Acta de entrega';
  const roleNorm = String(role || '').trim().toLowerCase();
  const canCrearInstalacionManual = roleNorm === 'admin' || roleNorm === 'operaciones' || roleNorm === 'superadmin';
  const canEliminarRetiroReciente = roleNorm === 'admin' || roleNorm === 'operaciones' || roleNorm === 'superadmin';
  const nombresBloqueadosPorProgramacion = !!actividadAsignadaActiva;
  const bloquearClienteCentroActa = !!actividadAsignadaActiva || !!editId;
  const clienteCentroSoloLectura =
    permisoContexto === 'mantencion' || !!actividadAsignadaActiva;
  const estadoActividad = (value?: string) => {
    const est = String(value || '').trim().toLowerCase();
    if (est === 'finalizado') return 'finalizado';
    if (est === 'en progreso' || est === 'en_progreso') return 'en_progreso';
    return 'pendiente';
  };
  const actividadesAsignadasFiltradas = useMemo(() => {
    const targetModulo = moduloInforme;
    return actividadesAsignadas.filter((item) => {
      const area = String(item.area || '').trim().toLowerCase();
      const nombre = String(item.nombre_actividad || '').trim().toLowerCase();
      if (targetModulo === 'instalacion') {
        return (
          area.startsWith('instal') ||
          area.startsWith('reap') ||
          nombre.includes('instal') ||
          nombre.includes('reap')
        );
      }
      if (targetModulo === 'mantencion') return area.startsWith('manten') || nombre.includes('manten');
      if (targetModulo === 'retiro') return area.startsWith('retir') || nombre.includes('retir');
      return false;
    });
  }, [actividadesAsignadas, moduloInforme]);
  const actividadesProgramadas = useMemo(
    () => {
      const actividadesConActa = new Set(
        actas
          .map((a) => Number(a.actividad_id || 0))
          .filter((id) => id > 0)
      );
      return actividadesAsignadasFiltradas.filter((a) => {
        const idActividad = Number(a.id_actividad || 0);
        const estado = estadoActividad(a.estado);
        const esActiva = Number(actividadAsignadaActiva?.id_actividad || 0) === idActividad;
        if (esActiva) return false;
        if (estado === 'pendiente') return true;
        // Compatibilidad operativa: si en web dejaron "En progreso" pero aun no existe acta,
        // en mobile se sigue mostrando como pendiente de iniciar.
        if (estado === 'en_progreso' && !actividadesConActa.has(idActividad)) return true;
        return false;
      });
    },
    [actividadesAsignadasFiltradas, actividadAsignadaActiva, actas]
  );
  const actividadesEnProceso = useMemo(
    () => {
      const actividadesConActa = new Set(
        actas
          .map((a) => Number(a.actividad_id || 0))
          .filter((id) => id > 0)
      );
      return actividadesAsignadasFiltradas.filter((a) => {
        const idActividad = Number(a.id_actividad || 0);
        const esActiva = Number(actividadAsignadaActiva?.id_actividad || 0) === idActividad;
        const estado = estadoActividad(a.estado);
        if (esActiva) return estado !== 'finalizado';
        return estado === 'en_progreso' && actividadesConActa.has(idActividad);
      });
    },
    [actividadesAsignadasFiltradas, actividadAsignadaActiva, actas]
  );
  const actividadesCompletadas = useMemo(
    () => actividadesAsignadasFiltradas.filter((a) => estadoActividad(a.estado) === 'finalizado'),
    [actividadesAsignadasFiltradas]
  );

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
    } catch (error: any) {
      setPermisos([]);
      const backendMsg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'No se pudieron cargar los permisos de trabajo.';
      Alert.alert('Informes', backendMsg);
    }
  };
  const cargarMantencionesTerreno = async () => {
    if (!token || moduloInforme !== 'mantencion') return;
    try {
      const data = await fetchMantencionesTerreno({
        centro_id: filtroCentroId || undefined,
        fecha_desde: filtroFechaDesde || undefined,
        fecha_hasta: filtroFechaHasta || undefined,
      });
      setMantencionesTerreno(Array.isArray(data) ? data : []);
    } catch (error: any) {
      setMantencionesTerreno([]);
      const backendMsg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'No se pudieron cargar las mantenciones en terreno.';
      Alert.alert('Informes', backendMsg);
    }
  };
  const cargarRetirosTerreno = async () => {
    if (!token || moduloInforme !== 'retiro') return;
    try {
      const data = await fetchRetirosTerreno({
        centro_id: filtroCentroId || undefined,
        fecha_desde: filtroFechaDesde || undefined,
        fecha_hasta: filtroFechaHasta || undefined,
      });
      setRetirosTerreno(Array.isArray(data) ? data : []);
    } catch (error: any) {
      setRetirosTerreno([]);
      const backendMsg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'No se pudieron cargar los retiros en terreno.';
      Alert.alert('Informes', backendMsg);
    }
  };
  const cargarActividadesAsignadas = async () => {
    if (!token) return;
    setLoadingActividadesAsignadas(true);
    try {
      const byName = String(name || '')
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const userIdNum = Number(userId || 0) || 0;
      const filtrarActivas = (arr: any[]) =>
        (Array.isArray(arr) ? arr : []).filter((item) => {
          const estado = String(item?.estado || '').trim().toLowerCase();
          return estado !== 'cancelado';
        });
      let lista = filtrarActivas(await fetchActividadesMias());
      if (!lista.length) {
        const all = filtrarActivas(await fetchActividades());
        const normalize = (v: any) =>
          String(v || '')
            .toLowerCase()
            .trim()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        lista = all.filter((item) => {
          const principalId = Number(item?.encargado_principal?.id_encargado || item?.tecnico_encargado || 0) || 0;
          const ayudanteId = Number(item?.encargado_ayudante?.id_encargado || item?.tecnico_ayudante || 0) || 0;
          if (userIdNum > 0 && (principalId === userIdNum || ayudanteId === userIdNum)) return true;
          const nombres = [
            item?.encargado_principal?.nombre_encargado,
            item?.encargado_ayudante?.nombre_encargado,
            ...(Array.isArray(item?.tecnicos_asignados) ? item.tecnicos_asignados.map((t: any) => t?.nombre_encargado) : []),
          ]
            .map((n) => normalize(n))
            .filter(Boolean);
          return !!byName && nombres.some((n) => n.includes(byName) || byName.includes(n));
        });
      }
      lista = lista.filter((item) => {
        const estado = String(item?.estado || '').trim().toLowerCase();
        return estado !== 'cancelado';
      });
      setActividadesAsignadas(lista);
    } catch {
      setActividadesAsignadas([]);
    } finally {
      setLoadingActividadesAsignadas(false);
    }
  };

  const aplicarActividadAsignada = (actividad: ActividadAsignada) => {
    const area = String(actividad.area || '').trim().toLowerCase();
    const centroId = Number(actividad.centro?.id_centro || actividad.centro_id || 0) || null;
    const clienteId = Number(actividad.centro?.cliente_id || 0) || null;
    if (!centroId || !clienteId) {
      Alert.alert('Informes', 'La actividad no tiene centro/cliente asociado correctamente.');
      return;
    }

    setActividadAsignadaActiva(actividad);
    setPermClienteId(clienteId);
    setPermCentroId(centroId);
    setClienteIdForm(clienteId);
    setCentroIdForm(centroId);
    setPermBuscarCentro('');
    setBuscarCentroForm('');

    const tecnicoPrincipal = String(actividad.encargado_principal?.nombre_encargado || '').trim();
    const tecnicoAyudante = String(actividad.encargado_ayudante?.nombre_encargado || '').trim();
    const extras = (Array.isArray(actividad.tecnicos_asignados) ? actividad.tecnicos_asignados : [])
      .map((t) => String(t?.nombre_encargado || '').trim())
      .filter((name) => !!name && name !== tecnicoPrincipal && name !== tecnicoAyudante);
    setTecnicosAsignadosExtra(extras);
    setFirmasTecnicosExtra(extras.map((nombre) => ({ nombre, firma: '' })));
    if (tecnicoPrincipal) {
      setTecnico1(tecnicoPrincipal);
      setPermTecnico1(tecnicoPrincipal);
    }
    if (tecnicoAyudante) {
      setTecnico2(tecnicoAyudante);
      setPermTecnico2(tecnicoAyudante);
    }

    const fechaActividad = toInputDate(actividad.fecha_inicio) || todayInputDate();
    const actividadId = Number(actividad.id_actividad || 0) || null;
    const est = estadoActividad(actividad.estado);
    if (actividadId && est === 'pendiente') {
      updateActividadCalendario(actividadId, { estado: 'En progreso' })
        .then(() => cargarActividadesAsignadas())
        .catch(() => {});
    }
    if (area.startsWith('instal') || area.startsWith('reap')) {
      // Flujo solicitado: al seleccionar trabajo programado abrir directamente modal,
      // no la tarjeta inline bajo "Instalaciones completadas".
      resetForm();
      resetPermisoForm();
      if (tecnicoPrincipal) setTecnico1(tecnicoPrincipal);
      if (tecnicoAyudante) setTecnico2(tecnicoAyudante);
      if (tecnicoPrincipal) setPermTecnico1(tecnicoPrincipal);
      if (tecnicoAyudante) setPermTecnico2(tecnicoAyudante);
      setTipoRegistroInstalacion(area.startsWith('reap') ? 'reapuntamiento' : 'instalacion');
      setMostrarInstalacionForm(false);
      setTipoInstalacion('acta_entrega');
      setEditId(null);
      setClienteIdForm(clienteId);
      setCentroIdForm(centroId);
      setFechaRegistro(fechaActividad);
      setShowEditor(true);
      return;
    }
    if (area.startsWith('manten')) {
      resetPermisoForm();
      if (tecnicoPrincipal) setPermTecnico1(tecnicoPrincipal);
      if (tecnicoAyudante) setPermTecnico2(tecnicoAyudante);
      setPermisoContexto('mantencion');
      setPermFecha(fechaActividad);
      setMantencionEditandoId(null);
      setShowPermisoModal(true);
      return;
    }
    if (area.startsWith('retir')) {
      resetPermisoForm();
      if (tecnicoPrincipal) setPermTecnico1(tecnicoPrincipal);
      if (tecnicoAyudante) setPermTecnico2(tecnicoAyudante);
      setPermisoContexto('retiro');
      setPermFecha(fechaActividad);
      setRetiroEditandoId(null);
      // Flujo directo: abrir modal de retiro ya seleccionado desde la actividad programada.
      setShowRetiroTipoModal(false);
      setShowPermisoModal(true);
    }
  };

  const marcarActividadFinalizadaSiCorresponde = async () => {
    const actividadId = Number(actividadAsignadaActiva?.id_actividad || 0) || null;
    if (!actividadId) return;
    try {
      await updateActividadCalendario(actividadId, { estado: 'Finalizado' });
      await cargarActividadesAsignadas();
    } catch {
      // silencioso para no bloquear guardado de informe
    }
  };

  useEffect(() => {
    cargarClientes();
    cargarActividadesAsignadas();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const timer = setInterval(() => {
      cargarActividadesAsignadas();
    }, 12000);
    return () => clearInterval(timer);
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
      setCodigoPontonActa('');
      return;
    }
    setCodigoPontonActa(String(centroSelForm.nombre_ponton || ''));
    setRegion(String(centroSelForm.area || centroSelForm.region || ''));
    setLocalidad(String(centroSelForm.ubicacion || centroSelForm.localidad || centroSelForm.direccion || ''));
  }, [centroSelForm]);

  useEffect(() => {
    if (!actividadAsignadaActiva) return;
    const area = String(actividadAsignadaActiva.area || '').trim().toLowerCase();
    const compatible =
      (moduloInforme === 'instalacion' && (area.startsWith('instal') || area.startsWith('reap'))) ||
      (moduloInforme === 'mantencion' && area.startsWith('manten')) ||
      (moduloInforme === 'retiro' && area.startsWith('retir'));
    if (!compatible) {
      setActividadAsignadaActiva(null);
      setTecnicosAsignadosExtra([]);
    }
  }, [moduloInforme, actividadAsignadaActiva]);

  useEffect(() => {
    if (!actividadAsignadaActiva) return;
    const idActivo = Number(actividadAsignadaActiva.id_actividad || 0);
    const sigueExistiendo = actividadesAsignadas.some((a) => Number(a.id_actividad || 0) === idActivo);
    if (sigueExistiendo) return;
    // Si eliminaron la actividad en web, limpiar el flujo local para que desaparezca en mobile.
    setActividadAsignadaActiva(null);
    setTecnicosAsignadosExtra([]);
    setMostrarInstalacionForm(false);
    setShowEditor(false);
    setShowPermisoModal(false);
    setShowRetiroChecklistModal(false);
    setShowRetiroTipoModal(false);
  }, [actividadesAsignadas, actividadAsignadaActiva]);

  useEffect(() => {
    cargarActas();
    cargarPermisos();
    cargarMantencionesTerreno();
    cargarRetirosTerreno();
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
    if (!permCentroId) {
      setArmadosFinalizadosCentro([]);
      setArmadoSeleccionadoId(null);
      return;
    }
    getArmados({ estado: 'finalizado', centro_id: permCentroId })
      .then((lista) => {
        const arr = Array.isArray(lista) ? lista : [];
        const finalizados = arr.filter(
          (a) => String(a?.estado || '').toLowerCase() === 'finalizado' && Number(a?.centro_id || 0) === Number(permCentroId)
        );
        setArmadosFinalizadosCentro(finalizados);
      })
      .catch(() => {
        setArmadosFinalizadosCentro([]);
      });
  }, [permCentroId]);

  useEffect(() => {
    if ((permisoContexto !== 'mantencion' && permisoContexto !== 'retiro') || !permCentroId) {
      setEquiposCentro([]);
      setEquipoCambioId(null);
      setRetiroEquiposChecklist([]);
      return;
    }
    getEquipos(permCentroId)
      .then((lista) => setEquiposCentro(Array.isArray(lista) ? lista : []))
      .catch(() => setEquiposCentro([]));
  }, [permisoContexto, permCentroId]);

  useEffect(() => {
    if (!permCentroSel) {
      setPermCorreoCentro('');
      setPermRegion('');
      setPermLocalidad('');
      setPermTelefonoCentro('');
      setPermBaseTierra('');
      setPermCantidadRadares('');
      return;
    }
    setPermCorreoCentro(String(permCentroSel.correo_centro || permCentroSel.correo || ''));
    setPermRegion(String(permCentroSel.area || permCentroSel.region || ''));
    setPermLocalidad(String(permCentroSel.ubicacion || permCentroSel.localidad || permCentroSel.direccion || ''));
    setPermTelefonoCentro(String(permCentroSel.telefono || permCentroSel.telefono_centro || ''));
    setPermBaseTierra(
      permCentroSel.base_tierra === true ? 'si' : permCentroSel.base_tierra === false ? 'no' : ''
    );
    setPermCantidadRadares(String(permCentroSel.cantidad_radares ?? ''));
  }, [permCentroSel]);

  useEffect(() => {
    if (actaCentroSeleccionado?.armado_id) {
      setArmadoSeleccionadoId(Number(actaCentroSeleccionado.armado_id) || null);
      return;
    }
    if (!actaCentroSeleccionado) {
      setArmadoSeleccionadoId(null);
    }
  }, [actaCentroSeleccionado]);

  useEffect(() => {
    if (permisoContexto !== 'instalacion') return;
    if (!actaCentroSeleccionado) return;
    setPermFecha(toInputDate(actaCentroSeleccionado.fecha_registro) || todayInputDate());
    setPermTecnico1(actaCentroSeleccionado.tecnico_1 || '');
    setPermTecnico2(actaCentroSeleccionado.tecnico_2 || '');
    setPermRecepciona(actaCentroSeleccionado.recepciona_nombre || '');
  }, [actaCentroSeleccionado, permisoContexto]);
  useEffect(() => {
    if (permisoContexto !== 'instalacion') return;
    if (!permisoCentroSeleccionado) return;
    setPermFecha(toInputDate(permisoCentroSeleccionado.fecha_ingreso) || todayInputDate());
    setPermFechaSalida(toInputDate(permisoCentroSeleccionado.fecha_salida) || '');
    setPermCorreoCentro(
      String(permCentroSel?.correo_centro || permCentroSel?.correo || '') ||
        permisoCentroSeleccionado.correo_centro ||
        ''
    );
    setPermTelefonoCentro(
      String(permCentroSel?.telefono || permCentroSel?.telefono_centro || '') ||
        permisoCentroSeleccionado.telefono_centro ||
        ''
    );
    setPermBaseTierra(
      permCentroSel?.base_tierra === true ? 'si' : permCentroSel?.base_tierra === false ? 'no' : ''
    );
    setPermCantidadRadares(String(permCentroSel?.cantidad_radares ?? ''));
    setPermResponsabilidad(permisoCentroSeleccionado.responsabilidad || '');
    setPermPuntosGpsList(parseGpsPoints(permisoCentroSeleccionado.puntos_gps));
    setPermSellosList(parseSellos(permisoCentroSeleccionado.sellos));
    setPermMedicionFaseNeutro(normalizeMeasureInput(permisoCentroSeleccionado.medicion_fase_neutro || ''));
    setPermMedicionNeutroTierra(normalizeMeasureInput(permisoCentroSeleccionado.medicion_neutro_tierra || ''));
    setPermHertz(normalizeMeasureInput(permisoCentroSeleccionado.hertz || ''));
    setPermDescripcionTrabajo(permisoCentroSeleccionado.descripcion_trabajo || '');
    setPermEvidenciaFotos(parseEvidencePhotos(permisoCentroSeleccionado.evidencia_foto));
    setPermFirmaTecnico1(permisoCentroSeleccionado.firma_tecnico_1 || '');
    setPermFirmaTecnico2(permisoCentroSeleccionado.firma_tecnico_2 || '');
    setPermRecepcionaRut(permisoCentroSeleccionado.recepciona_rut || '');
    setPermFirmaRecepciona(permisoCentroSeleccionado.firma_recepciona || '');
  }, [permisoCentroSeleccionado, permCentroSel, permisoContexto]);
  useEffect(() => {
    if (permisoContexto !== 'mantencion') return;
    const base = permCentroSel || permisoCentroSeleccionado || null;
    if (!base) return;
    const editingMantencion = !!mantencionEditandoId && !!mantencionEditandoSeleccionada;
    const selectedMantencion = mantencionEditandoSeleccionada || null;
    const gpsBase = selectedMantencion?.puntos_gps || permisoCentroSeleccionado?.puntos_gps || '';
    const sellosBase = selectedMantencion?.sellos || permisoCentroSeleccionado?.sellos || '';

    setPermFecha(editingMantencion ? toInputDate(selectedMantencion?.fecha_ingreso) || todayInputDate() : todayInputDate());
    setPermFechaSalida(editingMantencion ? toInputDate(selectedMantencion?.fecha_salida) || '' : '');
    setPermCorreoCentro(
      String(permCentroSel?.correo_centro || permCentroSel?.correo || '') ||
        permisoCentroSeleccionado?.correo_centro ||
        ''
    );
    setPermTelefonoCentro(
      String(permCentroSel?.telefono || permCentroSel?.telefono_centro || '') ||
        permisoCentroSeleccionado?.telefono_centro ||
        ''
    );
    setPermBaseTierra(
      permCentroSel?.base_tierra === true ? 'si' : permCentroSel?.base_tierra === false ? 'no' : ''
    );
    setPermCantidadRadares(String(permCentroSel?.cantidad_radares ?? ''));
    setPermRegion(
      String(
        permCentroSel?.area ||
          permCentroSel?.region ||
          selectedMantencion?.region ||
          permisoCentroSeleccionado?.region ||
          ''
      )
    );
    setPermLocalidad(
      String(
        permCentroSel?.ubicacion ||
          permCentroSel?.localidad ||
          permCentroSel?.direccion ||
          selectedMantencion?.localidad ||
          permisoCentroSeleccionado?.localidad ||
          ''
      )
    );
    setPermResponsabilidad(editingMantencion ? selectedMantencion?.responsabilidad || '' : '');
    const asignados = Array.isArray(actividadAsignadaActiva?.tecnicos_asignados)
      ? actividadAsignadaActiva?.tecnicos_asignados || []
      : [];
    const tecnicoPrincipalAsignado = String(
      actividadAsignadaActiva?.encargado_principal?.nombre_encargado ||
        asignados?.[0]?.nombre_encargado ||
        ''
    ).trim();
    const tecnicoAyudanteAsignado = String(
      actividadAsignadaActiva?.encargado_ayudante?.nombre_encargado ||
        asignados?.[1]?.nombre_encargado ||
        ''
    ).trim();
    const extrasAsignados = asignados
      .map((t) => String(t?.nombre_encargado || '').trim())
      .filter((name) => !!name && name !== tecnicoPrincipalAsignado && name !== tecnicoAyudanteAsignado);
    setPermTecnico1(editingMantencion ? selectedMantencion?.tecnico_1 || '' : tecnicoPrincipalAsignado);
    setPermTecnico2(editingMantencion ? selectedMantencion?.tecnico_2 || '' : tecnicoAyudanteAsignado);
    setPermPuntosGpsList(parseGpsPoints(gpsBase));
    // Prioriza mantencion; si no tiene, hereda los sellos del permiso previo.
    setPermSellosList(parseSellos(sellosBase));
    setPermMedicionFaseNeutro(
      editingMantencion ? normalizeMeasureInput(selectedMantencion?.medicion_fase_neutro || '') : ''
    );
    setPermMedicionNeutroTierra(
      editingMantencion ? normalizeMeasureInput(selectedMantencion?.medicion_neutro_tierra || '') : ''
    );
    setPermHertz(editingMantencion ? normalizeMeasureInput(selectedMantencion?.hertz || '') : '');
    setPermDescripcionTrabajo(editingMantencion ? selectedMantencion?.descripcion_trabajo || '' : '');
    setPermEvidenciaFotos(editingMantencion ? parseEvidencePhotos(selectedMantencion?.evidencia_foto) : []);
    setPermFirmaTecnico1(editingMantencion ? selectedMantencion?.firma_tecnico_1 || '' : '');
    setPermFirmaTecnico2(editingMantencion ? selectedMantencion?.firma_tecnico_2 || '' : '');
    setPermRecepciona(editingMantencion ? selectedMantencion?.recepciona_nombre || '' : '');
    setPermRecepcionaRut(editingMantencion ? selectedMantencion?.recepciona_rut || '' : '');
    setPermFirmaRecepciona(editingMantencion ? selectedMantencion?.firma_recepciona || '' : '');
    const extrasFirmados = parseFirmasTecnicosAdicionales(selectedMantencion?.firmas_tecnicos_adicionales);
    const nombresFirmadosExtras = extrasFirmados.map((x) => String(x.nombre || '').trim()).filter(Boolean);
    const nombresFinalesExtras = editingMantencion
      ? (nombresFirmadosExtras.length ? nombresFirmadosExtras : extrasAsignados)
      : extrasAsignados;
    setTecnicosAsignadosExtra(nombresFinalesExtras);
    setFirmasTecnicosExtra(
      nombresFinalesExtras.map((nombre) => ({
        nombre,
        firma: extrasFirmados.find((x) => x.nombre === nombre)?.firma || '',
      }))
    );
    if (editingMantencion) {
      const checklistGuardado = parseMantencionChecklist(selectedMantencion?.checklist_equipos);
      if (checklistGuardado.length) {
        setMantencionChecklistEnabled(true);
        setMantencionEquiposChecklist(checklistGuardado);
      } else {
        setMantencionChecklistEnabled(false);
        setMantencionEquiposChecklist([]);
      }
    } else {
      setMantencionChecklistEnabled(false);
      setMantencionEquiposChecklist([]);
    }
  }, [
    mantencionEditandoId,
    mantencionEditandoSeleccionada,
    permisoCentroSeleccionado,
    permCentroSel,
    permisoContexto,
    actividadAsignadaActiva,
  ]);
  useEffect(() => {
    if (permisoContexto !== 'retiro') return;
    const base = permCentroSel || null;
    if (!base) return;
    const editingRetiro = !!retiroEditandoId && !!retiroEditandoSeleccionado;
    const selectedRetiro = retiroEditandoSeleccionado || null;
    const asignados = Array.isArray(actividadAsignadaActiva?.tecnicos_asignados)
      ? actividadAsignadaActiva?.tecnicos_asignados || []
      : [];
    const tecnicoPrincipalAsignado = String(
      actividadAsignadaActiva?.encargado_principal?.nombre_encargado ||
        asignados?.[0]?.nombre_encargado ||
        ''
    ).trim();
    const tecnicoAyudanteAsignado = String(
      actividadAsignadaActiva?.encargado_ayudante?.nombre_encargado ||
        asignados?.[1]?.nombre_encargado ||
        ''
    ).trim();
    const extrasAsignados = asignados
      .map((t) => String(t?.nombre_encargado || '').trim())
      .filter((name) => !!name && name !== tecnicoPrincipalAsignado && name !== tecnicoAyudanteAsignado);

    setPermFecha(editingRetiro ? toInputDate(selectedRetiro?.fecha_retiro) || todayInputDate() : todayInputDate());
    setPermFechaSalida('');
    setPermCorreoCentro(String(permCentroSel?.correo_centro || permCentroSel?.correo || ''));
    setPermTelefonoCentro(String(permCentroSel?.telefono || permCentroSel?.telefono_centro || ''));
    setPermRegion(String(permCentroSel?.area || permCentroSel?.region || ''));
    setPermLocalidad(String(permCentroSel?.ubicacion || permCentroSel?.localidad || permCentroSel?.direccion || ''));
    setPermTecnico1(editingRetiro ? selectedRetiro?.tecnico_1 || tecnicoPrincipalAsignado || '' : tecnicoPrincipalAsignado);
    setPermTecnico2(editingRetiro ? selectedRetiro?.tecnico_2 || tecnicoAyudanteAsignado || '' : tecnicoAyudanteAsignado);
    setPermFirmaTecnico1(editingRetiro ? selectedRetiro?.firma_tecnico_1 || '' : '');
    setPermFirmaTecnico2(editingRetiro ? selectedRetiro?.firma_tecnico_2 || '' : '');
    setPermRecepciona(editingRetiro ? selectedRetiro?.recepciona_nombre || '' : '');
    setPermRecepcionaRut(editingRetiro ? selectedRetiro?.recepciona_rut || '' : '');
    setPermFirmaRecepciona(editingRetiro ? selectedRetiro?.firma_recepciona || '' : '');
    setPermDescripcionTrabajo(editingRetiro ? selectedRetiro?.observacion || '' : '');
    const extrasFirmados = parseFirmasTecnicosAdicionales((selectedRetiro as any)?.firmas_tecnicos_adicionales);
    const nombresFirmadosExtras = extrasFirmados.map((x) => String(x.nombre || '').trim()).filter(Boolean);
    const nombresFinalesExtras = editingRetiro
      ? (nombresFirmadosExtras.length ? nombresFirmadosExtras : extrasAsignados)
      : extrasAsignados;
    setTecnicosAsignadosExtra(nombresFinalesExtras);
    setFirmasTecnicosExtra(
      nombresFinalesExtras.map((nombre) => ({
        nombre,
        firma: extrasFirmados.find((x) => x.nombre === nombre)?.firma || '',
      }))
    );
    setRetiroTipo((editingRetiro ? String(selectedRetiro?.tipo_retiro || '') : 'parcial') === 'completo' ? 'completo' : 'parcial');
    setRetiroEstado(
      (editingRetiro ? String(selectedRetiro?.estado_logistico || '') : 'en_transito') === 'en_transito'
        ? 'en_transito'
        : 'retirado_centro'
    );
  }, [retiroEditandoId, retiroEditandoSeleccionado, permCentroSel, permisoContexto, actividadAsignadaActiva]);

  useEffect(() => {
    if (permisoContexto !== 'retiro') return;
    if (!equiposCentro.length) {
      setRetiroEquiposChecklist([]);
      return;
    }

    const currentById = new Map<number, EquipoCentro>();
    equiposCentro.forEach((e) => {
      const id = Number(e.id_equipo || 0);
      if (id) currentById.set(id, e);
    });

    const fromRetiro = (retiroEditandoSeleccionado?.equipos || []).map((eq) => ({
      id_retiro_equipo: Number(eq.id_retiro_equipo || 0) || undefined,
      equipo_id: Number(eq.equipo_id || 0) || undefined,
      equipo_nombre: eq.equipo_nombre || currentById.get(Number(eq.equipo_id || 0))?.nombre || '',
      numero_serie:
        eq.numero_serie ||
        currentById.get(Number(eq.equipo_id || 0))?.numero_serie ||
        '',
      codigo: eq.codigo || currentById.get(Number(eq.equipo_id || 0))?.codigo || '',
      retirado: !!eq.retirado,
    }));

    if (fromRetiro.length) {
      const existentes = new Set(fromRetiro.map((r) => Number(r.equipo_id || 0)));
      const faltantes = equiposCentro
        .filter((e) => !existentes.has(Number(e.id_equipo || 0)))
        .map((e) => ({
          equipo_id: Number(e.id_equipo || 0) || undefined,
          equipo_nombre: e.nombre || '',
          numero_serie: e.numero_serie || '',
          codigo: e.codigo || '',
          retirado: false,
        }));
      setRetiroEquiposChecklist([...fromRetiro, ...faltantes]);
      return;
    }

    setRetiroEquiposChecklist(
      equiposCentro.map((e) => ({
        equipo_id: Number(e.id_equipo || 0) || undefined,
        equipo_nombre: e.nombre || '',
        numero_serie: e.numero_serie || '',
        codigo: e.codigo || '',
        retirado: false,
      }))
    );
  }, [equiposCentro, retiroEditandoSeleccionado, permisoContexto]);

  useEffect(() => {
    if (permisoContexto !== 'mantencion' || !mantencionChecklistEnabled) {
      setMantencionEquiposChecklist([]);
      return;
    }
    if (!equiposCentro.length) {
      setMantencionEquiposChecklist([]);
      return;
    }
    setMantencionEquiposChecklist((prev) => {
      const revisadosPrev = new Map<number, boolean>();
      const observacionesPrev = new Map<number, string>();
      prev.forEach((item) => {
        const id = Number(item.equipo_id || 0);
        if (id) {
          revisadosPrev.set(id, !!item.revisado);
          observacionesPrev.set(id, String(item.observacion || ''));
        }
      });
      return equiposCentro.map((e) => {
        const id = Number(e.id_equipo || 0) || undefined;
        return {
          equipo_id: id,
          equipo_nombre: e.nombre || '',
          numero_serie: e.numero_serie || '',
          codigo: e.codigo || '',
          revisado: id ? revisadosPrev.get(id) || false : false,
          observacion: id ? observacionesPrev.get(id) || '' : '',
        };
      });
    });
  }, [equiposCentro, permisoContexto, mantencionChecklistEnabled]);

  const resetForm = () => {
    setEditId(null);
    setClienteIdForm(null);
    setCentroIdForm(null);
    setBuscarCentroForm('');
    setFechaRegistro('');
    setCodigoPontonActa('');
    setRegion('');
    setLocalidad('');
    setTecnico1('');
    setFirmaTecnico1('');
    setTecnico2('');
    setFirmaTecnico2('');
    setRecepcionaNombre('');
    setFirmaRecepciona('');
    setEquiposConsiderados('');
    setCentroOrigenTraslado('');
    setFirmasTecnicosExtra([]);
    setFirmaExtraIndex(null);
  };

  const resetPermisoForm = () => {
    setPermFecha(todayInputDate());
    setPermFechaSalida('');
    setShowPermFechaPicker(false);
    setShowPermFechaSalidaPicker(false);
    setPermCorreoCentro('');
    setPermTelefonoCentro('');
    setPermBaseTierra('');
    setPermCantidadRadares('');
    setPermResponsabilidad('');
    setPermRegion('');
    setPermLocalidad('');
    setPermTecnico1('');
    setPermFirmaTecnico1('');
    setPermTecnico2('');
    setPermFirmaTecnico2('');
    setPermRecepciona('');
    setPermRecepcionaRut('');
    setPermFirmaRecepciona('');
    setPermPuntosGpsList([{ lat: '', lng: '' }]);
    setPermSellosList([{ ubicacion: '', numeroAnterior: '', numeroNuevo: '' }]);
    setPermMedicionFaseNeutro('');
    setPermMedicionNeutroTierra('');
    setPermHertz('');
    setPermDescripcionTrabajo('');
    setPermEvidenciaFotos([]);
    setRetiroTipo('parcial');
    setRetiroEstado('en_transito');
    setRetiroEquiposChecklist([]);
    setEvidenciaTargetIndex(null);
    setCambioEquipoEnabled(false);
    setEquipoCambioId(null);
    setSerieNuevaCambio('');
    setMantencionChecklistEnabled(false);
    setMantencionEquiposChecklist([]);
    setMantencionChecklistQuery('');
    setShowMantencionChecklistModal(false);
    setShowCambioEquipoModal(false);
  };

  const abrirScannerSerieCambio = async () => {
    if (!cameraPermission?.granted) {
      const req = await requestCameraPermission();
      if (!req.granted) {
        Alert.alert('Escaner', 'Debes autorizar la camara para escanear el codigo.');
        return;
      }
    }
    scannedSerieOnce.current = false;
    setShowSerieScannerModal(true);
  };

  const handleScanSerieCambio = ({ data }: { data: string }) => {
    if (!showSerieScannerModal || scannedSerieOnce.current) return;
    scannedSerieOnce.current = true;
    const raw = String(data || '').trim();
    if (!raw) return;
    const soloNumeros = raw.replace(/\D+/g, '');
    const serie = soloNumeros.length ? soloNumeros : raw;
    setSerieNuevaCambio(serie);
    setShowSerieScannerModal(false);
    setTimeout(() => {
      scannedSerieOnce.current = false;
    }, 250);
  };

  const nuevaActa = () => {
    setActividadAsignadaActiva(null);
    setTecnicosAsignadosExtra([]);
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

  const nuevoRetiro = () => {
    setActividadAsignadaActiva(null);
    setTecnicosAsignadosExtra([]);
    resetPermisoForm();
    setPermisoContexto('retiro');
    setRetiroEditandoId(null);
    setPermClienteId(null);
    setPermCentroId(null);
    setPermBuscarCentro('');
    setShowRetiroTipoModal(true);
  };

  const abrirActa = (acta: Acta) => {
    setEditId(Number(acta.id_acta_entrega || 0) || null);
    const centroId = Number(acta.centro_id || 0) || null;
    setCentroIdForm(centroId);
    setFechaRegistro(toInputDate(acta.fecha_registro));
    setCodigoPontonActa(String(acta.codigo_ponton || ''));
    setRegion(acta.region || '');
    setLocalidad(acta.localidad || '');
    setTecnico1(acta.tecnico_1 || '');
    setFirmaTecnico1(acta.firma_tecnico_1 || '');
    setTecnico2(acta.tecnico_2 || '');
    setFirmaTecnico2(acta.firma_tecnico_2 || '');
    const extrasFirmas = parseFirmasTecnicosAdicionales(acta.firmas_tecnicos_adicionales);
    setFirmasTecnicosExtra(extrasFirmas);
    setTecnicosAsignadosExtra(extrasFirmas.map((item) => item.nombre));
    setRecepcionaNombre(acta.recepciona_nombre || '');
    setFirmaRecepciona(acta.firma_recepciona || '');
    setEquiposConsiderados(acta.equipos_considerados || '');
    setCentroOrigenTraslado(acta.centro_origen_traslado || '');
    setTipoRegistroInstalacion(
      String(acta.tipo_instalacion || '').toLowerCase() === 'reapuntamiento' ? 'reapuntamiento' : 'instalacion'
    );
    setArmadoSeleccionadoId(Number(acta.armado_id || 0) || null);
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
      actividad_id: Number(actividadAsignadaActiva?.id_actividad || 0) || null,
      fecha_registro: fechaRegistro,
      codigo_ponton: codigoPontonActa || null,
      region,
      localidad,
      tecnico_1: tecnico1,
      firma_tecnico_1: firmaTecnico1,
      tecnico_2: tecnico2,
      firma_tecnico_2: firmaTecnico2,
      firmas_tecnicos_adicionales: firmasTecnicosExtra,
      recepciona_nombre: recepcionaNombre,
      firma_recepciona: firmaRecepciona,
      equipos_considerados: equiposConsiderados,
      centro_origen_traslado: centroOrigenTraslado,
      armado_id: armadoSeleccionadoId,
      tipo_instalacion: tipoRegistroInstalacion,
    };
    try {
      if (editId) await updateActaEntrega(editId, payload);
      else await createActaEntrega(payload);
      await cargarActas();
      await cargarActividadesAsignadas();
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

  const guardarVinculoArmado = async (armadoId: number | null) => {
    const targetActaId = Number(vinculoActaId || actaCentroSeleccionado?.id_acta_entrega || 0) || null;
    if (!targetActaId) {
      Alert.alert('Instalacion', 'No se encontro el acta para guardar la vinculacion.');
      return;
    }
    setSaving(true);
    try {
      const resp = await updateActaEntrega(targetActaId, { armado_id: armadoId });
      const armadoGuardado = Number(resp?.acta?.armado_id || 0) || null;
      if ((Number(armadoId || 0) || null) !== armadoGuardado) {
        Alert.alert(
          'Instalacion',
          'El backend no guardo la vinculacion. Revisa que este actualizado y que la columna armado_id exista en actas_entrega.'
        );
        return;
      }
      await cargarActas();
      setArmadoSeleccionadoId(armadoId);
      setShowArmadosModal(false);
      setVinculoActaId(null);
      if (permisoCompletado) {
        await marcarActividadFinalizadaSiCorresponde();
      }
      Alert.alert('Instalacion', 'Vinculacion guardada.');
    } catch (error: any) {
      const backendMsg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'No se pudo guardar la vinculacion.';
      Alert.alert('Instalacion', backendMsg);
    } finally {
      setSaving(false);
    }
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
    if (firmaTarget === 'tecnico_extra' && firmaExtraIndex !== null) {
      setFirmasTecnicosExtra((prev) =>
        prev.map((item, idx) => (idx === firmaExtraIndex ? { ...item, firma: signature } : item))
      );
    }
    if (firmaTarget === 'recepciona') setFirmaRecepciona(signature);
    if (firmaTarget === 'perm_recepciona') setPermFirmaRecepciona(signature);
    if (firmaTarget === 'perm_tecnico1') setPermFirmaTecnico1(signature);
    if (firmaTarget === 'perm_tecnico2') setPermFirmaTecnico2(signature);
    setFirmaModalVisible(false);
    setFirmaTarget(null);
    setFirmaExtraIndex(null);
  };

  const limpiarFirma = (
    target:
      | 'tecnico1'
      | 'tecnico2'
      | 'tecnico_extra'
      | 'recepciona'
      | 'perm_recepciona'
      | 'perm_tecnico1'
      | 'perm_tecnico2',
    extraIndex?: number
  ) => {
    if (target === 'tecnico1') setFirmaTecnico1('');
    if (target === 'tecnico2') setFirmaTecnico2('');
    if (target === 'tecnico_extra' && typeof extraIndex === 'number') {
      setFirmasTecnicosExtra((prev) =>
        prev.map((item, idx) => (idx === extraIndex ? { ...item, firma: '' } : item))
      );
    }
    if (target === 'recepciona') setFirmaRecepciona('');
    if (target === 'perm_recepciona') setPermFirmaRecepciona('');
    if (target === 'perm_tecnico1') setPermFirmaTecnico1('');
    if (target === 'perm_tecnico2') setPermFirmaTecnico2('');
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
  const handleActaFechaChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowActaFechaPicker(false);
    if (selectedDate) {
      setFechaRegistro(
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

        <View style={styles.card}>
          <View style={styles.assignedHeader}>
            <Text style={styles.sectionTitle}>Trabajos de terreno</Text>
            {loadingActividadesAsignadas ? <ActivityIndicator size="small" color="#1d4ed8" /> : null}
          </View>
          <Text style={styles.rowMeta}>
            {mostrarAsignadasCompletadas
              ? `Programados: ${actividadesProgramadas.length} | En proceso: ${actividadesEnProceso.length} | Completados: ${actividadesCompletadas.length}`
              : `Programados: ${actividadesProgramadas.length} | En proceso: ${actividadesEnProceso.length}`}
          </Text>

          {!loadingActividadesAsignadas && !actividadesAsignadasFiltradas.length ? (
            <Text style={styles.rowMeta}>No hay actividades asignadas para este modulo.</Text>
          ) : null}
          {!loadingActividadesAsignadas && !actividadesAsignadasFiltradas.length && !!actividadesAsignadas.length ? (
            <Text style={styles.rowMeta}>
              Tienes {actividadesAsignadas.length} actividad(es) asignada(s) en otro modulo.
            </Text>
          ) : null}

          {!!actividadesProgramadas.length ? (
            <Text style={styles.assignedSectionTitle}>Programados</Text>
          ) : null}
          {actividadesProgramadas.map((actividad, idx) => {
            const id = Number(actividad.id_actividad || 0);
            const centroNombre = String(actividad.centro?.nombre || `Centro ${actividad.centro_id || '-'}`);
            const clienteNombre = String(actividad.centro?.cliente || '-');
            const esActiva = Number(actividadAsignadaActiva?.id_actividad || 0) === id;
            return (
              <Pressable
                key={`prog-${id || idx}`}
                style={[styles.assignedItem, esActiva && styles.assignedItemActive]}
                onPress={() => aplicarActividadAsignada(actividad)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.assignedItemTitle}>{centroNombre}</Text>
                  <Text style={styles.assignedItemMeta}>
                    {String(actividad.area || '-')} | {clienteNombre} | {formatDate(actividad.fecha_inicio)}
                  </Text>
                </View>
                <View style={[styles.assignedActionPill, esActiva && styles.assignedActionPillActive]}>
                  <Ionicons
                    name={esActiva ? 'checkmark-circle' : 'play-circle-outline'}
                    size={14}
                    color={esActiva ? '#166534' : '#1d4ed8'}
                  />
                  <Text style={[styles.assignedActionText, esActiva && styles.assignedActionTextActive]}>
                    {esActiva ? 'Seleccionado' : 'Usar'}
                  </Text>
                </View>
              </Pressable>
            );
          })}

	          {mostrarAsignadasEnProceso && !!actividadesEnProceso.length ? (
	            <Text style={styles.assignedSectionTitle}>En proceso</Text>
	          ) : null}
	          {mostrarAsignadasEnProceso && actividadesEnProceso.map((actividad, idx) => {
            const id = Number(actividad.id_actividad || 0);
            const centroNombre = String(actividad.centro?.nombre || `Centro ${actividad.centro_id || '-'}`);
            const clienteNombre = String(actividad.centro?.cliente || '-');
            const esActiva = Number(actividadAsignadaActiva?.id_actividad || 0) === id;
            return (
              <Pressable
                key={`proc-${id || idx}`}
                style={[styles.assignedItem, styles.assignedItemProgress, esActiva && styles.assignedItemActive]}
                onPress={() => aplicarActividadAsignada(actividad)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.assignedItemTitle}>{centroNombre}</Text>
                  <Text style={styles.assignedItemMeta}>
                    {String(actividad.area || '-')} | {clienteNombre} | {formatDate(actividad.fecha_inicio)}
                  </Text>
                </View>
                <View style={[styles.assignedActionPill, styles.assignedActionPillProgress]}>
                  <Ionicons name="sync-outline" size={14} color="#92400e" />
                  <Text style={[styles.assignedActionText, styles.assignedActionTextProgress]}>Continuar</Text>
                </View>
              </Pressable>
            );
          })}

	          {mostrarAsignadasCompletadas && !!actividadesCompletadas.length ? (
	            <Text style={styles.assignedSectionTitle}>Completados</Text>
	          ) : null}
	          {mostrarAsignadasCompletadas && actividadesCompletadas.slice(0, 4).map((actividad, idx) => {
            const id = Number(actividad.id_actividad || 0);
            const centroNombre = String(actividad.centro?.nombre || `Centro ${actividad.centro_id || '-'}`);
            const clienteNombre = String(actividad.centro?.cliente || '-');
            return (
              <View key={`done-${id || idx}`} style={[styles.assignedItem, styles.assignedItemDone]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.assignedItemTitle}>{centroNombre}</Text>
                  <Text style={styles.assignedItemMeta}>
                    {String(actividad.area || '-')} | {clienteNombre} | {formatDate(actividad.fecha_inicio)}
                  </Text>
                </View>
                <View style={[styles.assignedActionPill, styles.assignedActionPillDone]}>
                  <Ionicons name="checkmark-circle" size={14} color="#166534" />
                  <Text style={[styles.assignedActionText, styles.assignedActionTextDone]}>Finalizado</Text>
                </View>
              </View>
            );
          })}
        </View>

        {moduloInforme === 'instalacion' && canCrearInstalacionManual && (
          <View style={styles.card}>
            <Text style={styles.label}>{nombreRegistroInstalacion}</Text>
            <Pressable
              style={styles.addInstallBtn}
              onPress={() => {
                // Nuevo ingreso manual: limpiar contexto previo y pedir tipo (instalacion/reapuntamiento).
                resetForm();
                resetPermisoForm();
                setEditId(null);
                setShowEditor(false);
                setShowPermisoModal(false);
                setShowRetiroChecklistModal(false);
                setMantencionEditandoId(null);
                setActividadAsignadaActiva(null);
                setTecnicosAsignadosExtra([]);
                setPermClienteId(null);
                setPermCentroId(null);
                setPermBuscarCentro('');
                setClienteIdForm(null);
                setCentroIdForm(null);
                setTipoInstalacion('acta_entrega');
                setShowInstalacionTipoModal(true);
              }}>
              <Ionicons name="add-circle-outline" size={16} color="#1d4ed8" />
              <Text style={styles.addInstallBtnText}>Agregar instalacion</Text>
            </Pressable>
          </View>
        )}

        {moduloInforme === 'instalacion' && instalacionesEnProceso.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Instalaciones en proceso</Text>
            {instalacionesEnProceso.map((item) => (
              <View key={`proc-inst-${item.actaId || item.centroId}`} style={[styles.installDoneCard, styles.installInProgressCard]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{item.centro}</Text>
                  <Text style={styles.rowSubtitle}>{item.cliente}</Text>
                  <View style={styles.installTypeBadgeRow}>
                    <View
                      style={[
                        styles.installTypeBadge,
                        item.tipoInstalacion === 'reapuntamiento'
                          ? styles.installTypeBadgeReap
                          : styles.installTypeBadgeInstalacion,
                      ]}>
                      <Ionicons
                        name={item.tipoInstalacion === 'reapuntamiento' ? 'locate-outline' : 'construct-outline'}
                        size={11}
                        color={item.tipoInstalacion === 'reapuntamiento' ? '#7c2d12' : '#1e3a8a'}
                      />
                      <Text
                        style={[
                          styles.installTypeBadgeText,
                          item.tipoInstalacion === 'reapuntamiento'
                            ? styles.installTypeBadgeTextReap
                            : styles.installTypeBadgeTextInstalacion,
                        ]}>
                        {item.tipoInstalacion === 'reapuntamiento' ? 'Reapuntamiento' : 'Instalacion'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.rowMeta}>
                    Acta: {formatDate(item.fechaActa)} | Permiso: Pendiente
                  </Text>
                </View>
                <View style={styles.rowActions}>
                  {item.actaId ? (
                    <Pressable
                      style={styles.actionBtn}
                      onPress={() => {
                        setTipoRegistroInstalacion(item.tipoInstalacion === 'reapuntamiento' ? 'reapuntamiento' : 'instalacion');
                        setTipoInstalacion('acta_entrega');
                        const acta = actas.find((a) => Number(a.id_acta_entrega || 0) === Number(item.actaId || 0));
                        if (acta) abrirActa(acta);
                      }}>
                      <Ionicons name="create-outline" size={16} color="#1d4ed8" />
                    </Pressable>
                  ) : null}
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
                      setPermisoContexto('instalacion');
                      setMantencionEditandoId(null);
                      setShowPermisoModal(true);
                    }}>
                    <Ionicons name="clipboard-outline" size={16} color="#1d4ed8" />
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, !item.hasArmadoVinculado && styles.actionBtnWarn]}
                    onPress={async () => {
                      setTipoRegistroInstalacion(item.tipoInstalacion === 'reapuntamiento' ? 'reapuntamiento' : 'instalacion');
                      const clientePorNombre = clientes.find(
                        (c) =>
                          String(c.nombre || c.razon_social || '').trim().toLowerCase() ===
                          String(item.cliente || '').trim().toLowerCase()
                      );
                      const clienteId = Number(clientePorNombre?.id_cliente ?? clientePorNombre?.id ?? 0) || null;
                      if (clienteId) setPermClienteId(clienteId);
                      setPermCentroId(item.centroId);
                      setMostrarInstalacionForm(true);
                      setTipoInstalacion('acta_entrega');
                      setArmadoSeleccionadoId(item.armadoId || null);
                      setVinculoActaId(item.actaId || null);
                      try {
                        const lista = await getArmados({ estado: 'finalizado', centro_id: item.centroId });
                        const arr = Array.isArray(lista) ? lista : [];
                        const finalizados = arr.filter(
                          (a) =>
                            String(a?.estado || '').toLowerCase() === 'finalizado' &&
                            Number(a?.centro_id || 0) === Number(item.centroId)
                        );
                        setArmadosFinalizadosCentro(finalizados);
                        if (!finalizados.length) {
                          Alert.alert('Instalacion', 'Este centro no tiene armados finalizados para vincular.');
                          return;
                        }
                        setShowArmadosModal(true);
                      } catch {
                        Alert.alert('Instalacion', 'No se pudieron cargar los armados finalizados.');
                      }
                    }}>
                    <Ionicons name="link-outline" size={16} color={!item.hasArmadoVinculado ? '#ffffff' : '#1d4ed8'} />
                  </Pressable>
                  <Ionicons name="time-outline" size={18} color="#d97706" />
                </View>
              </View>
            ))}
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
                    <View style={styles.installTypeBadgeRow}>
                      <View
                        style={[
                          styles.installTypeBadge,
                          item.tipoInstalacion === 'reapuntamiento'
                            ? styles.installTypeBadgeReap
                            : styles.installTypeBadgeInstalacion,
                        ]}>
                        <Ionicons
                          name={item.tipoInstalacion === 'reapuntamiento' ? 'locate-outline' : 'construct-outline'}
                          size={11}
                          color={item.tipoInstalacion === 'reapuntamiento' ? '#7c2d12' : '#1e3a8a'}
                        />
                        <Text
                          style={[
                            styles.installTypeBadgeText,
                            item.tipoInstalacion === 'reapuntamiento'
                              ? styles.installTypeBadgeTextReap
                              : styles.installTypeBadgeTextInstalacion,
                          ]}>
                          {item.tipoInstalacion === 'reapuntamiento' ? 'Reapuntamiento' : 'Instalacion'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.rowMeta}>
                      {item.tipoInstalacion === 'reapuntamiento' ? 'Reapuntamiento' : 'Instalacion'} | Acta: {formatDate(item.fechaActa)} | Permiso: {formatDate(item.fechaPermiso)}
                    </Text>
                  </View>
                <View style={styles.rowActions}>
                  {item.actaId ? (
                    <Pressable
                      style={styles.actionBtn}
                      onPress={() => {
                        setTipoRegistroInstalacion(item.tipoInstalacion === 'reapuntamiento' ? 'reapuntamiento' : 'instalacion');
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
	                      setPermisoContexto('instalacion');
	                      setMantencionEditandoId(null);
	                      setShowPermisoModal(true);
	                    }}>
                      <Ionicons name="clipboard-outline" size={16} color="#1d4ed8" />
                    </Pressable>
                  ) : null}
                  <Pressable
                    style={[styles.actionBtn, !item.hasArmadoVinculado && styles.actionBtnWarn]}
                    onPress={async () => {
                      setTipoRegistroInstalacion(item.tipoInstalacion === 'reapuntamiento' ? 'reapuntamiento' : 'instalacion');
                      const clientePorNombre = clientes.find(
                        (c) =>
                          String(c.nombre || c.razon_social || '').trim().toLowerCase() ===
                          String(item.cliente || '').trim().toLowerCase()
                      );
                      const clienteId = Number(clientePorNombre?.id_cliente ?? clientePorNombre?.id ?? 0) || null;
                      if (clienteId) setPermClienteId(clienteId);
                      setPermCentroId(item.centroId);
                      setMostrarInstalacionForm(true);
                      setTipoInstalacion('acta_entrega');
                      setArmadoSeleccionadoId(item.armadoId || null);
                      setVinculoActaId(item.actaId || null);
                      try {
                        const lista = await getArmados({ estado: 'finalizado', centro_id: item.centroId });
                        const arr = Array.isArray(lista) ? lista : [];
                        const finalizados = arr.filter(
                          (a) =>
                            String(a?.estado || '').toLowerCase() === 'finalizado' &&
                            Number(a?.centro_id || 0) === Number(item.centroId)
                        );
                        setArmadosFinalizadosCentro(finalizados);
                        if (!finalizados.length) {
                          Alert.alert('Instalacion', 'Este centro no tiene armados finalizados para vincular.');
                          return;
                        }
                        setShowArmadosModal(true);
                      } catch {
                        Alert.alert('Instalacion', 'No se pudieron cargar los armados finalizados.');
                      }
                    }}>
                    <Ionicons name="link-outline" size={16} color={!item.hasArmadoVinculado ? '#ffffff' : '#1d4ed8'} />
                  </Pressable>
                  <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                </View>
              </View>
            ))}
          </View>
        )}

        {moduloInforme === 'instalacion' && mostrarInstalacionForm && (
          <View style={styles.card}>
            <View style={styles.installHeaderRow}>
              <Text style={styles.label}>{nombreRegistroInstalacion}</Text>
              <Pressable
                style={styles.installCloseBtn}
                onPress={() => setMostrarInstalacionForm(false)}
              >
                <Ionicons name="close" size={14} color="#334155" />
                <Text style={styles.installCloseBtnText}>Cerrar</Text>
              </Pressable>
            </View>
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
                <Text style={[styles.stepText, actaCompletada && styles.stepTextDone]}>
                  {tipoRegistroInstalacion === 'reapuntamiento' ? 'Reap.' : 'Acta'}
                </Text>
              </View>
              <View style={styles.stepLine} />
              <View style={styles.stepItem}>
                <View style={[styles.stepDot, permisoCompletado && styles.stepDotDone]}>
                  <Ionicons name={permisoCompletado ? 'checkmark' : 'clipboard-outline'} size={12} color={permisoCompletado ? '#166534' : '#64748b'} />
                </View>
                <Text style={[styles.stepText, permisoCompletado && styles.stepTextDone]}>Permiso</Text>
              </View>
            </View>

            <View style={styles.installSummaryBox}>
              <View style={styles.installTypeBadgeRow}>
                <View
                  style={[
                    styles.installTypeBadge,
                    tipoRegistroInstalacion === 'reapuntamiento'
                      ? styles.installTypeBadgeReap
                      : styles.installTypeBadgeInstalacion,
                  ]}>
                  <Ionicons
                    name={tipoRegistroInstalacion === 'reapuntamiento' ? 'locate-outline' : 'construct-outline'}
                    size={11}
                    color={tipoRegistroInstalacion === 'reapuntamiento' ? '#7c2d12' : '#1e3a8a'}
                  />
                  <Text
                    style={[
                      styles.installTypeBadgeText,
                      tipoRegistroInstalacion === 'reapuntamiento'
                        ? styles.installTypeBadgeTextReap
                        : styles.installTypeBadgeTextInstalacion,
                    ]}>
                    {tipoRegistroInstalacion === 'reapuntamiento' ? 'Reapuntamiento' : 'Instalacion'}
                  </Text>
                </View>
              </View>
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
              <View style={styles.installStateRow}>
                <Text style={styles.installStateLabel}>Armado:</Text>
                <Text
                  style={[
                    styles.installStateValue,
                    armadoVinculado ? styles.installStateOk : styles.installStateWarn,
                  ]}>
                  {armadoVinculado
                    ? `${armadoVinculado.centro?.nombre || permCentroSel?.nombre || 'Centro'} (${formatDate(
                        armadoVinculado.fecha_cierre
                      )})`
                    : armadosFinalizadosCentro.length
                    ? 'Pendiente de vinculacion'
                    : 'Sin armados finalizados'}
                </Text>
              </View>
              <Pressable
                style={[
                  styles.linkArmadoBtn,
                  !instalacionSeleccionada && styles.linkArmadoBtnDisabled,
                ]}
                disabled={!instalacionSeleccionada}
                onPress={() => {
                  if (!instalacionSeleccionada) return;
                  if (!armadosFinalizadosCentro.length) {
                    Alert.alert('Instalacion', 'Este centro no tiene armados finalizados para vincular.');
                    return;
                  }
                  setVinculoActaId(Number(actaCentroSeleccionado?.id_acta_entrega || 0) || null);
                  setShowArmadosModal(true);
                }}>
                <Ionicons name="link-outline" size={14} color={instalacionSeleccionada ? '#1d4ed8' : '#94a3b8'} />
                <Text style={[styles.linkArmadoBtnText, !instalacionSeleccionada && styles.linkArmadoBtnTextDisabled]}>
                  Vincular armado
                </Text>
              </Pressable>
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
                <Text style={styles.saveBtnText}>Crear {nombreDocumentoActa.toLowerCase()}</Text>
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
                  {tipoRegistroInstalacion === 'reapuntamiento' ? 'Acta reap.' : 'Acta entrega'}
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
	                  setPermisoContexto('instalacion');
	                  setMantencionEditandoId(null);
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
                Paso 1: completa {nombreDocumentoActa}. Paso 2: se habilita Permiso de trabajo.
              </Text>
            ) : null}
            {actaCompletada && !permisoCompletado ? (
              <Text style={[styles.flowHint, styles.flowHintWarn]}>
                Solo falta completar Permiso de trabajo.
              </Text>
            ) : null}
          </View>
        )}

        {moduloInforme === 'mantencion' && !!permisosMantencion.length && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Mantenciones recientes</Text>
            {mantencionesRecientesVisibles.map((item) => (
              <View key={`mant-${item.id_mantencion_terreno || item.id_permiso_trabajo || item.centro_id}`} style={styles.installDoneCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{item.centro || `Centro ${item.centro_id}`}</Text>
                  <Text style={styles.rowSubtitle}>{item.empresa || item.cliente || '-'}</Text>
                  <Text style={styles.rowMeta}>Fecha: {formatDate(item.fecha_ingreso)}</Text>
                </View>
                <View style={styles.rowActions}>
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => {
                      const lista = parseRetiroEquipos(item?.equipos);
                      setRetiroChecklistReadOnly(lista);
                      setShowRetiroChecklistReadModal(true);
                    }}>
                    <Ionicons name="list-outline" size={16} color="#1d4ed8" />
                  </Pressable>
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => {
                      const actividadId = Number((item as any).actividad_id || 0) || null;
                      if (actividadId) {
                        const act = actividadesAsignadas.find((a) => Number(a.id_actividad || 0) === actividadId) || null;
                        if (act) setActividadAsignadaActiva(act);
                      }
                      const clientePorNombre = clientes.find(
                        (c) =>
                          String(c.nombre || c.razon_social || '').trim().toLowerCase() ===
                          String(item.empresa || item.cliente || '').trim().toLowerCase()
                      );
                      const clienteId = Number(clientePorNombre?.id_cliente ?? clientePorNombre?.id ?? 0) || null;
                      if (clienteId) setPermClienteId(clienteId);
                      setPermCentroId(Number(item.centro_id || 0) || null);
                      setPermisoContexto('mantencion');
                      setMantencionChecklistEnabled(true);
                      setMantencionEditandoId(Number(item.id_mantencion_terreno || 0) || null);
                      setCambioEquipoEnabled(false);
                      setEquipoCambioId(null);
                      setSerieNuevaCambio('');
                      setShowPermisoModal(true);
                    }}>
                    <Ionicons name="create-outline" size={16} color="#1d4ed8" />
                  </Pressable>
                  <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                </View>
              </View>
            ))}
            {permisosMantencion.length > 3 ? (
              <Pressable
                style={styles.moreMantBtn}
                onPress={() => setShowAllMantencionesRecientes((prev) => !prev)}>
                <Text style={styles.moreMantBtnText}>
                  {showAllMantencionesRecientes ? 'Mostrar menos' : 'Mostrar más'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {moduloInforme === 'retiro' && !!permisosRetiro.length && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Retiros recientes</Text>
            {retirosRecientesVisibles.map((item) => (
              <View key={`ret-${item.id_retiro_terreno || item.centro_id}`} style={styles.installDoneCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{item.centro || `Centro ${item.centro_id}`}</Text>
                  <Text style={styles.rowSubtitle}>{item.empresa || item.cliente || '-'}</Text>
                  <Text style={styles.rowMeta}>
                    Fecha: {formatDate(item.fecha_retiro)} | Tipo: {item.tipo_retiro === 'completo' ? 'Completo' : 'Parcial'}
                  </Text>
                </View>
                <View style={styles.rowActions}>
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => {
                      const clientePorNombre = clientes.find(
                        (c) =>
                          String(c.nombre || c.razon_social || '').trim().toLowerCase() ===
                          String(item.empresa || item.cliente || '').trim().toLowerCase()
                      );
                      const clienteId = Number(clientePorNombre?.id_cliente ?? clientePorNombre?.id ?? 0) || null;
                      if (clienteId) setPermClienteId(clienteId);
                      setPermCentroId(Number(item.centro_id || 0) || null);
                      setPermisoContexto('retiro');
                      setRetiroEditandoId(Number(item.id_retiro_terreno || 0) || null);
                      setShowPermisoModal(true);
                    }}>
                    <Ionicons name="create-outline" size={16} color="#1d4ed8" />
                  </Pressable>
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => {
                      const lista = parseRetiroEquipos(item?.equipos);
                      setRetiroChecklistReadOnly(lista);
                      setShowRetiroChecklistReadModal(true);
                    }}>
                    <Ionicons name="list-outline" size={16} color="#1d4ed8" />
                  </Pressable>
                  <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                  {canEliminarRetiroReciente ? (
                    <Pressable
                      style={styles.actionBtn}
                      onPress={() => {
                        const retiroId = Number(item.id_retiro_terreno || 0) || null;
                        if (!retiroId) return;
                        Alert.alert('Eliminar retiro', 'Quieres eliminar este retiro?', [
                          { text: 'Cancelar', style: 'cancel' },
                          {
                            text: 'Eliminar',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                await deleteRetiroTerreno(retiroId);
                                await cargarRetirosTerreno();
                              } catch {
                                Alert.alert('Informes', 'No se pudo eliminar el retiro.');
                              }
                            },
                          },
                        ]);
                      }}>
                      <Ionicons name="trash-outline" size={16} color="#dc2626" />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}
            {permisosRetiro.length > 3 ? (
              <Pressable
                style={styles.moreMantBtn}
                onPress={() => setShowAllRetirosRecientes((prev) => !prev)}>
                <Text style={styles.moreMantBtnText}>
                  {showAllRetirosRecientes ? 'Mostrar menos' : 'Mostrar mas'}
                </Text>
              </Pressable>
            ) : null}
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
              {actividadAsignadaActiva ? (
                <View style={styles.assignedLockedBox}>
                  <Ionicons name="calendar-outline" size={14} color="#1d4ed8" />
                  <Text style={styles.assignedLockedText}>
                    Actividad programada: {actividadAsignadaActiva.nombre_actividad || actividadAsignadaActiva.area || 'Trabajo asignado'}
                  </Text>
                </View>
              ) : null}
              <View style={styles.inputBlock}>
                <Text style={styles.selectLabel}>Cliente</Text>
                {bloquearClienteCentroActa ? (
                  <TextInput
                    style={[styles.input, styles.inputDisabled]}
                    editable={false}
                    value={clienteForm?.nombre || clienteForm?.razon_social || actividadAsignadaActiva.centro?.cliente || ''}
                  />
                ) : (
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
                )}
              </View>
              <View style={styles.inputBlock}>
                <Text style={styles.selectLabel}>Centro</Text>
                {centroSelForm ? (
                  <View style={styles.selectedCenterBox}>
                    <Text style={styles.selectedCenterText}>{centroSelForm.nombre || 'Centro seleccionado'}</Text>
                    {!bloquearClienteCentroActa ? (
                      <Pressable
                        style={styles.changeCenterBtn}
                        onPress={() => {
                          setCentroIdForm(null);
                          setBuscarCentroForm('');
                        }}>
                        <Text style={styles.changeCenterBtnText}>Cambiar</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : (
                  <>
                    {bloquearClienteCentroActa ? (
                      <TextInput
                        style={[styles.input, styles.inputDisabled]}
                        editable={false}
                        value={centroSelForm?.nombre || actividadAsignadaActiva?.centro?.nombre || ''}
                      />
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
                  </>
                )}
              </View>
              <View style={styles.row}>
                <View style={styles.inputCol}><Text style={styles.selectLabel}>Empresa</Text><TextInput style={[styles.input, styles.inputDisabled]} editable={false} value={clienteForm?.nombre || clienteForm?.razon_social || ''} /></View>
                <View style={styles.inputCol}>
                  <Text style={styles.selectLabel}>Codigo ponton</Text>
                  <TextInput style={styles.input} value={codigoPontonActa} onChangeText={setCodigoPontonActa} placeholder="Codigo ponton" />
                </View>
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
                {nombresBloqueadosPorProgramacion ? (
                  <View style={[styles.input, styles.inputDisabled, styles.nameReadonlyBox]}>
                    <Text style={styles.nameReadonlyText}>{tecnico1 || 'Sin tecnico asignado'}</Text>
                  </View>
                ) : (
                  <TextInput style={styles.input} value={tecnico1} onChangeText={setTecnico1} placeholder="Nombre tecnico 1" />
                )}
                <View style={styles.firmaActions}>
                  <Pressable style={styles.firmaBtn} onPress={() => abrirFirma('tecnico1')}><Text style={styles.firmaBtnText}>{firmaTecnico1 ? 'Editar firma' : 'Firmar'}</Text></Pressable>
                  {!!firmaTecnico1 && <Pressable style={styles.firmaClearBtn} onPress={() => limpiarFirma('tecnico1')}><Ionicons name="trash-outline" size={14} color="#dc2626" /></Pressable>}
                </View>
                {!!firmaTecnico1 && <Image source={{ uri: firmaTecnico1 }} style={styles.firmaPreview} resizeMode="contain" />}
              </View>

              <View style={styles.personBlock}>
                <Text style={styles.personTitle}>Tecnico 2</Text>
                {nombresBloqueadosPorProgramacion ? (
                  <View style={[styles.input, styles.inputDisabled, styles.nameReadonlyBox]}>
                    <Text style={styles.nameReadonlyText}>{tecnico2 || 'Sin ayudante asignado'}</Text>
                  </View>
                ) : (
                  <TextInput style={styles.input} value={tecnico2} onChangeText={setTecnico2} placeholder="Nombre tecnico 2" />
                )}
                <View style={styles.firmaActions}>
                  <Pressable style={styles.firmaBtn} onPress={() => abrirFirma('tecnico2')}><Text style={styles.firmaBtnText}>{firmaTecnico2 ? 'Editar firma' : 'Firmar'}</Text></Pressable>
                  {!!firmaTecnico2 && <Pressable style={styles.firmaClearBtn} onPress={() => limpiarFirma('tecnico2')}><Ionicons name="trash-outline" size={14} color="#dc2626" /></Pressable>}
                </View>
                {!!firmaTecnico2 && <Image source={{ uri: firmaTecnico2 }} style={styles.firmaPreview} resizeMode="contain" />}
              </View>
              {!!tecnicosAsignadosExtra.length && (
                <View style={styles.additionalTechWrap}>
                  <Text style={styles.additionalTechTitle}>Tecnicos adicionales asignados</Text>
                  {tecnicosAsignadosExtra.map((name, idx) => {
                    const firma = firmasTecnicosExtra[idx]?.firma || '';
                    return (
                      <View key={`${name}-${idx}`} style={styles.personBlock}>
                        <Text style={styles.personTitle}>{`Tecnico ${idx + 3}`}</Text>
                        <View style={[styles.input, styles.inputDisabled, styles.nameReadonlyBox]}>
                          <Text style={styles.nameReadonlyText}>{name}</Text>
                        </View>
                        <View style={styles.firmaActions}>
                          <Pressable
                            style={styles.firmaBtn}
                            onPress={() => {
                              setFirmaExtraIndex(idx);
                              abrirFirma('tecnico_extra');
                            }}>
                            <Text style={styles.firmaBtnText}>{firma ? 'Editar firma' : 'Firmar'}</Text>
                          </Pressable>
                          {!!firma && (
                            <Pressable style={styles.firmaClearBtn} onPress={() => limpiarFirma('tecnico_extra', idx)}>
                              <Ionicons name="trash-outline" size={14} color="#dc2626" />
                            </Pressable>
                          )}
                        </View>
                        {!!firma && <Image source={{ uri: firma }} style={styles.firmaPreview} resizeMode="contain" />}
                      </View>
                    );
                  })}
                </View>
              )}

              <View style={[styles.personBlock, styles.recepcionaBlock]}>
                <Text style={styles.personTitle}>Recepciona</Text>
                {nombresBloqueadosPorProgramacion && recepcionaNombre ? (
                  <View style={[styles.input, styles.inputDisabled, styles.nameReadonlyBox]}>
                    <Text style={styles.nameReadonlyText}>{recepcionaNombre}</Text>
                  </View>
                ) : (
                  <TextInput style={styles.input} value={recepcionaNombre} onChangeText={setRecepcionaNombre} placeholder="Nombre quien recepciona" />
                )}
                <View style={styles.firmaActions}>
                  <Pressable style={styles.firmaBtn} onPress={() => abrirFirma('recepciona')}><Text style={styles.firmaBtnText}>{firmaRecepciona ? 'Editar firma' : 'Firmar'}</Text></Pressable>
                  {!!firmaRecepciona && <Pressable style={styles.firmaClearBtn} onPress={() => limpiarFirma('recepciona')}><Ionicons name="trash-outline" size={14} color="#dc2626" /></Pressable>}
                </View>
                {!!firmaRecepciona && <Image source={{ uri: firmaRecepciona }} style={styles.firmaPreview} resizeMode="contain" />}
              </View>

              <View style={styles.row}>
                <View style={styles.inputCol}>
                  <Text style={styles.selectLabel}>Fecha registro</Text>
                  <Pressable style={styles.dateInput} onPress={() => setShowActaFechaPicker(true)}>
                    <Text style={styles.dateInputText}>{fechaRegistro || 'Seleccionar fecha'}</Text>
                    <Ionicons name="calendar-outline" size={16} color="#1d4ed8" />
                  </Pressable>
                </View>
              </View>
              {showActaFechaPicker && (
                <DateTimePicker
                  value={inputDateToDate(fechaRegistro)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleActaFechaChange}
                />
              )}
              <View style={styles.inputBlock}>
                <Text style={styles.selectLabel}>Los equipos considerados en este sistema, corresponden a</Text>
                <TextInput style={[styles.input, styles.textArea]} value={equiposConsiderados} onChangeText={setEquiposConsiderados} multiline textAlignVertical="top" />
              </View>
              <View style={styles.inputBlock}>
                <Text style={styles.selectLabel}>En caso de ser traslado, indicar centro de origen</Text>
                <TextInput
                  style={styles.input}
                  value={centroOrigenTraslado}
                  onChangeText={setCentroOrigenTraslado}
                  placeholder="Centro de origen (solo traslados)"
                />
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => { setShowEditor(false); resetForm(); }}><Text style={styles.cancelBtnText}>Cancelar</Text></Pressable>
              <Pressable style={styles.saveBtn} onPress={guardarActa} disabled={saving}><Text style={styles.saveBtnText}>{saving ? 'Guardando...' : 'Guardar'}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showArmadosModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Vincular armado finalizado</Text>
              <Pressable
                onPress={() => {
                  setShowArmadosModal(false);
                  setVinculoActaId(null);
                }}>
                <Ionicons name="close" size={20} color="#334155" />
              </Pressable>
            </View>
            <ScrollView style={styles.centerDropdown} nestedScrollEnabled>
              {armadosFinalizadosCentro.map((armado) => {
                const armadoId = Number(armado.id_armado || 0);
                const active = armadoId === Number(armadoSeleccionadoId || 0);
                return (
                  <Pressable
                    key={armadoId}
                    style={[styles.armadoOption, active && styles.armadoOptionActive]}
                    onPress={() => {
                      setArmadoSeleccionadoId(armadoId || null);
                    }}>
                    <Text style={[styles.armadoOptionTitle, active && styles.armadoOptionTitleActive]}>
                      {armado.centro?.nombre || permCentroSel?.nombre || `Armado #${armadoId}`}
                    </Text>
                    <Text style={styles.armadoOptionMeta}>
                      {armado.centro?.cliente || clientePermSel?.nombre || clientePermSel?.razon_social || '-'} | Cierre: {formatDate(armado.fecha_cierre)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelBtn}
                disabled={saving}
                onPress={() => guardarVinculoArmado(null)}>
                <Text style={styles.cancelBtnText}>Quitar vinculo</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} disabled={saving} onPress={() => guardarVinculoArmado(armadoSeleccionadoId)}>
                <Text style={styles.saveBtnText}>{saving ? 'Guardando...' : 'Guardar'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showRetiroTipoModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.tipoMantencionCard}>
            <Text style={styles.tipoMantencionTitle}>Tipo de retiro</Text>
            <Text style={styles.tipoMantencionHint}>Selecciona como deseas registrar este retiro</Text>

            <View style={styles.tipoMantencionActions}>
              <Pressable
                style={[styles.tipoMantencionBtn, styles.tipoMantencionBtnPrimary]}
                onPress={() => {
                  setRetiroTipo('parcial');
                  setShowRetiroTipoModal(false);
                  setShowPermisoModal(true);
                  setShowRetiroChecklistModal(true);
                }}>
                <Ionicons name="remove-circle-outline" size={16} color="#ffffff" />
                <Text style={[styles.tipoMantencionBtnText, styles.tipoMantencionBtnTextPrimary]}>
                  Parcial
                </Text>
              </Pressable>

              <Pressable
                style={styles.tipoMantencionBtn}
                onPress={() => {
                  setRetiroTipo('completo');
                  setShowRetiroTipoModal(false);
                  setShowPermisoModal(true);
                  setShowRetiroChecklistModal(true);
                }}>
                <Ionicons name="layers-outline" size={16} color="#1d4ed8" />
                <Text style={styles.tipoMantencionBtnText}>Completo</Text>
              </Pressable>
            </View>

            <Pressable
              style={styles.tipoMantencionCancel}
              onPress={() => setShowRetiroTipoModal(false)}>
              <Text style={styles.tipoMantencionCancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showInstalacionTipoModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.tipoMantencionCard}>
            <Text style={styles.tipoMantencionTitle}>Tipo de registro</Text>
            <Text style={styles.tipoMantencionHint}>Selecciona si registraras una instalacion o un reapuntamiento</Text>

            <View style={styles.tipoMantencionActions}>
              <Pressable
                style={[styles.tipoMantencionBtn, styles.tipoMantencionBtnPrimary]}
                onPress={() => {
                  setTipoRegistroInstalacion('instalacion');
                  setMostrarInstalacionForm(true);
                  setShowInstalacionTipoModal(false);
                }}>
                <Ionicons name="construct-outline" size={16} color="#ffffff" />
                <Text style={[styles.tipoMantencionBtnText, styles.tipoMantencionBtnTextPrimary]}>
                  Instalacion
                </Text>
              </Pressable>

              <Pressable
                style={styles.tipoMantencionBtn}
                onPress={() => {
                  setTipoRegistroInstalacion('reapuntamiento');
                  setMostrarInstalacionForm(true);
                  setShowInstalacionTipoModal(false);
                }}>
                <Ionicons name="locate-outline" size={16} color="#1d4ed8" />
                <Text style={styles.tipoMantencionBtnText}>Reapuntamiento</Text>
              </Pressable>
            </View>

            <Pressable
              style={styles.tipoMantencionCancel}
              onPress={() => setShowInstalacionTipoModal(false)}>
              <Text style={styles.tipoMantencionCancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showMantencionChecklistModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Checklist de equipos</Text>
              <Pressable onPress={() => setShowMantencionChecklistModal(false)}>
                <Ionicons name="close" size={20} color="#334155" />
              </Pressable>
            </View>
            <View style={styles.inputBlock}>
              <TextInput
                style={styles.input}
                value={mantencionChecklistQuery}
                onChangeText={setMantencionChecklistQuery}
                placeholder="Buscar equipo o serie..."
              />
              <View style={styles.firmaActions}>
                <Pressable
                  style={styles.firmaBtn}
                  onPress={() =>
                    setMantencionEquiposChecklist((prev) => prev.map((row) => ({ ...row, revisado: true })))
                  }>
                  <Text style={styles.firmaBtnText}>Marcar todos</Text>
                </Pressable>
                <Pressable
                  style={styles.firmaBtn}
                  onPress={() =>
                    setMantencionEquiposChecklist((prev) => prev.map((row) => ({ ...row, revisado: false })))
                  }>
                  <Text style={styles.firmaBtnText}>Limpiar</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.equipoListBox}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 300 }}>
                {mantencionChecklistFiltrado.map((eq) => {
                  const idx = Number(eq._idx || 0);
                  const id = Number(eq.equipo_id || 0) || idx + 1;
                  const revisado = !!eq.revisado;
                  return (
                    <View key={`mant-check-${id}`} style={[styles.equipoItem, revisado && styles.equipoItemActive]}>
                      <Pressable
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                        onPress={() =>
                          setMantencionEquiposChecklist((prev) =>
                            prev.map((row, i) => (i === idx ? { ...row, revisado: !row.revisado } : row))
                          )
                        }>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.equipoItemTitle, revisado && styles.equipoItemTitleActive]}>
                            {eq.equipo_nombre || `Equipo ${idx + 1}`}
                          </Text>
                          <Text style={styles.equipoItemMeta}>Serie: {eq.numero_serie || '-'}</Text>
                        </View>
                        <Ionicons
                          name={revisado ? 'checkbox' : 'square-outline'}
                          size={20}
                          color={revisado ? '#0ea5e9' : '#94a3b8'}
                        />
                      </Pressable>
                      {revisado ? (
                        <View style={{ marginTop: 8 }}>
                          <Text style={styles.miniFieldLabel}>Observacion (opcional)</Text>
                          <TextInput
                            style={styles.input}
                            value={String(eq.observacion || '')}
                            onChangeText={(value) =>
                              setMantencionEquiposChecklist((prev) =>
                                prev.map((row, i) => (i === idx ? { ...row, observacion: value } : row))
                              )
                            }
                            placeholder="Ej: conexion inestable / limpieza pendiente"
                            multiline
                          />
                        </View>
                      ) : null}
                    </View>
                  );
                })}
                {!mantencionChecklistFiltrado.length ? (
                  <Text style={styles.dropdownEmptyText}>Sin equipos para el filtro ingresado.</Text>
                ) : null}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showRetiroChecklistModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Checklist de equipos retirados</Text>
              <Pressable onPress={() => setShowRetiroChecklistModal(false)}>
                <Ionicons name="close" size={20} color="#334155" />
              </Pressable>
            </View>
            <View style={styles.inputBlock}>
              <View style={styles.firmaActions}>
                <Pressable
                  style={styles.firmaBtn}
                  onPress={() =>
                    setRetiroEquiposChecklist((prev) => prev.map((row) => ({ ...row, retirado: true })))
                  }>
                  <Text style={styles.firmaBtnText}>Marcar todos</Text>
                </Pressable>
                <Pressable
                  style={styles.firmaBtn}
                  onPress={() =>
                    setRetiroEquiposChecklist((prev) => prev.map((row) => ({ ...row, retirado: false })))
                  }>
                  <Text style={styles.firmaBtnText}>Limpiar</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.equipoListBox}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 320 }}>
                {retiroEquiposChecklist.map((eq, idx) => (
                  <Pressable
                    key={`ret-check-${Number(eq.equipo_id || 0) || idx}`}
                    style={[styles.equipoItem, !!eq.retirado && styles.equipoItemActive]}
                    onPress={() =>
                      setRetiroEquiposChecklist((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, retirado: !row.retirado } : row))
                      )
                    }>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.equipoItemTitle, !!eq.retirado && styles.equipoItemTitleActive]}>
                        {eq.equipo_nombre || `Equipo ${idx + 1}`}
                      </Text>
                      <Text style={styles.equipoItemMeta}>Serie: {eq.numero_serie || '-'} | Codigo: {eq.codigo || '-'}</Text>
                    </View>
                    <Ionicons
                      name={eq.retirado ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={eq.retirado ? '#16a34a' : '#64748b'}
                    />
                  </Pressable>
                ))}
                {!retiroEquiposChecklist.length ? (
                  <Text style={styles.dropdownEmptyText}>Sin equipos para este centro.</Text>
                ) : null}
              </ScrollView>
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowRetiroChecklistModal(false)}>
                <Text style={styles.cancelBtnText}>Cerrar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showRetiroChecklistReadModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Listado de equipos retirados</Text>
              <Pressable onPress={() => setShowRetiroChecklistReadModal(false)}>
                <Ionicons name="close" size={20} color="#334155" />
              </Pressable>
            </View>
            <Text style={[styles.rowMeta, { marginBottom: 8 }]}>
              Marcados: {retiroChecklistReadOnly.filter((eq) => !!eq.retirado).length}/{retiroChecklistReadOnly.length}
            </Text>
            <View style={styles.equipoListBox}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 340 }}>
                {retiroChecklistReadOnly.map((eq, idx) => (
                  <View key={`ret-read-${Number(eq.equipo_id || 0) || idx}`} style={styles.equipoItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.equipoItemTitle}>{eq.equipo_nombre || `Equipo ${idx + 1}`}</Text>
                      <Text style={styles.equipoItemMeta}>Serie: {eq.numero_serie || '-'} | Codigo: {eq.codigo || '-'}</Text>
                    </View>
                    <Ionicons
                      name={eq.retirado ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={eq.retirado ? '#16a34a' : '#94a3b8'}
                    />
                  </View>
                ))}
                {!retiroChecklistReadOnly.length ? (
                  <Text style={styles.dropdownEmptyText}>No hay equipos registrados en este retiro.</Text>
                ) : null}
              </ScrollView>
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowRetiroChecklistReadModal(false)}>
                <Text style={styles.cancelBtnText}>Cerrar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showCambioEquipoModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cambio de equipo</Text>
              <Pressable onPress={() => setShowCambioEquipoModal(false)}>
                <Ionicons name="close" size={20} color="#334155" />
              </Pressable>
            </View>
            <View style={{ gap: 8 }}>
              <Text style={styles.selectLabel}>Equipo del centro</Text>
              <View style={styles.equipoListBox}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 170 }}>
                  {equiposCentro.map((eq) => {
                    const id = Number(eq.id_equipo || 0);
                    const selected = Number(equipoCambioId || 0) === id;
                    return (
                      <Pressable
                        key={`eq-${id}`}
                        style={[styles.equipoItem, selected && styles.equipoItemActive]}
                        onPress={() => setEquipoCambioId(id)}>
                        <Text style={[styles.equipoItemTitle, selected && styles.equipoItemTitleActive]}>
                          {eq.nombre || `Equipo ${id}`}
                        </Text>
                        <Text style={styles.equipoItemMeta}>Serie: {eq.numero_serie || '-'}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
              <View style={styles.row}>
                <View style={styles.inputCol}>
                  <Text style={styles.selectLabel}>N° serie actual</Text>
                  <TextInput
                    style={[styles.input, styles.readonlyInput]}
                    value={String(equipoCambioSeleccionado?.numero_serie || '')}
                    editable={false}
                    placeholder="-"
                  />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.selectLabel}>N° serie nuevo</Text>
                  <View style={styles.scanSerieWrap}>
                    <TextInput
                      style={[styles.input, styles.scanSerieInput]}
                      value={serieNuevaCambio}
                      onChangeText={setSerieNuevaCambio}
                      placeholder="Manual o escaneo"
                    />
                    <Pressable style={styles.scanSerieBtn} onPress={abrirScannerSerieCambio}>
                      <Ionicons name="barcode-outline" size={17} color="#1d4ed8" />
                    </Pressable>
                  </View>
                </View>
              </View>
              <Pressable style={styles.checklistOpenBtn} onPress={() => setShowCambioEquipoModal(false)}>
                <Ionicons name="save-outline" size={15} color="#0b67d0" />
                <Text style={styles.checklistOpenBtnText}>Guardar seleccion</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showPermisoModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {permisoContexto === 'mantencion'
                  ? 'Informe de mantencion'
                  : permisoContexto === 'retiro'
                  ? 'Informe de retiro'
                  : 'Permiso de trabajo'}
              </Text>
              <Pressable
                onPress={() => {
                  setShowPermisoModal(false);
                  setShowRetiroChecklistModal(false);
                  setPermisoContexto('instalacion');
                  setMantencionEditandoId(null);
                  setRetiroEditandoId(null);
                  setCambioEquipoEnabled(false);
                  setEquipoCambioId(null);
                  setSerieNuevaCambio('');
                  setMantencionChecklistEnabled(false);
                  setShowMantencionChecklistModal(false);
                  setTipoInstalacion('acta_entrega');
                }}>
                <Ionicons name="close" size={20} color="#334155" />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {permisoContexto === 'instalacion' ? (
                <View style={styles.requirementBox}>
                  <View style={styles.requirementRow}>
                    <Ionicons
                      name={actaCentroSeleccionado ? 'checkmark-circle' : 'ellipse-outline'}
                      size={14}
                      color={actaCentroSeleccionado ? '#16a34a' : '#64748b'}
                    />
                    <Text style={styles.requirementText}>Acta de entrega {actaCentroSeleccionado ? 'completada' : 'pendiente'}</Text>
                  </View>
                  <View style={styles.requirementRow}>
                    <Ionicons name="ellipse-outline" size={14} color="#64748b" />
                    <Text style={styles.requirementText}>Permiso de trabajo pendiente</Text>
                  </View>
                  <Text style={styles.requirementHint}>
                    Para cerrar instalacion, el centro debe tener ambos documentos: Acta + Permiso de trabajo.
                  </Text>
                </View>
              ) : null}

              <View style={styles.centerInfoPanel}>
                <View style={styles.centerInfoHeader}>
                  <Ionicons name="business-outline" size={15} color="#1d4ed8" />
                  <Text style={styles.centerInfoTitle}>Informacion del centro</Text>
                </View>
                <View style={styles.row}>
                  <View style={styles.centerInfoItem}>
                    <Text style={styles.centerInfoLabel}>Cliente</Text>
                    <Text style={styles.centerInfoValue}>
                      {clientes.find((c) => Number(c.id_cliente ?? c.id ?? 0) === Number(permClienteId ?? 0))?.nombre || '-'}
                    </Text>
                  </View>
                  <View style={styles.centerInfoItem}>
                    <Text style={styles.centerInfoLabel}>Centro</Text>
                    <Text style={styles.centerInfoValue}>{permCentroSel?.nombre || '-'}</Text>
                  </View>
                </View>
                <View style={styles.row}>
                  <View style={styles.centerInfoItem}>
                    <Text style={styles.centerInfoLabel}>Codigo ponton</Text>
                    <Text style={styles.centerInfoValue}>{permCentroSel?.nombre_ponton || '-'}</Text>
                  </View>
                  <View style={styles.centerInfoItem}>
                    <Text style={styles.centerInfoLabel}>Region (Area)</Text>
                    <Text style={styles.centerInfoValue}>{permRegion || '-'}</Text>
                  </View>
                </View>
                <View style={styles.row}>
                  <View style={styles.centerInfoItem}>
                    <Text style={styles.centerInfoLabel}>Localidad</Text>
                    <Text style={styles.centerInfoValue}>{permLocalidad || '-'}</Text>
                  </View>
                  <View style={styles.centerInfoItem}>
                    <Text style={styles.centerInfoLabel}>Telefono centro</Text>
                    <Text style={styles.centerInfoValue}>{permTelefonoCentro || '-'}</Text>
                  </View>
                </View>
                <View style={styles.row}>
                  <View style={styles.centerInfoItem}>
                    <Text style={styles.centerInfoLabel}>Correo centro</Text>
                    <Text style={styles.centerInfoValue}>{permCorreoCentro || '-'}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.sectionDivider}>
                <View style={styles.sectionLine} />
                <Text style={styles.sectionTitleBlue}>Datos operativos</Text>
                <View style={styles.sectionLine} />
              </View>
              <View style={styles.row}>
                <View style={styles.inputCol}>
                  <Text style={styles.selectLabel}>Base tierra</Text>
                  <View style={styles.baseChoiceRow}>
                    <Pressable
                      style={[styles.baseChoiceBtn, permBaseTierra.toLowerCase() === 'si' && styles.baseChoiceBtnActive]}
                      onPress={() => setPermBaseTierra('si')}>
                      <Text style={[styles.baseChoiceText, permBaseTierra.toLowerCase() === 'si' && styles.baseChoiceTextActive]}>Si</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.baseChoiceBtn, permBaseTierra.toLowerCase() === 'no' && styles.baseChoiceBtnActive]}
                      onPress={() => setPermBaseTierra('no')}>
                      <Text style={[styles.baseChoiceText, permBaseTierra.toLowerCase() === 'no' && styles.baseChoiceTextActive]}>No</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.selectLabel}>Cantidad de radares</Text>
                  <TextInput
                    style={styles.input}
                    value={permCantidadRadares}
                    onChangeText={(v) => setPermCantidadRadares(v.replace(/\D/g, ''))}
                    placeholder="Ej: 2"
                    keyboardType="numeric"
                    maxLength={1}
                  />
                </View>
              </View>
              <View style={[styles.inputBlock, styles.rowTopGap]}>
                <Text style={styles.selectLabel}>Responsabilidad</Text>
                <View style={styles.baseChoiceRow}>
                  <Pressable
                    style={[styles.baseChoiceBtn, permResponsabilidad.toLowerCase() === 'orca' && styles.baseChoiceBtnActive]}
                    onPress={() => setPermResponsabilidad('orca')}>
                    <Text style={[styles.baseChoiceText, permResponsabilidad.toLowerCase() === 'orca' && styles.baseChoiceTextActive]}>Orca</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.baseChoiceBtn, permResponsabilidad.toLowerCase() === 'cliente' && styles.baseChoiceBtnActive]}
                    onPress={() => setPermResponsabilidad('cliente')}>
                    <Text style={[styles.baseChoiceText, permResponsabilidad.toLowerCase() === 'cliente' && styles.baseChoiceTextActive]}>Cliente</Text>
                  </Pressable>
                </View>
              </View>
              <View style={[styles.row, styles.rowTopGap]}>
                <View style={styles.inputCol}>
                  <Text style={styles.selectLabel}>Fecha ingreso</Text>
                  <Pressable style={styles.dateInput} onPress={() => setShowPermFechaPicker(true)}>
                    <Text style={styles.dateInputText}>{permFecha || 'Seleccionar fecha'}</Text>
                    <Ionicons name="calendar-outline" size={16} color="#1d4ed8" />
                  </Pressable>
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.selectLabel}>Fecha salida</Text>
                  <Pressable style={styles.dateInput} onPress={() => setShowPermFechaSalidaPicker(true)}>
                    <Text style={styles.dateInputText}>{permFechaSalida || 'Seleccionar fecha'}</Text>
                    <Ionicons name="calendar-outline" size={16} color="#1d4ed8" />
                  </Pressable>
                </View>
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
              <View style={styles.sectionDivider}>
                <View style={styles.sectionLine} />
                <Text style={styles.sectionTitleBlue}>GPS</Text>
                <View style={styles.sectionLine} />
              </View>
              <View style={styles.inputBlock}>
                {permPuntosGpsList.map((pt, idx) => (
                  <View key={`gps-${idx}`} style={styles.row}>
                    <View style={styles.inputCol}>
                      <TextInput
                        style={styles.input}
                        value={pt.lat}
                        onChangeText={(val) =>
                          setPermPuntosGpsList((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, lat: normalizeGpsPointInput(val) } : p))
                          )
                        }
                        placeholder={`Latitud ${idx + 1}`}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={styles.inputCol}>
                      <TextInput
                        style={styles.input}
                        value={pt.lng}
                        onChangeText={(val) =>
                          setPermPuntosGpsList((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, lng: normalizeGpsPointInput(val) } : p))
                          )
                        }
                        placeholder={`Longitud ${idx + 1}`}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    {permPuntosGpsList.length > 1 ? (
                      <Pressable
                        style={styles.actionBtnDelete}
                        onPress={() => setPermPuntosGpsList((prev) => prev.filter((_, i) => i !== idx))}>
                        <Ionicons name="close" size={16} color="#dc2626" />
                      </Pressable>
                    ) : null}
                  </View>
                ))}
                <Pressable
                  style={styles.firmaBtn}
                  onPress={() => setPermPuntosGpsList((prev) => [...prev, { lat: '', lng: '' }])}>
                  <Text style={styles.firmaBtnText}>+ Agregar punto GPS</Text>
                </Pressable>
              </View>
              <View style={styles.sectionDivider}>
                <View style={styles.sectionLine} />
                <Text style={styles.sectionTitleBlue}>Mediciones</Text>
                <View style={styles.sectionLine} />
              </View>
              <View style={styles.row}>
                <View style={styles.inputCol}>
                  <Text style={styles.selectLabel}>Medicion fase/neutro</Text>
                  <TextInput
                    style={styles.input}
                    value={permMedicionFaseNeutro}
                    onChangeText={(v) => setPermMedicionFaseNeutro(normalizeMeasureInput(v))}
                    placeholder="Ej: 220.5"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.selectLabel}>Medicion neutro/tierra</Text>
                  <TextInput
                    style={styles.input}
                    value={permMedicionNeutroTierra}
                    onChangeText={(v) => setPermMedicionNeutroTierra(normalizeMeasureInput(v))}
                    placeholder="Ej: 0.6"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <View style={styles.inputBlock}>
                <Text style={styles.selectLabel}>Hertz</Text>
                <TextInput
                  style={styles.input}
                  value={permHertz}
                  onChangeText={(v) => setPermHertz(normalizeMeasureInput(v))}
                  placeholder="Ej: 50.0"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.sectionDivider}>
                <View style={styles.sectionLine} />
                <Text style={styles.sectionTitleBlue}>Sellos</Text>
                <View style={styles.sectionLine} />
              </View>
              <View style={styles.inputBlock}>
                {permSellosList.map((sello, idx) => (
                  <View key={`sello-${idx}`} style={styles.selloCard}>
                    <Text style={styles.miniFieldLabel}>Ubicacion</Text>
                    <TextInput
                      style={styles.input}
                      value={sello.ubicacion}
                      onChangeText={(val) =>
                        setPermSellosList((prev) =>
                          prev.map((s, i) => (i === idx ? { ...s, ubicacion: val } : s))
                        )
                      }
                      placeholder={`Ubicacion sello ${idx + 1}`}
                    />
                    <View style={styles.row}>
                      <View style={styles.inputCol}>
                        <Text style={styles.miniFieldLabel}>Sello antiguo</Text>
                        <TextInput
                          style={styles.input}
                          value={sello.numeroAnterior}
                          onChangeText={(val) =>
                            setPermSellosList((prev) =>
                              prev.map((s, i) => (i === idx ? { ...s, numeroAnterior: normalizeSelloNumero(val) } : s))
                            )
                          }
                          placeholder={`Antiguo ${idx + 1}`}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.inputCol}>
                        <Text style={styles.miniFieldLabel}>Sello nuevo</Text>
                        <TextInput
                          style={styles.input}
                          value={sello.numeroNuevo}
                          onChangeText={(val) =>
                            setPermSellosList((prev) =>
                              prev.map((s, i) => (i === idx ? { ...s, numeroNuevo: normalizeSelloNumero(val) } : s))
                            )
                          }
                          placeholder={`Nuevo ${idx + 1}`}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                    {permSellosList.length > 1 ? (
                      <View style={{ alignItems: 'flex-end' }}>
                        <Pressable
                          style={styles.actionBtnDelete}
                          onPress={() => setPermSellosList((prev) => prev.filter((_, i) => i !== idx))}>
                          <Ionicons name="close" size={16} color="#dc2626" />
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                ))}
                <Pressable
                  style={styles.firmaBtn}
                  onPress={() => setPermSellosList((prev) => [...prev, { ubicacion: '', numeroAnterior: '', numeroNuevo: '' }])}>
                  <Text style={styles.firmaBtnText}>+ Agregar sello</Text>
                </Pressable>
              </View>
              {permisoContexto === 'retiro' ? (
                <View style={styles.inputBlock}>
                  <View style={styles.row}>
                    <View style={styles.inputCol}>
                      <Text style={styles.selectLabel}>Tipo de retiro</Text>
                      <View style={styles.baseChoiceRow}>
                        <Pressable
                          style={[styles.baseChoiceBtn, retiroTipo === 'parcial' && styles.baseChoiceBtnActive]}
                          onPress={() => {
                            setRetiroTipo('parcial');
                            setShowRetiroChecklistModal(true);
                          }}>
                          <Text style={[styles.baseChoiceText, retiroTipo === 'parcial' && styles.baseChoiceTextActive]}>Parcial</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.baseChoiceBtn, retiroTipo === 'completo' && styles.baseChoiceBtnActive]}
                          onPress={() => {
                            setRetiroTipo('completo');
                            setShowRetiroChecklistModal(true);
                          }}>
                          <Text style={[styles.baseChoiceText, retiroTipo === 'completo' && styles.baseChoiceTextActive]}>Completo</Text>
                        </Pressable>
                      </View>
                    </View>
                    <View style={styles.inputCol}>
                      <Text style={styles.selectLabel}>Estado</Text>
                      <View style={styles.baseChoiceRow}>
                        <Pressable
                          style={[styles.baseChoiceBtn, retiroEstado === 'retirado_centro' && styles.baseChoiceBtnActive]}
                          onPress={() => setRetiroEstado('retirado_centro')}>
                          <Text style={[styles.baseChoiceText, retiroEstado === 'retirado_centro' && styles.baseChoiceTextActive]}>Retirado</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.baseChoiceBtn, retiroEstado === 'en_transito' && styles.baseChoiceBtnActive]}
                          onPress={() => setRetiroEstado('en_transito')}>
                          <Text style={[styles.baseChoiceText, retiroEstado === 'en_transito' && styles.baseChoiceTextActive]}>Transito</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>

                  <View style={{ marginTop: 10, gap: 8 }}>
                    <Text style={styles.selectLabel}>Checklist de equipos</Text>
                    <Text style={styles.sectionHint}>
                      Seleccionados:{' '}
                      {retiroEquiposChecklist.filter((eq) => !!eq.retirado).length}/{retiroEquiposChecklist.length}
                    </Text>
                    <Pressable style={styles.checklistOpenBtn} onPress={() => setShowRetiroChecklistModal(true)}>
                      <Ionicons name="list-outline" size={15} color="#0b67d0" />
                      <Text style={styles.checklistOpenBtnText}>Abrir checklist</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
              {permisoContexto === 'mantencion' ? (
                <View style={styles.inputBlock}>
                  <Text style={styles.selectLabel}>Evidencia (1 a 3 fotos)</Text>
                  <View style={styles.firmaActions}>
                    <Pressable
                      style={styles.firmaBtn}
                      onPress={async () => {
                        if (permEvidenciaFotos.length >= 3) {
                          Alert.alert('Evidencia', 'Puedes adjuntar hasta 3 fotos.');
                          return;
                        }
                        if (!cameraPermission?.granted) {
                          const req = await requestCameraPermission();
                          if (!req.granted) {
                            Alert.alert('Evidencia', 'Debes autorizar la camara para capturar evidencia.');
                            return;
                          }
                        }
                        setEvidenciaTargetIndex(null);
                        setShowCameraModal(true);
                      }}>
                      <Text style={styles.firmaBtnText}>Agregar evidencia</Text>
                    </Pressable>
                  </View>
                  {permEvidenciaFotos.length ? (
                    <View style={styles.evidenciaGrid}>
                      {permEvidenciaFotos.map((foto, idx) => (
                        <View key={`ev-${idx}`} style={styles.evidenciaItem}>
                          <Image source={{ uri: foto }} style={styles.evidenciaPreview} resizeMode="cover" />
                          <View style={styles.evidenciaActions}>
                            <Pressable
                              style={styles.firmaBtn}
                              onPress={async () => {
                                if (!cameraPermission?.granted) {
                                  const req = await requestCameraPermission();
                                  if (!req.granted) {
                                    Alert.alert('Evidencia', 'Debes autorizar la camara para capturar evidencia.');
                                    return;
                                  }
                                }
                                setEvidenciaTargetIndex(idx);
                                setShowCameraModal(true);
                              }}>
                              <Text style={styles.firmaBtnText}>Reemplazar</Text>
                            </Pressable>
                            <Pressable
                              style={styles.firmaClearBtn}
                              onPress={() => setPermEvidenciaFotos((prev) => prev.filter((_, i) => i !== idx))}>
                              <Ionicons name="trash-outline" size={14} color="#dc2626" />
                            </Pressable>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.signatureEmptyText}>Sin evidencia</Text>
                  )}
                </View>
              ) : null}
              {permisoContexto === 'mantencion' ? (
                <View style={[styles.inputBlock, styles.checklistCard]}>
                  <View style={styles.rowBetween}>
                    <View style={styles.checklistTitleWrap}>
                      <Ionicons name="checkmark-done-outline" size={16} color="#0b67d0" />
                      <Text style={styles.sectionTitleBlue}>Checklist de equipos instalados</Text>
                    </View>
                    <Text style={styles.sectionHint}>
                      {mantencionChecklistEnabled
                        ? `${checklistRevisadosCount}/${mantencionEquiposChecklist.length} revisados`
                        : 'No activo'}
                    </Text>
                  </View>
                  <View style={styles.baseChoiceRow}>
                    <Pressable
                      style={[styles.baseChoiceBtn, !mantencionChecklistEnabled && styles.baseChoiceBtnActive]}
                      onPress={() => {
                        setMantencionChecklistEnabled(false);
                        setShowMantencionChecklistModal(false);
                      }}>
                      <Text style={[styles.baseChoiceText, !mantencionChecklistEnabled && styles.baseChoiceTextActive]}>
                        No
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.baseChoiceBtn, mantencionChecklistEnabled && styles.baseChoiceBtnActive]}
                      onPress={() => {
                        setMantencionChecklistEnabled(true);
                        setShowMantencionChecklistModal(true);
                      }}>
                      <Text style={[styles.baseChoiceText, mantencionChecklistEnabled && styles.baseChoiceTextActive]}>
                        Si
                      </Text>
                    </Pressable>
                  </View>
                  {mantencionChecklistEnabled ? (
                    checklistRevisadosCount > 0 ? (
                      <Pressable style={styles.checklistViewBtn} onPress={() => setShowMantencionChecklistModal(true)}>
                        <Ionicons name="eye-outline" size={15} color="#0b67d0" />
                        <Text style={styles.checklistViewBtnText}>Ver</Text>
                      </Pressable>
                    ) : (
                      <Pressable style={styles.checklistOpenBtn} onPress={() => setShowMantencionChecklistModal(true)}>
                        <Ionicons name="open-outline" size={15} color="#0b67d0" />
                        <Text style={styles.checklistOpenBtnText}>Abrir checklist</Text>
                      </Pressable>
                    )
                  ) : null}
                </View>
              ) : null}

                            {permisoContexto === 'mantencion' ? (
                <View style={[styles.inputBlock, styles.cambioEquipoCard]}>
                  <View style={styles.checklistTitleWrap}>
                    <Ionicons name="sync-outline" size={16} color="#0b67d0" />
                    <Text style={styles.sectionTitleBlue}>Cambio de equipo</Text>
                  </View>
                  <View style={[styles.baseChoiceRow, styles.choiceRowTop]}>
                    <Pressable
                      style={[styles.baseChoiceBtn, !cambioEquipoEnabled && styles.baseChoiceBtnActive]}
                      onPress={() => {
                        setCambioEquipoEnabled(false);
                        setShowCambioEquipoModal(false);
                        setEquipoCambioId(null);
                        setSerieNuevaCambio('');
                      }}>
                      <Text style={[styles.baseChoiceText, !cambioEquipoEnabled && styles.baseChoiceTextActive]}>
                        No
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.baseChoiceBtn, cambioEquipoEnabled && styles.baseChoiceBtnActive]}
                      onPress={() => {
                        setCambioEquipoEnabled(true);
                        setShowCambioEquipoModal(true);
                      }}>
                      <Text style={[styles.baseChoiceText, cambioEquipoEnabled && styles.baseChoiceTextActive]}>
                        Si
                      </Text>
                    </Pressable>
                  </View>
                  {cambioEquipoEnabled ? (
                    <View style={{ gap: 8 }}>
                      <Text style={styles.sectionHint}>
                        {equipoCambioSeleccionado
                          ? `Equipo: ${equipoCambioSeleccionado?.nombre || '-'} | Serie actual: ${equipoCambioSeleccionado?.numero_serie || '-'}`
                          : 'Selecciona en el modal el equipo que deseas cambiar.'}
                      </Text>
                      <Pressable style={styles.checklistOpenBtn} onPress={() => setShowCambioEquipoModal(true)}>
                        <Ionicons name="open-outline" size={15} color="#0b67d0" />
                        <Text style={styles.checklistOpenBtnText}>
                          {equipoCambioSeleccionado ? 'Ver cambio de equipo' : 'Seleccionar equipo'}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ) : null}
              <View style={[styles.inputBlock, styles.descripcionCard]}>
                <View style={styles.descripcionHeader}>
                  <Ionicons name="document-text-outline" size={16} color="#1d4ed8" />
                  <Text style={styles.descripcionLabel}>Descripcion del trabajo</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={permDescripcionTrabajo}
                  onChangeText={setPermDescripcionTrabajo}
                  placeholder="Escribe el resultado final de la mantencion..."
                  multiline
                  textAlignVertical="top"
                />
              </View>
              <View style={styles.sectionDivider}>
                <View style={styles.sectionLine} />
                <Text style={styles.sectionTitleBlue}>Cliente</Text>
                <View style={styles.sectionLine} />
              </View>
              <View style={[styles.inputBlock, styles.clienteSectionCard]}>
                <Text style={styles.clienteSectionHint}>
                  {permisoContexto === 'mantencion'
                    ? 'En mantencion los tecnicos y firmas se registran nuevamente.'
                    : permisoContexto === 'retiro'
                    ? 'En retiro los tecnicos y firmas se registran nuevamente.'
                    : 'Tecnicos desde acta. Firma de cliente se registra aqui.'}
                </Text>
                <View style={styles.row}>
                  <View style={styles.inputCol}>
                    <Text style={styles.selectLabel}>Recepciona</Text>
                    <TextInput
                      style={styles.input}
                      value={permRecepciona}
                      onChangeText={setPermRecepciona}
                      placeholder="Nombre recepciona"
                    />
                  </View>
                  <View style={styles.inputCol}>
                    <Text style={styles.selectLabel}>RUT recepciona</Text>
                    <TextInput
                      style={styles.input}
                      value={permRecepcionaRut}
                      onChangeText={setPermRecepcionaRut}
                      placeholder="Ej: 12345678-9"
                      autoCapitalize="none"
                    />
                  </View>
                </View>
                <View style={styles.inputBlock}>
                  <Text style={styles.signatureFieldLabel}>Firma recepciona</Text>
                  <View style={styles.firmaActions}>
                    <Pressable style={styles.firmaBtn} onPress={() => abrirFirma('perm_recepciona')}>
                      <Text style={styles.firmaBtnText}>{permFirmaRecepciona ? 'Editar firma' : 'Firmar'}</Text>
                    </Pressable>
                    {!!permFirmaRecepciona && (
                      <Pressable style={styles.firmaClearBtn} onPress={() => limpiarFirma('perm_recepciona')}>
                        <Ionicons name="trash-outline" size={14} color="#dc2626" />
                      </Pressable>
                    )}
                  </View>
                  {!!permFirmaRecepciona ? (
                    <Image source={{ uri: permFirmaRecepciona }} style={styles.firmaPreview} resizeMode="contain" />
                  ) : (
                    <Text style={styles.signatureEmptyText}>Sin firma</Text>
                  )}
                </View>
                {permisoContexto === 'mantencion' || permisoContexto === 'retiro' ? (
                  <>
                    <View style={styles.row}>
                      <View style={styles.inputCol}>
                        <Text style={styles.signatureFieldLabel}>Tecnico 1</Text>
                        <Text style={styles.signatureNameText}>{permTecnico1 || 'Sin nombre'}</Text>
                        <View style={styles.firmaActions}>
                          <Pressable style={styles.firmaBtn} onPress={() => abrirFirma('perm_tecnico1')}>
                            <Text style={styles.firmaBtnText}>{permFirmaTecnico1 ? 'Editar firma' : 'Firmar'}</Text>
                          </Pressable>
                          {!!permFirmaTecnico1 && (
                            <Pressable style={styles.firmaClearBtn} onPress={() => limpiarFirma('perm_tecnico1')}>
                              <Ionicons name="trash-outline" size={14} color="#dc2626" />
                            </Pressable>
                          )}
                        </View>
                        {permFirmaTecnico1 ? (
                          <Image source={{ uri: permFirmaTecnico1 }} style={styles.firmaPreview} resizeMode="contain" />
                        ) : (
                          <Text style={styles.signatureEmptyText}>Sin firma</Text>
                        )}
                      </View>
                      <View style={styles.inputCol}>
                        <Text style={styles.signatureFieldLabel}>Tecnico 2</Text>
                        <Text style={styles.signatureNameText}>{permTecnico2 || 'Sin nombre'}</Text>
                        <View style={styles.firmaActions}>
                          <Pressable style={styles.firmaBtn} onPress={() => abrirFirma('perm_tecnico2')}>
                            <Text style={styles.firmaBtnText}>{permFirmaTecnico2 ? 'Editar firma' : 'Firmar'}</Text>
                          </Pressable>
                          {!!permFirmaTecnico2 && (
                            <Pressable style={styles.firmaClearBtn} onPress={() => limpiarFirma('perm_tecnico2')}>
                              <Ionicons name="trash-outline" size={14} color="#dc2626" />
                            </Pressable>
                          )}
                        </View>
                        {permFirmaTecnico2 ? (
                          <Image source={{ uri: permFirmaTecnico2 }} style={styles.firmaPreview} resizeMode="contain" />
                        ) : (
                          <Text style={styles.signatureEmptyText}>Sin firma</Text>
                        )}
                      </View>
                    </View>
                    {!!tecnicosAsignadosExtra.length && (
                      <View style={[styles.additionalTechWrap, styles.rowTopGap]}>
                        <Text style={styles.additionalTechTitle}>Tecnicos adicionales</Text>
                        {tecnicosAsignadosExtra.map((name, idx) => {
                          const firma = firmasTecnicosExtra[idx]?.firma || '';
                          return (
                            <View key={`perm-cliente-${name}-${idx}`} style={styles.personBlock}>
                              <Text style={styles.signatureFieldLabel}>{`Tecnico ${idx + 3}`}</Text>
                              <Text style={styles.signatureNameText}>{name}</Text>
                              <View style={styles.firmaActions}>
                                <Pressable
                                  style={styles.firmaBtn}
                                  onPress={() => {
                                    setFirmaExtraIndex(idx);
                                    abrirFirma('tecnico_extra');
                                  }}>
                                  <Text style={styles.firmaBtnText}>{firma ? 'Editar firma' : 'Firmar'}</Text>
                                </Pressable>
                                {!!firma && (
                                  <Pressable style={styles.firmaClearBtn} onPress={() => limpiarFirma('tecnico_extra', idx)}>
                                    <Ionicons name="trash-outline" size={14} color="#dc2626" />
                                  </Pressable>
                                )}
                              </View>
                              {firma ? (
                                <Image source={{ uri: firma }} style={styles.firmaPreview} resizeMode="contain" />
                              ) : (
                                <Text style={styles.signatureEmptyText}>Sin firma</Text>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.row}>
                    <View style={styles.inputCol}>
                      <Text style={styles.signatureFieldLabel}>Tecnico 1</Text>
                      <Text style={styles.signatureNameText}>{permTecnico1 || actaCentroSeleccionado?.tecnico_1 || 'Sin nombre'}</Text>
                      {actaCentroSeleccionado?.firma_tecnico_1 ? (
                        <Image source={{ uri: actaCentroSeleccionado.firma_tecnico_1 }} style={styles.firmaPreview} resizeMode="contain" />
                      ) : (
                        <Text style={styles.signatureEmptyText}>Sin firma</Text>
                      )}
                    </View>
                    <View style={styles.inputCol}>
                      <Text style={styles.signatureFieldLabel}>Tecnico 2</Text>
                      <Text style={styles.signatureNameText}>{permTecnico2 || actaCentroSeleccionado?.tecnico_2 || 'Sin nombre'}</Text>
                      {actaCentroSeleccionado?.firma_tecnico_2 ? (
                        <Image source={{ uri: actaCentroSeleccionado.firma_tecnico_2 }} style={styles.firmaPreview} resizeMode="contain" />
                      ) : (
                        <Text style={styles.signatureEmptyText}>Sin firma</Text>
                      )}
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelBtn}
                disabled={saving}
                onPress={() => {
                  if (saving) return;
                  setShowPermisoModal(false);
                  setShowRetiroChecklistModal(false);
                  setPermisoContexto('instalacion');
                  setMantencionEditandoId(null);
                  setRetiroEditandoId(null);
                  setCambioEquipoEnabled(false);
                  setEquipoCambioId(null);
                  setSerieNuevaCambio('');
                  setTipoInstalacion('acta_entrega');
                }}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.saveBtn, saving && styles.ctaDisabled]}
                disabled={saving}
                onPress={async () => {
                  if (saving) return;
                  const titulo =
                    permisoContexto === 'mantencion'
                      ? 'Informe de mantencion'
                      : permisoContexto === 'retiro'
                      ? 'Informe de retiro'
                      : 'Permiso de trabajo';
                  if (permisoContexto === 'instalacion' && !actaCentroSeleccionado) {
                    Alert.alert(titulo, 'Primero debes tener un Acta de entrega para este centro.');
                    return;
                  }
                  if (!permCentroId) {
                    Alert.alert(titulo, 'Selecciona un centro.');
                    return;
                  }
                  if (!permFecha) {
                    Alert.alert(titulo, 'Fecha ingreso es obligatoria.');
                    return;
                  }
                  if (permisoContexto === 'retiro') {
                    const anyChecked = retiroEquiposChecklist.some((eq) => !!eq.retirado);
                    if (!anyChecked) {
                      Alert.alert(titulo, 'Marca al menos un equipo retirado en el checklist.');
                      return;
                    }
                  }
                  const gpsRows = permPuntosGpsList.map((p) => ({ lat: p.lat.trim(), lng: p.lng.trim() }));
                  const hasPartialGps = gpsRows.some((p) => (p.lat && !p.lng) || (!p.lat && p.lng));
                  if (hasPartialGps) {
                    Alert.alert(titulo, 'Completa latitud y longitud en cada punto GPS.');
                    return;
                  }
                  const selloRows = permSellosList.map((s) => ({
                    ubicacion: s.ubicacion.trim(),
                    numero_anterior: s.numeroAnterior.trim(),
                    numero_nuevo: s.numeroNuevo.trim(),
                  }));
                  const hasPartialSello = selloRows.some(
                    (s) =>
                      (!s.ubicacion && (s.numero_anterior || s.numero_nuevo)) ||
                      (s.ubicacion && !s.numero_anterior && !s.numero_nuevo)
                  );
                  if (hasPartialSello) {
                    Alert.alert(titulo, 'Completa ubicacion y al menos un numero de sello (antiguo o nuevo).');
                    return;
                  }
                  const sellosSerialized = JSON.stringify(
                    selloRows.filter((s) => s.ubicacion && (s.numero_anterior || s.numero_nuevo))
                  );
                  const gpsSerialized = gpsRows
                    .filter((p) => p.lat && p.lng)
                    .map((p) => `${p.lat},${p.lng}`)
                    .join(' | ');
                  if (permisoContexto === 'mantencion' && cambioEquipoEnabled) {
                    if (!equipoCambioId) {
                      Alert.alert(titulo, 'Selecciona el equipo a cambiar.');
                      return;
                    }
                    if (!serieNuevaCambio.trim()) {
                      Alert.alert(titulo, 'Ingresa N° serie nuevo.');
                      return;
                    }
                  }
                  if (permisoContexto === 'mantencion') {
                    const extrasConFirma = firmasTecnicosExtra.every(
                      (item) => !String(item?.nombre || '').trim() || !!String(item?.firma || '').trim()
                    );
                    const informeCompleto =
                      !!String(permDescripcionTrabajo || '').trim() &&
                      !!String(permRecepciona || '').trim() &&
                      !!String(permFirmaRecepciona || '').trim() &&
                      !!String(permFirmaTecnico1 || '').trim() &&
                      (!String(permTecnico2 || '').trim() || !!String(permFirmaTecnico2 || '').trim()) &&
                      extrasConFirma;
                    const confirmar = await new Promise<boolean>((resolve) => {
                      Alert.alert(
                        titulo,
                        informeCompleto
                          ? 'Se ve completo. ¿Deseas finalizar el informe ahora?'
                          : 'Aun faltan datos o firmas. ¿Deseas guardar como avance?',
                        [
                          { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
                          {
                            text: informeCompleto ? 'Finalizar' : 'Guardar avance',
                            onPress: () => resolve(true),
                          },
                        ]
                      );
                    });
                    if (!confirmar) return;
                  }
                  try {
                    setSaving(true);
                    const payload = {
                      centro_id: permCentroId,
                      acta_entrega_id:
                        permisoContexto === 'instalacion'
                          ? actaCentroSeleccionado?.id_acta_entrega || null
                          : null,
                      fecha_ingreso: permFecha,
                      fecha_salida: permFechaSalida || null,
                      correo_centro: permCorreoCentro || null,
                      telefono_centro: permTelefonoCentro || null,
                      base_tierra: permBaseTierra || null,
                      cantidad_radares: permCantidadRadares ? Number(permCantidadRadares) : null,
                      responsabilidad: permResponsabilidad || null,
                      region: permRegion || null,
                      localidad: permLocalidad || null,
                      tecnico_1: permTecnico1 || null,
                      firma_tecnico_1: permFirmaTecnico1 || null,
                      tecnico_2: permTecnico2 || null,
                      firma_tecnico_2: permFirmaTecnico2 || null,
                      recepciona_nombre: permRecepciona || null,
                      recepciona_rut: permRecepcionaRut || null,
                      firma_recepciona: permFirmaRecepciona || null,
                      puntos_gps: gpsSerialized || null,
                      sellos: sellosSerialized === '[]' ? null : sellosSerialized,
                      medicion_fase_neutro: normalizeMeasureInput(permMedicionFaseNeutro) || null,
                      medicion_neutro_tierra: normalizeMeasureInput(permMedicionNeutroTierra) || null,
                      hertz: normalizeMeasureInput(permHertz) || null,
                      descripcion_trabajo: permDescripcionTrabajo || null,
                      evidencia_foto:
                        permisoContexto === 'mantencion' ? serializeEvidencePhotos(permEvidenciaFotos) : null,
                      checklist_equipos:
                        permisoContexto === 'mantencion'
                          ? mantencionChecklistEnabled
                            ? JSON.stringify(
                                mantencionEquiposChecklist.map((item) => ({
                                  equipo_id: item.equipo_id || null,
                                  equipo_nombre: item.equipo_nombre || null,
                                  numero_serie: item.numero_serie || null,
                                  codigo: item.codigo || null,
                                  revisado: !!item.revisado,
                                  observacion: String(item.observacion || '').trim() || null,
                                }))
                              )
                            : null
                          : null,
                      firmas_tecnicos_adicionales:
                        permisoContexto === 'mantencion' || permisoContexto === 'retiro'
                          ? JSON.stringify(
                              firmasTecnicosExtra
                                .map((row) => ({
                                  nombre: String(row?.nombre || '').trim(),
                                  firma: String(row?.firma || ''),
                                }))
                                .filter((row) => !!row.nombre)
                            )
                          : null,
                    };
                    let result: any = null;
                    if (permisoContexto === 'instalacion' && permisoCentroSeleccionado?.id_permiso_trabajo) {
                      result = await updatePermisoTrabajo(permisoCentroSeleccionado.id_permiso_trabajo, payload);
                    } else if (permisoContexto === 'mantencion' && mantencionEditandoId) {
                      result = await updateMantencionTerreno(mantencionEditandoId, payload);
                    } else if (permisoContexto === 'mantencion') {
                      result = await createMantencionTerreno(payload);
                    } else if (permisoContexto === 'retiro' && retiroEditandoId) {
                      result = await updateRetiroTerreno(retiroEditandoId, {
                        centro_id: permCentroId,
                        fecha_retiro: permFecha,
                        tipo_retiro: retiroTipo,
                        estado_logistico: retiroEstado,
                        observacion: permDescripcionTrabajo || null,
                        tecnico_1: permTecnico1 || null,
                        firma_tecnico_1: permFirmaTecnico1 || null,
                        tecnico_2: permTecnico2 || null,
                        firma_tecnico_2: permFirmaTecnico2 || null,
                        recepciona_nombre: permRecepciona || null,
                        recepciona_rut: permRecepcionaRut || null,
                        firma_recepciona: permFirmaRecepciona || null,
                        equipos: retiroEquiposChecklist.map((eq) => ({
                          equipo_id: eq.equipo_id || null,
                          equipo_nombre: eq.equipo_nombre || null,
                          numero_serie: eq.numero_serie || null,
                          codigo: eq.codigo || null,
                          retirado: !!eq.retirado,
                        })),
                      });
                    } else if (permisoContexto === 'retiro') {
                      result = await createRetiroTerreno({
                        centro_id: permCentroId,
                        fecha_retiro: permFecha,
                        tipo_retiro: retiroTipo,
                        estado_logistico: retiroEstado,
                        observacion: permDescripcionTrabajo || null,
                        tecnico_1: permTecnico1 || null,
                        firma_tecnico_1: permFirmaTecnico1 || null,
                        tecnico_2: permTecnico2 || null,
                        firma_tecnico_2: permFirmaTecnico2 || null,
                        recepciona_nombre: permRecepciona || null,
                        recepciona_rut: permRecepcionaRut || null,
                        firma_recepciona: permFirmaRecepciona || null,
                        equipos: retiroEquiposChecklist.map((eq) => ({
                          equipo_id: eq.equipo_id || null,
                          equipo_nombre: eq.equipo_nombre || null,
                          numero_serie: eq.numero_serie || null,
                          codigo: eq.codigo || null,
                          retirado: !!eq.retirado,
                        })),
                      });
                    } else {
                      result = await createPermisoTrabajo(payload);
                    }

                    if (permisoContexto === 'mantencion' && cambioEquipoEnabled && equipoCambioId) {
                      const mantId =
                        Number(result?.mantencion?.id_mantencion_terreno || 0) ||
                        Number(mantencionEditandoId || 0);
                      if (mantId) {
                        const serieTrim = serieNuevaCambio.trim();
                        const soloNumerosSerie = serieTrim.replace(/\D+/g, '');
                        const codigoDerivado =
                          (soloNumerosSerie ? soloNumerosSerie.slice(0, 5) : serieTrim.slice(0, 5)) || undefined;
                        await createCambioEquipoMantencion(mantId, {
                          equipo_id: equipoCambioId,
                          armado_id: armadoVinculadoId || undefined,
                          serie_nueva: serieTrim || undefined,
                          codigo_nuevo: codigoDerivado,
                          tecnico: permTecnico1 || undefined,
                        });
                      }
                    }
                    await cargarPermisos();
                    await cargarMantencionesTerreno();
                    await cargarRetirosTerreno();
                    await cargarActividadesAsignadas();
                    if (permisoContexto === 'mantencion' || permisoContexto === 'retiro') {
                      await marcarActividadFinalizadaSiCorresponde();
                      setActividadAsignadaActiva(null);
                      setTecnicosAsignadosExtra([]);
                    } else if (permisoContexto === 'instalacion') {
                      const armadoVinculado = Number(actaCentroSeleccionado?.armado_id || armadoSeleccionadoId || 0) > 0;
                      if (armadoVinculado) {
                        await marcarActividadFinalizadaSiCorresponde();
                      }
                    }
                    // Refresca centros para no seguir mostrando telefono/correo antiguos en la misma sesion.
                    if (permClienteId) {
                      try {
                        const centrosActualizados = await fetchCentrosPorCliente(permClienteId);
                        setPermCentros(Array.isArray(centrosActualizados) ? centrosActualizados : []);
                      } catch {
                        setPermCentros((prev) =>
                          prev.map((c) =>
                            Number(c.id_centro ?? c.id ?? 0) === Number(permCentroId)
                              ? {
                                  ...c,
                                  telefono: permTelefonoCentro,
                                  correo_centro: permCorreoCentro,
                                  base_tierra:
                                    permBaseTierra.toLowerCase() === 'si'
                                      ? true
                                      : permBaseTierra.toLowerCase() === 'no'
                                      ? false
                                      : c.base_tierra,
                                  cantidad_radares: permCantidadRadares ? Number(permCantidadRadares) : c.cantidad_radares,
                                }
                              : c
                          )
                        );
                      }
                    }
                    setShowPermisoModal(false);
                    setShowRetiroChecklistModal(false);
                    setPermisoContexto('instalacion');
                    setMantencionEditandoId(null);
                    setRetiroEditandoId(null);
                    setTipoInstalacion('acta_entrega');
                    if (permisoContexto === 'instalacion') {
                      setMostrarInstalacionForm(false);
                    }
                    const extrasConFirmaOk = firmasTecnicosExtra.every(
                      (item) => !String(item?.nombre || '').trim() || !!String(item?.firma || '').trim()
                    );
                    const informeCompletoOk =
                      !!String(permDescripcionTrabajo || '').trim() &&
                      !!String(permRecepciona || '').trim() &&
                      !!String(permFirmaRecepciona || '').trim() &&
                      !!String(permFirmaTecnico1 || '').trim() &&
                      (!String(permTecnico2 || '').trim() || !!String(permFirmaTecnico2 || '').trim()) &&
                      extrasConFirmaOk;
                    Alert.alert(
                      titulo,
                      permisoContexto === 'mantencion'
                        ? informeCompletoOk
                          ? 'Informe finalizado y guardado.'
                          : 'Avance guardado. Puedes continuar despues.'
                        : 'Guardado correctamente.'
                    );
                  } catch (error: any) {
                    const backendMsg =
                      error?.response?.data?.error ||
                      error?.response?.data?.message ||
                      error?.message ||
                      'No se pudo guardar el permiso de trabajo.';
                    Alert.alert(titulo, backendMsg);
                  } finally {
                    setSaving(false);
                  }
                }}>
                <Text style={styles.saveBtnText}>{saving ? 'Guardando...' : 'Guardar'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showSerieScannerModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.cameraModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Escanear N° serie</Text>
              <Pressable
                onPress={() => {
                  scannedSerieOnce.current = false;
                  setShowSerieScannerModal(false);
                }}>
                <Ionicons name="close" size={20} color="#334155" />
              </Pressable>
            </View>
            <View style={styles.cameraWrap}>
              {cameraPermission?.status !== 'granted' ? (
                <Text style={styles.signatureEmptyText}>Sin permiso de cámara.</Text>
              ) : (
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  onBarcodeScanned={showSerieScannerModal ? handleScanSerieCambio : undefined}
                />
              )}
              <View pointerEvents="none" style={styles.scanFrame} />
            </View>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => {
                  scannedSerieOnce.current = false;
                  setShowSerieScannerModal(false);
                }}>
                <Text style={styles.cancelBtnText}>Cerrar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showCameraModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.cameraModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Capturar evidencia</Text>
              <Pressable onPress={() => { setEvidenciaTargetIndex(null); setShowCameraModal(false); }}>
                <Ionicons name="close" size={20} color="#334155" />
              </Pressable>
            </View>
            <View style={styles.cameraWrap}>
              <CameraView
                ref={(r) => {
                  cameraRef.current = r;
                }}
                style={StyleSheet.absoluteFill}
                facing={cameraFacing}
              />
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setCameraFacing((f) => (f === 'back' ? 'front' : 'back'))}>
                <Text style={styles.cancelBtnText}>Girar</Text>
              </Pressable>
              <Pressable
                style={styles.saveBtn}
                onPress={async () => {
                  try {
                    const photo = await cameraRef.current?.takePictureAsync({ base64: true, quality: 0.5 });
                    const newPhoto = photo?.base64 ? `data:image/jpeg;base64,${photo.base64}` : photo?.uri || '';
                    if (!newPhoto) {
                      Alert.alert('Evidencia', 'No se pudo capturar la foto.');
                      return;
                    }
                    setPermEvidenciaFotos((prev) => {
                      if (evidenciaTargetIndex !== null && evidenciaTargetIndex >= 0 && evidenciaTargetIndex < prev.length) {
                        const next = [...prev];
                        next[evidenciaTargetIndex] = newPhoto;
                        return next;
                      }
                      if (prev.length >= 3) return prev;
                      return [...prev, newPhoto];
                    });
                    setEvidenciaTargetIndex(null);
                    setShowCameraModal(false);
                  } catch {
                    Alert.alert('Evidencia', 'No se pudo capturar la foto.');
                  }
                }}>
                <Text style={styles.saveBtnText}>Capturar</Text>
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
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowTopGap: { marginTop: 8 },
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
  linkArmadoBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  linkArmadoBtnDisabled: {
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  linkArmadoBtnText: { color: '#1d4ed8', fontWeight: '700', fontSize: 12.5 },
  linkArmadoBtnTextDisabled: { color: '#94a3b8' },
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
  toggleSeg: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
  },
  toggleOption: {
    minWidth: 56,
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleOptionActive: {
    backgroundColor: '#dbeafe',
  },
  toggleOptionText: { color: '#475569', fontWeight: '700', fontSize: 13.5 },
  toggleOptionTextActive: { color: '#1d4ed8' },
  equipoListBox: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 10,
    backgroundColor: '#f8fbff',
    padding: 6,
  },
  equipoItem: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  equipoItemActive: {
    borderColor: '#1d4ed8',
    backgroundColor: '#dbeafe',
  },
  equipoItemTitle: { color: '#1d4ed8', fontWeight: '800', fontSize: 12.5 },
  equipoItemTitleActive: { color: '#1e3a8a' },
  equipoItemMeta: { marginTop: 2, color: '#64748b', fontSize: 11.5, fontWeight: '600' },
  chipsRow: { gap: 6, paddingVertical: 2 },
  chip: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: { borderColor: '#1d4ed8', backgroundColor: '#dbeafe' },
  chipText: { color: '#1d4ed8', fontWeight: '700', fontSize: 12 },
  chipTextActive: { color: '#1e3a8a' },
  readonlyInput: { backgroundColor: '#f8fafc', color: '#475569' },
  moreMantBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    backgroundColor: '#eef2ff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  moreMantBtnText: { color: '#1e40af', fontWeight: '800', fontSize: 12.5 },
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
  installInProgressCard: {
    borderColor: '#fcd34d',
    backgroundColor: '#fffbeb',
  },
  installTypeBadgeRow: {
    marginTop: 6,
    marginBottom: 2,
    alignItems: 'flex-start',
  },
  installTypeBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  installTypeBadgeInstalacion: {
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
  },
  installTypeBadgeReap: {
    borderColor: '#fed7aa',
    backgroundColor: '#fff7ed',
  },
  installTypeBadgeText: {
    fontWeight: '800',
    fontSize: 11.5,
  },
  installTypeBadgeTextInstalacion: {
    color: '#1e3a8a',
  },
  installTypeBadgeTextReap: {
    color: '#7c2d12',
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
  miniFieldLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
  pillsRow: { gap: 8, paddingRight: 8 },
  pill: { borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  pillActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  pillText: { color: '#1d4ed8', fontWeight: '700', fontSize: 12 },
  pillTextActive: { color: '#fff' },
  inputCol: { flex: 1, gap: 6 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, color: '#0f172a', fontWeight: '600', backgroundColor: '#fff' },
  scanSerieWrap: { position: 'relative' },
  scanSerieInput: { paddingRight: 52 },
  scanSerieBtn: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 30,
    height: 30,
    borderWidth: 1,
    borderColor: '#38bdf8',
    backgroundColor: '#bae6fd',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  installHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  installCloseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  installCloseBtnText: { color: '#334155', fontSize: 12, fontWeight: '700' },
  assignedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  assignedSectionTitle: { color: '#334155', fontWeight: '800', fontSize: 12.5, marginTop: 4, textTransform: 'uppercase' },
  assignedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fbff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginTop: 6,
  },
  assignedItemActive: {
    borderColor: '#86efac',
    backgroundColor: '#f0fdf4',
  },
  assignedItemProgress: {
    borderColor: '#fed7aa',
    backgroundColor: '#fff7ed',
  },
  assignedItemDone: {
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
  },
  assignedItemTitle: { color: '#0f172a', fontWeight: '800', fontSize: 13 },
  assignedItemMeta: { color: '#64748b', fontWeight: '600', fontSize: 11.5, marginTop: 2 },
  assignedActionPill: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  assignedActionPillActive: {
    borderColor: '#86efac',
    backgroundColor: '#dcfce7',
  },
  assignedActionPillProgress: {
    borderColor: '#fcd34d',
    backgroundColor: '#fef3c7',
  },
  assignedActionPillDone: {
    borderColor: '#86efac',
    backgroundColor: '#dcfce7',
  },
  assignedActionText: { color: '#1d4ed8', fontWeight: '800', fontSize: 11.5 },
  assignedActionTextActive: { color: '#166534' },
  assignedActionTextProgress: { color: '#92400e' },
  assignedActionTextDone: { color: '#166534' },
  assignedLockedBox: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  assignedLockedText: { color: '#1e40af', fontWeight: '700', flex: 1, fontSize: 12 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1d4ed8', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 },
  newBtnText: { color: '#fff', fontWeight: '700', fontSize: 12.5 },
  rowItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eef2f7' },
  rowTitle: { color: '#0f172a', fontWeight: '800' },
  rowSubtitle: { color: '#334155', fontWeight: '700', marginTop: 2 },
  rowMeta: { color: '#64748b', fontSize: 12, marginTop: 1 },
  rowActions: { flexDirection: 'row', gap: 6 },
  actionBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  actionBtnWarn: { borderColor: '#dc2626', backgroundColor: '#ef4444' },
  actionBtnDelete: {
    width: 30,
    height: 30,
    borderWidth: 1,
    borderColor: '#ef4444',
    backgroundColor: '#fee2e2',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selloCard: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 10,
    backgroundColor: '#f8fbff',
    padding: 8,
    gap: 6,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', padding: 12 },
  modalCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#dbeafe', maxHeight: '92%', padding: 12, gap: 10 },
  tipoMantencionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 14,
    gap: 10,
    shadowColor: '#0f172a',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  tipoMantencionTitle: { color: '#0f172a', fontWeight: '800', fontSize: 17 },
  tipoMantencionHint: { color: '#64748b', fontWeight: '600', fontSize: 12.5 },
  tipoMantencionActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  tipoMantencionBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  tipoMantencionBtnPrimary: {
    borderColor: '#1d4ed8',
    backgroundColor: '#1d4ed8',
  },
  tipoMantencionBtnText: { color: '#1d4ed8', fontWeight: '800', fontSize: 13 },
  tipoMantencionBtnTextPrimary: { color: '#ffffff' },
  tipoMantencionCancel: { alignSelf: 'flex-end', paddingHorizontal: 8, paddingVertical: 4 },
  tipoMantencionCancelText: { color: '#64748b', fontWeight: '700' },
  signatureModalCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#dbeafe', height: '72%', padding: 12, gap: 10 },
  cameraModalCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#dbeafe', height: '78%', padding: 12, gap: 10 },
  signatureWrap: { flex: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: '#fff' },
  cameraWrap: { flex: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: '#000', position: 'relative' },
  scanFrame: {
    position: 'absolute',
    top: '28%',
    left: '12%',
    right: '12%',
    height: 140,
    borderWidth: 2,
    borderColor: '#60a5fa',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 8 },
  modalTitle: { color: '#0f172a', fontWeight: '800', fontSize: 16 },
  checklistCard: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    backgroundColor: '#f0f8ff',
    padding: 12,
    marginTop: 4,
  },
  cambioEquipoCard: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    backgroundColor: '#f4faff',
    padding: 12,
    marginTop: 4,
  },
  checklistTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  choiceRowTop: { marginTop: 6 },
  checklistToggleWrap: { marginTop: 6, marginBottom: 2 },
  checklistOpenBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: '#dbeafe',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  checklistOpenBtnText: { color: '#0b67d0', fontWeight: '800', fontSize: 12.5 },
  checklistViewBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  checklistViewBtnText: { color: '#0b67d0', fontWeight: '800', fontSize: 12 },
  centerInfoPanel: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    backgroundColor: '#f8fbff',
    padding: 10,
    gap: 8,
    marginBottom: 8,
  },
  centerInfoHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  centerInfoTitle: {
    color: '#1d4ed8',
    fontSize: 12.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  centerInfoItem: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 9,
    paddingVertical: 8,
    gap: 3,
  },
  centerInfoLabel: {
    color: '#64748b',
    fontSize: 10.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  centerInfoValue: { color: '#0f172a', fontSize: 12.5, fontWeight: '700' },
  inputBlock: { gap: 6, marginBottom: 8 },
  descripcionCard: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    backgroundColor: '#f8fbff',
    padding: 10,
  },
  descripcionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  descripcionLabel: {
    color: '#1d4ed8',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  sectionDivider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 6 },
  sectionLine: { flex: 1, height: 1, backgroundColor: '#bfdbfe' },
  sectionTitleBlue: { color: '#1d4ed8', fontWeight: '800', fontSize: 13.5, letterSpacing: 0.4 },
  baseChoiceRow: { flexDirection: 'row', gap: 8 },
  baseChoiceBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseChoiceBtnActive: { borderColor: '#1d4ed8', backgroundColor: '#eff6ff' },
  baseChoiceText: { color: '#475569', fontWeight: '700' },
  baseChoiceTextActive: { color: '#1d4ed8' },
  sectionHint: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  textArea: { minHeight: 88 },
  centerDropdown: { maxHeight: 180, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, backgroundColor: '#fff' },
  centerOption: { paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eef2f7' },
  centerOptionActive: { backgroundColor: '#eff6ff' },
  centerOptionText: { color: '#0f172a', fontWeight: '600' },
  centerOptionTextActive: { color: '#1d4ed8', fontWeight: '800' },
  armadoOption: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
    gap: 2,
  },
  armadoOptionActive: {
    backgroundColor: '#eff6ff',
  },
  armadoOptionTitle: { color: '#0f172a', fontWeight: '800' },
  armadoOptionTitleActive: { color: '#1d4ed8' },
  armadoOptionMeta: { color: '#64748b', fontWeight: '600', fontSize: 12 },
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
  recepcionaBlock: {
    marginTop: 8,
  },
  personTitle: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 13,
  },
  nameReadonlyBox: {
    justifyContent: 'center',
  },
  nameReadonlyText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 13,
  },
  additionalTechWrap: {
    marginTop: 6,
    gap: 10,
  },
  additionalTechTitle: {
    color: '#64748b',
    fontWeight: '700',
    fontSize: 12,
  },
  additionalTechInlineItem: {
    width: '100%',
  },
  clienteSectionCard: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 12,
    backgroundColor: '#f8fbff',
    padding: 10,
    gap: 8,
  },
  clienteSectionHint: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  firmaActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  firmaBtn: { borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  firmaBtnText: { color: '#1d4ed8', fontWeight: '700', fontSize: 12 },
  firmaClearBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fff1f2', alignItems: 'center', justifyContent: 'center' },
  firmaPreview: { marginTop: 8, width: '100%', height: 90, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, backgroundColor: '#fff' },
  evidenciaGrid: { marginTop: 8, gap: 10 },
  evidenciaItem: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 8, backgroundColor: '#fff' },
  evidenciaPreview: { width: '100%', height: 170, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, backgroundColor: '#fff' },
  evidenciaActions: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  signatureFieldLabel: { color: '#94a3b8', fontWeight: '700', fontSize: 11.5 },
  signatureNameText: { marginTop: 1, color: '#0f172a', fontWeight: '700' },
  signatureEmptyText: { marginTop: 8, color: '#94a3b8', fontWeight: '700' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  cancelBtn: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#f8fafc' },
  cancelBtnText: { color: '#334155', fontWeight: '700' },
  saveBtn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#1d4ed8' },
  ctaDisabled: { backgroundColor: '#94a3b8' },
  ctaDone: { backgroundColor: '#16a34a' },
  saveBtnText: { color: '#fff', fontWeight: '700' },
});

