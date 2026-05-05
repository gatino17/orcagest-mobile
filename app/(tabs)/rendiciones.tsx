import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { ThemedText } from '@/components/themed-text';
import { AuthContext } from '../_layout';
import {
  createRendicion,
  enviarRendicion,
  fetchAbonosRendicion,
  fetchActasEntrega,
  fetchActividades,
  fetchActividadesMias,
  fetchClientes,
  fetchCentrosPorCliente,
  fetchMantencionesTerreno,
  fetchPermisosTrabajo,
  fetchRetirosTerreno,
  fetchRendiciones,
  fetchSaldosRendicion,
} from '@/lib/api';

type RendicionLinea = {
  fecha: string;
  documento: string;
  descripcion: string;
  valor: string;
  foto?: string;
};

const hoyStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const money = (v: any) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(v || 0));

const normalizeText = (value: any) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const matchTecnicoNombre = (candidate: any, currentName: any) => {
  const a = normalizeText(candidate);
  const b = normalizeText(currentName);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const ta = a.split(/\s+/).filter(Boolean);
  const tb = b.split(/\s+/).filter(Boolean);
  if (!ta.length || !tb.length) return false;
  const commons = ta.filter((t) => tb.includes(t));
  return commons.length >= 2 || (commons.length >= 1 && (ta.length === 1 || tb.length === 1));
};

const parseFirmasAdicionales = (raw: any) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const extraerTecnicos = (item: any) => {
  const base = [item?.tecnico_1, item?.tecnico_2]
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  const asignadosActividad = Array.isArray(item?.tecnicos_asignados)
    ? item.tecnicos_asignados
        .map((t: any) => String(t?.nombre_encargado || t?.nombre || '').trim())
        .filter(Boolean)
    : [];
  const firmasAdicionales = parseFirmasAdicionales(item?.firmas_tecnicos_adicionales)
    .map((x: any) => String(x?.nombre || '').trim())
    .filter(Boolean);
  return Array.from(new Set([...base, ...asignadosActividad, ...firmasAdicionales]));
};

export default function RendicionesScreen() {
  const { userId, name } = useContext(AuthContext);

  const [clientes, setClientes] = useState<any[]>([]);
  const [actividadesAsociadas, setActividadesAsociadas] = useState<any[]>([]);
  const [loadingActividades, setLoadingActividades] = useState(false);
  const [rendiciones, setRendiciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [saldosTecnicos, setSaldosTecnicos] = useState<any[]>([]);
  const [abonosTecnico, setAbonosTecnico] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);

  const [filtroClienteId, setFiltroClienteId] = useState('');
  const [filtroCentroId, setFiltroCentroId] = useState('');
  const [centrosFiltro, setCentrosFiltro] = useState<any[]>([]);

  const [formClienteId, setFormClienteId] = useState('');
  const [formCentroId, setFormCentroId] = useState('');
  const [centrosForm, setCentrosForm] = useState<any[]>([]);
  const [actividadTipo, setActividadTipo] = useState('mantencion');
  const [fechaGasto, setFechaGasto] = useState(hoyStr());
  const [tec1Nombre, setTec1Nombre] = useState('');
  const [tecnicosAsociados, setTecnicosAsociados] = useState<string[]>([]);
  const [totalRendir, setTotalRendir] = useState('');
  const [actividadesTexto, setActividadesTexto] = useState('');
  const [lineasRendicion, setLineasRendicion] = useState<RendicionLinea[]>([
    { fecha: hoyStr(), documento: '', descripcion: '', valor: '', foto: '' },
  ]);

  const [showCamera, setShowCamera] = useState(false);
  const [lineaFotoActivaIdx, setLineaFotoActivaIdx] = useState<number | null>(null);
  const [showTrabajosExtraModal, setShowTrabajosExtraModal] = useState(false);
  const [selectedTrabajoId, setSelectedTrabajoId] = useState<string>('');
  const [trabajoBloqueado, setTrabajoBloqueado] = useState(false);
  const [trabajosExtraIds, setTrabajosExtraIds] = useState<string[]>([]);
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('back');
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const cargarClientes = useCallback(async () => {
    try {
      const data = await fetchClientes();
      setClientes(Array.isArray(data) ? data : []);
    } catch {
      setClientes([]);
    }
  }, []);

  const tipoTrabajoTexto = (areaRaw?: string, nombreRaw?: string) => {
    const area = String(areaRaw || '').trim().toLowerCase();
    const nombre = String(nombreRaw || '').trim().toLowerCase();
    if (area.startsWith('reap') || nombre.includes('reap')) return 'instalacion';
    if (area.startsWith('instal') || nombre.includes('instal')) return 'instalacion';
    if (area.startsWith('manten') || nombre.includes('manten')) return 'mantencion';
    if (area.startsWith('retir') || nombre.includes('retir')) return 'retiro';
    return '';
  };
  const normalizarTipoActividad = (raw?: string) => {
    const v = String(raw || '').trim().toLowerCase();
    if (!v) return '';
    if (v.startsWith('reap')) return 'instalacion';
    if (v.startsWith('instal')) return 'instalacion';
    if (v.startsWith('manten')) return 'mantencion';
    if (v.startsWith('retir')) return 'retiro';
    return v;
  };
  const tipoInstalacionLabel = (item: any) => {
    const area = String(item?.area || '').toLowerCase();
    const nombre = String(item?.nombre_actividad || '').toLowerCase();
    if (area.includes('reap') || nombre.includes('reap')) return 'Reapuntamiento';
    return 'Instalacion';
  };

  const incluyeTecnico = (item: any) => {
    const myName = name;
    if (!myName) return false;
    const baseNames = [item?.tecnico_1, item?.tecnico_2]
      .map((v) => String(v || '').trim())
      .filter(Boolean);
    const adicionales = Array.isArray(item?.firmas_tecnicos_adicionales)
      ? item.firmas_tecnicos_adicionales
          .map((x: any) => String(x?.nombre || '').trim())
          .filter(Boolean)
      : [];
    return [...baseNames, ...adicionales].some((n) => matchTecnicoNombre(n, myName));
  };

  const cargarActividadesAsociadas = useCallback(async () => {
    if (!userId) return;
    setLoadingActividades(true);
    try {
      const filtrarUtiles = (items: any[]) =>
        (Array.isArray(items) ? items : [])
          .filter((item) => {
            const tipo = tipoTrabajoTexto(item?.area, item?.nombre_actividad);
            return tipo === 'instalacion' || tipo === 'mantencion' || tipo === 'retiro';
          })
          .sort((a, b) => {
            const da = new Date(a?.fecha_inicio || a?.created_at || 0).getTime();
            const dbv = new Date(b?.fecha_inicio || b?.created_at || 0).getTime();
            return dbv - da;
          });

      let lista = filtrarUtiles(await fetchActividadesMias());
      if (!lista.length) {
        const all = filtrarUtiles(await fetchActividades());
        lista = all.filter((item: any) => {
          const principalId = Number(item?.encargado_principal?.id_encargado || item?.tecnico_encargado || 0) || 0;
          const ayudanteId = Number(item?.encargado_ayudante?.id_encargado || item?.tecnico_ayudante || 0) || 0;
          const names = [
            item?.encargado_principal?.nombre_encargado,
            item?.encargado_ayudante?.nombre_encargado,
            ...(Array.isArray(item?.tecnicos_asignados) ? item.tecnicos_asignados.map((t: any) => t?.nombre_encargado) : []),
          ].map((v) => String(v || '').trim()).filter(Boolean);
          const myName = String(name || '').trim();
          return (
            principalId === Number(userId || 0) ||
            ayudanteId === Number(userId || 0) ||
            (!!myName && names.some((n) => matchTecnicoNombre(n, myName)))
          );
        });
      }

      const [actas, mantenciones, retiros, permisos] = await Promise.all([
        fetchActasEntrega().catch(() => []),
        fetchMantencionesTerreno().catch(() => []),
        fetchRetirosTerreno().catch(() => []),
        fetchPermisosTrabajo().catch(() => []),
      ]);

      const actasRaw = Array.isArray(actas) ? actas : [];
      const mantRaw = Array.isArray(mantenciones) ? mantenciones : [];
      const retRaw = Array.isArray(retiros) ? retiros : [];
      const permisosRaw = Array.isArray(permisos) ? permisos : [];
      const permisoPorActa = new Map<number, boolean>();
      const permisoPorMantencion = new Map<number, boolean>();
      const permisoPorRetiro = new Map<number, boolean>();
      permisosRaw.forEach((p: any) => {
        const actaId = Number(p?.acta_entrega_id || 0) || 0;
        if (actaId > 0) permisoPorActa.set(actaId, true);
        const mantId = Number(p?.mantencion_terreno_id || 0) || 0;
        if (mantId > 0) permisoPorMantencion.set(mantId, true);
        const retId = Number(p?.retiro_terreno_id || 0) || 0;
        if (retId > 0) permisoPorRetiro.set(retId, true);
      });

      const actasFiltradas = actasRaw.filter((x: any) => incluyeTecnico(x));
      const mantFiltradas = mantRaw.filter((x: any) => incluyeTecnico(x));
      const retFiltradas = retRaw.filter((x: any) => incluyeTecnico(x));

      const trabajosActa = (actasFiltradas.length ? actasFiltradas : actasRaw)
        .slice(0, 80)
        .map((x: any) => ({
          id_actividad: `acta-${x.id_acta_entrega}`,
          record_id: Number(x.id_acta_entrega || 0) || null,
          area: String(x.tipo_instalacion || 'instalacion'),
          nombre_actividad: `Acta ${x.tipo_instalacion || 'instalacion'}`,
          centro: {
            id_centro: Number(x.centro_id || 0) || null,
            nombre: x.centro || '',
            cliente: x.cliente || x.empresa || '',
          },
          fecha_inicio: x.fecha_registro || x.created_at,
          fuente: 'acta',
          paso_acta: true,
          paso_permiso: !!permisoPorActa.get(Number(x.id_acta_entrega || 0) || 0),
          paso_armado: Number(x.armado_id || 0) > 0,
          tecnicos_asociados: extraerTecnicos(x),
        }));

      const trabajosMant = (mantFiltradas.length ? mantFiltradas : mantRaw)
        .slice(0, 80)
        .map((x: any) => ({
          id_actividad: `mant-${x.id_mantencion_terreno}`,
          record_id: Number(x.id_mantencion_terreno || 0) || null,
          area: 'mantencion',
          nombre_actividad: 'Mantencion',
          centro: {
            id_centro: Number(x.centro_id || 0) || null,
            nombre: x.centro || '',
            cliente: x.cliente || x.empresa || '',
          },
          fecha_inicio: x.fecha_ingreso || x.created_at,
          fuente: 'mantencion',
          paso_informe: true,
          paso_permiso: !!permisoPorMantencion.get(Number(x.id_mantencion_terreno || 0) || 0),
          paso_checklist: !!String(x.checklist_equipos || '').trim(),
          tecnicos_asociados: extraerTecnicos(x),
        }));

      const trabajosRet = (retFiltradas.length ? retFiltradas : retRaw)
        .slice(0, 80)
        .map((x: any) => ({
          id_actividad: `ret-${x.id_retiro_terreno}`,
          record_id: Number(x.id_retiro_terreno || 0) || null,
          area: 'retiro',
          nombre_actividad: `Retiro ${x.tipo_retiro || ''}`.trim(),
          centro: {
            id_centro: Number(x.centro_id || 0) || null,
            nombre: x.centro || '',
            cliente: x.cliente || x.empresa || '',
          },
          fecha_inicio: x.fecha_retiro || x.created_at,
          fuente: 'retiro',
          paso_informe: true,
          paso_permiso: !!permisoPorRetiro.get(Number(x.id_retiro_terreno || 0) || 0),
          paso_checklist: !!String(x.checklist_equipos || '').trim(),
          tecnicos_asociados: extraerTecnicos(x),
        }));

      // Para rendiciones contamos trabajos "ejecutados" (informes), no actividades de calendario,
      // para evitar duplicados de la misma gestion.
      const allTrabajos = [...trabajosActa, ...trabajosMant, ...trabajosRet].sort((a: any, b: any) => {
        const da = new Date(a?.fecha_inicio || a?.created_at || 0).getTime();
        const dbv = new Date(b?.fecha_inicio || b?.created_at || 0).getTime();
        return dbv - da;
      });
      setActividadesAsociadas(allTrabajos);
    } catch {
      setActividadesAsociadas([]);
    } finally {
      setLoadingActividades(false);
    }
  }, [userId, name]);

  const cargarCentros = useCallback(async (clienteId: string, target: 'filtro' | 'form') => {
    if (!clienteId) {
      if (target === 'filtro') setCentrosFiltro([]);
      else setCentrosForm([]);
      return;
    }
    try {
      const data = await fetchCentrosPorCliente(Number(clienteId));
      if (target === 'filtro') setCentrosFiltro(Array.isArray(data) ? data : []);
      else setCentrosForm(Array.isArray(data) ? data : []);
    } catch {
      if (target === 'filtro') setCentrosFiltro([]);
      else setCentrosForm([]);
    }
  }, []);

  const cargarRendiciones = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await fetchRendiciones({ tecnico_user_id: userId, top: 150 });
      setRendiciones(Array.isArray(data) ? data : []);
    } catch {
      setRendiciones([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const cargarSaldos = useCallback(async () => {
    if (!userId && !name) return;
    try {
      const data = await fetchSaldosRendicion({ top: 1000 });
      const all = Array.isArray(data) ? data : [];
      const filtrados = all.filter((s: any) => {
        const idMatch = Number(s?.tecnico_user_id || 0) > 0 && Number(s?.tecnico_user_id || 0) === Number(userId || 0);
        const nombreMatch = matchTecnicoNombre(s?.tecnico_nombre, name);
        return idMatch || nombreMatch;
      });
      setSaldosTecnicos(filtrados.length ? filtrados : all);
    } catch {
      setSaldosTecnicos([]);
    }
  }, [userId, name]);

  const cargarAbonos = useCallback(async () => {
    if (!userId && !name) return;
    try {
      const data = await fetchAbonosRendicion({ top: 1000 });
      const all = Array.isArray(data) ? data : [];
      const filtrados = all.filter((a: any) => {
        const idMatch = Number(a?.tecnico_user_id || 0) > 0 && Number(a?.tecnico_user_id || 0) === Number(userId || 0);
        const nombreMatch = matchTecnicoNombre(a?.tecnico_nombre, name);
        return idMatch || nombreMatch;
      });
      setAbonosTecnico(filtrados);
    } catch {
      setAbonosTecnico([]);
    }
  }, [userId, name]);

  useEffect(() => {
    cargarClientes();
    cargarRendiciones();
    cargarSaldos();
    cargarAbonos();
    cargarActividadesAsociadas();
  }, [cargarClientes, cargarRendiciones, cargarSaldos, cargarAbonos, cargarActividadesAsociadas]);

  useEffect(() => {
    cargarCentros(filtroClienteId, 'filtro');
    setFiltroCentroId('');
  }, [filtroClienteId, cargarCentros]);

  useEffect(() => {
    cargarCentros(formClienteId, 'form');
    setFormCentroId('');
  }, [formClienteId, cargarCentros]);

  const trabajoSeleccionado = useMemo(
    () => actividadesAsociadas.find((a: any) => String(a?.id_actividad || '') === String(selectedTrabajoId || '')) || null,
    [actividadesAsociadas, selectedTrabajoId]
  );

  useEffect(() => {
    if (!trabajoSeleccionado) return;
    const centroId = Number(trabajoSeleccionado?.centro?.id_centro || trabajoSeleccionado?.centro_id || 0) || 0;
    const clienteIdDirecto = Number(trabajoSeleccionado?.centro?.cliente_id || trabajoSeleccionado?.cliente_id || 0) || 0;
    const clienteNombreTrabajo = String(trabajoSeleccionado?.centro?.cliente || trabajoSeleccionado?.cliente || '').trim().toLowerCase();
    let clienteFinal = clienteIdDirecto;
    if (!clienteFinal && clienteNombreTrabajo) {
      const clienteMatch = clientes.find(
        (c: any) =>
          String(c?.nombre || '')
            .trim()
            .toLowerCase() === clienteNombreTrabajo
      );
      clienteFinal = Number(clienteMatch?.id_cliente || 0) || 0;
    }
    if (clienteFinal > 0) setFormClienteId(String(clienteFinal));
    if (centroId > 0) setFormCentroId(String(centroId));
    const tipo = tipoTrabajoTexto(trabajoSeleccionado?.area, trabajoSeleccionado?.nombre_actividad);
    if (tipo) setActividadTipo(tipo);
    const listaTec = Array.isArray(trabajoSeleccionado?.tecnicos_asociados) ? trabajoSeleccionado.tecnicos_asociados : [];
    setTecnicosAsociados(listaTec);
    if (listaTec.length) {
      setTec1Nombre(String(listaTec[0] || ''));
    } else {
      setTec1Nombre(String(name || ''));
    }
  }, [trabajoSeleccionado, clientes, name]);

  const totalMes = useMemo(() => {
    const ym = hoyStr().slice(0, 7);
    return rendiciones
      .filter((r) => String(r?.fecha_gasto || '').startsWith(ym))
      .reduce((acc, r) => acc + Number(r?.monto || 0), 0);
  }, [rendiciones]);

  const totalAbonosMes = useMemo(() => {
    const ym = hoyStr().slice(0, 7);
    return (Array.isArray(abonosTecnico) ? abonosTecnico : [])
      .filter((a: any) => String(a?.fecha_abono || '').startsWith(ym))
      .reduce((acc: number, a: any) => acc + Number(a?.monto || 0), 0);
  }, [abonosTecnico]);

  const saldoTecnicoActual = useMemo(() => {
    // Saldo operativo del mes = abono del mes - gasto del mes.
    return Number(totalAbonosMes || 0) - Number(totalMes || 0);
  }, [totalAbonosMes, totalMes]);

  const trabajosPendientesRendicion = useMemo(() => {
    const rendidos = new Set(
      (Array.isArray(rendiciones) ? rendiciones : [])
        .map((r: any) => `${normalizarTipoActividad(r?.actividad_tipo)}-${Number(r?.actividad_id || 0) || 0}`)
    );

    const dedup = new Map<string, any>();
    (Array.isArray(actividadesAsociadas) ? actividadesAsociadas : []).forEach((t: any) => {
      const tipo = normalizarTipoActividad(tipoTrabajoTexto(t?.area, t?.nombre_actividad) || t?.area);
      const id = Number(t?.record_id || t?.id_actividad || 0) || 0;
      if (!tipo || !id) return;
      const key = `${tipo}-${id}`;
      if (!dedup.has(key)) dedup.set(key, t);
    });

    const pendientes = Array.from(dedup.entries())
      .filter(([key]) => !rendidos.has(key))
      .map(([, value]) => value);

    return {
      all: pendientes,
      instalacion: pendientes.filter((t: any) => normalizarTipoActividad(tipoTrabajoTexto(t?.area, t?.nombre_actividad) || t?.area) === 'instalacion'),
      mantencion: pendientes.filter((t: any) => normalizarTipoActividad(tipoTrabajoTexto(t?.area, t?.nombre_actividad) || t?.area) === 'mantencion'),
      retiro: pendientes.filter((t: any) => normalizarTipoActividad(tipoTrabajoTexto(t?.area, t?.nombre_actividad) || t?.area) === 'retiro'),
    };
  }, [rendiciones, actividadesAsociadas]);

  const rendicionesPorTrabajo = useMemo(() => {
    const s = new Set<string>();
    (Array.isArray(rendiciones) ? rendiciones : []).forEach((r: any) => {
      const tipo = normalizarTipoActividad(r?.actividad_tipo);
      const id = Number(r?.actividad_id || 0) || 0;
      if (tipo && id) s.add(`${tipo}-${id}`);
    });
    return s;
  }, [rendiciones]);

  const rendicionesCompletadasRecientes = useMemo(() => {
    return (Array.isArray(rendiciones) ? rendiciones : [])
      .filter((r: any) => String(r?.estado || '').toLowerCase() === 'enviado')
      .sort((a: any, b: any) => {
        const da = new Date(a?.fecha_gasto || a?.created_at || 0).getTime();
        const dbv = new Date(b?.fecha_gasto || b?.created_at || 0).getTime();
        return dbv - da;
      })
      .slice(0, 10);
  }, [rendiciones]);

  const estaRendidoTrabajo = useCallback(
    (t: any) => {
      const tipo = normalizarTipoActividad(tipoTrabajoTexto(t?.area, t?.nombre_actividad) || t?.area);
      const id = Number(t?.record_id || t?.id_actividad || 0) || 0;
      if (!tipo || !id) return false;
      return rendicionesPorTrabajo.has(`${tipo}-${id}`);
    },
    [rendicionesPorTrabajo]
  );

  const abrirRendicionTrabajo = useCallback((t: any) => {
    const id = String(t?.id_actividad || '');
    if (!id) return;
    setSelectedTrabajoId(id);
    setTrabajoBloqueado(true);
    setTrabajosExtraIds([]);
    setShowTrabajosExtraModal(false);
    setShowForm(true);
  }, []);

  const toggleTrabajoExtra = (id: string) => {
    setTrabajosExtraIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const rendicionesFiltradas = useMemo(() => {
    return rendiciones.filter((r) => {
      if (filtroClienteId && Number(r?.cliente_id || 0) !== Number(filtroClienteId)) return false;
      if (filtroCentroId && Number(r?.centro_id || 0) !== Number(filtroCentroId)) return false;
      return true;
    });
  }, [rendiciones, filtroClienteId, filtroCentroId]);

  const limpiarFormulario = () => {
    setSelectedTrabajoId('');
    setTrabajoBloqueado(false);
    setTrabajosExtraIds([]);
    setFormClienteId('');
    setFormCentroId('');
    setActividadTipo('mantencion');
    setFechaGasto(hoyStr());
    setTec1Nombre(String(name || ''));
    setTotalRendir(String(saldoTecnicoActual || 0));
    setActividadesTexto('');
    setLineasRendicion([{ fecha: hoyStr(), documento: '', descripcion: '', valor: '', foto: '' }]);
    setShowTrabajosExtraModal(false);
    setLineaFotoActivaIdx(null);
  };

  useEffect(() => {
    if (showForm && !tec1Nombre) {
      setTec1Nombre(String(name || ''));
    }
  }, [showForm, name, tec1Nombre]);

  useEffect(() => {
    if (!showForm) return;
    setTotalRendir(String(saldoTecnicoActual || 0));
  }, [showForm, saldoTecnicoActual]);

  const totalGastos = useMemo(
    () =>
      lineasRendicion.reduce((acc, l) => {
        const v = Number(String(l?.valor || '').replace(',', '.'));
        return acc + (Number.isFinite(v) ? v : 0);
      }, 0),
    [lineasRendicion]
  );

  const saldoRendicion = useMemo(() => {
    const total = Number(String(totalRendir || '').replace(',', '.')) || 0;
    return total - totalGastos;
  }, [totalRendir, totalGastos]);

  const actualizarLinea = (idx: number, key: keyof RendicionLinea, value: string) => {
    setLineasRendicion((prev) => prev.map((l, i) => (i === idx ? { ...l, [key]: value } : l)));
  };

  const agregarLinea = () => {
    setLineasRendicion((prev) => [...prev, { fecha: fechaGasto || hoyStr(), documento: '', descripcion: '', valor: '', foto: '' }]);
  };

  const quitarLinea = (idx: number) => {
    setLineasRendicion((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const validar = () => {
    if (!selectedTrabajoId) return 'Selecciona un trabajo asociado.';
    if (!formCentroId) return 'Selecciona centro.';
    const lineasValidas = lineasRendicion.filter((l) => l.descripcion.trim() && (Number(l.valor || 0) > 0));
    if (!lineasValidas.length) return 'Agrega al menos una linea de gasto valida.';
    return '';
  };

  const guardar = async (estado: 'borrador' | 'enviado') => {
    const error = validar();
    if (error) {
      Alert.alert('Rendiciones', error);
      return;
    }
    if (estado === 'enviado' && saldoRendicion < 0) {
      Alert.alert('Rendiciones', 'El gasto supera el saldo abonado del tecnico. Revisa antes de enviar.');
      return;
    }
    setGuardando(true);
    try {
      const payload = {
        tecnico_user_id: userId,
        tecnico_nombre: tec1Nombre || name || '',
        cliente_id: formClienteId ? Number(formClienteId) : null,
        centro_id: Number(formCentroId),
        actividad_tipo: actividadTipo,
        actividad_id: Number(trabajoSeleccionado?.record_id || 0) || null,
        categoria: 'rendicion_gastos',
        medio_pago: null,
        fecha_gasto: fechaGasto,
        monto: Number(totalGastos || 0),
        descripcion: [
          `Rendido por: ${tec1Nombre || name || '-'}`,
          `Tecnicos asociados: ${tecnicosAsociados.length ? tecnicosAsociados.join(', ') : tec1Nombre || name || '-'}`,
          `Tecnicos asociados JSON: ${JSON.stringify(tecnicosAsociados.length ? tecnicosAsociados : [tec1Nombre || name || ''])}`,
          `Total a rendir: ${totalRendir || 0}`,
          `Total gastos: ${totalGastos}`,
          `Saldo: ${saldoRendicion}`,
          `Actividades: ${actividadesTexto || '-'}`,
          `Trabajos compartidos: ${trabajosExtraIds.length ? trabajosExtraIds.join(', ') : 'ninguno'}`,
          'Detalle:',
          ...lineasRendicion.map(
            (l) => `${l.fecha || '-'} | Doc:${l.documento || '-'} | ${l.descripcion || '-'} | ${l.valor || 0}`
          ),
        ].join('\n'),
        adjuntos: lineasRendicion
          .map((l) => l.foto || '')
          .filter(Boolean),
        estado,
      };
      const resp = await createRendicion(payload);
      const id = resp?.rendicion?.id_rendicion;
      if (estado === 'enviado' && id) await enviarRendicion(id);
      Alert.alert('Rendiciones', estado === 'enviado' ? 'Rendicion enviada.' : 'Rendicion guardada.');
      limpiarFormulario();
      setShowForm(false);
      await cargarRendiciones();
      await cargarSaldos();
      await cargarAbonos();
    } catch {
      Alert.alert('Rendiciones', 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  };

  const abrirCamaraLinea = async (idx: number) => {
    if (!cameraPermission?.granted) {
      const ask = await requestCameraPermission();
      if (!ask?.granted) {
        Alert.alert('Rendiciones', 'Necesitas permiso de camara.');
        return;
      }
    }
    setLineaFotoActivaIdx(idx);
    setShowCamera(true);
  };

  const tomarFoto = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ base64: true, quality: 0.45 });
      const data = photo?.base64 ? `data:image/jpeg;base64,${photo.base64}` : '';
      if (!data) return;
      if (lineaFotoActivaIdx !== null) {
        setLineasRendicion((prev) => prev.map((l, i) => (i === lineaFotoActivaIdx ? { ...l, foto: data } : l)));
      }
      setLineaFotoActivaIdx(null);
      setShowCamera(false);
    } catch {
      Alert.alert('Rendiciones', 'No se pudo tomar la foto.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <ThemedText style={styles.title}>Rendiciones</ThemedText>
            <ThemedText style={styles.subtitle}>Registro de gastos por tecnico</ThemedText>
          </View>
          <View style={styles.kpiGroup}>
            <View style={styles.kpiChip}>
              <ThemedText style={styles.kpiLabel}>Mes gastos</ThemedText>
              <ThemedText style={styles.kpiValue}>{money(totalMes)}</ThemedText>
            </View>
            <View style={styles.kpiChipAbono}>
              <ThemedText style={styles.kpiLabelAbono}>Abono del mes</ThemedText>
              <ThemedText style={styles.kpiValueAbono}>{money(totalAbonosMes)}</ThemedText>
            </View>
            <View style={styles.kpiChipSaldo}>
              <ThemedText style={styles.kpiLabelSaldo}>Saldo tecnico</ThemedText>
              <ThemedText style={styles.kpiValueSaldo}>{money(saldoTecnicoActual)}</ThemedText>
            </View>
          </View>
        </View>
        <View style={[styles.pendingCard, styles.pendingJobsCard]}>
          <View style={styles.pendingJobsHeader}>
            <View style={styles.pendingJobsTitleWrap}>
              <Ionicons name="document-text-outline" size={16} color="#0f3a8c" />
            <ThemedText style={styles.pendingJobsTitle}>Pendiente de rendicion</ThemedText>
          </View>
            <ThemedText style={styles.pendingJobsCount}>{trabajosPendientesRendicion.all.length}</ThemedText>
          </View>
          <View style={styles.pendingByTypeCards}>
            <View style={[styles.pendingTypeCard, styles.pendingTypeCardInst]}>
              <ThemedText style={styles.pendingTypeLabel}>Instalacion</ThemedText>
              <ThemedText style={styles.pendingTypeValue}>{trabajosPendientesRendicion.instalacion.length}</ThemedText>
            </View>
            <View style={[styles.pendingTypeCard, styles.pendingTypeCardMant]}>
              <ThemedText style={styles.pendingTypeLabel}>Mantencion</ThemedText>
              <ThemedText style={styles.pendingTypeValue}>{trabajosPendientesRendicion.mantencion.length}</ThemedText>
            </View>
            <View style={[styles.pendingTypeCard, styles.pendingTypeCardRet]}>
              <ThemedText style={styles.pendingTypeLabel}>Retiro</ThemedText>
              <ThemedText style={styles.pendingTypeValue}>{trabajosPendientesRendicion.retiro.length}</ThemedText>
            </View>
          </View>
          {!!trabajosPendientesRendicion.instalacion.length && (
            <View style={styles.pendingInstCard}>
              <ThemedText style={styles.pendingInstTitle}>Instalaciones pendientes</ThemedText>
              {trabajosPendientesRendicion.instalacion.slice(0, 6).map((t: any) => {
                const centro = t?.centro?.nombre || t?.centro_nombre || '-';
                const cliente = t?.centro?.cliente || t?.cliente || '-';
                const okActa = !!t?.paso_acta;
                const okPermiso = !!t?.paso_permiso;
                const okArmado = !!t?.paso_armado;
                const tipoInst = tipoInstalacionLabel(t);
                const esReap = tipoInst.toLowerCase().includes('reap');
                return (
                  <View key={`inst-pend-${t?.id_actividad}`} style={styles.pendingInstRow}>
                    <View style={styles.pendingInstTopRow}>
                      <ThemedText style={[styles.pendingInstType, esReap && styles.pendingInstTypeReap]}>{tipoInst}</ThemedText>
                      <View style={styles.stepIconsWrap}>
                        {(() => {
                          const rendido = estaRendidoTrabajo(t);
                          return (
                            <Pressable
                              style={[
                                styles.stepActionBtn,
                                rendido ? styles.stepActionBtnDone : styles.stepActionBtnPending,
                                !rendido && styles.stepActionBtnUrgent,
                              ]}
                              onPress={() => abrirRendicionTrabajo(t)}
                            >
                              <Ionicons
                                name={rendido ? 'wallet' : 'wallet-outline'}
                                size={14}
                                color={rendido ? '#16a34a' : '#dc2626'}
                              />
                            </Pressable>
                          );
                        })()}
                        <Ionicons
                          name={okActa ? 'document-text' : 'document-text-outline'}
                          size={14}
                          color={okActa ? '#16a34a' : '#dc2626'}
                        />
                        <Ionicons
                          name={okPermiso ? 'clipboard' : 'clipboard-outline'}
                          size={14}
                          color={okPermiso ? '#16a34a' : '#dc2626'}
                        />
                        <Ionicons
                          name={okArmado ? 'link' : 'link-outline'}
                          size={14}
                          color={okArmado ? '#16a34a' : '#dc2626'}
                        />
                      </View>
                    </View>
                    <ThemedText style={styles.pendingInstText}>{cliente} / {centro}</ThemedText>
                  </View>
                );
              })}
            </View>
          )}
          {!!trabajosPendientesRendicion.mantencion.length && (
            <View style={styles.pendingMantCard}>
              <ThemedText style={styles.pendingMantTitle}>Mantenciones pendientes</ThemedText>
              {trabajosPendientesRendicion.mantencion.slice(0, 6).map((t: any) => {
                const centro = t?.centro?.nombre || t?.centro_nombre || '-';
                const cliente = t?.centro?.cliente || t?.cliente || '-';
                const okInforme = !!t?.paso_informe;
                return (
                  <View key={`mant-pend-${t?.id_actividad}`} style={styles.pendingMantRow}>
                    <View style={styles.pendingInstTopRow}>
                      <ThemedText style={styles.pendingMantType}>Mantencion</ThemedText>
                      <View style={styles.stepIconsWrap}>
                        {(() => {
                          const rendido = estaRendidoTrabajo(t);
                          return (
                            <Pressable
                              style={[
                                styles.stepActionBtn,
                                rendido ? styles.stepActionBtnDone : styles.stepActionBtnPending,
                                !rendido && styles.stepActionBtnUrgent,
                              ]}
                              onPress={() => abrirRendicionTrabajo(t)}
                            >
                              <Ionicons
                                name={rendido ? 'wallet' : 'wallet-outline'}
                                size={14}
                                color={rendido ? '#16a34a' : '#dc2626'}
                              />
                            </Pressable>
                          );
                        })()}
                        <Ionicons
                          name={okInforme ? 'reader' : 'reader-outline'}
                          size={14}
                          color={okInforme ? '#16a34a' : '#dc2626'}
                        />
                      </View>
                    </View>
                    <ThemedText style={styles.pendingMantText}>{cliente} / {centro}</ThemedText>
                  </View>
                );
              })}
            </View>
          )}
          {!!trabajosPendientesRendicion.retiro.length && (
            <View style={styles.pendingRetCard}>
              <ThemedText style={styles.pendingRetTitle}>Retiros pendientes</ThemedText>
              {trabajosPendientesRendicion.retiro.slice(0, 6).map((t: any) => {
                const centro = t?.centro?.nombre || t?.centro_nombre || '-';
                const cliente = t?.centro?.cliente || t?.cliente || '-';
                const okInforme = !!t?.paso_informe;
                // Para rendiciones, si ya existe en "Retiros recientes", se considera listo este paso.
                const okRetiro = okInforme;
                return (
                  <View key={`ret-pend-${t?.id_actividad}`} style={styles.pendingRetRow}>
                    <View style={styles.pendingInstTopRow}>
                      <ThemedText style={styles.pendingRetType}>Retiro</ThemedText>
                      <View style={styles.stepIconsWrap}>
                        {(() => {
                          const rendido = estaRendidoTrabajo(t);
                          return (
                            <Pressable
                              style={[
                                styles.stepActionBtn,
                                rendido ? styles.stepActionBtnDone : styles.stepActionBtnPending,
                                !rendido && styles.stepActionBtnUrgent,
                              ]}
                              onPress={() => abrirRendicionTrabajo(t)}
                            >
                              <Ionicons
                                name={rendido ? 'wallet' : 'wallet-outline'}
                                size={14}
                                color={rendido ? '#16a34a' : '#dc2626'}
                              />
                            </Pressable>
                          );
                        })()}
                        <Ionicons
                          name={okRetiro ? 'reader' : 'reader-outline'}
                          size={14}
                          color={okRetiro ? '#16a34a' : '#dc2626'}
                        />
                      </View>
                    </View>
                    <ThemedText style={styles.pendingRetText}>{cliente} / {centro}</ThemedText>
                  </View>
                );
              })}
            </View>
          )}
          {!trabajosPendientesRendicion.all.length && (
            <ThemedText style={styles.pendingJobsEmpty}>No hay trabajos pendientes de rendicion.</ThemedText>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <ThemedText style={styles.sectionTitle}>Rendiciones completadas recientes</ThemedText>
            <View style={[styles.badge, styles.badgeOk]}>
              <ThemedText style={styles.badgeText}>{rendicionesCompletadasRecientes.length}</ThemedText>
            </View>
          </View>
          {!!rendicionesCompletadasRecientes.length &&
            rendicionesCompletadasRecientes.map((r: any) => (
              <View key={`rend-ok-${r.id_rendicion}`} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.itemTitle}>
                    {r.centro_nombre || 'Sin centro'} - {money(r.monto)}
                  </ThemedText>
                  <ThemedText style={styles.itemSub}>
                    {r.fecha_gasto || '-'} - {(r.actividad_tipo || '-').toString()}
                  </ThemedText>
                </View>
                <View style={[styles.badge, styles.badgeOk]}>
                  <ThemedText style={styles.badgeText}>Completada</ThemedText>
                </View>
              </View>
            ))}
          {!rendicionesCompletadasRecientes.length && (
            <ThemedText style={styles.empty}>No hay rendiciones completadas recientes.</ThemedText>
          )}
        </View>

      <Modal visible={showForm} transparent animationType="fade" onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.rendicionModalCard}>
            <View style={styles.modalHeaderRow}>
              <ThemedText style={styles.sectionTitle}>Nueva rendicion</ThemedText>
              <Pressable onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={24} color="#0f172a" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ gap: 8 }} showsVerticalScrollIndicator={false}>
            <ThemedText style={styles.label}>Trabajo asociado</ThemedText>
            {loadingActividades ? (
              <ActivityIndicator />
            ) : (
              trabajoBloqueado ? (
                <View style={styles.workLockedCard}>
                  <ThemedText style={styles.workLockedText}>
                    {trabajoSeleccionado
                      ? `${trabajoSeleccionado.id_actividad} ${tipoTrabajoTexto(
                          trabajoSeleccionado.area,
                          trabajoSeleccionado.nombre_actividad
                        )} - ${trabajoSeleccionado?.centro?.nombre || trabajoSeleccionado?.centro_nombre || '-'}`
                      : 'Trabajo asociado bloqueado'}
                  </ThemedText>
                  <ThemedText style={styles.workLockedSub}>Trabajo principal bloqueado para mantener trazabilidad.</ThemedText>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipRow}>
                    {actividadesAsociadas.map((a: any) => {
                      const id = String(a?.id_actividad || '');
                      const centroNombre = String(a?.centro?.nombre || a?.centro_nombre || `Centro ${a?.centro_id || '-'}`);
                      const tipo = tipoTrabajoTexto(a?.area, a?.nombre_actividad) || String(a?.area || '-').toLowerCase();
                      const active = String(selectedTrabajoId || '') === id;
                      return (
                        <Pressable key={`trab-${id}`} style={[styles.chip, active && styles.chipActive]} onPress={() => setSelectedTrabajoId(id)}>
                          <ThemedText style={[styles.chipText, active && styles.chipTextActive]}>
                            {id} {tipo} - {centroNombre}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              )
            )}
            {!!trabajoSeleccionado && (
              <View style={styles.workInfoCard}>
                <ThemedText style={styles.workInfoTitle}>
                  Vinculada: {trabajoSeleccionado.id_actividad} - {tipoTrabajoTexto(trabajoSeleccionado.area, trabajoSeleccionado.nombre_actividad)}
                </ThemedText>
                <ThemedText style={styles.workInfoText}>
                  {trabajoSeleccionado?.centro?.cliente || trabajoSeleccionado?.cliente || '-'} -{' '}
                  {trabajoSeleccionado?.centro?.nombre || trabajoSeleccionado?.centro_nombre || '-'}
                </ThemedText>
              </View>
            )}
            <View style={styles.saldoResumenCard}>
              <View style={styles.saldoResumenRow}>
                <ThemedText style={styles.saldoResumenLabel}>Saldo disponible</ThemedText>
                <ThemedText style={styles.saldoResumenValue}>{money(totalRendir)}</ThemedText>
              </View>
              <View style={styles.saldoResumenRow}>
                <ThemedText style={styles.saldoResumenLabel}>Total gastos</ThemedText>
                <ThemedText style={styles.saldoResumenValue}>{money(totalGastos)}</ThemedText>
              </View>
              <View style={styles.saldoResumenRow}>
                <ThemedText style={styles.saldoResumenLabel}>Saldo proyectado</ThemedText>
                <ThemedText style={[styles.saldoResumenValue, saldoRendicion < 0 ? styles.saldoNegativo : styles.saldoPositivo]}>
                  {money(saldoRendicion)}
                </ThemedText>
              </View>
            </View>
            {!!selectedTrabajoId && (
              <>
                <ThemedText style={styles.label}>Trabajo asociado extra (gasto compartido)</ThemedText>
                <Pressable style={styles.extraOpenBtn} onPress={() => setShowTrabajosExtraModal(true)}>
                  <Ionicons name="list-outline" size={16} color="#1d4ed8" />
                  <ThemedText style={styles.extraOpenBtnText}>Seleccionar trabajos asociados</ThemedText>
                </Pressable>
                {!!trabajosExtraIds.length && (
                  <ThemedText style={styles.extraCountText}>Seleccionados: {trabajosExtraIds.length}</ThemedText>
                )}
              </>
            )}

            <View style={styles.row}>
              <View style={[styles.col, { flex: 1 }]}>
                <ThemedText style={styles.label}>Fecha</ThemedText>
                <TextInput value={fechaGasto} onChangeText={setFechaGasto} placeholder="YYYY-MM-DD" style={styles.input} />
              </View>
              <View style={[styles.col, { flex: 1 }]}>
                <ThemedText style={styles.label}>Rendido por</ThemedText>
                <TextInput value={tec1Nombre} onChangeText={setTec1Nombre} placeholder="Nombre tecnico" style={styles.input} />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.col, { flex: 1 }]}>
                <ThemedText style={styles.label}>Cliente</ThemedText>
                <TextInput
                  value={String(trabajoSeleccionado?.centro?.cliente || trabajoSeleccionado?.cliente || '')}
                  editable={false}
                  style={[styles.input, styles.inputReadOnly]}
                />
              </View>
              <View style={[styles.col, { flex: 1 }]}>
                <ThemedText style={styles.label}>Centro</ThemedText>
                <TextInput
                  value={String(trabajoSeleccionado?.centro?.nombre || trabajoSeleccionado?.centro_nombre || '')}
                  editable={false}
                  style={[styles.input, styles.inputReadOnly]}
                />
              </View>
            </View>

            {!!tecnicosAsociados.length && (
              <View style={styles.techListCard}>
                <ThemedText style={styles.techListTitle}>Tecnicos asociados</ThemedText>
                <View style={styles.techChipsWrap}>
                  {tecnicosAsociados.map((t) => (
                    <View key={`tec-asoc-${t}`} style={styles.techChip}>
                      <Ionicons name="person-outline" size={12} color="#1d4ed8" />
                      <ThemedText style={styles.techChipText}>{t}</ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <ThemedText style={styles.label}>Detalle de gastos</ThemedText>
            {lineasRendicion.map((linea, idx) => (
              <View key={`lin-${idx}`} style={styles.lineaCard}>
                <View style={styles.row}>
                  <View style={[styles.col, { flex: 1.1 }]}>
                    <ThemedText style={styles.label}>Fecha</ThemedText>
                    <TextInput
                      value={linea.fecha}
                      onChangeText={(v) => actualizarLinea(idx, 'fecha', v)}
                      placeholder="YYYY-MM-DD"
                      style={styles.input}
                    />
                  </View>
                  <View style={[styles.col, { flex: 1 }]}>
                    <ThemedText style={styles.label}>N° Documento</ThemedText>
                    <TextInput
                      value={linea.documento}
                      onChangeText={(v) => actualizarLinea(idx, 'documento', v)}
                      placeholder="boleta/factura"
                      style={styles.input}
                    />
                  </View>
                </View>
                <ThemedText style={styles.label}>Descripcion</ThemedText>
                <TextInput
                  value={linea.descripcion}
                  onChangeText={(v) => actualizarLinea(idx, 'descripcion', v)}
                  placeholder="Detalle del gasto"
                  style={styles.input}
                />
                <View style={styles.row}>
                  <View style={[styles.col, { flex: 1 }]}>
                    <ThemedText style={styles.label}>Valor $</ThemedText>
                    <TextInput
                      value={linea.valor}
                      onChangeText={(v) => actualizarLinea(idx, 'valor', v)}
                      keyboardType="numeric"
                      placeholder="0"
                      style={styles.input}
                    />
                  </View>
                  <View style={[styles.col, { justifyContent: 'flex-end' }]}>
                    <Pressable style={styles.lineaImgBtn} onPress={() => abrirCamaraLinea(idx)}>
                      <Ionicons name={linea.foto ? 'camera' : 'camera-outline'} size={14} color={linea.foto ? '#166534' : '#1d4ed8'} />
                    </Pressable>
                  </View>
                  <View style={[styles.col, { justifyContent: 'flex-end' }]}>
                    <Pressable style={styles.lineaDelBtn} onPress={() => quitarLinea(idx)}>
                      <Ionicons name="trash-outline" size={14} color="#b91c1c" />
                      <ThemedText style={styles.lineaDelText}>Quitar</ThemedText>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
            <Pressable style={styles.addLineaBtn} onPress={agregarLinea}>
              <Ionicons name="add-circle-outline" size={16} color="#1d4ed8" />
              <ThemedText style={styles.addLineaText}>Agregar linea</ThemedText>
            </Pressable>

            <View style={styles.row}>
              <View style={[styles.col, { flex: 1 }]}>
                <ThemedText style={styles.label}>Saldo disponible $</ThemedText>
                <TextInput value={String(totalRendir)} editable={false} style={[styles.input, styles.inputReadOnly]} />
              </View>
              <View style={[styles.col, { flex: 1 }]}>
                <ThemedText style={styles.label}>Total gastos $</ThemedText>
                <TextInput value={String(totalGastos)} editable={false} style={[styles.input, styles.inputReadOnly]} />
              </View>
            </View>
            <View style={styles.row}>
              <View style={[styles.col, { flex: 1 }]}>
                <ThemedText style={styles.label}>Saldo proyectado $</ThemedText>
                <TextInput value={String(saldoRendicion)} editable={false} style={[styles.input, styles.inputReadOnly]} />
              </View>
            </View>

            <ThemedText style={styles.label}>Actividades</ThemedText>
            <TextInput
              value={actividadesTexto}
              onChangeText={setActividadesTexto}
              multiline
              numberOfLines={3}
              placeholder="Describe las actividades realizadas"
              style={[styles.input, { minHeight: 82, textAlignVertical: 'top' }]}
            />

            <View style={styles.actionsRow}>
              <Pressable style={[styles.actionBtn, styles.draftBtn]} disabled={guardando} onPress={() => guardar('borrador')}>
                {guardando ? <ActivityIndicator color="#0f172a" /> : <ThemedText style={styles.draftText}>Guardar borrador</ThemedText>}
              </Pressable>
              <Pressable style={[styles.actionBtn, styles.sendBtn]} disabled={guardando} onPress={() => guardar('enviado')}>
                {guardando ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.sendText}>Enviar</ThemedText>}
              </Pressable>
            </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showTrabajosExtraModal} transparent animationType="fade" onRequestClose={() => setShowTrabajosExtraModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.extraModalCard}>
            <View style={styles.modalHeaderRow}>
              <ThemedText style={styles.sectionTitle}>Trabajos asociados extra</ThemedText>
              <Pressable onPress={() => setShowTrabajosExtraModal(false)}>
                <Ionicons name="close" size={24} color="#0f172a" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ gap: 8 }}>
              {actividadesAsociadas
                .filter((a: any) => String(a?.id_actividad || '') !== String(selectedTrabajoId || ''))
                .map((a: any) => {
                  const id = String(a?.id_actividad || '');
                  const tipo = tipoTrabajoTexto(a?.area, a?.nombre_actividad) || String(a?.area || '-').toLowerCase();
                  const centroNombre = String(a?.centro?.nombre || a?.centro_nombre || '-');
                  const clienteNombre = String(a?.centro?.cliente || a?.cliente || '-');
                  const active = trabajosExtraIds.includes(id);
                  return (
                    <Pressable
                      key={`trab-extra-modal-${id}`}
                      style={[styles.extraItem, active && styles.extraItemActive]}
                      onPress={() => toggleTrabajoExtra(id)}
                    >
                      <Ionicons name={active ? 'checkbox' : 'square-outline'} size={18} color={active ? '#1d4ed8' : '#64748b'} />
                      <View style={{ flex: 1 }}>
                        <ThemedText style={[styles.extraItemTitle, active && styles.extraItemTitleActive]}>
                          {id} {tipo}
                        </ThemedText>
                        <ThemedText style={styles.extraItemSub}>{clienteNombre} / {centroNombre}</ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
            </ScrollView>
            <Pressable style={styles.extraCloseBtn} onPress={() => setShowTrabajosExtraModal(false)}>
              <ThemedText style={styles.extraCloseBtnText}>Listo</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      </ScrollView>

      <Pressable
        style={styles.fabBtn}
        onPress={() => {
          setTrabajoBloqueado(false);
          setTrabajosExtraIds([]);
          setShowTrabajosExtraModal(false);
          setShowForm(true);
        }}
      >
        <Ionicons name="add" size={24} color="#fff" />
      </Pressable>

      <Modal
        visible={showCamera}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowCamera(false);
          setLineaFotoActivaIdx(null);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.cameraCard}>
            <View style={styles.cameraHeader}>
              <ThemedText style={styles.cameraTitle}>Capturar evidencia</ThemedText>
              <Pressable
                onPress={() => {
                  setShowCamera(false);
                  setLineaFotoActivaIdx(null);
                }}
              >
                <Ionicons name="close" size={24} color="#0f172a" />
              </Pressable>
            </View>
            <View style={styles.cameraWrap}>
              {cameraPermission?.status !== 'granted' ? (
                <View style={styles.cameraPlaceholder}>
                  <ThemedText>Sin permiso de camara</ThemedText>
                </View>
              ) : (
                <CameraView
                  ref={(r) => {
                    cameraRef.current = r;
                  }}
                  style={{ flex: 1 }}
                  facing={cameraFacing}
                />
              )}
            </View>
            <View style={styles.cameraActions}>
              <Pressable style={styles.cameraBtn} onPress={() => setCameraFacing((f) => (f === 'back' ? 'front' : 'back'))}>
                <Ionicons name="camera-reverse-outline" size={18} color="#0f172a" />
              </Pressable>
              <Pressable style={[styles.cameraBtn, styles.cameraTakeBtn]} onPress={tomarFoto}>
                <Ionicons name="camera" size={18} color="#fff" />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingTop: (RNStatusBar.currentHeight || 24) + 6 },
  scrollContent: { padding: 12, gap: 12, paddingBottom: 28 },
  headerCard: {
    backgroundColor: '#0f3a8c',
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  headerTop: { gap: 2 },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  subtitle: { color: '#dbeafe', fontSize: 12, fontWeight: '600' },
  kpiGroup: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  kpiChip: { backgroundColor: '#fef2f2', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  kpiLabel: { color: '#991b1b', fontSize: 11, fontWeight: '700' },
  kpiValue: { color: '#b91c1c', fontSize: 12, fontWeight: '900' },
  kpiChipAbono: { backgroundColor: '#ecfdf5', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  kpiLabelAbono: { color: '#166534', fontSize: 11, fontWeight: '700' },
  kpiValueAbono: { color: '#15803d', fontSize: 12, fontWeight: '900' },
  kpiChipSaldo: { backgroundColor: '#eff6ff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  kpiLabelSaldo: { color: '#1e3a8a', fontSize: 11, fontWeight: '700' },
  kpiValueSaldo: { color: '#1d4ed8', fontSize: 12, fontWeight: '900' },
  pendingCard: {
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pendingJobsCard: {
    backgroundColor: '#fff7f7',
    borderColor: '#fca5a5',
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
  },
  pendingJobsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pendingJobsTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pendingJobsTitle: { color: '#991b1b', fontWeight: '900', fontSize: 13 },
  pendingJobsCount: {
    color: '#991b1b',
    fontWeight: '900',
    fontSize: 12,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pendingJobsEmpty: { color: '#64748b', fontSize: 12, fontWeight: '700' },
  pendingByTypeCards: { flexDirection: 'row', gap: 8 },
  pendingTypeCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 7,
    minHeight: 52,
    justifyContent: 'space-between',
  },
  pendingTypeCardInst: { backgroundColor: '#dbeafe', borderColor: '#93c5fd' },
  pendingTypeCardMant: { backgroundColor: '#dcfce7', borderColor: '#86efac' },
  pendingTypeCardRet: { backgroundColor: '#ffedd5', borderColor: '#fdba74' },
  pendingTypeLabel: { color: '#334155', fontSize: 11, fontWeight: '700' },
  pendingTypeValue: { color: '#0f172a', fontSize: 18, fontWeight: '900' },
  pendingInstCard: {
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: '#f8fbff',
    borderRadius: 10,
    padding: 8,
    gap: 6,
  },
  pendingInstTitle: { color: '#1e3a8a', fontWeight: '800', fontSize: 12 },
  pendingInstRow: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
  },
  pendingInstTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepIconsWrap: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  stepActionBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepActionBtnPending: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fca5a5' },
  stepActionBtnUrgent: {
    shadowColor: '#dc2626',
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 3,
  },
  stepActionBtnDone: { backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#86efac' },
  pendingInstType: { color: '#1d4ed8', fontWeight: '900', fontSize: 11 },
  pendingInstTypeReap: {
    color: '#7c2d12',
    backgroundColor: '#ffedd5',
    borderWidth: 1,
    borderColor: '#fdba74',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  pendingInstText: { color: '#334155', fontWeight: '700', fontSize: 12 },
  pendingMantCard: {
    borderWidth: 1,
    borderColor: '#86efac',
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 8,
    gap: 6,
  },
  pendingMantTitle: { color: '#166534', fontWeight: '800', fontSize: 12 },
  pendingMantRow: {
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
  },
  pendingMantType: { color: '#15803d', fontWeight: '900', fontSize: 11 },
  pendingMantText: { color: '#334155', fontWeight: '700', fontSize: 12 },
  pendingRetCard: {
    borderWidth: 1,
    borderColor: '#fdba74',
    backgroundColor: '#fff7ed',
    borderRadius: 10,
    padding: 8,
    gap: 6,
  },
  pendingRetTitle: { color: '#9a3412', fontWeight: '800', fontSize: 12 },
  pendingRetRow: {
    borderWidth: 1,
    borderColor: '#fed7aa',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
  },
  pendingRetType: { color: '#c2410c', fontWeight: '900', fontSize: 11 },
  pendingRetText: { color: '#334155', fontWeight: '700', fontSize: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', padding: 12, gap: 8 },
  rendicionModalCard: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '86%',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 8,
  },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: '#0f172a', fontSize: 16, fontWeight: '800', marginBottom: 2 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1d4ed8', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  newBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  label: { color: '#475569', fontWeight: '700', fontSize: 12 },
  chipRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  chip: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#dbeafe', borderColor: '#3b82f6' },
  chipText: { color: '#334155', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  chipTextActive: { color: '#1d4ed8' },
  workInfoCard: { borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff', borderRadius: 10, padding: 8, marginTop: 2 },
  workInfoTitle: { color: '#1d4ed8', fontWeight: '800', fontSize: 12, textTransform: 'capitalize' },
  workInfoText: { color: '#0f172a', fontSize: 12, marginTop: 2 },
  workLockedCard: {
    borderWidth: 1,
    borderColor: '#fcd34d',
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    padding: 8,
    marginTop: 2,
    gap: 2,
  },
  workLockedText: { color: '#92400e', fontWeight: '800', fontSize: 12, textTransform: 'capitalize' },
  workLockedSub: { color: '#a16207', fontWeight: '700', fontSize: 11 },
  saldoResumenCard: {
    borderWidth: 1,
    borderColor: '#86efac',
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 7,
    gap: 5,
  },
  saldoResumenRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  saldoResumenLabel: { color: '#166534', fontSize: 11, fontWeight: '700' },
  saldoResumenValue: { color: '#14532d', fontSize: 12, fontWeight: '900' },
  saldoPositivo: { color: '#15803d' },
  saldoNegativo: { color: '#b91c1c' },
  row: { flexDirection: 'row', gap: 8 },
  col: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
    color: '#0f172a',
  },
  inputReadOnly: {
    backgroundColor: '#f8fafc',
    color: '#475569',
  },
  techListCard: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fbff',
    borderRadius: 10,
    padding: 8,
    gap: 6,
  },
  techListTitle: { color: '#1d4ed8', fontWeight: '800', fontSize: 12 },
  techChipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  techChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  techChipText: { color: '#1e3a8a', fontWeight: '700', fontSize: 11 },
  lineaCard: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fbff',
    borderRadius: 10,
    padding: 8,
    gap: 6,
  },
  lineaDelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff1f2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignSelf: 'flex-end',
  },
  lineaDelText: { color: '#b91c1c', fontWeight: '800', fontSize: 12 },
  lineaImgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignSelf: 'flex-end',
  },
  addLineaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  addLineaText: { color: '#1d4ed8', fontWeight: '800', fontSize: 12 },
  extraOpenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  extraOpenBtnText: { color: '#1d4ed8', fontWeight: '800', fontSize: 12 },
  extraCountText: { color: '#475569', fontWeight: '700', fontSize: 12 },
  extraModalCard: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '78%',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 8,
  },
  extraItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  extraItemActive: { borderColor: '#93c5fd', backgroundColor: '#eff6ff' },
  extraItemTitle: { color: '#0f172a', fontWeight: '800', fontSize: 12, textTransform: 'capitalize' },
  extraItemTitleActive: { color: '#1d4ed8' },
  extraItemSub: { color: '#64748b', fontWeight: '600', fontSize: 11 },
  extraCloseBtn: {
    alignSelf: 'flex-end',
    backgroundColor: '#1d4ed8',
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  extraCloseBtnText: { color: '#fff', fontWeight: '800' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingVertical: 10 },
  draftBtn: { backgroundColor: '#e2e8f0' },
  sendBtn: { backgroundColor: '#16a34a' },
  draftText: { color: '#0f172a', fontWeight: '800' },
  sendText: { color: '#fff', fontWeight: '800' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingVertical: 7 },
  itemTitle: { color: '#0f172a', fontWeight: '700', fontSize: 13 },
  itemSub: { color: '#64748b', fontSize: 11 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  badgeOk: { backgroundColor: '#dcfce7' },
  badgeGray: { backgroundColor: '#e2e8f0' },
  badgeText: { color: '#0f172a', fontWeight: '800', fontSize: 11, textTransform: 'capitalize' },
  empty: { color: '#64748b' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  cameraCard: { width: '100%', maxWidth: 420, height: '74%', backgroundColor: '#fff', borderRadius: 14, padding: 10, gap: 8 },
  cameraHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cameraTitle: { color: '#0f172a', fontWeight: '800', fontSize: 15 },
  cameraWrap: { flex: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#0f172a' },
  cameraPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e2e8f0' },
  cameraActions: { flexDirection: 'row', justifyContent: 'center', gap: 16, paddingBottom: 2 },
  cameraBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  cameraTakeBtn: { backgroundColor: '#1d4ed8' },
  fabBtn: {
    position: 'absolute',
    right: 18,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1d4ed8',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#0f172a',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
});
