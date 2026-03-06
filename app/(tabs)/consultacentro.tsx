import React, { useContext, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, StatusBar as RNStatusBar, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../_layout';
import { fetchClientes, fetchCentrosPorCliente, fetchHistorialCentro } from '@/lib/api';

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

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetchClientes()
      .then(setClientes)
      .catch(() => setError('No se pudieron cargar los clientes'))
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
      .then(setCentros)
      .catch(() => setError('No se pudieron cargar los centros'))
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
        setCentroIndex(groups.flat().filter((x) => x.id && x.clienteId));
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
      .then((h) => setHistorial(h || null))
      .catch(() => setError('No se pudo cargar el historial'))
      .finally(() => setLoading(false));
  }, [centroSel]);

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
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <Ionicons name="search-outline" size={20} color="#ffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Consulta de centro</Text>
              <Text style={styles.heroSubtitle}>Selecciona cliente y centro para ver detalles</Text>
            </View>
            <View style={styles.heroBadge}>
              <Ionicons name="location-outline" size={14} color="#0b3b8c" />
            </View>
          </View>
        </View>

        {!token && <Text style={styles.alert}>Debes iniciar sesion.</Text>}
        {error && <Text style={styles.alert}>{error}</Text>}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitleLine}>Busqueda rapida</Text>
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
              <Text style={styles.sectionTitleLine}>Resultados por centro</Text>
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
          <Text style={styles.sectionTitleLine}>Clientes</Text>
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
              <Text style={styles.sectionTitleLine}>Centros de {clienteNombre}</Text>
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
              <Text style={styles.sectionTitleLine}>Que quieres consultar</Text>
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
  safe: { flex: 1, backgroundColor: '#ffffff' },
  container: {
    padding: 16,
    paddingTop: (RNStatusBar.currentHeight || 24) + 12,
    gap: 12,
    backgroundColor: '#ffffff',
  },
  hero: {
    backgroundColor: '#1d4ed8',
    borderWidth: 1,
    borderColor: '#1e40af',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#0b3b8c',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: { fontSize: 18, fontWeight: '800', color: '#ffffff' },
  heroSubtitle: { fontSize: 13, color: '#dbeafe', marginTop: 2 },
  heroBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  sectionTitleLine: { color: '#0f172a', fontWeight: '900', fontSize: 16 },
  sectionLine: { flex: 1, height: 1, backgroundColor: '#d1d5db' },
  alert: { color: '#dc2626', fontWeight: '600' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
    shadowColor: '#0f172a',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    color: '#0f172a',
    fontWeight: '600',
    paddingVertical: 0,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    flexDirection: 'row',
    alignItems: 'center',
  },
  pillActive: { borderColor: '#1d4ed8', backgroundColor: '#1d4ed8' },
  pillText: { color: '#0b3b8c', fontWeight: '700' },
  pillTextActive: { color: '#ffffff' },
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  selectText: { color: '#0b3b8c', fontWeight: '700' },
  queryTabs: { flexDirection: 'row', gap: 8, marginTop: -2 },
  queryTabBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  queryTabBtnActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  queryTabText: { color: '#1d4ed8', fontWeight: '700', fontSize: 12.5 },
  queryTabTextActive: { color: '#ffffff' },
  muted: { color: '#64748b' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    padding: 14,
    gap: 10,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  modalItemActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  modalItemText: { color: '#0f172a', fontWeight: '700' },
  modalItemTextActive: { color: '#ffffff' },
  modalCloseBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
  modalCloseText: { color: '#334155', fontWeight: '700' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  itemIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#e0ecff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  itemPrimary: { color: '#0f172a', fontWeight: '700' },
  itemPrimarySoft: { fontWeight: '500', color: '#64748b' },
  itemSecondary: { color: '#64748b', fontSize: 12, marginTop: 2 },
  itemValueStrong: { color: '#0f172a', fontWeight: '800', fontSize: 13.5, marginTop: 1 },
  centerNameValue: { color: '#0f172a', fontWeight: '900', fontSize: 14, marginTop: 1 },
  dataInfoCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
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
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
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
    fontWeight: '700',
    fontSize: 12,
  },
  timelineSection: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
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
    backgroundColor: '#eff6ff',
    borderBottomWidth: 1,
    borderBottomColor: '#dbeafe',
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
    color: '#0f172a',
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
    color: '#0f172a',
    fontWeight: '600',
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
    backgroundColor: '#1d4ed8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#1e40af',
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
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  resultPrimary: {
    color: '#0f172a',
    fontWeight: '700',
  },
  resultSecondary: {
    color: '#64748b',
    fontSize: 12,
  },
});
