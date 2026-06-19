package com.falabellafinanzas

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * NotificationListenerService que captura notificaciones del Banco Falabella
 * y las envía a React Native a través de un evento JS.
 *
 * Requiere permiso "Acceso a notificaciones" en Ajustes del sistema Android.
 */
class FalabellaNotificationService : NotificationListenerService() {

    companion object {
        // Paquetes conocidos del Banco Falabella Chile
        // "cl.android" es el package name oficial de la app Banco Falabella Chile en Play Store
        val FALABELLA_PACKAGES: Set<String> = setOf(
            "cl.android",            // ← Banco Falabella Chile (Play Store, confirmado)
            "cl.bancofalabella",
            "cl.bancofalabella.app",
            "cl.falabella.banca",
            "com.falabella.banking",
            "com.falabella.banca",
            "cl.falabella.falabellaapp",
        )

        // Palabras clave en el contenido de la notificación (backup si el paquete no está en la lista)
        private val CONTENT_KEYWORDS = listOf(
            "compra aprobada", "cargo en tu tarjeta", "cargo en cuenta",
            "abono en tu cuenta", "transferencia recibida", "abono recibido",
            "débito en tu cuenta", "débito automático", "compra con tarjeta",
            "pago realizado", "banco falabella", "tarjeta cmr", "cmr falabella",
        )

        // Cola de notificaciones pendientes cuando la app está en background/cerrada
        private val pendingQueue = ArrayDeque<WritableMap>()
        private var jsCallback: ((WritableMap) -> Unit)? = null

        /**
         * Registra el callback de JS. Lo llama NotificationListenerModule al iniciar.
         * Vacía la cola pendiente inmediatamente.
         */
        fun registerCallback(cb: (WritableMap) -> Unit) {
            jsCallback = cb
            drainQueue(cb)
        }

        fun unregisterCallback() {
            jsCallback = null
        }

        private fun drainQueue(cb: (WritableMap) -> Unit) {
            synchronized(pendingQueue) {
                while (pendingQueue.isNotEmpty()) {
                    cb(pendingQueue.removeFirst())
                }
            }
        }

        private fun enqueue(params: WritableMap) {
            synchronized(pendingQueue) {
                if (pendingQueue.size >= 50) pendingQueue.removeFirst() // cap
                pendingQueue.addLast(params)
            }
        }
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        sbn ?: return
        val extras = sbn.notification?.extras ?: return

        val pkg   = sbn.packageName ?: ""
        val title = extras.getString(Notification.EXTRA_TITLE) ?: ""
        val text  = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
            ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.toString() ?: ""

        val combined = "$title $text".lowercase()

        // Filtrar: paquete conocido O contenido relevante
        val isFalabella = pkg in FALABELLA_PACKAGES ||
            CONTENT_KEYWORDS.any { combined.contains(it) }

        if (!isFalabella) return

        val params = Arguments.createMap().apply {
            putString("title",     title)
            putString("text",      text)
            putString("package",   pkg)
            putDouble("timestamp", sbn.postTime.toDouble())
        }

        val cb = jsCallback
        if (cb != null) {
            // App activa: enviar directo
            cb(params)
        } else {
            // App en background: encolar
            enqueue(params)
            // Intentar también via ReactContext directo
            tryEmitViaReactContext(params)
        }
    }

    private fun tryEmitViaReactContext(params: WritableMap) {
        try {
            val app = application as? ReactApplication ?: return
            val ctx = app.reactNativeHost.reactInstanceManager.currentReactContext ?: return
            ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit(EVENT_NAME, params)
        } catch (_: Exception) {
            // Silencioso: app cerrada o contexto no disponible
        }
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        // El servicio se conectó — se pueden cancelar notificaciones activas acá si se requiere
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        // El servicio se desconectó (p.ej. al revocar el permiso)
    }
}

/** Nombre del evento JS que escucha useNotificationListener.ts */
const val EVENT_NAME = "onFalabellaNotification"
