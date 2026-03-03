import React, { useContext, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { AuthContext } from '../_layout';
import { fetchClientes, fetchCentrosPorCliente, fetchHistorialCentro } from '@/lib/api';

type Cliente = { id_cliente?: number; id?: number; nombre?: string; razon_social?: string };
type Centro = { id_centro?: number; id?: number; nombre?: string; cliente_id?: number; direccion?: string };

export default function ConsultaCentroScreen() {
  const { token } = useContext(AuthContext);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [centros, setCentros] = useState<Centro[]>([]);
  const [historial, setHistorial] = useState<any[]>([]);
  const [clienteSel, setClienteSel] = useState<number | null>(null);
  const [centroSel, setCentroSel] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setLoading(true);
    fetchCentrosPorCliente(clienteSel)
      .then(setCentros)
      .catch(() => setError('No se pudieron cargar los centros'))
      .finally(() => setLoading(false));
  }, [clienteSel]);

  useEffect(() => {
    if (!centroSel) return;
    setLoading(true);
    fetchHistorialCentro(centroSel)
      .then((h) => setHistorial(Array.isArray(h) ? h : []))
      .catch(() => setError('No se pudo cargar el historial'))
      .finally(() => setLoading(false));
  }, [centroSel]);

  const clienteNombre = useMemo(() => {
    const c = clientes.find((c) => (c.id_cliente ?? c.id) === clienteSel);
    return c?.nombre || c?.razon_social || 'Cliente';
  }, [clientes, clienteSel]);

  const centroNombre = useMemo(() => {
    const c = centros.find((c) => (c.id_centro ?? c.id) === centroSel);
    return c?.nombre || 'Centro';
  }, [centros, centroSel]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Consulta de centro</Text>
      <Text style={styles.subtitle}>Selecciona cliente y centro para ver detalles.</Text>
      {!token && <Text style={styles.alert}>Debes iniciar sesión.</Text>}
      {error && <Text style={styles.alert}>{error}</Text>}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Clientes</Text>
        {loading && !clientes.length ? <ActivityIndicator /> : null}
        <View style={styles.pillRow}>
          {clientes.map((c) => (
            <Pressable
              key={c.id_cliente || c.id}
              style={[
                styles.pill,
                (c.id_cliente ?? c.id) === clienteSel && styles.pillActive,
              ]}
              onPress={() => {
                setClienteSel(c.id_cliente ?? c.id ?? null);
                setCentroSel(null);
                setHistorial([]);
              }}>
              <Text style={styles.pillText}>{c.nombre || c.razon_social || `Cliente ${c.id}`}</Text>
            </Pressable>
          ))}
          {!clientes.length && !loading && <Text style={styles.muted}>Sin clientes</Text>}
        </View>
      </View>

      {clienteSel ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Centros de {clienteNombre}</Text>
          {loading && !centros.length ? <ActivityIndicator /> : null}
          <View style={styles.pillRow}>
            {centros.map((c) => (
              <Pressable
                key={c.id_centro || c.id}
                style={[
                  styles.pill,
                  (c.id_centro ?? c.id) === centroSel && styles.pillActive,
                ]}
                onPress={() => setCentroSel(c.id_centro ?? c.id ?? null)}>
                <Text style={styles.pillText}>{c.nombre || `Centro ${c.id}`}</Text>
              </Pressable>
            ))}
            {!centros.length && !loading && <Text style={styles.muted}>Sin centros</Text>}
          </View>
        </View>
      ) : null}

      {centroSel ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Historial / detalles de {centroNombre}</Text>
          {loading && !historial.length ? <ActivityIndicator /> : null}
          {historial.slice(0, 10).map((h, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={styles.itemPrimary}>{h.descripcion || h.detalle || 'Movimiento'}</Text>
              <Text style={styles.itemSecondary}>{h.fecha || h.created_at || ''}</Text>
            </View>
          ))}
          {!historial.length && !loading && (
            <Text style={styles.muted}>Sin historial disponible para este centro.</Text>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
    backgroundColor: '#0b1220',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
  },
  subtitle: {
    color: '#cbd5e1',
    marginBottom: 4,
  },
  alert: {
    color: '#fca5a5',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 10,
  },
  sectionTitle: {
    color: '#e2e8f0',
    fontWeight: '700',
    fontSize: 15,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
  },
  pillActive: {
    borderColor: '#38bdf8',
    backgroundColor: '#0ea5e9',
  },
  pillText: {
    color: '#e2e8f0',
    fontWeight: '600',
  },
  muted: {
    color: '#94a3b8',
  },
  itemRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  itemPrimary: {
    color: '#f8fafc',
    fontWeight: '600',
  },
  itemSecondary: {
    color: '#94a3b8',
    fontSize: 12,
  },
});
