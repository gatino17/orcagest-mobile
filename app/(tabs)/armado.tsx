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
    caja: 'Caja 1',
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
  const [cajas, setCajas] = useState<string[]>(['Caja 1']);
  const [camVisible, setCamVisible] = useState(false);
  const [camEquipoId, setCamEquipoId] = useState<string | null>(null);
  const [camEquipoNombre, setCamEquipoNombre] = useState<string | null>(null);
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const scannedOnce = useRef(false);
  const seriesConfirmadasRef = useRef<Set<string>>(new Set());
  const ignoreNextRealtimeRefreshRef = useRef(false);
  const equiposSnapshotRef = useRef<Record<string, string>>({});
  const materialesSnapshotRef = useRef<Record<string, string>>({});
  const [modalCajasVisible, setModalCajasVisible] = useState(false);
  const [modalGuardarMatVisible, setModalGuardarMatVisible] = useState(false);
  const [modalQuitarCajaVisible, setModalQuitarCajaVisible] = useState(false);
  const [modalPrefinalizadoVisible, setModalPrefinalizadoVisible] = useState(false);
  const [modalAccionMaterialVisible, setModalAccionMaterialVisible] = useState(false);
  const [materialAccionModo, setMaterialAccionModo] = useState<MaterialActionMode>('ajuste');
  const [materialAccionTarget, setMaterialAccionTarget] = useState<Material | null>(null);
  const [materialAccionCantidad, setMaterialAccionCantidad] = useState('');
  const [guardandoAccionMaterial, setGuardandoAccionMaterial] = useState(false);
  const [gruposColapsados, setGruposColapsados] = useState<Record<string, boolean>>({});
  const [cacheReady, setCacheReady] = useState(false);
  const [resumenQuitarCaja, setResumenQuitarCaja] = useState({
    target: '',
    destino: '',
    equipos: 0,
    materiales: 0,
  });
  const [cantidadCajas, setCantidadCajas] = useState('1');
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
            caja: 'Caja 1',
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
    const caja = String(e.caja || 'Caja 1').trim();
    return `${serie}|${codigo}|${caja}`;
  }, []);

  const hashMaterial = useCallback((m: Pick<Material, 'cantidad' | 'caja'>) => {
    const cantidad = Number(m.cantidad) || 0;
    const caja = String(m.caja || 'Caja 1').trim();
    return `${cantidad}|${caja}`;
  }, []);

  const equipoTieneContenido = useCallback((e: Pick<Equipo, 'serie' | 'codigo'>) => {
    return String(e.serie || '').trim().length > 0 || String(e.codigo || '').trim().length > 0;
  }, []);

  const materialTieneContenido = useCallback((m: Pick<Material, 'cantidad'>) => {
    return Number(m.cantidad || 0) > 0;
  }, []);

  const materialEstaGuardado = useCallback((m: Pick<Material, 'id'>) => /^\d+$/.test(String(m.id || '').trim()), []);

  const cajasConContenido = useMemo(() => {
    const set = new Set<string>();
    equipos.forEach((e) => {
      if (!equipoTieneContenido(e)) return;
      set.add(String(e.caja || 'Caja 1').trim());
    });
    materiales.forEach((m) => {
      if (!materialTieneContenido(m)) return;
      set.add(String(m.caja || 'Caja 1').trim());
    });
    return set;
  }, [equipos, materiales, equipoTieneContenido, materialTieneContenido]);

  const cajasVacias = useMemo(
    () => (cajas || []).filter((c) => !cajasConContenido.has(String(c || '').trim())),
    [cajas, cajasConContenido]
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
      return {
        id: String(found?.id_material || found?.id || `base-${idx}`),
        nombre,
        cantidad: Number(found?.cantidad) || 0,
        caja: found?.caja || 'Caja 1',
        usuario: found?.caja_tecnico_nombre || (found?.caja_tecnico_id ? `ID ${found.caja_tecnico_id}` : '') || found?.usuario || '',
      };
    });

    const extras: Material[] = (listaBackend || [])
      .filter((m) => !MATERIALES_PREDEF.some((n) => normalizar(n) === normalizar(m?.nombre)))
      .map((m: any, idx: number) => ({
        id: String(m.id_material || m.id || `extra-${idx}`),
        nombre: m.nombre || `Material ${idx + 1}`,
        cantidad: Number(m.cantidad) || 0,
        caja: m.caja || 'Caja 1',
        usuario: m.caja_tecnico_nombre || (m.caja_tecnico_id ? `ID ${m.caja_tecnico_id}` : '') || m.usuario || '',
      }));

    return [...base, ...extras];
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const cached = await readCache();
      if (!active) return;
      if (cached?.equipos && Array.isArray(cached.equipos) && cached.equipos.length > 0) {
        setEquipos(cached.equipos);
        const snap: Record<string, string> = {};
        cached.equipos.forEach((e: Equipo) => {
          snap[String(e.id)] = hashEquipo(e);
        });
        equiposSnapshotRef.current = snap;
      }
      if (cached?.materiales && Array.isArray(cached.materiales) && cached.materiales.length > 0) {
        setMateriales(cached.materiales);
        const snap: Record<string, string> = {};
        cached.materiales.forEach((m: Material) => {
          snap[String(m.id)] = hashMaterial(m);
        });
        materialesSnapshotRef.current = snap;
      }
      if (cached?.cajas && Array.isArray(cached.cajas) && cached.cajas.length > 0) {
        setCajas(cached.cajas);
      }
      if (typeof cached?.totalCajas === 'number') {
        setTotalCajas(cached.totalCajas);
      }
      setCacheReady(true);
    })();
    return () => {
      active = false;
    };
  }, [readCache, hashEquipo, hashMaterial]);

  useEffect(() => {
    if (!cacheReady) return;
    const timer = setTimeout(() => {
      writeCache({ equipos, materiales, cajas, totalCajas });
    }, 350);
    return () => clearTimeout(timer);
  }, [cacheReady, equipos, materiales, cajas, totalCajas, writeCache]);

  const cargarEquipos = useCallback(async () => {
    if (!centroId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getEquipos(centroId);
      if (Array.isArray(data)) {
        const mapped = data.map((eq: any) => ({
          id: String(eq.id_equipo || eq.id || `${eq.nombre}-${eq.ip || ''}`),
          nombre: eq.nombre || 'Equipo',
          caja: eq.caja || 'Caja 1',
          serie: eq.numero_serie || eq.serie || '',
          codigo: eq.codigo || (eq.numero_serie ? String(eq.numero_serie).slice(0, 5) : ''),
        }));
        setEquipos(mapped);
        const snap: Record<string, string> = {};
        mapped.forEach((e) => {
          snap[String(e.id)] = hashEquipo(e);
        });
        equiposSnapshotRef.current = snap;
        const cajasDetect = Array.from(new Set(mapped.map((e) => e.caja || 'Caja 1')));
        setCajas((prev) => Array.from(new Set([...prev, ...cajasDetect])));
        await writeCache({ equipos: mapped });
      }
    } catch (e) {
      const cached = await readCache();
      if (cached?.equipos && Array.isArray(cached.equipos) && cached.equipos.length > 0) {
        setEquipos(cached.equipos);
        const snap: Record<string, string> = {};
        cached.equipos.forEach((eq: Equipo) => {
          snap[String(eq.id)] = hashEquipo(eq);
        });
        equiposSnapshotRef.current = snap;
        setError('Sin internet: mostrando equipos guardados localmente.');
      } else {
        setError('No se pudieron cargar los equipos.');
      }
    } finally {
      setLoading(false);
    }
  }, [centroId, hashEquipo, readCache, writeCache]);

  useEffect(() => {
    cargarEquipos();
  }, [cargarEquipos]);

  useEffect(() => {
    if (!camVisible) return;
    if (!camPerm || camPerm.status !== 'granted') {
      requestCamPerm();
    }
  }, [camVisible, camPerm, requestCamPerm]);

  const cargarMat = useCallback(async () => {
    if (!armadoId) return;
    setLoadingMateriales(true);
    setMateriales([]);
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
      const cajasDetect = mapped.map((m: any) => m.caja || 'Caja 1');
      setCajas((prev) => Array.from(new Set([...prev, ...cajasDetect])));
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
      setLoadingMateriales(false);
    }
  }, [armadoId, hashMaterial, mergeMateriales, readCache, writeCache]);

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
      if (ignoreNextRealtimeRefreshRef.current && String(evt?.tipo || '') === 'armado') {
        ignoreNextRealtimeRefreshRef.current = false;
        return;
      }
      cargarEquipos();
      cargarMat();
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
          caja: cambios.caja || 'Caja 1',
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
              setModalAccionMaterialVisible(true);
            },
          },
        ]);
        return;
      }
      setMaterialAccionTarget(material);
      setMaterialAccionModo('incremento');
      setMaterialAccionCantidad('');
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
        caja: materialAccionTarget.caja || 'Caja 1',
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
      await cargarMat();
    } catch (_e) {
      await enqueueOfflineOp('save_materiales', { armadoId, materiales: payload });
      setModalAccionMaterialVisible(false);
      setMaterialAccionTarget(null);
      setMaterialAccionCantidad('');
      Alert.alert('Sin conexion', 'La accion quedo pendiente para sincronizar.');
    } finally {
      setGuardandoAccionMaterial(false);
    }
  }, [armadoId, cargarMat, materialAccionCantidad, materialAccionModo, materialAccionTarget, userId]);

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
          caja: m.caja || 'Caja 1',
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
          // No persistir equipos vacios (sin serie/codigo), aunque cambie solo la caja.
          if (!equipoTieneContenido(e)) continue;
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
      await cargarEquipos();
    } catch (_e) {
      // silencioso
    } finally {
      setGuardandoEq(false);
    }
  };

  const agregarCaja = () => {
    if (esSoloLectura) return;
    setCantidadCajas('1');
    setModalCajasVisible(true);
  };

  const numeroCaja = (caja?: string) => {
    const n = parseInt(String(caja || '').replace(/[^\d]/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
  };

  const abrirQuitarCaja = () => {
    if (esSoloLectura) return;
    if (cajas.length <= 1) return;
    const ordered = [...cajas].sort((a, b) => numeroCaja(a) - numeroCaja(b));
    const target = ordered[ordered.length - 1];
    const destino = ordered[ordered.length - 2] || 'Caja 1';
    const equiposCount = equipos.filter((e) => (e.caja || 'Caja 1') === target).length;
    const materialesCount = materiales.filter((m) => (m.caja || 'Caja 1') === target).length;
    setResumenQuitarCaja({
      target,
      destino,
      equipos: equiposCount,
      materiales: materialesCount,
    });
    setModalQuitarCajaVisible(true);
  };

  const confirmarGuardarMateriales = () => {
    if (esSoloLectura) return;
    setModalGuardarMatVisible(true);
  };

  const confirmarAgregarCajas = () => {
    if (esSoloLectura) return;
    const qty = Math.max(1, Number.parseInt(cantidadCajas || '1', 10));
    const maxNum = cajas.reduce((max, c) => {
      const n = parseInt(String(c).replace(/[^\d]/g, ''), 10);
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0);
    const nuevas = Array.from({ length: qty }, (_, i) => `Caja ${maxNum + i + 1}`);
    const totalNuevo = maxNum + qty;
    setCajas((prev) => Array.from(new Set([...prev, ...nuevas])));
    setTotalCajas(totalNuevo);
    if (armadoId) {
      ignoreNextRealtimeRefreshRef.current = true;
      setTimeout(() => {
        ignoreNextRealtimeRefreshRef.current = false;
      }, 2000);
      updateArmado(armadoId, { total_cajas_manual: totalNuevo }).catch(async () => {
        ignoreNextRealtimeRefreshRef.current = false;
        await enqueueOfflineOp('update_armado', { armadoId, data: { total_cajas_manual: totalNuevo } });
      });
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
    setEquipos((prev) => prev.map((e) => ((e.caja || 'Caja 1') === target ? { ...e, caja: destino } : e)));
    setMateriales((prev) =>
      prev.map((m) => ((m.caja || 'Caja 1') === target ? { ...m, caja: destino } : m))
    );
    const nextCajas = cajas.filter((c) => c !== target);
    setCajas(nextCajas);
    const totalNuevo = Math.max(1, nextCajas.length);
    setTotalCajas(totalNuevo);
    if (armadoId) {
      ignoreNextRealtimeRefreshRef.current = true;
      setTimeout(() => {
        ignoreNextRealtimeRefreshRef.current = false;
      }, 2000);
      updateArmado(armadoId, { total_cajas_manual: totalNuevo }).catch(async () => {
        ignoreNextRealtimeRefreshRef.current = false;
        await enqueueOfflineOp('update_armado', { armadoId, data: { total_cajas_manual: totalNuevo } });
      });
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
    if (!cajas?.length) return;
    setTotalCajas(Math.max(1, cajas.length));
  }, [cajas]);

  const siguienteCaja = (actual?: string) => {
    if (cajas.length === 0) return 'Caja 1';
    const idx = cajas.indexOf(actual || 'Caja 1');
    return cajas[(idx + 1) % cajas.length];
  };

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
    <SafeAreaView style={[styles.safe, { backgroundColor: '#ffffff' }]}>
      <ScrollView contentContainerStyle={styles.container} style={{ backgroundColor: '#ffffff' }}>
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
                  <Text style={styles.cajasCoreNumber}>{totalCajas ?? 1}</Text>
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
            onPress={agregarCaja}
            disabled={esSoloLectura}>
            <Ionicons name="add-circle-outline" size={16} color="#0b3b8c" />
            <Text style={styles.addBoxText}>Agregar caja</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.removeBoxBtn, esSoloLectura && styles.btnDisabled, pressed && styles.btnPressed]}
            onPress={abrirQuitarCaja}
            disabled={esSoloLectura}>
            <Ionicons name="remove-circle-outline" size={16} color="#b91c1c" />
            <Text style={styles.removeBoxText}>Quitar caja</Text>
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
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="cube-outline" size={16} color="#0b3b8c" />
                            <Text style={[styles.cardTitle, { color: '#0f172a' }]}>{eq.nombre}</Text>
                          </View>
                        <Pressable
                          style={[styles.cardBadge, { borderColor: '#0b3b8c' }]}
                          onPress={() => actualizarEquipo(eq.id, { caja: siguienteCaja(eq.caja), nombre: eq.nombre })}
                          disabled={esSoloLectura}>
                          <Text style={{ color: '#0b3b8c', fontWeight: '700' }}>{eq.caja}</Text>
                        </Pressable>
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
                      String(m.caja || 'Caja 1').trim() !== 'Caja 1';
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="hammer-outline" size={16} color="#0b3b8c" />
                        <Text style={[styles.cardTitle, { color: '#0f172a' }]}>{m.nombre}</Text>
                      </View>
                    <View style={{ alignItems: 'flex-end', gap: 8 }}>
                    <View style={styles.materialActionRow}>
                    {materialGuardado ? (
                      <Pressable
                        style={styles.materialActionBtn}
                        onPress={() => abrirAccionMaterial(m, 'ajuste')}
                        disabled={esSoloLectura}>
                        <Ionicons name="checkmark-done-circle" size={18} color="#f59e0b" />
                      </Pressable>
                    ) : null}
                    {materialGuardado ? (
                      <Pressable
                        style={styles.materialActionBtn}
                        onPress={() => abrirAccionMaterial(m, 'incremento')}
                        disabled={esSoloLectura}>
                        <Ionicons name="add-circle" size={18} color="#0b3b8c" />
                      </Pressable>
                    ) : null}
                    <Pressable
                      style={[styles.cardBadge, { borderColor: '#0b3b8c' }]}
                      onPress={() => actualizarMaterial(m.id, { caja: siguienteCaja(m.caja) })}
                      disabled={esSoloLectura || materialGuardado}>
                      <Text style={{ color: '#0b3b8c', fontWeight: '700' }}>{m.caja || 'Caja 1'}</Text>
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
                    {m.usuario ? <Text style={[styles.metaText, { color: '#475569' }]}>Por: {m.usuario}</Text> : null}
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

      <Modal visible={modalCajasVisible} animationType="fade" transparent>
        <View style={styles.camOverlay}>
          <View style={[styles.camBox, { aspectRatio: undefined, padding: 16, backgroundColor: '#f8fafc' }]}>
            <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: 8, color: '#0f172a' }}>
              ¿Cuantas cajas agregar?
            </Text>
            <Text style={{ marginBottom: 12, color: '#475569' }}>
              Actualmente existe Caja 1. Ingresa cuantas cajas nuevas quieres crear.
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TextInput
                value={cantidadCajas}
                onChangeText={setCantidadCajas}
                keyboardType="numeric"
                style={[
                  styles.input,
                  { flex: 1, borderColor: '#d7e3f4', backgroundColor: '#fff', color: '#0f172a' },
                ]}
                placeholder="1"
              />
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
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  tabBtn: {
    flexBasis: '48%',
    minHeight: 44,
    paddingHorizontal: 10,
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
    fontSize: 12.5,
  },
  tabTextActive: {
    color: '#ffffff',
  },
  addBoxBtn: {
    flexBasis: '48%',
    flexDirection: 'row',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  addBoxText: {
    fontWeight: '800',
    fontSize: 12.5,
    color: '#1d4ed8',
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































