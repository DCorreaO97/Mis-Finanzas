import { useEffect, useRef } from 'react';
import { NativeModules, NativeEventEmitter, Platform, Alert } from 'react-native';

const { NotificationListener } = NativeModules;

export interface FalabellaNotification {
  title:     string;
  text:      string;
  package:   string;
  timestamp: number;
}

export function useNotificationListener(
  onNotification: (notif: FalabellaNotification) => void
): { requestPermission: () => void } {
  const callbackRef = useRef(onNotification);
  useEffect(() => { callbackRef.current = onNotification; });

  useEffect(() => {
    if (Platform.OS !== 'android' || !NotificationListener) return;

    const emitter = new NativeEventEmitter(NotificationListener);
    const subscription = emitter.addListener(
      'onFalabellaNotification',
      (data: FalabellaNotification) => callbackRef.current(data)
    );

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

    return () => subscription.remove();
  }, []);

  return {
    requestPermission: () => {
      if (Platform.OS === 'android' && NotificationListener) {
        NotificationListener.openPermissionSettings();
      }
    },
  };
}
