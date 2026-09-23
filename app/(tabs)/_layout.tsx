import { Redirect, Tabs, usePathname } from 'expo-router';
import React, { useContext } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../_layout';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();
  const { token, ready, role, paginas } = useContext(AuthContext);

  if (!ready) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#0f6fae" />
      </View>
    );
  }

  if (!token) {
    return <Redirect href="/login" />;
  }

  const normalizar = (value: any) => String(value || '').trim().toLowerCase();
  const rol = normalizar(role);
  const esRolInventario = rol === 'inventario';
  const estaEnInicio = pathname === '/' || pathname === '/index' || pathname === '/(tabs)';

  if (esRolInventario && estaEnInicio) {
    return <Redirect href="/(tabs)/inventariobodega" />;
  }

  const paginasPermitidas = Array.isArray(paginas) ? paginas.map(normalizar).filter(Boolean) : [];
  const tienePaginasEnToken = paginasPermitidas.length > 0;
  const tienePagina = (keys: string[]) => keys.some((key) => paginasPermitidas.includes(normalizar(key)));
  const puedeVer = (keys: string[], rolesFallback: string[] = []) => {
    if (tienePaginasEnToken) return tienePagina(keys);
    if (!rolesFallback.length) return true;
    return rolesFallback.map(normalizar).includes(rol);
  };

  return (
    <Tabs
      initialRouteName={esRolInventario ? 'inventariobodega' : 'index'}
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          href: !esRolInventario && puedeVer(['inicio', 'home', 'index'], ['admin', 'tecnico', 'soporte', 'operaciones', 'finanzas'])
            ? undefined
            : null,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="consultacentro"
        options={{
          title: 'Consulta centro',
          href: puedeVer(['consulta_centro', 'consultacentro'], ['admin', 'tecnico', 'soporte', 'operaciones'])
            ? undefined
            : null,
          tabBarIcon: ({ color }) => <Ionicons name="search-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="finalizados"
        options={{
          title: 'Finalizados',
          href: puedeVer(['finalizados'], ['admin', 'tecnico', 'operaciones']) ? undefined : null,
          tabBarIcon: ({ color }) => <Ionicons name="checkmark-done-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="informes"
        options={{
          title: 'Informes',
          href: puedeVer(['informes_centros', 'informes'], ['admin', 'tecnico', 'soporte', 'operaciones']) ? undefined : null,
          tabBarIcon: ({ color }) => <Ionicons name="document-text-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="rendiciones"
        options={{
          title: 'Rendiciones',
          href: puedeVer(['rendiciones'], ['admin', 'tecnico', 'finanzas']) ? undefined : null,
          tabBarIcon: ({ color }) => <Ionicons name="receipt-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inventariobodega"
        options={{
          title: 'Inventario',
          href: puedeVer(['inventario_bodega', 'inventariobodega'], ['admin', 'operaciones', 'inventario'])
            ? undefined
            : null,
          tabBarIcon: ({ color }) => <Ionicons name="barcode-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="armado"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <Ionicons name="person-circle-outline" size={26} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef3f6',
  },
});
