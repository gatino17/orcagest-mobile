import React, { useMemo, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, Pressable, StatusBar as RNStatusBar, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { AuthContext } from '../_layout';
import { useLocalSearchParams } from 'expo-router';
import { getEquipos, getMaterialesArmado, saveMaterialesArmado, updateEquipo, createEquipo, updateArmado, validarSerieEquipo, getArmados } from '@/lib/api';
import { enqueueOfflineOp, syncOfflineQueue } from '@/lib/offline-queue';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as SecureStore from 'expo-secure-store';
import { subscribeArmadoUpdated } from '@/lib/realtime';

type Equipo = {
  id: string;
  nombre: string;
  caja: string;
  serie: string;
  codigo: string;
};

type Material = {
  id: string;
  nombre: string;
  cantidad: number;
  caja?: string;
  usuario?: string;
};

type MaterialActionMode = 'ajuste' | 'incremento';
type CajaEstado = 'abierta' | 'cerrada';
type BoxSelectorTarget = {
  tipo: 'equipo' | 'material';
  id: string;
  actual: string;
  nombre: string;
};

const DEFAULT_PENDING_BOX = 'Pendiente de caja';
const DEFAULT_FIRST_BOX = 'Caja 1';

const MATERIALES_PREDEF: string[] = [
  'Cable Electrico 3 x 1,5mm',
  'Cable Electrico 3 x 0,75mm',
  'Cable Electrico 2 x 0,75mm',
  'Cable UTP CAT 5e',
  'CABLE UTP BLINDADO',
  'Enchufes Macho',
  'Enchufes Hembra',
  'Automatico 16A',
  'Cinta Aislante Super 33',
  'Cinta Engomada',
  'Cable Power',
  'Cable UPS',
  'Regleta 6-8mm',
  'Amarras Plasticas 4,5x300mm (med)',
  'Amarras Plasticas 7,5x500mm (gran)',
  'Pernos M8 Camara',
  'Pernos M6 Platina',
  'Pernos M5 tablero interior',
  'Corrugado 1"',
  'Terminales Rectos 1"',
  'Terminal curvo 1"',
  'Abrazaderas 2"',
  'Abrazaderas 2"1/2',
  'Abrazaderas 3"',
  'Autoperforantes 1"',
  'Autoperforantes 1"1/2',
  'Autoperforantes 2"',
  'Autoperforantes 2 1/2"',
  'Autoperforantes 3"',
  'Tornillos lata madera 1"',
  'Tornillos lata madera 1"1/2',
  'Tornillos lata madera 23"',
  'Tornillos lata madera 2"1/2',
  'Tornillos vulcanita',
  'Kit de Soporte a Poste 300mm',
  'Kit de Soporte a Poste 400mm',
  'Kit de Soporte a Poste 500mm',
  'Omega 1"',
  'Cadie 1"',
  'Orejas tableros',
  'Piola 3mm',
  'Piola engomada',
  'Tensores 3/8',
  'Grilletes',
  'Guardacabos',
  'Tirafondos',
  'Prensas',
  'Cancamo',
  'Platina o angulo (Tira)',
  'Disco Corte',
  'PG 21',
  'PG 16',
  'Cinta doble contacto',
  'Caja de Union Foco 89x89x52',
  'Caja de Camara Interior 153x110x65',
  'Caja interior 175x151x95',
  'Caja de Panel Victron 184x255x99',
  'Canaletas 40x16x2000 (chicas)',
  'Canaletas 100x50x2000 (grandes)',
  'Pernos de rack (tuerca enjaulada)',
  'Extension USB',
  'Cable HDMI',
  'Conectores RJ45',
  'Conector hembra red (RJ45)',
  'Cables VGA',
  'Copla VGA',
  'Soporte LED',
  'Spray',
  'Tapagoteras',
  'Cinta espiral',
  'Tarjeta de Memoria microSD 8GB',
  'Grampas para cable (Paquete)',
  'PatchCore 90 Cms (2MTS)',
  'PatchCore 5 Mts.',
  'PatchCore 10 Mts.',
  'Sellos',
  'Puente bateria',
  'Bolsas de Basura Grandes',
  'Cajas (fondo + tapa)',
  'Cinta embalaje',
  'Logos',
  'Brazo Ubiquiti',
  'Mastil',
  'Riel U',
  'Perno Pasado',
];

const GRUPOS_EQUIPOS: { titulo: string; items: string[] }[] = [
  {
    titulo: 'Oficina',
    items: ['PC', 'Monitor', 'Mouse', 'Teclado', 'Router', 'Switch', 'Switch (Cisco)', 'Switch raqueable', 'Camara Interior', 'Parlantes', 'Sensor Magnetico', 'Rack 9U - tuercas - tornillos', 'Bandeja Rack - tornillos', 'Zapatilla Rack (PDU)'],
  },
  {
    titulo: 'Tablero Alarma',
    items: ['Tablero 500x400x200', 'Baliza Interior', 'Bocina Interior', 'Baliza Exterior 1', 'Baliza Exterior 2', 'Bocina Exterior 1', 'Bocina Exterior 2', 'Foco led 1 150W', 'Foco led 2 150W', 'Foco led 1 50W', 'Foco led 2 50W', 'Fuente poder 12V', 'Axis P8221'],
  },
  {
    titulo: 'Tablero Respaldo',
    items: ['Tablero 1200x800x300', 'Tablero 1000x600x300', 'Inversor cargador Victron', 'Panel Victron', 'Bateria 1', 'Bateria 2', 'Bateria 3', 'Bateria 4', 'Bateria 5', 'Bateria 6', 'Switch POE', 'Sensor magnetico respaldo', 'Sensor magnetico cargador', 'Cargador 1', 'Cargador 2', 'Tablero Cargador 750x500x250', 'UPS online'],
  },
  {
    titulo: 'Mastil',
    items: ['Tablero Derivacion (400x300x200)', 'Radar 1', 'Radar 2', 'Cable rj radar 1', 'Cable rj radar 2', 'Soporte radar 1', 'Soporte radar 2', 'Camara PTZ termal', 'Camara PTZ Laser', 'Camara PTZ Laser 2', 'Camara Modulo', 'Camara Silo 1', 'Camara Silo 2', 'Camara Ensinerador', 'Ensilaje interior', 'Ensilaje exterior', 'Camara Popa', 'Camara acceso 1', 'Camara acceso 2', 'Camara acceso 3', 'Camara acceso 4', 'Enlace Ubiquiti'],
  },
  {
    titulo: 'Tablero Camara',
    items: ['Tablero Camara (500x700x250)', 'Poe Power 1', 'Poe Power 2', 'Poe Power 3', 'Poe Power 4', 'Poe Power 5', 'Switch POE 1', 'Switch POE 2', 'Mass', 'Tablero 750x500x250', 'Switch 1', 'Switch 2', 'Switch 3', 'Switch 4', 'Netio'],
  },
];

const BASE_EQUIPOS: Equipo[] = GRUPOS_EQUIPOS.flatMap((g, gi) =>
  g.items.map((nombre, idx) => ({
    id: `${g.titulo}-${idx}`,
    nombre,
    caja: DEFAULT_PENDING_BOX,
    serie: '',
    codigo: '',
  }))
);

export default function ArmadoScreen() {
  const { token, role, name, userId } = useContext(AuthContext);
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const params = useLocalSearchParams();

  const [equipos, setEquipos] = useState<Equipo[]>(BASE_EQUIPOS);
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [loadingMateriales, setLoadingMateriales] = useState(false);
  const [guardandoMat, setGuardandoMat] = useState(false);
  const [guardandoEq, setGuardandoEq] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'equipos' | 'materiales'>('equipos');
  const [cajas, setCajas] = useState<string[]>([DEFAULT_PENDING_BOX]);
  const [camVisible, setCamVisible] = useState(false);
  const [camEquipoId, setCamEquipoId] = useState<string | null>(null);
  const [camEquipoNombre, setCamEquipoNombre] = useState<string | null>(null);
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const scannedOnce = useRef(false);
  const seriesConfirmadasRef = useRef<Set<string>>(new Set());
  const ignoreNextRealtimeRefreshRef = useRef(false);
  const suppressRealtimeRefreshRef = useRef(false);
  const equiposSnapshotRef = useRef<Record<string, string>>({});
  const materialesSnapshotRef = useRef<Record<string, string>>({});
  const [modalCajasVisible, setModalCajasVisible] = useState(false);
  const [modalGestionCajasVisible, setModalGestionCajasVisible] = useState(false);
  const [modalGuardarMatVisible, setModalGuardarMatVisible] = useState(false);
  const [modalQuitarCajaVisible, setModalQuitarCajaVisible] = useState(false);
  const [modalPrefinalizadoVisible, setModalPrefinalizadoVisible] = useState(false);
  const [modalAccionMaterialVisible, setModalAccionMaterialVisible] = useState(false);
  const [modalSelectorCajaVisible, setModalSelectorCajaVisible] = useState(false);
  const [selectorCajaTarget, setSelectorCajaTarget] = useState<BoxSelectorTarget | null>(null);
  const [materialAccionModo, setMaterialAccionModo] = useState<MaterialActionMode>('ajuste');
  const [materialAccionTarget, setMaterialAccionTarget] = useState<Material | null>(null);
  const [materialAccionCantidad, setMaterialAccionCantidad] = useState('');
  const [materialAccionCaja, setMaterialAccionCaja] = useState(DEFAULT_PENDING_BOX);
  const [guardandoAccionMaterial, setGuardandoAccionMaterial] = useState(false);
  const [gruposColapsados, setGruposColapsados] = useState<Record<string, boolean>>({});
  const [cacheReady, setCacheReady] = useState(false);
  const [cajasEstado, setCajasEstado] = useState<Record<string, CajaEstado>>({});
  const [resumenQuitarCaja, setResumenQuitarCaja] = useState({
    target: '',
    destino: '',
    equipos: 0,
    materiales: 0,
  });
  const [descripcionCajaPrincipal, setDescripcionCajaPrincipal] = useState('');
  const [descripcionCajaNueva, setDescripcionCajaNueva] = useState('');
  const centro = (params.centro as string) || '-';
  const cliente = (params.cliente as string) || '-';
  const armadoId = (params.armadoId as string) || '';
  const estado = (params.estado as string) || '';
  const fechaInicioArmado = (params.fecha_inicio as string) || '';
  const fechaTerminoArmado = (params.fecha_cierre as string) || '';
  const [estadoVista, setEstadoVista] = useState<string>(estado || '');
  const [fechaInicioVista, setFechaInicioVista] = useState<string>(fechaInicioArmado);
  const [fechaTerminoVista, setFechaTerminoVista] = useState<string>(fechaTerminoArmado);
  const [armadoActual, setArmadoActual] = useState<any | null>(null);
  const estadoNormalizado = String(estadoVista || estado || '').toLowerCase();
  const esFinalizado = estadoNormalizado === 'finalizado';
  const esPrefinalizado = estadoNormalizado === 'prefinalizado';
  const esSoloLectura = esFinalizado || esPrefinalizado;
  const totalCajasParam = params.total_cajas ? Number(params.total_cajas) : undefined;
  const [totalCajas, setTotalCajas] = useState<number | undefined>(totalCajasParam);
  const centroId = params.centro_id ? Number(params.centro_id) : undefined;
  const cacheKey = useMemo(
    () => `armado_cache_v1:${armadoId || 'sin-armado'}:${centroId || 'sin-centro'}`,
    [armadoId, centroId]
  );
  const normalizeTechName = useCallback(
    (value: any) =>
      String(value || '')
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''),
    []
  );
  const companerosArmado = useMemo(() => {
    const lista = Array.isArray(armadoActual?.tecnicos_asignados) ? armadoActual.tecnicos_asignados : [];
    const uid = Number(userId || 0) || 0;
    const myName = normalizeTechName(name);
    return lista
      .filter((tec: any) => {
        const tid = Number(tec?.id || 0) || 0;
        const tname = normalizeTechName(tec?.nombre);
        if (uid > 0 && tid === uid) return false;
        if (myName && tname && tname === myName) return false;
        return !!(tid || tname);
      })
      .map((tec: any) => tec?.nombre)
      .filter(Boolean);
  }, [armadoActual, name, normalizeTechName, userId]);

  const numeroCaja = useCallback((caja?: string) => {
    const n = parseInt(String(caja || '').replace(/[^\d]/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
  }, []);

  const normalizarCajaTexto = useCallback((value?: string) => {
    const raw = String(value || '').trim().replace(/\s+/g, ' ');
    if (!raw) return DEFAULT_PENDING_BOX;
    const match = raw.match(/^Caja\s*(\d+)(?:\s*-\s*(.+))?$/i);
    if (!match) return raw;
    const numero = Number.parseInt(match[1], 10);
    const descripcion = String(match[2] || '').trim();
    return descripcion ? `Caja ${numero} - ${descripcion}` : `Caja ${numero}`;
  }, []);

  const unificarCajas = useCallback((items: string[]) => {
    const porNumero = new Map<number, string>();
    const extras: string[] = [];
    items.forEach((item) => {
      const normalizada = normalizarCajaTexto(item);
      const match = normalizada.match(/^Caja\s*(\d+)(?:\s*-\s*(.+))?$/i);
      if (!match) {
        if (!extras.includes(normalizada)) extras.push(normalizada);
        return;
      }
      const numero = Number.parseInt(match[1], 10);
      const actual = porNumero.get(numero);
      const actualTieneDetalle = !!String(actual || '').match(/^Caja\s*\d+\s*-\s*.+$/i);
      const nuevaTieneDetalle = !!String(normalizada || '').match(/^Caja\s*\d+\s*-\s*.+$/i);
      if (!actual || (nuevaTieneDetalle && !actualTieneDetalle) || (nuevaTieneDetalle && actualTieneDetalle)) {
        porNumero.set(numero, normalizada);
      }
    });
    const cajasOrdenadas = Array.from(porNumero.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, label]) => label);
    const pendiente = extras.find((item) => normalizarCajaTexto(item) === DEFAULT_PENDING_BOX);
    const otrosExtras = extras
      .filter((item) => normalizarCajaTexto(item) !== DEFAULT_PENDING_BOX)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    return [...(pendiente ? [DEFAULT_PENDING_BOX] : []), ...cajasOrdenadas, ...otrosExtras];
  }, [normalizarCajaTexto]);

  const normalizarCajaEstado = useCallback((value: any): CajaEstado => {
    return String(value || '').trim().toLowerCase() === 'cerrada' ? 'cerrada' : 'abierta';
  }, []);

  const sincronizarEstadosCajas = useCallback((listaCajas: string[], estadosBase?: Record<string, any>) => {
    const cajasNormalizadas = unificarCajas(listaCajas);
    const fuente = estadosBase && typeof estadosBase === 'object' ? estadosBase : {};
    const estadoPorNumero = new Map<number, CajaEstado>();
    Object.entries(fuente).forEach(([key, value]) => {
      const numero = numeroCaja(key);
      if (!numero) return;
      if (!estadoPorNumero.has(numero)) {
        estadoPorNumero.set(numero, normalizarCajaEstado(value));
      }
    });
    const resultado: Record<string, CajaEstado> = {};
    cajasNormalizadas.forEach((caja) => {
      const numero = numeroCaja(caja);
      resultado[caja] = normalizarCajaEstado(fuente[caja] ?? estadoPorNumero.get(numero) ?? 'abierta');
    });
    return resultado;
  }, [normalizarCajaEstado, numeroCaja, unificarCajas]);

  const estadoCaja = useCallback((caja?: string): CajaEstado => {
    const nombre = normalizarCajaTexto(caja);
    return normalizarCajaEstado(cajasEstado[nombre] || 'abierta');
  }, [cajasEstado, normalizarCajaEstado, normalizarCajaTexto]);

  const esCajaPendiente = useCallback(
    (caja?: string) => normalizarCajaTexto(caja) === DEFAULT_PENDING_BOX,
    [normalizarCajaTexto]
  );

  const contarCajasReales = useCallback(
    (lista: string[] = []) =>
      unificarCajas(lista).filter((caja) => !esCajaPendiente(caja) && numeroCaja(caja) > 0).length,
    [esCajaPendiente, numeroCaja, unificarCajas]
  );

  const mismasCajas = useCallback((a: string[] = [], b: string[] = []) => {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    return a.every((item, index) => item === b[index]);
  }, []);

  const cajasOrdenadasEdicionMaterial = useMemo(() => {
    return [...cajas].sort((a, b) => {
      const cierreA = estadoCaja(a) === 'cerrada' ? 1 : 0;
      const cierreB = estadoCaja(b) === 'cerrada' ? 1 : 0;
      if (cierreA !== cierreB) return cierreA - cierreB;
      const numeroDiff = numeroCaja(a) - numeroCaja(b);
      if (numeroDiff !== 0) return numeroDiff;
      return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
    });
  }, [cajas, estadoCaja, numeroCaja]);

  const cajasAbiertasEdicionMaterial = useMemo(
    () => cajasOrdenadasEdicionMaterial.filter((caja) => estadoCaja(caja) !== 'cerrada'),
    [cajasOrdenadasEdicionMaterial, estadoCaja]
  );

  const cajasCerradasEdicionMaterial = useMemo(
    () => cajasOrdenadasEdicionMaterial.filter((caja) => estadoCaja(caja) === 'cerrada'),
    [cajasOrdenadasEdicionMaterial, estadoCaja]
  );

  const formatFecha = (val?: string) => {
    if (!val) return '-';
    const raw = String(val).trim();
    const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '-';
    const usarUTC = /(?:gmt|utc|z|[+\-]\d{2}:?\d{2})/i.test(raw);
    const dd = String(usarUTC ? d.getUTCDate() : d.getDate()).padStart(2, '0');
    const mm = String((usarUTC ? d.getUTCMonth() : d.getMonth()) + 1).padStart(2, '0');
    const yyyy = usarUTC ? d.getUTCFullYear() : d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };
  const toggleGrupo = (titulo: string) => {
    setGruposColapsados((prev) => ({ ...prev, [titulo]: !prev[titulo] }));
  };

  const gruposRender = useMemo(() => {
    const norm = (v: any) => {
      const base = typeof v === 'string'
        ? v.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        : '';
      if (base === 'ip pc' || base === 'ip pc nvr') return 'pc';
      if (base === 'puerta de enlace' || base === 'router (puerta de enlace)') return 'router';
      return base;
    };
    const usados = new Set<string>();
    const equiposPorNombre = new Map<string, Equipo[]>();
    equipos.forEach((e) => {
      const key = norm(e.nombre);
      if (!key) return;
      const lista = equiposPorNombre.get(key) || [];
      lista.push(e);
      equiposPorNombre.set(key, lista);
    });

    const groups = GRUPOS_EQUIPOS.map((g) => {
      const baseItems = Array.isArray(g.items) ? g.items : [];
      const items = baseItems
        .map((n, idx) => {
          if (typeof n !== 'string') return null;
          const key = norm(n);
          const bucket = key ? equiposPorNombre.get(key) || [] : [];
          const found = bucket.length ? bucket.shift() : null;
          if (found) {
            usados.add(found.id);
            // Muestra el nombre canonico del grupo (ej: IP PC -> PC)
            return { ...found, nombre: n };
          }
          // placeholder para que se vea en la lista aunque no exista aÃºn
          return {
            id: `${g.titulo}-${idx}`,
            nombre: n,
            caja: DEFAULT_PENDING_BOX,
            serie: '',
            codigo: '',
          } as Equipo;
        })
        .filter(Boolean) as Equipo[];
      return { ...g, items };
    });

    const otros = equipos.filter((e) => !usados.has(e.id));
    if (otros.length) groups.push({ titulo: 'Otros', items: otros });
    return groups;
  }, [equipos]);

  const resumenEquipos = useMemo(() => {
    const total = gruposRender.reduce((acc, g) => acc + g.items.length, 0);
    const conSerie = gruposRender.reduce(
      (acc, g) => acc + g.items.filter((it) => (it.serie || '').trim().length > 0).length,
      0
    );
    return { total, conSerie };
  }, [gruposRender]);

  const hashEquipo = useCallback((e: Pick<Equipo, 'serie' | 'codigo' | 'caja'>) => {
    const serie = String(e.serie || '').trim();
    const codigo = String(e.codigo || '').trim();
    const caja = String(e.caja || DEFAULT_PENDING_BOX).trim();
    return `${serie}|${codigo}|${caja}`;
  }, []);

  const hashMaterial = useCallback((m: Pick<Material, 'cantidad' | 'caja'>) => {
    const cantidad = Number(m.cantidad) || 0;
    const caja = String(m.caja || DEFAULT_PENDING_BOX).trim();
    return `${cantidad}|${caja}`;
  }, []);

  const equipoTieneContenido = useCallback((e: Pick<Equipo, 'serie' | 'codigo'>) => {
    return String(e.serie || '').trim().length > 0 || String(e.codigo || '').trim().length > 0;
  }, []);

  const materialTieneContenido = useCallback((m: Pick<Material, 'cantidad'>) => {
    return Number(m.cantidad || 0) > 0;
  }, []);

  const normalizarCajaEquipoInicial = useCallback(
    (caja?: string, serie?: string, codigo?: string) => {
      const cajaNormalizada = normalizarCajaTexto(caja);
      const tieneContenido = String(serie || '').trim().length > 0 || String(codigo || '').trim().length > 0;
      if (!tieneContenido && cajaNormalizada === DEFAULT_FIRST_BOX) return DEFAULT_PENDING_BOX;
      return cajaNormalizada || DEFAULT_PENDING_BOX;
    },
    [normalizarCajaTexto]
  );

  const normalizarCajaMaterialInicial = useCallback(
    (caja?: string, cantidad?: number) => {
      const cajaNormalizada = normalizarCajaTexto(caja);
      const tieneContenido = Number(cantidad || 0) > 0;
      if (!tieneContenido && cajaNormalizada === DEFAULT_FIRST_BOX) return DEFAULT_PENDING_BOX;
      return cajaNormalizada || DEFAULT_PENDING_BOX;
    },
    [normalizarCajaTexto]
  );

  const materialEstaGuardado = useCallback((m: Pick<Material, 'id'>) => /^\d+$/.test(String(m.id || '').trim()), []);
  const esIdPersistido = useCallback((value: any) => /^\d+$/.test(String(value || '').trim()), []);

  const cajasConContenido = useMemo(() => {
    const set = new Set<string>();
    equipos.forEach((e) => {
      if (!equipoTieneContenido(e)) return;
      set.add(String(e.caja || DEFAULT_PENDING_BOX).trim());
    });
    materiales.forEach((m) => {
      if (!materialTieneContenido(m)) return;
      set.add(String(m.caja || DEFAULT_PENDING_BOX).trim());
    });
    return set;
  }, [equipos, materiales, equipoTieneContenido, materialTieneContenido]);

  const cajasVacias = useMemo(
    () => (cajas || []).filter((c) => !esCajaPendiente(c) && !cajasConContenido.has(String(c || '').trim())),
    [cajas, cajasConContenido, esCajaPendiente]
  );

  const mostrarSerieDuplicada = useCallback((serie: string, conflicto: any) => {
    const centro = conflicto?.equipo?.centro_nombre || "otro centro";
    const equipo = conflicto?.equipo?.nombre || "equipo";
    Alert.alert(
      "Serie ya registrada",
      `La serie ${serie} ya esta registrada en ${centro} (${equipo}).\n\nNo se puede asignar en este armado. Solicita el cambio al responsable.`
    );
  }, []);

  const readCache = useCallback(async () => {
    try {
      const raw = await SecureStore.getItemAsync(cacheKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [cacheKey]);

  const writeCache = useCallback(
    async (partial: Record<string, any>) => {
      try {
        const current = (await readCache()) || {};
        await SecureStore.setItemAsync(
          cacheKey,
          JSON.stringify({ ...current, ...partial, updatedAt: new Date().toISOString() })
        );
      } catch {
        // silencioso
      }
    },
    [cacheKey, readCache]
  );

  const mergeMateriales = useCallback((listaBackend: any[] = []): Material[] => {
    const normalizar = (v: any) =>
      String(v || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    const mapa = new Map<string, any>();
    (listaBackend || []).forEach((m, idx) => {
      const key = normalizar(m.nombre || `mat-${idx}`);
      if (key) mapa.set(key, m);
    });

    const base: Material[] = MATERIALES_PREDEF.map((nombre, idx) => {
      const found = mapa.get(normalizar(nombre));
      const cantidad = Number(found?.cantidad) || 0;
      return {
        id: String(found?.id_material || found?.id || `base-${idx}`),
        nombre,
        cantidad,
        caja: normalizarCajaMaterialInicial(found?.caja, cantidad),
        usuario: found?.caja_tecnico_nombre || (found?.caja_tecnico_id ? `ID ${found.caja_tecnico_id}` : '') || found?.usuario || '',
      };
    });

    const extras: Material[] = (listaBackend || [])
      .filter((m) => !MATERIALES_PREDEF.some((n) => normalizar(n) === normalizar(m?.nombre)))
      .map((m: any, idx: number) => ({
        cantidad: Number(m.cantidad) || 0,
        id: String(m.id_material || m.id || `extra-${idx}`),
        nombre: m.nombre || `Material ${idx + 1}`,
        caja: normalizarCajaMaterialInicial(m.caja, Number(m.cantidad) || 0),
        usuario: m.caja_tecnico_nombre || (m.caja_tecnico_id ? `ID ${m.caja_tecnico_id}` : '') || m.usuario || '',
      }));

    return [...base, ...extras];
  }, [normalizarCajaMaterialInicial]);

  useEffect(() => {
    let active = true;
    (async () => {
      const cached = await readCache();
      if (!active) return;
      if (cached?.equipos && Array.isArray(cached.equipos) && cached.equipos.length > 0) {
        const equiposCache = cached.equipos.map((e: Equipo) => ({
          ...e,
          caja: normalizarCajaEquipoInicial(e.caja, e.serie, e.codigo),
        }));
        setEquipos(equiposCache);
        const snap: Record<string, string> = {};
        equiposCache.forEach((e: Equipo) => {
          snap[String(e.id)] = hashEquipo(e);
        });
        equiposSnapshotRef.current = snap;
      }
      if (cached?.materiales && Array.isArray(cached.materiales) && cached.materiales.length > 0) {
        const materialesCache = cached.materiales.map((m: Material) => ({
          ...m,
          caja: normalizarCajaMaterialInicial(m.caja, m.cantidad),
        }));
        setMateriales(materialesCache);
        const snap: Record<string, string> = {};
        materialesCache.forEach((m: Material) => {
          snap[String(m.id)] = hashMaterial(m);
        });
        materialesSnapshotRef.current = snap;
      }
      if (cached?.cajas && Array.isArray(cached.cajas) && cached.cajas.length > 0) {
        setCajas(unificarCajas(cached.cajas));
      }
      if (cached?.cajasEstado && typeof cached.cajasEstado === 'object') {
        setCajasEstado(cached.cajasEstado as Record<string, CajaEstado>);
      }
      if (typeof cached?.totalCajas === 'number') {
        setTotalCajas(cached.totalCajas);
      }
      setCacheReady(true);
    })();
    return () => {
      active = false;
    };
  }, [readCache, hashEquipo, hashMaterial, normalizarCajaEquipoInicial, normalizarCajaMaterialInicial, unificarCajas]);

  useEffect(() => {
    if (!cacheReady) return;
    const timer = setTimeout(() => {
      writeCache({ equipos, materiales, cajas, cajasEstado, totalCajas });
    }, 350);
    return () => clearTimeout(timer);
  }, [cacheReady, equipos, materiales, cajas, cajasEstado, totalCajas, writeCache]);

  useEffect(() => {
    if (!cajas?.length) return;
    setCajasEstado((prev) => sincronizarEstadosCajas(cajas, prev));
  }, [cajas, sincronizarEstadosCajas]);

  const cargarEquipos = useCallback(async (options?: { silent?: boolean }) => {
    if (!centroId) return;
    if (!options?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await getEquipos(centroId);
      if (Array.isArray(data)) {
        const mapped = data.map((eq: any) => ({
          id: String(eq.id_equipo || eq.id || `${eq.nombre}-${eq.ip || ''}`),
          nombre: eq.nombre || 'Equipo',
          serie: eq.numero_serie || eq.serie || '',
          codigo: eq.codigo || (eq.numero_serie ? String(eq.numero_serie).slice(0, 5) : ''),
          caja: normalizarCajaEquipoInicial(
            eq.caja,
            eq.numero_serie || eq.serie || '',
            eq.codigo || (eq.numero_serie ? String(eq.numero_serie).slice(0, 5) : '')
          ),
        }));
        setEquipos(mapped);
        const snap: Record<string, string> = {};
        mapped.forEach((e) => {
          snap[String(e.id)] = hashEquipo(e);
        });
        equiposSnapshotRef.current = snap;
        const cajasDetect = mapped.map((e) => e.caja || DEFAULT_PENDING_BOX);
        setCajas((prev) => unificarCajas([...prev, ...cajasDetect]));
        await writeCache({ equipos: mapped });
      }
    } catch (e) {
      const cached = await readCache();
      if (cached?.equipos && Array.isArray(cached.equipos) && cached.equipos.length > 0) {
        const equiposCache = cached.equipos.map((eq: Equipo) => ({
          ...eq,
          caja: normalizarCajaEquipoInicial(eq.caja, eq.serie, eq.codigo),
        }));
        setEquipos(equiposCache);
        const snap: Record<string, string> = {};
        equiposCache.forEach((eq: Equipo) => {
          snap[String(eq.id)] = hashEquipo(eq);
        });
        equiposSnapshotRef.current = snap;
        if (!options?.silent) {
          setError('Sin internet: mostrando equipos guardados localmente.');
        }
      } else {
        if (!options?.silent) {
          setError('No se pudieron cargar los equipos.');
        }
      }
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, [centroId, hashEquipo, normalizarCajaEquipoInicial, readCache, writeCache, unificarCajas]);

  useEffect(() => {
    cargarEquipos();
  }, [cargarEquipos]);

  useEffect(() => {
    if (!camVisible) return;
    if (!camPerm || camPerm.status !== 'granted') {
      requestCamPerm();
    }
  }, [camVisible, camPerm, requestCamPerm]);

  const cargarMat = useCallback(async (options?: { silent?: boolean }) => {
    if (!armadoId) return;
    if (!options?.silent) {
      setLoadingMateriales(true);
      setMateriales([]);
    }
    try {
      const data = await getMaterialesArmado(armadoId);
      const lista = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      const mapped = mergeMateriales(lista);
      setMateriales(mapped);
      const snap: Record<string, string> = {};
      mapped.forEach((m) => {
        snap[String(m.id)] = hashMaterial(m);
      });
      materialesSnapshotRef.current = snap;
      const cajasDetect = mapped.map((m: any) => m.caja || DEFAULT_PENDING_BOX);
      setCajas((prev) => unificarCajas([...prev, ...cajasDetect]));
      await writeCache({ materiales: mapped });
    } catch (_e) {
      const cached = await readCache();
      if (cached?.materiales && Array.isArray(cached.materiales) && cached.materiales.length > 0) {
        setMateriales(cached.materiales);
        const snap: Record<string, string> = {};
        cached.materiales.forEach((m: Material) => {
          snap[String(m.id)] = hashMaterial(m);
        });
        materialesSnapshotRef.current = snap;
      }
    } finally {
      if (!options?.silent) {
        setLoadingMateriales(false);
      }
    }
  }, [armadoId, hashMaterial, mergeMateriales, readCache, writeCache, unificarCajas]);

  useEffect(() => {
    cargarMat();
  }, [cargarMat]);

  useEffect(() => {
    setEstadoVista(estado || '');
    setFechaInicioVista(fechaInicioArmado || '');
    setFechaTerminoVista(fechaTerminoArmado || '');
  }, [estado, fechaInicioArmado, fechaTerminoArmado]);

  useEffect(() => {
    const cargarFechasArmado = async () => {
      if (!armadoId) return;
      try {
        const lista = await getArmados({ per_page: 0 });
        const row = (Array.isArray(lista) ? lista : []).find(
          (x: any) => Number(x?.id_armado || x?.id || 0) === Number(armadoId)
        );
        if (!row) return;
        setArmadoActual(row);
        setEstadoVista(String(row?.estado || estado || ''));
        setFechaInicioVista(String(row?.fecha_inicio || row?.fecha_asignacion || ''));
        setFechaTerminoVista(String(row?.fecha_cierre || ''));
      } catch {
        // fallback a params si falla la consulta
      }
    };
    cargarFechasArmado();
  }, [armadoId]);

  useEffect(() => {
    if (!armadoActual?.cajas_estado) return;
    setCajasEstado((prev) =>
      sincronizarEstadosCajas(cajas, {
        ...prev,
        ...(armadoActual.cajas_estado || {}),
      })
    );
  }, [armadoActual, cajas, sincronizarEstadosCajas]);

  useEffect(() => {
    const cajasEstadoBackend =
      armadoActual?.cajas_estado && typeof armadoActual.cajas_estado === 'object'
        ? Object.keys(armadoActual.cajas_estado)
        : [];
    const cajasEquipos = equipos.map((eq) => eq.caja || DEFAULT_PENDING_BOX);
    const cajasMateriales = materiales.map((mat) => mat.caja || DEFAULT_PENDING_BOX);
    const next = unificarCajas([...cajasEstadoBackend, ...cajasEquipos, ...cajasMateriales]);
    const normalizadas = next.length ? next : [DEFAULT_PENDING_BOX];
    setCajas((prev) => (mismasCajas(prev, normalizadas) ? prev : normalizadas));
  }, [armadoActual, equipos, materiales, mismasCajas, unificarCajas]);

  const pasarAPrefinalizado = useCallback(async () => {
    if (!armadoId || estadoNormalizado !== 'en_proceso') return;
    try {
      await updateArmado(armadoId, { estado: 'prefinalizado' });
      setEstadoVista('prefinalizado');
      Alert.alert('Estado actualizado', 'El armado fue enviado a pre-finalizado.');
    } catch {
      Alert.alert('Sin conexion', 'No se pudo actualizar el estado a pre-finalizado.');
    }
  }, [armadoId, estadoNormalizado]);

  const confirmarPasoPrefinalizado = useCallback(() => {
    if (estadoNormalizado !== 'en_proceso') return;
    setModalPrefinalizadoVisible(true);
  }, [estadoNormalizado]);

  // Realtime: refresca armado activo cuando backend emite cambios.
  useEffect(() => {
    if (!token || !armadoId) return;
    const onArmadoUpdated = (evt: any) => {
      if (Number(evt?.armado_id || 0) !== Number(armadoId)) return;
      if (suppressRealtimeRefreshRef.current) return;
      if (ignoreNextRealtimeRefreshRef.current && String(evt?.tipo || '') === 'armado') {
        ignoreNextRealtimeRefreshRef.current = false;
        return;
      }
      cargarEquipos({ silent: true });
      cargarMat({ silent: true });
    };
    return subscribeArmadoUpdated(onArmadoUpdated);
  }, [token, armadoId, cargarEquipos, cargarMat]);

  const actualizarEquipo = (id: string, cambios: Partial<Equipo>) => {
    if (esSoloLectura) return;
    const idStr = String(id);
    setEquipos((prev) => {
      const idx = prev.findIndex((eq) => String(eq.id) === idStr);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...cambios };
        return next;
      }
      // Si es un equipo placeholder (aún no viene de backend), lo creamos en estado local
      // para que no se borre al escribir manualmente o al escanear.
          return [
            ...prev,
            {
              id: idStr,
              nombre: cambios.nombre || 'Equipo',
              caja: cambios.caja || DEFAULT_PENDING_BOX,
              serie: cambios.serie || '',
              codigo: cambios.codigo || '',
            },
          ];
    });
  };

  const actualizarMaterial = (id: string, cambios: Partial<Material>) => {
    if (esSoloLectura) return;
    setMateriales((prev) => prev.map((m) => (m.id === id ? { ...m, ...cambios } : m)));
  };

  const abrirSelectorCaja = useCallback((target: BoxSelectorTarget) => {
    if (esSoloLectura) return;
    setSelectorCajaTarget(target);
    setModalSelectorCajaVisible(true);
  }, [esSoloLectura]);

  const seleccionarCaja = useCallback((caja: string) => {
    if (!selectorCajaTarget) return;
    if (estadoCaja(caja) === 'cerrada' && caja !== selectorCajaTarget.actual) return;
    if (selectorCajaTarget.tipo === 'equipo') {
      actualizarEquipo(selectorCajaTarget.id, { caja, nombre: selectorCajaTarget.nombre });
    } else {
      actualizarMaterial(selectorCajaTarget.id, { caja });
    }
    setModalSelectorCajaVisible(false);
    setSelectorCajaTarget(null);
  }, [actualizarEquipo, actualizarMaterial, estadoCaja, selectorCajaTarget]);

  const persistirConfiguracionCajas = useCallback(async (nextCajas: string[], nextEstados: Record<string, CajaEstado>) => {
    if (!armadoId) return;
    const cajasNormalizadas = unificarCajas(nextCajas);
    const estadosNormalizados = sincronizarEstadosCajas(cajasNormalizadas, nextEstados);
    const totalNuevo = contarCajasReales(cajasNormalizadas);
    setArmadoActual((prev: any) =>
      prev
        ? {
            ...prev,
            total_cajas_manual: totalNuevo,
            cajas_estado: estadosNormalizados,
          }
        : prev
    );
    writeCache({
      cajas: cajasNormalizadas,
      cajasEstado: estadosNormalizados,
      totalCajas: totalNuevo,
    }).catch(() => {});
    ignoreNextRealtimeRefreshRef.current = true;
    setTimeout(() => {
      ignoreNextRealtimeRefreshRef.current = false;
    }, 2000);
    updateArmado(armadoId, {
      total_cajas_manual: totalNuevo,
      cajas_estado: estadosNormalizados,
    }).catch(async () => {
      ignoreNextRealtimeRefreshRef.current = false;
      await enqueueOfflineOp('update_armado', {
        armadoId,
        data: {
          total_cajas_manual: totalNuevo,
          cajas_estado: estadosNormalizados,
        },
      });
    });
  }, [armadoId, contarCajasReales, sincronizarEstadosCajas, unificarCajas, writeCache]);

  const abrirGestionCajas = useCallback(() => {
    if (esSoloLectura) return;
    setModalGestionCajasVisible(true);
  }, [esSoloLectura]);

  const toggleEstadoCaja = useCallback((caja: string) => {
    const nombre = normalizarCajaTexto(caja);
    const siguienteEstado: CajaEstado = estadoCaja(nombre) === 'cerrada' ? 'abierta' : 'cerrada';
    const nextEstados = sincronizarEstadosCajas(cajas, {
      ...cajasEstado,
      [nombre]: siguienteEstado,
    });
    setCajasEstado(nextEstados);
    persistirConfiguracionCajas(cajas, nextEstados);
  }, [cajas, cajasEstado, estadoCaja, normalizarCajaTexto, persistirConfiguracionCajas, sincronizarEstadosCajas]);

  const abrirAccionMaterial = useCallback(
    (material: Material, modo: MaterialActionMode) => {
      if (esSoloLectura) return;
      if (!materialEstaGuardado(material)) return;
      if (modo === 'ajuste') {
        Alert.alert('Editar cantidad', `Deseas editar la cantidad de ${material.nombre}?`, [
          { text: 'No', style: 'cancel' },
          {
            text: 'Si',
            onPress: () => {
              setMaterialAccionTarget(material);
              setMaterialAccionModo('ajuste');
              setMaterialAccionCantidad(String(Number(material.cantidad || 0)));
              setMaterialAccionCaja(material.caja || DEFAULT_PENDING_BOX);
              setModalAccionMaterialVisible(true);
            },
          },
        ]);
        return;
      }
      setMaterialAccionTarget(material);
      setMaterialAccionModo('incremento');
      setMaterialAccionCantidad('');
      setMaterialAccionCaja(material.caja || DEFAULT_PENDING_BOX);
      setModalAccionMaterialVisible(true);
    },
    [esSoloLectura, materialEstaGuardado]
  );

  const confirmarAccionMaterial = useCallback(async () => {
    if (!armadoId || !materialAccionTarget) return;
    const valor = Number(materialAccionCantidad || 0);
    if (materialAccionModo === 'incremento' && valor <= 0) {
      Alert.alert('Cantidad invalida', 'Ingresa una cantidad mayor a 0 para agregar.');
      return;
    }
    if (materialAccionModo === 'ajuste' && valor < 0) {
      Alert.alert('Cantidad invalida', 'La cantidad no puede ser negativa.');
      return;
    }
    const payload = [
      {
        id_material: materialAccionTarget.id,
        nombre: materialAccionTarget.nombre,
        caja:
          materialAccionModo === 'ajuste'
            ? materialAccionCaja || materialAccionTarget.caja || DEFAULT_PENDING_BOX
            : materialAccionTarget.caja || DEFAULT_PENDING_BOX,
        caja_tecnico_id: userId || undefined,
        accion_material: materialAccionModo,
        ...(materialAccionModo === 'incremento'
          ? { cantidad_delta: valor }
          : { cantidad: valor }),
      },
    ];
    try {
      setGuardandoAccionMaterial(true);
      await saveMaterialesArmado(armadoId, payload);
      setModalAccionMaterialVisible(false);
      setMaterialAccionTarget(null);
      setMaterialAccionCantidad('');
      setMaterialAccionCaja(DEFAULT_PENDING_BOX);
      await cargarMat();
    } catch (_e) {
      await enqueueOfflineOp('save_materiales', { armadoId, materiales: payload });
      setModalAccionMaterialVisible(false);
      setMaterialAccionTarget(null);
      setMaterialAccionCantidad('');
      setMaterialAccionCaja(DEFAULT_PENDING_BOX);
      Alert.alert('Sin conexion', 'La accion quedo pendiente para sincronizar.');
    } finally {
      setGuardandoAccionMaterial(false);
    }
  }, [armadoId, cargarMat, materialAccionCaja, materialAccionCantidad, materialAccionModo, materialAccionTarget, userId]);

  const abrirCamaraSerie = (equipoId: string, nombre: string) => {
    if (esSoloLectura) return;
    setCamEquipoId(String(equipoId));
    setCamEquipoNombre(nombre);
    scannedOnce.current = false;
    setCamVisible(true);
  };

  const handleScan = async ({ data }: { data: string }) => {
    if (!camVisible || !camEquipoId || scannedOnce.current) return;
    scannedOnce.current = true;
    const raw = (data || '').trim();
    if (!raw) return;
    const soloNumeros = raw.replace(/\D+/g, '');
    const serie = soloNumeros.length ? soloNumeros : raw;
    const codigo = soloNumeros.length ? soloNumeros.slice(0, 5) : raw.slice(0, 5);
    if (serie && !seriesConfirmadasRef.current.has(serie)) {
      try {
        const esNumerico = /^\d+$/.test(String(camEquipoId || ''));
        const validacion = await validarSerieEquipo(serie, {
          ...(esNumerico ? { exclude_equipo_id: camEquipoId } : {}),
          ...(centroId ? { centro_id: centroId } : {}),
        });
        if (validacion?.duplicado) {
          mostrarSerieDuplicada(serie, validacion);
          scannedOnce.current = false;
          return;
        }
        seriesConfirmadasRef.current.add(serie);
      } catch (_err) {
        // Si no hay validacion disponible, permitimos continuar.
      }
    }
    actualizarEquipo(camEquipoId, { serie, codigo, nombre: camEquipoNombre || undefined });
    setCamVisible(false);
    setTimeout(() => {
      setCamEquipoId(null);
      setCamEquipoNombre(null);
      scannedOnce.current = false;
    }, 300);
  };

  const guardarMaterialesApp = async () => {
    if (esSoloLectura) return;
    if (!armadoId) return;
    let payload: any[] = [];
    try {
      setGuardandoMat(true);
      if (cajasVacias.length) {
        Alert.alert(
          'Cajas vacias',
          `Se detectaron cajas sin elementos: ${cajasVacias.join(', ')}. Solo se guardaran cajas con contenido.`
        );
      }
      payload = materiales
        .filter((m) => {
          if (!materialTieneContenido(m)) return false;
          if (materialEstaGuardado(m)) return false;
          const idStr = String(m.id);
          const actualHash = hashMaterial(m);
          const previoHash = materialesSnapshotRef.current[idStr];
          return previoHash !== actualHash;
        })
        .map((m) => ({
          id_material: m.id,
          nombre: m.nombre,
          cantidad: m.cantidad,
          caja: m.caja || DEFAULT_PENDING_BOX,
          caja_tecnico_id: userId || undefined,
        }));
      if (payload.length === 0) return;
      await saveMaterialesArmado(armadoId, payload);
      await cargarMat();
    } catch (_e) {
      await enqueueOfflineOp('save_materiales', { armadoId, materiales: payload });
    } finally {
      setGuardandoMat(false);
    }
  };

  const guardarEquiposApp = async () => {
    if (esSoloLectura) return;
    try {
      setGuardandoEq(true);
      suppressRealtimeRefreshRef.current = true;
      const seriesAprobadas = new Set<string>(Array.from(seriesConfirmadasRef.current));
      if (cajasVacias.length) {
        Alert.alert(
          'Cajas vacias',
          `Se detectaron cajas sin elementos: ${cajasVacias.join(', ')}. Solo se guardaran cajas con contenido.`
        );
      }
      for (const e of equipos) {
        const idStr = String(e.id);
        const actualHash = hashEquipo(e);
        const previoHash = equiposSnapshotRef.current[idStr];
        const esNumerico = /^\d+$/.test(String(e.id));
        const serie = String(e.serie || '').trim();
        if (serie && !seriesAprobadas.has(serie)) {
          try {
            const validacion = await validarSerieEquipo(serie, {
              ...(esNumerico ? { exclude_equipo_id: e.id } : {}),
              ...(centroId ? { centro_id: centroId } : {}),
            });
            if (validacion?.duplicado) {
              mostrarSerieDuplicada(serie, validacion);
              continue;
            }
          } catch (_err) {
            // Si no se puede validar (ej: sin red), no bloqueamos guardado.
          }
          seriesAprobadas.add(serie);
          seriesConfirmadasRef.current.add(serie);
        }
        if (esNumerico) {
          if (previoHash === actualHash) continue;
          const data = {
            numero_serie: e.serie,
            codigo: e.codigo,
            caja: e.caja,
            caja_tecnico_id: userId || undefined,
            armado_id: armadoId ? Number(armadoId) : undefined,
          };
          try {
            await updateEquipo(e.id, data);
          } catch (_err) {
            await enqueueOfflineOp('update_equipo', { id_equipo: e.id, data });
          }
          continue;
        }
        if (centroId) {
          const tieneDatos = equipoTieneContenido(e);
          if (!tieneDatos) continue;
          const data = {
            centro_id: centroId,
            nombre: e.nombre,
            numero_serie: e.serie,
            codigo: e.codigo,
            caja: e.caja,
            caja_tecnico_id: userId || undefined,
            armado_id: armadoId ? Number(armadoId) : undefined,
          };
          try {
            await createEquipo(data);
          } catch (_err) {
            await enqueueOfflineOp('create_equipo', { data });
          }
        }
      }
      await Promise.all([
        cargarEquipos({ silent: true }),
        cargarMat({ silent: true }),
      ]);
    } catch (_e) {
      // silencioso
    } finally {
      setTimeout(() => {
        suppressRealtimeRefreshRef.current = false;
      }, 1200);
      setGuardandoEq(false);
    }
  };

  const agregarCaja = () => {
    if (esSoloLectura) return;
    setModalGestionCajasVisible(false);
    setDescripcionCajaPrincipal(tieneCajaPrincipalReal ? obtenerDescripcionCaja(cajaPrincipalActual) : '');
    setDescripcionCajaNueva('');
    setModalCajasVisible(true);
  };

  const obtenerDescripcionCaja = useCallback((caja?: string) => {
    const texto = String(caja || '').trim();
    const match = texto.match(/^Caja\s*\d+\s*-\s*(.+)$/i);
    return String(match?.[1] || '').trim();
  }, []);

  const construirNombreCaja = useCallback((numero: number, descripcion?: string) => {
    const detalle = String(descripcion || '')
      .trim()
      .replace(/\s+/g, ' ');
    return detalle ? `Caja ${numero} - ${detalle}` : `Caja ${numero}`;
  }, []);

  const cajaPrincipalActual = useMemo(() => {
    const encontrada = cajas.find((c) => numeroCaja(c) === 1);
    return encontrada || DEFAULT_FIRST_BOX;
  }, [cajas]);

  const tieneCajaPrincipalReal = useMemo(
    () => cajas.some((c) => numeroCaja(c) === 1),
    [cajas, numeroCaja]
  );

  const siguienteNumeroCaja = useMemo(
    () =>
      cajas.reduce((max, c) => {
        const n = parseInt(String(c).replace(/[^\d]/g, ''), 10);
        return Number.isFinite(n) ? Math.max(max, n) : max;
      }, 0) + 1,
    [cajas]
  );

  const siguienteCajaBase = `Caja ${siguienteNumeroCaja}`;
  const cajaPrincipalPreview = construirNombreCaja(1, descripcionCajaPrincipal);
  const cajaNuevaPreview = construirNombreCaja(siguienteNumeroCaja, descripcionCajaNueva);

  const construirResumenQuitarCaja = useCallback((targetCaja?: string) => {
    const ordered = [...cajas].sort((a, b) => numeroCaja(a) - numeroCaja(b));
    const target = ordered.includes(String(targetCaja || '')) ? String(targetCaja) : ordered[ordered.length - 1] || '';
    const restantes = ordered.filter((c) => c !== target);
    const numeroTarget = numeroCaja(target);
    const destino =
      restantes
        .filter((c) => numeroCaja(c) < numeroTarget)
        .sort((a, b) => numeroCaja(b) - numeroCaja(a))[0] ||
      restantes[0] ||
      DEFAULT_PENDING_BOX;
    const equiposCount = equipos.filter((e) => (e.caja || DEFAULT_PENDING_BOX) === target && equipoTieneContenido(e)).length;
    const materialesCount = materiales.filter((m) => (m.caja || DEFAULT_PENDING_BOX) === target && materialTieneContenido(m)).length;
    return {
      target,
      destino,
      equipos: equiposCount,
      materiales: materialesCount,
    };
  }, [cajas, equipoTieneContenido, equipos, materialTieneContenido, materiales]);

  const abrirQuitarCaja = (targetCaja?: string) => {
    if (esSoloLectura) return;
    if (cajas.length <= 1) return;
    setModalGestionCajasVisible(false);
    setResumenQuitarCaja(construirResumenQuitarCaja(targetCaja));
    setModalQuitarCajaVisible(true);
  };

  const confirmarGuardarMateriales = () => {
    if (esSoloLectura) return;
    setModalGuardarMatVisible(true);
  };

  const confirmarAgregarCajas = () => {
    if (esSoloLectura) return;
    const cajaPrincipalRenombrada = construirNombreCaja(1, descripcionCajaPrincipal);
    const nuevaCajaDescripcion = String(descripcionCajaNueva || '').trim();
    const nuevaCaja = tieneCajaPrincipalReal
      ? (nuevaCajaDescripcion ? construirNombreCaja(siguienteNumeroCaja, descripcionCajaNueva) : '')
      : construirNombreCaja(1, descripcionCajaNueva);
    if (tieneCajaPrincipalReal && cajaPrincipalRenombrada !== cajaPrincipalActual && cajas.some((c) => c !== cajaPrincipalActual && c === cajaPrincipalRenombrada)) {
      Alert.alert('Caja existente', 'Ya existe una caja con ese nombre para la caja principal.');
      return;
    }
    if (nuevaCaja && (cajas.includes(nuevaCaja) || (tieneCajaPrincipalReal && nuevaCaja === cajaPrincipalRenombrada))) {
      Alert.alert('Caja existente', 'Ya existe una caja con ese nombre.');
      return;
    }
    const renombrandoCajaPrincipal = tieneCajaPrincipalReal && cajaPrincipalRenombrada !== cajaPrincipalActual;
    const equiposPersistidosRenombrados = renombrandoCajaPrincipal
      ? equipos
          .filter((e) => (e.caja || DEFAULT_PENDING_BOX) === cajaPrincipalActual && esIdPersistido(e.id) && equipoTieneContenido(e))
          .map((e) => ({
            id: e.id,
            data: {
              numero_serie: e.serie,
              codigo: e.codigo,
              caja: cajaPrincipalRenombrada,
              caja_tecnico_id: userId || undefined,
              armado_id: armadoId ? Number(armadoId) : undefined,
            },
            next: { ...e, caja: cajaPrincipalRenombrada },
          }))
      : [];
    const materialesPersistidosRenombrados = renombrandoCajaPrincipal
      ? materiales
          .filter((m) => (m.caja || DEFAULT_PENDING_BOX) === cajaPrincipalActual && esIdPersistido(m.id) && materialTieneContenido(m))
          .map((m) => ({
            id_material: m.id,
            nombre: m.nombre,
            cantidad: m.cantidad,
            caja: cajaPrincipalRenombrada,
            caja_tecnico_id: userId || undefined,
            next: { ...m, caja: cajaPrincipalRenombrada },
          }))
      : [];
    const cajasRenombradas = cajas.map((c) => (c === cajaPrincipalActual ? cajaPrincipalRenombrada : c));
    const nextCajas = unificarCajas(nuevaCaja ? [...cajasRenombradas, nuevaCaja] : cajasRenombradas);
    const totalNuevo = contarCajasReales(nextCajas);
    const nextEstadosBase: Record<string, CajaEstado> = {};
    nextCajas.forEach((caja) => {
      if (renombrandoCajaPrincipal && caja === cajaPrincipalRenombrada) {
        nextEstadosBase[caja] = estadoCaja(cajaPrincipalActual);
        return;
      }
      if (caja === nuevaCaja) {
        nextEstadosBase[caja] = 'abierta';
        return;
      }
      nextEstadosBase[caja] = estadoCaja(caja);
    });
    const nextEstados = sincronizarEstadosCajas(nextCajas, nextEstadosBase);
    if (renombrandoCajaPrincipal) {
      setEquipos((prev) =>
        prev.map((e) => ((e.caja || DEFAULT_PENDING_BOX) === cajaPrincipalActual ? { ...e, caja: cajaPrincipalRenombrada } : e))
      );
      setMateriales((prev) =>
        prev.map((m) => ((m.caja || DEFAULT_PENDING_BOX) === cajaPrincipalActual ? { ...m, caja: cajaPrincipalRenombrada } : m))
      );
      if (equiposPersistidosRenombrados.length) {
        const nextSnap = { ...equiposSnapshotRef.current };
        equiposPersistidosRenombrados.forEach((item) => {
          nextSnap[String(item.id)] = hashEquipo(item.next);
        });
        equiposSnapshotRef.current = nextSnap;
      }
      if (materialesPersistidosRenombrados.length) {
        const nextSnap = { ...materialesSnapshotRef.current };
        materialesPersistidosRenombrados.forEach((item) => {
          nextSnap[String(item.id_material)] = hashMaterial(item.next);
        });
        materialesSnapshotRef.current = nextSnap;
      }
    }
    setCajas(nextCajas);
    setCajasEstado(nextEstados);
    setTotalCajas(totalNuevo);
    setDescripcionCajaPrincipal('');
    setDescripcionCajaNueva('');
    if (armadoId) {
      persistirConfiguracionCajas(nextCajas, nextEstados);
      if (renombrandoCajaPrincipal) {
        equiposPersistidosRenombrados.forEach((item) => {
          updateEquipo(item.id, item.data).catch(async () => {
            await enqueueOfflineOp('update_equipo', { id_equipo: item.id, data: item.data });
          });
        });
        if (materialesPersistidosRenombrados.length) {
          const materialesPayload = materialesPersistidosRenombrados.map(({ next, ...payload }) => payload);
          saveMaterialesArmado(armadoId, materialesPayload).catch(async () => {
            await enqueueOfflineOp('save_materiales', { armadoId, materiales: materialesPayload });
          });
        }
      }
    }
    setModalCajasVisible(false);
  };

  const confirmarQuitarCaja = () => {
    if (esSoloLectura) return;
    const { target, destino } = resumenQuitarCaja;
    if (!target || cajas.length <= 1) {
      setModalQuitarCajaVisible(false);
      return;
    }
    const equiposPersistidosMovidos = equipos
      .filter((e) => (e.caja || DEFAULT_PENDING_BOX) === target && esIdPersistido(e.id) && equipoTieneContenido(e))
      .map((e) => ({
        id: e.id,
        data: {
          numero_serie: e.serie,
          codigo: e.codigo,
          caja: destino,
          caja_tecnico_id: userId || undefined,
          armado_id: armadoId ? Number(armadoId) : undefined,
        },
        next: { ...e, caja: destino },
      }));
    const materialesPersistidosMovidos = materiales
      .filter((m) => (m.caja || DEFAULT_PENDING_BOX) === target && esIdPersistido(m.id) && materialTieneContenido(m))
      .map((m) => ({
        id_material: m.id,
        nombre: m.nombre,
        cantidad: m.cantidad,
        caja: destino,
        caja_tecnico_id: userId || undefined,
        next: { ...m, caja: destino },
      }));
    setEquipos((prev) => prev.map((e) => ((e.caja || DEFAULT_PENDING_BOX) === target ? { ...e, caja: destino } : e)));
    setMateriales((prev) =>
      prev.map((m) => ((m.caja || DEFAULT_PENDING_BOX) === target ? { ...m, caja: destino } : m))
    );
    if (equiposPersistidosMovidos.length) {
      const nextSnap = { ...equiposSnapshotRef.current };
      equiposPersistidosMovidos.forEach((item) => {
        nextSnap[String(item.id)] = hashEquipo(item.next);
      });
      equiposSnapshotRef.current = nextSnap;
    }
    if (materialesPersistidosMovidos.length) {
      const nextSnap = { ...materialesSnapshotRef.current };
      materialesPersistidosMovidos.forEach((item) => {
        nextSnap[String(item.id_material)] = hashMaterial(item.next);
      });
      materialesSnapshotRef.current = nextSnap;
    }
    const nextCajas = unificarCajas(cajas.filter((c) => c !== target));
    const nextEstados = sincronizarEstadosCajas(nextCajas, cajasEstado);
    setCajas(nextCajas);
    setCajasEstado(nextEstados);
    const totalNuevo = contarCajasReales(nextCajas);
    setTotalCajas(totalNuevo);
    if (armadoId) {
      persistirConfiguracionCajas(nextCajas, nextEstados);
      equiposPersistidosMovidos.forEach((item) => {
        updateEquipo(item.id, item.data).catch(async () => {
          await enqueueOfflineOp('update_equipo', { id_equipo: item.id, data: item.data });
        });
      });
      if (materialesPersistidosMovidos.length) {
        const materialesPayload = materialesPersistidosMovidos.map(({ next, ...payload }) => payload);
        saveMaterialesArmado(armadoId, materialesPayload).catch(async () => {
          await enqueueOfflineOp('save_materiales', { armadoId, materiales: materialesPayload });
        });
      }
    }
    setModalQuitarCajaVisible(false);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      syncOfflineQueue().catch(() => {});
    }, 12000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!cajas?.length) {
      setTotalCajas(0);
      return;
    }
    const totalReal = contarCajasReales(cajas);
    setTotalCajas((prev) => (prev === totalReal ? prev : totalReal));
  }, [cajas, contarCajasReales]);

  const getGrupoVisual = (titulo: string) => {
    const key = String(titulo || '').toLowerCase();
    if (key.includes('oficina')) {
      return { icon: 'business-outline' as const, bg: '#eff6ff', border: '#93c5fd', color: '#1d4ed8' };
    }
    if (key.includes('alarma')) {
      return { icon: 'alert-circle-outline' as const, bg: '#fff7ed', border: '#fdba74', color: '#c2410c' };
    }
    if (key.includes('respaldo')) {
      return { icon: 'battery-charging-outline' as const, bg: '#f0f9ff', border: '#7dd3fc', color: '#0369a1' };
    }
    if (key.includes('mastil')) {
      return { icon: 'radio-outline' as const, bg: '#ecfeff', border: '#67e8f9', color: '#0e7490' };
    }
    if (key.includes('otros')) {
      return { icon: 'apps-outline' as const, bg: '#f8fafc', border: '#cbd5e1', color: '#334155' };
    }
    return { icon: 'folder-open-outline' as const, bg: '#eff6ff', border: '#bfdbfe', color: '#0b3b8c' };
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: '#f4f8ff' }]}>
      <ScrollView
        contentContainerStyle={styles.container}
        style={styles.scroll}>
        {!token ? (
          <Text style={[styles.subtitle, { color: 'red', textAlign: 'center' }]}>
            Debes iniciar sesiÃƒÂ³n para ver tus armados.
          </Text>
        ) : role !== 'admin' && role !== 'tecnico' ? (
          <Text style={[styles.subtitle, { color: 'red', textAlign: 'center' }]}>
            Tu rol no tiene acceso a esta secciÃƒÂ³n.
          </Text>
        ) : null}
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <Ionicons name="layers-outline" size={22} color="#ffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Armado de equipos</Text>
              <Text style={styles.heroSubtitle}>Completa serie y cajas para este armado</Text>
            </View>
            <View style={styles.heroBadge}>
              <Ionicons name="checkmark-done-outline" size={14} color="#0b3b8c" />
            </View>
          </View>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitleLine}>Asignacion</Text>
          <View style={styles.sectionLine} />
        </View>
        <View style={[styles.metaCard, { borderColor: '#dbeafe', backgroundColor: '#f8fbff' }]}>
          <View style={styles.metaTopRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.metaCenterRow}>
                <Ionicons name="business-outline" size={14} color="#0b3b8c" />
                <Text style={styles.metaCenterValue}>{centro}</Text>
              </View>
              <View style={styles.metaClientRow}>
                <Ionicons name="people-outline" size={13} color="#0b3b8c" />
                <Text style={styles.metaClientValue}>{cliente}</Text>
              </View>
              {companerosArmado.length ? (
                <View style={styles.metaClientRow}>
                  <Ionicons name="person-add-outline" size={12} color="#64748b" />
                  <Text style={styles.metaCompanionValue}>{`Compañero: ${companerosArmado.join(', ')}`}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.cajasWrap}>
              <Text style={styles.cajasLabel}>Total cajas</Text>
              <View style={styles.cajasOrbit}>
                <View style={styles.cajasRingOuter} />
                <View style={styles.cajasRingInner} />
                <View style={styles.cajasCore}>
                  <Text style={styles.cajasCoreNumber}>{totalCajas ?? 0}</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.metaGrid}>
            <View style={styles.metaStack}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Inicio armado</Text>
                <View style={styles.metaChipSimple}>
                  <Ionicons name="play-outline" size={12} color="#0f172a" />
                  <Text style={styles.metaSimpleText}>{formatFecha(fechaInicioVista)}</Text>
                </View>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Termino</Text>
                <View style={[styles.metaChipSimple, styles.metaChipTermino]}>
                  <Ionicons name="flag-outline" size={12} color="#b91c1c" />
                  <Text style={[styles.metaSimpleText, styles.metaTerminoText]}>{formatFecha(fechaTerminoVista)}</Text>
                </View>
              </View>
            </View>
            <View style={[styles.metaItem, styles.metaItemEstado]}>
                            <Text style={styles.metaLabel}>Estado</Text>
              <Pressable
                onPress={confirmarPasoPrefinalizado}
                disabled={estadoNormalizado !== 'en_proceso'}
                style={[
                  styles.metaChipEstadoPremium,
                  estadoNormalizado === 'finalizado'
                    ? { backgroundColor: '#ecfdf5', borderColor: '#34d399' }
                    : estadoNormalizado === 'en_proceso'
                      ? { backgroundColor: '#eff6ff', borderColor: '#60a5fa' }
                      : estadoNormalizado === 'prefinalizado'
                        ? { backgroundColor: '#f5f3ff', borderColor: '#c4b5fd' }
                        : { backgroundColor: '#fff7ed', borderColor: '#fdba74' },
                ]}>
                <View
                  style={[
                    styles.metaEstadoIconWrap,
                    estadoNormalizado === 'finalizado'
                      ? { backgroundColor: '#16a34a' }
                      : estadoNormalizado === 'en_proceso'
                        ? { backgroundColor: '#0284c7' }
                        : estadoNormalizado === 'prefinalizado'
                          ? { backgroundColor: '#7c3aed' }
                          : { backgroundColor: '#f59e0b' },
                  ]}>
                  <Ionicons
                    name={estadoNormalizado === 'finalizado' ? 'checkmark' : estadoNormalizado === 'en_proceso' ? 'time-outline' : estadoNormalizado === 'prefinalizado' ? 'shield-checkmark-outline' : 'alert-outline'}
                    size={12}
                    color="#ffffff"
                  />
                </View>
                <Text
                  style={[
                    styles.metaEstadoText,
                    estadoNormalizado === 'finalizado'
                      ? { color: '#15803d' }
                      : estadoNormalizado === 'en_proceso'
                        ? { color: '#0369a1' }
                        : estadoNormalizado === 'prefinalizado'
                          ? { color: '#6d28d9' }
                          : { color: '#a16207' },
                  ]}>
                  {estadoVista || estado || 'Pendiente'}
                </Text>
              </Pressable>
            </View>
          </View>
          {!!String(armadoActual?.observacion || '').trim() && (
            <View style={styles.metaObsSection}>
              <Text style={styles.metaLabel}>Observacion</Text>
              <View style={styles.metaObsBox}>
                <Ionicons name="document-text-outline" size={12} color="#475569" />
                <Text style={styles.metaObsText}>{String(armadoActual?.observacion || '').trim()}</Text>
              </View>
            </View>
          )}
        </View>
        {esSoloLectura ? (
          <View style={styles.readOnlyBanner}>
            <Ionicons name="lock-closed-outline" size={14} color="#14532d" />
            <Text style={styles.readOnlyBannerText}>{esPrefinalizado ? 'Armado prefinalizado: en revisión, vista solo lectura.' : 'Armado finalizado: vista solo lectura.'}</Text>
          </View>
        ) : null}

        <View style={styles.tabs}>
          <Pressable
            style={({ pressed }) => [
              styles.tabBtn,
              tab === 'equipos' && styles.tabBtnActive,
              pressed && styles.btnPressed,
            ]}
            onPress={() => setTab('equipos')}>
            <Ionicons name="hardware-chip-outline" size={16} color={tab === 'equipos' ? '#ffffff' : '#475569'} />
            <Text style={[styles.tabText, tab === 'equipos' && styles.tabTextActive]}>Equipos</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.tabBtn,
              tab === 'materiales' && styles.tabBtnActive,
              pressed && styles.btnPressed,
            ]}
            onPress={() => setTab('materiales')}>
            <Ionicons name="construct-outline" size={16} color={tab === 'materiales' ? '#ffffff' : '#475569'} />
            <Text style={[styles.tabText, tab === 'materiales' && styles.tabTextActive]}>Materiales</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.addBoxBtn, esSoloLectura && styles.btnDisabled, pressed && styles.btnPressed]}
            onPress={abrirGestionCajas}
            disabled={esSoloLectura}>
            <Ionicons name="file-tray-full-outline" size={16} color="#0b3b8c" />
            <Text style={styles.addBoxText}>Cajas</Text>
          </Pressable>
        </View>

        {tab === 'equipos' ? (
          <>
            <View style={styles.summary}>
              <View style={styles.summaryIcon}>
                <Ionicons name="hardware-chip-outline" size={18} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryNumber}>{resumenEquipos.conSerie}</Text>
                <Text style={styles.summaryLabel}>
                  de {resumenEquipos.total} equipos con N serie
                </Text>
              </View>
              <View style={styles.summaryPercentWrap}>
                <Text style={styles.summaryPercentText}>
                  {resumenEquipos.total ? Math.round((resumenEquipos.conSerie * 100) / resumenEquipos.total) : 0}%
                </Text>
              </View>
            </View>

            {loading ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator color={palette.tint} />
              </View>
            ) : error ? (
              <Text style={{ color: 'red', textAlign: 'center' }}>{error}</Text>
            ) : (
              gruposRender.map((grupo) => {
                const items = grupo.items;
                const groupVisual = getGrupoVisual(grupo.titulo);
                const colapsado = !!gruposColapsados[grupo.titulo];
                return (
                  <View key={grupo.titulo} style={{ gap: 8 }}>
                    <Pressable
                      onPress={() => toggleGrupo(grupo.titulo)}
                      style={({ pressed }) => [
                        styles.groupHeader,
                        { backgroundColor: groupVisual.bg, borderColor: groupVisual.border },
                        pressed && styles.btnPressed,
                      ]}>
                      <View style={styles.groupHeaderMain}>
                        <View style={[styles.groupIconWrap, { backgroundColor: '#ffffff', borderColor: groupVisual.border }]}>
                          <Ionicons name={groupVisual.icon} size={16} color={groupVisual.color} />
                        </View>
                        <Text style={[styles.groupTitle, { color: groupVisual.color }]}>{grupo.titulo}</Text>
                      </View>
                      <View style={styles.groupHeaderRight}>
                        <Text style={[styles.groupCount, { color: groupVisual.color }]}>{items.length}</Text>
                        <Ionicons
                          name={colapsado ? 'chevron-down-outline' : 'chevron-up-outline'}
                          size={18}
                          color={groupVisual.color}
                        />
                      </View>
                    </Pressable>
                    {!colapsado && items.map((eq) => (
                    <View
                        key={eq.id}
                        style={[
                          styles.card,
                          eq.serie?.trim()
                            ? { borderColor: '#93c5fd', backgroundColor: '#dbeafe', borderLeftColor: '#1d4ed8' }
                            : { borderColor: palette.tabIconDefault, backgroundColor: '#ffffff' },
                        ]}>
                        <View style={styles.cardHeader}>
                          <View style={styles.cardHeaderMainCompact}>
                            <Ionicons name="cube-outline" size={16} color="#0b3b8c" />
                            <Text style={[styles.cardTitle, { color: '#0f172a' }]}>{eq.nombre}</Text>
                          </View>
                          <View style={styles.cardHeaderAsideCompact}>
	                          <Pressable
	                            style={[
	                              styles.cardBadge,
	                              styles.cardBadgeCompact,
	                              esCajaPendiente(eq.caja) ? styles.pendingBoxBadge : { borderColor: '#0b3b8c' },
	                            ]}
	                            onPress={() => abrirSelectorCaja({
	                              tipo: 'equipo',
	                              id: String(eq.id),
	                              actual: eq.caja || DEFAULT_PENDING_BOX,
	                              nombre: eq.nombre,
	                            })}
	                            disabled={esSoloLectura}>
	                            <Text style={esCajaPendiente(eq.caja) ? styles.pendingBoxBadgeTextCompact : styles.cardBadgeTextCompact}>
	                              {eq.caja || DEFAULT_PENDING_BOX}
	                            </Text>
	                          </Pressable>
                          </View>
                        </View>

                        <View style={styles.field}>
                          <Text style={[styles.label, { color: '#475569' }]}>N serie</Text>
                          <View style={styles.inputScanRow}>
                            <TextInput
                              placeholder="escanea o escribe N serie"
                              placeholderTextColor="#94a3b8"
                              style={[
                                styles.input,
                                { flex: 1, color: '#0f172a', borderColor: '#d7e3f4', backgroundColor: '#f8fbff', paddingRight: 12 },
                              ]}
                              value={eq.serie ? String(eq.serie) : ''}
                              onChangeText={(t) => actualizarEquipo(eq.id, { serie: t, codigo: t.slice(0, 5), nombre: eq.nombre })}
                              keyboardType="numeric"
                              editable={!esSoloLectura}
                            />
                            <Pressable
                              style={[styles.camBtn, esSoloLectura && styles.btnDisabled]}
                              onPress={() => abrirCamaraSerie(eq.id, eq.nombre)}
                              hitSlop={6}
                              disabled={esSoloLectura}>
                              <Ionicons name="barcode-outline" size={18} color="#ffffff" />
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                );
              })
            )}
          </>
        ) : (
          <>
            {loadingMateriales ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator color={palette.tint} />
              </View>
            ) : !armadoId ? (
              <Text style={{ textAlign: 'center', color: '#475569', paddingVertical: 12 }}>
                Selecciona un armado para ver materiales.
              </Text>
            ) : materiales.length === 0 ? (
              <Text style={{ textAlign: 'center', color: '#475569', paddingVertical: 12 }}>Sin materiales</Text>
            ) : (
              <>
                {materiales.map((m) => (
                  (() => {
	                    const materialGuardado = materialEstaGuardado(m);
	                    const tieneRegistro =
	                      (m.usuario && String(m.usuario).trim().length > 0) ||
	                      Number(m.cantidad || 0) > 0 ||
	                      String(m.caja || DEFAULT_PENDING_BOX).trim() !== DEFAULT_PENDING_BOX;
                    return (
	                  <View
	                    key={m.id}
	                    style={[
	                      styles.card,
                      tieneRegistro
                        ? { borderColor: '#93c5fd', backgroundColor: '#dbeafe', borderLeftColor: '#1d4ed8' }
                        : { borderColor: palette.tabIconDefault, backgroundColor: '#ffffff' },
	                    ]}>
	                    <View style={styles.cardHeader}>
	                      <View style={styles.materialHeaderMain}>
	                        <Ionicons name="hammer-outline" size={16} color="#0b3b8c" />
	                        <Text style={[styles.cardTitle, { color: '#0f172a' }]}>{m.nombre}</Text>
	                      </View>
	                      <View style={styles.materialHeaderAside}>
	                        <View style={styles.materialCajaWrap}>
		                          <Pressable
		                            style={[
		                              styles.cardBadge,
                              styles.materialCardBadge,
                              styles.cardBadgeCompact,
                              esCajaPendiente(m.caja) ? styles.pendingBoxBadge : { borderColor: '#0b3b8c' },
                            ]}
		                            onPress={() => abrirSelectorCaja({
		                              tipo: 'material',
		                              id: String(m.id),
		                              actual: m.caja || DEFAULT_PENDING_BOX,
		                              nombre: m.nombre,
		                            })}
		                            disabled={esSoloLectura || materialGuardado}>
	                            <Text style={esCajaPendiente(m.caja) ? styles.pendingBoxBadgeTextCompact : styles.materialCardBadgeText}>
	                              {m.caja || DEFAULT_PENDING_BOX}
	                            </Text>
	                          </Pressable>
	                        </View>
	                        {materialGuardado ? <Text style={styles.materialSavedText}>Guardado</Text> : null}
	                      </View>
	                    </View>
	                    <Text style={[styles.metaText, { color: '#0f172a' }]}>Cantidad:</Text>
	                    <TextInput
	                      placeholder={materialGuardado ? 'Edita con el icono' : '0'}
                      keyboardType="numeric"
                      value={m.cantidad !== undefined && m.cantidad !== null ? String(m.cantidad) : ''}
                      onChangeText={(t) =>
                        actualizarMaterial(m.id, {
                          cantidad: Number(t) || 0,
                          usuario: name || m.usuario,
                        })
                      }
                      style={[
                        styles.input,
                        { color: '#0f172a', borderColor: '#d7e3f4', backgroundColor: materialGuardado ? '#eef2ff' : '#f8fbff' },
	                      ]}
	                      editable={!esSoloLectura && !materialGuardado}
	                    />
	                    <View style={styles.materialFooterRow}>
	                      {m.usuario ? <Text style={[styles.metaText, styles.materialUserText]}>Por: {m.usuario}</Text> : <View />}
	                      {materialGuardado ? (
	                        <View style={styles.materialActionRow}>
	                          <Pressable
	                            style={styles.materialActionBtn}
	                            onPress={() => abrirAccionMaterial(m, 'ajuste')}
	                            disabled={esSoloLectura}>
	                            <Ionicons name="checkmark-done-circle" size={18} color="#f59e0b" />
	                          </Pressable>
	                          <Pressable
	                            style={styles.materialActionBtn}
	                            onPress={() => abrirAccionMaterial(m, 'incremento')}
	                            disabled={esSoloLectura}>
	                            <Ionicons name="add-circle" size={18} color="#0b3b8c" />
	                          </Pressable>
	                        </View>
	                      ) : null}
	                    </View>
	                  </View>
	                    );
	                  })()
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      {tab === 'equipos' && (
        <Pressable
          style={[styles.fabSave, esSoloLectura && styles.btnDisabled]}
          disabled={guardandoEq || esSoloLectura}
          onPress={guardarEquiposApp}>
          <Ionicons name="save-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.planillaText}>{guardandoEq ? 'Guardando...' : 'Guardar equipos'}</Text>
        </Pressable>
      )}
      {tab === 'materiales' && (
        <Pressable
          style={[styles.fabSave, esSoloLectura && styles.btnDisabled]}
          disabled={guardandoMat || esSoloLectura}
          onPress={confirmarGuardarMateriales}>
          <Ionicons name="save-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.planillaText}>{guardandoMat ? 'Guardando...' : 'Guardar materiales'}</Text>
        </Pressable>
      )}

      <Modal visible={camVisible} animationType="fade" transparent>
        <View style={styles.camOverlay}>
          <View style={styles.camBox}>
            {camPerm?.status !== 'granted' ? (
              <Text style={{ color: 'red', textAlign: 'center', padding: 12 }}>
                Sin permiso de camara. Concede acceso y vuelve a intentarlo.
              </Text>
            ) : (
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                onBarcodeScanned={camVisible ? handleScan : undefined}
              />
            )}
            <View pointerEvents="none" style={styles.scanFrame} />
            <View style={styles.camHeader}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>escanea o escribe N serie</Text>
              <Pressable onPress={() => { setCamVisible(false); setCamEquipoId(null); }}>
                <Ionicons name="close-circle" size={26} color="#fff" />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalGestionCajasVisible} animationType="fade" transparent>
        <View style={styles.camOverlay}>
          <View style={styles.boxManagerModal}>
            <View style={styles.boxSelectorHeader}>
              <View style={styles.boxSelectorTitleWrap}>
                <Ionicons name="file-tray-full-outline" size={18} color="#0b3b8c" />
                <Text style={styles.boxSelectorTitle}>Cajas</Text>
              </View>
              <Pressable onPress={() => setModalGestionCajasVisible(false)}>
                <Ionicons name="close-circle" size={24} color="#64748b" />
              </Pressable>
            </View>
            <Text style={styles.boxSelectorText}>
              Administra nombres, estado y eliminacion de cajas del armado.
            </Text>
            <Pressable style={styles.boxManagerAddBtn} onPress={agregarCaja}>
              <Ionicons name="add-circle-outline" size={18} color="#ffffff" />
              <Text style={styles.boxManagerAddText}>Agregar caja</Text>
            </Pressable>
            <ScrollView style={styles.boxManagerList} contentContainerStyle={styles.boxSelectorListContent}>
	              {cajas.map((caja) => {
	                const estado = estadoCaja(caja);
	                const esPendiente = esCajaPendiente(caja);
		                const equiposCount = equipos.filter((e) => (e.caja || DEFAULT_PENDING_BOX) === caja && equipoTieneContenido(e)).length;
		                const materialesCount = materiales.filter((m) => (m.caja || DEFAULT_PENDING_BOX) === caja && materialTieneContenido(m)).length;
	                return (
	                  <View key={`manager-caja-${caja}`} style={styles.boxManagerRow}>
	                    <View style={styles.boxManagerRowTop}>
	                      <View style={styles.boxManagerInfo}>
	                        <View style={styles.boxManagerTitleRow}>
	                          <View style={styles.boxSelectorOptionLeft}>
	                            <Ionicons name="cube-outline" size={16} color="#0b3b8c" />
	                            <Text style={styles.boxSelectorOptionText}>{caja}</Text>
	                          </View>
	                          {cajas.length > 1 && !esPendiente ? (
	                            <Pressable
	                              style={[styles.boxManagerIconBtn, styles.boxManagerIconDanger]}
	                              onPress={() => abrirQuitarCaja(caja)}>
	                              <Ionicons name="trash-outline" size={13} color="#b91c1c" />
	                            </Pressable>
	                          ) : null}
	                        </View>
	                        <Text style={styles.boxManagerMeta}>Equipos: {equiposCount} | Materiales: {materialesCount}</Text>
	                      </View>
	                    </View>
	                    <View style={styles.boxManagerDivider} />
	                    <View style={styles.boxManagerActionsBottom}>
	                      <View
	                        style={[
	                          styles.boxStatusBadge,
	                          esPendiente
	                            ? styles.pendingBoxStatusBadge
	                            : estado === 'cerrada'
	                              ? styles.boxStatusClosed
	                              : styles.boxStatusOpen,
	                        ]}>
	                        <Text
	                          style={[
	                            styles.boxStatusText,
	                            esPendiente
	                              ? styles.pendingBoxStatusText
	                              : estado === 'cerrada'
	                                ? styles.boxStatusTextClosed
	                                : styles.boxStatusTextOpen,
	                          ]}>
	                          {esPendiente ? 'Pendiente' : estado === 'cerrada' ? 'Cerrada' : 'Abierta'}
	                        </Text>
	                      </View>
	                      {!esPendiente ? (
	                        <Pressable
	                          style={[styles.boxManagerActionBtn, estado === 'cerrada' ? styles.boxManagerReopenBtn : styles.boxManagerCloseBtn]}
	                          onPress={() => toggleEstadoCaja(caja)}>
	                          <Ionicons
	                            name={estado === 'cerrada' ? 'lock-open-outline' : 'lock-closed-outline'}
	                            size={13}
	                            color={estado === 'cerrada' ? '#0369a1' : '#a16207'}
	                          />
	                          <Text
	                            style={[
	                              styles.boxManagerActionText,
	                              estado === 'cerrada' ? styles.boxManagerActionTextInfo : styles.boxManagerActionTextWarn,
	                            ]}>
	                            {estado === 'cerrada' ? 'Reabrir caja' : 'Cerrar caja'}
	                          </Text>
	                        </Pressable>
	                      ) : null}
	                    </View>
	                  </View>
	                );
	              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={modalCajasVisible} animationType="fade" transparent>
        <View style={styles.camOverlay}>
	          <View style={[styles.camBox, styles.boxNameModal]}>
	            <Text style={styles.boxNameModalTitle}>Agregar caja</Text>
	            <Text style={styles.boxNameModalText}>
	              {tieneCajaPrincipalReal
	                ? 'Puedes renombrar la Caja 1 actual y crear una nueva caja manteniendo el formato del sistema.'
	                : 'Los nuevos elementos quedaran en Pendiente de caja hasta que los asignes a una caja real.'}
	            </Text>
	            {tieneCajaPrincipalReal ? (
	              <View style={styles.boxNameSection}>
	                <Text style={styles.boxNameSectionLabel}>Caja principal</Text>
	                <View style={styles.boxNamePreview}>
	                  <Ionicons name="cube-outline" size={16} color="#0b3b8c" />
	                  <Text style={styles.boxNamePreviewText}>{cajaPrincipalPreview}</Text>
	                </View>
	                <TextInput
	                  value={descripcionCajaPrincipal}
	                  onChangeText={setDescripcionCajaPrincipal}
	                  style={[styles.input, styles.boxNameInput]}
	                  placeholder="Ejemplo: equipos"
	                  placeholderTextColor="#94a3b8"
	                  maxLength={40}
	                />
	              </View>
	            ) : null}
	            <View style={styles.boxNameSection}>
	              <Text style={styles.boxNameSectionLabel}>{tieneCajaPrincipalReal ? 'Nueva caja' : 'Primera caja real'}</Text>
	              <Text style={styles.boxNameModalText}>
	                Se creara <Text style={styles.boxNameModalStrong}>{siguienteCajaBase}</Text>. Si quieres, agrega una descripcion como
	                {' '}materiales. Si lo dejas vacio, se creara con el nombre base.
	              </Text>
	            </View>
            <View style={styles.boxNamePreview}>
              <Ionicons name="cube-outline" size={16} color="#0b3b8c" />
              <Text style={styles.boxNamePreviewText}>{cajaNuevaPreview}</Text>
            </View>
            <TextInput
              value={descripcionCajaNueva}
              onChangeText={setDescripcionCajaNueva}
              style={[styles.input, styles.boxNameInput]}
              placeholder="Ejemplo: equipos o materiales"
              placeholderTextColor="#94a3b8"
              maxLength={40}
            />
            <View style={styles.boxNameActions}>
              <Pressable style={[styles.camBtn, { backgroundColor: '#e2e8f0' }]} onPress={() => setModalCajasVisible(false)}>
                <Text style={{ color: '#0f172a', fontWeight: '700' }}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.camBtn} onPress={confirmarAgregarCajas}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Agregar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalSelectorCajaVisible} animationType="fade" transparent>
        <View style={styles.camOverlay}>
          <View style={styles.boxSelectorModal}>
            <View style={styles.boxSelectorHeader}>
              <View style={styles.boxSelectorTitleWrap}>
                <Ionicons name="file-tray-full-outline" size={18} color="#0b3b8c" />
                <Text style={styles.boxSelectorTitle}>Seleccionar caja</Text>
              </View>
              <Pressable
                onPress={() => {
                  setModalSelectorCajaVisible(false);
                  setSelectorCajaTarget(null);
                }}>
                <Ionicons name="close-circle" size={24} color="#64748b" />
              </Pressable>
            </View>
	            <Text style={styles.boxSelectorText}>
	              {selectorCajaTarget?.nombre || 'Elemento'} actualmente esta en{' '}
	              <Text style={styles.boxNameModalStrong}>{selectorCajaTarget?.actual || DEFAULT_PENDING_BOX}</Text>
	            </Text>
            <ScrollView style={styles.boxSelectorList} contentContainerStyle={styles.boxSelectorListContent}>
              {cajas.map((caja) => {
                const activa = caja === (selectorCajaTarget?.actual || '');
                const cerrada = estadoCaja(caja) === 'cerrada';
                const bloqueada = cerrada && !activa;
                return (
                  <Pressable
                    key={`selector-caja-${caja}`}
                    style={[
                      styles.boxSelectorOption,
                      activa && styles.boxSelectorOptionActive,
                      bloqueada && styles.boxSelectorOptionDisabled,
                    ]}
                    onPress={() => seleccionarCaja(caja)}
                    disabled={bloqueada}>
                    <View style={styles.boxSelectorOptionLeft}>
                      <Ionicons
                        name={activa ? 'checkmark-circle' : 'cube-outline'}
                        size={18}
                        color={bloqueada ? '#94a3b8' : activa ? '#2563eb' : '#0b3b8c'}
                      />
                      <Text
                        style={[
                          styles.boxSelectorOptionText,
                          activa && styles.boxSelectorOptionTextActive,
                          bloqueada && styles.boxSelectorOptionTextDisabled,
                        ]}>
                        {caja}
                      </Text>
                    </View>
                    <View style={styles.boxSelectorRight}>
                      {cerrada ? <Text style={styles.boxSelectorClosedText}>Cerrada</Text> : null}
                      {activa ? <Text style={styles.boxSelectorCurrentText}>Actual</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={modalGuardarMatVisible} animationType="fade" transparent>
        <View style={styles.camOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.confirmIconWrap}>
              <Ionicons name="help-circle-outline" size={20} color="#0b3b8c" />
            </View>
            <Text style={styles.confirmTitle}>Confirmar guardado</Text>
            <Text style={styles.confirmText}>No deseas agregar mas materiales?</Text>
            <View style={styles.confirmActions}>
              <Pressable style={styles.confirmCancelBtn} onPress={() => setModalGuardarMatVisible(false)}>
                <Text style={styles.confirmCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={styles.confirmSaveBtn}
                onPress={async () => {
                  setModalGuardarMatVisible(false);
                  await guardarMaterialesApp();
                }}>
                <Text style={styles.confirmSaveText}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalAccionMaterialVisible} animationType="fade" transparent>
        <View style={styles.camOverlay}>
          <View style={styles.confirmBox}>
            <View
              style={[
                styles.confirmIconWrap,
                { backgroundColor: materialAccionModo === 'incremento' ? '#dbeafe' : '#fef3c7' },
              ]}>
              <Ionicons
                name={materialAccionModo === 'incremento' ? 'add-circle-outline' : 'create-outline'}
                size={20}
                color={materialAccionModo === 'incremento' ? '#1d4ed8' : '#d97706'}
              />
            </View>
            <Text style={styles.confirmTitle}>
              {materialAccionModo === 'incremento' ? 'Agregar mas material' : 'Editar cantidad'}
            </Text>
            <Text style={styles.confirmText}>
              {materialAccionTarget?.nombre || 'Material'}
            </Text>
            <Text style={[styles.confirmText, { marginTop: -4, marginBottom: 12 }]}>
              Cantidad actual: {Number(materialAccionTarget?.cantidad || 0)}
            </Text>
            <TextInput
              style={styles.materialActionInput}
              placeholder={materialAccionModo === 'incremento' ? 'Cantidad a sumar' : 'Nueva cantidad total'}
              keyboardType="numeric"
              value={materialAccionCantidad}
              onChangeText={setMaterialAccionCantidad}
            />
            {materialAccionModo === 'ajuste' && materialAccionTarget ? (
              <View style={styles.materialActionBoxSection}>
                <Text style={styles.materialActionBoxLabel}>Caja destino</Text>
                {cajasAbiertasEdicionMaterial.length ? (
                  <View style={styles.materialActionBoxGroup}>
                    <View style={[styles.materialActionBoxGroupHeader, styles.materialActionBoxGroupHeaderOpen]}>
                      <Text style={[styles.materialActionBoxGroupTitle, styles.materialActionBoxGroupTitleOpen]}>
                        Cajas abiertas
                      </Text>
                    </View>
                    <View style={styles.materialActionBoxList}>
                      {cajasAbiertasEdicionMaterial.map((caja) => {
                        const seleccionada = caja === materialAccionCaja;
                        return (
                          <Pressable
                            key={`material-action-box-open-${caja}`}
                            style={[
                              styles.materialActionBoxChip,
                              seleccionada && styles.materialActionBoxChipActive,
                            ]}
                            onPress={() => setMaterialAccionCaja(caja)}>
                            <Text
                              style={[
                                styles.materialActionBoxChipText,
                                seleccionada && styles.materialActionBoxChipTextActive,
                              ]}>
                              {caja}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
                {cajasCerradasEdicionMaterial.length ? (
                  <View style={styles.materialActionBoxGroup}>
                    <View style={[styles.materialActionBoxGroupHeader, styles.materialActionBoxGroupHeaderClosed]}>
                      <Text style={[styles.materialActionBoxGroupTitle, styles.materialActionBoxGroupTitleClosed]}>
                        Cajas cerradas
                      </Text>
                    </View>
                    <View style={styles.materialActionBoxList}>
                      {cajasCerradasEdicionMaterial.map((caja) => {
                        const actual = caja === (materialAccionTarget.caja || DEFAULT_PENDING_BOX);
                        const seleccionada = caja === materialAccionCaja;
                        const bloqueada = !actual;
                        return (
                          <Pressable
                            key={`material-action-box-closed-${caja}`}
                            style={[
                              styles.materialActionBoxChip,
                              seleccionada && styles.materialActionBoxChipActive,
                              bloqueada && styles.materialActionBoxChipDisabled,
                            ]}
                            onPress={() => setMaterialAccionCaja(caja)}
                            disabled={bloqueada}>
                            <Text
                              style={[
                                styles.materialActionBoxChipText,
                                seleccionada && styles.materialActionBoxChipTextActive,
                                bloqueada && styles.materialActionBoxChipTextDisabled,
                              ]}>
                              {caja}
                            </Text>
                            <Text style={styles.materialActionBoxChipMeta}>
                              {actual ? 'Actual cerrada' : 'Cerrada'}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}
            {materialAccionModo === 'incremento' && materialAccionTarget ? (
              <Text style={[styles.confirmText, { marginTop: 10 }]}>
                Total final: {Number(materialAccionTarget.cantidad || 0) + (Number(materialAccionCantidad || 0) || 0)}
              </Text>
            ) : null}
            <View style={styles.confirmActions}>
              <Pressable
                style={styles.confirmCancelBtn}
                onPress={() => {
                  if (guardandoAccionMaterial) return;
                  setModalAccionMaterialVisible(false);
                  setMaterialAccionTarget(null);
                  setMaterialAccionCantidad('');
                  setMaterialAccionCaja(DEFAULT_PENDING_BOX);
                }}>
                <Text style={styles.confirmCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={styles.confirmSaveBtn}
                disabled={guardandoAccionMaterial}
                onPress={confirmarAccionMaterial}>
                <Text style={styles.confirmSaveText}>
                  {guardandoAccionMaterial ? 'Guardando...' : materialAccionModo === 'incremento' ? 'Agregar' : 'Guardar cambio'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalPrefinalizadoVisible} animationType="fade" transparent>
        <View style={styles.camOverlay}>
          <View style={styles.confirmBox}>
            <View style={[styles.confirmIconWrap, { backgroundColor: '#ede9fe' }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#6d28d9" />
            </View>
            <Text style={styles.confirmTitle}>Pasar a pre-finalizado</Text>
            <Text style={styles.confirmText}>
              Confirmas que deseas enviar este armado a pre-finalizado?
            </Text>
            <View style={styles.confirmActions}>
              <Pressable style={styles.confirmCancelBtn} onPress={() => setModalPrefinalizadoVisible(false)}>
                <Text style={styles.confirmCancelText}>No</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmSaveBtn, { backgroundColor: '#6d28d9', borderColor: '#6d28d9' }]}
                onPress={async () => {
                  setModalPrefinalizadoVisible(false);
                  await pasarAPrefinalizado();
                }}>
                <Text style={styles.confirmSaveText}>Si</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={modalQuitarCajaVisible} animationType="fade" transparent>
        <View style={styles.camOverlay}>
          <View style={styles.confirmBox}>
            <View style={[styles.confirmIconWrap, { backgroundColor: '#fee2e2' }]}>
              <Ionicons name="trash-outline" size={20} color="#b91c1c" />
            </View>
            <Text style={styles.confirmTitle}>Quitar {resumenQuitarCaja.target}</Text>
            <Text style={styles.confirmText}>
              Los elementos de esa caja se moveran a {resumenQuitarCaja.destino}.
            </Text>
            <Text style={[styles.boxNameSectionLabel, { marginBottom: 8 }]}>Selecciona la caja a quitar</Text>
            <ScrollView style={styles.removeBoxList} contentContainerStyle={styles.boxSelectorListContent}>
              {cajas.map((caja) => {
                const activa = caja === resumenQuitarCaja.target;
                return (
                  <Pressable
                    key={`remove-caja-${caja}`}
                    style={[styles.boxSelectorOption, activa && styles.boxSelectorOptionActive]}
                    onPress={() => setResumenQuitarCaja(construirResumenQuitarCaja(caja))}>
                    <View style={styles.boxSelectorOptionLeft}>
                      <Ionicons
                        name={activa ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={activa ? '#2563eb' : '#0b3b8c'}
                      />
                      <Text style={[styles.boxSelectorOptionText, activa && styles.boxSelectorOptionTextActive]}>{caja}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={[styles.confirmText, { marginBottom: 10 }]}>
              Equipos: {resumenQuitarCaja.equipos} | Materiales: {resumenQuitarCaja.materiales}
            </Text>
            <View style={styles.confirmActions}>
              <Pressable style={styles.confirmCancelBtn} onPress={() => setModalQuitarCajaVisible(false)}>
                <Text style={styles.confirmCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.confirmSaveBtn} onPress={confirmarQuitarCaja}>
                <Text style={styles.confirmSaveText}>Confirmar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    backgroundColor: '#f4f8ff',
  },
  container: {
    padding: 16,
    paddingTop: (RNStatusBar.currentHeight || 24) + 12,
    gap: 12,
    paddingBottom: 120,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: -4,
  },
  summary: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#eef2ff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryNumber: {
    fontSize: 30,
    lineHeight: 30,
    fontWeight: '900',
    color: '#0b3b8c',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '700',
  },
  summaryPercentWrap: {
    minWidth: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 4,
    borderColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  summaryPercentText: {
    fontWeight: '900',
    color: '#0f172a',
    fontSize: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  sectionTitleLine: {
    color: '#0f172a',
    fontWeight: '900',
    fontSize: 16,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#d1d5db',
  },
  metaCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    marginBottom: 6,
    shadowColor: '#1d4ed8',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  metaTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  metaCenterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaCenterValue: {
    color: '#0f172a',
    fontWeight: '900',
    fontSize: 18,
    lineHeight: 20,
    flex: 1,
  },
  metaClientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  metaClientValue: {
    color: '#0b3b8c',
    fontWeight: '700',
    fontSize: 13,
    flex: 1,
  },
  metaCompanionValue: {
    color: '#64748b',
    fontWeight: '700',
    fontSize: 12,
    flex: 1,
  },
  metaObsBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metaObsText: {
    color: '#334155',
    fontWeight: '600',
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  cajasWrap: {
    minWidth: 92,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  cajasLabel: {
    color: '#0f172a',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 3,
  },
  cajasOrbit: {
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cajasRingOuter: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
  },
  cajasRingInner: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
  },
  cajasCore: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563eb',
    borderWidth: 1,
    borderColor: '#1d4ed8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cajasCoreNumber: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '600',
  },
  materialActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  materialHeaderMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    paddingRight: 10,
  },
  cardHeaderMainCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    paddingRight: 8,
  },
  cardHeaderAsideCompact: {
    alignItems: 'flex-end',
    alignSelf: 'flex-start',
    maxWidth: '43%',
    marginTop: -7,
    marginLeft: 8,
  },
  materialHeaderAside: {
    alignItems: 'flex-end',
    gap: 3,
    maxWidth: '43%',
    marginTop: -8,
  },
  materialCajaWrap: {
    alignSelf: 'flex-end',
    marginTop: -3,
  },
  materialCardBadge: {
    maxWidth: '100%',
  },
  materialCardBadgeText: {
    color: '#0b3b8c',
    fontWeight: '700',
    fontSize: 10.5,
    lineHeight: 12,
  },
  materialActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  materialSavedText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b45309',
  },
  materialFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  materialUserText: {
    color: '#475569',
    flex: 1,
  },
  inputScanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  camBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#0b3b8c',
  },
  boxNameModal: {
    aspectRatio: undefined,
    padding: 18,
    backgroundColor: '#f8fafc',
  },
  boxNameModalTitle: {
    fontWeight: '800',
    fontSize: 17,
    marginBottom: 8,
    color: '#0f172a',
  },
  boxNameModalText: {
    marginBottom: 12,
    color: '#475569',
    lineHeight: 20,
  },
  boxNameModalStrong: {
    color: '#0b3b8c',
    fontWeight: '800',
  },
  boxNameSection: {
    marginBottom: 12,
  },
  boxNameSectionLabel: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  boxNamePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 12,
  },
  boxNamePreviewText: {
    flex: 1,
    color: '#0f172a',
    fontWeight: '700',
  },
  boxNameInput: {
    borderColor: '#d7e3f4',
    backgroundColor: '#fff',
    color: '#0f172a',
    marginBottom: 14,
  },
  boxNameActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  boxManagerModal: {
    width: '90%',
    maxHeight: '78%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#dbeafe',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
  },
  boxManagerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0f3f91',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1d4ed8',
    paddingVertical: 11,
    marginBottom: 14,
    shadowColor: '#0b3b8c',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  boxManagerAddText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12.5,
  },
  boxManagerList: {
    maxHeight: 380,
  },
  boxManagerRow: {
    borderWidth: 1,
    borderColor: '#cfe2ff',
    backgroundColor: '#fbfdff',
    borderRadius: 16,
    padding: 13,
    gap: 9,
  },
  boxManagerRowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  boxManagerInfo: {
    flex: 1,
    gap: 7,
  },
  boxManagerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  boxManagerMeta: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  boxManagerDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  boxManagerActionsBottom: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  boxManagerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  boxManagerCloseBtn: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
  },
  boxManagerReopenBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  boxManagerRemoveBtn: {
    backgroundColor: '#dc2626',
  },
  boxManagerActionText: {
    fontWeight: '800',
    fontSize: 12,
  },
  boxManagerActionTextWarn: {
    color: '#a16207',
  },
  boxManagerActionTextInfo: {
    color: '#0369a1',
  },
  boxManagerActionsCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  boxManagerCompactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  boxManagerCompactText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  boxManagerCompactDanger: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
  },
  boxManagerCompactDangerText: {
    color: '#b91c1c',
  },
  boxManagerIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  boxManagerIconDanger: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
  },
  boxStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  boxStatusOpen: {
    backgroundColor: '#ecfdf5',
    borderColor: '#86efac',
  },
  boxStatusClosed: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  pendingBoxStatusBadge: {
    backgroundColor: '#fef2f2',
    borderColor: '#fda4af',
  },
  boxStatusText: {
    fontWeight: '800',
    fontSize: 11.5,
  },
  boxStatusTextOpen: {
    color: '#15803d',
  },
  boxStatusTextClosed: {
    color: '#b91c1c',
  },
  pendingBoxStatusText: {
    color: '#dc2626',
  },
  boxSelectorModal: {
    width: '88%',
    maxHeight: '72%',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#dbeafe',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
  },
  boxSelectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  boxSelectorTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  boxSelectorTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  boxSelectorText: {
    color: '#475569',
    lineHeight: 20,
    marginBottom: 14,
  },
  boxSelectorList: {
    maxHeight: 320,
  },
  removeBoxList: {
    maxHeight: 180,
    marginBottom: 10,
  },
  boxSelectorListContent: {
    gap: 10,
  },
  boxSelectorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fbff',
  },
  boxSelectorOptionActive: {
    borderColor: '#60a5fa',
    backgroundColor: '#eff6ff',
  },
  boxSelectorOptionDisabled: {
    opacity: 0.58,
    backgroundColor: '#f8fafc',
  },
  boxSelectorOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  boxSelectorOptionText: {
    color: '#0f172a',
    fontWeight: '700',
    flex: 1,
  },
  boxSelectorOptionTextActive: {
    color: '#1d4ed8',
  },
  boxSelectorOptionTextDisabled: {
    color: '#94a3b8',
  },
  boxSelectorRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  boxSelectorClosedText: {
    color: '#b91c1c',
    fontWeight: '800',
    fontSize: 11.5,
  },
  boxSelectorCurrentText: {
    color: '#2563eb',
    fontWeight: '800',
    fontSize: 12,
  },
  confirmBox: {
    width: '88%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#dbeafe',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
  },
  confirmIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#e0ecff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  confirmTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  confirmText: {
    color: '#475569',
    fontSize: 14,
    marginBottom: 14,
  },
  materialActionInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  materialActionBoxSection: {
    marginTop: 12,
    marginBottom: 4,
  },
  materialActionBoxGroup: {
    marginTop: 8,
  },
  materialActionBoxGroupHeader: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
  },
  materialActionBoxGroupHeaderOpen: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  materialActionBoxGroupHeaderClosed: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  materialActionBoxGroupTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  materialActionBoxGroupTitleOpen: {
    color: '#1d4ed8',
  },
  materialActionBoxGroupTitleClosed: {
    color: '#c2410c',
  },
  materialActionBoxLabel: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  materialActionBoxList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  materialActionBoxChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    gap: 2,
  },
  materialActionBoxChipActive: {
    borderColor: '#2563eb',
    backgroundColor: '#dbeafe',
  },
  materialActionBoxChipDisabled: {
    opacity: 0.55,
    backgroundColor: '#f1f5f9',
  },
  materialActionBoxChipText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 12.5,
  },
  materialActionBoxChipTextActive: {
    color: '#1d4ed8',
  },
  materialActionBoxChipTextDisabled: {
    color: '#64748b',
  },
  materialActionBoxChipMeta: {
    color: '#b45309',
    fontSize: 10.5,
    fontWeight: '700',
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  confirmCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  confirmCancelText: {
    color: '#334155',
    fontWeight: '700',
  },
  confirmSaveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#0b3b8c',
  },
  confirmSaveText: {
    color: '#fff',
    fontWeight: '700',
  },
  camOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camBox: {
    width: '90%',
    aspectRatio: 3 / 4,
    backgroundColor: '#000',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#3b82f6',
    overflow: 'hidden',
    position: 'relative',
  },
  scanFrame: {
    position: 'absolute',
    left: '12%',
    right: '12%',
    top: '28%',
    height: '36%',
    borderWidth: 2,
    borderColor: '#60a5fa',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  camHeader: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  metaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  metaGrid: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 2,
  },
  metaStack: {
    flex: 1,
    gap: 8,
  },
  metaItem: {
    minWidth: '45%',
    gap: 2,
  },
  metaItemEstado: {
    marginLeft: 8,
    alignSelf: 'flex-end',
  },
  metaObsSection: {
    marginTop: 10,
    gap: 4,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#eef2ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  metaChipEstado: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    gap: 6,
  },
  metaEstadoIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaEstadoText: {
    fontSize: 12.5,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  metaChipEstadoPremium: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    gap: 7,
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  metaChipSimple: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#eff6ff',
    gap: 6,
  },
  metaSimpleText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  metaChipTermino: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  metaTerminoText: {
    color: '#b91c1c',
  },
  prefinalizarBtn: {
    marginTop: 6,
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6d28d9',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  prefinalizarBtnText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '800',
  },
  readOnlyBanner: {
    marginTop: 8,
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  readOnlyBannerText: {
    color: '#14532d',
    fontSize: 12.5,
    fontWeight: '700',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  groupHeaderMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  groupHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  groupIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTitle: {
    fontSize: 14.5,
    fontWeight: '900',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  groupCount: {
    fontSize: 12,
    fontWeight: '900',
    minWidth: 20,
    textAlign: 'right',
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
    marginTop: 12,
  },
  tabBtn: {
    flex: 1,
    minHeight: 42,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  tabBtnActive: {
    backgroundColor: '#0b3b8c',
    borderColor: '#0b3b8c',
    shadowColor: '#0b3b8c',
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  tabText: {
    fontWeight: '700',
    color: '#475569',
    fontSize: 11.5,
  },
  tabTextActive: {
    color: '#ffffff',
  },
  addBoxBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 42,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#f8fbff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  addBoxText: {
    fontWeight: '800',
    fontSize: 11.5,
    color: '#0b3b8c',
  },
  removeBoxBtn: {
    flexBasis: '48%',
    flexDirection: 'row',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#dc2626',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  removeBoxText: {
    fontWeight: '800',
    fontSize: 12.5,
    color: '#b91c1c',
  },
  btnPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#0b3b8c',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardBadge: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '600',
  },
  cardBadgeCompact: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  cardBadgeTextDefault: {
    color: '#0b3b8c',
    fontWeight: '700',
  },
  cardBadgeTextCompact: {
    color: '#0b3b8c',
    fontWeight: '700',
    fontSize: 10.5,
    lineHeight: 12,
  },
  pendingBoxBadge: {
    borderColor: '#fda4af',
    backgroundColor: '#fff1f2',
  },
  pendingBoxBadgeText: {
    color: '#dc2626',
    fontWeight: '800',
  },
  pendingBoxBadgeTextCompact: {
    color: '#dc2626',
    fontWeight: '800',
    fontSize: 10.5,
    lineHeight: 12,
  },
  field: {
    gap: 4,
    position: 'relative',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#f8fafc',
  },
  hero: {
    backgroundColor: '#1d4ed8',
    borderWidth: 1,
    borderColor: '#1e40af',
    borderRadius: 14,
    padding: 14,
    marginBottom: 4,
    shadowColor: '#0b3b8c',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#dbeafe',
    marginTop: 2,
  },
  planillaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#0b3b8c',
    shadowColor: '#0b3b8c',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  planillaText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12.5,
  },
  fabSave: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#0b3b8c',
    shadowColor: '#0b3b8c',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
});































