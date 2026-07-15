import React, { useContext } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AuthContext } from '../_layout';

export default function PerfilScreen() {
  const { name, role, userId, setToken } = useContext(AuthContext);
  const router = useRouter();

  const logout = async () => {
    await setToken(null);
    router.replace('login');
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ThemedView style={styles.heroCard}>
        <View pointerEvents="none" style={styles.heroGlowPrimary} />
        <View pointerEvents="none" style={styles.heroGlowSecondary} />

        <View style={styles.headerRow}>
          <View style={styles.logoWrap}>
            <View style={styles.logoMark}>
              <View style={[styles.logoOrbit, styles.logoOrbitBack]} />
              <View style={[styles.logoOrbit, styles.logoOrbitFront]} />
              <View style={styles.logoCore} />
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <ThemedText style={styles.brandTitle}>ORCAGEST</ThemedText>
            <ThemedText style={styles.brandSub}>GMS</ThemedText>
          </View>

          <View style={styles.secureBtn}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#d8ffe7" />
          </View>
        </View>

        <View style={styles.profileBlock}>
          <ThemedText style={styles.hello}>MI PERFIL</ThemedText>
          <ThemedText style={styles.name} numberOfLines={2}>
            {name || 'Sin nombre'}
          </ThemedText>
        </View>

        <View style={styles.heroInfoPanel}>
          <View style={styles.heroInfoItem}>
            <View style={styles.heroInfoIcon}>
              <Ionicons name="id-card-outline" size={14} color="#9fd7ff" />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.heroInfoLabel}>ID usuario</ThemedText>
              <ThemedText style={styles.heroInfoText}>{userId ?? '-'}</ThemedText>
            </View>
          </View>

          <View style={styles.heroInfoDivider} />

          <View style={styles.heroInfoItem}>
            <View style={styles.heroInfoIcon}>
              <Ionicons name="person-circle-outline" size={14} color="#d8ffe7" />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.heroInfoLabel}>Rol</ThemedText>
              <ThemedText style={styles.heroInfoText}>{role || 'No asignado'}</ThemedText>
            </View>
          </View>
        </View>
      </ThemedView>

      <ThemedView style={styles.sessionCard}>
        <View style={styles.sessionInfo}>
          <View style={styles.sessionIcon}>
            <Ionicons name="lock-closed-outline" size={15} color="#0f766e" />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.sessionTitle}>Sesión activa</ThemedText>
            <ThemedText style={styles.sessionText}>Acceso seguro a Orcagest Mobile</ThemedText>
          </View>
        </View>
      </ThemedView>

      <Pressable style={styles.logoutBtn} onPress={logout}>
        <Ionicons name="log-out-outline" size={18} color="#dc2626" style={{ marginRight: 8 }} />
        <ThemedText style={styles.logoutText}>Cerrar sesión</ThemedText>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef3f6',
    padding: 16,
    paddingTop: 12,
    paddingBottom: 18,
    gap: 14,
  },
  heroCard: {
    backgroundColor: '#06141d',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(45, 165, 255, 0.14)',
    shadowColor: '#06141d',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    overflow: 'hidden',
    position: 'relative',
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoWrap: {
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
  logoMark: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  logoOrbit: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 4,
  },
  logoOrbitBack: {
    width: 22,
    height: 10,
    borderColor: '#206892',
    transform: [{ rotate: '-22deg' }, { translateY: -2 }],
  },
  logoOrbitFront: {
    width: 24,
    height: 12,
    borderColor: '#2da5ff',
    transform: [{ rotate: '20deg' }, { translateY: 3 }],
  },
  logoCore: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#9fd7ff',
  },
  brandTitle: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 1.2,
  },
  brandSub: {
    color: '#8acbfa',
    fontWeight: '800',
    fontSize: 11,
    marginTop: -2,
  },
  secureBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.18)',
    backgroundColor: 'rgba(22, 163, 74, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBlock: {
    marginTop: 18,
    gap: 5,
  },
  hello: {
    color: '#98c7e8',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  name: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 25,
    lineHeight: 29,
  },
  heroInfoPanel: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(159, 215, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    padding: 12,
    gap: 10,
  },
  heroInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroInfoIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(159, 215, 255, 0.13)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfoLabel: {
    color: '#9bb4c4',
    fontWeight: '800',
    fontSize: 10.5,
    textTransform: 'uppercase',
  },
  heroInfoText: {
    color: '#f8fbff',
    fontWeight: '800',
    fontSize: 13,
    marginTop: 1,
    textTransform: 'capitalize',
  },
  heroInfoDivider: {
    height: 1,
    backgroundColor: 'rgba(159, 215, 255, 0.12)',
  },
  sessionCard: {
    backgroundColor: '#f7fffb',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#cdeedd',
  },
  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sessionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#dff8e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionTitle: {
    color: '#0f766e',
    fontWeight: '900',
    fontSize: 13,
  },
  sessionText: {
    color: '#5d766e',
    fontWeight: '700',
    fontSize: 11.5,
    marginTop: 1,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: '#fff7f7',
    borderWidth: 1,
    borderColor: '#fecaca',
    shadowColor: '#e11d48',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  logoutText: {
    color: '#dc2626',
    fontWeight: '800',
    fontSize: 14,
  },
});
