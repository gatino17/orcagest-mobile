import React, { useContext, useEffect, useState, useMemo } from 'react';
import { StyleSheet, Pressable, ScrollView, StatusBar as RNStatusBar, ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AuthContext } from '../_layout';
import { getArmados } from '@/lib/api';

export default function HomeScreen() {
  const router = useRouter();
  const { name, role, userId } = useContext(AuthContext);
  const [armados, setArmados] = useState<any[]>([]);
  const [loadingArmados, setLoadingArmados] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoadingArmados(true);
    getArmados({ tecnico_id: userId, per_page: 0 })
      .then((data) => setArmados(Array.isArray(data) ? data : []))
      .catch(() => setArmados([]))
      .finally(() => setLoadingArmados(false));
  }, [userId]);

  const resumen = useMemo(() => {
    const base = { pendiente: 0, enProceso: 0, finalizado: 0 };
    armados.forEach((a) => {
      const e = (a.estado || '').toLowerCase();
      if (e === 'finalizado') base.finalizado += 1;
      else if (e === 'en_proceso') base.enProceso += 1;
      else base.pendiente += 1;
    });
    return base;
  }, [armados]);

  const formatFecha = (val?: string) => {
    if (!val) return '-';
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return '-';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const estadoLabel = (est?: string) => {
    const e = (est || '').toLowerCase();
    if (e === 'finalizado') return 'Finalizado';
    if (e === 'en_proceso') return 'En proceso';
    return 'Pendiente';
  };

  const badgeStyle = (est?: string) => {
    const e = (est || '').toLowerCase();
    if (e === 'finalizado') return [styles.badge, { backgroundColor: '#dcfce7', color: '#15803d' }];
    if (e === 'en_proceso') return [styles.badge, { backgroundColor: '#e0f2fe', color: '#0284c7' }];
    return [styles.badge, { backgroundColor: '#fef9c3', color: '#a16207' }];
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <StatusBar style="dark" translucent={false} />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}>
        <ThemedView style={styles.headerMini}>
          <ThemedText style={styles.headerLogo}>ORCAGEST</ThemedText>
          <ThemedText style={styles.headerTitle}>Armado de sistemas</ThemedText>
        </ThemedView>
        <ThemedView style={styles.titleContainer}>
          <ThemedView style={styles.avatar}>
            <ThemedText style={styles.avatarText}>{(name || 'U')[0].toUpperCase()}</ThemedText>
          </ThemedView>
          <ThemedText type="title">Hola {name || 'técnico'}</ThemedText>
          {role && <ThemedText style={styles.roleBadge}>{role}</ThemedText>}
        </ThemedView>

        <ThemedView style={styles.summaryCard}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Resumen rapido</ThemedText>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryBadge, { backgroundColor: '#fef9c3', borderColor: '#facc15' }]}>
              <Ionicons name="alert-circle-outline" size={14} color="#a16207" />
              <ThemedText style={[styles.summaryText, { color: '#a16207' }]}>Pendiente</ThemedText>
              <ThemedText style={[styles.summaryNumber, { color: '#a16207' }]}>{resumen.pendiente}</ThemedText>
            </View>
            <View style={[styles.summaryBadge, { backgroundColor: '#e0f2fe', borderColor: '#38bdf8' }]}>
              <Ionicons name="time-outline" size={14} color="#0284c7" />
              <ThemedText style={[styles.summaryText, { color: '#0284c7' }]}>En proceso</ThemedText>
              <ThemedText style={[styles.summaryNumber, { color: '#0284c7' }]}>{resumen.enProceso}</ThemedText>
            </View>
            <View style={[styles.summaryBadge, { backgroundColor: '#dcfce7', borderColor: '#22c55e' }]}>
              <Ionicons name="checkmark-circle-outline" size={14} color="#15803d" />
              <ThemedText style={[styles.summaryText, { color: '#15803d' }]}>Finalizado</ThemedText>
              <ThemedText style={[styles.summaryNumber, { color: '#15803d' }]}>{resumen.finalizado}</ThemedText>
            </View>
          </View>
        </ThemedView>

        <ThemedView style={styles.listCard}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Tus armados asignados</ThemedText>
          {loadingArmados ? (
            <View style={{ padding: 12, alignItems: 'center' }}>
              <ActivityIndicator color="#0b3b8c" />
            </View>
          ) : armados.length === 0 ? (
            <ThemedText style={styles.emptyText}>No tienes armados asignados.</ThemedText>
          ) : (
            armados.map((a) => (
              <View key={a.id_armado || a.id} style={styles.armadoItem}>
                <View style={styles.clienteRow}>
                  <Ionicons name="people-outline" size={14} color="#0b3b8c" />
                  <ThemedText style={styles.clientePill}>{a.centro?.cliente || a.cliente || '-'}</ThemedText>
                </View>

                <View style={styles.armadoHead}>
                  <ThemedText style={styles.armadoCentro}>{a.centro?.nombre || a.centro_nombre || '-'}</ThemedText>
                  <View style={styles.cajaTag}>
                    <Ionicons name="cube-outline" size={12} color="#b45309" />
                    <ThemedText style={styles.cajaText}>{a.total_cajas ?? 0} caja(s)</ThemedText>
                  </View>
                </View>

                <View style={styles.armadoMetaRow}>
                  <View style={styles.metaChip}>
                    <Ionicons name="calendar-outline" size={12} color="#0f172a" />
                    <ThemedText style={styles.metaText}>{formatFecha(a.fecha_asignacion || a.created_at)}</ThemedText>
                  </View>
                  <View style={styles.metaChip}>
                    <Ionicons name="play-outline" size={12} color="#0f172a" />
                    <ThemedText style={styles.metaText}>{formatFecha(a.fecha_inicio)}</ThemedText>
                  </View>
                </View>

                <View style={styles.estadoRow}>
                  <Ionicons
                    name={a.estado === 'finalizado' ? 'checkmark-circle-outline' : a.estado === 'en_proceso' ? 'time-outline' : 'alert-circle-outline'}
                    size={14}
                    color={a.estado === 'finalizado' ? '#16a34a' : a.estado === 'en_proceso' ? '#0284c7' : '#a16207'}
                    style={{ marginRight: 6 }}
                  />
                  <ThemedText style={badgeStyle(a.estado)}>{estadoLabel(a.estado)}</ThemedText>
                </View>
                <View style={styles.planillaRow}>
                  <Pressable
                    style={styles.planillaBtn}
                    onPress={() =>
                      router.push({
                        pathname: '(tabs)/armado',
                        params: {
                          armadoId: a.id_armado || a.id,
                          centro: a.centro?.nombre || a.centro_nombre || '-',
                          cliente: a.centro?.cliente || a.cliente || '-',
                          estado: a.estado || '',
                          total_cajas: a.total_cajas ?? 0,
                          centro_id: a.centro_id || a.centro?.id || '',
                        },
                      })
                    }>
                    <Ionicons name="list-outline" size={14} color="#fff" style={{ marginRight: 6 }} />
                    <ThemedText style={styles.planillaText}>Ir a planilla</ThemedText>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ThemedView>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingTop: (RNStatusBar.currentHeight || 24) + 12,
    gap: 12,
    backgroundColor: '#ffffff',
  },
  headerMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    backgroundColor: '#e8f0ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c7d7ff',
  },
  headerLogo: {
    backgroundColor: '#0b3b8c',
    color: '#e8f0ff',
    fontWeight: '900',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  headerTitle: {
    fontWeight: '900',
    color: '#0a1f44',
    fontSize: 17,
    letterSpacing: 0.5,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    backgroundColor: '#ffffff',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 20,
  },
  roleBadge: {
    marginLeft: 6,
    color: '#16a34a',
    fontWeight: '700',
    fontSize: 12,
  },
  hero: {
    backgroundColor: '#f8fbff',
    borderRadius: 16,
    padding: 16,
    gap: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#dbeafe',
    shadowColor: '#0b3b8c',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  heroTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '700',
  },
  heroText: {
    color: '#334155',
    fontSize: 13,
  },
  heroKpis: {
    color: '#64748b',
    fontSize: 12,
  },
  menu: {
    gap: 14,
    backgroundColor: '#ffffff',
    padding: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  sectionTitle: {
    marginLeft: 6,
  },
  cardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#f8fbff',
    padding: 12,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#dbeafe',
    shadowColor: '#0b3b8c',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '700',
  },
  cardText: {
    fontSize: 13,
    color: '#475569',
  },
  cardLink: {
    marginTop: 4,
    fontWeight: '700',
    color: '#0b3b8c',
  },
  listCard: {
    gap: 8,
    backgroundColor: '#ffffff',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    paddingVertical: 8,
  },
  armadoItem: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    gap: 4,
    backgroundColor: '#f9fbff',
  },
  clienteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clientePill: {
    backgroundColor: '#e0f2fe',
    color: '#0b3b8c',
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
    fontSize: 12,
  },
  armadoHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  armadoCentro: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 14,
    flex: 1,
  },
  cajaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  cajaText: {
    color: '#b45309',
    fontWeight: '700',
    fontSize: 11,
  },
  estadoRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  planillaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  armadoMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#eef2ff',
    borderRadius: 8,
  },
  metaText: {
    color: '#0f172a',
    fontSize: 11,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    fontWeight: '700',
    fontSize: 12,
  },
  summaryCard: {
    gap: 10,
    backgroundColor: '#ffffff',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryBadge: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
  },
  summaryText: {
    fontSize: 11,
    fontWeight: '700',
  },
  summaryNumber: {
    fontSize: 14,
    fontWeight: '900',
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
});
