import React, { useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { StyleSheet, Pressable, ScrollView, ActivityIndicator, View, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AuthContext } from '../_layout';
import { getArmados, updateArmado } from '@/lib/api';
import {
  fetchActividadesAsignadasUsuario,
  readCachedActividadesAsignadas,
  tipoActividadProgramada,
  writeCachedActividadesAsignadas,
} from '@/lib/actividades';
import { clearOfflineNotice, refreshOfflineStatus, subscribeOfflineQueueStatus } from '@/lib/offline-queue';
import { subscribeActividadUpdated, subscribeArmadoUpdated } from '@/lib/realtime';

export default function HomeScreen() {
  const router = useRouter();
  const { name, role, userId, token } = useContext(AuthContext);
  const [armados, setArmados] = useState<any[]>([]);
  const [loadingArmados, setLoadingArmados] = useState(false);
  const [tieneNuevoArmado, setTieneNuevoArmado] = useState(false);
  const [mensajeNotificacion, setMensajeNotificacion] = useState('');
  const [pendientesOffline, setPendientesOffline] = useState(0);
  const [trabajosProgramados, setTrabajosProgramados] = useState<any[]>([]);
  const [fechasAperturaPlanilla, setFechasAperturaPlanilla] = useState<Record<string, string>>({});
  const knownArmadosRef = useRef<Set<number>>(new Set());
  const knownTrabajosRef = useRef<Set<number>>(new Set());
  const snapshotArmadosRef = useRef<Map<number, string>>(new Map());
  const detailArmadosRef = useRef<Map<number, { estado: string; centro: string }>>(new Map());
  const cacheKey = useMemo(() => `home_cache_v1_${userId || 'anon'}`, [userId]);
  const aperturasKey = useMemo(() => `home_planilla_open_v1_${userId || 'anon'}`, [userId]);
  const bellPulse = useRef(new Animated.Value(1)).current;
  const normalizeTechName = useCallback(
    (value: any) =>
      String(value || '')
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''),
    []
  );

  const getCompanerosArmado = useCallback(
    (armado: any) => {
      const propios = Array.isArray(armado?.tecnicos_asignados) ? armado.tecnicos_asignados : [];
      const uid = Number(userId || 0) || 0;
      const myName = normalizeTechName(name);
      return propios
        .filter((tec: any) => {
          const tid = Number(tec?.id || 0) || 0;
          const tname = normalizeTechName(tec?.nombre);
          if (uid > 0 && tid === uid) return false;
          if (myName && tname && tname === myName) return false;
          return !!(tid || tname);
        })
        .map((tec: any) => tec?.nombre)
        .filter(Boolean);
    },
    [name, normalizeTechName, userId]
  );

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

  const readAperturasCache = useCallback(async () => {
    try {
      const raw = await SecureStore.getItemAsync(aperturasKey);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }, [aperturasKey]);

  const writeAperturasCache = useCallback(
    async (data: Record<string, string>) => {
      try {
        await SecureStore.setItemAsync(aperturasKey, JSON.stringify(data || {}));
      } catch {
        // ignore cache write errors
      }
    },
    [aperturasKey]
  );

  const estadoTexto = (est?: string) => {
    const e = String(est || '').toLowerCase();
    if (e === 'en_proceso') return 'En proceso';
    if (e === 'prefinalizado') return 'Prefinalizado';
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

  const cargarTrabajosProgramados = useCallback(async (silent = false) => {
    if (!token) return;
    try {
      const listaBase = await fetchActividadesAsignadasUsuario({ userId, name });
      const lista = (Array.isArray(listaBase) ? listaBase : []).filter((a) => {
        const estado = String(a?.estado || '').toLowerCase();
        return estado !== 'finalizado' && estado !== 'cancelado';
      });
      setTrabajosProgramados(lista);
      writeCachedActividadesAsignadas(userId, listaBase).catch(() => {});

      const idsActuales = new Set<number>(
        lista.map((a) => Number(a?.id_actividad || 0)).filter((id) => Number.isFinite(id) && id > 0)
      );
      const conocidos = knownTrabajosRef.current;
      if (conocidos.size > 0) {
        const nuevosIds = Array.from(idsActuales).filter((id) => !conocidos.has(id));
        if (nuevosIds.length > 0) {
          const nuevo = lista.find((a) => Number(a?.id_actividad || 0) === nuevosIds[0]);
          const tipo = tipoActividadProgramada(nuevo?.area, nuevo?.nombre_actividad);
          setTieneNuevoArmado(true);
          setMensajeNotificacion(
            `Tienes asignado ${tipo} en ${nuevo?.centro?.nombre || 'centro'}.`
          );
        }
      } else if (!silent && lista.length > 0) {
        const a = lista[0];
        const tipo = tipoActividadProgramada(a?.area, a?.nombre_actividad);
        setTieneNuevoArmado(true);
        setMensajeNotificacion(`Tienes ${lista.length} trabajo(s) programado(s). Ultimo: ${tipo} en ${a?.centro?.nombre || 'centro'}.`);
      }
      knownTrabajosRef.current = idsActuales;
    } catch {
      const cached = await readCachedActividadesAsignadas(userId);
      setTrabajosProgramados(
        (Array.isArray(cached) ? cached : []).filter((a) => {
          const estado = String(a?.estado || '').toLowerCase();
          return estado !== 'finalizado' && estado !== 'cancelado';
        })
      );
    }
  }, [token, name, userId]);

  useEffect(() => {
    cargarArmados(false);
    cargarTrabajosProgramados(false);
  }, [cargarArmados, cargarTrabajosProgramados]);

  useEffect(() => {
    readAperturasCache().then((data) => {
      setFechasAperturaPlanilla(data);
    });
  }, [readAperturasCache]);

  useEffect(() => {
    readCachedActividadesAsignadas(userId).then((cached) => {
      setTrabajosProgramados(
        (Array.isArray(cached) ? cached : []).filter((a) => {
          const estado = String(a?.estado || '').toLowerCase();
          return estado !== 'finalizado' && estado !== 'cancelado';
        })
      );
    });
  }, [userId]);

  useEffect(() => {
    if (!token || !userId) return;
    const onArmadoUpdated = (evt: any) => {
      const tecnicoId = Number(evt?.tecnico_id || evt?.tecnico || 0);
      if (tecnicoId && tecnicoId !== Number(userId)) return;
      cargarArmados(true);
    };
    return subscribeArmadoUpdated(onArmadoUpdated);
  }, [token, userId, cargarArmados]);

  useEffect(() => {
    if (!token) return;
    const onActividadUpdated = () => {
      cargarTrabajosProgramados(true);
    };
    return subscribeActividadUpdated(onActividadUpdated);
  }, [token, cargarTrabajosProgramados]);

  const refrescarEstadoOffline = useCallback(async () => {
    const { pending, notice } = await refreshOfflineStatus();
    setPendientesOffline(pending);
    if (notice) {
      setTieneNuevoArmado(true);
      setMensajeNotificacion(notice);
    }
  }, []);

  useEffect(() => {
    refrescarEstadoOffline();
    const unsubscribe = subscribeOfflineQueueStatus(({ pending, notice }) => {
      setPendientesOffline(pending);
      if (notice) {
        setTieneNuevoArmado(true);
        setMensajeNotificacion(notice);
      }
    });
    return unsubscribe;
  }, [refrescarEstadoOffline]);

  useEffect(() => {
    const shouldPulse = tieneNuevoArmado || pendientesOffline > 0;
    if (!shouldPulse) {
      bellPulse.stopAnimation();
      bellPulse.setValue(1);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(bellPulse, { toValue: 1.08, duration: 420, useNativeDriver: true }),
        Animated.timing(bellPulse, { toValue: 1, duration: 420, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [tieneNuevoArmado, pendientesOffline, bellPulse]);

  const resumen = useMemo(() => {
    const base = { pendiente: 0, enProceso: 0, prefinalizado: 0, finalizado: 0 };
    armados.forEach((a) => {
      const e = (a.estado || '').toLowerCase();
      if (e === 'finalizado') base.finalizado += 1;
      else if (e === 'prefinalizado') base.prefinalizado += 1;
      else if (e === 'en_proceso') base.enProceso += 1;
      else base.pendiente += 1;
    });
    return base;
  }, [armados]);

  const formatFecha = (val?: string) => {
    if (!val) return '-';
    const raw = String(val).trim();
    const fechaIso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (fechaIso) {
      const [, y, m, d] = fechaIso;
      return `${d}/${m}/${y}`;
    }
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '-';
    const usarUTC = /(?:gmt|utc|z|[+\-]\d{2}:?\d{2})/i.test(raw);
    const dia = String(usarUTC ? d.getUTCDate() : d.getDate()).padStart(2, '0');
    const mes = String((usarUTC ? d.getUTCMonth() : d.getMonth()) + 1).padStart(2, '0');
    const anio = usarUTC ? d.getUTCFullYear() : d.getFullYear();
    return `${dia}/${mes}/${anio}`;
  };

  const estadoLabel = (est?: string) => {
    const e = (est || '').toLowerCase();
    if (e === 'finalizado') return 'Finalizado';
    if (e === 'en_proceso') return 'En proceso';
    if (e === 'prefinalizado') return 'Prefinalizado';
    return 'Pendiente';
  };

  const badgeStyle = (est?: string) => {
    const e = (est || '').toLowerCase();
    if (e === 'finalizado') return [styles.badge, { backgroundColor: '#dcfce7', color: '#15803d', borderColor: '#86efac' }];
    if (e === 'en_proceso') return [styles.badge, { backgroundColor: '#e0f2fe', color: '#0284c7', borderColor: '#7dd3fc' }];
    if (e === 'prefinalizado') return [styles.badge, { backgroundColor: '#f5f3ff', color: '#6d28d9', borderColor: '#c4b5fd' }];
    return [styles.badge, { backgroundColor: '#fef9c3', color: '#a16207', borderColor: '#fde68a' }];
  };

  const estadoTone = (est?: string) => {
    const e = (est || '').toLowerCase();
    if (e === 'finalizado') return { border: '#638da3', bg: '#dbe8ef' };
    if (e === 'en_proceso') return { border: '#38bdf8', bg: '#f0f9ff' };
    if (e === 'prefinalizado') return { border: '#a78bfa', bg: '#f5f3ff' };
    return { border: '#facc15', bg: '#fffbeb' };
  };
  const estadoAccent = (est?: string) => {
    const e = (est || '').toLowerCase();
    if (e === 'finalizado') return '#16a34a';
    if (e === 'en_proceso') return '#2563eb';
    if (e === 'prefinalizado') return '#7c3aed';
    return '#d97706';
  };

  const estadoGlow = (est?: string) => {
    const e = (est || '').toLowerCase();
    if (e === 'finalizado') return { strong: 'rgba(22, 163, 74, 0.34)', soft: 'rgba(34, 197, 94, 0.18)' };
    if (e === 'en_proceso') return { strong: 'rgba(59, 130, 246, 0.2)', soft: 'rgba(59, 130, 246, 0.1)' };
    if (e === 'prefinalizado') return { strong: 'rgba(124, 58, 237, 0.2)', soft: 'rgba(124, 58, 237, 0.1)' };
    return { strong: 'rgba(245, 158, 11, 0.2)', soft: 'rgba(245, 158, 11, 0.1)' };
  };
  const prioridadEstado = (est?: string) => {
    const e = (est || '').toLowerCase();
    if (e === 'pendiente') return 0;
    if (e === 'en_proceso') return 1;
    if (e === 'prefinalizado') return 2;
    if (e === 'finalizado') return 3;
    return 3;
  };
  const armadosParaHome = useMemo(() => {
    if (!Array.isArray(armados) || armados.length === 0) return [];
    const pendientesProceso = armados.filter((a) => {
      const e = (a?.estado || '').toLowerCase();
      return e === 'pendiente' || e === 'en_proceso' || e === 'prefinalizado';
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

  const irAPlanilla = useCallback(
    async (a: any) => {
      const armadoId = a?.id_armado || a?.id;
      const estadoActual = String(a?.estado || '').toLowerCase();
      let estadoDestino = a?.estado || '';

      if (armadoId && estadoActual === 'pendiente') {
        try {
          const hoyIso = new Date().toISOString().slice(0, 10);
          await updateArmado(armadoId, { estado: 'en_proceso', check_tecnico_fecha: hoyIso });
          estadoDestino = 'en_proceso';
          setArmados((prev) =>
            (Array.isArray(prev) ? prev : []).map((item) => {
              const itemId = item?.id_armado || item?.id;
              if (Number(itemId) !== Number(armadoId)) return item;
              return { ...item, estado: 'en_proceso', check_tecnico_fecha: hoyIso };
            })
          );
        } catch {
          // Permite continuar a planilla aunque no haya red o falle backend.
        }
      }

      const hoyIso = new Date().toISOString().slice(0, 10);
      const key = String(armadoId || '');
      if (key) {
        setFechasAperturaPlanilla((prev) => {
          const next = { ...(prev || {}), [key]: hoyIso };
          writeAperturasCache(next).catch(() => {});
          return next;
        });
      }

      router.push({
        pathname: '(tabs)/armado',
        params: {
          armadoId,
          centro: a?.centro?.nombre || a?.centro_nombre || '-',
          cliente: a?.centro?.cliente || a?.cliente || '-',
          estado: estadoDestino,
          fecha_inicio: a?.fecha_inicio || '',
          fecha_cierre: a?.fecha_cierre || '',
          total_cajas: a?.total_cajas ?? 0,
          centro_id: a?.centro_id || a?.centro?.id || '',
        },
      });
    },
    [router, writeAperturasCache]
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <StatusBar style="dark" translucent={false} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}>
        <ThemedView style={styles.headerMini}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerLeft}>
              <ThemedView style={styles.headerAvatar}>
                <View style={styles.avatarLogoWrap}>
                  <View style={[styles.avatarOrbit, styles.avatarOrbitBack]} />
                  <View style={[styles.avatarOrbit, styles.avatarOrbitFront]} />
                  <View style={styles.avatarCore} />
                </View>
              </ThemedView>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.headerHello}>Hola de nuevo</ThemedText>
                <ThemedText style={styles.headerName} numberOfLines={1} ellipsizeMode="tail">
                  {name || 'Tecnico'}
                </ThemedText>
                <View
                  style={[
                    styles.headerStatusChip,
                    pendientesOffline > 0 ? styles.headerStatusChipPending : styles.headerStatusChipOk,
                  ]}>
                  <Ionicons
                    name={pendientesOffline > 0 ? 'cloud-offline-outline' : 'checkmark-circle'}
                    size={12}
                    color={pendientesOffline > 0 ? '#b45309' : '#16a34a'}
                  />
                  <ThemedText
                    style={[
                      styles.headerStatusText,
                      pendientesOffline > 0 ? styles.headerStatusTextPending : styles.headerStatusTextOk,
                    ]}>
                    {pendientesOffline > 0 ? 'Pendiente de sincronización' : 'Sincronizado'}
                  </ThemedText>
                </View>
              </View>
            </View>
            <Animated.View style={{ transform: [{ scale: bellPulse }] }}>
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
                      : trabajosProgramados.length > 0
                      ? `Tienes ${trabajosProgramados.length} trabajo(s) programado(s).`
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
                {trabajosProgramados.length > 0 ? (
                  <View style={[styles.bellCountBadge, (tieneNuevoArmado || pendientesOffline > 0) && styles.bellCountBadgeAlert]}>
                    <ThemedText style={styles.bellCountBadgeText}>
                      {trabajosProgramados.length > 9 ? '9+' : trabajosProgramados.length}
                    </ThemedText>
                  </View>
                ) : null}
              </Pressable>
            </Animated.View>
          </View>

        </ThemedView>

        <View style={styles.sectionHeaderRow}>
          <ThemedText type="subtitle" style={[styles.sectionTitleLine, styles.summarySectionTitle]}>
            ARMADOS
          </ThemedText>
          <View style={styles.sectionLine} />
        </View>
        <ThemedView style={styles.summaryCard}>
          <View style={styles.summaryTopCard}>
            <View pointerEvents="none" style={styles.summaryTopGlowPrimary} />
            <View pointerEvents="none" style={styles.summaryTopGlowSecondary} />
            <View style={styles.summaryTopLeft}>
              <View style={styles.summaryTopIcon}>
                <Ionicons name="analytics-outline" size={17} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.summaryTopEyebrow}>Estado operativo</ThemedText>
                <ThemedText style={styles.summaryTopLabel}>Armados totales</ThemedText>
              </View>
            </View>
            <View style={styles.summaryTopRight}>
              <ThemedText style={styles.summaryTopNumber}>{armados.length}</ThemedText>
              <View style={styles.summaryPercentWrap}>
                <Ionicons name="sparkles-outline" size={12} color="#22c55e" />
                <ThemedText style={styles.summaryPercentText}>
                  {armados.length ? Math.round((resumen.finalizado * 100) / armados.length) : 0}%
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <View style={[styles.summaryBadge, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
              <View pointerEvents="none" style={[styles.summaryCornerGlow, { backgroundColor: 'rgba(245, 158, 11, 0.22)' }]} />
              <View pointerEvents="none" style={[styles.summaryCornerGlowSoft, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]} />
              <View style={styles.summaryBadgeHead}>
                <View style={styles.summaryLabelWrap}>
                  <View style={[styles.summaryIconBubble, { backgroundColor: '#f59e0b' }]}>
                    <Ionicons name="time-outline" size={12} color="#fff" />
                  </View>
                  <ThemedText style={styles.summaryText}>Pendientes</ThemedText>
                </View>
                <ThemedText style={styles.summaryNumber}>{resumen.pendiente}</ThemedText>
              </View>
            </View>
            <View style={[styles.summaryBadge, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
              <View pointerEvents="none" style={[styles.summaryCornerGlow, { backgroundColor: 'rgba(59, 130, 246, 0.22)' }]} />
              <View pointerEvents="none" style={[styles.summaryCornerGlowSoft, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]} />
              <View style={styles.summaryBadgeHead}>
                <View style={styles.summaryLabelWrap}>
                  <View style={[styles.summaryIconBubble, { backgroundColor: '#3b82f6' }]}>
                    <Ionicons name="sync-outline" size={12} color="#fff" />
                  </View>
                  <ThemedText style={styles.summaryText}>En proceso</ThemedText>
                </View>
                <ThemedText style={styles.summaryNumber}>{resumen.enProceso}</ThemedText>
              </View>
            </View>
            <View style={[styles.summaryBadge, { backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' }]}>
              <View pointerEvents="none" style={[styles.summaryCornerGlow, { backgroundColor: 'rgba(124, 58, 237, 0.22)' }]} />
              <View pointerEvents="none" style={[styles.summaryCornerGlowSoft, { backgroundColor: 'rgba(124, 58, 237, 0.12)' }]} />
              <View style={styles.summaryBadgeHead}>
                <View style={styles.summaryLabelWrap}>
                  <View style={[styles.summaryIconBubble, { backgroundColor: '#7c3aed' }]}>
                    <Ionicons name="shield-checkmark-outline" size={12} color="#fff" />
                  </View>
                  <ThemedText style={styles.summaryText}>Pre-finalizado</ThemedText>
                </View>
                <ThemedText style={styles.summaryNumber}>{resumen.prefinalizado}</ThemedText>
              </View>
            </View>
            <View style={[styles.summaryBadge, { backgroundColor: '#ecfdf5', borderColor: '#bbf7d0' }]}>
              <View pointerEvents="none" style={[styles.summaryCornerGlow, { backgroundColor: 'rgba(16, 185, 129, 0.22)' }]} />
              <View pointerEvents="none" style={[styles.summaryCornerGlowSoft, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]} />
              <View style={styles.summaryBadgeHead}>
                <View style={styles.summaryLabelWrap}>
                  <View style={[styles.summaryIconBubble, { backgroundColor: '#10b981' }]}>
                    <Ionicons name="checkmark-outline" size={12} color="#fff" />
                  </View>
                  <ThemedText style={styles.summaryText}>Finalizados</ThemedText>
                </View>
                <ThemedText style={styles.summaryNumber}>{resumen.finalizado}</ThemedText>
              </View>
            </View>
          </View>
        </ThemedView>

        <View style={styles.sectionHeaderRow}>
          <ThemedText type="subtitle" style={[styles.sectionTitleLine, styles.summarySectionTitle]}>
            TUS ARMADOS ASIGNADOS
          </ThemedText>
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
                <View
                  pointerEvents="none"
                  style={[
                    styles.armadoGlowStrong,
                    { backgroundColor: estadoGlow(a.estado).strong },
                    (a.estado || '').toLowerCase() === 'finalizado' && styles.armadoGlowStrongDone,
                  ]}
                />
                <View
                  pointerEvents="none"
                  style={[
                    styles.armadoGlowSoft,
                    { backgroundColor: estadoGlow(a.estado).soft },
                    (a.estado || '').toLowerCase() === 'finalizado' && styles.armadoGlowSoftDone,
                  ]}
                />
                <View style={styles.armadoHead}>
                  <View style={styles.armadoTitleBlock}>
                    <View style={styles.armadoTopRow}>
                      <ThemedText style={badgeStyle(a.estado)}>{estadoLabel(a.estado)}</ThemedText>
                    </View>
                    <View style={styles.armadoCenterRow}>
                      <Ionicons
                        name={a.estado === 'finalizado' ? 'checkmark-circle' : a.estado === 'en_proceso' ? 'time' : a.estado === 'prefinalizado' ? 'shield-checkmark' : 'alert-circle'}
                        size={15}
                        color={a.estado === 'finalizado' ? '#16a34a' : a.estado === 'en_proceso' ? '#0284c7' : a.estado === 'prefinalizado' ? '#6d28d9' : '#a16207'}
                      />
                      <ThemedText style={styles.armadoCentro}>{a.centro?.nombre || a.centro_nombre || '-'}</ThemedText>
                    </View>
                    <View style={styles.clienteRow}>
                      <ThemedText style={styles.clientePill}>{a.centro?.cliente || a.cliente || '-'}</ThemedText>
                    </View>
                    {getCompanerosArmado(a).length ? (
                      <View style={styles.apoyoRow}>
                        <Ionicons name="people-outline" size={12} color="#64748b" />
                        <ThemedText style={styles.apoyoText}>
                          {`Compañero: ${getCompanerosArmado(a).join(", ")}`}
                        </ThemedText>
                      </View>
                    ) : null}
                    <View style={styles.asignadoInline}>
                      <View style={styles.asignadoInlineIcon}>
                        <Ionicons name="calendar-outline" size={10} color="#9fd7ff" />
                      </View>
                      <ThemedText style={styles.asignadoInlineLabel}>Asignado</ThemedText>
                      <ThemedText style={styles.asignadoInlineDate}>
                        {formatFecha(a.fecha_asignacion || a.created_at)}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.armadoRight}>
                    <View style={styles.cajasWrap}>
                      <ThemedText style={styles.cajasLabel}>Bultos</ThemedText>
                      <View style={styles.cajasCountPill}>
                        <Ionicons name="cube-outline" size={13} color="#9fd7ff" />
                        <ThemedText style={styles.cajasCoreNumber}>{a.total_cajas ?? 0}</ThemedText>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={styles.planillaRow}>
                  <Pressable
                    style={styles.planillaBtn}
                    onPress={() => {
                      irAPlanilla(a);
                    }}>
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
  safe: {
    flex: 1,
    backgroundColor: '#eef3f6',
  },
  scroll: {
    flex: 1,
    backgroundColor: '#eef3f6',
  },
  container: {
    flexGrow: 1,
    padding: 16,
    paddingTop: 12,
    paddingBottom: 18,
    gap: 12,
    backgroundColor: '#eef3f6',
  },
  headerMini: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
    padding: 16,
    backgroundColor: '#06141d',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(45, 165, 255, 0.14)',
    shadowColor: '#06141d',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(159, 215, 255, 0.22)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBtnAlert: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
    shadowColor: '#dc2626',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  bellCountBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#1d4ed8',
    borderWidth: 1,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellCountBadgeAlert: {
    backgroundColor: '#b91c1c',
  },
  bellCountBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
  headerStatusChip: {
    marginTop: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
  },
  headerStatusChipOk: {
    backgroundColor: 'rgba(22, 163, 74, 0.10)',
    borderColor: 'rgba(34, 197, 94, 0.16)',
  },
  headerStatusChipPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderColor: 'rgba(245, 158, 11, 0.20)',
  },
  headerStatusText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  headerStatusTextOk: {
    color: '#d8ffe7',
  },
  headerStatusTextPending: {
    color: '#fde7ba',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    backgroundColor: '#ffffff',
  },
  headerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#edf6fd',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#67c1ff',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  headerHello: {
    color: '#9bb4c4',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.6,
  },
  headerName: {
    color: '#f8fbff',
    fontWeight: '800',
    fontSize: 17,
    lineHeight: 20,
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
  },
  avatarLogoWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOrbit: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 4,
  },
  avatarOrbitBack: {
    width: 22,
    height: 10,
    borderColor: '#206892',
    transform: [{ rotate: '-22deg' }, { translateY: -2 }],
  },
  avatarOrbitFront: {
    width: 24,
    height: 12,
    borderColor: '#2da5ff',
    transform: [{ rotate: '20deg' }, { translateY: 3 }],
  },
  avatarCore: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#9fd7ff',
  },
  roleChip: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(159, 215, 255, 0.12)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(159, 215, 255, 0.14)',
  },
  roleChipText: {
    color: '#cfeeff',
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
    gap: 7,
    backgroundColor: '#fbfdff',
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d7e3ec',
    shadowColor: '#9db7ca',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    paddingVertical: 8,
  },
  armadoItem: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    gap: 7,
    borderLeftWidth: 1,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#8fa8bb',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
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
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  armadoGlowSoft: {
    position: 'absolute',
    right: -42,
    top: -42,
    width: 104,
    height: 104,
    borderRadius: 52,
  },
  armadoGlowStrongDone: {
    right: -42,
    top: -42,
    width: 122,
    height: 122,
    borderRadius: 61,
  },
  armadoGlowSoftDone: {
    right: -78,
    top: -78,
    width: 178,
    height: 178,
    borderRadius: 89,
  },
  clienteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: -4,
  },
  apoyoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  apoyoText: {
    color: '#617487',
    fontWeight: '700',
    fontSize: 10.5,
    flex: 1,
  },
  asignadoInline: {
    marginTop: 5,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: '#c9d9e4',
  },
  asignadoInlineIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#0d2436',
    alignItems: 'center',
    justifyContent: 'center',
  },
  asignadoInlineLabel: {
    color: '#567083',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  asignadoInlineDate: {
    color: '#102a3d',
    fontSize: 10.4,
    fontWeight: '900',
  },
  clientePill: {
    color: '#154766',
    fontWeight: '700',
    fontSize: 11.3,
  },
  armadoTitleBlock: {
    flex: 1,
    paddingRight: 8,
    justifyContent: 'flex-start',
  },
  armadoTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 4,
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
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  cajasWrap: {
    minWidth: 76,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingVertical: 0,
  },
  cajasLabel: {
    color: '#0f172a',
    fontSize: 9.2,
    fontWeight: '900',
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cajasCountPill: {
    minWidth: 58,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#0d2436',
    borderWidth: 1,
    borderColor: 'rgba(45, 165, 255, 0.26)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    shadowColor: '#0d2436',
    shadowOpacity: 0.14,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cajasCoreNumber: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 14,
  },
  armadoCentro: {
    color: '#0f172a',
    fontWeight: '900',
    fontSize: 14.2,
    lineHeight: 16,
    marginBottom: 0,
    flex: 1,
  },
  planillaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  armadoMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#c9d9e4',
    minWidth: 112,
  },
  metaIconBubble: {
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: '#0d2436',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaLabel: {
    color: '#567083',
    fontSize: 8.8,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  metaText: {
    color: '#102a3d',
    fontSize: 10.6,
    fontWeight: '900',
    marginTop: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
    fontWeight: '800',
    fontSize: 10,
    borderWidth: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 0,
  },
  sectionTitleLine: {
    marginLeft: 2,
    color: '#163041',
    fontWeight: '900',
  },
  summarySectionTitle: {
    color: '#7a8b98',
    fontSize: 12.5,
    fontWeight: '700',
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#d8e3eb',
  },
  summaryCard: {
    gap: 9,
    backgroundColor: '#fbfdff',
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d7e3ec',
    shadowColor: '#9db7ca',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 7,
  },
  summaryBadge: {
    width: '48.5%',
    borderWidth: 1,
    borderRadius: 13,
    paddingVertical: 7,
    paddingHorizontal: 8,
    alignItems: 'flex-start',
    gap: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  summaryBadgeHead: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
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
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
  },
  summaryNumber: {
    fontSize: 21,
    fontWeight: '900',
    lineHeight: 21,
    color: '#0f172a',
  },
  summaryTopCard: {
    borderWidth: 1,
    borderColor: '#14354b',
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0d2436',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#082033',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  summaryTopGlowPrimary: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(36, 148, 232, 0.24)',
    top: -70,
    right: -30,
  },
  summaryTopGlowSecondary: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    bottom: -52,
    left: -28,
  },
  summaryTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  summaryTopRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  summaryTopIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(191, 219, 254, 0.25)',
  },
  summaryTopEyebrow: {
    color: '#98c7e8',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  summaryTopNumber: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 24,
  },
  summaryTopLabel: {
    color: '#f8fbff',
    fontSize: 12,
    fontWeight: '800',
  },
  summaryPercentWrap: {
    minWidth: 54,
    height: 25,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    flexDirection: 'row',
    gap: 5,
  },
  summaryPercentText: {
    fontWeight: '900',
    color: '#dff8e8',
    fontSize: 10,
  },
  planillaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 13,
    backgroundColor: '#0d4a8c',
    shadowColor: '#0b3b8c',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  planillaText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 11,
  },
});
