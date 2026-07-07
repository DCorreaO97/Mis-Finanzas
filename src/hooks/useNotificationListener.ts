import { useEffect, useRef, useCallback } from 'react';
import {
  NativeModules, NativeEventEmitter, Platform, Alert, AppState,
} from 'react-native';

const { NotificationListener } = NativeModules;

export interface FalabellaNotification {
  title:     string;
  text:      string;
  package:   string;
  timestamp: number;
}

/**
 * Modelo "pull": la fuente de verdad es la cola persistida en el lado nativo.
 * Este hook la drena (getPendingNotifications → procesar → ackNotifications)
 * en tres momentos: al montar, al volver la app a primer plano, y cuando el
 * nativo avisa con la campanilla "onFalabellaNotification".
 * Cada notificación se confirma (ack) SOLO después de procesada: si la app
 * muere a mitad de camino, lo no confirmado se reintenta en el próximo pull.
 */
export function useNotificationListener(
  onNotification: (notif: FalabellaNotification) => void | Promise<void>
): { requestPermission: () => void } {
  const callbackRef = useRef(onNotification);
  useEffect(() => { callbackRef.current = onNotification; });

  const pullingRef = useRef(false);

  const pullPending = useCallback(async () => {
    if (Platform.OS !== 'android' || !NotificationListener) return;
    if (pullingRef.current) return;   // evitar pulls concurrentes
    pullingRef.current = true;
    try {
      const pending: FalabellaNotification[] =
        await NotificationListener.getPendingNotifications();
      for (const notif of pending) {
        try {
          await callbackRef.current(notif);
        } catch {
          // Error procesando una: igual se confirma para no bloquear la cola
        }
        await NotificationListener.ackNotifications(1);
      }
    } catch {
      // Módulo no disponible: se reintenta en el próximo pull
    } finally {
      pullingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android' || !NotificationListener) return;

    // Campanilla: el nativo avisa que hay cola nueva → pull inmediato
    const emitter = new NativeEventEmitter(NotificationListener);
    const subscription = emitter.addListener('onFalabellaNotification', () => {
      pullPending();
    });

    // Pull inicial: recupera lo acumulado mientras la app estuvo cerrada
    pullPending();

    // Pull al volver a primer plano (compras hechas con la app en background)
    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') pullPending();
    });

    NotificationListener.isPermissionGranted()
      .then((granted: boolean) => {
        if (!granted) {
          Alert.alert(
            'Permiso de notificaciones',
            'Para registrar automáticamente tus movimientos bancarios, necesitas dar acceso a las notificaciones.',
            [
              { text: 'Más tarde', style: 'cancel' },
              {
                text: 'Ir a configuración',
                onPress: () => NotificationListener.openPermissionSettings(),
              },
            ]
          );
        }
      })
      .catch(console.warn);

    return () => {
      subscription.remove();
      appStateSub.remove();
    };
  }, [pullPending]);

  return {
    requestPermission: () => {
      if (Platform.OS === 'android' && NotificationListener) {
        NotificationListener.openPermissionSettings();
      }
    },
  };
}
