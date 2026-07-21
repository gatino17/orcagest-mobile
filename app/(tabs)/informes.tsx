import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../_layout';
import {
  createActaEntrega,
  createCambioEquipoMantencion,
  createLevantamientoTerreno,
  updateLevantamientoTerreno,
  createMantencionTerreno,
  createPermisoTrabajo,
  createRetiroTerreno,
  deleteActaEntrega,
  deleteRetiroTerreno,
	  fetchMantencionesTerreno,
	  fetchLevantamientosTerreno,
	  solicitarEdicionLevantamientoTerreno,
	  fetchActasEntrega,
  fetchCambiosEquipoMantencion,
  fetchCentrosPorCliente,
  fetchClientes,
  fetchPermisosTrabajo,
  fetchRetirosTerreno,
  solicitarEdicionRetiroTerreno,
  getArmados,
  getEquipos,
  updateActaEntrega,
  updateActividadCalendario,
  updateMantencionTerreno,
  updatePermisoTrabajo,
	  updateRetiroTerreno,
	} from '@/lib/api';
import { subscribeActividadUpdated } from '@/lib/realtime';
import {
  fetchActividadesAsignadasUsuario,
  readCachedActividadesAsignadas,
  writeCachedActividadesAsignadas,
} from '@/lib/actividades';
import { readCachedValue, removeCachedValue, writeCachedValue } from '@/lib/cache-store';
import { enqueueOfflineOp, isOfflineQueueableError } from '@/lib/offline-queue';

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
  armado_equipos?: ActaArmadoEquipo[] | string;
  centro_origen_traslado?: string;
  tipo_instalacion?: 'instalacion' | 'reapuntamiento' | string;
  created_at?: string;
  updated_at?: string;
};
type FirmaTecnicoExtra = { nombre: string; firma: string };
type ActaArmadoEquipo = {
  equipo_id?: number | null;
  nombre?: string | null;
  codigo?: string | null;
  numero_serie?: string | null;
  caja?: string | null;
  estado_uso?: 'instalado' | 'devuelto_bodega' | string;
  estado_logistico?: 'sin_movimiento' | 'en_transito_bodega' | 'recepcionado_bodega' | string;
  observacion?: string | null;
};
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
  codigo_ponton?: string;
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
  estado_edicion?: string;
  empresa?: string;
  cliente?: string;
  centro?: string;
  base_tierra?: string | boolean | null;
  cantidad_radares?: number | string | null;
  equipos?: RetiroEquipoChecklist[];
  cambios_equipo?: any[] | string;
};
type LevantamientoTerreno = {
  id_levantamiento_terreno?: number;
  centro_id?: number;
  actividad_id?: number;
  fecha_levantamiento?: string;
  region?: string;
  localidad?: string;
  codigo_ponton?: string;
  resumen?: string;
  observaciones?: string;
  medicion_voltaje?: string;
  medicion_corriente?: string;
  medicion_potencia?: string;
  fotos?: LevantamientoFoto[];
  empresa?: string;
  cliente?: string;
  centro?: string;
  estado?: string;
};
type LevantamientoEditMeta = {
  centro_id?: number;
  centro?: string;
  cliente?: string;
  region?: string;
  localidad?: string;
  codigo_ponton?: string;
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
  modalidad_retorno?: 'por_mano' | 'despacho_orca';
};
type MantencionEquipoChecklist = {
  equipo_id?: number;
  equipo_nombre?: string;
  numero_serie?: string;
  codigo?: string;
  revisado?: boolean;
  observacion?: string;
};
type InformesDraft = {
  moduloInforme: ModuloInforme;
  actividadAsignadaActiva: any | null;
  tecnicosAsignadosExtra: string[];
  firmasTecnicosExtra: FirmaTecnicoExtra[];
  showEditor: boolean;
  showPermisoModal: boolean;
  showRetiroChecklistModal: boolean;
  showLevantamientoModal: boolean;
  mostrarInstalacionForm: boolean;
  acta: {
    actaSoloLectura: boolean;
    editId: number | null;
    clienteIdForm: number | null;
    centroIdForm: number | null;
    fechaRegistro: string;
    tecnico1: string;
    firmaTecnico1: string;
    tecnico2: string;
    firmaTecnico2: string;
    recepcionaNombre: string;
    firmaRecepciona: string;
    equiposConsiderados: string;
    centroOrigenTraslado: string;
    tipoRegistroInstalacion: TipoRegistroInstalacion;
    tipoInstalacion: TipoInstalacion;
    armadoSeleccionadoId: number | null;
    vinculoActaId: number | null;
  };
  permiso: {
    permisoContexto: PermisoContexto;
    permisoSoloLectura: boolean;
    permClienteId: number | null;
    permCentroId: number | null;
    permFecha: string;
    permFechaSalida: string;
    permResponsabilidad: string;
    permTecnico1: string;
    permFirmaTecnico1: string;
    permTecnico2: string;
    permFirmaTecnico2: string;
    permRecepciona: string;
    permRecepcionaRut: string;
    permFirmaRecepciona: string;
    permPuntosGpsList: GpsPoint[];
    permSellosList: SelloItem[];
    permMedicionFaseNeutro: string;
    permMedicionNeutroTierra: string;
    permHertz: string;
    permDescripcionTrabajo: string;
    permEvidenciaFotos: string[];
    mantencionEditandoId: number | null;
    retiroEditandoId: number | null;
    retiroTipo: 'parcial' | 'completo';
    retiroEstado: 'retirado_centro' | 'en_transito';
    retiroEquiposChecklist: RetiroEquipoChecklist[];
    retiroFormDirty: boolean;
    cambioEquipoEnabled: boolean;
    equipoCambioId: number | null;
    serieNuevaCambio: string;
    mantencionChecklistEnabled: boolean;
    mantencionEquiposChecklist: MantencionEquipoChecklist[];
  };
  levantamiento: {
    levantamientoFecha: string;
    levantamientoResumen: string;
    levantamientoObservaciones: string;
    levantamientoVoltaje: string;
    levantamientoCorriente: string;
    levantamientoPotencia: string;
    levantamientoFotos: LevantamientoFoto[];
    levantamientoEditandoId: number | null;
    levantamientoEditMeta: LevantamientoEditMeta | null;
  };
};

const offlineTempId = () => -Date.now();
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

type ModuloInforme = 'instalacion' | 'mantencion' | 'retiro' | 'levantamiento';
type TipoInstalacion = 'acta_entrega' | 'informe_intervencion';
type TipoRegistroInstalacion = 'instalacion' | 'reapuntamiento';
type LevantamientoFoto = { uri: string; descripcion: string };
const ACTIVIDADES_FETCH_DEBOUNCE_MS = 2500;
const INFORMES_CACHE_TTL_MS = 30000;
type FirmaTarget =
  | 'tecnico1'
  | 'tecnico2'
  | 'tecnico_extra'
  | 'recepciona'
  | 'perm_recepciona'
  | 'perm_tecnico1'
  | 'perm_tecnico2'
  | null;

const normalizarBaseTierra = (value: unknown): 'si' | 'no' | '' => {
  if (value === true) return 'si';
  if (value === false) return 'no';
  const text = String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (text === 'si' || text === 'sí') return 'si';
  if (text === 'no') return 'no';
  return '';
};

const normalizarModalidadRetorno = (value: unknown): 'por_mano' | 'despacho_orca' => {
  const text = String(value ?? '').trim().toLowerCase();
  if (text === 'por_mano' || text === 'retirado_centro') return 'por_mano';
  return 'despacho_orca';
};
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

const buildActaArmadoEquipoKey = (item: Partial<ActaArmadoEquipo>) => {
  const equipoId = Number(item?.equipo_id || 0) || 0;
  if (equipoId > 0) return `id:${equipoId}`;
  const serie = String(item?.numero_serie || '').trim().toUpperCase();
  if (serie) return `serie:${serie}`;
  const codigo = String(item?.codigo || '').trim().toUpperCase();
  if (codigo) return `codigo:${codigo}`;
  const nombre = String(item?.nombre || '').trim().toUpperCase();
  const caja = String(item?.caja || '').trim().toUpperCase();
  return `fallback:${nombre}:${caja}`;
};

const parseActaArmadoEquipos = (value?: ActaArmadoEquipo[] | string): ActaArmadoEquipo[] => {
  if (!value) return [];
  try {
    const raw = Array.isArray(value) ? value : JSON.parse(String(value));
    if (!Array.isArray(raw)) return [];
    return raw
      .map((row: any) => {
        const estadoUso = String(row?.estado_uso || 'instalado').trim().toLowerCase();
        const estadoLogistico = String(row?.estado_logistico || 'sin_movimiento').trim().toLowerCase();
        return {
          equipo_id: Number(row?.equipo_id || 0) || null,
          nombre: String(row?.nombre || '').trim() || null,
          codigo: String(row?.codigo || '').trim() || null,
          numero_serie: String(row?.numero_serie || '').trim() || null,
          caja: String(row?.caja || '').trim() || null,
          estado_uso: estadoUso === 'devuelto_bodega' ? 'devuelto_bodega' : 'instalado',
          estado_logistico:
            estadoLogistico === 'en_transito_bodega' ||
            estadoLogistico === 'recepcionado_bodega' ||
            estadoLogistico === 'sin_movimiento'
              ? estadoLogistico
              : 'sin_movimiento',
          observacion: String(row?.observacion || '').trim() || null,
        } as ActaArmadoEquipo;
      })
      .filter((row) => row.equipo_id || row.nombre || row.codigo || row.numero_serie);
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
        id_retiro_equipo:
          Number(row?.id_retiro_equipo || row?.id_cambio_equipo_mantencion || 0) || undefined,
        equipo_id: Number(row?.equipo_id || 0) || undefined,
        equipo_nombre: String(row?.equipo_nombre || row?.equipo || row?.nombre || '').trim(),
        numero_serie: String(row?.numero_serie || row?.serie_anterior || '').trim(),
        codigo: String(row?.codigo || row?.codigo_anterior || '').trim(),
        retirado: typeof row?.retirado === 'boolean' ? !!row?.retirado : true,
        modalidad_retorno: normalizarModalidadRetorno(row?.modalidad_retorno || row?.estado_logistico),
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
  const [, setLoadingActas] = useState(false);
  const [, setLoadingPermisos] = useState(false);
  const actividadesAsignadasInFlightRef = useRef<Promise<void> | null>(null);
  const actividadesAsignadasLastLoadedRef = useRef(0);
  const informesDraftRestoredRef = useRef(false);
  const restoringInformesDraftRef = useRef(false);
  const actasCacheRef = useRef<Record<string, { data: Acta[]; fetchedAt: number }>>({});
  const permisosCacheRef = useRef<Record<string, { data: Permiso[]; fetchedAt: number }>>({});
  const mantencionesCacheRef = useRef<Record<string, { data: Permiso[]; fetchedAt: number }>>({});
  const retirosCacheRef = useRef<Record<string, { data: Permiso[]; fetchedAt: number }>>({});
  const levantamientosCacheRef = useRef<Record<string, { data: LevantamientoTerreno[]; fetchedAt: number }>>({});
  const [mantencionesTerreno, setMantencionesTerreno] = useState<Permiso[]>([]);
  const [retirosTerreno, setRetirosTerreno] = useState<Permiso[]>([]);
  const [levantamientosTerreno, setLevantamientosTerreno] = useState<LevantamientoTerreno[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showPermisoModal, setShowPermisoModal] = useState(false);
  const [permisoContexto, setPermisoContexto] = useState<PermisoContexto>('instalacion');
  const [actaSoloLectura, setActaSoloLectura] = useState(false);
  const [permisoSoloLectura, setPermisoSoloLectura] = useState(false);
  const [vinculoSoloLectura, setVinculoSoloLectura] = useState(false);
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
  const [cameraTarget, setCameraTarget] = useState<'permiso' | 'levantamiento'>('permiso');
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
  const [showArmadoEquiposModal, setShowArmadoEquiposModal] = useState(false);
  const [loadingArmadoEquipos, setLoadingArmadoEquipos] = useState(false);
  const [savingArmadoEquipos, setSavingArmadoEquipos] = useState(false);
  const [armadoEquiposActa, setArmadoEquiposActa] = useState<ActaArmadoEquipo[]>([]);
  const [armadoEquiposSoloLectura, setArmadoEquiposSoloLectura] = useState(false);
  const [armadoEquiposGuardadoActas, setArmadoEquiposGuardadoActas] = useState<number[]>([]);
  const [mantencionEditandoId, setMantencionEditandoId] = useState<number | null>(null);
  const [retiroEditandoId, setRetiroEditandoId] = useState<number | null>(null);
  const [showAllMantencionesRecientes, setShowAllMantencionesRecientes] = useState(false);
  const [showAllRetirosRecientes, setShowAllRetirosRecientes] = useState(false);
  const [solicitandoEdicionRetiroId, setSolicitandoEdicionRetiroId] = useState<number | null>(null);
  const [showRetiroTipoModal, setShowRetiroTipoModal] = useState(false);
  const [showLevantamientoModal, setShowLevantamientoModal] = useState(false);
  const [showMantencionChecklistModal, setShowMantencionChecklistModal] = useState(false);
  const [showRetiroChecklistModal, setShowRetiroChecklistModal] = useState(false);
  const [showRetiroChecklistReadModal, setShowRetiroChecklistReadModal] = useState(false);
  const [retiroChecklistReadOnly, setRetiroChecklistReadOnly] = useState<RetiroEquipoChecklist[]>([]);
  const [retiroChecklistReadMeta, setRetiroChecklistReadMeta] = useState<{
    tipo: 'parcial' | 'completo';
    estado: 'retirado_centro' | 'en_transito';
  } | null>(null);
  const [retiroFormDirty, setRetiroFormDirty] = useState(false);
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
  const [levantamientoFecha, setLevantamientoFecha] = useState(todayInputDate());
  const [levantamientoResumen, setLevantamientoResumen] = useState('');
  const [levantamientoObservaciones, setLevantamientoObservaciones] = useState('');
  const [levantamientoVoltaje, setLevantamientoVoltaje] = useState('');
  const [levantamientoCorriente, setLevantamientoCorriente] = useState('');
  const [levantamientoPotencia, setLevantamientoPotencia] = useState('');
  const [levantamientoFotos, setLevantamientoFotos] = useState<LevantamientoFoto[]>([]);
  const [solicitandoEdicionLevantamientoId, setSolicitandoEdicionLevantamientoId] = useState<number | null>(null);
  const [levantamientoEditandoId, setLevantamientoEditandoId] = useState<number | null>(null);
  const [levantamientoEditMeta, setLevantamientoEditMeta] = useState<LevantamientoEditMeta | null>(null);
  const informesDraftCacheKey = useMemo(() => `informes_v1_draft_${userId || 'anon'}`, [userId]);
  const clientesCacheKey = useMemo(() => `informes_v1_clientes_${userId || 'anon'}`, [userId]);
  const centrosCacheKey = useCallback(
    (clienteId: number | null | undefined) => `informes_v1_centros_${userId || 'anon'}_${Number(clienteId || 0) || 0}`,
    [userId]
  );

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
        const ta = new Date(a.updated_at || a.created_at || a.fecha_registro || 0).getTime();
        const tb = new Date(b.updated_at || b.created_at || b.fecha_registro || 0).getTime();
        if (tb !== ta) return tb - ta;
        return Number(b.id_acta_entrega || 0) - Number(a.id_acta_entrega || 0);
      });
    return porCentro[0] || null;
  }, [actas, permCentroId, tipoRegistroInstalacion]);
  const actaObjetivoSeleccionada = useMemo(() => {
    const objetivoId = Number(vinculoActaId || 0) || null;
    if (objetivoId) {
      return actas.find((a) => Number(a.id_acta_entrega || 0) === objetivoId) || actaCentroSeleccionado;
    }
    return actaCentroSeleccionado;
  }, [actas, vinculoActaId, actaCentroSeleccionado]);
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
  const clienteActualInforme = useMemo(
    () =>
      clientePermSel?.nombre ||
      clientePermSel?.razon_social ||
      actividadAsignadaActiva?.centro?.cliente ||
      retiroEditandoSeleccionado?.cliente ||
      retiroEditandoSeleccionado?.empresa ||
      mantencionEditandoSeleccionada?.cliente ||
      mantencionEditandoSeleccionada?.empresa ||
      permisoCentroSeleccionado?.cliente ||
      permisoCentroSeleccionado?.empresa ||
      actaCentroSeleccionado?.cliente ||
      actaCentroSeleccionado?.empresa ||
      '-',
    [
      clientePermSel,
      actividadAsignadaActiva,
      retiroEditandoSeleccionado,
      mantencionEditandoSeleccionada,
      permisoCentroSeleccionado,
      actaCentroSeleccionado,
    ]
  );
  const centroActualInforme = useMemo(
    () =>
      permCentroSel?.nombre ||
      actividadAsignadaActiva?.centro?.nombre ||
      retiroEditandoSeleccionado?.centro ||
      mantencionEditandoSeleccionada?.centro ||
      permisoCentroSeleccionado?.centro ||
      actaCentroSeleccionado?.centro ||
      '-',
    [
      permCentroSel,
      actividadAsignadaActiva,
      retiroEditandoSeleccionado,
      mantencionEditandoSeleccionada,
      permisoCentroSeleccionado,
      actaCentroSeleccionado,
    ]
  );
  const codigoPontonActualInforme = useMemo(
    () =>
      permCentroSel?.nombre_ponton ||
      actividadAsignadaActiva?.centro?.nombre_ponton ||
      retiroEditandoSeleccionado?.codigo_ponton ||
      mantencionEditandoSeleccionada?.codigo_ponton ||
      permisoCentroSeleccionado?.codigo_ponton ||
      actaCentroSeleccionado?.codigo_ponton ||
      codigoPontonActa ||
      '-',
    [
      permCentroSel,
      actividadAsignadaActiva,
      retiroEditandoSeleccionado,
      mantencionEditandoSeleccionada,
      permisoCentroSeleccionado,
      actaCentroSeleccionado,
      codigoPontonActa,
    ]
  );
  const equipoCambioSeleccionado = useMemo(
    () =>
      equiposCentro.find((e) => Number(e.id_equipo || 0) === Number(equipoCambioId || 0)) || null,
    [equiposCentro, equipoCambioId]
  );
  const armadoVinculadoId = Number(actaObjetivoSeleccionada?.armado_id || armadoSeleccionadoId || 0) || null;
  const actaCentroSeleccionadoId = Number(actaObjetivoSeleccionada?.id_acta_entrega || 0) || null;
  const armadoVinculado = armadosFinalizadosCentro.find((a) => Number(a.id_armado || 0) === Number(armadoVinculadoId || 0)) || null;
  const armadoEquiposGuardados = useMemo(
    () => parseActaArmadoEquipos(actaObjetivoSeleccionada?.armado_equipos),
    [actaObjetivoSeleccionada]
  );
  const armadoEquiposYaGuardados =
    armadoEquiposGuardados.length > 0 ||
    (actaCentroSeleccionadoId ? armadoEquiposGuardadoActas.includes(actaCentroSeleccionadoId) : false);
  const resumenArmadoEquipos = useMemo(() => {
    return armadoEquiposGuardados.reduce(
      (acc, item) => {
        const estado = String(item.estado_uso || 'instalado').trim().toLowerCase();
        acc.total += 1;
        if (estado === 'instalado') acc.instalados += 1;
        else acc.devueltos += 1;
        return acc;
      },
      { total: 0, instalados: 0, devueltos: 0 }
    );
  }, [armadoEquiposGuardados]);
  const informesFiltroCacheKey = useMemo(
    () =>
      JSON.stringify({
        centro_id: Number(filtroCentroId || 0) || 0,
        fecha_desde: filtroFechaDesde || '',
        fecha_hasta: filtroFechaHasta || '',
      }),
    [filtroCentroId, filtroFechaDesde, filtroFechaHasta]
  );
  const informesPersistentCacheBaseKey = useMemo(
    () =>
      `informes_v1_${userId || 'anon'}_${Number(filtroCentroId || 0) || 0}_${filtroFechaDesde || 'na'}_${filtroFechaHasta || 'na'}`,
    [userId, filtroCentroId, filtroFechaDesde, filtroFechaHasta]
  );
  const instalacionSeleccionada = !!(permClienteId && permCentroId);
  const instalacionesCompletadas = useMemo(() => {
    const ids = permisosInstalacion
      .map((p) => Number(p.centro_id || 0))
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i);
    return ids.map((centroId) => {
      const actasCentro = actas
        .filter((a) => Number(a.centro_id || 0) === centroId)
        .sort((a, b) => {
          const ta = new Date(a.updated_at || a.created_at || a.fecha_registro || 0).getTime();
          const tb = new Date(b.updated_at || b.created_at || b.fecha_registro || 0).getTime();
          if (tb !== ta) return tb - ta;
          return Number(b.id_acta_entrega || 0) - Number(a.id_acta_entrega || 0);
        });
      const acta = actasCentro[0];
      const actaConArmado = actasCentro.find((a) => Number(a.armado_id || 0) > 0);
      const hasArmadoVinculado = !!actaConArmado;
      const hasArmadoEquiposGuardados =
        parseActaArmadoEquipos(actaConArmado?.armado_equipos || acta?.armado_equipos).length > 0;
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
        hasArmadoEquiposGuardados: hasArmadoEquiposGuardados || (Number(acta?.id_acta_entrega || 0) > 0 && armadoEquiposGuardadoActas.includes(Number(acta?.id_acta_entrega || 0))),
        centro,
        cliente,
        tipoInstalacion: tipoInstalacionItem,
        fechaActa: acta?.fecha_registro || '',
        fechaPermiso: permisosInstalacion.find((p) => Number(p.centro_id || 0) === centroId)?.fecha_ingreso || '',
      };
    });
  }, [permisosInstalacion, actas, permCentros, centrosFiltro, armadoEquiposGuardadoActas, moduloInforme]);
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

    const areaActiva = String(actividadAsignadaActiva?.area || '').trim().toLowerCase();
    const esInstalacionActiva = areaActiva.startsWith('instal') || areaActiva.startsWith('reap');
    if (moduloInforme === 'instalacion' && esInstalacionActiva) {
      const centroIdActivo =
        Number(
          actividadAsignadaActiva?.centro_id ||
            actividadAsignadaActiva?.centro?.id_centro ||
            actividadAsignadaActiva?.centro?.id ||
            0
        ) || null;
      const yaTienePermiso = !!(
        centroIdActivo &&
        permisosInstalacion.some((p) => Number(p.centro_id || 0) === Number(centroIdActivo))
      );
      if (centroIdActivo && !yaTienePermiso && !porCentro.has(centroIdActivo)) {
        porCentro.set(centroIdActivo, {
          centroId: centroIdActivo,
          actaId: Number(actaCentroSeleccionado?.id_acta_entrega || 0) || null,
          armadoId: Number(actaCentroSeleccionado?.armado_id || armadoSeleccionadoId || 0) || null,
          hasArmadoVinculado: Number(actaCentroSeleccionado?.armado_id || armadoSeleccionadoId || 0) > 0,
          centro:
            actividadAsignadaActiva?.centro?.nombre ||
            permCentros.find((c) => Number(c.id_centro ?? c.id ?? 0) === Number(centroIdActivo))?.nombre ||
            centrosFiltro.find((c) => Number(c.id_centro ?? c.id ?? 0) === Number(centroIdActivo))?.nombre ||
            `Centro ${centroIdActivo}`,
          cliente:
            actividadAsignadaActiva?.centro?.cliente ||
            clientes.find((c) => Number(c.id_cliente ?? c.id ?? 0) === Number(permClienteId ?? 0))?.nombre ||
            '-',
          tipoInstalacion: areaActiva.startsWith('reap') ? 'reapuntamiento' : 'instalacion',
          fechaActa: actaCentroSeleccionado?.fecha_registro || '',
        });
      }
    }

    return Array.from(porCentro.values());
  }, [
    actas,
    permisosInstalacion,
    permCentros,
    centrosFiltro,
    actividadesAsignadas,
    actividadAsignadaActiva,
    moduloInforme,
    actaCentroSeleccionado,
    armadoSeleccionadoId,
    clientes,
    permClienteId,
  ]);
  const mostrarAsignadasCompletadas = false;
  const mantencionesRecientesVisibles = useMemo(
    () => (showAllMantencionesRecientes ? permisosMantencion : permisosMantencion.slice(0, 3)),
    [showAllMantencionesRecientes, permisosMantencion]
  );
  const retirosRecientesVisibles = useMemo(
    () => (showAllRetirosRecientes ? permisosRetiro : permisosRetiro.slice(0, 3)),
    [showAllRetirosRecientes, permisosRetiro]
  );
  const levantamientosRecientesVisibles = useMemo(
    () => levantamientosTerreno.slice(0, 4),
    [levantamientosTerreno]
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
  const retiroSeleccionadosCount = useMemo(
    () => retiroEquiposChecklist.filter((item) => !!item.retirado).length,
    [retiroEquiposChecklist]
  );
  const retiroPorManoCount = useMemo(
    () =>
      retiroEquiposChecklist.filter(
        (item) => !!item.retirado && normalizarModalidadRetorno(item.modalidad_retorno) === 'por_mano'
      ).length,
    [retiroEquiposChecklist]
  );
  const retiroDespachoCount = useMemo(
    () =>
      retiroEquiposChecklist.filter(
        (item) => !!item.retirado && normalizarModalidadRetorno(item.modalidad_retorno) === 'despacho_orca'
      ).length,
    [retiroEquiposChecklist]
  );
  const retiroTipoLabel = retiroTipo === 'completo' ? 'Completo' : 'Parcial';
  const retiroEstadoLabel =
    retiroSeleccionadosCount > 0 && retiroPorManoCount > 0 && retiroDespachoCount > 0
      ? 'Mixto'
      : retiroDespachoCount > 0
      ? 'Despacho a Orca'
      : 'Por mano a Orca';
  const upsertRetiroTerrenoLocal = useCallback((retiro: Permiso | null | undefined) => {
    if (!retiro || !retiro.id_retiro_terreno) return;
    setRetirosTerreno((prev) => {
      const next = Array.isArray(prev) ? [...prev] : [];
      const idx = next.findIndex(
        (item) => Number(item.id_retiro_terreno || 0) === Number(retiro.id_retiro_terreno || 0)
      );
      if (idx >= 0) {
        next[idx] = { ...next[idx], ...retiro };
      } else {
        next.unshift(retiro);
      }
      return next.sort((a, b) => {
        const ta = new Date(a.fecha_retiro || 0).getTime();
        const tb = new Date(b.fecha_retiro || 0).getTime();
        if (tb !== ta) return tb - ta;
        return Number(b.id_retiro_terreno || 0) - Number(a.id_retiro_terreno || 0);
      });
    });
  }, []);
  const upsertActaLocal = useCallback((acta: Acta | null | undefined) => {
    if (!acta || !acta.id_acta_entrega) return;
    setActas((prev) => {
      const next = Array.isArray(prev) ? [...prev] : [];
      const idx = next.findIndex((item) => Number(item.id_acta_entrega || 0) === Number(acta.id_acta_entrega || 0));
      if (idx >= 0) {
        next[idx] = { ...next[idx], ...acta };
      } else {
        next.unshift(acta);
      }
      return next.sort((a, b) => {
        const ta = new Date(a.fecha_registro || a.updated_at || a.created_at || 0).getTime();
        const tb = new Date(b.fecha_registro || b.updated_at || b.created_at || 0).getTime();
        if (tb !== ta) return tb - ta;
        return Number(b.id_acta_entrega || 0) - Number(a.id_acta_entrega || 0);
      });
    });
  }, []);
  const upsertPermisoLocal = useCallback((permiso: Permiso | null | undefined) => {
    if (!permiso || !permiso.id_permiso_trabajo) return;
    setPermisos((prev) => {
      const next = Array.isArray(prev) ? [...prev] : [];
      const idx = next.findIndex(
        (item) => Number(item.id_permiso_trabajo || 0) === Number(permiso.id_permiso_trabajo || 0)
      );
      if (idx >= 0) {
        next[idx] = { ...next[idx], ...permiso };
      } else {
        next.unshift(permiso);
      }
      return next.sort((a, b) => {
        const ta = new Date(a.fecha_ingreso || a.updated_at || 0).getTime();
        const tb = new Date(b.fecha_ingreso || b.updated_at || 0).getTime();
        if (tb !== ta) return tb - ta;
        return Number(b.id_permiso_trabajo || 0) - Number(a.id_permiso_trabajo || 0);
      });
    });
  }, []);
  const upsertMantencionLocal = useCallback((mantencion: Permiso | null | undefined) => {
    if (!mantencion || !mantencion.id_mantencion_terreno) return;
    setMantencionesTerreno((prev) => {
      const next = Array.isArray(prev) ? [...prev] : [];
      const idx = next.findIndex(
        (item) => Number(item.id_mantencion_terreno || 0) === Number(mantencion.id_mantencion_terreno || 0)
      );
      if (idx >= 0) {
        next[idx] = { ...next[idx], ...mantencion };
      } else {
        next.unshift(mantencion);
      }
      return next.sort((a, b) => {
        const ta = new Date(a.fecha_ingreso || a.updated_at || 0).getTime();
        const tb = new Date(b.fecha_ingreso || b.updated_at || 0).getTime();
        if (tb !== ta) return tb - ta;
        return Number(b.id_mantencion_terreno || 0) - Number(a.id_mantencion_terreno || 0);
      });
    });
  }, []);
  const upsertLevantamientoLocal = useCallback((levantamiento: LevantamientoTerreno | null | undefined) => {
    if (!levantamiento || !levantamiento.id_levantamiento_terreno) return;
    setLevantamientosTerreno((prev) => {
      const next = Array.isArray(prev) ? [...prev] : [];
      const idx = next.findIndex(
        (item) =>
          Number(item.id_levantamiento_terreno || 0) === Number(levantamiento.id_levantamiento_terreno || 0)
      );
      if (idx >= 0) {
        next[idx] = { ...next[idx], ...levantamiento };
      } else {
        next.unshift(levantamiento);
      }
      return next.sort((a, b) => {
        const ta = new Date(a.fecha_levantamiento || a.updated_at || 0).getTime();
        const tb = new Date(b.fecha_levantamiento || b.updated_at || 0).getTime();
        if (tb !== ta) return tb - ta;
        return Number(b.id_levantamiento_terreno || 0) - Number(a.id_levantamiento_terreno || 0);
      });
    });
  }, []);
  const nombreRegistroInstalacion =
    tipoRegistroInstalacion === 'reapuntamiento' ? 'Reapuntamiento' : 'Instalacion';
  const nombreDocumentoActa =
    tipoRegistroInstalacion === 'reapuntamiento' ? 'Acta de reapuntamiento' : 'Acta de entrega';
  const roleNorm = String(role || '').trim().toLowerCase();
  const canCrearInstalacionManual = roleNorm === 'admin' || roleNorm === 'operaciones' || roleNorm === 'superadmin';
  const canEliminarRetiroReciente = roleNorm === 'admin' || roleNorm === 'operaciones' || roleNorm === 'superadmin';
  const nombresBloqueadosPorProgramacion = !!actividadAsignadaActiva;
  const bloquearClienteCentroActa = !!actividadAsignadaActiva || !!editId;
  const permisoFormularioSoloLectura = permisoSoloLectura;
  const permisoInstalacionSoloLectura = permisoContexto === 'instalacion' && permisoFormularioSoloLectura;
  const permisoEditable = !permisoFormularioSoloLectura;
  const clienteCentroSoloLectura =
    permisoContexto === 'mantencion' || !!actividadAsignadaActiva;
  const estadoActividad = (value?: string) => {
    const est = String(value || '').trim().toLowerCase();
    if (est === 'finalizado') return 'finalizado';
    if (est === 'en progreso' || est === 'en_progreso') return 'en_progreso';
    return 'pendiente';
  };
  const estadoLevantamiento = (value?: string) => String(value || '').trim().toLowerCase();
  const estadoEdicionRetiro = (value?: string) => String(value || 'finalizado').trim().toLowerCase();
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
      if (targetModulo === 'levantamiento') return area.startsWith('levant') || nombre.includes('levant');
      return false;
    });
  }, [actividadesAsignadas, moduloInforme]);
  const actividadIdsConRegistroModulo = useMemo(() => {
    if (moduloInforme === 'instalacion') {
      return new Set(
        actas
          .map((a) => Number(a.actividad_id || 0))
          .filter((id) => id > 0)
      );
    }
    if (moduloInforme === 'mantencion') {
      return new Set(
        permisosMantencion
          .map((m) => Number(m.actividad_id || 0))
          .filter((id) => id > 0)
      );
    }
    if (moduloInforme === 'retiro') {
      return new Set(
        permisosRetiro
          .map((r) => Number(r.actividad_id || 0))
          .filter((id) => id > 0)
      );
    }
    if (moduloInforme === 'levantamiento') {
      return new Set(
        levantamientosTerreno
          .map((l) => Number(l.actividad_id || 0))
          .filter((id) => id > 0)
      );
    }
    return new Set<number>();
  }, [actas, permisosMantencion, permisosRetiro, levantamientosTerreno, moduloInforme]);
  const actividadTieneRegistroModulo = useCallback((actividad: ActividadAsignada) => {
    const idActividad = Number(actividad.id_actividad || 0) || 0;
    if (idActividad > 0 && actividadIdsConRegistroModulo.has(idActividad)) return true;

    const centroIdActividad =
      Number(actividad.centro_id || actividad.centro?.id_centro || actividad.centro?.id || 0) || 0;
    const fechaActividad = toInputDate(actividad.fecha_inicio) || '';

    if (moduloInforme === 'mantencion') {
      return permisosMantencion.some((item) => {
        const centroId = Number(item.centro_id || 0) || 0;
        const fecha = toInputDate(item.fecha_ingreso) || '';
        return !!centroIdActividad && centroId === centroIdActividad && !!fechaActividad && fecha === fechaActividad;
      });
    }

    if (moduloInforme === 'retiro') {
      return permisosRetiro.some((item) => {
        const centroId = Number(item.centro_id || 0) || 0;
        const fecha = toInputDate(item.fecha_retiro) || '';
        return !!centroIdActividad && centroId === centroIdActividad && !!fechaActividad && fecha === fechaActividad;
      });
    }

    if (moduloInforme === 'levantamiento') {
      return levantamientosTerreno.some((item) => {
        const centroId = Number(item.centro_id || 0) || 0;
        const fecha = toInputDate(item.fecha_levantamiento) || '';
        return !!centroIdActividad && centroId === centroIdActividad && !!fechaActividad && fecha === fechaActividad;
      });
    }

    return false;
  }, [actividadIdsConRegistroModulo, levantamientosTerreno, moduloInforme, permisosMantencion, permisosRetiro]);
  const estadoEdicionRetiroPorActividad = useCallback((actividad: ActividadAsignada) => {
    const idActividad = Number(actividad.id_actividad || 0) || 0;
    const centroIdActividad =
      Number(actividad.centro_id || actividad.centro?.id_centro || actividad.centro?.id || 0) || 0;
    const fechaActividad = toInputDate(actividad.fecha_inicio) || '';
    const match =
      permisosRetiro.find((item) => Number(item.actividad_id || 0) === idActividad) ||
      permisosRetiro.find((item) => {
        const centroId = Number(item.centro_id || 0) || 0;
        const fecha = toInputDate(item.fecha_retiro) || '';
        return !!centroIdActividad && centroId === centroIdActividad && !!fechaActividad && fecha === fechaActividad;
      }) ||
      null;
    return estadoEdicionRetiro(match?.estado_edicion);
  }, [permisosRetiro]);
  const actividadesProgramadas = useMemo(
    () => {
      return actividadesAsignadasFiltradas.filter((a) => {
        const idActividad = Number(a.id_actividad || 0);
        const estado = estadoActividad(a.estado);
        const esActiva = Number(actividadAsignadaActiva?.id_actividad || 0) === idActividad;
        const tieneRegistro = actividadTieneRegistroModulo(a);
        if (esActiva) return false;
        if (estado === 'finalizado') return false;
        if (moduloInforme === 'mantencion' && !tieneRegistro) return true;
        if (estado === 'pendiente') return true;
        // Compatibilidad operativa: si en web dejaron "En progreso" pero aun no existe acta,
        // en mobile se sigue mostrando como pendiente de iniciar.
        if (
          moduloInforme !== 'levantamiento' &&
          moduloInforme !== 'instalacion' &&
          estado === 'en_progreso' &&
          !tieneRegistro
        ) return true;
        return false;
      });
    },
    [actividadesAsignadasFiltradas, actividadAsignadaActiva, actividadTieneRegistroModulo, moduloInforme]
  );
  const actividadesEnProceso = useMemo(
    () => {
      return actividadesAsignadasFiltradas.filter((a) => {
        const idActividad = Number(a.id_actividad || 0);
        const esActiva = Number(actividadAsignadaActiva?.id_actividad || 0) === idActividad;
        const estado = estadoActividad(a.estado);
        const tieneRegistro = actividadTieneRegistroModulo(a);
        const retiroEstadoEdicion = moduloInforme === 'retiro' ? estadoEdicionRetiroPorActividad(a) : '';
        if (esActiva) {
          if (moduloInforme === 'instalacion') return false;
          if (moduloInforme === 'retiro' && retiroEstadoEdicion !== 'edicion_autorizada') return false;
          return estado !== 'finalizado';
        }
        if (moduloInforme === 'levantamiento') return estado === 'en_progreso';
        if (moduloInforme === 'instalacion') return estado === 'en_progreso' && !tieneRegistro;
        if (moduloInforme === 'retiro') {
          return estado === 'en_progreso' && tieneRegistro && retiroEstadoEdicion === 'edicion_autorizada';
        }
        return estado === 'en_progreso' && tieneRegistro;
      });
    },
    [
      actividadesAsignadasFiltradas,
      actividadAsignadaActiva,
      actividadTieneRegistroModulo,
      estadoEdicionRetiroPorActividad,
      moduloInforme,
    ]
  );
  const actividadInstalacionActivaEnProceso = useMemo(() => {
    if (moduloInforme !== 'instalacion' || !actividadAsignadaActiva) return false;
    const area = String(actividadAsignadaActiva.area || '').trim().toLowerCase();
    if (!area.startsWith('instal') && !area.startsWith('reap')) return false;
    return estadoActividad(actividadAsignadaActiva.estado) !== 'finalizado';
  }, [moduloInforme, actividadAsignadaActiva]);
  const totalActividadesEnProcesoVisible =
    actividadesEnProceso.length + (actividadInstalacionActivaEnProceso ? 1 : 0);
  const actividadesCompletadas = useMemo(
    () =>
      actividadesAsignadasFiltradas.filter((a) => {
        if (estadoActividad(a.estado) === 'finalizado') return true;
        if (moduloInforme === 'retiro' && actividadTieneRegistroModulo(a)) {
          return estadoEdicionRetiroPorActividad(a) !== 'edicion_autorizada';
        }
        return false;
      }),
    [actividadesAsignadasFiltradas, actividadTieneRegistroModulo, estadoEdicionRetiroPorActividad, moduloInforme]
  );
  const mostrarAsignadasEnProceso =
    moduloInforme !== 'instalacion' || actividadesEnProceso.length > 0;
  const mostrarTrabajosTerreno =
    loadingActividadesAsignadas ||
    actividadesProgramadas.length > 0 ||
    totalActividadesEnProcesoVisible > 0 ||
    (mostrarAsignadasCompletadas && actividadesCompletadas.length > 0);

  const cargarClientes = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const listaClientes = await fetchClientes();
      const rows = Array.isArray(listaClientes) ? listaClientes : [];
      setClientes(rows);
      writeCachedValue(clientesCacheKey, rows).catch(() => {});
    } catch (error: any) {
      const cached = await readCachedValue<Cliente[]>(clientesCacheKey, []);
      if (Array.isArray(cached.value) && cached.value.length) {
        setClientes(cached.value);
      } else {
        setClientes([]);
        const backendMsg =
          error?.response?.data?.error ||
          error?.response?.data?.message ||
          error?.message ||
          'No se pudieron cargar los clientes.';
        Alert.alert('Informes', backendMsg);
      }
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
      const rows = Array.isArray(lista) ? lista : [];
      setCentrosFiltro(rows);
      writeCachedValue(centrosCacheKey(clienteId), rows).catch(() => {});
    } catch {
      const cached = await readCachedValue<Centro[]>(centrosCacheKey(clienteId), []);
      if (Array.isArray(cached.value) && cached.value.length) {
        setCentrosFiltro(cached.value);
      } else {
        setCentrosFiltro([]);
        Alert.alert('Informes', 'No se pudieron cargar los centros del cliente.');
      }
    }
  };

  const cargarCentrosPorClienteForm = async (clienteId: number | null) => {
    if (!clienteId) {
      setCentrosForm([]);
      return;
    }
    try {
      const lista = await fetchCentrosPorCliente(clienteId);
      const rows = Array.isArray(lista) ? lista : [];
      setCentrosForm(rows);
      writeCachedValue(centrosCacheKey(clienteId), rows).catch(() => {});
    } catch {
      const cached = await readCachedValue<Centro[]>(centrosCacheKey(clienteId), []);
      if (Array.isArray(cached.value) && cached.value.length) {
        setCentrosForm(cached.value);
      } else {
        setCentrosForm([]);
        Alert.alert('Informes', 'No se pudieron cargar los centros para el acta.');
      }
    }
  };

  const cargarActas = async (options?: { force?: boolean }) => {
    if (!token || moduloInforme !== 'instalacion' || tipoInstalacion !== 'acta_entrega') return;
    const cached = actasCacheRef.current[informesFiltroCacheKey];
    const persistentCacheKey = `${informesPersistentCacheBaseKey}_actas`;
    if (cached) {
      setActas(cached.data);
      if (!options?.force && Date.now() - cached.fetchedAt < INFORMES_CACHE_TTL_MS) return;
    } else {
      const persisted = await readCachedValue<Acta[]>(persistentCacheKey, []);
      if (Array.isArray(persisted.value) && persisted.value.length) {
        const entry = { data: persisted.value, fetchedAt: persisted.updatedAt || 0 };
        actasCacheRef.current[informesFiltroCacheKey] = entry;
        setActas(entry.data);
        if (!options?.force && Date.now() - entry.fetchedAt < INFORMES_CACHE_TTL_MS) return;
      }
    }
    setLoadingActas(true);
    try {
      const data = await fetchActasEntrega({
        centro_id: filtroCentroId || undefined,
        fecha_desde: filtroFechaDesde || undefined,
        fecha_hasta: filtroFechaHasta || undefined,
      });
      const rows = Array.isArray(data) ? data : [];
      actasCacheRef.current[informesFiltroCacheKey] = {
        data: rows,
        fetchedAt: Date.now(),
      };
      setActas(rows);
      writeCachedValue(persistentCacheKey, rows).catch(() => {});
    } catch {
      if (!cached && !actasCacheRef.current[informesFiltroCacheKey]?.data?.length) {
        setActas([]);
        Alert.alert('Informes', 'No se pudieron cargar las actas.');
      }
    } finally {
      setLoadingActas(false);
    }
  };
  const cargarPermisos = async (options?: { force?: boolean }) => {
    if (!token || moduloInforme !== 'instalacion') return;
    const cached = permisosCacheRef.current[informesFiltroCacheKey];
    const persistentCacheKey = `${informesPersistentCacheBaseKey}_permisos`;
    if (cached) {
      setPermisos(cached.data);
      if (!options?.force && Date.now() - cached.fetchedAt < INFORMES_CACHE_TTL_MS) return;
    } else {
      const persisted = await readCachedValue<Permiso[]>(persistentCacheKey, []);
      if (Array.isArray(persisted.value) && persisted.value.length) {
        const entry = { data: persisted.value, fetchedAt: persisted.updatedAt || 0 };
        permisosCacheRef.current[informesFiltroCacheKey] = entry;
        setPermisos(entry.data);
        if (!options?.force && Date.now() - entry.fetchedAt < INFORMES_CACHE_TTL_MS) return;
      }
    }
    setLoadingPermisos(true);
    try {
      const data = await fetchPermisosTrabajo({
        centro_id: filtroCentroId || undefined,
        fecha_desde: filtroFechaDesde || undefined,
        fecha_hasta: filtroFechaHasta || undefined,
      });
      const rows = Array.isArray(data) ? data : [];
      permisosCacheRef.current[informesFiltroCacheKey] = {
        data: rows,
        fetchedAt: Date.now(),
      };
      setPermisos(rows);
      writeCachedValue(persistentCacheKey, rows).catch(() => {});
    } catch (error: any) {
      if (!cached && !permisosCacheRef.current[informesFiltroCacheKey]?.data?.length) {
        setPermisos([]);
        const backendMsg =
          error?.response?.data?.error ||
          error?.response?.data?.message ||
          error?.message ||
          'No se pudieron cargar los permisos de trabajo.';
        Alert.alert('Informes', backendMsg);
      }
    } finally {
      setLoadingPermisos(false);
    }
  };
  const cargarMantencionesTerreno = async () => {
    if (!token || moduloInforme !== 'mantencion') return;
    const persistentCacheKey = `${informesPersistentCacheBaseKey}_mantenciones`;
    const cached = mantencionesCacheRef.current[informesFiltroCacheKey];
    if (cached) {
      setMantencionesTerreno(cached.data);
      if (Date.now() - cached.fetchedAt < INFORMES_CACHE_TTL_MS) return;
    } else {
      const persisted = await readCachedValue<Permiso[]>(persistentCacheKey, []);
      if (Array.isArray(persisted.value) && persisted.value.length) {
        const entry = { data: persisted.value, fetchedAt: persisted.updatedAt || 0 };
        mantencionesCacheRef.current[informesFiltroCacheKey] = entry;
        setMantencionesTerreno(entry.data);
        if (Date.now() - entry.fetchedAt < INFORMES_CACHE_TTL_MS) return;
      }
    }
    try {
      const data = await fetchMantencionesTerreno({
        centro_id: filtroCentroId || undefined,
        fecha_desde: filtroFechaDesde || undefined,
        fecha_hasta: filtroFechaHasta || undefined,
      });
      const rows = Array.isArray(data) ? data : [];
      mantencionesCacheRef.current[informesFiltroCacheKey] = {
        data: rows,
        fetchedAt: Date.now(),
      };
      setMantencionesTerreno(rows);
      writeCachedValue(persistentCacheKey, rows).catch(() => {});
    } catch (error: any) {
      if (!mantencionesCacheRef.current[informesFiltroCacheKey]?.data?.length) {
        setMantencionesTerreno([]);
      }
      const backendMsg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'No se pudieron cargar las mantenciones en terreno.';
      if (!mantencionesCacheRef.current[informesFiltroCacheKey]?.data?.length) {
        Alert.alert('Informes', backendMsg);
      }
    }
  };
  const cargarRetirosTerreno = async () => {
    if (!token || moduloInforme !== 'retiro') return;
    const persistentCacheKey = `${informesPersistentCacheBaseKey}_retiros`;
    const cached = retirosCacheRef.current[informesFiltroCacheKey];
    if (cached) {
      setRetirosTerreno(cached.data);
      if (Date.now() - cached.fetchedAt < INFORMES_CACHE_TTL_MS) return;
    } else {
      const persisted = await readCachedValue<Permiso[]>(persistentCacheKey, []);
      if (Array.isArray(persisted.value) && persisted.value.length) {
        const entry = { data: persisted.value, fetchedAt: persisted.updatedAt || 0 };
        retirosCacheRef.current[informesFiltroCacheKey] = entry;
        setRetirosTerreno(entry.data);
        if (Date.now() - entry.fetchedAt < INFORMES_CACHE_TTL_MS) return;
      }
    }
    try {
      const data = await fetchRetirosTerreno({
        centro_id: filtroCentroId || undefined,
        fecha_desde: filtroFechaDesde || undefined,
        fecha_hasta: filtroFechaHasta || undefined,
      });
      const rows = Array.isArray(data) ? data : [];
      retirosCacheRef.current[informesFiltroCacheKey] = {
        data: rows,
        fetchedAt: Date.now(),
      };
      setRetirosTerreno(rows);
      writeCachedValue(persistentCacheKey, rows).catch(() => {});
    } catch (error: any) {
      if (!retirosCacheRef.current[informesFiltroCacheKey]?.data?.length) {
        setRetirosTerreno([]);
      }
      const backendMsg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'No se pudieron cargar los retiros en terreno.';
      if (!retirosCacheRef.current[informesFiltroCacheKey]?.data?.length) {
        Alert.alert('Informes', backendMsg);
      }
    }
  };
  const cargarLevantamientosTerreno = async () => {
    if (!token || moduloInforme !== 'levantamiento') return;
    const persistentCacheKey = `${informesPersistentCacheBaseKey}_levantamientos`;
    const cached = levantamientosCacheRef.current[informesFiltroCacheKey];
    if (cached) {
      setLevantamientosTerreno(cached.data);
      if (Date.now() - cached.fetchedAt < INFORMES_CACHE_TTL_MS) return;
    } else {
      const persisted = await readCachedValue<LevantamientoTerreno[]>(persistentCacheKey, []);
      if (Array.isArray(persisted.value) && persisted.value.length) {
        const entry = { data: persisted.value, fetchedAt: persisted.updatedAt || 0 };
        levantamientosCacheRef.current[informesFiltroCacheKey] = entry;
        setLevantamientosTerreno(entry.data);
        if (Date.now() - entry.fetchedAt < INFORMES_CACHE_TTL_MS) return;
      }
    }
    try {
      const data = await fetchLevantamientosTerreno({
        centro_id: filtroCentroId || undefined,
        fecha_desde: filtroFechaDesde || undefined,
        fecha_hasta: filtroFechaHasta || undefined,
      });
      const rows = Array.isArray(data) ? data : [];
      levantamientosCacheRef.current[informesFiltroCacheKey] = {
        data: rows,
        fetchedAt: Date.now(),
      };
      setLevantamientosTerreno(rows);
      writeCachedValue(persistentCacheKey, rows).catch(() => {});
    } catch (error: any) {
      if (!levantamientosCacheRef.current[informesFiltroCacheKey]?.data?.length) {
        setLevantamientosTerreno([]);
      }
      const backendMsg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'No se pudieron cargar los levantamientos en terreno.';
      if (!levantamientosCacheRef.current[informesFiltroCacheKey]?.data?.length) {
        Alert.alert('Informes', backendMsg);
      }
    }
  };
  const cargarActividadesAsignadas = useCallback(async (options?: { force?: boolean }) => {
    if (!token) {
      setActividadesAsignadas([]);
      return;
    }
    if (actividadesAsignadasInFlightRef.current) {
      if (!options?.force) return await actividadesAsignadasInFlightRef.current;
      await actividadesAsignadasInFlightRef.current.catch(() => {});
    }
    if (
      !options?.force &&
      Date.now() - actividadesAsignadasLastLoadedRef.current < ACTIVIDADES_FETCH_DEBOUNCE_MS
    ) {
      return;
    }
	    const request = (async () => {
	      setLoadingActividadesAsignadas(true);
	      try {
	        const lista = await fetchActividadesAsignadasUsuario({ userId, name });
	        setActividadesAsignadas(lista);
	        writeCachedActividadesAsignadas(userId, lista).catch(() => {});
	        actividadesAsignadasLastLoadedRef.current = Date.now();
	      } catch {
	        const cached = await readCachedActividadesAsignadas(userId);
	        setActividadesAsignadas(Array.isArray(cached) ? cached : []);
	      } finally {
	        setLoadingActividadesAsignadas(false);
	        actividadesAsignadasInFlightRef.current = null;
      }
    })();
    actividadesAsignadasInFlightRef.current = request;
    await request;
  }, [token, name, userId]);

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
        .then(() => cargarActividadesAsignadas({ force: true }))
        .catch(() => {});
    }
    if (area.startsWith('levant')) {
      setModuloInforme('levantamiento');
      setLevantamientoFecha(fechaActividad);
      setLevantamientoResumen('');
      setLevantamientoObservaciones('');
      setLevantamientoVoltaje('');
      setLevantamientoCorriente('');
      setLevantamientoPotencia('');
      setLevantamientoFotos([]);
      setMostrarInstalacionForm(false);
      setShowEditor(false);
      setShowPermisoModal(false);
      setShowRetiroTipoModal(false);
      setShowRetiroChecklistModal(false);
      setShowLevantamientoModal(true);
      return;
    }
    if (area.startsWith('instal') || area.startsWith('reap')) {
      resetForm();
      resetPermisoForm();
      if (tecnicoPrincipal) setTecnico1(tecnicoPrincipal);
      if (tecnicoAyudante) setTecnico2(tecnicoAyudante);
      if (tecnicoPrincipal) setPermTecnico1(tecnicoPrincipal);
      if (tecnicoAyudante) setPermTecnico2(tecnicoAyudante);
      setModuloInforme('instalacion');
      setTipoRegistroInstalacion(area.startsWith('reap') ? 'reapuntamiento' : 'instalacion');
      setMostrarInstalacionForm(true);
      setTipoInstalacion('acta_entrega');
      setEditId(null);
      setClienteIdForm(clienteId);
      setCentroIdForm(centroId);
      setFechaRegistro(fechaActividad);
      setShowEditor(false);
      setShowPermisoModal(false);
      setShowLevantamientoModal(false);
      setShowRetiroTipoModal(false);
      setShowRetiroChecklistModal(false);
      return;
    }
    if (area.startsWith('manten')) {
      resetPermisoForm();
      setPermisoSoloLectura(false);
      if (tecnicoPrincipal) setPermTecnico1(tecnicoPrincipal);
      if (tecnicoAyudante) setPermTecnico2(tecnicoAyudante);
      setPermisoContexto('mantencion');
      setPermFecha(fechaActividad);
      setMantencionEditandoId(null);
      setShowPermisoModal(true);
      return;
    }
    if (area.startsWith('retir')) {
      const retiroExistente =
        permisosRetiro.find((item) => Number(item.actividad_id || 0) === Number(actividadId || 0)) ||
        permisosRetiro.find((item) => {
          const centroItem = Number(item.centro_id || 0) || 0;
          const fechaItem = toInputDate(item.fecha_retiro) || '';
          return !!centroId && centroItem === centroId && !!fechaActividad && fechaItem === fechaActividad;
        }) ||
        null;
      const estadoRetiroExistente = estadoEdicionRetiro(retiroExistente?.estado_edicion);
      resetPermisoForm();
      setPermisoSoloLectura(!!retiroExistente && estadoRetiroExistente !== 'edicion_autorizada');
      if (tecnicoPrincipal) setPermTecnico1(tecnicoPrincipal);
      if (tecnicoAyudante) setPermTecnico2(tecnicoAyudante);
      setPermisoContexto('retiro');
      setPermFecha(fechaActividad);
      setRetiroEditandoId(Number(retiroExistente?.id_retiro_terreno || 0) || null);
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
      await cargarActividadesAsignadas({ force: true });
    } catch {
      // silencioso para no bloquear guardado de informe
    }
  };

  const handleGuardarLevantamiento = async () => {
    const centroId = Number(
      levantamientoEditMeta?.centro_id ||
      centroIdForm ||
      actividadAsignadaActiva?.centro_id ||
      actividadAsignadaActiva?.centro?.id_centro ||
      0
    ) || null;
    if (!centroId) {
      Alert.alert('Levantamiento', 'No se encontro el centro asociado.');
      return;
    }
    if (!String(levantamientoResumen || '').trim() && !levantamientoFotos.length) {
      Alert.alert('Levantamiento', 'Agrega una descripcion o al menos una foto antes de finalizar.');
      return;
    }
    const payload = {
      centro_id: centroId,
      actividad_id: Number(actividadAsignadaActiva?.id_actividad || 0) || null,
      fecha_levantamiento: levantamientoFecha || todayInputDate(),
      region: region || centroSelForm?.area || centroSelForm?.region || null,
      localidad: localidad || centroSelForm?.ubicacion || centroSelForm?.localidad || null,
      codigo_ponton: codigoPontonActa || centroSelForm?.nombre_ponton || null,
      resumen: levantamientoResumen || null,
      observaciones: levantamientoObservaciones || null,
      medicion_voltaje: levantamientoVoltaje || null,
      medicion_corriente: levantamientoCorriente || null,
      medicion_potencia: levantamientoPotencia || null,
      fotos: levantamientoFotos,
      estado: 'finalizado',
    };
    try {
      setSaving(true);
      if (levantamientoEditandoId) {
        await updateLevantamientoTerreno(levantamientoEditandoId, payload);
      } else {
        await createLevantamientoTerreno(payload);
      }
      await cargarLevantamientosTerreno();
      if (!levantamientoEditandoId) {
        await marcarActividadFinalizadaSiCorresponde();
        await cargarActividadesAsignadas({ force: true });
        setActividadAsignadaActiva(null);
        setTecnicosAsignadosExtra([]);
      }
      await removeCachedValue(informesDraftCacheKey);
      setShowLevantamientoModal(false);
      setLevantamientoEditandoId(null);
      setLevantamientoEditMeta(null);
      setLevantamientoResumen('');
      setLevantamientoObservaciones('');
      setLevantamientoVoltaje('');
      setLevantamientoCorriente('');
      setLevantamientoPotencia('');
      setLevantamientoFotos([]);
      Alert.alert('Levantamiento', levantamientoEditandoId ? 'Levantamiento editado y finalizado.' : 'Levantamiento guardado y finalizado.');
    } catch (error: any) {
      if (isOfflineQueueableError(error)) {
        const offlineId = levantamientoEditandoId || offlineTempId();
        await enqueueOfflineOp(
          levantamientoEditandoId ? 'update_levantamiento' : 'create_levantamiento',
          levantamientoEditandoId
            ? { id: offlineId, data: payload }
            : { data: payload }
        );
        upsertLevantamientoLocal({
          id_levantamiento_terreno: offlineId,
          centro_id: centroId,
          actividad_id: Number(actividadAsignadaActiva?.id_actividad || 0) || undefined,
          fecha_levantamiento: payload.fecha_levantamiento || todayInputDate(),
          region: payload.region || '',
          localidad: payload.localidad || '',
          codigo_ponton: payload.codigo_ponton || '',
          resumen: payload.resumen || '',
          observaciones: payload.observaciones || '',
          medicion_voltaje: payload.medicion_voltaje || '',
          medicion_corriente: payload.medicion_corriente || '',
          medicion_potencia: payload.medicion_potencia || '',
          fotos: payload.fotos || [],
          cliente: actividadAsignadaActiva?.centro?.cliente || centroSelForm?.cliente || levantamientoEditMeta?.cliente || '',
          centro: actividadAsignadaActiva?.centro?.nombre || centroSelForm?.nombre || levantamientoEditMeta?.centro || '',
          estado: 'pendiente_sync',
        });
        await removeCachedValue(informesDraftCacheKey);
        setShowLevantamientoModal(false);
        setLevantamientoEditandoId(null);
        setLevantamientoEditMeta(null);
        setLevantamientoResumen('');
        setLevantamientoObservaciones('');
        setLevantamientoVoltaje('');
        setLevantamientoCorriente('');
        setLevantamientoPotencia('');
        setLevantamientoFotos([]);
        setActividadAsignadaActiva(null);
        setTecnicosAsignadosExtra([]);
        Alert.alert('Levantamiento', 'Sin red. El levantamiento quedo pendiente para sincronizar.');
        return;
      }
      const backendMsg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'No se pudo guardar el levantamiento.';
      Alert.alert('Levantamiento', backendMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleSolicitarEdicionLevantamiento = async (item: LevantamientoTerreno) => {
    const id = Number(item?.id_levantamiento_terreno || 0);
    if (!id) return;
    const estado = estadoLevantamiento(item?.estado);
    if (!(estado === 'finalizado' || estado === 'edicion_rechazada')) return;
    Alert.alert(
      'Solicitar edicion',
      'Se enviara la solicitud para habilitar edicion de este levantamiento.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Solicitar',
          onPress: async () => {
            try {
              setSolicitandoEdicionLevantamientoId(id);
              await solicitarEdicionLevantamientoTerreno(id);
              await cargarLevantamientosTerreno();
              Alert.alert('Levantamiento', 'Solicitud de edicion enviada.');
            } catch (error: any) {
              const backendMsg =
                error?.response?.data?.error ||
                error?.response?.data?.message ||
                error?.message ||
                'No se pudo solicitar la edicion.';
              Alert.alert('Levantamiento', backendMsg);
            } finally {
              setSolicitandoEdicionLevantamientoId(null);
            }
          },
        },
      ]
    );
  };

  const handleEditarLevantamientoAutorizado = (item: LevantamientoTerreno) => {
    const id = Number(item?.id_levantamiento_terreno || 0);
    if (!id) return;
    setLevantamientoEditandoId(id);
    setLevantamientoEditMeta({
      centro_id: Number(item.centro_id || 0) || undefined,
      centro: item.centro,
      cliente: item.cliente || item.empresa,
      region: item.region,
      localidad: item.localidad,
      codigo_ponton: item.codigo_ponton,
    });
    setLevantamientoFecha(item.fecha_levantamiento || todayInputDate());
    setLevantamientoResumen(String(item.resumen || ''));
    setLevantamientoObservaciones(String(item.observaciones || ''));
    setLevantamientoVoltaje(String(item.medicion_voltaje || ''));
    setLevantamientoCorriente(String(item.medicion_corriente || ''));
    setLevantamientoPotencia(String(item.medicion_potencia || ''));
    setLevantamientoFotos(Array.isArray(item.fotos) ? item.fotos : []);
    setShowLevantamientoModal(true);
  };

  const handleSolicitarEdicionRetiro = (item: Permiso) => {
    const retiroId = Number(item?.id_retiro_terreno || 0) || null;
    if (!retiroId) return;
    const estado = estadoEdicionRetiro(item?.estado_edicion);
    if (!(estado === 'finalizado' || estado === 'edicion_rechazada')) return;
    Alert.alert('Solicitar edicion', 'Se enviara la solicitud de edicion para este retiro.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Solicitar',
        onPress: async () => {
          try {
            setSolicitandoEdicionRetiroId(retiroId);
            await solicitarEdicionRetiroTerreno(retiroId);
            await cargarRetirosTerreno();
            Alert.alert('Retiro', 'Solicitud de edicion enviada.');
          } catch (error: any) {
            const backendMsg =
              error?.response?.data?.error ||
              error?.response?.data?.message ||
              error?.message ||
              'No se pudo solicitar la edicion.';
            Alert.alert('Retiro', backendMsg);
          } finally {
            setSolicitandoEdicionRetiroId(null);
          }
        },
      },
    ]);
  };

	useEffect(() => {
	  cargarClientes();
	  cargarActividadesAsignadas();
	}, [token, cargarActividadesAsignadas]);

	useEffect(() => {
	  readCachedActividadesAsignadas(userId).then((cached) => {
	    if (Array.isArray(cached) && cached.length) {
	      setActividadesAsignadas(cached);
	    }
	  });
	}, [userId]);

  useEffect(() => {
    informesDraftRestoredRef.current = false;
    restoringInformesDraftRef.current = false;
  }, [userId]);

  useEffect(() => {
    if (!userId || informesDraftRestoredRef.current) return;
    informesDraftRestoredRef.current = true;
    readCachedValue<InformesDraft | null>(informesDraftCacheKey, null).then(({ value }) => {
      const draft = value;
      if (!draft) return;
      restoringInformesDraftRef.current = true;
      setModuloInforme(draft.moduloInforme || 'instalacion');
      setActividadAsignadaActiva(draft.actividadAsignadaActiva || null);
      setTecnicosAsignadosExtra(Array.isArray(draft.tecnicosAsignadosExtra) ? draft.tecnicosAsignadosExtra : []);
      setFirmasTecnicosExtra(Array.isArray(draft.firmasTecnicosExtra) ? draft.firmasTecnicosExtra : []);
      setMostrarInstalacionForm(!!draft.mostrarInstalacionForm);
      setShowEditor(!!draft.showEditor);
      setShowPermisoModal(!!draft.showPermisoModal);
      setShowRetiroChecklistModal(!!draft.showRetiroChecklistModal);
      setShowLevantamientoModal(!!draft.showLevantamientoModal);

      setActaSoloLectura(!!draft.acta?.actaSoloLectura);
      setEditId(Number(draft.acta?.editId || 0) || null);
      setClienteIdForm(Number(draft.acta?.clienteIdForm || 0) || null);
      setCentroIdForm(Number(draft.acta?.centroIdForm || 0) || null);
      setFechaRegistro(String(draft.acta?.fechaRegistro || ''));
      setTecnico1(String(draft.acta?.tecnico1 || ''));
      setFirmaTecnico1(String(draft.acta?.firmaTecnico1 || ''));
      setTecnico2(String(draft.acta?.tecnico2 || ''));
      setFirmaTecnico2(String(draft.acta?.firmaTecnico2 || ''));
      setRecepcionaNombre(String(draft.acta?.recepcionaNombre || ''));
      setFirmaRecepciona(String(draft.acta?.firmaRecepciona || ''));
      setEquiposConsiderados(String(draft.acta?.equiposConsiderados || ''));
      setCentroOrigenTraslado(String(draft.acta?.centroOrigenTraslado || ''));
      setTipoRegistroInstalacion(
        draft.acta?.tipoRegistroInstalacion === 'reapuntamiento' ? 'reapuntamiento' : 'instalacion'
      );
      setTipoInstalacion(draft.acta?.tipoInstalacion === 'informe_intervencion' ? 'informe_intervencion' : 'acta_entrega');
      setArmadoSeleccionadoId(Number(draft.acta?.armadoSeleccionadoId || 0) || null);
      setVinculoActaId(Number(draft.acta?.vinculoActaId || 0) || null);

      setPermisoContexto(
        draft.permiso?.permisoContexto === 'mantencion' || draft.permiso?.permisoContexto === 'retiro'
          ? draft.permiso.permisoContexto
          : 'instalacion'
      );
      setPermisoSoloLectura(!!draft.permiso?.permisoSoloLectura);
      setPermClienteId(Number(draft.permiso?.permClienteId || 0) || null);
      setPermCentroId(Number(draft.permiso?.permCentroId || 0) || null);
      setPermFecha(String(draft.permiso?.permFecha || todayInputDate()));
      setPermFechaSalida(String(draft.permiso?.permFechaSalida || ''));
      setPermResponsabilidad(String(draft.permiso?.permResponsabilidad || ''));
      setPermTecnico1(String(draft.permiso?.permTecnico1 || ''));
      setPermFirmaTecnico1(String(draft.permiso?.permFirmaTecnico1 || ''));
      setPermTecnico2(String(draft.permiso?.permTecnico2 || ''));
      setPermFirmaTecnico2(String(draft.permiso?.permFirmaTecnico2 || ''));
      setPermRecepciona(String(draft.permiso?.permRecepciona || ''));
      setPermRecepcionaRut(String(draft.permiso?.permRecepcionaRut || ''));
      setPermFirmaRecepciona(String(draft.permiso?.permFirmaRecepciona || ''));
      setPermPuntosGpsList(Array.isArray(draft.permiso?.permPuntosGpsList) && draft.permiso.permPuntosGpsList.length ? draft.permiso.permPuntosGpsList : [{ lat: '', lng: '' }]);
      setPermSellosList(Array.isArray(draft.permiso?.permSellosList) && draft.permiso.permSellosList.length ? draft.permiso.permSellosList : [{ ubicacion: '', numeroAnterior: '', numeroNuevo: '' }]);
      setPermMedicionFaseNeutro(String(draft.permiso?.permMedicionFaseNeutro || ''));
      setPermMedicionNeutroTierra(String(draft.permiso?.permMedicionNeutroTierra || ''));
      setPermHertz(String(draft.permiso?.permHertz || ''));
      setPermDescripcionTrabajo(String(draft.permiso?.permDescripcionTrabajo || ''));
      setPermEvidenciaFotos(Array.isArray(draft.permiso?.permEvidenciaFotos) ? draft.permiso.permEvidenciaFotos : []);
      setMantencionEditandoId(Number(draft.permiso?.mantencionEditandoId || 0) || null);
      setRetiroEditandoId(Number(draft.permiso?.retiroEditandoId || 0) || null);
      setRetiroTipo(draft.permiso?.retiroTipo === 'completo' ? 'completo' : 'parcial');
      setRetiroEstado(draft.permiso?.retiroEstado === 'retirado_centro' ? 'retirado_centro' : 'en_transito');
      setRetiroEquiposChecklist(Array.isArray(draft.permiso?.retiroEquiposChecklist) ? draft.permiso.retiroEquiposChecklist : []);
      setRetiroFormDirty(!!draft.permiso?.retiroFormDirty);
      setCambioEquipoEnabled(!!draft.permiso?.cambioEquipoEnabled);
      setEquipoCambioId(Number(draft.permiso?.equipoCambioId || 0) || null);
      setSerieNuevaCambio(String(draft.permiso?.serieNuevaCambio || ''));
      setMantencionChecklistEnabled(!!draft.permiso?.mantencionChecklistEnabled);
      setMantencionEquiposChecklist(Array.isArray(draft.permiso?.mantencionEquiposChecklist) ? draft.permiso.mantencionEquiposChecklist : []);

      setLevantamientoFecha(String(draft.levantamiento?.levantamientoFecha || todayInputDate()));
      setLevantamientoResumen(String(draft.levantamiento?.levantamientoResumen || ''));
      setLevantamientoObservaciones(String(draft.levantamiento?.levantamientoObservaciones || ''));
      setLevantamientoVoltaje(String(draft.levantamiento?.levantamientoVoltaje || ''));
      setLevantamientoCorriente(String(draft.levantamiento?.levantamientoCorriente || ''));
      setLevantamientoPotencia(String(draft.levantamiento?.levantamientoPotencia || ''));
      setLevantamientoFotos(Array.isArray(draft.levantamiento?.levantamientoFotos) ? draft.levantamiento.levantamientoFotos : []);
      setLevantamientoEditandoId(Number(draft.levantamiento?.levantamientoEditandoId || 0) || null);
      setLevantamientoEditMeta(draft.levantamiento?.levantamientoEditMeta || null);

      setTimeout(() => {
        restoringInformesDraftRef.current = false;
      }, 1500);
    });
  }, [userId, informesDraftCacheKey]);

  useFocusEffect(
    useCallback(() => {
      if (!token) return undefined;
      cargarActividadesAsignadas();
      return undefined;
    }, [token, cargarActividadesAsignadas])
  );

  useEffect(() => {
    if (!token) return;
    const onActividadUpdated = () => {
      cargarActividadesAsignadas({ force: true });
    };
    return subscribeActividadUpdated(onActividadUpdated);
  }, [token, cargarActividadesAsignadas]);

  useEffect(() => {
    if (!token || moduloInforme !== 'retiro') return;
    const timer = setInterval(() => {
      cargarRetirosTerreno();
    }, 12000);
    return () => clearInterval(timer);
  }, [token, moduloInforme, filtroCentroId, filtroFechaDesde, filtroFechaHasta]);

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
      (moduloInforme === 'retiro' && area.startsWith('retir')) ||
      (moduloInforme === 'levantamiento' && area.startsWith('levant'));
    if (!compatible) {
      setActividadAsignadaActiva(null);
      setTecnicosAsignadosExtra([]);
      setMostrarInstalacionForm(false);
    }
  }, [moduloInforme, actividadAsignadaActiva]);

  useEffect(() => {
    if (!actividadAsignadaActiva) return;
    if (restoringInformesDraftRef.current && !actividadesAsignadas.length) return;
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
    setShowLevantamientoModal(false);
    setLevantamientoEditandoId(null);
  }, [actividadesAsignadas, actividadAsignadaActiva]);

  useEffect(() => {
    const activeDraftOpen = showEditor || showPermisoModal || showRetiroChecklistModal || showLevantamientoModal;
    if (!userId) return;
    if (!activeDraftOpen) {
      removeCachedValue(informesDraftCacheKey).catch(() => {});
      return;
    }
    const draft: InformesDraft = {
      moduloInforme,
      actividadAsignadaActiva,
      tecnicosAsignadosExtra,
      firmasTecnicosExtra,
      showEditor,
      showPermisoModal,
      showRetiroChecklistModal,
      showLevantamientoModal,
      mostrarInstalacionForm,
      acta: {
        actaSoloLectura,
        editId,
        clienteIdForm,
        centroIdForm,
        fechaRegistro,
        tecnico1,
        firmaTecnico1,
        tecnico2,
        firmaTecnico2,
        recepcionaNombre,
        firmaRecepciona,
        equiposConsiderados,
        centroOrigenTraslado,
        tipoRegistroInstalacion,
        tipoInstalacion,
        armadoSeleccionadoId,
        vinculoActaId,
      },
      permiso: {
        permisoContexto,
        permisoSoloLectura,
        permClienteId,
        permCentroId,
        permFecha,
        permFechaSalida,
        permResponsabilidad,
        permTecnico1,
        permFirmaTecnico1,
        permTecnico2,
        permFirmaTecnico2,
        permRecepciona,
        permRecepcionaRut,
        permFirmaRecepciona,
        permPuntosGpsList,
        permSellosList,
        permMedicionFaseNeutro,
        permMedicionNeutroTierra,
        permHertz,
        permDescripcionTrabajo,
        permEvidenciaFotos,
        mantencionEditandoId,
        retiroEditandoId,
        retiroTipo,
        retiroEstado,
        retiroEquiposChecklist,
        retiroFormDirty,
        cambioEquipoEnabled,
        equipoCambioId,
        serieNuevaCambio,
        mantencionChecklistEnabled,
        mantencionEquiposChecklist,
      },
      levantamiento: {
        levantamientoFecha,
        levantamientoResumen,
        levantamientoObservaciones,
        levantamientoVoltaje,
        levantamientoCorriente,
        levantamientoPotencia,
        levantamientoFotos,
        levantamientoEditandoId,
        levantamientoEditMeta,
      },
    };
    const timer = setTimeout(() => {
      writeCachedValue(informesDraftCacheKey, draft).catch(() => {});
    }, 350);
    return () => clearTimeout(timer);
  }, [
    userId,
    informesDraftCacheKey,
    moduloInforme,
    actividadAsignadaActiva,
    tecnicosAsignadosExtra,
    firmasTecnicosExtra,
    showEditor,
    showPermisoModal,
    showRetiroChecklistModal,
    showLevantamientoModal,
    mostrarInstalacionForm,
    actaSoloLectura,
    editId,
    clienteIdForm,
    centroIdForm,
    fechaRegistro,
    tecnico1,
    firmaTecnico1,
    tecnico2,
    firmaTecnico2,
    recepcionaNombre,
    firmaRecepciona,
    equiposConsiderados,
    centroOrigenTraslado,
    tipoRegistroInstalacion,
    tipoInstalacion,
    armadoSeleccionadoId,
    vinculoActaId,
    permisoContexto,
    permisoSoloLectura,
    permClienteId,
    permCentroId,
    permFecha,
    permFechaSalida,
    permResponsabilidad,
    permTecnico1,
    permFirmaTecnico1,
    permTecnico2,
    permFirmaTecnico2,
    permRecepciona,
    permRecepcionaRut,
    permFirmaRecepciona,
    permPuntosGpsList,
    permSellosList,
    permMedicionFaseNeutro,
    permMedicionNeutroTierra,
    permHertz,
    permDescripcionTrabajo,
    permEvidenciaFotos,
    mantencionEditandoId,
    retiroEditandoId,
    retiroTipo,
    retiroEstado,
    retiroEquiposChecklist,
    retiroFormDirty,
    cambioEquipoEnabled,
    equipoCambioId,
    serieNuevaCambio,
    mantencionChecklistEnabled,
    mantencionEquiposChecklist,
    levantamientoFecha,
    levantamientoResumen,
    levantamientoObservaciones,
    levantamientoVoltaje,
    levantamientoCorriente,
    levantamientoPotencia,
    levantamientoFotos,
    levantamientoEditandoId,
    levantamientoEditMeta,
  ]);

  useEffect(() => {
    cargarActas();
    cargarPermisos();
    cargarMantencionesTerreno();
    cargarRetirosTerreno();
    cargarLevantamientosTerreno();
  }, [moduloInforme, tipoInstalacion, filtroCentroId, filtroFechaDesde, filtroFechaHasta]);

  useEffect(() => {
    if (!permClienteId) {
      setPermCentros([]);
      setPermCentroId(null);
      return;
    }
    fetchCentrosPorCliente(permClienteId)
      .then((lista) => {
        const rows = Array.isArray(lista) ? lista : [];
        setPermCentros(rows);
        writeCachedValue(centrosCacheKey(permClienteId), rows).catch(() => {});
      })
      .catch(async () => {
        const cached = await readCachedValue<Centro[]>(centrosCacheKey(permClienteId), []);
        setPermCentros(Array.isArray(cached.value) ? cached.value : []);
      });
  }, [permClienteId, centrosCacheKey]);

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
    setPermBaseTierra(normalizarBaseTierra(permCentroSel.base_tierra));
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
    const extrasFirmas = parseFirmasTecnicosAdicionales(actaCentroSeleccionado.firmas_tecnicos_adicionales);
    setPermFecha(toInputDate(actaCentroSeleccionado.fecha_registro) || todayInputDate());
    setPermTecnico1(actaCentroSeleccionado.tecnico_1 || '');
    setPermTecnico2(actaCentroSeleccionado.tecnico_2 || '');
    setPermRecepciona(actaCentroSeleccionado.recepciona_nombre || '');
    setFirmasTecnicosExtra(extrasFirmas);
    setTecnicosAsignadosExtra(extrasFirmas.map((item) => String(item.nombre || '').trim()).filter(Boolean));
  }, [actaCentroSeleccionado, permisoContexto]);
  useEffect(() => {
    if (permisoContexto !== 'instalacion') return;
    if (!permisoCentroSeleccionado) return;
    const recepcionaActual = String(permisoCentroSeleccionado.recepciona_nombre || '').trim();
    const extrasFirmados = parseFirmasTecnicosAdicionales(permisoCentroSeleccionado.firmas_tecnicos_adicionales);
    const extrasActa = parseFirmasTecnicosAdicionales(actaCentroSeleccionado?.firmas_tecnicos_adicionales);
    const extrasBase = extrasFirmados.length ? extrasFirmados : extrasActa;
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
    setPermBaseTierra(normalizarBaseTierra(permCentroSel?.base_tierra));
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
    setPermRecepciona(
      recepcionaActual.length > 1
        ? recepcionaActual
        : String(actaCentroSeleccionado?.recepciona_nombre || recepcionaActual || '')
    );
    setPermRecepcionaRut(permisoCentroSeleccionado.recepciona_rut || '');
    setPermFirmaRecepciona(permisoCentroSeleccionado.firma_recepciona || '');
    setFirmasTecnicosExtra(extrasBase);
    setTecnicosAsignadosExtra(extrasBase.map((item) => String(item.nombre || '').trim()).filter(Boolean));
  }, [permisoCentroSeleccionado, permCentroSel, permisoContexto, actaCentroSeleccionado]);
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
    setPermBaseTierra(normalizarBaseTierra(permCentroSel?.base_tierra));
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
    const base = retiroEditandoSeleccionado || permCentroSel || null;
    if (!base) return;
    const editingRetiro = !!retiroEditandoId && !!retiroEditandoSeleccionado;
    if (editingRetiro && retiroFormDirty) return;
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
    setPermCorreoCentro(String(permCentroSel?.correo_centro || permCentroSel?.correo || selectedRetiro?.correo_centro || ''));
    setPermTelefonoCentro(String(permCentroSel?.telefono || permCentroSel?.telefono_centro || selectedRetiro?.telefono_centro || ''));
    setPermRegion(String(permCentroSel?.area || permCentroSel?.region || selectedRetiro?.region || ''));
    setPermLocalidad(String(permCentroSel?.ubicacion || permCentroSel?.localidad || permCentroSel?.direccion || selectedRetiro?.localidad || ''));
    setPermBaseTierra(normalizarBaseTierra(permCentroSel?.base_tierra ?? selectedRetiro?.base_tierra));
    setPermCantidadRadares(String(permCentroSel?.cantidad_radares ?? selectedRetiro?.cantidad_radares ?? ''));
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
  }, [retiroEditandoId, retiroEditandoSeleccionado, permCentroSel, permisoContexto, actividadAsignadaActiva, retiroFormDirty]);

  useEffect(() => {
    if (permisoContexto !== 'retiro') return;
    if (retiroEditandoId && retiroFormDirty) return;
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
        modalidad_retorno: normalizarModalidadRetorno(
          eq.modalidad_retorno || retiroEditandoSeleccionado?.estado_logistico
        ),
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
          modalidad_retorno: 'despacho_orca',
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
        modalidad_retorno: 'despacho_orca',
      }))
    );
  }, [equiposCentro, retiroEditandoSeleccionado, permisoContexto, retiroEditandoId, retiroFormDirty]);

  useEffect(() => {
    const selected = retiroEquiposChecklist.filter((item) => !!item.retirado);
    if (!selected.length) {
      setRetiroEstado('en_transito');
      return;
    }
    const tieneDespacho = selected.some(
      (item) => normalizarModalidadRetorno(item.modalidad_retorno) === 'despacho_orca'
    );
    setRetiroEstado(tieneDespacho ? 'en_transito' : 'retirado_centro');
  }, [retiroEquiposChecklist]);

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
    setActaSoloLectura(false);
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
    setPermisoSoloLectura(false);
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
    setRetiroChecklistReadMeta(null);
    setRetiroFormDirty(false);
    setEvidenciaTargetIndex(null);
    setCambioEquipoEnabled(false);
    setEquipoCambioId(null);
    setSerieNuevaCambio('');
    setMantencionChecklistEnabled(false);
    setMantencionEquiposChecklist([]);
    setMantencionChecklistQuery('');
    setLevantamientoFecha(todayInputDate());
    setLevantamientoResumen('');
    setLevantamientoObservaciones('');
    setLevantamientoVoltaje('');
    setLevantamientoCorriente('');
    setLevantamientoPotencia('');
    setLevantamientoFotos([]);
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
    setActaSoloLectura(false);
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
    const centroAsignado = actividadAsignadaActiva?.centro || permCentroSel || null;
    const asignados = Array.isArray(actividadAsignadaActiva?.tecnicos_asignados)
      ? actividadAsignadaActiva?.tecnicos_asignados || []
      : [];
    const tecnicoPrincipal = String(
      actividadAsignadaActiva?.encargado_principal?.nombre_encargado ||
        asignados?.[0]?.nombre_encargado ||
        ''
    ).trim();
    const tecnicoAyudante = String(
      actividadAsignadaActiva?.encargado_ayudante?.nombre_encargado ||
        asignados?.[1]?.nombre_encargado ||
        ''
    ).trim();
    const extras = asignados
      .map((t) => String(t?.nombre_encargado || '').trim())
      .filter((name) => !!name && name !== tecnicoPrincipal && name !== tecnicoAyudante);

    resetForm();
    setActaSoloLectura(false);
    setEditId(null);
    setClienteIdForm(clienteSeleccionado || null);
    setCentroIdForm(centroSeleccionado || null);
    setFechaRegistro(todayInputDate());
    setCodigoPontonActa(String(centroAsignado?.nombre_ponton || ''));
    setRegion(String(centroAsignado?.area || centroAsignado?.region || ''));
    setLocalidad(
      String(
        centroAsignado?.ubicacion ||
          centroAsignado?.localidad ||
          centroAsignado?.direccion ||
          ''
      )
    );
    setTecnicosAsignadosExtra(extras);
    setFirmasTecnicosExtra(extras.map((nombre) => ({ nombre, firma: '' })));
    if (tecnicoPrincipal) setTecnico1(tecnicoPrincipal);
    if (tecnicoAyudante) setTecnico2(tecnicoAyudante);
    setShowEditor(true);
  };

  const abrirRetiroEquiposModal = () => {
    if (permisoFormularioSoloLectura) {
      setRetiroChecklistReadOnly(retiroEquiposChecklist);
      setRetiroChecklistReadMeta({
        tipo: retiroTipo,
        estado: retiroEstado,
      });
      setShowRetiroChecklistReadModal(true);
      return;
    }
    setShowRetiroChecklistModal(true);
  };

  const actualizarTipoRetiro = (tipo: 'parcial' | 'completo') => {
    setRetiroFormDirty(true);
    setRetiroTipo(tipo);
    if (tipo === 'completo') {
      setRetiroEquiposChecklist((prev) =>
        prev.map((row) => ({
          ...row,
          retirado: true,
          modalidad_retorno: row.modalidad_retorno || 'despacho_orca',
        }))
      );
    }
  };

  const actualizarModalidadRetiroEquipo = (
    index: number,
    modalidad: 'por_mano' | 'despacho_orca'
  ) => {
    setRetiroFormDirty(true);
    setRetiroEquiposChecklist((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              retirado: true,
              modalidad_retorno: modalidad,
            }
          : row
      )
    );
  };

  const abrirActa = (acta: Acta, soloLectura = true) => {
    setActaSoloLectura(soloLectura);
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
      await cargarActas({ force: true });
      await cargarActividadesAsignadas({ force: true });
      await removeCachedValue(informesDraftCacheKey);
      setShowEditor(false);
      resetForm();
      Alert.alert('Informes', 'Acta guardada correctamente.');
    } catch (error: any) {
      if (isOfflineQueueableError(error)) {
        const offlineId = editId || offlineTempId();
        await enqueueOfflineOp(
          editId ? 'update_acta' : 'create_acta',
          editId
            ? { id: offlineId, data: payload }
            : { data: payload }
        );
        upsertActaLocal({
          id_acta_entrega: offlineId,
          centro_id: centroIdForm || undefined,
          actividad_id: Number(actividadAsignadaActiva?.id_actividad || 0) || undefined,
          cliente_id: clienteIdForm || undefined,
          empresa: clienteForm?.nombre || clienteForm?.razon_social || actividadAsignadaActiva?.centro?.cliente || '',
          cliente: clienteForm?.nombre || clienteForm?.razon_social || actividadAsignadaActiva?.centro?.cliente || '',
          centro: centroSelForm?.nombre || actividadAsignadaActiva?.centro?.nombre || '',
          fecha_registro: payload.fecha_registro || todayInputDate(),
          codigo_ponton: payload.codigo_ponton || '',
          region: payload.region || '',
          localidad: payload.localidad || '',
          tecnico_1: payload.tecnico_1 || '',
          firma_tecnico_1: payload.firma_tecnico_1 || '',
          tecnico_2: payload.tecnico_2 || '',
          firma_tecnico_2: payload.firma_tecnico_2 || '',
          firmas_tecnicos_adicionales: payload.firmas_tecnicos_adicionales || [],
          recepciona_nombre: payload.recepciona_nombre || '',
          firma_recepciona: payload.firma_recepciona || '',
          equipos_considerados: payload.equipos_considerados || '',
          centro_origen_traslado: payload.centro_origen_traslado || '',
          armado_id: payload.armado_id || undefined,
          tipo_instalacion: payload.tipo_instalacion || 'instalacion',
          updated_at: new Date().toISOString(),
        });
        await removeCachedValue(informesDraftCacheKey);
        setShowEditor(false);
        resetForm();
        Alert.alert('Informes', 'Sin red. El acta quedo pendiente para sincronizar.');
        return;
      }
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
            await cargarActas({ force: true });
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
      await cargarActas({ force: true });
      setArmadoSeleccionadoId(armadoId);
      setShowArmadosModal(false);
      setVinculoActaId(targetActaId);
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

  const abrirArmadoEquipos = async (soloLectura = false) => {
    const targetActa = actaObjetivoSeleccionada;
    const targetActaId = Number(vinculoActaId || targetActa?.id_acta_entrega || 0) || null;
    const targetCentroId = Number(targetActa?.centro_id || permCentroId || 0) || null;
    if (!targetActaId || !targetCentroId) {
      Alert.alert('Instalacion', 'Primero debes tener un acta vinculada al centro.');
      return;
    }

    setLoadingArmadoEquipos(true);
    try {
      const equipos = await getEquipos(targetCentroId);
      const lista = Array.isArray(equipos) ? equipos : [];
      const base = lista
        .filter((eq) => String(eq?.estado_registro || 'normal').trim().toLowerCase() !== 'no_aplica')
        .map((eq) => ({
          equipo_id: Number(eq?.id_equipo || 0) || null,
          nombre: String(eq?.nombre || '').trim() || null,
          codigo: String(eq?.codigo || '').trim() || null,
          numero_serie: String(eq?.numero_serie || '').trim() || null,
          caja: String(eq?.caja || '').trim() || null,
        }));

      const existentes = parseActaArmadoEquipos(targetActa?.armado_equipos);
      const existentesMap = new Map(existentes.map((item) => [buildActaArmadoEquipoKey(item), item]));

      const merged = base.map((item) => {
        const key = buildActaArmadoEquipoKey(item);
        const previo = existentesMap.get(key);
        const estadoUso = String(previo?.estado_uso || 'instalado').trim().toLowerCase();
        return {
          ...item,
          estado_uso: estadoUso === 'devuelto_bodega' ? 'devuelto_bodega' : 'instalado',
          estado_logistico:
            estadoUso === 'devuelto_bodega'
              ? String(previo?.estado_logistico || 'en_transito_bodega').trim().toLowerCase()
              : 'sin_movimiento',
          observacion: String(previo?.observacion || '').trim() || null,
        } as ActaArmadoEquipo;
      });

      const mergedKeys = new Set(merged.map((item) => buildActaArmadoEquipoKey(item)));
      const extras = existentes.filter((item) => !mergedKeys.has(buildActaArmadoEquipoKey(item)));
      const finalList = [...merged, ...extras].sort((a, b) => {
        const cajaA = String(a.caja || '').toLowerCase();
        const cajaB = String(b.caja || '').toLowerCase();
        if (cajaA !== cajaB) return cajaA.localeCompare(cajaB);
        return String(a.nombre || '').localeCompare(String(b.nombre || ''));
      });

      setArmadoEquiposActa(finalList);
      setArmadoEquiposSoloLectura(soloLectura);
      setShowArmadoEquiposModal(true);
    } catch (error: any) {
      const backendMsg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'No se pudieron cargar los equipos del armado.';
      Alert.alert('Instalacion', backendMsg);
    } finally {
      setLoadingArmadoEquipos(false);
    }
  };

  const actualizarEstadoArmadoEquipo = (
    index: number,
    estadoUso: 'instalado' | 'devuelto_bodega'
  ) => {
    setArmadoEquiposActa((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              estado_uso: estadoUso,
              estado_logistico: estadoUso === 'devuelto_bodega' ? 'en_transito_bodega' : 'sin_movimiento',
            }
          : item
      )
    );
  };

  const guardarArmadoEquiposActa = async () => {
    const targetActaId = Number(vinculoActaId || actaObjetivoSeleccionada?.id_acta_entrega || 0) || null;
    if (!targetActaId) {
      Alert.alert('Instalacion', 'No se encontro el acta para guardar el detalle del armado.');
      return;
    }
    setSavingArmadoEquipos(true);
    try {
      const resp = await updateActaEntrega(targetActaId, {
        armado_equipos: armadoEquiposActa,
        movimiento_tecnico_id: userId || undefined,
      });
      const actaActualizada = resp?.acta || null;
      if (actaActualizada && Number(actaActualizada.id_acta_entrega || 0) === Number(targetActaId)) {
        setActas((prev) =>
          prev.map((item) =>
            Number(item.id_acta_entrega || 0) === Number(targetActaId)
              ? { ...item, ...actaActualizada }
              : item
          )
        );
      }
      setArmadoEquiposGuardadoActas((prev) =>
        prev.includes(Number(targetActaId)) ? prev : [...prev, Number(targetActaId)]
      );
      await cargarActas({ force: true });
      setVinculoSoloLectura(true);
      setArmadoEquiposSoloLectura(true);
      setShowArmadoEquiposModal(false);
      const devueltos = armadoEquiposActa.filter((item) => String(item.estado_uso || '') === 'devuelto_bodega').length;
      Alert.alert(
        'Instalacion',
        devueltos > 0
          ? `Detalle guardado. ${devueltos} equipo(s) quedaron en transito hacia bodega.`
          : 'Detalle del armado guardado.'
      );
    } catch (error: any) {
      const backendMsg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'No se pudo guardar el detalle del armado.';
      Alert.alert('Instalacion', backendMsg);
    } finally {
      setSavingArmadoEquipos(false);
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
    if (
      actaSoloLectura &&
      (target === 'tecnico1' ||
        target === 'tecnico2' ||
        target === 'tecnico_extra' ||
        target === 'recepciona')
    ) {
      return;
    }
    if (
      permisoFormularioSoloLectura &&
      (target === 'perm_recepciona' || target === 'perm_tecnico1' || target === 'perm_tecnico2')
    ) {
      return;
    }
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
    if (
      actaSoloLectura &&
      (target === 'tecnico1' ||
        target === 'tecnico2' ||
        target === 'tecnico_extra' ||
        target === 'recepciona')
    ) {
      return;
    }
    if (
      permisoFormularioSoloLectura &&
      (target === 'perm_recepciona' || target === 'perm_tecnico1' || target === 'perm_tecnico2')
    ) {
      return;
    }
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
          <View pointerEvents="none" style={styles.heroGlowPrimary} />
          <View pointerEvents="none" style={styles.heroGlowSecondary} />
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}><Ionicons name="document-text-outline" size={18} color="#fff" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Informes</Text>
              <Text style={styles.heroSubtitle}>Gestion operativa por centro</Text>
            </View>
            <View style={styles.heroBadge}>
              <Ionicons name="shield-checkmark-outline" size={15} color="#d8ffe7" />
            </View>
          </View>
          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaPill}>
              <Ionicons name="calendar-outline" size={12} color="#9fd7ff" />
              <Text style={styles.heroMetaText}>{actividadesProgramadas.length} programados</Text>
            </View>
            <View style={styles.heroMetaPill}>
              <Ionicons name="sync-outline" size={12} color="#9fd7ff" />
              <Text style={styles.heroMetaText}>{totalActividadesEnProcesoVisible} en proceso</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.categoryLabel}>CATEGORIAS</Text>
          <View style={styles.categoryRow}>
            <Pressable style={[styles.tabBtn, styles.categoryTabBtn, moduloInforme === 'instalacion' && styles.tabBtnActive]} onPress={() => setModuloInforme('instalacion')}>
              <Ionicons name="construct-outline" size={14} color={moduloInforme === 'instalacion' ? '#fff' : '#1d4ed8'} />
              <Text style={[styles.tabBtnText, moduloInforme === 'instalacion' && styles.tabBtnTextActive]}>Instalacion</Text>
            </Pressable>
            <Pressable style={[styles.tabBtn, styles.categoryTabBtn, moduloInforme === 'mantencion' && styles.tabBtnActive]} onPress={() => setModuloInforme('mantencion')}>
              <Ionicons name="build-outline" size={14} color={moduloInforme === 'mantencion' ? '#fff' : '#1d4ed8'} />
              <Text style={[styles.tabBtnText, moduloInforme === 'mantencion' && styles.tabBtnTextActive]}>Mantenciones</Text>
            </Pressable>
            <Pressable style={[styles.tabBtn, styles.categoryTabBtn, moduloInforme === 'retiro' && styles.tabBtnActive]} onPress={() => setModuloInforme('retiro')}>
              <Ionicons name="exit-outline" size={14} color={moduloInforme === 'retiro' ? '#fff' : '#1d4ed8'} />
              <Text style={[styles.tabBtnText, moduloInforme === 'retiro' && styles.tabBtnTextActive]}>Retiro</Text>
            </Pressable>
            <Pressable style={[styles.tabBtn, styles.categoryTabBtn, moduloInforme === 'levantamiento' && styles.tabBtnActive]} onPress={() => setModuloInforme('levantamiento')}>
              <Ionicons name="map-outline" size={14} color={moduloInforme === 'levantamiento' ? '#fff' : '#1d4ed8'} />
              <Text style={[styles.tabBtnText, moduloInforme === 'levantamiento' && styles.tabBtnTextActive]}>Levantamiento</Text>
            </Pressable>
          </View>
        </View>

        {mostrarTrabajosTerreno ? (
          <View style={styles.card}>
            <View style={styles.assignedHeader}>
              <Text style={styles.sectionTitle}>Trabajos de terreno</Text>
              {loadingActividadesAsignadas ? <ActivityIndicator size="small" color="#1d4ed8" /> : null}
            </View>
            <Text style={styles.rowMeta}>
              {mostrarAsignadasCompletadas
                ? `Programados: ${actividadesProgramadas.length} | En proceso: ${totalActividadesEnProcesoVisible} | Completados: ${actividadesCompletadas.length}`
                : `Programados: ${actividadesProgramadas.length} | En proceso: ${totalActividadesEnProcesoVisible}`}
            </Text>

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
        ) : null}

        {moduloInforme === 'levantamiento' && (actividadAsignadaActiva || levantamientoEditandoId) ? (
          <View style={styles.card}>
            <View style={styles.assignedHeader}>
              <Text style={styles.sectionTitle}>Formulario de levantamiento</Text>
              <Pressable
                onPress={() => {
                  setShowLevantamientoModal(false);
                  setLevantamientoEditandoId(null);
                  setLevantamientoEditMeta(null);
                }}>
                <Ionicons name="close" size={20} color="#334155" />
              </Pressable>
            </View>
            {showLevantamientoModal && !levantamientoEditandoId ? (
              <>
                <View style={styles.levantamientoInfoCard}>
                  <Text style={styles.levantamientoInfoTitle}>
                    {levantamientoEditMeta?.centro || centroSelForm?.nombre || actividadAsignadaActiva?.centro?.nombre || 'Centro asignado'}
                  </Text>
                  <Text style={styles.rowMeta}>
                    Cliente: {levantamientoEditMeta?.cliente || clienteForm?.nombre || clienteForm?.razon_social || actividadAsignadaActiva?.centro?.cliente || '-'}
                  </Text>
                  <View style={styles.levantamientoTwoCols}>
                    <View style={styles.inputCol}>
                      <Text style={styles.selectLabel}>Fecha</Text>
                      <TextInput style={[styles.input, styles.inputDisabled]} editable={false} value={formatDate(levantamientoFecha)} />
                    </View>
                    <View style={styles.inputCol}>
                      <Text style={styles.selectLabel}>Region / Area</Text>
                      <TextInput style={[styles.input, styles.inputDisabled]} editable={false} value={region || levantamientoEditMeta?.region || String(centroSelForm?.area || centroSelForm?.region || '')} />
                    </View>
                  </View>
                  <View style={styles.levantamientoTwoCols}>
                    <View style={styles.inputCol}>
                      <Text style={styles.selectLabel}>Localidad</Text>
                      <TextInput style={[styles.input, styles.inputDisabled]} editable={false} value={localidad || levantamientoEditMeta?.localidad || String(centroSelForm?.ubicacion || centroSelForm?.localidad || '')} />
                    </View>
                    <View style={styles.inputCol}>
                      <Text style={styles.selectLabel}>Codigo ponton</Text>
                      <TextInput style={[styles.input, styles.inputDisabled]} editable={false} value={codigoPontonActa || levantamientoEditMeta?.codigo_ponton || String(centroSelForm?.nombre_ponton || '')} />
                    </View>
                  </View>
                </View>

                <View style={styles.levantamientoBlock}>
                  <Text style={styles.levantamientoBlockTitle}>Registro general</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={levantamientoResumen}
                    onChangeText={setLevantamientoResumen}
                    placeholder="Describe el levantamiento realizado..."
                    multiline
                    textAlignVertical="top"
                  />
                  <TextInput
                    style={[styles.input, styles.levantamientoTextAreaSmall]}
                    value={levantamientoObservaciones}
                    onChangeText={setLevantamientoObservaciones}
                    placeholder="Observaciones adicionales..."
                    multiline
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.levantamientoBlock}>
                  <Text style={styles.levantamientoBlockTitle}>Mediciones de energia opcionales</Text>
                  <View style={styles.levantamientoThreeCols}>
                    <View style={styles.inputCol}>
                      <Text style={styles.selectLabel}>Voltaje</Text>
                      <TextInput style={styles.input} value={levantamientoVoltaje} onChangeText={setLevantamientoVoltaje} placeholder="Ej: 220V" />
                    </View>
                    <View style={styles.inputCol}>
                      <Text style={styles.selectLabel}>Corriente</Text>
                      <TextInput style={styles.input} value={levantamientoCorriente} onChangeText={setLevantamientoCorriente} placeholder="Ej: 10A" />
                    </View>
                    <View style={styles.inputCol}>
                      <Text style={styles.selectLabel}>Potencia</Text>
                      <TextInput style={styles.input} value={levantamientoPotencia} onChangeText={setLevantamientoPotencia} placeholder="Ej: 2.2kW" />
                    </View>
                  </View>
                </View>

                <View style={styles.levantamientoBlock}>
                  <View style={styles.assignedHeader}>
                    <Text style={styles.levantamientoBlockTitle}>Fotos del levantamiento</Text>
                    <Pressable
                      style={styles.levantamientoPhotoAddBtn}
                      onPress={async () => {
                        if (!cameraPermission?.granted) {
                          const req = await requestCameraPermission();
                          if (!req.granted) {
                            Alert.alert('Levantamiento', 'Debes autorizar la camara para capturar fotos.');
                            return;
                          }
                        }
                        setCameraTarget('levantamiento');
                        setEvidenciaTargetIndex(null);
                        setShowCameraModal(true);
                      }}>
                      <Ionicons name="camera-outline" size={16} color="#1d4ed8" />
                    </Pressable>
                  </View>
                  {levantamientoFotos.length ? (
                    <View style={styles.evidenciaGrid}>
                      {levantamientoFotos.map((foto, idx) => (
                        <View key={`lev-foto-${idx}`} style={styles.evidenciaItem}>
                          <Image source={{ uri: foto.uri }} style={styles.evidenciaPreview} resizeMode="cover" />
                          <TextInput
                            style={[styles.input, styles.levantamientoTextAreaSmall, { marginTop: 8 }]}
                            value={foto.descripcion}
                            onChangeText={(text) =>
                              setLevantamientoFotos((prev) => prev.map((item, i) => (i === idx ? { ...item, descripcion: text } : item)))
                            }
                            placeholder="Descripcion de la foto..."
                            multiline
                            textAlignVertical="top"
                          />
                          <View style={styles.evidenciaActions}>
                            <Pressable
                              style={styles.firmaBtn}
                              onPress={async () => {
                                if (!cameraPermission?.granted) {
                                  const req = await requestCameraPermission();
                                  if (!req.granted) {
                                    Alert.alert('Levantamiento', 'Debes autorizar la camara para capturar fotos.');
                                    return;
                                  }
                                }
                                setCameraTarget('levantamiento');
                                setEvidenciaTargetIndex(idx);
                                setShowCameraModal(true);
                              }}>
                              <Text style={styles.firmaBtnText}>Reemplazar</Text>
                            </Pressable>
                            <Pressable
                              style={styles.firmaClearBtn}
                              onPress={() => setLevantamientoFotos((prev) => prev.filter((_, i) => i !== idx))}>
                              <Ionicons name="trash-outline" size={14} color="#dc2626" />
                            </Pressable>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.signatureEmptyText}>Sin fotos registradas</Text>
                  )}
                </View>

                <Pressable
                  style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                  disabled={saving}
                  onPress={handleGuardarLevantamiento}>
                  <Text style={styles.saveBtnText}>
                    {saving ? 'Guardando...' : levantamientoEditandoId ? 'Guardar edicion' : 'Finalizar levantamiento'}
                  </Text>
                </Pressable>
              </>
            ) : actividadAsignadaActiva && !levantamientoEditandoId ? (
              <Pressable style={styles.assignedItem} onPress={() => setShowLevantamientoModal(true)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.assignedItemTitle}>
                    {centroSelForm?.nombre || actividadAsignadaActiva.centro?.nombre || 'Levantamiento seleccionado'}
                  </Text>
                  <Text style={styles.assignedItemMeta}>Formulario cerrado temporalmente</Text>
                </View>
                <View style={[styles.assignedActionPill, styles.assignedActionPillProgress]}>
                  <Ionicons name="sync-outline" size={14} color="#92400e" />
                  <Text style={[styles.assignedActionText, styles.assignedActionTextProgress]}>Continuar</Text>
                </View>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {moduloInforme === 'levantamiento' && !!levantamientoEditandoId && showLevantamientoModal ? (
          <Modal visible transparent animationType="fade" onRequestClose={() => setShowLevantamientoModal(false)}>
            <View style={styles.levModalOverlay}>
              <View style={styles.levModalCard}>
                <View style={styles.assignedHeader}>
                  <Text style={styles.sectionTitle}>Editar levantamiento</Text>
                  <Pressable
                    onPress={() => {
                      setShowLevantamientoModal(false);
                      setLevantamientoEditandoId(null);
                      setLevantamientoEditMeta(null);
                    }}>
                    <Ionicons name="close" size={20} color="#334155" />
                  </Pressable>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.levantamientoInfoCard}>
                    <Text style={styles.levantamientoInfoTitle}>
                      {levantamientoEditMeta?.centro || centroSelForm?.nombre || actividadAsignadaActiva?.centro?.nombre || 'Centro asignado'}
                    </Text>
                    <Text style={styles.rowMeta}>
                      Cliente: {levantamientoEditMeta?.cliente || clienteForm?.nombre || clienteForm?.razon_social || actividadAsignadaActiva?.centro?.cliente || '-'}
                    </Text>
                    <View style={styles.levantamientoTwoCols}>
                      <View style={styles.inputCol}>
                        <Text style={styles.selectLabel}>Fecha</Text>
                        <TextInput style={[styles.input, styles.inputDisabled]} editable={false} value={formatDate(levantamientoFecha)} />
                      </View>
                      <View style={styles.inputCol}>
                        <Text style={styles.selectLabel}>Region / Area</Text>
                        <TextInput style={[styles.input, styles.inputDisabled]} editable={false} value={region || levantamientoEditMeta?.region || String(centroSelForm?.area || centroSelForm?.region || '')} />
                      </View>
                    </View>
                    <View style={styles.levantamientoTwoCols}>
                      <View style={styles.inputCol}>
                        <Text style={styles.selectLabel}>Localidad</Text>
                        <TextInput style={[styles.input, styles.inputDisabled]} editable={false} value={localidad || levantamientoEditMeta?.localidad || String(centroSelForm?.ubicacion || centroSelForm?.localidad || '')} />
                      </View>
                      <View style={styles.inputCol}>
                        <Text style={styles.selectLabel}>Codigo ponton</Text>
                        <TextInput style={[styles.input, styles.inputDisabled]} editable={false} value={codigoPontonActa || levantamientoEditMeta?.codigo_ponton || String(centroSelForm?.nombre_ponton || '')} />
                      </View>
                    </View>
                  </View>

                  <View style={styles.levantamientoBlock}>
                    <Text style={styles.levantamientoBlockTitle}>Registro general</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={levantamientoResumen}
                      onChangeText={setLevantamientoResumen}
                      placeholder="Describe el levantamiento realizado..."
                      multiline
                      textAlignVertical="top"
                    />
                    <TextInput
                      style={[styles.input, styles.levantamientoTextAreaSmall]}
                      value={levantamientoObservaciones}
                      onChangeText={setLevantamientoObservaciones}
                      placeholder="Observaciones adicionales..."
                      multiline
                      textAlignVertical="top"
                    />
                  </View>

                  <View style={styles.levantamientoBlock}>
                    <Text style={styles.levantamientoBlockTitle}>Mediciones de energia opcionales</Text>
                    <View style={styles.levantamientoThreeCols}>
                      <View style={styles.inputCol}>
                        <Text style={styles.selectLabel}>Voltaje</Text>
                        <TextInput style={styles.input} value={levantamientoVoltaje} onChangeText={setLevantamientoVoltaje} placeholder="Ej: 220V" />
                      </View>
                      <View style={styles.inputCol}>
                        <Text style={styles.selectLabel}>Corriente</Text>
                        <TextInput style={styles.input} value={levantamientoCorriente} onChangeText={setLevantamientoCorriente} placeholder="Ej: 10A" />
                      </View>
                      <View style={styles.inputCol}>
                        <Text style={styles.selectLabel}>Potencia</Text>
                        <TextInput style={styles.input} value={levantamientoPotencia} onChangeText={setLevantamientoPotencia} placeholder="Ej: 2.2kW" />
                      </View>
                    </View>
                  </View>

                  <View style={styles.levantamientoBlock}>
                    <View style={styles.assignedHeader}>
                      <Text style={styles.levantamientoBlockTitle}>Fotos del levantamiento</Text>
                      <Pressable
                        style={styles.levantamientoPhotoAddBtn}
                        onPress={async () => {
                          if (!cameraPermission?.granted) {
                            const req = await requestCameraPermission();
                            if (!req.granted) {
                              Alert.alert('Levantamiento', 'Debes autorizar la camara para capturar fotos.');
                              return;
                            }
                          }
                          setCameraTarget('levantamiento');
                          setEvidenciaTargetIndex(null);
                          setShowCameraModal(true);
                        }}>
                        <Ionicons name="camera-outline" size={16} color="#1d4ed8" />
                      </Pressable>
                    </View>
                    {levantamientoFotos.length ? (
                      <View style={styles.evidenciaGrid}>
                        {levantamientoFotos.map((foto, idx) => (
                          <View key={`lev-edit-foto-${idx}`} style={styles.evidenciaItem}>
                            <Image source={{ uri: foto.uri }} style={styles.evidenciaPreview} resizeMode="cover" />
                            <TextInput
                              style={[styles.input, styles.levantamientoTextAreaSmall, { marginTop: 8 }]}
                              value={foto.descripcion}
                              onChangeText={(text) =>
                                setLevantamientoFotos((prev) => prev.map((item, i) => (i === idx ? { ...item, descripcion: text } : item)))
                              }
                              placeholder="Descripcion de la foto..."
                              multiline
                              textAlignVertical="top"
                            />
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.signatureEmptyText}>Sin fotos registradas</Text>
                    )}
                  </View>

                  <Pressable
                    style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                    disabled={saving}
                    onPress={handleGuardarLevantamiento}>
                    <Text style={styles.saveBtnText}>{saving ? 'Guardando...' : 'Guardar edicion'}</Text>
                  </Pressable>
                </ScrollView>
              </View>
            </View>
          </Modal>
        ) : null}

        {moduloInforme === 'levantamiento' && !!levantamientosRecientesVisibles.length ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Levantamientos realizados</Text>
            {levantamientosRecientesVisibles.map((item, idx) => (
              <View
                key={`lev-realizado-${item.id_levantamiento_terreno || idx}`}
                style={[styles.installDoneCard, styles.levantamientoCompletedCard]}>
                <View pointerEvents="none" style={styles.installCompletedTopAccent} />
                <View pointerEvents="none" style={styles.installCompletedGlowStrong} />
                <View pointerEvents="none" style={styles.installCompletedGlowSoft} />
                <View style={[styles.installTypeBadgeRow, styles.installCompletedTypeBadgeRow]}>
                  <View style={[styles.installTypeBadge, styles.levantamientoTypeBadge]}>
                    <Ionicons name="map-outline" size={11} color="#1e3a8a" />
                    <Text style={[styles.installTypeBadgeText, styles.levantamientoTypeBadgeText]}>Levantamiento</Text>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, styles.levantamientoCompletedTitle]} numberOfLines={1} ellipsizeMode="tail">
                    {item.centro || `Centro ${item.centro_id || '-'}`}
                  </Text>
                  <Text style={styles.assignedItemMeta}>
                    {item.cliente || '-'} | {formatDate(item.fecha_levantamiento)}
                  </Text>
                  {!!item.resumen ? <Text style={styles.rowMeta} numberOfLines={2}>{item.resumen}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <View style={[styles.assignedActionPill, styles.assignedActionPillDone]}>
                    <Ionicons name="checkmark-circle" size={14} color="#166534" />
                    <Text style={[styles.assignedActionText, styles.assignedActionTextDone]}>
                      {estadoLevantamiento(item.estado) === 'edicion_solicitada'
                        ? 'Edicion solicitada'
                        : estadoLevantamiento(item.estado) === 'edicion_autorizada'
                          ? 'Edicion autorizada'
                          : estadoLevantamiento(item.estado) === 'edicion_rechazada'
                            ? 'Edicion rechazada'
                            : 'Realizado'}
                    </Text>
                  </View>
                  {(estadoLevantamiento(item.estado) === 'finalizado' ||
                    estadoLevantamiento(item.estado) === 'edicion_rechazada') && (
                    <Pressable
                      style={styles.levEditRequestBtn}
                      disabled={solicitandoEdicionLevantamientoId === Number(item.id_levantamiento_terreno || 0)}
                      onPress={() => handleSolicitarEdicionLevantamiento(item)}>
                      <Ionicons name="create-outline" size={13} color="#92400e" />
                      <Text style={styles.levEditRequestBtnText}>
                        {solicitandoEdicionLevantamientoId === Number(item.id_levantamiento_terreno || 0)
                          ? 'Enviando...'
                          : 'Solicitar editar'}
                      </Text>
                    </Pressable>
                  )}
                  {estadoLevantamiento(item.estado) === 'edicion_autorizada' && (
                    <Pressable
                      style={styles.levEditRequestBtn}
                      onPress={() => handleEditarLevantamientoAutorizado(item)}>
                      <Ionicons name="create-outline" size={13} color="#0c4a6e" />
                      <Text style={[styles.levEditRequestBtnText, { color: '#0c4a6e' }]}>Editar ahora</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </View>
        ) : null}

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
	                <View
	                  style={[
	                    styles.installTypeBadge,
	                    styles.installTypeBadgeCardCorner,
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
	                <View style={{ flex: 1 }}>
	                  <View style={styles.installCardHeader}>
	                    <Text style={[styles.rowTitle, styles.installCardTitle]}>{item.centro}</Text>
	                  </View>
	                  <Text style={styles.rowSubtitle}>{item.cliente}</Text>
	                  <View style={{ marginTop: 4, gap: 2 }}>
	                    <Text style={styles.rowMeta}>
	                      Acta: <Text style={!item.fechaActa ? styles.pendingMetaValue : undefined}>{item.fechaActa ? formatDate(item.fechaActa) : 'Pendiente'}</Text>
                    </Text>
                    <Text style={styles.rowMeta}>
                      Permiso: <Text style={styles.pendingMetaValue}>Pendiente</Text>
                    </Text>
                    <Text style={styles.rowMeta}>
                      Armado:{' '}
                      <Text style={!item.hasArmadoVinculado ? styles.pendingMetaValue : styles.linkedMetaValue}>
                        {item.hasArmadoVinculado ? 'Vinculado' : 'Pendiente'}
                      </Text>
                    </Text>
                  </View>
                </View>
                <View style={styles.rowActions}>
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => {
                      setTipoRegistroInstalacion(item.tipoInstalacion === 'reapuntamiento' ? 'reapuntamiento' : 'instalacion');
                      setTipoInstalacion('acta_entrega');
                      setMostrarInstalacionForm(true);
                      const clientePorNombre = clientes.find(
                        (c) =>
                          String(c.nombre || c.razon_social || '').trim().toLowerCase() ===
                          String(item.cliente || '').trim().toLowerCase()
                      );
                      const clienteId = Number(clientePorNombre?.id_cliente ?? clientePorNombre?.id ?? 0) || null;
                      if (clienteId) setPermClienteId(clienteId);
                      if (item.centroId) setPermCentroId(item.centroId);
                      const acta = actas.find((a) => Number(a.id_acta_entrega || 0) === Number(item.actaId || 0));
                      if (acta) {
                        abrirActa(acta);
                        return;
                      }
                      if (item.centroId && clienteId) {
                        setClienteIdForm(clienteId);
                        setCentroIdForm(item.centroId);
                        setFechaRegistro(todayInputDate());
                        nuevaActaDesdeInstalacion();
                      }
                    }}>
                    <Ionicons name="create-outline" size={16} color="#1d4ed8" />
                  </Pressable>
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
                      setPermisoSoloLectura(false);
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
                      setVinculoSoloLectura(!!item.hasArmadoVinculado);
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
                <View key={item.centroId} style={[styles.installDoneCard, styles.installCompletedCard]}>
                  <View pointerEvents="none" style={styles.installCompletedTopAccent} />
                  <View pointerEvents="none" style={styles.installCompletedGlowStrong} />
                  <View pointerEvents="none" style={styles.installCompletedGlowSoft} />
                  <View style={[styles.installTypeBadgeRow, styles.installCompletedTypeBadgeRow]}>
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
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, styles.installCompletedTitle]} numberOfLines={1} ellipsizeMode="tail">
                      {item.centro}
                    </Text>
                    <Text style={styles.rowSubtitle}>{item.cliente}</Text>
                    <Text style={styles.rowMeta}>
                      {item.tipoInstalacion === 'reapuntamiento' ? 'Reapuntamiento' : 'Instalacion'} | Acta: {formatDate(item.fechaActa)} | Permiso: {formatDate(item.fechaPermiso)}
                    </Text>
                  </View>
                <View style={styles.rowActions}>
                  {item.actaId ? (
                    <Pressable
                      style={[styles.actionBtn, styles.actionBtnSuccess]}
                      onPress={() => {
                        setTipoRegistroInstalacion(item.tipoInstalacion === 'reapuntamiento' ? 'reapuntamiento' : 'instalacion');
                        setTipoInstalacion('acta_entrega');
                        const acta = actas.find((a) => Number(a.id_acta_entrega || 0) === Number(item.actaId || 0));
                        if (acta) abrirActa(acta);
                      }}>
                      <Ionicons name="create-outline" size={16} color="#166534" />
                    </Pressable>
                  ) : null}
                  {item.permisoId ? (
                    <Pressable
                      style={[styles.actionBtn, styles.actionBtnSuccess]}
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
	                      setPermisoSoloLectura(true);
	                      setShowPermisoModal(true);
	                    }}>
                      <Ionicons name="clipboard-outline" size={16} color="#166534" />
                    </Pressable>
                  ) : null}
                  <Pressable
                    style={[
                      styles.actionBtn,
                      item.hasArmadoVinculado && item.hasArmadoEquiposGuardados
                        ? styles.actionBtnSuccess
                        : styles.actionBtnWarn,
                    ]}
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
	                      setVinculoSoloLectura(!!item.hasArmadoVinculado);
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
                    <Ionicons
                      name="link-outline"
                      size={16}
                      color={item.hasArmadoVinculado && item.hasArmadoEquiposGuardados ? '#166534' : '#ffffff'}
                    />
                  </Pressable>
                  <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                </View>
              </View>
            ))}
          </View>
        )}

        {moduloInforme === 'instalacion' && mostrarInstalacionForm && !showEditor && !actividadAsignadaActiva && (
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
                  {armadoVinculado ? (
                    <View style={styles.installStateRow}>
                      <Text style={styles.installStateLabel}>Uso:</Text>
                      <Text
                        style={[
                          styles.installStateValue,
                          resumenArmadoEquipos.devueltos > 0
                            ? styles.installStateWarn
                            : styles.installStateOk,
                        ]}>
                        {resumenArmadoEquipos.total
                          ? `Instalados ${resumenArmadoEquipos.instalados} | Devueltos ${resumenArmadoEquipos.devueltos}`
                          : 'Sin revision de equipos'}
                      </Text>
                    </View>
                  ) : null}
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
                  setVinculoSoloLectura(!!armadoVinculado);
                  setShowArmadosModal(true);
                }}>
                <Ionicons name="link-outline" size={14} color={instalacionSeleccionada ? '#1d4ed8' : '#94a3b8'} />
	                <Text style={[styles.linkArmadoBtnText, !instalacionSeleccionada && styles.linkArmadoBtnTextDisabled]}>
		                  {armadoVinculado ? 'Ver vinculacion' : 'Vincular armado'}
		                </Text>
	              </Pressable>
                  {armadoVinculado ? (
                    <View style={styles.linkArmadoActionsRow}>
                      <Pressable
                        style={[
                          styles.linkArmadoBtn,
                          styles.linkArmadoBtnFlex,
                          armadoEquiposYaGuardados ? styles.linkArmadoBtnSuccess : styles.linkArmadoBtnDanger,
                        ]}
                        onPress={() => abrirArmadoEquipos(armadoEquiposYaGuardados)}>
                        <Ionicons
                          name="cube-outline"
                          size={14}
                          color={armadoEquiposYaGuardados ? '#166534' : '#b91c1c'}
                        />
                        <Text
                          style={[
                            styles.linkArmadoBtnText,
                            armadoEquiposYaGuardados ? styles.linkArmadoBtnTextSuccess : styles.linkArmadoBtnTextDanger,
                          ]}>
                          {armadoEquiposYaGuardados ? 'Ver equipos del armado' : 'Equipos / vuelta a bodega'}
                        </Text>
                      </Pressable>
                      {armadoEquiposYaGuardados ? (
                        <Pressable
                          style={[styles.linkArmadoBtn, styles.linkArmadoBtnEdit]}
                          onPress={() => abrirArmadoEquipos(false)}>
                          <Ionicons name="create-outline" size={14} color="#1d4ed8" />
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
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
	                  setPermisoSoloLectura(permisoCompletado);
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
              <View
                key={`mant-${item.id_mantencion_terreno || item.id_permiso_trabajo || item.centro_id}`}
                style={[styles.installDoneCard, styles.mantCompletedCard]}>
                <View pointerEvents="none" style={styles.installCompletedTopAccent} />
                <View pointerEvents="none" style={styles.installCompletedGlowStrong} />
                <View pointerEvents="none" style={styles.installCompletedGlowSoft} />
                <View style={[styles.installTypeBadgeRow, styles.installCompletedTypeBadgeRow]}>
                  <View style={[styles.installTypeBadge, styles.mantTypeBadge]}>
                    <Ionicons name="build-outline" size={11} color="#1e3a8a" />
                    <Text style={[styles.installTypeBadgeText, styles.mantTypeBadgeText]}>Mantencion</Text>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, styles.mantCompletedTitle]} numberOfLines={1} ellipsizeMode="tail">
                    {item.centro || `Centro ${item.centro_id}`}
                  </Text>
                  <Text style={styles.rowSubtitle}>{item.empresa || item.cliente || '-'}</Text>
                  <Text style={styles.rowMeta}>Fecha: {formatDate(item.fecha_ingreso)}</Text>
                </View>
                <View style={styles.rowActions}>
                  <Pressable
                    style={styles.actionBtn}
                    onPress={async () => {
                      try {
                        const mantencionId = Number(item?.id_mantencion_terreno || 0) || null;
                        let lista: RetiroEquipoChecklist[] = [];
                        if (mantencionId) {
                          const cambios = await fetchCambiosEquipoMantencion(mantencionId);
                          lista = parseRetiroEquipos(cambios);
                        } else {
                          lista = parseRetiroEquipos(item?.cambios_equipo || item?.equipos);
                        }
                        setRetiroChecklistReadOnly(lista);
                        setRetiroChecklistReadMeta(null);
                        setShowRetiroChecklistReadModal(true);
                      } catch {
                        const lista = parseRetiroEquipos(item?.cambios_equipo || item?.equipos);
                        setRetiroChecklistReadOnly(lista);
                        setRetiroChecklistReadMeta(null);
                        setShowRetiroChecklistReadModal(true);
                      }
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
	                      setPermisoSoloLectura(true);
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
              <View key={`ret-${item.id_retiro_terreno || item.centro_id}`} style={[styles.installDoneCard, styles.retiroCompletedCard]}>
                <View pointerEvents="none" style={styles.installCompletedTopAccent} />
                <View pointerEvents="none" style={styles.installCompletedGlowStrong} />
                <View pointerEvents="none" style={styles.installCompletedGlowSoft} />
                <View style={[styles.installTypeBadgeRow, styles.installCompletedTypeBadgeRow]}>
                  <View style={[styles.installTypeBadge, styles.retiroTypeBadge]}>
                    <Ionicons name="exit-outline" size={11} color="#1e3a8a" />
                    <Text style={[styles.installTypeBadgeText, styles.retiroTypeBadgeText]}>Retiro</Text>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, styles.retiroCompletedTitle]} numberOfLines={1} ellipsizeMode="tail">
                    {item.centro || `Centro ${item.centro_id}`}
                  </Text>
                  <Text style={styles.rowSubtitle}>{item.empresa || item.cliente || '-'}</Text>
                  <Text style={styles.rowMeta}>
                    Fecha: {formatDate(item.fecha_retiro)} | Tipo: {item.tipo_retiro === 'completo' ? 'Completo' : 'Parcial'}
                  </Text>
                </View>
                <View style={styles.rowActions}>
                  {estadoEdicionRetiro(item.estado_edicion) === 'edicion_autorizada' ? (
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
		                        setRetiroFormDirty(false);
		                        setRetiroEditandoId(Number(item.id_retiro_terreno || 0) || null);
		                        setPermisoSoloLectura(false);
		                        setShowPermisoModal(true);
	                      }}>
                      <Ionicons name="create-outline" size={16} color="#1d4ed8" />
                    </Pressable>
                  ) : null}
                  {(estadoEdicionRetiro(item.estado_edicion) === 'finalizado' ||
                    estadoEdicionRetiro(item.estado_edicion) === 'edicion_rechazada') ? (
                    <Pressable
                      style={styles.levEditRequestBtn}
                      disabled={solicitandoEdicionRetiroId === Number(item.id_retiro_terreno || 0)}
                      onPress={() => handleSolicitarEdicionRetiro(item)}>
                      <Ionicons name="create-outline" size={13} color="#92400e" />
                      <Text style={styles.levEditRequestBtnText}>
                        {solicitandoEdicionRetiroId === Number(item.id_retiro_terreno || 0) ? 'Enviando...' : 'Solicitar editar'}
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => {
                      const lista = parseRetiroEquipos(item?.equipos);
                      setRetiroChecklistReadOnly(lista);
                      setRetiroChecklistReadMeta({
                        tipo: String(item?.tipo_retiro || '').trim().toLowerCase() === 'completo' ? 'completo' : 'parcial',
                        estado:
                          String(item?.estado_logistico || '').trim().toLowerCase() === 'en_transito'
                            ? 'en_transito'
                            : 'retirado_centro',
                      });
                      setShowRetiroChecklistReadModal(true);
                    }}>
                    <Ionicons name="list-outline" size={16} color="#1d4ed8" />
                  </Pressable>
                  <Ionicons
                    name={
                      estadoEdicionRetiro(item.estado_edicion) === 'edicion_solicitada'
                        ? 'time-outline'
                        : estadoEdicionRetiro(item.estado_edicion) === 'edicion_autorizada'
                          ? 'create-outline'
                          : estadoEdicionRetiro(item.estado_edicion) === 'edicion_rechazada'
                            ? 'close-circle-outline'
                            : 'checkmark-circle'
                    }
                    size={18}
                    color={
                      estadoEdicionRetiro(item.estado_edicion) === 'edicion_solicitada'
                        ? '#d97706'
                        : estadoEdicionRetiro(item.estado_edicion) === 'edicion_autorizada'
                          ? '#2563eb'
                          : estadoEdicionRetiro(item.estado_edicion) === 'edicion_rechazada'
                            ? '#dc2626'
                            : '#16a34a'
                    }
                  />
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
              <Text style={styles.modalTitle}>{actaSoloLectura ? 'Ver acta' : editId ? 'Editar acta' : 'Nueva acta'}</Text>
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
                    value={clienteForm?.nombre || clienteForm?.razon_social || actividadAsignadaActiva?.centro?.cliente || ''}
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
                        value={actividadAsignadaActiva?.centro?.nombre || ''}
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
                  <TextInput style={[styles.input, actaSoloLectura && styles.inputDisabled]} editable={!actaSoloLectura} value={codigoPontonActa} onChangeText={setCodigoPontonActa} placeholder="Codigo ponton" />
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
                  <TextInput style={[styles.input, actaSoloLectura && styles.inputDisabled]} editable={!actaSoloLectura} value={tecnico1} onChangeText={setTecnico1} placeholder="Nombre tecnico 1" />
                )}
                <View style={styles.firmaActions}>
                  <Pressable style={[styles.firmaBtn, actaSoloLectura && styles.ctaDisabled]} disabled={actaSoloLectura} onPress={() => abrirFirma('tecnico1')}><Text style={styles.firmaBtnText}>{firmaTecnico1 ? 'Editar firma' : 'Firmar'}</Text></Pressable>
                  {!!firmaTecnico1 && <Pressable style={styles.firmaClearBtn} disabled={actaSoloLectura} onPress={() => limpiarFirma('tecnico1')}><Ionicons name="trash-outline" size={14} color="#dc2626" /></Pressable>}
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
                  <TextInput style={[styles.input, actaSoloLectura && styles.inputDisabled]} editable={!actaSoloLectura} value={tecnico2} onChangeText={setTecnico2} placeholder="Nombre tecnico 2" />
                )}
                <View style={styles.firmaActions}>
                  <Pressable style={[styles.firmaBtn, actaSoloLectura && styles.ctaDisabled]} disabled={actaSoloLectura} onPress={() => abrirFirma('tecnico2')}><Text style={styles.firmaBtnText}>{firmaTecnico2 ? 'Editar firma' : 'Firmar'}</Text></Pressable>
                  {!!firmaTecnico2 && <Pressable style={styles.firmaClearBtn} disabled={actaSoloLectura} onPress={() => limpiarFirma('tecnico2')}><Ionicons name="trash-outline" size={14} color="#dc2626" /></Pressable>}
                </View>
                {!!firmaTecnico2 && <Image source={{ uri: firmaTecnico2 }} style={styles.firmaPreview} resizeMode="contain" />}
              </View>
                {!!tecnicosAsignadosExtra.length && (
                  <View style={styles.additionalTechWrap}>
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
                            style={[styles.firmaBtn, actaSoloLectura && styles.ctaDisabled]}
                            disabled={actaSoloLectura}
                            onPress={() => {
                              setFirmaExtraIndex(idx);
                              abrirFirma('tecnico_extra');
                            }}>
                            <Text style={styles.firmaBtnText}>{firma ? 'Editar firma' : 'Firmar'}</Text>
                          </Pressable>
                          {!!firma && (
                            <Pressable style={styles.firmaClearBtn} disabled={actaSoloLectura} onPress={() => limpiarFirma('tecnico_extra', idx)}>
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
                {actaSoloLectura ? (
                  <View style={[styles.input, styles.inputDisabled, styles.nameReadonlyBox]}>
                    <Text style={styles.nameReadonlyText}>{recepcionaNombre || 'Sin nombre'}</Text>
                  </View>
                ) : (
                  <TextInput style={[styles.input, actaSoloLectura && styles.inputDisabled]} editable={!actaSoloLectura} value={recepcionaNombre} onChangeText={setRecepcionaNombre} placeholder="Nombre quien recepciona" />
                )}
                <View style={styles.firmaActions}>
                  <Pressable style={[styles.firmaBtn, actaSoloLectura && styles.ctaDisabled]} disabled={actaSoloLectura} onPress={() => abrirFirma('recepciona')}><Text style={styles.firmaBtnText}>{firmaRecepciona ? 'Editar firma' : 'Firmar'}</Text></Pressable>
                  {!!firmaRecepciona && <Pressable style={styles.firmaClearBtn} disabled={actaSoloLectura} onPress={() => limpiarFirma('recepciona')}><Ionicons name="trash-outline" size={14} color="#dc2626" /></Pressable>}
                </View>
                {!!firmaRecepciona && <Image source={{ uri: firmaRecepciona }} style={styles.firmaPreview} resizeMode="contain" />}
              </View>

              <View style={styles.row}>
                <View style={styles.inputCol}>
                  <Text style={styles.selectLabel}>Fecha registro</Text>
                  <Pressable style={[styles.dateInput, actaSoloLectura && styles.inputDisabled]} disabled={actaSoloLectura} onPress={() => setShowActaFechaPicker(true)}>
                    <Text style={styles.dateInputText}>{fechaRegistro || 'Seleccionar fecha'}</Text>
                    <Ionicons name="calendar-outline" size={16} color="#1d4ed8" />
                  </Pressable>
                </View>
              </View>
              {showActaFechaPicker && !actaSoloLectura && (
                <DateTimePicker
                  value={inputDateToDate(fechaRegistro)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleActaFechaChange}
                />
              )}
              <View style={styles.inputBlock}>
                <Text style={styles.selectLabel}>Los equipos considerados en este sistema, corresponden a</Text>
                <TextInput style={[styles.input, styles.textArea, actaSoloLectura && styles.inputDisabled]} editable={!actaSoloLectura} value={equiposConsiderados} onChangeText={setEquiposConsiderados} multiline textAlignVertical="top" />
              </View>
              <View style={styles.inputBlock}>
                <Text style={styles.selectLabel}>En caso de ser traslado, indicar centro de origen</Text>
                <TextInput
                  style={[styles.input, actaSoloLectura && styles.inputDisabled]}
                  editable={!actaSoloLectura}
                  value={centroOrigenTraslado}
                  onChangeText={setCentroOrigenTraslado}
                  placeholder="Centro de origen (solo traslados)"
                />
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => { setShowEditor(false); resetForm(); }}><Text style={styles.cancelBtnText}>{actaSoloLectura ? 'Cerrar' : 'Cancelar'}</Text></Pressable>
              {!actaSoloLectura ? (
                <Pressable style={styles.saveBtn} onPress={guardarActa} disabled={saving}><Text style={styles.saveBtnText}>{saving ? 'Guardando...' : 'Guardar'}</Text></Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showArmadosModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{vinculoSoloLectura ? 'Ver vinculacion de armado' : 'Vincular armado finalizado'}</Text>
              <Pressable
	                onPress={() => {
	                  setShowArmadosModal(false);
	                  setVinculoActaId(null);
	                  setVinculoSoloLectura(false);
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
                    disabled={vinculoSoloLectura}
                    onPress={() => {
                      if (vinculoSoloLectura) return;
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
            {Number(armadoSeleccionadoId || actaCentroSeleccionado?.armado_id || 0) > 0 ? (
              <Pressable
                style={[
                  styles.linkArmadoBtn,
                  styles.armadoEquiposInlineBtn,
                  armadoEquiposYaGuardados ? styles.linkArmadoBtnSuccess : styles.linkArmadoBtnDanger,
                ]}
                onPress={() => abrirArmadoEquipos(vinculoSoloLectura && armadoEquiposYaGuardados)}>
                <Ionicons
                  name="cube-outline"
                  size={14}
                  color={armadoEquiposYaGuardados ? '#166534' : '#b91c1c'}
                />
                <Text
                  style={[
                    styles.linkArmadoBtnText,
                    armadoEquiposYaGuardados ? styles.linkArmadoBtnTextSuccess : styles.linkArmadoBtnTextDanger,
                  ]}>
                  {vinculoSoloLectura && armadoEquiposYaGuardados ? 'Ver equipos del armado' : 'Equipos / vuelta a bodega'}
                </Text>
              </Pressable>
            ) : null}
            <View style={styles.modalActions}>
	              <Pressable
	                style={styles.cancelBtn}
	                disabled={saving}
	                onPress={() => {
                  setShowArmadosModal(false);
                  setVinculoActaId(null);
                  setVinculoSoloLectura(false);
                }}>
                <Text style={styles.cancelBtnText}>{vinculoSoloLectura ? 'Cerrar' : 'Cancelar'}</Text>
              </Pressable>
              {!vinculoSoloLectura ? (
                <>
                  <Pressable
                    style={styles.cancelBtn}
                    disabled={saving}
                    onPress={() => guardarVinculoArmado(null)}>
                    <Text style={styles.cancelBtnText}>Quitar vinculo</Text>
                  </Pressable>
                  <Pressable style={styles.saveBtn} disabled={saving} onPress={() => guardarVinculoArmado(armadoSeleccionadoId)}>
                    <Text style={styles.saveBtnText}>{saving ? 'Guardando...' : 'Guardar'}</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showArmadoEquiposModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {armadoEquiposSoloLectura ? 'Ver equipos del armado' : 'Equipos del armado'}
              </Text>
              <Pressable
                onPress={() => {
                  setShowArmadoEquiposModal(false);
                  setArmadoEquiposActa([]);
                  setArmadoEquiposSoloLectura(false);
                }}>
                <Ionicons name="close" size={20} color="#334155" />
              </Pressable>
            </View>

            {loadingArmadoEquipos ? (
              <View style={styles.armadoEquiposLoading}>
                <ActivityIndicator size="small" color="#1d4ed8" />
                <Text style={styles.armadoEquiposLoadingText}>Cargando equipos del armado...</Text>
              </View>
            ) : (
              <>
                <View style={styles.armadoEquiposSummary}>
                  <View style={[styles.armadoEquiposSummaryChip, styles.armadoEquiposSummaryChipNeutral]}>
                    <Text style={styles.armadoEquiposSummaryLabel}>Total</Text>
                    <Text style={styles.armadoEquiposSummaryValue}>{armadoEquiposActa.length}</Text>
                  </View>
                  <View style={[styles.armadoEquiposSummaryChip, styles.armadoEquiposSummaryChipOk]}>
                    <Text style={styles.armadoEquiposSummaryLabel}>Instalados</Text>
                    <Text style={styles.armadoEquiposSummaryValue}>
                      {armadoEquiposActa.filter((item) => String(item.estado_uso || '') === 'instalado').length}
                    </Text>
                  </View>
                  <View style={[styles.armadoEquiposSummaryChip, styles.armadoEquiposSummaryChipWarn]}>
                    <Text style={styles.armadoEquiposSummaryLabel}>Devueltos</Text>
                    <Text style={styles.armadoEquiposSummaryValue}>
                      {armadoEquiposActa.filter((item) => String(item.estado_uso || '') === 'devuelto_bodega').length}
                    </Text>
                  </View>
                </View>

                <ScrollView style={styles.armadoEquiposList} showsVerticalScrollIndicator={false}>
                  {armadoEquiposActa.map((item, index) => {
                    const estadoUso = String(item.estado_uso || 'instalado');
                    const estadoLogistico = String(item.estado_logistico || 'sin_movimiento');
                    return (
                      <View key={`${buildActaArmadoEquipoKey(item)}-${index}`} style={styles.armadoEquipoCard}>
                        <View style={styles.armadoEquipoHeader}>
                          <View style={styles.armadoEquipoTitleWrap}>
                            <Text style={styles.armadoEquipoTitle}>{item.nombre || 'Equipo sin nombre'}</Text>
                            <Text style={styles.armadoEquipoMeta}>
                              {item.numero_serie
                                ? `N Serie: ${item.numero_serie}`
                                : item.codigo
                                  ? `Codigo: ${item.codigo}`
                                  : 'Sin serie'}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.armadoEquipoBadge,
                              estadoUso === 'instalado'
                                ? styles.armadoEquipoBadgeOk
                                : styles.armadoEquipoBadgeWarn,
                            ]}>
                            <Text
                              style={[
                                styles.armadoEquipoBadgeText,
                                estadoUso === 'instalado'
                                  ? styles.armadoEquipoBadgeTextOk
                                  : styles.armadoEquipoBadgeTextWarn,
                              ]}>
                              {estadoUso === 'instalado'
                                ? 'Instalado'
                                : 'Vuelta a bodega'}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.armadoEquipoInfoRow}>
                          <Text style={styles.armadoEquipoInfoLabel}>Bulto</Text>
                          <Text style={styles.armadoEquipoInfoValue}>{item.caja || 'Sin bulto asignado'}</Text>
                        </View>
                        <View style={styles.armadoEquipoInfoRow}>
                          <Text style={styles.armadoEquipoInfoLabel}>Logistica</Text>
                          <Text style={styles.armadoEquipoInfoValue}>
                            {estadoLogistico === 'en_transito_bodega'
                              ? 'En transito hacia bodega'
                              : estadoLogistico === 'recepcionado_bodega'
                                ? 'Recepcionado en bodega'
                                : 'Sin movimiento'}
                          </Text>
                        </View>

                        <View style={styles.armadoEquipoActions}>
                          <Pressable
                            style={[
                              styles.armadoEquipoActionBtn,
                              estadoUso === 'instalado' && styles.armadoEquipoActionBtnActiveOk,
                              armadoEquiposSoloLectura && styles.armadoEquipoActionBtnDisabled,
                            ]}
                            disabled={armadoEquiposSoloLectura}
                            onPress={() => actualizarEstadoArmadoEquipo(index, 'instalado')}>
                            <Ionicons
                              name="checkmark-circle-outline"
                              size={14}
                              color={estadoUso === 'instalado' ? '#166534' : '#475569'}
                            />
                            <Text
                              style={[
                                styles.armadoEquipoActionText,
                                estadoUso === 'instalado' && styles.armadoEquipoActionTextOk,
                              ]}>
                              Instalado
                            </Text>
                          </Pressable>
                          <Pressable
                            style={[
                              styles.armadoEquipoActionBtn,
                              estadoUso === 'devuelto_bodega' && styles.armadoEquipoActionBtnActiveWarn,
                              armadoEquiposSoloLectura && styles.armadoEquipoActionBtnDisabled,
                            ]}
                            disabled={armadoEquiposSoloLectura}
                            onPress={() => actualizarEstadoArmadoEquipo(index, 'devuelto_bodega')}>
                            <Ionicons
                              name="return-up-back-outline"
                              size={14}
                              color={estadoUso === 'devuelto_bodega' ? '#b45309' : '#475569'}
                            />
                            <Text
                              style={[
                                styles.armadoEquipoActionText,
                                estadoUso === 'devuelto_bodega' && styles.armadoEquipoActionTextWarn,
                              ]}>
                              Devuelto
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                  {!armadoEquiposActa.length ? (
                    <View style={styles.armadoEquiposEmpty}>
                      <Ionicons name="cube-outline" size={18} color="#94a3b8" />
                      <Text style={styles.armadoEquiposEmptyText}>No hay equipos para revisar en este armado.</Text>
                    </View>
                  ) : null}
                </ScrollView>
              </>
            )}

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelBtn}
                disabled={savingArmadoEquipos}
                onPress={() => {
                  setShowArmadoEquiposModal(false);
                  setArmadoEquiposActa([]);
                  setArmadoEquiposSoloLectura(false);
                }}>
                <Text style={styles.cancelBtnText}>Cerrar</Text>
              </Pressable>
              {!armadoEquiposSoloLectura ? (
                <Pressable
                  style={[styles.saveBtn, savingArmadoEquipos && styles.saveBtnDisabled]}
                  disabled={savingArmadoEquipos}
                  onPress={guardarArmadoEquiposActa}>
                  <Text style={styles.saveBtnText}>
                    {savingArmadoEquipos ? 'Guardando...' : 'Guardar'}
                  </Text>
                </Pressable>
              ) : null}
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
                  setPermisoSoloLectura(false);
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
                  setPermisoSoloLectura(false);
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
              <Text style={styles.modalTitle}>Retiro de equipos</Text>
              <Pressable onPress={() => setShowRetiroChecklistModal(false)}>
                <Ionicons name="close" size={20} color="#334155" />
              </Pressable>
            </View>
            <View style={styles.inputBlock}>
              <Text style={styles.selectLabel}>Tipo de retiro</Text>
              <View style={styles.baseChoiceRow}>
                <Pressable
                  style={[styles.baseChoiceBtn, retiroTipo === 'parcial' && styles.baseChoiceBtnActive]}
                  onPress={() => actualizarTipoRetiro('parcial')}>
                  <Text style={[styles.baseChoiceText, retiroTipo === 'parcial' && styles.baseChoiceTextActive]}>
                    Parcial
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.baseChoiceBtn, retiroTipo === 'completo' && styles.baseChoiceBtnActive]}
                  onPress={() => actualizarTipoRetiro('completo')}>
                  <Text style={[styles.baseChoiceText, retiroTipo === 'completo' && styles.baseChoiceTextActive]}>
                    Completo
                  </Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.inputBlock}>
              <Text style={styles.selectLabel}>Resumen logistico</Text>
              <View style={styles.retiroModalSummary}>
                <Text style={styles.sectionHint}>Tipo: {retiroTipoLabel}</Text>
                <Text style={styles.sectionHint}>Equipos marcados: {retiroSeleccionadosCount}/{retiroEquiposChecklist.length}</Text>
                <Text style={styles.sectionHint}>Por mano: {retiroPorManoCount}</Text>
                <Text style={styles.sectionHint}>Despacho a Orca: {retiroDespachoCount}</Text>
              </View>
              <View style={styles.firmaActions}>
                <Pressable
                  style={styles.firmaBtn}
                  onPress={() => {
                    setRetiroFormDirty(true);
                    setRetiroEquiposChecklist((prev) =>
                      prev.map((row) => ({
                        ...row,
                        retirado: true,
                        modalidad_retorno: row.modalidad_retorno || 'despacho_orca',
                      }))
                    );
                  }}>
                  <Text style={styles.firmaBtnText}>Marcar todos</Text>
                </Pressable>
                <Pressable
                  style={styles.firmaBtn}
                  onPress={() => {
                    setRetiroFormDirty(true);
                    setRetiroEquiposChecklist((prev) => prev.map((row) => ({ ...row, retirado: false })));
                  }}>
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
                    onPress={() => {
                      setRetiroFormDirty(true);
                      setRetiroEquiposChecklist((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, retirado: !row.retirado } : row))
                      );
                    }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.equipoItemTitle, !!eq.retirado && styles.equipoItemTitleActive]}>
                        {eq.equipo_nombre || `Equipo ${idx + 1}`}
                      </Text>
                      <Text style={styles.equipoItemMeta}>Serie: {eq.numero_serie || '-'}</Text>
                      <Text style={styles.equipoItemMeta}>Codigo: {eq.codigo || '-'}</Text>
                      {!!eq.retirado ? (
                        <View style={styles.retiroItemModeRow}>
                          <Pressable
                            style={[
                              styles.retiroItemModeBtn,
                              normalizarModalidadRetorno(eq.modalidad_retorno) === 'por_mano' &&
                                styles.retiroItemModeBtnGreen,
                            ]}
                            onPress={() => actualizarModalidadRetiroEquipo(idx, 'por_mano')}>
                            <Ionicons
                              name="hand-left-outline"
                              size={12}
                              color={
                                normalizarModalidadRetorno(eq.modalidad_retorno) === 'por_mano'
                                  ? '#166534'
                                  : '#6b7280'
                              }
                            />
                            <Text
                              style={[
                                styles.retiroItemModeText,
                                normalizarModalidadRetorno(eq.modalidad_retorno) === 'por_mano' &&
                                  styles.retiroItemModeTextActive,
                              ]}>
                              Por mano
                            </Text>
                          </Pressable>
                          <Pressable
                            style={[
                              styles.retiroItemModeBtn,
                              normalizarModalidadRetorno(eq.modalidad_retorno) === 'despacho_orca' &&
                                styles.retiroItemModeBtnAmber,
                            ]}
                            onPress={() => actualizarModalidadRetiroEquipo(idx, 'despacho_orca')}>
                            <Ionicons
                              name="car-outline"
                              size={12}
                              color={
                                normalizarModalidadRetorno(eq.modalidad_retorno) === 'despacho_orca'
                                  ? '#166534'
                                  : '#6b7280'
                              }
                            />
                            <Text
                              style={[
                                styles.retiroItemModeText,
                                normalizarModalidadRetorno(eq.modalidad_retorno) === 'despacho_orca' &&
                                  styles.retiroItemModeTextActive,
                              ]}>
                              Despacho a Orca
                            </Text>
                          </Pressable>
                        </View>
                      ) : null}
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
                <Text style={styles.cancelBtnText}>Listo</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showRetiroChecklistReadModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Retiro de equipos</Text>
              <Pressable
                onPress={() => {
                  setShowRetiroChecklistReadModal(false);
                  setRetiroChecklistReadMeta(null);
                }}>
                <Ionicons name="close" size={20} color="#334155" />
              </Pressable>
            </View>
            {retiroChecklistReadMeta ? (
              <View style={styles.retiroModalSummary}>
                <Text style={styles.sectionHint}>
                  Tipo: {retiroChecklistReadMeta.tipo === 'completo' ? 'Completo' : 'Parcial'} | Modalidad:{' '}
                  {retiroChecklistReadMeta.estado === 'retirado_centro' ? 'Por mano a Orca' : 'Despacho a Orca'}
                </Text>
                <Text style={styles.sectionHint}>
                  Por mano:{' '}
                  {
                    retiroChecklistReadOnly.filter(
                      (eq) => !!eq.retirado && normalizarModalidadRetorno(eq.modalidad_retorno) === 'por_mano'
                    ).length
                  }{' '}
                  | Despacho a Orca:{' '}
                  {
                    retiroChecklistReadOnly.filter(
                      (eq) =>
                        !!eq.retirado && normalizarModalidadRetorno(eq.modalidad_retorno) === 'despacho_orca'
                    ).length
                  }
                </Text>
              </View>
            ) : null}
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
                      {!!eq.retirado ? (
                        <Text style={styles.equipoItemMeta}>
                          Modalidad:{' '}
                          {normalizarModalidadRetorno(eq.modalidad_retorno) === 'por_mano'
                            ? 'Por mano'
                            : 'Despacho a Orca'}
                        </Text>
                      ) : null}
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
              <Pressable
                style={styles.cancelBtn}
                onPress={() => {
                  setShowRetiroChecklistReadModal(false);
                  setRetiroChecklistReadMeta(null);
                }}>
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
	                {permisoFormularioSoloLectura
	                  ? permisoContexto === 'mantencion'
	                    ? 'Ver informe de mantencion'
	                    : permisoContexto === 'retiro'
	                    ? 'Ver informe de retiro'
	                    : 'Ver permiso de trabajo'
	                  : permisoContexto === 'mantencion'
	                  ? 'Informe de mantencion'
	                  : permisoContexto === 'retiro'
	                  ? 'Informe de retiro'
                  : 'Permiso de trabajo'}
              </Text>
              <Pressable
	                onPress={() => {
		                  setShowPermisoModal(false);
		                  setShowRetiroChecklistModal(false);
		                  setPermisoSoloLectura(false);
		                  setPermisoContexto('instalacion');
	                  setRetiroFormDirty(false);
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
	                    <Text style={styles.centerInfoValue}>{clienteActualInforme}</Text>
	                  </View>
	                  <View style={styles.centerInfoItem}>
	                    <Text style={styles.centerInfoLabel}>Centro</Text>
	                    <Text style={styles.centerInfoValue}>{centroActualInforme}</Text>
	                  </View>
	                </View>
	                <View style={styles.row}>
	                  <View style={styles.centerInfoItem}>
	                    <Text style={styles.centerInfoLabel}>Codigo ponton</Text>
	                    <Text style={styles.centerInfoValue}>{codigoPontonActualInforme}</Text>
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
	                      style={[styles.baseChoiceBtn, permBaseTierra.toLowerCase() === 'si' && styles.baseChoiceBtnActive, !permisoEditable && styles.ctaDisabled]}
	                      disabled={!permisoEditable}
	                      onPress={() => setPermBaseTierra('si')}>
                      <Text style={[styles.baseChoiceText, permBaseTierra.toLowerCase() === 'si' && styles.baseChoiceTextActive]}>Si</Text>
                    </Pressable>
                    <Pressable
	                      style={[styles.baseChoiceBtn, permBaseTierra.toLowerCase() === 'no' && styles.baseChoiceBtnActive, !permisoEditable && styles.ctaDisabled]}
	                      disabled={!permisoEditable}
	                      onPress={() => setPermBaseTierra('no')}>
                      <Text style={[styles.baseChoiceText, permBaseTierra.toLowerCase() === 'no' && styles.baseChoiceTextActive]}>No</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.selectLabel}>Cantidad de radares</Text>
	                  <TextInput
	                    style={[styles.input, !permisoEditable && styles.inputDisabled]}
	                    editable={permisoEditable}
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
	                    style={[styles.baseChoiceBtn, permResponsabilidad.toLowerCase() === 'orca' && styles.baseChoiceBtnActive, !permisoEditable && styles.ctaDisabled]}
	                    disabled={!permisoEditable}
	                    onPress={() => setPermResponsabilidad('orca')}>
                    <Text style={[styles.baseChoiceText, permResponsabilidad.toLowerCase() === 'orca' && styles.baseChoiceTextActive]}>Orca</Text>
                  </Pressable>
	                  <Pressable
	                    style={[styles.baseChoiceBtn, permResponsabilidad.toLowerCase() === 'cliente' && styles.baseChoiceBtnActive, !permisoEditable && styles.ctaDisabled]}
	                    disabled={!permisoEditable}
	                    onPress={() => setPermResponsabilidad('cliente')}>
                    <Text style={[styles.baseChoiceText, permResponsabilidad.toLowerCase() === 'cliente' && styles.baseChoiceTextActive]}>Cliente</Text>
                  </Pressable>
                </View>
              </View>
              <View style={[styles.row, styles.rowTopGap]}>
                <View style={styles.inputCol}>
                  <Text style={styles.selectLabel}>Fecha ingreso</Text>
	                  <Pressable style={[styles.dateInput, !permisoEditable && styles.inputDisabled]} disabled={!permisoEditable} onPress={() => setShowPermFechaPicker(true)}>
                    <Text style={styles.dateInputText}>{permFecha || 'Seleccionar fecha'}</Text>
                    <Ionicons name="calendar-outline" size={16} color="#1d4ed8" />
                  </Pressable>
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.selectLabel}>Fecha salida</Text>
	                  <Pressable style={[styles.dateInput, !permisoEditable && styles.inputDisabled]} disabled={!permisoEditable} onPress={() => setShowPermFechaSalidaPicker(true)}>
                    <Text style={styles.dateInputText}>{permFechaSalida || 'Seleccionar fecha'}</Text>
                    <Ionicons name="calendar-outline" size={16} color="#1d4ed8" />
                  </Pressable>
                </View>
              </View>
	              {showPermFechaPicker && permisoEditable && (
                <DateTimePicker
                  value={inputDateToDate(permFecha)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handlePermFechaChange}
                />
              )}
	              {showPermFechaSalidaPicker && permisoEditable && (
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
	                        style={[styles.input, !permisoEditable && styles.inputDisabled]}
	                        editable={permisoEditable}
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
	                        style={[styles.input, !permisoEditable && styles.inputDisabled]}
	                        editable={permisoEditable}
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
	                        disabled={!permisoEditable}
	                        onPress={() => setPermPuntosGpsList((prev) => prev.filter((_, i) => i !== idx))}>
                        <Ionicons name="close" size={16} color="#dc2626" />
                      </Pressable>
                    ) : null}
                  </View>
                ))}
	                <Pressable
	                  style={[styles.firmaBtn, !permisoEditable && styles.ctaDisabled]}
	                  disabled={!permisoEditable}
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
	                    style={[styles.input, !permisoEditable && styles.inputDisabled]}
	                    editable={permisoEditable}
	                    value={permMedicionFaseNeutro}
                    onChangeText={(v) => setPermMedicionFaseNeutro(normalizeMeasureInput(v))}
                    placeholder="Ej: 220.5"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.selectLabel}>Medicion neutro/tierra</Text>
	                  <TextInput
	                    style={[styles.input, !permisoEditable && styles.inputDisabled]}
	                    editable={permisoEditable}
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
	                  style={[styles.input, !permisoEditable && styles.inputDisabled]}
	                  editable={permisoEditable}
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
	                      style={[styles.input, !permisoEditable && styles.inputDisabled]}
	                      editable={permisoEditable}
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
	                          style={[styles.input, !permisoEditable && styles.inputDisabled]}
	                          editable={permisoEditable}
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
	                          style={[styles.input, !permisoEditable && styles.inputDisabled]}
	                          editable={permisoEditable}
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
	                          disabled={!permisoEditable}
	                          onPress={() => setPermSellosList((prev) => prev.filter((_, i) => i !== idx))}>
                          <Ionicons name="close" size={16} color="#dc2626" />
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                ))}
	                <Pressable
	                  style={[styles.firmaBtn, !permisoEditable && styles.ctaDisabled]}
	                  disabled={!permisoEditable}
	                  onPress={() => setPermSellosList((prev) => [...prev, { ubicacion: '', numeroAnterior: '', numeroNuevo: '' }])}>
                  <Text style={styles.firmaBtnText}>+ Agregar sello</Text>
                </Pressable>
              </View>
              {permisoContexto === 'retiro' ? (
                <View style={styles.inputBlock}>
                  <Text style={styles.sectionTitleBlue}>Retiro de equipos</Text>
                  <View style={styles.retiroSummaryCard}>
                    <View style={styles.retiroSummaryRow}>
                      <View style={[styles.retiroSummaryPill, styles.retiroSummaryPillBlue]}>
                        <Ionicons name="layers-outline" size={13} color="#1d4ed8" />
                        <Text style={styles.retiroSummaryPillText}>{retiroTipoLabel}</Text>
                      </View>
                      <View
                        style={[
                          styles.retiroSummaryPill,
                          retiroEstado === 'retirado_centro'
                            ? styles.retiroSummaryPillGreen
                            : styles.retiroSummaryPillAmber,
                        ]}>
                        <Ionicons
                          name={retiroEstado === 'retirado_centro' ? 'hand-left-outline' : 'car-outline'}
                          size={13}
                          color={retiroEstado === 'retirado_centro' ? '#166534' : '#b45309'}
                        />
                        <Text style={styles.retiroSummaryPillText}>{retiroEstadoLabel}</Text>
                      </View>
                    </View>
                    <Text style={styles.sectionHint}>
                      Equipos marcados: {retiroSeleccionadosCount}/{retiroEquiposChecklist.length}
                    </Text>
                    <Text style={styles.sectionHint}>
                      Por mano: {retiroPorManoCount} | Despacho a Orca: {retiroDespachoCount}
                    </Text>
                    <Pressable
                      style={[styles.checklistOpenBtn, !permisoEditable && styles.ctaDisabled]}
                      onPress={abrirRetiroEquiposModal}>
                      <Ionicons
                        name={permisoFormularioSoloLectura ? 'eye-outline' : 'archive-outline'}
                        size={15}
                        color="#0b67d0"
                      />
                      <Text style={styles.checklistOpenBtnText}>
                        {permisoFormularioSoloLectura ? 'Ver retiro de equipos' : 'Configurar retiro de equipos'}
                      </Text>
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
                        setCameraTarget('permiso');
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
                                setCameraTarget('permiso');
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
	                  style={[styles.input, styles.textArea, !permisoEditable && styles.inputDisabled]}
	                  editable={permisoEditable}
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
	                      style={[styles.input, !permisoEditable && styles.inputDisabled]}
	                      editable={permisoEditable}
	                      value={permRecepciona}
                      onChangeText={setPermRecepciona}
                      placeholder="Nombre recepciona"
                    />
                  </View>
                  <View style={styles.inputCol}>
                    <Text style={styles.selectLabel}>RUT recepciona</Text>
	                    <TextInput
	                      style={[styles.input, !permisoEditable && styles.inputDisabled]}
	                      editable={permisoEditable}
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
	                    <Pressable style={[styles.firmaBtn, !permisoEditable && styles.ctaDisabled]} disabled={!permisoEditable} onPress={() => abrirFirma('perm_recepciona')}>
                      <Text style={styles.firmaBtnText}>{permFirmaRecepciona ? 'Editar firma' : 'Firmar'}</Text>
                    </Pressable>
                    {!!permFirmaRecepciona && (
	                      <Pressable style={styles.firmaClearBtn} disabled={!permisoEditable} onPress={() => limpiarFirma('perm_recepciona')}>
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
                          <Pressable style={[styles.firmaBtn, !permisoEditable && styles.ctaDisabled]} disabled={!permisoEditable} onPress={() => abrirFirma('perm_tecnico1')}>
                            <Text style={styles.firmaBtnText}>{permFirmaTecnico1 ? 'Editar firma' : 'Firmar'}</Text>
                          </Pressable>
                          {!!permFirmaTecnico1 && (
                            <Pressable style={styles.firmaClearBtn} disabled={!permisoEditable} onPress={() => limpiarFirma('perm_tecnico1')}>
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
                          <Pressable style={[styles.firmaBtn, !permisoEditable && styles.ctaDisabled]} disabled={!permisoEditable} onPress={() => abrirFirma('perm_tecnico2')}>
                            <Text style={styles.firmaBtnText}>{permFirmaTecnico2 ? 'Editar firma' : 'Firmar'}</Text>
                          </Pressable>
                          {!!permFirmaTecnico2 && (
                            <Pressable style={styles.firmaClearBtn} disabled={!permisoEditable} onPress={() => limpiarFirma('perm_tecnico2')}>
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
                        {tecnicosAsignadosExtra.map((name, idx) => {
                          const firma = firmasTecnicosExtra[idx]?.firma || '';
                          return (
                            <View key={`perm-cliente-${name}-${idx}`} style={styles.personBlock}>
                              <Text style={styles.signatureFieldLabel}>{`Tecnico ${idx + 3}`}</Text>
                              <Text style={styles.signatureNameText}>{name}</Text>
                              <View style={styles.firmaActions}>
                                <Pressable
                                  style={[styles.firmaBtn, !permisoEditable && styles.ctaDisabled]}
                                  disabled={!permisoEditable}
                                  onPress={() => {
                                    if (!permisoEditable) return;
                                    setFirmaExtraIndex(idx);
                                    abrirFirma('tecnico_extra');
                                  }}>
                                  <Text style={styles.firmaBtnText}>{firma ? 'Editar firma' : 'Firmar'}</Text>
                                </Pressable>
                                {!!firma && (
                                  <Pressable style={styles.firmaClearBtn} disabled={!permisoEditable} onPress={() => limpiarFirma('tecnico_extra', idx)}>
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
                  <>
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
                    {!!tecnicosAsignadosExtra.length && (
                      <View style={[styles.additionalTechWrap, styles.rowTopGap]}>
                        {tecnicosAsignadosExtra.map((name, idx) => {
                          const firma = firmasTecnicosExtra[idx]?.firma || '';
                          return (
                            <View key={`perm-inst-${name}-${idx}`} style={styles.personBlock}>
                              <Text style={styles.signatureFieldLabel}>{`Tecnico ${idx + 3}`}</Text>
                              <Text style={styles.signatureNameText}>{name || 'Sin nombre'}</Text>
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
	                  setPermisoSoloLectura(false);
	                  setPermisoContexto('instalacion');
                  setMantencionEditandoId(null);
                  setRetiroEditandoId(null);
                  setCambioEquipoEnabled(false);
                  setEquipoCambioId(null);
                  setSerieNuevaCambio('');
                  setTipoInstalacion('acta_entrega');
                }}>
	                <Text style={styles.cancelBtnText}>{permisoFormularioSoloLectura ? 'Cerrar' : 'Cancelar'}</Text>
	              </Pressable>
	              {!permisoFormularioSoloLectura ? (
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
                    const selectedCount = retiroEquiposChecklist.filter((eq) => !!eq.retirado).length;
                    if (!selectedCount) {
                      Alert.alert(titulo, 'Marca al menos un equipo retirado en el checklist.');
                      return;
                    }
                    if (retiroTipo === 'completo' && selectedCount !== retiroEquiposChecklist.length) {
                      Alert.alert(titulo, 'Si el retiro es completo, debes marcar todos los equipos del listado.');
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
                  const payload = {
                    centro_id: permCentroId,
                    actividad_id:
                      permisoContexto === 'mantencion'
                        ? Number(actividadAsignadaActiva?.id_actividad || 0) || null
                        : null,
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
                      permisoContexto === 'instalacion' || permisoContexto === 'mantencion' || permisoContexto === 'retiro'
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
                  const retiroEquiposPayload = retiroEquiposChecklist.map((eq) => ({
                    equipo_id: eq.equipo_id || null,
                    equipo_nombre: eq.equipo_nombre || null,
                    numero_serie: eq.numero_serie || null,
                    codigo: eq.codigo || null,
                    retirado: !!eq.retirado,
                    modalidad_retorno: normalizarModalidadRetorno(eq.modalidad_retorno),
                  }));
                  const retiroEstadoPayload = retiroEquiposPayload.some(
                    (eq) => !!eq.retirado && eq.modalidad_retorno === 'despacho_orca'
                  )
                    ? 'en_transito'
                    : 'retirado_centro';
                  try {
                    setSaving(true);
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
	                        estado_logistico: retiroEstadoPayload,
	                        observacion: permDescripcionTrabajo || null,
	                        tecnico_1: permTecnico1 || null,
	                        firma_tecnico_1: permFirmaTecnico1 || null,
	                        tecnico_2: permTecnico2 || null,
	                        firma_tecnico_2: permFirmaTecnico2 || null,
	                        recepciona_nombre: permRecepciona || null,
	                        recepciona_rut: permRecepcionaRut || null,
	                        firma_recepciona: permFirmaRecepciona || null,
	                        equipos: retiroEquiposPayload,
	                      });
	                    } else if (permisoContexto === 'retiro') {
	                      result = await createRetiroTerreno({
	                        centro_id: permCentroId,
	                        fecha_retiro: permFecha,
	                        tipo_retiro: retiroTipo,
	                        estado_logistico: retiroEstadoPayload,
	                        observacion: permDescripcionTrabajo || null,
	                        tecnico_1: permTecnico1 || null,
	                        firma_tecnico_1: permFirmaTecnico1 || null,
	                        tecnico_2: permTecnico2 || null,
	                        firma_tecnico_2: permFirmaTecnico2 || null,
	                        recepciona_nombre: permRecepciona || null,
	                        recepciona_rut: permRecepcionaRut || null,
	                        firma_recepciona: permFirmaRecepciona || null,
	                        equipos: retiroEquiposPayload,
	                      });
	                    } else {
	                      result = await createPermisoTrabajo(payload);
	                    }

                    if (permisoContexto === 'retiro' && result?.retiro) {
                      const retiroNormalizado = {
                        ...result.retiro,
                        tipo_retiro: retiroTipo,
                          estado_logistico: retiroEstadoPayload,
                          equipos: retiroEquiposPayload,
                        };
                        upsertRetiroTerrenoLocal(retiroNormalizado);
                        setRetiroEquiposChecklist(parseRetiroEquipos(retiroNormalizado.equipos));
                        setRetiroFormDirty(false);
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
                    await cargarPermisos({ force: true });
                    await cargarMantencionesTerreno();
                    await cargarRetirosTerreno();
                    await cargarActividadesAsignadas({ force: true });
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
                    await removeCachedValue(informesDraftCacheKey);
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
                    if (isOfflineQueueableError(error)) {
                      const payloadBase = payload;
                      if (permisoContexto === 'instalacion') {
                        const permisoId = Number(permisoCentroSeleccionado?.id_permiso_trabajo || 0) || null;
                        if (!permisoId && !(Number(payloadBase.acta_entrega_id || 0) > 0)) {
                          Alert.alert(
                            titulo,
                            'Sin red. Este permiso requiere un acta ya sincronizada para poder quedar en cola.'
                          );
                          return;
                        }
                        await enqueueOfflineOp(
                          permisoId ? 'update_permiso' : 'create_permiso',
                          permisoId ? { id: permisoId, data: payloadBase } : { data: payloadBase }
                        );
                        upsertPermisoLocal({
                          id_permiso_trabajo: permisoId || offlineTempId(),
                          acta_entrega_id: Number(payloadBase.acta_entrega_id || 0) || undefined,
                          centro_id: permCentroId || undefined,
                          fecha_ingreso: payloadBase.fecha_ingreso || todayInputDate(),
                          fecha_salida: payloadBase.fecha_salida || '',
                          correo_centro: payloadBase.correo_centro || '',
                          telefono_centro: payloadBase.telefono_centro || '',
                          responsabilidad: payloadBase.responsabilidad || '',
                          region: payloadBase.region || '',
                          localidad: payloadBase.localidad || '',
                          tecnico_1: payloadBase.tecnico_1 || '',
                          firma_tecnico_1: payloadBase.firma_tecnico_1 || '',
                          tecnico_2: payloadBase.tecnico_2 || '',
                          firma_tecnico_2: payloadBase.firma_tecnico_2 || '',
                          recepciona_nombre: payloadBase.recepciona_nombre || '',
                          recepciona_rut: payloadBase.recepciona_rut || '',
                          firma_recepciona: payloadBase.firma_recepciona || '',
                          puntos_gps: payloadBase.puntos_gps || '',
                          sellos: payloadBase.sellos || '',
                          medicion_fase_neutro: payloadBase.medicion_fase_neutro || '',
                          medicion_neutro_tierra: payloadBase.medicion_neutro_tierra || '',
                          hertz: payloadBase.hertz || '',
                          descripcion_trabajo: payloadBase.descripcion_trabajo || '',
                          cliente: clientePermSel?.nombre || actividadAsignadaActiva?.centro?.cliente || '',
                          centro: permCentroSel?.nombre || actividadAsignadaActiva?.centro?.nombre || '',
                          base_tierra: payloadBase.base_tierra || '',
                          cantidad_radares: payloadBase.cantidad_radares || '',
                        });
                      } else if (permisoContexto === 'mantencion') {
                        const mantId = Number(mantencionEditandoId || 0) || null;
                        const cambioPayload =
                          cambioEquipoEnabled && equipoCambioId
                            ? {
                                equipo_id: equipoCambioId,
                                armado_id: armadoVinculadoId || undefined,
                                serie_nueva: String(serieNuevaCambio || '').trim() || undefined,
                                codigo_nuevo:
                                  ((String(serieNuevaCambio || '').trim().replace(/\D+/g, '') || String(serieNuevaCambio || '').trim()).slice(0, 5) ||
                                    undefined),
                                tecnico: permTecnico1 || undefined,
                              }
                            : null;
                        await enqueueOfflineOp(
                          mantId ? 'update_mantencion' : 'create_mantencion',
                          mantId ? { id: mantId, data: payloadBase, cambioEquipo: cambioPayload } : { data: payloadBase, cambioEquipo: cambioPayload }
                        );
                        upsertMantencionLocal({
                          id_mantencion_terreno: mantId || offlineTempId(),
                          actividad_id: Number(actividadAsignadaActiva?.id_actividad || 0) || undefined,
                          centro_id: permCentroId || undefined,
                          codigo_ponton:
                            permCentroSel?.nombre_ponton ||
                            actividadAsignadaActiva?.centro?.nombre_ponton ||
                            '',
                          fecha_ingreso: payloadBase.fecha_ingreso || todayInputDate(),
                          correo_centro: payloadBase.correo_centro || '',
                          telefono_centro: payloadBase.telefono_centro || '',
                          base_tierra: payloadBase.base_tierra || '',
                          cantidad_radares: payloadBase.cantidad_radares || '',
                          responsabilidad: payloadBase.responsabilidad || '',
                          region: payloadBase.region || '',
                          localidad: payloadBase.localidad || '',
                          tecnico_1: payloadBase.tecnico_1 || '',
                          firma_tecnico_1: payloadBase.firma_tecnico_1 || '',
                          tecnico_2: payloadBase.tecnico_2 || '',
                          firma_tecnico_2: payloadBase.firma_tecnico_2 || '',
                          recepciona_nombre: payloadBase.recepciona_nombre || '',
                          recepciona_rut: payloadBase.recepciona_rut || '',
                          firma_recepciona: payloadBase.firma_recepciona || '',
                          puntos_gps: payloadBase.puntos_gps || '',
                          sellos: payloadBase.sellos || '',
                          medicion_fase_neutro: payloadBase.medicion_fase_neutro || '',
                          medicion_neutro_tierra: payloadBase.medicion_neutro_tierra || '',
                          hertz: payloadBase.hertz || '',
                          descripcion_trabajo: payloadBase.descripcion_trabajo || '',
                          evidencia_foto: payloadBase.evidencia_foto || '',
                          checklist_equipos: payloadBase.checklist_equipos || '',
                          cliente: actividadAsignadaActiva?.centro?.cliente || clientePermSel?.nombre || '',
                          centro: actividadAsignadaActiva?.centro?.nombre || permCentroSel?.nombre || '',
                        } as Permiso);
                      } else if (permisoContexto === 'retiro') {
                        const retiroId = Number(retiroEditandoId || 0) || null;
                        const retiroPayload = retiroId
                          ? {
                              centro_id: permCentroId,
                              fecha_retiro: permFecha,
                              tipo_retiro: retiroTipo,
                              estado_logistico: retiroEstadoPayload,
                              observacion: permDescripcionTrabajo || null,
                              tecnico_1: permTecnico1 || null,
                              firma_tecnico_1: permFirmaTecnico1 || null,
                              tecnico_2: permTecnico2 || null,
                              firma_tecnico_2: permFirmaTecnico2 || null,
                              recepciona_nombre: permRecepciona || null,
                              recepciona_rut: permRecepcionaRut || null,
                              firma_recepciona: permFirmaRecepciona || null,
                              equipos: retiroEquiposPayload,
                            }
                          : {
                              centro_id: permCentroId,
                              fecha_retiro: permFecha,
                              tipo_retiro: retiroTipo,
                              estado_logistico: retiroEstadoPayload,
                              observacion: permDescripcionTrabajo || null,
                              tecnico_1: permTecnico1 || null,
                              firma_tecnico_1: permFirmaTecnico1 || null,
                              tecnico_2: permTecnico2 || null,
                              firma_tecnico_2: permFirmaTecnico2 || null,
                              recepciona_nombre: permRecepciona || null,
                              recepciona_rut: permRecepcionaRut || null,
                              firma_recepciona: permFirmaRecepciona || null,
                              equipos: retiroEquiposPayload,
                            };
                        await enqueueOfflineOp(
                          retiroId ? 'update_retiro' : 'create_retiro',
                          retiroId ? { id: retiroId, data: retiroPayload } : { data: retiroPayload }
                        );
                        upsertRetiroTerrenoLocal({
                          id_retiro_terreno: retiroId || offlineTempId(),
                          centro_id: permCentroId || undefined,
                          codigo_ponton:
                            permCentroSel?.nombre_ponton ||
                            actividadAsignadaActiva?.centro?.nombre_ponton ||
                            '',
                          fecha_retiro: permFecha,
                          tipo_retiro: retiroTipo,
                          estado_logistico: retiroEstadoPayload,
                          observacion: permDescripcionTrabajo || '',
                          tecnico_1: permTecnico1 || '',
                          firma_tecnico_1: permFirmaTecnico1 || '',
                          tecnico_2: permTecnico2 || '',
                          firma_tecnico_2: permFirmaTecnico2 || '',
                          recepciona_nombre: permRecepciona || '',
                          recepciona_rut: permRecepcionaRut || '',
                          firma_recepciona: permFirmaRecepciona || '',
                          cliente: actividadAsignadaActiva?.centro?.cliente || clientePermSel?.nombre || '',
                          centro: permCentroSel?.nombre || actividadAsignadaActiva?.centro?.nombre || '',
                          equipos: retiroEquiposPayload,
                        });
                      }
                      await removeCachedValue(informesDraftCacheKey);
                      setShowPermisoModal(false);
                      setShowRetiroChecklistModal(false);
                      setPermisoContexto('instalacion');
                      setMantencionEditandoId(null);
                      setRetiroEditandoId(null);
                      setActividadAsignadaActiva(null);
                      setTecnicosAsignadosExtra([]);
                      Alert.alert(titulo, 'Sin red. El informe quedo pendiente para sincronizar.');
                      return;
                    }
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
	              ) : null}
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
                    if (cameraTarget === 'levantamiento') {
                      setLevantamientoFotos((prev) => {
                        if (evidenciaTargetIndex !== null && evidenciaTargetIndex >= 0 && evidenciaTargetIndex < prev.length) {
                          const next = [...prev];
                          next[evidenciaTargetIndex] = { ...next[evidenciaTargetIndex], uri: newPhoto };
                          return next;
                        }
                        return [...prev, { uri: newPhoto, descripcion: '' }];
                      });
                    } else {
                      setPermEvidenciaFotos((prev) => {
                        if (evidenciaTargetIndex !== null && evidenciaTargetIndex >= 0 && evidenciaTargetIndex < prev.length) {
                          const next = [...prev];
                          next[evidenciaTargetIndex] = newPhoto;
                          return next;
                        }
                        if (prev.length >= 3) return prev;
                        return [...prev, newPhoto];
                      });
                    }
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
  safe: { flex: 1, backgroundColor: '#eef3f6' },
  container: { padding: 16, paddingTop: (RNStatusBar.currentHeight || 24) + 12, gap: 12, backgroundColor: '#eef3f6' },
  hero: {
    backgroundColor: '#06141d',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(45, 165, 255, 0.14)',
    padding: 16,
    gap: 14,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#06141d',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  heroGlowPrimary: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(45, 165, 255, 0.20)',
    right: -54,
    top: -74,
  },
  heroGlowSecondary: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(34, 197, 94, 0.10)',
    left: -48,
    bottom: -62,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(159, 215, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { color: '#fff', fontWeight: '900', fontSize: 20 },
  heroSubtitle: { color: '#98c7e8', fontWeight: '700', fontSize: 12.5, marginTop: 2 },
  heroBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.18)',
    backgroundColor: 'rgba(22, 163, 74, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  heroMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(159, 215, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  heroMetaText: { color: '#f8fbff', fontWeight: '800', fontSize: 11 },
  card: {
    backgroundColor: '#fbfdff',
    borderWidth: 1,
    borderColor: '#d7e3ec',
    borderRadius: 18,
    padding: 14,
    gap: 10,
    shadowColor: '#9db7ca',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  levantamientoInfoCard: { borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff', borderRadius: 12, padding: 10, gap: 8 },
  levantamientoInfoTitle: { color: '#0f172a', fontWeight: '900', fontSize: 15 },
  levantamientoBlock: { borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', borderRadius: 12, padding: 10, gap: 8 },
  levantamientoBlockTitle: { color: '#0f172a', fontWeight: '900', fontSize: 13.5 },
  levantamientoTwoCols: { flexDirection: 'row', gap: 8 },
  levantamientoThreeCols: { flexDirection: 'row', gap: 8 },
  levantamientoTextAreaSmall: { minHeight: 78, paddingTop: 10 },
  levantamientoPhotoAddBtn: { width: 38, height: 34, borderRadius: 10, borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  label: { color: '#7a8b98', fontWeight: '700', fontSize: 15 },
  row: { flexDirection: 'row', gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowTopGap: { marginTop: 8 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryTabBtn: { flexBasis: '48%' },
  tabBtn: { flex: 1, minHeight: 42, borderRadius: 14, borderWidth: 1, borderColor: '#d4e0ea', backgroundColor: '#ffffff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  tabBtnActive: { backgroundColor: '#0d4a8c', borderColor: '#0d4a8c' },
  tabBtnDone: { borderColor: '#86efac', backgroundColor: '#f0fdf4' },
  tabBtnDisabled: { borderColor: '#cbd5e1', backgroundColor: '#f8fafc' },
  tabBtnText: { color: '#164e9c', fontWeight: '800', fontSize: 12.5 },
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
  categoryLabel: {
    color: '#7a8b98',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.7,
  },
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
  pendingMetaValue: { color: '#dc2626', fontWeight: '800' },
  linkedMetaValue: { color: '#166534', fontWeight: '800' },
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
  linkArmadoActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  linkArmadoBtnFlex: {
    flex: 1,
  },
  linkArmadoBtnText: { color: '#1d4ed8', fontWeight: '700', fontSize: 12.5 },
  linkArmadoBtnTextDisabled: { color: '#94a3b8' },
  linkArmadoBtnSecondary: {
    borderColor: '#99f6e4',
    backgroundColor: '#f0fdfa',
  },
  linkArmadoBtnTextSecondary: {
    color: '#0f766e',
  },
  linkArmadoBtnDanger: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  linkArmadoBtnTextDanger: {
    color: '#b91c1c',
  },
  linkArmadoBtnSuccess: {
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
  },
  linkArmadoBtnTextSuccess: {
    color: '#166534',
  },
  linkArmadoBtnEdit: {
    marginTop: 0,
    paddingHorizontal: 10,
    justifyContent: 'center',
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
  },
  armadoEquiposInlineBtn: {
    marginTop: 10,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  armadoEquiposLoading: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  armadoEquiposLoadingText: {
    color: '#475569',
    fontWeight: '700',
  },
  armadoEquiposSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  armadoEquiposSummaryChip: {
    minWidth: '47%',
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 2,
  },
  armadoEquiposSummaryChipNeutral: {
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  armadoEquiposSummaryChipOk: {
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
  },
  armadoEquiposSummaryChipWarn: {
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
  },
  armadoEquiposSummaryLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  armadoEquiposSummaryValue: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
  },
  armadoEquiposList: {
    maxHeight: 420,
  },
  armadoEquipoCard: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fbff',
    borderRadius: 14,
    padding: 12,
    gap: 8,
    marginBottom: 10,
  },
  armadoEquipoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  armadoEquipoTitleWrap: {
    flex: 1,
    gap: 3,
  },
  armadoEquipoTitle: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 13.5,
  },
  armadoEquipoMeta: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 12,
  },
  armadoEquipoBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  armadoEquipoBadgeOk: {
    borderColor: '#86efac',
    backgroundColor: '#f0fdf4',
  },
  armadoEquipoBadgeWarn: {
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
  },
  armadoEquipoBadgeText: {
    fontWeight: '800',
    fontSize: 11,
  },
  armadoEquipoBadgeTextOk: { color: '#166534' },
  armadoEquipoBadgeTextWarn: { color: '#b45309' },
  armadoEquipoInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  armadoEquipoInfoLabel: {
    color: '#64748b',
    fontWeight: '700',
    fontSize: 12,
  },
  armadoEquipoInfoValue: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 12,
    flex: 1,
    textAlign: 'right',
  },
  armadoEquipoActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  armadoEquipoActionBtn: {
    flex: 1,
    minWidth: '30%',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  armadoEquipoActionBtnDisabled: {
    opacity: 0.6,
  },
  armadoEquipoActionBtnActiveOk: {
    borderColor: '#86efac',
    backgroundColor: '#f0fdf4',
  },
  armadoEquipoActionBtnActiveWarn: {
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
  },
  armadoEquipoActionText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 12,
  },
  armadoEquipoActionTextOk: { color: '#166534' },
  armadoEquipoActionTextWarn: { color: '#b45309' },
  armadoEquiposEmpty: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 8,
  },
  armadoEquiposEmptyText: {
    color: '#64748b',
    fontWeight: '700',
    textAlign: 'center',
  },
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
    position: 'relative',
    overflow: 'hidden',
    gap: 8,
    borderWidth: 1,
    borderColor: '#cdeedd',
    backgroundColor: '#f7fffb',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginTop: 6,
    shadowColor: '#9db7ca',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  installCompletedCard: {
    borderColor: '#638da3',
    backgroundColor: '#dbe8ef',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingTop: 34,
    paddingBottom: 10,
  },
  mantCompletedCard: {
    borderColor: '#638da3',
    backgroundColor: '#dbe8ef',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingTop: 34,
    paddingBottom: 10,
  },
  mantCompletedTitle: {
    paddingRight: 12,
    fontSize: 14.5,
    lineHeight: 17,
  },
  retiroCompletedCard: {
    borderColor: '#638da3',
    backgroundColor: '#dbe8ef',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingTop: 34,
    paddingBottom: 10,
  },
  retiroCompletedTitle: {
    paddingRight: 12,
    fontSize: 14.5,
    lineHeight: 17,
  },
  levantamientoCompletedCard: {
    borderColor: '#638da3',
    backgroundColor: '#dbe8ef',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingTop: 34,
    paddingBottom: 10,
  },
  levantamientoCompletedTitle: {
    paddingRight: 12,
    fontSize: 14.5,
    lineHeight: 17,
  },
  installCompletedTopAccent: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 4,
    backgroundColor: '#16a34a',
  },
  installCompletedGlowStrong: {
    position: 'absolute',
    right: -42,
    top: -42,
    width: 122,
    height: 122,
    borderRadius: 61,
    backgroundColor: 'rgba(22, 163, 74, 0.34)',
  },
  installCompletedGlowSoft: {
    position: 'absolute',
    right: -78,
    top: -78,
    width: 178,
    height: 178,
    borderRadius: 89,
    backgroundColor: 'rgba(34, 197, 94, 0.18)',
  },
  installInProgressCard: {
    borderColor: '#fcd34d',
    backgroundColor: '#fffbeb',
  },
  installCardHeader: {
    minHeight: 22,
    justifyContent: 'flex-start',
  },
  installCardTitle: {
    paddingRight: 120,
  },
  installTypeBadgeRow: {
    marginTop: 6,
    marginBottom: 2,
    alignItems: 'flex-start',
  },
  installCompletedTypeBadgeRow: {
    position: 'absolute',
    top: 6,
    right: 2,
    zIndex: 3,
    marginTop: 0,
    marginBottom: 0,
  },
  installTypeBadgeCorner: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  installTypeBadgeCardCorner: {
    position: 'absolute',
    top: 8,
    right: 10,
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
  mantTypeBadge: {
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
  },
  retiroTypeBadge: {
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
  },
  levantamientoTypeBadge: {
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
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
  mantTypeBadgeText: {
    color: '#1e3a8a',
  },
  retiroTypeBadgeText: {
    color: '#1e3a8a',
  },
  levantamientoTypeBadgeText: {
    color: '#1e3a8a',
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
  sectionTitle: { color: '#163041', fontWeight: '900', fontSize: 15 },
  sectionSubTitle: { color: '#64748b', fontWeight: '700', marginTop: 2 },
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
  assignedSectionTitle: { color: '#7a8b98', fontWeight: '800', fontSize: 12.5, marginTop: 6, textTransform: 'uppercase' },
  assignedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#d7e3ec',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
  },
  assignedItemActive: {
    borderColor: '#86efac',
    backgroundColor: '#f7fffb',
  },
  assignedItemProgress: {
    borderColor: '#fed7aa',
    backgroundColor: '#fff7ed',
  },
  assignedItemDone: {
    borderColor: '#cdeedd',
    backgroundColor: '#f7fffb',
  },
  assignedItemTitle: { color: '#163041', fontWeight: '900', fontSize: 13 },
  assignedItemMeta: { color: '#64748b', fontWeight: '700', fontSize: 11.5, marginTop: 2 },
  assignedActionPill: {
    borderWidth: 1,
    borderColor: '#d4e0ea',
    backgroundColor: '#ffffff',
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
  assignedActionText: { color: '#164e9c', fontWeight: '800', fontSize: 11.5 },
  assignedActionTextActive: { color: '#166534' },
  assignedActionTextProgress: { color: '#92400e' },
  assignedActionTextDone: { color: '#166534' },
  levModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.45)',
    paddingHorizontal: 12,
    paddingVertical: 24,
    justifyContent: 'center',
  },
  levModalCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbeafe',
    padding: 12,
    maxHeight: '92%',
  },
  levEditRequestBtn: {
    borderWidth: 1,
    borderColor: '#fcd34d',
    backgroundColor: '#fef3c7',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  levEditRequestBtnText: { color: '#92400e', fontWeight: '800', fontSize: 11.5 },
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
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0d4a8c', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  newBtnText: { color: '#fff', fontWeight: '800', fontSize: 12.5 },
  rowItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eef2f7' },
  rowTitle: { color: '#163041', fontWeight: '900' },
  installCompletedTitle: {
    paddingRight: 12,
    fontSize: 14.5,
    lineHeight: 17,
  },
  rowSubtitle: { color: '#334155', fontWeight: '800', marginTop: 2 },
  rowMeta: { color: '#64748b', fontSize: 12, marginTop: 1, fontWeight: '700' },
  rowActions: { flexDirection: 'row', gap: 6, marginTop: 14, alignSelf: 'flex-end' },
  actionBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  actionBtnWarn: { borderColor: '#dc2626', backgroundColor: '#ef4444' },
  actionBtnSuccess: { borderColor: '#86efac', backgroundColor: '#f0fdf4' },
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
  retiroSummaryCard: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    backgroundColor: '#f7fbff',
    padding: 12,
    gap: 10,
    marginTop: 4,
  },
  retiroSummaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  retiroSummaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  retiroSummaryPillBlue: { borderColor: '#bfdbfe', backgroundColor: '#eff6ff' },
  retiroSummaryPillGreen: { borderColor: '#86efac', backgroundColor: '#f0fdf4' },
  retiroSummaryPillAmber: { borderColor: '#fcd34d', backgroundColor: '#fffbeb' },
  retiroSummaryPillText: { color: '#0f172a', fontSize: 12, fontWeight: '800' },
  retiroModalSummary: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fbff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  retiroItemModeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  retiroItemModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  retiroItemModeBtnGreen: { borderColor: '#86efac', backgroundColor: '#f0fdf4' },
  retiroItemModeBtnAmber: { borderColor: '#86efac', backgroundColor: '#f0fdf4' },
  retiroItemModeText: { color: '#475569', fontSize: 11.5, fontWeight: '800' },
  retiroItemModeTextActive: { color: '#166534' },
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
  saveBtnDisabled: { opacity: 0.65 },
  ctaDisabled: { backgroundColor: '#94a3b8' },
  ctaDone: { backgroundColor: '#16a34a' },
  saveBtnText: { color: '#fff', fontWeight: '700' },
});

