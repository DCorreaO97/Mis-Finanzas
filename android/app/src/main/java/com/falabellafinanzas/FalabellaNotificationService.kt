package com.falabellafinanzas

import android.app.Notification
import android.content.Context
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONArray
import org.json.JSONObject

/**
 * NotificationListenerService que captura notificaciones del Banco Falabella
 * y las envía a React Native a través de un evento JS.
 *
 * Requiere permiso "Acceso a notificaciones" en Ajustes del sistema Android.
 *
 * Confiabilidad:
 *  - Deduplicación: Android puede re-postear la misma notificación (updates,
 *    agrupación); se descartan repetidos por clave pkg|postTime|hash(contenido).
 *  - Persistencia: la cola pendiente se guarda en SharedPreferences para
 *    sobrevivir si Android mata el proceso antes de abrir la app.
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

        private const val PREFS_NAME = "falabella_notif_queue"
        private const val KEY_QUEUE  = "pending"
        private const val KEY_SEEN   = "seen_keys"
        private const val MAX_QUEUE  = 50
        private const val MAX_SEEN   = 100

        private var jsCallback: ((WritableMap) -> Unit)? = null

        /**
         * Registra el callback de JS. Lo llama NotificationListenerModule al iniciar.
         * Vacía la cola persistida inmediatamente.
         */
        fun registerCallback(context: Context, cb: (WritableMap) -> Unit) {
            jsCallback = cb
            drainQueue(context.applicationContext, cb)
        }

        fun unregisterCallback() {
            jsCallback = null
        }

        private fun prefs(ctx: Context) =
            ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        @Synchronized
        private fun drainQueue(ctx: Context, cb: (WritableMap) -> Unit) {
            val raw = prefs(ctx).getString(KEY_QUEUE, null) ?: return
            prefs(ctx).edit().remove(KEY_QUEUE).apply()
            try {
                val arr = JSONArray(raw)
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    val params = Arguments.createMap().apply {
                        putString("title",     o.optString("title"))
                        putString("text",      o.optString("text"))
                        putString("package",   o.optString("package"))
                        putDouble("timestamp", o.optDouble("timestamp"))
                    }
                    cb(params)
                }
            } catch (_: Exception) {
                // JSON corrupto: se descarta la cola
            }
        }

        @Synchronized
        fun enqueue(ctx: Context, title: String, text: String, pkg: String, timestamp: Long) {
            try {
                val raw = prefs(ctx).getString(KEY_QUEUE, null)
                val arr = if (raw != null) JSONArray(raw) else JSONArray()
                // Cap: descartar los más antiguos si la cola crece demasiado
                val trimmed = JSONArray()
                val start = if (arr.length() >= MAX_QUEUE) arr.length() - MAX_QUEUE + 1 else 0
                for (i in start until arr.length()) trimmed.put(arr.getJSONObject(i))
                trimmed.put(JSONObject().apply {
                    put("title", title)
                    put("text", text)
                    put("package", pkg)
                    put("timestamp", timestamp)
                })
                prefs(ctx).edit().putString(KEY_QUEUE, trimmed.toString()).apply()
            } catch (_: Exception) { }
        }

        /** true si esta notificación ya fue procesada (dedupe persistente) */
        @Synchronized
        fun isDuplicate(ctx: Context, key: String): Boolean {
            val raw = prefs(ctx).getString(KEY_SEEN, "") ?: ""
            val seen = if (raw.isEmpty()) mutableListOf() else raw.split("\n").toMutableList()
            if (seen.contains(key)) return true
            seen.add(key)
            while (seen.size > MAX_SEEN) seen.removeAt(0)
            prefs(ctx).edit().putString(KEY_SEEN, seen.joinToString("\n")).apply()
            return false
        }
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        sbn ?: return
        val extras = sbn.notification?.extras ?: return

        // Ignorar notificaciones "resumen de grupo" (no traen la transacción real)
        if (sbn.notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) return

        val pkg   = sbn.packageName ?: ""
        val title = extras.getString(Notification.EXTRA_TITLE) ?: ""
        val text  = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
            ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.toString() ?: ""

        val combined = "$title $text".lowercase()

        // Filtrar: paquete conocido O contenido relevante
        val isFalabella = pkg in FALABELLA_PACKAGES ||
            CONTENT_KEYWORDS.any { combined.contains(it) }

        if (!isFalabella) return

        // Dedupe: Android re-postea notificaciones (updates, reagrupado).
        // Clave = paquete + hora de post + hash del contenido.
        val dedupeKey = "$pkg|${sbn.postTime}|${(title + text).hashCode()}"
        if (isDuplicate(applicationContext, dedupeKey)) return

        val cb = jsCallback
        if (cb != null) {
            // App activa: enviar directo
            val params = Arguments.createMap().apply {
                putString("title",     title)
                putString("text",      text)
                putString("package",   pkg)
                putDouble("timestamp", sbn.postTime.toDouble())
            }
            cb(params)
        } else if (tryEmitViaReactContext(title, text, pkg, sbn.postTime)) {
            // React context vivo aunque el módulo no registró callback: ya se emitió,
            // NO encolar (evita entrega duplicada)
        } else {
            // App cerrada: persistir en disco hasta la próxima apertura
            enqueue(applicationContext, title, text, pkg, sbn.postTime)
        }
    }

    private fun tryEmitViaReactContext(
        title: String, text: String, pkg: String, timestamp: Long
    ): Boolean {
        return try {
            val app = application as? ReactApplication ?: return false
            val ctx = app.reactNativeHost.reactInstanceManager.currentReactContext ?: return false
            val params = Arguments.createMap().apply {
                putString("title",     title)
                putString("text",      text)
                putString("package",   pkg)
                putDouble("timestamp", timestamp.toDouble())
            }
            val emitter = ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?: return false
            emitter.emit(EVENT_NAME, params)
            true
        } catch (_: Exception) {
            false
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
