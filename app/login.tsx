import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AuthContext } from './_layout';
import { login, BASE_URL } from '@/lib/api';

export default function LoginScreen() {
  const router = useRouter();
  const { setToken, token } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      router.replace('(tabs)');
    }
  }, [token, router]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Datos incompletos', 'Ingresa tu correo y contraseña');
      return;
    }
    setLoading(true);
    try {
      const data = await login(email.trim(), password);
      const access = data.access_token || data.token;
      if (!access) throw new Error('Token no recibido');
      try {
        await setToken(access);
        router.replace('(tabs)');
      } catch (localErr: any) {
        console.error('Login post-auth error', localErr);
        Alert.alert(
          'Error',
          localErr?.message || 'El login respondió correctamente, pero no se pudo guardar la sesión en el dispositivo.'
        );
      }
    } catch (err: any) {
      console.error('Login error', err);
      const status = Number(err?.response?.status || 0) || 0;
      const backendMsg = err?.response?.data?.message || err?.response?.data?.detail || err?.response?.data?.error || '';
      const msg =
        status === 401
          ? 'Credenciales inválidas (correo/contraseña).'
          : err?.code === 'ECONNABORTED'
            ? 'El servidor tardó demasiado en responder. Intenta nuevamente.'
            : backendMsg || err?.message || ('Servidor no disponible' + (status ? ' (HTTP ' + status + ')' : '') + '.');
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.background}>
          <View style={styles.glowTop} />
          <View style={styles.glowBottom} />
          <View style={styles.gridVerticalA} />
          <View style={styles.gridVerticalB} />
          <View style={styles.gridVerticalC} />
        </View>

        <View style={styles.brandBlock}>
          <View style={styles.brandMark}>
            <View style={[styles.orbitRing, styles.orbitRingBack]} />
            <View style={[styles.orbitRing, styles.orbitRingFront]} />
            <View style={[styles.orbitRing, styles.orbitRingAccent]} />
            <View style={styles.brandCore} />
            <View style={[styles.pixel, styles.pixelOne]} />
            <View style={[styles.pixel, styles.pixelTwo]} />
            <View style={[styles.pixel, styles.pixelThree]} />
            <View style={[styles.pixel, styles.pixelFour]} />
            <View style={[styles.pixel, styles.pixelFive]} />
            <View style={[styles.pixel, styles.pixelSix]} />
          </View>

          <View style={styles.brandTextWrap}>
            <Text style={styles.brandTitle}>ORCAGEST</Text>
            <Text style={styles.brandSubtitle}>GMS</Text>
            <Text style={styles.brandCaption}>Gestión móvil operativa</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View>
              <Text style={styles.eyebrow}>Acceso seguro</Text>
              <Text style={styles.heading}>Iniciar sesión</Text>
            </View>
            <View style={styles.lockBadge}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#9fd7ff" />
            </View>
          </View>

          <Text style={styles.supportText}>Ingresa con tu cuenta registrada para acceder a la operación móvil.</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Correo</Text>
            <View style={styles.inputShell}>
              <Ionicons name="mail-outline" size={18} color="#67c1ff" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="correo@empresa.com"
                placeholderTextColor="#6f8aa1"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.inputShell}>
              <Ionicons name="key-outline" size={18} color="#67c1ff" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#6f8aa1"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                value={password}
                onChangeText={setPassword}
              />
            </View>
          </View>

          <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleLogin} disabled={loading}>
            <Ionicons name={loading ? 'sync-outline' : 'log-in-outline'} size={18} color="#ffffff" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>{loading ? 'Ingresando...' : 'Ingresar'}</Text>
          </Pressable>

          <View style={styles.footerInfo}>
            <View style={styles.footerChip}>
              <Ionicons name="cloud-outline" size={13} color="#7dd3fc" />
              <Text style={styles.footerChipText}>API activa</Text>
            </View>
            <Text style={styles.apiHint} numberOfLines={1}>
              {BASE_URL}
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#eef3f6',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#eef3f6',
  },
  glowTop: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(6, 20, 29, 0.82)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: 40,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(103, 193, 255, 0.12)',
  },
  gridVerticalA: {
    position: 'absolute',
    left: '18%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.16)',
  },
  gridVerticalB: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
  },
  gridVerticalC: {
    position: 'absolute',
    right: '18%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.16)',
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brandMark: {
    width: 170,
    height: 128,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 12,
  },
  orbitRingBack: {
    width: 132,
    height: 58,
    borderColor: '#1c5f8c',
    transform: [{ rotate: '-21deg' }, { translateY: -11 }],
  },
  orbitRingFront: {
    width: 148,
    height: 72,
    borderColor: '#2da5ff',
    transform: [{ rotate: '20deg' }, { translateY: 10 }],
  },
  orbitRingAccent: {
    width: 84,
    height: 84,
    borderColor: '#8bd2ff',
    borderWidth: 10,
  },
  brandCore: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#b6e2ff',
    shadowColor: '#8bd2ff',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  pixel: {
    position: 'absolute',
    backgroundColor: '#7ecbff',
    borderRadius: 3,
  },
  pixelOne: {
    width: 16,
    height: 16,
    top: 8,
    right: 28,
  },
  pixelTwo: {
    width: 13,
    height: 13,
    top: 22,
    right: 12,
  },
  pixelThree: {
    width: 10,
    height: 10,
    top: 34,
    right: 30,
  },
  pixelFour: {
    width: 15,
    height: 15,
    bottom: 26,
    left: 18,
    backgroundColor: '#d7f0ff',
  },
  pixelFive: {
    width: 11,
    height: 11,
    bottom: 40,
    left: 38,
    backgroundColor: '#b2e1ff',
  },
  pixelSix: {
    width: 9,
    height: 9,
    bottom: 32,
    left: 6,
    backgroundColor: '#9fd7ff',
  },
  brandTextWrap: {
    alignItems: 'center',
  },
  brandTitle: {
    color: '#f8fbff',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 5.5,
  },
  brandSubtitle: {
    marginTop: 2,
    color: '#3ca7ff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 8,
  },
  brandCaption: {
    marginTop: 8,
    color: '#6c8395',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#fbfdff',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#d7e3ec',
    padding: 22,
    shadowColor: '#9db7ca',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: '#5db9ff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  heading: {
    color: '#163041',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 4,
  },
  lockBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f4fd',
    borderWidth: 1,
    borderColor: '#cfe4f3',
  },
  supportText: {
    marginTop: 10,
    marginBottom: 18,
    color: '#6c8395',
    fontSize: 14,
    lineHeight: 21,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    color: '#4c6476',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d7e3ec',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    minHeight: 56,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#163041',
    fontSize: 15,
    paddingVertical: 14,
  },
  button: {
    marginTop: 8,
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: '#1387df',
    borderWidth: 1,
    borderColor: 'rgba(36, 148, 232, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#0ea5e9',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.4,
  },
  footerInfo: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#dce7ef',
    gap: 8,
  },
  footerChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#edf6fd',
    borderWidth: 1,
    borderColor: '#d7e3ec',
  },
  footerChipText: {
    marginLeft: 6,
    color: '#3d6178',
    fontSize: 12,
    fontWeight: '700',
  },
  apiHint: {
    color: '#6f8aa1',
    fontSize: 11,
  },
});
