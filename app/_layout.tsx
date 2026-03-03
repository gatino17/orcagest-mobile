import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import React, { createContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { jwtDecode } from 'jwt-decode';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

type AuthContextType = {
  token: string | null;
  role: string | null;
  name: string | null;
  userId: number | null;
  setToken: (t: string | null) => void;
};

export const AuthContext = createContext<AuthContextType>({
  token: null,
  role: null,
  name: null,
  userId: null,
  setToken: () => {},
});

const extractRole = (token: string | null) => {
  if (!token) return null;
  try {
    const payload: any = jwtDecode(token);
    return payload?.rol || payload?.role || payload?.user_role || payload?.usuario?.rol || null;
  } catch (_e) {
    return null;
  }
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [token, setTokenState] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync('token')
      .then((value) => {
        setTokenState(value);
        setRole(extractRole(value));
        try {
          const payload: any = value ? jwtDecode(value) : null;
          setName(payload?.name || payload?.nombre || payload?.username || null);
          setUserId(payload?.id || payload?.user_id || payload?.sub || null);
        } catch (_e) {
          setName(null);
          setUserId(null);
        }
      })
      .finally(() => setReady(true));
  }, []);

  const setToken = async (value: string | null) => {
    setTokenState(value);
    setRole(extractRole(value));
    try {
      const payload: any = value ? jwtDecode(value) : null;
      setName(payload?.name || payload?.nombre || payload?.username || null);
      setUserId(payload?.id || payload?.user_id || payload?.sub || null);
    } catch (_e) {
      setName(null);
      setUserId(null);
    }
    if (value) {
      await SecureStore.setItemAsync('token', value);
    } else {
      await SecureStore.deleteItemAsync('token');
    }
  };

  const ctx = useMemo(() => ({ token, role, name, userId, setToken }), [token, role, name, userId]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthContext.Provider value={ctx}>
        {!ready ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator />
          </View>
        ) : (
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
        )}
      </AuthContext.Provider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
