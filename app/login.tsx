import React, { useContext, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
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
      const data = await login(email.trim(), password.trim());
      const access = data.access_token || data.token;
      if (!access) throw new Error('Token no recibido');
      await setToken(access);
      router.replace('(tabs)');
    } catch (err: any) {
      console.error('Login error', err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        (err?.response?.status === 401
          ? 'Credenciales inválidas (email/contraseña).'
          : 'Servidor no disponible.');
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <Text style={styles.title}>ORCAGEST</Text>
        <Text style={styles.subtitle}>Inicia sesión con tu usuario registrado</Text>
        <Text style={styles.apiHint}>API: {BASE_URL}</Text>
        <View style={styles.form}>
          <Text style={styles.label}>Correo</Text>
          <TextInput
            style={styles.input}
            placeholder="correo@empresa.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="********"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleLogin} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? 'Ingresando...' : 'Ingresar'}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  title: {
    color: '#0b2040', // azul marino
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },
  subtitle: {
    color: '#334155',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 18,
  },
  apiHint: {
    color: '#64748b',
    textAlign: 'center',
    fontSize: 12,
    marginBottom: 10,
  },
  form: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  label: {
    color: '#334155',
    fontWeight: '600',
    fontSize: 13,
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  button: {
    marginTop: 10,
    backgroundColor: '#0b2040',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
