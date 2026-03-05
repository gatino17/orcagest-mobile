import React, { useMemo, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, Pressable, StatusBar as RNStatusBar, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { AuthContext } from '../_layout';
import { useLocalSearchParams } from 'expo-router';
import { getEquipos, getMaterialesArmado, saveMaterialesArmado, updateEquipo, createEquipo, updateArmado } from '@/lib/api';
import { CameraView, useCameraPermissions } from 'expo-camera';

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
    items: ['PC', 'Monitor', 'Mouse', 'Teclado', 'Router', 'Switch', 'Parlantes', 'Sensor Magnetico', 'Rack 9U - tuercas - tornillos', 'Bandeja Rack - tornillos', 'Zapatilla Rack (PDU)'],
  },
  {
    titulo: 'Tablero Alarma',
    items: ['Tablero 500x400x200', 'Baliza Interior', 'Bocina Interior', 'Baliza Exterior 1', 'Baliza Exterior 2', 'Bocina Exterior 1', 'Bocina Exterior 2', 'Foco led 1 150W', 'Foco led 2 150W', 'Fuente poder 12V', 'Axis P8221'],
  },
  {
    titulo: 'Tablero Respaldo',
    items: ['Tablero 1200x800x300', 'Inversor cargador Victron', 'Panel Victron', 'Bateria 1', 'Bateria 2', 'Bateria 3', 'Bateria 4', 'Bateria 5', 'Bateria 6', 'Sensor magnetico respaldo', 'Sensor magnetico cargador', 'Cargador 1', 'Cargador 2', 'Tablero Cargador 750x500x250', 'UPS online'],
  },
  {
    titulo: 'Mastil',
    items: ['Mastil', 'Brazo Ubiquiti', 'Riel U', 'Perno Pasado', 'Omega 1'],
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
  const equiposSnapshotRef = useRef<Record<string, string>>({});
  const materialesSnapshotRef = useRef<Record<string, string>>({});
  const [modalCajasVisible, setModalCajasVisible] = useState(false);
  const [modalGuardarMatVisible, setModalGuardarMatVisible] = useState(false);
  const [cantidadCajas, setCantidadCajas] = useState('1');
  const centro = (params.centro as string) || '-';
  const cliente = (params.cliente as string) || '-';
  const armadoId = (params.armadoId as string) || '';
  const estado = (params.estado as string) || '';
  const totalCajasParam = params.total_cajas ? Number(params.total_cajas) : undefined;
  const [totalCajas, setTotalCajas] = useState<number | undefined>(totalCajasParam);
  const centroId = params.centro_id ? Number(params.centro_id) : undefined;

  const gruposRender = useMemo(() => {
    const norm = (v: any) => (typeof v === 'string' ? v.toLowerCase() : '');
    const usados = new Set<string>();

    const groups = GRUPOS_EQUIPOS.map((g) => {
      const baseItems = Array.isArray(g.items) ? g.items : [];
      const items = baseItems
        .map((n, idx) => {
          if (typeof n !== 'string') return null;
          const found = equipos.find((e) => norm(e.nombre) === norm(n));
          if (found) {
            usados.add(found.id);
            return found;
          }
          // placeholder para que se vea en la lista aunque no exista aún
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
      }
    } catch (e) {
      setError('No se pudieron cargar los equipos.');
    } finally {
      setLoading(false);
    }
  }, [centroId, hashEquipo]);

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
    } catch (_e) {
      // silencioso
    } finally {
      setLoadingMateriales(false);
    }
  }, [armadoId, hashMaterial, mergeMateriales]);

  useEffect(() => {
    cargarMat();
  }, [cargarMat]);

  const actualizarEquipo = (id: string, cambios: Partial<Equipo>) => {
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
    setMateriales((prev) => prev.map((m) => (m.id === id ? { ...m, ...cambios } : m)));
  };

  const abrirCamaraSerie = (equipoId: string, nombre: string) => {
    setCamEquipoId(String(equipoId));
    setCamEquipoNombre(nombre);
    scannedOnce.current = false;
    setCamVisible(true);
  };

  const handleScan = ({ data }: { data: string }) => {
    if (!camVisible || !camEquipoId || scannedOnce.current) return;
    scannedOnce.current = true;
    const raw = (data || '').trim();
    if (!raw) return;
    const soloNumeros = raw.replace(/\D+/g, '');
    const serie = soloNumeros.length ? soloNumeros : raw;
    const codigo = soloNumeros.length ? soloNumeros.slice(0, 5) : raw.slice(0, 5);
    actualizarEquipo(camEquipoId, { serie, codigo, nombre: camEquipoNombre || undefined });
    setCamVisible(false);
    setTimeout(() => {
      setCamEquipoId(null);
      setCamEquipoNombre(null);
      scannedOnce.current = false;
    }, 300);
  };

  const guardarMaterialesApp = async () => {
    if (!armadoId) return;
    try {
      setGuardandoMat(true);
      const payload = materiales
        .filter((m) => {
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
      // silencioso, podríamos mostrar toast
    } finally {
      setGuardandoMat(false);
    }
  };

  const guardarEquiposApp = async () => {
    try {
      setGuardandoEq(true);
      const payloads = equipos.map((e) => {
        const idStr = String(e.id);
        const actualHash = hashEquipo(e);
        const previoHash = equiposSnapshotRef.current[idStr];
        const esNumerico = /^\d+$/.test(String(e.id));
        if (esNumerico) {
          // Solo registrar movimiento cuando realmente cambió algo.
          if (previoHash === actualHash) return Promise.resolve();
          return updateEquipo(e.id, {
            numero_serie: e.serie,
            codigo: e.codigo,
            caja: e.caja,
            caja_tecnico_id: userId || undefined,
            armado_id: armadoId ? Number(armadoId) : undefined,
          });
        }
        // Placeholder sin id en backend: lo creamos
        if (centroId) {
          const tieneDatos =
            String(e.serie || '').trim().length > 0 ||
            String(e.codigo || '').trim().length > 0 ||
            String(e.caja || 'Caja 1').trim() !== 'Caja 1';
          if (!tieneDatos) return Promise.resolve();
          return createEquipo({
            centro_id: centroId,
            nombre: e.nombre,
            numero_serie: e.serie,
            codigo: e.codigo,
            caja: e.caja,
            caja_tecnico_id: userId || undefined,
            armado_id: armadoId ? Number(armadoId) : undefined,
          });
        }
        return Promise.resolve();
      });
      await Promise.all(payloads);
      await cargarEquipos();
    } catch (_e) {
      // silencioso
    } finally {
      setGuardandoEq(false);
    }
  };

  const agregarCaja = () => {
    setCantidadCajas('1');
    setModalCajasVisible(true);
  };

  const confirmarGuardarMateriales = () => {
    setModalGuardarMatVisible(true);
  };

  const confirmarAgregarCajas = () => {
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
      updateArmado(armadoId, { total_cajas_manual: totalNuevo }).catch(() => {});
    }
    setModalCajasVisible(false);
  };

  useEffect(() => {
    if (!cajas?.length) return;
    setTotalCajas((prev) => Math.max(prev || 0, cajas.length));
  }, [cajas]);

  const siguienteCaja = (actual?: string) => {
    if (cajas.length === 0) return 'Caja 1';
    const idx = cajas.indexOf(actual || 'Caja 1');
    return cajas[(idx + 1) % cajas.length];
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: '#ffffff' }]}>
      <ScrollView contentContainerStyle={styles.container} style={{ backgroundColor: '#ffffff' }}>
        {!token ? (
          <Text style={[styles.subtitle, { color: 'red', textAlign: 'center' }]}>
            Debes iniciar sesiÃ³n para ver tus armados.
          </Text>
        ) : role !== 'admin' && role !== 'tecnico' ? (
          <Text style={[styles.subtitle, { color: 'red', textAlign: 'center' }]}>
            Tu rol no tiene acceso a esta secciÃ³n.
          </Text>
        ) : null}
        <View style={styles.hero}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={styles.heroIcon}>
              <Ionicons name="layers-outline" size={22} color="#0b3b8c" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Armado de equipos</Text>
              <Text style={styles.heroSubtitle}>Completa serie y cajas para este armado</Text>
            </View>
          </View>
        </View>

        <View style={[styles.metaCard, { borderColor: '#dbeafe', backgroundColor: '#f8fbff' }]}>
          <View style={styles.metaHeader}>
            <Ionicons name="map-outline" size={18} color="#0b3b8c" />
            <Text style={styles.metaTitle}>Asignación</Text>
          </View>
          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Centro</Text>
              <Text style={styles.metaValue}>{centro}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Cliente</Text>
              <Text style={styles.metaValue}>{cliente}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Estado</Text>
              <View style={styles.metaChip}>
                <Ionicons
                  name={estado === 'finalizado' ? 'checkmark-circle' : estado === 'en_proceso' ? 'time' : 'alert-circle'}
                  size={14}
                  color={estado === 'finalizado' ? '#16a34a' : estado === 'en_proceso' ? '#0284c7' : '#f59e0b'}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.metaValue, { color: '#0f172a' }]}>{estado || 'Pendiente'}</Text>
              </View>
            </View>
            {totalCajas !== undefined ? (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Total cajas</Text>
                <Text style={styles.metaValue}>{totalCajas}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.tabs}>
          <Pressable
            style={[styles.tabBtn, tab === 'equipos' && styles.tabBtnActive]}
            onPress={() => setTab('equipos')}>
            <Ionicons name="hardware-chip-outline" size={16} color={tab === 'equipos' ? '#ffffff' : '#475569'} />
            <Text style={[styles.tabText, tab === 'equipos' && styles.tabTextActive]}>Equipos</Text>
          </Pressable>
          <Pressable
            style={[styles.tabBtn, tab === 'materiales' && styles.tabBtnActive]}
            onPress={() => setTab('materiales')}>
            <Ionicons name="construct-outline" size={16} color={tab === 'materiales' ? '#ffffff' : '#475569'} />
            <Text style={[styles.tabText, tab === 'materiales' && styles.tabTextActive]}>Materiales</Text>
          </Pressable>
          <Pressable style={styles.addBoxBtn} onPress={agregarCaja}>
            <Ionicons name="add-circle-outline" size={16} color="#0b3b8c" />
            <Text style={styles.addBoxText}>Agregar caja</Text>
          </Pressable>
        </View>

        {tab === 'equipos' ? (
          <>
            <View style={[styles.summary, { borderColor: '#dbeafe', backgroundColor: '#eef2ff' }]}>
              <Text style={[styles.summaryNumber, { color: '#0b3b8c' }]}>{resumenEquipos.conSerie}</Text>
              <Text style={[styles.summaryLabel, { color: '#0f172a' }]}>
                de {resumenEquipos.total} equipos con N° Serie
              </Text>
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
                return (
                  <View key={grupo.titulo} style={{ gap: 8 }}>
                    <View style={styles.groupHeader}>
                      <Ionicons name="folder-open-outline" size={16} color="#0b3b8c" />
                      <Text style={styles.groupTitle}>{grupo.titulo}</Text>
                    </View>
                    {items.map((eq) => (
                      <View
                        key={eq.id}
                        style={[
                          styles.card,
                          eq.serie?.trim()
                            ? { borderColor: '#bbf7d0', backgroundColor: '#f0fdf4', borderLeftColor: '#16a34a' }
                            : { borderColor: palette.tabIconDefault, backgroundColor: '#ffffff' },
                        ]}>
                        <View style={styles.cardHeader}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="cube-outline" size={16} color="#0b3b8c" />
                            <Text style={[styles.cardTitle, { color: '#0f172a' }]}>{eq.nombre}</Text>
                          </View>
                        <Pressable
                          style={[styles.cardBadge, { borderColor: '#0b3b8c' }]}
                          onPress={() => actualizarEquipo(eq.id, { caja: siguienteCaja(eq.caja), nombre: eq.nombre })}>
                          <Text style={{ color: '#0b3b8c', fontWeight: '700' }}>{eq.caja}</Text>
                        </Pressable>
                        </View>

                        <View style={styles.field}>
                          <Text style={[styles.label, { color: '#475569' }]}>N° Serie</Text>
                          <View style={styles.inputScanRow}>
                            <TextInput
                              placeholder="Escribe el N° de serie"
                              placeholderTextColor="#94a3b8"
                              style={[
                                styles.input,
                                { flex: 1, color: '#0f172a', borderColor: '#d7e3f4', backgroundColor: '#f8fbff', paddingRight: 12 },
                              ]}
                              value={eq.serie ? String(eq.serie) : ''}
                              onChangeText={(t) => actualizarEquipo(eq.id, { serie: t, codigo: t.slice(0, 5), nombre: eq.nombre })}
                              keyboardType="numeric"
                            />
                            <Pressable style={styles.camBtn} onPress={() => abrirCamaraSerie(eq.id, eq.nombre)} hitSlop={6}>
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
                        ? { borderColor: '#bbf7d0', backgroundColor: '#f0fdf4', borderLeftColor: '#16a34a' }
                        : { borderColor: palette.tabIconDefault, backgroundColor: '#ffffff' },
                    ]}>
                    <View style={styles.cardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="hammer-outline" size={16} color="#0b3b8c" />
                        <Text style={[styles.cardTitle, { color: '#0f172a' }]}>{m.nombre}</Text>
                      </View>
                    <View style={{ alignItems: 'flex-end' }}>
                    <Pressable
                      style={[styles.cardBadge, { borderColor: '#0b3b8c' }]}
                      onPress={() => actualizarMaterial(m.id, { caja: siguienteCaja(m.caja) })}>
                      <Text style={{ color: '#0b3b8c', fontWeight: '700' }}>{m.caja || 'Caja 1'}</Text>
                    </Pressable>
                      </View>
                    </View>
                    <Text style={[styles.metaText, { color: '#0f172a' }]}>Cantidad:</Text>
                    <TextInput
                      placeholder="0"
                      keyboardType="numeric"
                      value={m.cantidad !== undefined && m.cantidad !== null ? String(m.cantidad) : ''}
                      onChangeText={(t) =>
                        actualizarMaterial(m.id, {
                          cantidad: Number(t) || 0,
                          usuario: name || m.usuario,
                        })
                      }
                      style={[styles.input, { color: '#0f172a', borderColor: '#d7e3f4', backgroundColor: '#f8fbff' }]}
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
          style={styles.fabSave}
          disabled={guardandoEq}
          onPress={guardarEquiposApp}>
          <Ionicons name="save-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.planillaText}>{guardandoEq ? 'Guardando...' : 'Guardar equipos'}</Text>
        </Pressable>
      )}
      {tab === 'materiales' && (
        <Pressable
          style={styles.fabSave}
          disabled={guardandoMat}
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
                Sin permiso de cámara. Concede acceso y vuelve a intentarlo.
              </Text>
            ) : (
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                onBarcodeScanned={camVisible ? handleScan : undefined}
              />
            )}
            <View style={styles.camHeader}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Escanea el N° de serie</Text>
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
              ¿Cuántas cajas agregar?
            </Text>
            <Text style={{ marginBottom: 12, color: '#475569' }}>
              Actualmente existe Caja 1. Ingresa cuántas cajas nuevas quieres crear.
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
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryNumber: {
    fontSize: 22,
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: 14,
  },
  metaCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 8,
    marginBottom: 6,
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
    overflow: 'hidden',
    position: 'relative',
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
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  metaItem: {
    minWidth: '45%',
    gap: 2,
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
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#0b3b8c',
    borderColor: '#0b3b8c',
  },
  tabText: {
    fontWeight: '700',
    color: '#475569',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  addBoxBtn: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0b3b8c',
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
  },
  addBoxText: {
    fontWeight: '700',
    color: '#0b3b8c',
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
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 14,
    padding: 14,
    marginBottom: 4,
    shadowColor: '#0b3b8c',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#0b3b8c10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#475569',
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

