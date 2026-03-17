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
    <SafeAreaView style={styles.safe}>
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
              <View style={styles.headerGlow} />
              <View>
                <View style={styles.titleRow}>
                  <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                  <ThemedText style={styles.title}>Armados finalizados</ThemedText>
                </View>
                <ThemedText style={styles.subtitle}>Historial cerrado y solo lectura</ThemedText>
              </View>
              <View style={styles.kpi}>
                <ThemedText style={styles.kpiNumber}>{itemsFiltrados.length}</ThemedText>
                <ThemedText style={styles.kpiLabel}>visibles</ThemedText>
              </View>
            </ThemedView>

            <ThemedView style={styles.searchWrap}>
              <Ionicons name="search-outline" size={16} color="#64748b" />
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
            <View style={styles.cardAccent} />
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
              <ThemedText style={styles.meta}>Asignado: {formatFecha(a.fecha_asignacion || a.created_at)}</ThemedText>
              <ThemedText style={styles.meta}>Cierre: {formatFecha(a.fecha_cierre)}</ThemedText>
              <ThemedText style={styles.meta}>Cajas: {a.total_cajas ?? 0}</ThemedText>
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
  safe: { flex: 1, backgroundColor: '#ffffff' },
  container: { padding: 16, gap: 10, backgroundColor: '#ffffff' },
  header: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fbff',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerGlow: {
    position: 'absolute',
    right: -26,
    top: -26,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(37,99,235,0.16)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  subtitle: { marginTop: 2, fontSize: 12, color: '#475569', fontWeight: '600' },
  kpi: { alignItems: 'center' },
  kpiNumber: { fontSize: 28, fontWeight: '900', color: '#0b3b8c', lineHeight: 28 },
  kpiLabel: { fontSize: 11, color: '#475569', fontWeight: '700' },
  searchWrap: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fbff',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 11,
    marginTop: 2,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
    padding: 0,
    margin: 0,
  },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 14 },
  card: {
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  cardAccent: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 3,
    backgroundColor: '#16a34a',
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  centro: { fontSize: 17, fontWeight: '900', color: '#0f172a' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  rowWrap: { gap: 2 },
  meta: { fontSize: 12, color: '#334155', fontWeight: '700' },
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
    backgroundColor: '#0b3b8c',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
