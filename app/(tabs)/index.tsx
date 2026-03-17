import React, { useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { StyleSheet, Pressable, ScrollView, StatusBar as RNStatusBar, ActivityIndicator, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AuthContext } from '../_layout';
import { getArmados } from '@/lib/api';
import { clearOfflineNotice, getOfflineNotice, getPendingCount, syncOfflineQueue } from '@/lib/offline-queue';
import { subscribeArmadoUpdated } from '@/lib/realtime';

export default function HomeScreen() {
  const router = useRouter();
  const { name, role, userId, token } = useContext(AuthContext);
  const [armados, setArmados] = useState<any[]>([]);
  const [loadingArmados, setLoadingArmados] = useState(false);
  const [tieneNuevoArmado, setTieneNuevoArmado] = useState(false);
  const [mensajeNotificacion, setMensajeNotificacion] = useState('');
  const [pendientesOffline, setPendientesOffline] = useState(0);
  const knownArmadosRef = useRef<Set<number>>(new Set());
  const snapshotArmadosRef = useRef<Map<number, string>>(new Map());
  const detailArmadosRef = useRef<Map<number, { estado: string; centro: string }>>(new Map());
  const cacheKey = useMemo(() => `home_cache_v1_${userId || 'anon'}`, [userId]);

  const readHomeCache = useCallback(async () => {
    try {
      const raw = await SecureStore.getItemAsync(cacheKey);
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed?.armados) ? parsed.armados : [];
    } catch {
      return [];
    }
  }, [cacheKey]);

  const writeHomeCache = useCallback(
    async (lista: any[]) => {
      try {
        await SecureStore.setItemAsync(cacheKey, JSON.stringify({ armados: lista, updatedAt: Date.now() }));
      } catch {
        // ignore cache write errors
      }
    },
    [cacheKey]
  );

  const estadoTexto = (est?: string) => {
    const e = String(est || '').toLowerCase();
    if (e === 'en_proceso') return 'En proceso';
    if (e === 'finalizado') return 'Finalizado';
    return 'Pendiente';
  };

  const cargarArmados = useCallback(async (silent = false) => {
    if (!userId) return;
    if (!silent) setLoadingArmados(true);
    await getArmados({ tecnico_id: userId, per_page: 0 })
      .then((data) => {
        const lista = Array.isArray(data) ? data : [];
        setArmados(lista);
        writeHomeCache(lista).catch(() => {});
        const idsActuales = new Set<number>(
          lista
            .map((a) => Number(a?.id_armado || a?.id || 0))
            .filter((id) => Number.isFinite(id) && id > 0)
        );
        const conocidos = knownArmadosRef.current;
        const prevSnapshot = snapshotArmadosRef.current;
        const prevDetails = detailArmadosRef.current;
        const currentSnapshot = new Map<number, string>();
        const currentDetails = new Map<number, { estado: string; centro: string }>();
        lista.forEach((a) => {
          const id = Number(a?.id_armado || a?.id || 0);
          if (!Number.isFinite(id) || id <= 0) return;
          const estado = String(a?.estado || '');
          const centro = String(a?.centro?.nombre || a?.centro_nombre || 'Centro');
          const sig = [
            estado,
            a?.fecha_asignacion || a?.created_at || '',
            a?.fecha_inicio || '',
            a?.fecha_cierre || '',
            String(a?.total_cajas ?? ''),
          ].join('|');
          currentSnapshot.set(id, sig);
          currentDetails.set(id, { estado, centro });
        });
        if (conocidos.size > 0) {
          const nuevosIds = Array.from(idsActuales).filter((id) => !conocidos.has(id));
          const cambiosIds = Array.from(currentSnapshot.entries())
            .filter(([id, sig]) => prevSnapshot.get(id) !== sig)
            .map(([id]) => id);
          const hayNuevo = nuevosIds.length > 0;
          const hayCambio = cambiosIds.length > 0;
          if (hayNuevo || hayCambio) {
            setTieneNuevoArmado(true);
            if (hayNuevo) {
              const idNuevo = nuevosIds[0];
              const info = currentDetails.get(idNuevo);
              setMensajeNotificacion(
                `Se te asigno un nuevo centro: ${info?.centro || 'Centro'}. Estado: ${estadoTexto(info?.estado)}.`
              );
            } else {
              const idCambio = cambiosIds[0];
              const prev = prevDetails.get(idCambio);
              const curr = currentDetails.get(idCambio);
              const prevEstado = estadoTexto(prev?.estado);
              const currEstado = estadoTexto(curr?.estado);
              if (prevEstado !== currEstado) {
                setMensajeNotificacion(
                  `El armado de ${curr?.centro || 'Centro'} cambio de estado: ${prevEstado} -> ${currEstado}.`
                );
              } else {
                setMensajeNotificacion(`El armado de ${curr?.centro || 'Centro'} tuvo cambios recientes.`);
              }
            }
          }
        }
        knownArmadosRef.current = idsActuales;
        snapshotArmadosRef.current = currentSnapshot;
        detailArmadosRef.current = currentDetails;
      })
      .catch(async () => {
        const cached = await readHomeCache();
        setArmados(cached);
      })
      .finally(() => {
        if (!silent) setLoadingArmados(false);
      });
  }, [userId, readHomeCache, writeHomeCache]);

  useEffect(() => {
    cargarArmados(false);
  }, [cargarArmados]);

  useEffect(() => {
    if (!token || !userId) return;
    const onArmadoUpdated = (evt: any) => {
      const tecnicoId = Number(evt?.tecnico_id || evt?.tecnico || 0);
      if (tecnicoId && tecnicoId !== Number(userId)) return;
      cargarArmados(true);
    };
    return subscribeArmadoUpdated(onArmadoUpdated);
  }, [token, userId, cargarArmados]);

  const refrescarEstadoOffline = useCallback(async () => {
    const [count, notice] = await Promise.all([getPendingCount(), getOfflineNotice()]);
    setPendientesOffline(count);
    if (notice) {
      setTieneNuevoArmado(true);
      setMensajeNotificacion(notice);
    }
  }, []);

  useEffect(() => {
    refrescarEstadoOffline();
    const timer = setInterval(async () => {
      await syncOfflineQueue().catch(() => {});
      await refrescarEstadoOffline();
    }, 12000);
    return () => clearInterval(timer);
  }, [refrescarEstadoOffline]);

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

  const estadoTone = (est?: string) => {
    const e = (est || '').toLowerCase();
    if (e === 'finalizado') return { border: '#22c55e', bg: '#f0fdf4' };
    if (e === 'en_proceso') return { border: '#38bdf8', bg: '#f0f9ff' };
    return { border: '#facc15', bg: '#fffbeb' };
  };
  const estadoAccent = (est?: string) => {
    const e = (est || '').toLowerCase();
    if (e === 'finalizado') return '#16a34a';
    if (e === 'en_proceso') return '#2563eb';
    return '#d97706';
  };

  const estadoGlow = (est?: string) => {
    const e = (est || '').toLowerCase();
    if (e === 'finalizado') return { strong: 'rgba(16, 185, 129, 0.2)', soft: 'rgba(16, 185, 129, 0.1)' };
    if (e === 'en_proceso') return { strong: 'rgba(59, 130, 246, 0.2)', soft: 'rgba(59, 130, 246, 0.1)' };
    return { strong: 'rgba(245, 158, 11, 0.2)', soft: 'rgba(245, 158, 11, 0.1)' };
  };
  const prioridadEstado = (est?: string) => {
    const e = (est || '').toLowerCase();
    if (e === 'pendiente') return 0;
    if (e === 'en_proceso') return 1;
    if (e === 'finalizado') return 2;
    return 3;
  };
  const armadosParaHome = useMemo(() => {
    if (!Array.isArray(armados) || armados.length === 0) return [];
    const pendientesProceso = armados.filter((a) => {
      const e = (a?.estado || '').toLowerCase();
      return e === 'pendiente' || e === 'en_proceso';
    });
    if (pendientesProceso.length > 0) {
      return pendientesProceso.sort((a, b) => {
        const pa = prioridadEstado(a?.estado);
        const pb = prioridadEstado(b?.estado);
        if (pa !== pb) return pa - pb;
        const fa = new Date(a?.fecha_asignacion || a?.created_at || 0).getTime();
        const fb = new Date(b?.fecha_asignacion || b?.created_at || 0).getTime();
        return fb - fa;
      });
    }
    const finalizados = armados
      .filter((a) => (a?.estado || '').toLowerCase() === 'finalizado')
      .sort((a, b) => {
        const fa = new Date(a?.fecha_cierre || a?.fecha_asignacion || a?.created_at || 0).getTime();
        const fb = new Date(b?.fecha_cierre || b?.fecha_asignacion || b?.created_at || 0).getTime();
        return fb - fa;
      });
    return finalizados.slice(0, 1);
  }, [armados]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <StatusBar style="dark" translucent={false} />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}>
        <ThemedView style={styles.headerMini}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerLeft}>
              <ThemedView style={styles.headerAvatar}>
                <ThemedText style={styles.avatarText}>{(name || 'U')[0].toUpperCase()}</ThemedText>
              </ThemedView>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.headerHello}>HOLA DE NUEVO</ThemedText>
                <ThemedText style={styles.headerName}>{name || 'Tecnico'}</ThemedText>
                {role && (
                  <View style={styles.roleChip}>
                    <ThemedText style={styles.roleChipText}>{role}</ThemedText>
                  </View>
                )}
              </View>
            </View>
            <Pressable
              style={[styles.bellBtn, (tieneNuevoArmado || pendientesOffline > 0) && styles.bellBtnAlert]}
              onPress={() => {
                Alert.alert(
                  'Notificaciones',
                  tieneNuevoArmado || pendientesOffline > 0
                    ? mensajeNotificacion ||
                      (pendientesOffline > 0
                        ? 'Sin red: queda pendiente subir armado...'
                        : 'Tienes novedades en tus armados.')
                    : 'Sin notificaciones nuevas.'
                );
                setTieneNuevoArmado(false);
                if (pendientesOffline === 0) {
                  clearOfflineNotice().catch(() => {});
                }
              }}>
              <Ionicons
                name="notifications-outline"
                size={18}
                color={tieneNuevoArmado || pendientesOffline > 0 ? '#ffffff' : '#0b3b8c'}
              />
            </Pressable>
          </View>

          <View style={styles.actionCard}>
            <View style={styles.actionIconWrap}>
              <Ionicons name="qr-code-outline" size={18} color="#ffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.actionTitle}>Armado de pedidos</ThemedText>
              <ThemedText style={styles.actionText}>Toma un pedido y escanea productos</ThemedText>
            </View>
          </View>

        </ThemedView>

        <View style={styles.sectionHeaderRow}>
          <ThemedText type="subtitle" style={styles.sectionTitleLine}>Resumen del dia</ThemedText>
          <View style={styles.sectionLine} />
        </View>
        <ThemedView style={styles.summaryCard}>
          <View style={styles.summaryTopCard}>
            <View style={styles.summaryTopIcon}>
              <Ionicons name="trending-up-outline" size={17} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.summaryTopNumber}>{armados.length}</ThemedText>
              <ThemedText style={styles.summaryTopLabel}>Armados totales</ThemedText>
            </View>
            <View style={styles.summaryPercentWrap}>
              <ThemedText style={styles.summaryPercentText}>
                {armados.length ? Math.round((resumen.finalizado * 100) / armados.length) : 0}%
              </ThemedText>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <View style={[styles.summaryBadge, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
              <View pointerEvents="none" style={[styles.summaryCornerGlow, { backgroundColor: 'rgba(245, 158, 11, 0.22)' }]} />
              <View pointerEvents="none" style={[styles.summaryCornerGlowSoft, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]} />
              <View style={[styles.summaryIconBubble, { backgroundColor: '#f59e0b' }]}>
                <Ionicons name="time-outline" size={12} color="#fff" />
              </View>
              <ThemedText style={styles.summaryNumber}>{resumen.pendiente}</ThemedText>
              <ThemedText style={styles.summaryText}>Pendientes</ThemedText>
            </View>
            <View style={[styles.summaryBadge, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
              <View pointerEvents="none" style={[styles.summaryCornerGlow, { backgroundColor: 'rgba(59, 130, 246, 0.22)' }]} />
              <View pointerEvents="none" style={[styles.summaryCornerGlowSoft, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]} />
              <View style={[styles.summaryIconBubble, { backgroundColor: '#3b82f6' }]}>
                <Ionicons name="sync-outline" size={12} color="#fff" />
              </View>
              <ThemedText style={styles.summaryNumber}>{resumen.enProceso}</ThemedText>
              <ThemedText style={styles.summaryText}>En proceso</ThemedText>
            </View>
            <View style={[styles.summaryBadge, { backgroundColor: '#ecfdf5', borderColor: '#bbf7d0' }]}>
              <View pointerEvents="none" style={[styles.summaryCornerGlow, { backgroundColor: 'rgba(16, 185, 129, 0.22)' }]} />
              <View pointerEvents="none" style={[styles.summaryCornerGlowSoft, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]} />
              <View style={[styles.summaryIconBubble, { backgroundColor: '#10b981' }]}>
                <Ionicons name="checkmark-outline" size={12} color="#fff" />
              </View>
              <ThemedText style={styles.summaryNumber}>{resumen.finalizado}</ThemedText>
              <ThemedText style={styles.summaryText}>Finalizados</ThemedText>
            </View>
          </View>
        </ThemedView>

        <View style={styles.sectionHeaderRow}>
          <ThemedText type="subtitle" style={styles.sectionTitleLine}>Tus armados asignados</ThemedText>
          <View style={styles.sectionLine} />
        </View>
        <ThemedView style={styles.listCard}>
          {loadingArmados ? (
            <View style={{ padding: 12, alignItems: 'center' }}>
              <ActivityIndicator color="#0b3b8c" />
            </View>
          ) : armadosParaHome.length === 0 ? (
            <ThemedText style={styles.emptyText}>No tienes armados asignados.</ThemedText>
          ) : (
            armadosParaHome.map((a) => (
              <View
                key={a.id_armado || a.id}
                style={[
                  styles.armadoItem,
                  { borderColor: estadoTone(a.estado).border, backgroundColor: estadoTone(a.estado).bg },
                ]}>
                <View pointerEvents="none" style={[styles.armadoTopAccent, { backgroundColor: estadoAccent(a.estado) }]} />
                <View pointerEvents="none" style={[styles.armadoGlowStrong, { backgroundColor: estadoGlow(a.estado).strong }]} />
                <View pointerEvents="none" style={[styles.armadoGlowSoft, { backgroundColor: estadoGlow(a.estado).soft }]} />
                <View style={styles.armadoHead}>
                  <View style={styles.armadoTitleBlock}>
                    <View style={styles.armadoCenterRow}>
                      <Ionicons
                        name={a.estado === 'finalizado' ? 'checkmark-circle' : a.estado === 'en_proceso' ? 'time' : 'alert-circle'}
                        size={15}
                        color={a.estado === 'finalizado' ? '#16a34a' : a.estado === 'en_proceso' ? '#0284c7' : '#a16207'}
                      />
                      <ThemedText style={styles.armadoCentro}>{a.centro?.nombre || a.centro_nombre || '-'}</ThemedText>
                    </View>
                    <View style={styles.clienteRow}>
                      <Ionicons name="business-outline" size={13} color="#0b3b8c" />
                      <ThemedText style={styles.clientePill}>{a.centro?.cliente || a.cliente || '-'}</ThemedText>
                    </View>
                  </View>
                  <View style={styles.armadoRight}>
                    <View style={styles.diamond3dWrap}>
                      <View style={styles.diamondGhost} />
                      <View style={styles.diamondFront} />
                    </View>
                    <View style={styles.cajasWrap}>
                      <ThemedText style={styles.cajasLabel}>Total cajas</ThemedText>
                      <View style={styles.cajasOrbit}>
                        <View style={styles.cajasRingOuter} />
                        <View style={styles.cajasRingInner} />
                        <View style={styles.cajasCore}>
                          <ThemedText style={styles.cajasCoreNumber}>{a.total_cajas ?? 0}</ThemedText>
                        </View>
                      </View>
                    </View>
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
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
    padding: 14,
    backgroundColor: '#f8fbff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBtnAlert: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#1d4ed8',
    borderWidth: 1,
    borderColor: '#1e40af',
    shadowColor: '#1d4ed8',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  actionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 18,
  },
  actionText: {
    color: '#dbeafe',
    marginTop: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    backgroundColor: '#ffffff',
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1d4ed8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerHello: {
    color: '#64748b',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.6,
  },
  headerName: {
    color: '#0f172a',
    fontWeight: '900',
    fontSize: 29,
    lineHeight: 30,
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
  },
  roleChip: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#dbeafe',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  roleChipText: {
    color: '#0b3b8c',
    fontWeight: '700',
    fontSize: 10,
    textTransform: 'capitalize',
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
    borderRadius: 14,
    padding: 12,
    gap: 6,
    borderLeftWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  armadoTopAccent: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 4,
  },
  armadoGlowStrong: {
    position: 'absolute',
    right: -24,
    top: -24,
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  armadoGlowSoft: {
    position: 'absolute',
    right: -42,
    top: -42,
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  clienteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -3,
  },
  clientePill: {
    color: '#0b3b8c',
    fontWeight: '700',
    fontSize: 12,
  },
  armadoTitleBlock: {
    flex: 1,
    paddingRight: 6,
    justifyContent: 'flex-start',
  },
  armadoCenterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  armadoHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  armadoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  diamond3dWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  diamondGhost: {
    position: 'absolute',
    width: 22,
    height: 22,
    transform: [{ rotate: '45deg' }, { translateX: 7 }, { translateY: 7 }],
    backgroundColor: 'rgba(56, 189, 248, 0.35)',
    borderRadius: 2,
  },
  diamondFront: {
    width: 24,
    height: 24,
    transform: [{ rotate: '45deg' }],
    backgroundColor: '#0ea5e9',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#38bdf8',
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
  armadoCentro: {
    color: '#0f172a',
    fontWeight: '900',
    fontSize: 17,
    lineHeight: 17,
    marginBottom: 0,
    flex: 1,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  sectionTitleLine: {
    marginLeft: 2,
    color: '#0f172a',
    fontWeight: '900',
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#d1d5db',
  },
  summaryCard: {
    gap: 12,
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
    gap: 7,
  },
  summaryBadge: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'flex-start',
    gap: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  summaryCornerGlow: {
    position: 'absolute',
    right: -16,
    top: -16,
    width: 62,
    height: 62,
    borderRadius: 31,
  },
  summaryCornerGlowSoft: {
    position: 'absolute',
    right: -30,
    top: -30,
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  summaryIconBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
  },
  summaryNumber: {
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 30,
    color: '#0f172a',
  },
  summaryTopCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
  },
  summaryTopIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
  },
  summaryTopNumber: {
    color: '#0f172a',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 30,
  },
  summaryTopLabel: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  summaryPercentWrap: {
    minWidth: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 4,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  summaryPercentText: {
    fontWeight: '900',
    color: '#0f172a',
    fontSize: 12,
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
