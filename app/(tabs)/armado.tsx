import React, { useMemo, useState, useContext, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, SafeAreaView, ActivityIndicator, Pressable, StatusBar as RNStatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { AuthContext } from '../_layout';
import { useLocalSearchParams } from 'expo-router';
import { getEquipos, getMaterialesArmado, saveMaterialesArmado, updateEquipo } from '@/lib/api';

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
  const centro = (params.centro as string) || '-';
  const cliente = (params.cliente as string) || '-';
  const armadoId = (params.armadoId as string) || '';
  const estado = (params.estado as string) || '';
  const totalCajas = params.total_cajas ? Number(params.total_cajas) : undefined;
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

  const cargarEquipos = useCallback(async () => {
    if (!centroId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getEquipos(centroId);
      if (Array.isArray(data)) {
        const mapped = data.map((eq: any) => ({
          id: eq.id_equipo || eq.id || `${eq.nombre}-${eq.ip || ''}`,
          nombre: eq.nombre || 'Equipo',
          caja: eq.caja || 'Caja 1',
          serie: eq.numero_serie || eq.serie || '',
          codigo: eq.codigo || (eq.numero_serie ? String(eq.numero_serie).slice(0, 5) : ''),
        }));
        setEquipos(mapped);
        const cajasDetect = Array.from(new Set(mapped.map((e) => e.caja || 'Caja 1')));
        setCajas((prev) => Array.from(new Set([...prev, ...cajasDetect])));
      }
    } catch (e) {
      setError('No se pudieron cargar los equipos.');
    } finally {
      setLoading(false);
    }
  }, [centroId]);

  useEffect(() => {
    cargarEquipos();
  }, [cargarEquipos]);

  const cargarMat = useCallback(async () => {
    if (!armadoId) return;
    setLoadingMateriales(true);
    setMateriales([]);
    try {
      const data = await getMaterialesArmado(armadoId);
      const lista = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      setMateriales(
        lista.map((m: any, idx: number) => ({
          id: m.id_material || m.id || m.nombre || `mat-${idx}`,
          nombre: m.nombre,
          cantidad: Number(m.cantidad) || 0,
          caja: m.caja || 'Caja 1',
          usuario: m.caja_tecnico_nombre || m.usuario || '',
        }))
      );
      const cajasDetect = lista.map((m: any) => m.caja || 'Caja 1');
      setCajas((prev) => Array.from(new Set([...prev, ...cajasDetect])));
    } catch (_e) {
      // silencioso
    } finally {
      setLoadingMateriales(false);
    }
  }, [armadoId]);

  useEffect(() => {
    cargarMat();
  }, [cargarMat]);

  const actualizarEquipo = (id: string, cambios: Partial<Equipo>) => {
    setEquipos((prev) => prev.map((eq) => (eq.id === id ? { ...eq, ...cambios } : eq)));
  };

  const actualizarMaterial = (id: string, cambios: Partial<Material>) => {
    setMateriales((prev) => prev.map((m) => (m.id === id ? { ...m, ...cambios } : m)));
  };

  const guardarMaterialesApp = async () => {
    if (!armadoId) return;
    try {
      setGuardandoMat(true);
      const payload = materiales.map((m) => ({
        id_material: m.id,
        nombre: m.nombre,
        cantidad: m.cantidad,
        caja: m.caja || 'Caja 1',
        caja_tecnico_id: userId || undefined,
      }));
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
      const payloads = equipos
        .filter((e) => e.id)
        .map((e) =>
          updateEquipo(e.id, {
            numero_serie: e.serie,
            codigo: e.codigo,
            caja: e.caja,
          })
        );
      await Promise.all(payloads);
      await cargarEquipos();
    } catch (_e) {
      // silencioso
    } finally {
      setGuardandoEq(false);
    }
  };

  const agregarCaja = () => {
    const next = `Caja ${cajas.length + 1}`;
    setCajas((prev) => [...prev, next]);
  };

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
                          onPress={() => actualizarEquipo(eq.id, { caja: siguienteCaja(eq.caja) })}>
                          <Text style={{ color: '#0b3b8c', fontWeight: '700' }}>{eq.caja}</Text>
                        </Pressable>
                        </View>

                        <View style={styles.field}>
                          <Text style={[styles.label, { color: '#475569' }]}>N° Serie</Text>
                          <TextInput
                            placeholder="Escribe el N° de serie"
                            placeholderTextColor="#94a3b8"
                            style={[styles.input, { color: '#0f172a', borderColor: '#d7e3f4', backgroundColor: '#f8fbff' }]}
                            value={eq.serie ? String(eq.serie) : ''}
                            onChangeText={(t) => actualizarEquipo(eq.id, { serie: t, codigo: t.slice(0, 5) })}
                            keyboardType="numeric"
                          />
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
                  <View
                    key={m.id}
                    style={[
                      styles.card,
                      m.cantidad > 0
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
          onPress={guardarMaterialesApp}>
          <Ionicons name="save-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.planillaText}>{guardandoMat ? 'Guardando...' : 'Guardar materiales'}</Text>
        </Pressable>
      )}
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
