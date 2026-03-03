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
      <ThemedView style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.avatar}>
            <Ionicons name="person-circle-outline" size={28} color="#ffffff" />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.name}>{name || 'Sin nombre'}</ThemedText>
            <ThemedText style={styles.role}>{role || 'Rol no asignado'}</ThemedText>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="id-card-outline" size={16} color="#0f172a" />
          <ThemedText style={styles.infoText}>ID usuario: {userId ?? '-'}</ThemedText>
        </View>
      </ThemedView>

      <Pressable style={styles.logoutBtn} onPress={logout}>
        <Ionicons name="log-out-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
        <ThemedText style={styles.logoutText}>Cerrar sesión</ThemedText>
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
  card: {
    backgroundColor: '#f8fbff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0b3b8c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 24,
  },
  name: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 18,
  },
  role: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 13,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    color: '#334155',
    fontWeight: '600',
    fontSize: 13,
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
