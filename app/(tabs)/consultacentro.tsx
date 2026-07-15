import React, { useContext, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../_layout';
import { fetchClientes, fetchCentrosPorCliente, fetchHistorialCentro } from '@/lib/api';
import { readCachedValue, writeCachedValue } from '@/lib/cache-store';

type Cliente = { id_cliente?: number; id?: number; nombre?: string; razon_social?: string };
type Centro = { id_centro?: number; id?: number; nombre?: string; cliente_id?: number; direccion?: string };
type CentroIndex = { id: number; nombre: string; clienteId: number; clienteNombre: string };

export default function ConsultaCentroScreen() {
  const { token } = useContext(AuthContext);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [centros, setCentros] = useState<Centro[]>([]);
  const [historial, setHistorial] = useState<any>(null);
  const [clienteSel, setClienteSel] = useState<number | null>(null);
  const [centroSel, setCentroSel] = useState<number | null>(null);
  const [consultaTab, setConsultaTab] = useState<'ip' | 'mantenciones' | 'datos'>('datos');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalCentrosVisible, setModalCentrosVisible] = useState(false);
  const [centroIndex, setCentroIndex] = useState<CentroIndex[]>([]);
  const [loadingIndex, setLoadingIndex] = useState(false);
  const clientesCacheKey = 'consulta_centro_v1_clientes';
  const centroIndexCacheKey = 'consulta_centro_v1_centro_index';
  const centrosClienteCacheKey = (clienteId: number | null | undefined) =>
    `consulta_centro_v1_centros_${Number(clienteId || 0) || 0}`;
  const historialCentroCacheKey = (centroId: number | null | undefined) =>
    `consulta_centro_v1_historial_${Number(centroId || 0) || 0}`;

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetchClientes()
      .then((rows) => {
        const data = Array.isArray(rows) ? rows : [];
        setClientes(data);
        writeCachedValue(clientesCacheKey, data).catch(() => {});
      })
      .catch(async () => {
        const cached = await readCachedValue<Cliente[]>(clientesCacheKey, []);
        if (Array.isArray(cached.value) && cached.value.length) {
          setClientes(cached.value);
          setError(null);
        } else {
          setError('No se pudieron cargar los clientes');
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!clienteSel) return;
    const cached = centroIndex
      .filter((c) => c.clienteId === clienteSel)
      .map((c) => ({ id_centro: c.id, nombre: c.nombre, cliente_id: c.clienteId }));
    if (cached.length) {
      setCentros(cached);
      return;
    }
    setLoading(true);
    fetchCentrosPorCliente(clienteSel)
      .then((rows) => {
        const data = Array.isArray(rows) ? rows : [];
        setCentros(data);
        writeCachedValue(centrosClienteCacheKey(clienteSel), data).catch(() => {});
      })
      .catch(async () => {
        const cachedCliente = await readCachedValue<Centro[]>(centrosClienteCacheKey(clienteSel), []);
        if (Array.isArray(cachedCliente.value) && cachedCliente.value.length) {
          setCentros(cachedCliente.value);
          setError(null);
        } else {
          setError('No se pudieron cargar los centros');
        }
      })
      .finally(() => setLoading(false));
  }, [clienteSel, centroIndex]);

  useEffect(() => {
    if (!token || !clientes.length || centroIndex.length) return;
    let mounted = true;
    setLoadingIndex(true);
    Promise.all(
      clientes.map(async (cl) => {
        const clienteId = Number(cl.id_cliente ?? cl.id ?? 0);
        if (!clienteId) return [];
        try {
          const lista = await fetchCentrosPorCliente(clienteId);
          const clienteNombre = cl.nombre || cl.razon_social || `Cliente ${clienteId}`;
          return (Array.isArray(lista) ? lista : []).map((ce: any) => ({
            id: Number(ce.id_centro ?? ce.id ?? 0),
            nombre: ce.nombre || `Centro ${ce.id}`,
            clienteId,
            clienteNombre,
          }));
        } catch {
          return [];
        }
      })
    )
      .then((groups) => {
        if (!mounted) return;
        const data = groups.flat().filter((x) => x.id && x.clienteId);
        setCentroIndex(data);
        writeCachedValue(centroIndexCacheKey, data).catch(() => {});
      })
      .catch(async () => {
        const cached = await readCachedValue<CentroIndex[]>(centroIndexCacheKey, []);
        if (!mounted) return;
        if (Array.isArray(cached.value) && cached.value.length) {
          setCentroIndex(cached.value);
        }
      })
      .finally(() => mounted && setLoadingIndex(false));
    return () => {
      mounted = false;
    };
  }, [token, clientes, centroIndex.length]);

  useEffect(() => {
    if (!centroSel) return;
    setLoading(true);
    fetchHistorialCentro(centroSel)
      .then((h) => {
        setHistorial(h || null);
        setError(null);
        writeCachedValue(historialCentroCacheKey(centroSel), h || null).catch(() => {});
      })
      .catch(async () => {
        const cached = await readCachedValue<any>(historialCentroCacheKey(centroSel), null);
        if (cached.value) {
          setHistorial(cached.value);
          setError(null);
        } else {
          const centroLocal =
            centros.find((x) => (x.id_centro ?? x.id) === centroSel) ||
            centroIndex.find((x) => x.id === centroSel) ||
            null;
          setHistorial(centroLocal ? { centro: centroLocal, equipos_ip: [], historial: {} } : null);
          setError(null);
        }
      })
      .finally(() => setLoading(false));
  }, [centroSel, centros, centroIndex]);

  const clienteNombre = useMemo(() => {
    const c = clientes.find((x) => (x.id_cliente ?? x.id) === clienteSel);
    return c?.nombre || c?.razon_social || 'Cliente';
  }, [clientes, clienteSel]);

  const centroNombre = useMemo(() => {
    const c = centros.find((x) => (x.id_centro ?? x.id) === centroSel);
    return c?.nombre || 'Centro';
  }, [centros, centroSel]);

  const norm = (v: any) =>
    String(v || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const clientesFiltrados = useMemo(() => {
    if (!search.trim()) return clientes;
    const q = norm(search);
    return clientes.filter((c) => norm(c.nombre || c.razon_social).includes(q));
  }, [clientes, search]);

  const centrosFiltrados = useMemo(() => {
    if (!search.trim()) return centros;
    const q = norm(search);
    return centros.filter((c) => norm(c.nombre).includes(q));
  }, [centros, search]);

  const centrosBusquedaGlobal = useMemo(() => {
    if (!search.trim()) return [];
    const q = norm(search);
    return centroIndex.filter((c) => norm(c.nombre).includes(q)).slice(0, 8);
  }, [centroIndex, search]);

  const ipsCentro = Array.isArray(historial?.equipos_ip) ? historial.equipos_ip : [];
  const datosCentro = historial?.centro || centros.find((x) => (x.id_centro ?? x.id) === centroSel) || null;
  const nombrePonton =
    datosCentro?.nombre_ponton ||
    datosCentro?.ponton_nombre ||
    datosCentro?.ponton ||
    'No especificado';
  const formatearFecha = (fecha?: string) => {
    if (!fecha) return '';
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return String(fecha);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };
  const timelineSections = useMemo(() => {
    const h = historial?.historial || {};
    return [
      { key: 'levantamientos', title: 'Levantamientos', icon: 'document-text-outline', items: Array.isArray(h.levantamientos) ? h.levantamientos : [], dateField: 'fecha_levantamiento' },
      { key: 'instalaciones', title: 'Instalaciones', icon: 'hammer-outline', items: Array.isArray(h.instalaciones) ? h.instalaciones : [], dateField: 'fecha_instalacion' },
      { key: 'mantenciones', title: 'Mantenciones', icon: 'build-outline', items: Array.isArray(h.mantenciones) ? h.mantenciones : [], dateField: 'fecha_mantencion' },
      { key: 'soportes', title: 'Soportes', icon: 'headset-outline', items: Array.isArray(h.soportes) ? h.soportes : [], dateField: 'fecha_soporte' },
      { key: 'retiros', title: 'Retiros', icon: 'archive-outline', items: Array.isArray(h.retiros) ? h.retiros : [], dateField: 'fecha_retiro' },
    ];
  }, [historial]);
  const estadoCentro = String(datosCentro?.estado || '').toLowerCase();
  const estadoIconColor =
    estadoCentro === 'activo' ? '#16a34a' : estadoCentro === 'cese' || estadoCentro === 'retiro' || estadoCentro === 'retirado' ? '#dc2626' : '#0b3b8c';
  const estadoTextStyle =
    estadoCentro === 'activo'
      ? { color: '#16a34a', fontWeight: '800' as const }
      : { color: '#64748b', fontWeight: '600' as const };

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View pointerEvents="none" style={styles.heroGlowPrimary} />
          <View pointerEvents="none" style={styles.heroGlowSecondary} />
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <Ionicons name="search-outline" size={20} color="#ffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Consulta de centro</Text>
              <Text style={styles.heroSubtitle}>Cliente, centro, IP e historial operativo</Text>
            </View>
            <View style={styles.heroBadge}>
              <Ionicons name="location-outline" size={14} color="#d8ffe7" />
            </View>
          </View>
          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaPill}>
              <Ionicons name="business-outline" size={12} color="#9fd7ff" />
              <Text style={styles.heroMetaText}>{clientes.length} clientes</Text>
            </View>
            <View style={styles.heroMetaPill}>
              <Ionicons name="pin-outline" size={12} color="#9fd7ff" />
              <Text style={styles.heroMetaText}>{centroIndex.length || centros.length} centros</Text>
            </View>
          </View>
        </View>

        {!token && <Text style={styles.alert}>Debes iniciar sesion.</Text>}
        {error && <Text style={styles.alert}>{error}</Text>}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitleLine}>BUSQUEDA RAPIDA</Text>
          <View style={styles.sectionLine} />
        </View>
        <View style={styles.card}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={16} color="#1d4ed8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar cliente o centro"
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={(text) => {
                setSearch(text);
                if (text.trim()) {
                  setCentroSel(null);
                  setHistorial(null);
                }
              }}
            />
            {!!search && (
              <Pressable onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color="#94a3b8" />
              </Pressable>
            )}
          </View>
        </View>

        {!!search.trim() && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitleLine}>RESULTADOS POR CENTRO</Text>
              <View style={styles.sectionLine} />
            </View>
            <View style={styles.card}>
              {loadingIndex ? <ActivityIndicator color="#0b3b8c" /> : null}
              {!loadingIndex && centrosBusquedaGlobal.map((c) => (
                <Pressable
                  key={`${c.clienteId}-${c.id}`}
                  style={styles.resultItem}
                  onPress={() => {
                    setClienteSel(c.clienteId);
                    setCentros(
                      centroIndex
                        .filter((x) => x.clienteId === c.clienteId)
                        .map((x) => ({ id_centro: x.id, nombre: x.nombre, cliente_id: x.clienteId }))
                    );
                    setCentroSel(c.id);
                    setConsultaTab('datos');
                  }}>
                  <Ionicons name="pin-outline" size={14} color="#1d4ed8" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultPrimary}>{c.nombre}</Text>
                    <Text style={styles.resultSecondary}>{c.clienteNombre}</Text>
                  </View>
                </Pressable>
              ))}
              {!loadingIndex && !centrosBusquedaGlobal.length && (
                <Text style={styles.muted}>Sin resultados por nombre de centro</Text>
              )}
            </View>
          </>
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitleLine}>CLIENTES</Text>
          <View style={styles.sectionLine} />
        </View>
        <View style={styles.card}>
          {loading && !clientes.length ? <ActivityIndicator color="#0b3b8c" /> : null}
          <View style={styles.pillRow}>
            {clientesFiltrados.map((c) => {
              const id = c.id_cliente ?? c.id;
              const active = id === clienteSel;
              return (
                <Pressable
                  key={id}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() => {
                    setClienteSel(id ?? null);
                    setCentroSel(null);
                    setHistorial(null);
                  }}>
                  <Ionicons name={active ? 'business' : 'business-outline'} size={13} color={active ? '#ffffff' : '#0b3b8c'} style={{ marginRight: 6 }} />
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{c.nombre || c.razon_social || `Cliente ${c.id}`}</Text>
                </Pressable>
              );
            })}
            {!clientesFiltrados.length && !loading && <Text style={styles.muted}>Sin resultados en clientes</Text>}
          </View>
        </View>

        {clienteSel ? (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitleLine}>CENTROS DE {clienteNombre}</Text>
              <View style={styles.sectionLine} />
            </View>
            <View style={styles.card}>
              {loading && !centrosFiltrados.length ? <ActivityIndicator color="#0b3b8c" /> : null}
              {centrosFiltrados.length ? (
                <Pressable style={styles.selectBox} onPress={() => setModalCentrosVisible(true)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Ionicons name="pin-outline" size={15} color="#0b3b8c" />
                    <Text style={styles.selectText}>{centroSel ? centroNombre : 'Selecciona un centro'}</Text>
                  </View>
                  <Ionicons name="chevron-down-outline" size={16} color="#0b3b8c" />
                </Pressable>
              ) : null}
              {!centrosFiltrados.length && !loading && <Text style={styles.muted}>Sin resultados en centros</Text>}
            </View>
          </>
        ) : null}

        {centroSel ? (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitleLine}>QUE QUIERES CONSULTAR</Text>
              <View style={styles.sectionLine} />
            </View>
            <View style={styles.queryTabs}>
              <Pressable style={[styles.queryTabBtn, consultaTab === 'ip' && styles.queryTabBtnActive]} onPress={() => setConsultaTab('ip')}>
                <Ionicons name="git-network-outline" size={14} color={consultaTab === 'ip' ? '#fff' : '#1d4ed8'} />
                <Text style={[styles.queryTabText, consultaTab === 'ip' && styles.queryTabTextActive]}>IP</Text>
              </Pressable>
              <Pressable style={[styles.queryTabBtn, consultaTab === 'mantenciones' && styles.queryTabBtnActive]} onPress={() => setConsultaTab('mantenciones')}>
                <Ionicons name="construct-outline" size={14} color={consultaTab === 'mantenciones' ? '#fff' : '#1d4ed8'} />
                <Text style={[styles.queryTabText, consultaTab === 'mantenciones' && styles.queryTabTextActive]}>Mantenciones</Text>
              </Pressable>
              <Pressable style={[styles.queryTabBtn, consultaTab === 'datos' && styles.queryTabBtnActive]} onPress={() => setConsultaTab('datos')}>
                <Ionicons name="business-outline" size={14} color={consultaTab === 'datos' ? '#fff' : '#1d4ed8'} />
                <Text style={[styles.queryTabText, consultaTab === 'datos' && styles.queryTabTextActive]}>Datos</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              {loading ? <ActivityIndicator color="#0b3b8c" /> : null}

              {!loading && consultaTab === 'datos' && (
                <>
                  <View style={styles.dataInfoCard}>
                    <View style={styles.itemRow}>
                      <View style={styles.itemIcon}><Ionicons name="business-outline" size={12} color="#0b3b8c" /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemPrimary, styles.itemPrimarySoft]}>Nombre</Text>
                        <Text style={[styles.itemSecondary, styles.centerNameValue]}>{datosCentro?.nombre || centroNombre}</Text>
                      </View>
                    </View>
                    <View style={styles.itemRow}>
                      <View style={styles.itemIcon}><Ionicons name="boat-outline" size={12} color="#0b3b8c" /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemPrimary, styles.itemPrimarySoft]}>Ponton</Text>
                        <Text style={[styles.itemSecondary, styles.itemValueStrong]}>{nombrePonton}</Text>
                      </View>
                    </View>
                    <View style={styles.itemRow}>
                      <View style={styles.itemIcon}><Ionicons name="checkmark-circle-outline" size={12} color={estadoIconColor} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemPrimary, styles.itemPrimarySoft]}>Estado</Text>
                        <Text style={[styles.itemSecondary, styles.itemValueStrong, estadoTextStyle]}>{datosCentro?.estado || 'Sin estado'}</Text>
                      </View>
                    </View>
                    <View style={styles.itemRow}>
                      <View style={styles.itemIcon}><Ionicons name="home-outline" size={12} color="#0b3b8c" /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemPrimary, styles.itemPrimarySoft]}>Base tierra</Text>
                        <Text style={[styles.itemSecondary, styles.itemValueStrong]}>{datosCentro?.base_tierra ? 'Si' : 'No'}</Text>
                      </View>
                    </View>
                    <View style={styles.itemRow}>
                      <View style={styles.itemIcon}><Ionicons name="location-outline" size={12} color="#dc2626" /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemPrimary, styles.itemPrimarySoft]}>Area / ubicacion</Text>
                        <Text style={[styles.itemSecondary, styles.itemValueStrong]}>{datosCentro?.ubicacion || datosCentro?.direccion || 'No registrada'}</Text>
                      </View>
                    </View>
                    <View style={styles.itemRow}>
                      <View style={styles.itemIcon}><Ionicons name="mail-outline" size={12} color="#0b3b8c" /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemPrimary, styles.itemPrimarySoft]}>Correo</Text>
                        <Text style={[styles.itemSecondary, styles.itemValueStrong]}>{datosCentro?.correo_centro || datosCentro?.correo || 'No especificado'}</Text>
                      </View>
                    </View>
                    <View style={styles.itemRow}>
                      <View style={styles.itemIcon}><Ionicons name="call-outline" size={12} color="#0b3b8c" /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemPrimary, styles.itemPrimarySoft]}>Telefono</Text>
                        <Text style={[styles.itemSecondary, styles.itemValueStrong]}>{datosCentro?.telefono || 'No especificado'}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.statsRow}>
                    <View style={[styles.statCard, { backgroundColor: '#dbeafe', borderColor: '#93c5fd' }]}>
                      <View style={[styles.statIcon, { backgroundColor: '#1d4ed8' }]}>
                        <Ionicons name="videocam-outline" size={14} color="#fff" />
                      </View>
                      <Text style={[styles.statNumber, { color: '#1d4ed8' }]}>{datosCentro?.cantidad_camaras ?? 0}</Text>
                      <Text style={styles.statLabel}>Camaras</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
                      <View style={[styles.statIcon, { backgroundColor: '#d97706' }]}>
                        <Ionicons name="radio-outline" size={14} color="#fff" />
                      </View>
                      <Text style={[styles.statNumber, { color: '#b45309' }]}>{datosCentro?.cantidad_radares ?? 0}</Text>
                      <Text style={styles.statLabel}>Radares</Text>
                    </View>
                  </View>
                </>
              )}

              {!loading && consultaTab === 'ip' && (
                ipsCentro.length ? (
                  ipsCentro.map((ip: any, idx: number) => {
                    const hasIp = !!String(ip.ip || '').trim();
                    return (
                    <View key={ip.id_equipo || idx} style={styles.itemRow}>
                      <View style={styles.itemIcon}><Ionicons name="hardware-chip-outline" size={12} color={hasIp ? '#0b3b8c' : '#6b7280'} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemPrimary}>{ip.nombre || 'Equipo'}</Text>
                        <View style={[styles.ipBadge, !hasIp && styles.ipBadgeEmpty]}>
                          <Ionicons name="git-network-outline" size={12} color="#ffffff" style={{ marginRight: 5 }} />
                          <Text style={styles.ipBadgeText}>{hasIp ? ip.ip : 'Sin IP'}</Text>
                        </View>
                      </View>
                    </View>
                  )})
                ) : (
                  <Text style={styles.muted}>Sin IP registradas para este centro.</Text>
                )
              )}

              {!loading && consultaTab === 'mantenciones' && (
                timelineSections.some((s) => s.items.length) ? (
                  timelineSections.map((section) => {
                    const isRetiro = section.key === 'retiros';
                    return (
                      <View key={section.key} style={[styles.timelineSection, isRetiro && styles.timelineSectionRetiro]}>
                        <View style={[styles.timelineHeader, isRetiro && styles.timelineHeaderRetiro]}>
                          <View style={[styles.timelineIcon, isRetiro && styles.timelineIconRetiro]}>
                            <Ionicons name={section.icon as any} size={13} color={isRetiro ? '#dc2626' : '#1d4ed8'} />
                          </View>
                          <Text style={[styles.timelineTitle, isRetiro && styles.timelineTitleRetiro]}>{section.title}</Text>
                          <Text style={[styles.timelineCount, isRetiro && styles.timelineCountRetiro]}>{section.items.length}</Text>
                        </View>
                        {section.items.length ? (
                          section.items.slice(0, 10).map((it: any, idx: number) => (
                            <View key={it.id || it.id_mantencion || idx} style={styles.timelineItem}>
                              <Text style={styles.timelineItemText}>
                                {it.descripcion || it.detalle || it.observacion || it.problema || 'Registro'}
                              </Text>
                              <View style={[styles.timelineDateBadge, isRetiro && styles.timelineDateBadgeRetiro]}>
                                <Ionicons name="calendar-outline" size={11} color={isRetiro ? '#dc2626' : '#1d4ed8'} style={{ marginRight: 4 }} />
                                <Text style={[styles.timelineItemDate, isRetiro && styles.timelineItemDateRetiro]}>
                                  {formatearFecha(it[section.dateField] || it.fecha || it.created_at)}
                                </Text>
                              </View>
                            </View>
                          ))
                        ) : (
                          <Text style={styles.timelineEmpty}>Sin registros</Text>
                        )}
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.muted}>Sin historial del centro.</Text>
                )
              )}
            </View>
          </>
        ) : null}
      </ScrollView>

      <Modal visible={modalCentrosVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Selecciona centro</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {centrosFiltrados.map((c) => {
                const id = c.id_centro ?? c.id ?? null;
                const active = id === centroSel;
                return (
                  <Pressable
                    key={id || c.nombre}
                    style={[styles.modalItem, active && styles.modalItemActive]}
                    onPress={() => {
                      setCentroSel(id);
                      setConsultaTab('datos');
                      setModalCentrosVisible(false);
                    }}>
                    <Ionicons name={active ? 'pin' : 'pin-outline'} size={14} color={active ? '#ffffff' : '#0b3b8c'} />
                    <Text style={[styles.modalItemText, active && styles.modalItemTextActive]}>{c.nombre || `Centro ${c.id}`}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable style={styles.modalCloseBtn} onPress={() => setModalCentrosVisible(false)}>
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#eef3f6' },
  scroll: { flex: 1, backgroundColor: '#eef3f6' },
  container: {
    flexGrow: 1,
    padding: 16,
    paddingTop: 12,
    paddingBottom: 18,
    gap: 12,
    backgroundColor: '#eef3f6',
  },
  hero: {
    backgroundColor: '#06141d',
    borderWidth: 1,
    borderColor: 'rgba(45, 165, 255, 0.14)',
    borderRadius: 22,
    padding: 16,
    shadowColor: '#06141d',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    overflow: 'hidden',
    position: 'relative',
    gap: 14,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: { fontSize: 20, fontWeight: '900', color: '#ffffff' },
  heroSubtitle: { fontSize: 12.5, color: '#98c7e8', marginTop: 2, fontWeight: '700' },
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
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
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
  heroMetaText: {
    color: '#f8fbff',
    fontWeight: '800',
    fontSize: 11,
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  sectionTitleLine: { color: '#7a8b98', fontWeight: '700', fontSize: 15 },
  sectionLine: { flex: 1, height: 1, backgroundColor: '#d8e3eb' },
  alert: {
    color: '#dc2626',
    fontWeight: '800',
    backgroundColor: '#fff7f7',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 10,
  },
  card: {
    backgroundColor: '#fbfdff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#d7e3ec',
    gap: 10,
    shadowColor: '#9db7ca',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#d4e0ea',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  searchInput: {
    flex: 1,
    color: '#163041',
    fontWeight: '800',
    paddingVertical: 0,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d4e0ea',
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
  },
  pillActive: { borderColor: '#0d4a8c', backgroundColor: '#0d4a8c' },
  pillText: { color: '#154766', fontWeight: '800' },
  pillTextActive: { color: '#ffffff' },
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d4e0ea',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  selectText: { color: '#154766', fontWeight: '800' },
  queryTabs: { flexDirection: 'row', gap: 8, marginTop: -2 },
  queryTabBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d4e0ea',
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  queryTabBtnActive: { backgroundColor: '#0d4a8c', borderColor: '#0d4a8c' },
  queryTabText: { color: '#164e9c', fontWeight: '800', fontSize: 12.5 },
  queryTabTextActive: { color: '#ffffff' },
  muted: { color: '#64748b', fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6,20,29,0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 20,
    backgroundColor: '#fbfdff',
    borderWidth: 1,
    borderColor: '#d7e3ec',
    padding: 16,
    gap: 10,
  },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#163041' },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d7e3ec',
    backgroundColor: '#ffffff',
    marginBottom: 8,
  },
  modalItemActive: { backgroundColor: '#0d4a8c', borderColor: '#0d4a8c' },
  modalItemText: { color: '#163041', fontWeight: '800' },
  modalItemTextActive: { color: '#ffffff' },
  modalCloseBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#e8eef3',
  },
  modalCloseText: { color: '#334155', fontWeight: '800' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  itemIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#eef6ff',
    borderWidth: 1,
    borderColor: '#d4e0ea',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  itemPrimary: { color: '#163041', fontWeight: '800' },
  itemPrimarySoft: { fontWeight: '800', color: '#708494', textTransform: 'uppercase', fontSize: 10.5 },
  itemSecondary: { color: '#64748b', fontSize: 12, marginTop: 2 },
  itemValueStrong: { color: '#163041', fontWeight: '800', fontSize: 13.5, marginTop: 1 },
  centerNameValue: { color: '#163041', fontWeight: '900', fontSize: 14.5, marginTop: 1 },
  dataInfoCard: {
    borderWidth: 1,
    borderColor: '#d7e3ec',
    borderRadius: 18,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    shadowColor: '#9db7ca',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  statIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statNumber: {
    fontSize: 26,
    lineHeight: 26,
    fontWeight: '900',
  },
  statLabel: {
    marginTop: 3,
    color: '#334155',
    fontWeight: '800',
    fontSize: 12,
  },
  timelineSection: {
    borderWidth: 1,
    borderColor: '#d7e3ec',
    borderRadius: 18,
    backgroundColor: '#ffffff',
    marginBottom: 10,
    overflow: 'hidden',
  },
  timelineSectionRetiro: {
    borderColor: '#fecaca',
    backgroundColor: '#fff7f7',
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#eef6ff',
    borderBottomWidth: 1,
    borderBottomColor: '#d7e3ec',
  },
  timelineHeaderRetiro: {
    backgroundColor: '#fee2e2',
    borderBottomColor: '#fecaca',
  },
  timelineIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineIconRetiro: {
    backgroundColor: '#fee2e2',
  },
  timelineTitle: {
    flex: 1,
    color: '#163041',
    fontWeight: '800',
    fontSize: 13,
  },
  timelineTitleRetiro: {
    color: '#991b1b',
  },
  timelineCount: {
    color: '#1d4ed8',
    fontWeight: '800',
    fontSize: 12,
  },
  timelineCountRetiro: {
    color: '#dc2626',
  },
  timelineItem: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  timelineItemText: {
    color: '#163041',
    fontWeight: '700',
    fontSize: 12.5,
  },
  timelineItemDate: {
    color: '#1d4ed8',
    fontSize: 11.5,
    fontWeight: '800',
  },
  timelineDateBadge: {
    marginTop: 5,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  timelineDateBadgeRetiro: {
    borderColor: '#fecaca',
    backgroundColor: '#fee2e2',
  },
  timelineItemDateRetiro: {
    color: '#dc2626',
  },
  timelineEmpty: {
    color: '#64748b',
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 12,
  },
  ipBadge: {
    marginTop: 4,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d4a8c',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#0d4a8c',
  },
  ipBadgeEmpty: {
    backgroundColor: '#94a3b8',
    borderColor: '#64748b',
  },
  ipBadgeText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.2,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  resultPrimary: {
    color: '#163041',
    fontWeight: '800',
  },
  resultSecondary: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
});
