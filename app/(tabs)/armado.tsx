import React, { useMemo, useState, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, SafeAreaView } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { AuthContext } from '../_layout';

type Equipo = {
  id: string;
  nombre: string;
  caja: string;
  serie: string;
  codigo: string;
};

const BASE_EQUIPOS: Equipo[] = [
  { id: 'pc-nvr', nombre: 'PC NVR', caja: 'Caja 1', serie: '', codigo: '' },
  { id: 'monitor', nombre: 'Monitor', caja: 'Caja 1', serie: '', codigo: '' },
  { id: 'mouse', nombre: 'Mouse', caja: 'Caja 1', serie: '', codigo: '' },
  { id: 'teclado', nombre: 'Teclado', caja: 'Caja 1', serie: '', codigo: '' },
  { id: 'switch-cisco', nombre: 'Switch Cisco + Adaptador', caja: 'Caja 1', serie: '', codigo: '' },
  { id: 'router-mikrotik', nombre: 'Router Mikrotik + Trafo', caja: 'Caja 1', serie: '', codigo: '' },
  { id: 'rack', nombre: 'Rack 9U + tuercas + tornillos', caja: 'Caja 1', serie: '', codigo: '' },
];

export default function ArmadoScreen() {
  const { token, role } = useContext(AuthContext);
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  const [equipos, setEquipos] = useState<Equipo[]>(BASE_EQUIPOS);

  const completados = useMemo(
    () => equipos.filter((e) => e.serie.trim().length > 0).length,
    [equipos]
  );

  const actualizarEquipo = (id: string, cambios: Partial<Equipo>) => {
    setEquipos((prev) => prev.map((eq) => (eq.id === id ? { ...eq, ...cambios } : eq)));
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        {!token ? (
          <Text style={[styles.subtitle, { color: 'red', textAlign: 'center' }]}>
            Debes iniciar sesiÃ³n para ver tus armados.
          </Text>
        ) : role !== 'admin' && role !== 'tecnico' ? (
          <Text style={[styles.subtitle, { color: 'red', textAlign: 'center' }]}>
            Tu rol no tiene acceso a esta secciÃ³n.
          </Text>
        ) : null}
        <Text style={[styles.title, { color: palette.text }]}>Armado de equipos</Text>
        <Text style={[styles.subtitle, { color: palette.icon }]}>
          Completa NÂ° Serie y revisa la caja asignada (Equipo / Caja / NÂ° Serie).
        </Text>

        <View style={[styles.summary, { borderColor: palette.tabIconDefault }]}>
          <Text style={[styles.summaryNumber, { color: palette.tint }]}>{completados}</Text>
          <Text style={[styles.summaryLabel, { color: palette.text }]}>
            de {equipos.length} equipos con NÂ° Serie
          </Text>
        </View>

        {equipos.map((eq) => (
          <View
            key={eq.id}
            style={[
              styles.card,
              {
                borderColor: palette.tabIconDefault,
                backgroundColor: colorScheme === 'dark' ? '#1f2937' : '#ffffff',
              },
            ]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>{eq.nombre}</Text>
              <Text style={[styles.cardBadge, { color: palette.tint, borderColor: palette.tint }]}>
                {eq.caja}
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: palette.icon }]}>NÂ° Serie</Text>
              <TextInput
                placeholder="Escribe el NÂ° de serie"
                placeholderTextColor="#94a3b8"
                style={[styles.input, { color: palette.text, borderColor: '#e2e8f0' }]}
                value={eq.serie}
                onChangeText={(t) => actualizarEquipo(eq.id, { serie: t, codigo: t.slice(0, 5) })}
                inputMode="numeric"
              />
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  container: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
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
});
