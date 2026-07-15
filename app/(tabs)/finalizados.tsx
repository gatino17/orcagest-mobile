import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AuthContext } from '../_layout';
import { getArmados } from '@/lib/api';
import { subscribeArmadoUpdated } from '@/lib/realtime';

export default function FinalizadosScreen() {
  const router = useRouter();
  const { userId, token } = useContext(AuthContext);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const cacheKey = useMemo(() => `finalizados_cache_v1_${userId || 'anon'}`, [userId]);

  const readCache = useCallback(async () => {
    try {
      const raw = await SecureStore.getItemAsync(cacheKey);
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed?.items) ? parsed.items : [];
    } catch {
      return [];
    }
  }, [cacheKey]);

  const writeCache = useCallback(
    async (data: any[]) => {
      try {
        await SecureStore.setItemAsync(cacheKey, JSON.stringify({ items: data, updatedAt: Date.now() }));
      } catch {
        // ignore cache write errors
      }
    },
    [cacheKey]
  );

  const cargarFinalizados = useCallback(async (silent = false) => {
    if (!userId) return;
    if (!silent) setLoading(true);
    await getArmados({ tecnico_id: userId, estado: 'finalizado', per_page: 0 })
      .then((data) => {
        const lista = Array.isArray(data) ? data : [];
        setItems(lista);
        writeCache(lista).catch(() => {});
      })
      .catch(async () => {
        const cached = await readCache();
        setItems(cached);
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, [userId, readCache, writeCache]);

  useEffect(() => {
    readCache().then((cached) => {
      if (Array.isArray(cached) && cached.length) {
        setItems(cached);
      }
    });
  }, [readCache]);

  useEffect(() => {
    cargarFinalizados(false);
  }, [cargarFinalizados]);

  useEffect(() => {
    if (!token || !userId) return;
    const onArmadoUpdated = () => cargarFinalizados(true);
    return subscribeArmadoUpdated(onArmadoUpdated);
  }, [token, userId, cargarFinalizados]);

  const formatFecha = (val?: string) => {
    if (!val) return '-';
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return '-';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const itemsFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...items].sort((a, b) => {
      const fa = new Date(a?.fecha_cierre || a?.fecha_asignacion || a?.created_at || 0).getTime();
      const fb = new Date(b?.fecha_cierre || b?.fecha_asignacion || b?.created_at || 0).getTime();
      return fb - fa;
    });
    if (!q) return sorted;
    return sorted.filter((a) => {
      const centro = String(a?.centro?.nombre || a?.centro_nombre || '').toLowerCase();
      const cliente = String(a?.centro?.cliente || a?.cliente || '').toLowerCase();
      return centro.includes(q) || cliente.includes(q);
    });
  }, [items, search]);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <StatusBar style="dark" translucent={false} />
      <FlatList
        data={itemsFiltrados}
        keyExtractor={(it) => String(it.id_armado || it.id)}
        contentContainerStyle={styles.container}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={7}
        ListHeaderComponent={
          <>
            <ThemedView style={styles.header}>
              <View pointerEvents="none" style={styles.headerGlowPrimary} />
              <View pointerEvents="none" style={styles.headerGlowSecondary} />
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <View style={styles.titleIcon}>
                    <Ionicons name="checkmark-done-outline" size={18} color="#d8ffe7" />
                  </View>
                  <ThemedText style={styles.title}>Armados finalizados</ThemedText>
                </View>
                <ThemedText style={styles.subtitle}>Historial cerrado y planillas disponibles</ThemedText>
                <View style={styles.headerMetaRow}>
                  <View style={styles.headerMetaPill}>
                    <Ionicons name="archive-outline" size={12} color="#9fd7ff" />
                    <ThemedText style={styles.headerMetaText}>{items.length} total</ThemedText>
                  </View>
                  <View style={styles.headerMetaPill}>
                    <Ionicons name="eye-outline" size={12} color="#9fd7ff" />
                    <ThemedText style={styles.headerMetaText}>{itemsFiltrados.length} visibles</ThemedText>
                  </View>
                </View>
              </View>
              <View style={styles.kpi}>
                <ThemedText style={styles.kpiNumber}>{itemsFiltrados.length}</ThemedText>
                <ThemedText style={styles.kpiLabel}>cerrados</ThemedText>
              </View>
            </ThemedView>

            <ThemedView style={styles.searchWrap}>
              <Ionicons name="search-outline" size={16} color="#164e9c" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar por centro o cliente"
                placeholderTextColor="#94a3b8"
                style={styles.searchInput}
              />
              {search ? (
                <Pressable onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={16} color="#94a3b8" />
                </Pressable>
              ) : null}
            </ThemedView>

          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <ActivityIndicator color="#0b3b8c" />
            </View>
          ) : (
            <ThemedText style={styles.empty}>No hay armados finalizados.</ThemedText>
          )
        }
        renderItem={({ item: a }) => (
          <View style={styles.card}>
            <View pointerEvents="none" style={styles.cardGlow} />
            <View style={styles.cardHead}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.centro}>{a.centro?.nombre || a.centro_nombre || '-'}</ThemedText>
                <View style={styles.row}>
                  <Ionicons name="business-outline" size={12} color="#0b3b8c" />
                  <ThemedText style={styles.meta}>{a.centro?.cliente || a.cliente || '-'}</ThemedText>
                </View>
              </View>
              <View style={styles.badge}>
                <Ionicons name="checkmark-circle" size={13} color="#15803d" />
                <ThemedText style={styles.badgeText}>Finalizado</ThemedText>
              </View>
            </View>

            <View style={styles.rowWrap}>
              <View style={styles.metaChip}>
                <Ionicons name="calendar-outline" size={12} color="#164e9c" />
                <ThemedText style={styles.meta}>Asignado: {formatFecha(a.fecha_asignacion || a.created_at)}</ThemedText>
              </View>
              <View style={styles.metaChip}>
                <Ionicons name="flag-outline" size={12} color="#15803d" />
                <ThemedText style={styles.meta}>Cierre: {formatFecha(a.fecha_cierre)}</ThemedText>
              </View>
              <View style={styles.metaChip}>
                <Ionicons name="cube-outline" size={12} color="#164e9c" />
                <ThemedText style={styles.meta}>Bultos: {a.total_cajas ?? 0}</ThemedText>
              </View>
            </View>

            <View style={styles.actions}>
              <Pressable
                style={styles.btn}
                onPress={() =>
                  router.push({
                    pathname: '(tabs)/armado',
                    params: {
                      armadoId: a.id_armado || a.id,
                      centro: a.centro?.nombre || a.centro_nombre || '-',
                      cliente: a.centro?.cliente || a.cliente || '-',
                      estado: a.estado || 'finalizado',
                      fecha_inicio: a.fecha_inicio || '',
                      fecha_cierre: a.fecha_cierre || '',
                      total_cajas: a.total_cajas ?? 0,
                      centro_id: a.centro_id || a.centro?.id || '',
                    },
                  })
                }>
                <Ionicons name="document-text-outline" size={14} color="#fff" style={{ marginRight: 6 }} />
                <ThemedText style={styles.btnText}>Ver planilla</ThemedText>
              </Pressable>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#eef3f6' },
  container: { flexGrow: 1, padding: 16, paddingTop: 12, paddingBottom: 18, gap: 12, backgroundColor: '#eef3f6' },
  header: {
    borderWidth: 1,
    borderColor: 'rgba(45, 165, 255, 0.14)',
    backgroundColor: '#06141d',
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    overflow: 'hidden',
    shadowColor: '#06141d',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  headerGlowPrimary: {
    position: 'absolute',
    right: -54,
    top: -74,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(45, 165, 255, 0.20)',
  },
  headerGlowSecondary: {
    position: 'absolute',
    left: -48,
    bottom: -62,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(34, 197, 94, 0.10)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  titleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.18)',
    backgroundColor: 'rgba(22, 163, 74, 0.10)',
  },
  title: { fontSize: 20, fontWeight: '900', color: '#ffffff', flexShrink: 1 },
  subtitle: { marginTop: 7, fontSize: 12.5, color: '#98c7e8', fontWeight: '700' },
  headerMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  headerMetaPill: {
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
  headerMetaText: {
    color: '#f8fbff',
    fontWeight: '800',
    fontSize: 11,
  },
  kpi: {
    minWidth: 68,
    alignItems: 'center',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(159, 215, 255, 0.14)',
  },
  kpiNumber: { fontSize: 28, fontWeight: '900', color: '#ffffff', lineHeight: 28 },
  kpiLabel: { fontSize: 10.5, color: '#98c7e8', fontWeight: '800', marginTop: 2 },
  searchWrap: {
    borderWidth: 1,
    borderColor: '#d4e0ea',
    backgroundColor: '#fbfdff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginTop: 2,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#163041',
    fontSize: 14,
    fontWeight: '800',
    padding: 0,
    margin: 0,
  },
  empty: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 14,
    fontWeight: '800',
    backgroundColor: '#fbfdff',
    borderWidth: 1,
    borderColor: '#d7e3ec',
    borderRadius: 16,
    padding: 14,
  },
  card: {
    borderWidth: 1,
    borderColor: '#cdeedd',
    backgroundColor: '#f7fffb',
    borderRadius: 18,
    padding: 12,
    gap: 8,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#9db7ca',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardGlow: {
    position: 'absolute',
    right: -34,
    top: -34,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  centro: { fontSize: 17, fontWeight: '900', color: '#163041' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7e3ec',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  meta: { fontSize: 12, color: '#334155', fontWeight: '800' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { fontSize: 11, color: '#15803d', fontWeight: '800' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d4a8c',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: '#0b3b8c',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});
