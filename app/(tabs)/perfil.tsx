import React, { useContext } from 'react';
import { SafeAreaView, StyleSheet, Pressable, View, StatusBar as RNStatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AuthContext } from '../_layout';

export default function PerfilScreen() {
  const { name, role, userId, setToken } = useContext(AuthContext);
  const router = useRouter();

  const initial = (name || 'U').trim()[0]?.toUpperCase() || 'U';

  const logout = async () => {
    await setToken(null);
    router.replace('login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.heroCard}>
        <View style={styles.headerRow}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarGlow} />
            <View style={styles.avatar}>
              <ThemedText style={styles.avatarText}>{initial}</ThemedText>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.hello}>MI PERFIL</ThemedText>
            <ThemedText style={styles.name}>{name || 'Sin nombre'}</ThemedText>
            <View style={styles.roleChip}>
              <ThemedText style={styles.roleChipText}>{role || 'Rol no asignado'}</ThemedText>
            </View>
          </View>
          <View style={styles.bellBtn}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#0b3b8c" />
          </View>
        </View>
      </ThemedView>

      <View style={styles.sectionHeaderRow}>
        <ThemedText type="subtitle" style={styles.sectionTitleLine}>Datos de usuario</ThemedText>
        <View style={styles.sectionLine} />
      </View>

      <ThemedView style={styles.card}>
        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <Ionicons name="id-card-outline" size={14} color="#ffffff" />
          </View>
          <View>
            <ThemedText style={styles.infoLabel}>Identificador</ThemedText>
            <ThemedText style={styles.infoText}>ID usuario: {userId ?? '-'}</ThemedText>
          </View>
        </View>
      </ThemedView>

      <Pressable style={styles.logoutBtn} onPress={logout}>
        <Ionicons name="log-out-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
        <ThemedText style={styles.logoutText}>Cerrar sesion</ThemedText>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
    paddingTop: (RNStatusBar.currentHeight || 24) + 12,
    gap: 14,
  },
  heroCard: {
    backgroundColor: '#f8fbff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#dbeafe',
    shadowColor: '#1d4ed8',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {
    width: 58,
    height: 58,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarGlow: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(37, 99, 235, 0.16)',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1d4ed8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 19,
  },
  hello: {
    color: '#64748b',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.6,
  },
  name: {
    color: '#0f172a',
    fontWeight: '900',
    fontSize: 24,
    lineHeight: 26,
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
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  sectionTitleLine: {
    color: '#0f172a',
    fontWeight: '900',
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#d1d5db',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  infoIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  infoLabel: {
    color: '#64748b',
    fontWeight: '700',
    fontSize: 11,
  },
  infoText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 14,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#e11d48',
    shadowColor: '#e11d48',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  logoutText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
});
