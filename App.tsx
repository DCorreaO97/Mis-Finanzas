import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, TouchableOpacity, View } from 'react-native';
import * as Notifications from 'expo-notifications';

import { AppProvider, useApp } from './src/context/AppContext';
import { ResumenScreen }       from './src/screens/ResumenScreen';
import { HistorialScreen }     from './src/screens/HistorialScreen';
import { MovimientosScreen }   from './src/screens/MovimientosScreen';
import { PendientesScreen }    from './src/screens/PendientesScreen';
import { AjustesScreen }       from './src/screens/AjustesScreen';
import { AddTransactionModal } from './src/components/AddTransactionModal';
import { COLORS } from './src/constants/colors';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge:  false,
  }),
});

const Tab = createBottomTabNavigator();

function AddButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        width: 54, height: 54, borderRadius: 27,
        backgroundColor: COLORS.green,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 8,
        shadowColor: COLORS.green,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 8,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 28, lineHeight: 32, fontWeight: '300' }}>+</Text>
    </TouchableOpacity>
  );
}

function TabNavigator() {
  const { pendingCount } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          headerShown:             false,
          tabBarStyle:             {
            backgroundColor:   COLORS.surface,
            borderTopColor:    COLORS.border,
            borderTopWidth:    1,
            height:            72,
            paddingBottom:     10,
            paddingTop:        6,
          },
          tabBarActiveTintColor:   COLORS.green,
          tabBarInactiveTintColor: '#3A3A3A',
          tabBarLabelStyle:        { fontSize: 10, fontWeight: '600', marginTop: 1 },
        }}
      >
        <Tab.Screen
          name="Resumen"
          component={ResumenScreen}
          options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>📊</Text> }}
        />
        <Tab.Screen
          name="Historial"
          component={HistorialScreen}
          options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>📅</Text> }}
        />
        <Tab.Screen
          name="Agregar"
          component={ResumenScreen}
          options={{ tabBarButton: () => <AddButton onPress={() => setShowAddModal(true)} /> }}
        />
        <Tab.Screen
          name="Movimientos"
          component={MovimientosScreen}
          options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>💳</Text> }}
        />
        <Tab.Screen
          name="Pendientes"
          component={PendientesScreen}
          options={{
            tabBarIcon:       ({ color }) => <Text style={{ fontSize: 22, color }}>⚠️</Text>,
            tabBarBadge:      pendingCount > 0 ? pendingCount : undefined,
            tabBarBadgeStyle: { backgroundColor: COLORS.pending, color: '#fff', fontSize: 10 },
          }}
        />
        <Tab.Screen
          name="Ajustes"
          component={AjustesScreen}
          options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>⚙️</Text> }}
        />
      </Tab.Navigator>

      <AddTransactionModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      {/* dark → íconos oscuros sobre header blanco */}
      <StatusBar style="dark" />
      <NavigationContainer theme={{
        dark: false,
        colors: {
          primary:      COLORS.green,
          background:   COLORS.background,
          card:         COLORS.surface,
          text:         COLORS.textPrimary,
          border:       COLORS.border,
          notification: COLORS.pending,
        },
      }}>
        <TabNavigator />
      </NavigationContainer>
    </AppProvider>
  );
}
