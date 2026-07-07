package com.falabellafinanzas

import android.app.Notification
import android.content.Context
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

/**
 * NotificationListenerService que captura notificaciones del Banco Falabella.
 *
 * Modelo "pull": este servicio SOLO filtra y persiste en una cola en
 * SharedPreferences. El lado JS pide la cola con getPendingNotifications()
 * cuando está listo y confirma con ackNotifications(). Así no hay carreras
 * de entrega: si algo falla, la notificación sigue en disco y se reintenta.
 *
 * Requiere permiso "Acceso a notificaciones" en Ajustes del sistema Android.
 */
class FalabellaNotificationService : NotificationListenerService() {

    companion object {
        private const val TAG = "FinanzasChuma"

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

        private const val PREFS_NAME     = "falabella_notif_queue"
        private const val KEY_QUEUE      = "pending"
        private const val KEY_SEEN       = "seen_keys"
        private const val KEY_STAT_SEEN  = "stat_seen"    // total que pasó el filtro
        private const val KEY_LAST       = "last_notif"   // última vista (diagnóstico)
        private const val MAX_QUEUE      = 100
        private const val MAX_SEEN       = 200

        /** Campanilla: avisa al módulo (si la app está viva) que hay cola nueva. */
        @Volatile
        var onNewNotification: (() -> Unit)? = null

        private fun prefs(ctx: Context) =
            ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        /** Devuelve la cola completa SIN borrarla (JS confirma con ackQueue). */
        @Synchronized
        fun peekQueue(ctx: Context): JSONArray {
            val raw = prefs(ctx).getString(KEY_QUEUE, null) ?: return JSONArray()
            return try { JSONArray(raw) } catch (_: Exception) { JSONArray() }
        }

        /** Elimina las primeras [count] notificaciones (ya procesadas por JS). */
        @Synchronized
        fun ackQueue(ctx: Context, count: Int) {
            if (count <= 0) return
            val arr = peekQueue(ctx)
            val rest = JSONArray()
            for (i in count until arr.length()) rest.put(arr.getJSONObject(i))
            prefs(ctx).edit().putString(KEY_QUEUE, rest.toString()).apply()
        }

        /** Estadísticas para la pantalla de Ajustes: (vistas, en cola, última). */
        @Synchronized
        fun getStats(ctx: Context): Triple<Int, Int, String> {
            val p = prefs(ctx)
            return Triple(
                p.getInt(KEY_STAT_SEEN, 0),
                peekQueue(ctx).length(),
                p.getString(KEY_LAST, "") ?: ""
            )
        }

        @Synchronized
        private fun wasSeen(ctx: Context, key: String): Boolean {
            val raw = prefs(ctx).getString(KEY_SEEN, "") ?: ""
            return raw.isNotEmpty() && raw.split("\n").contains(key)
        }

        @Synchronized
        private fun markSeen(ctx: Context, key: String) {
            val raw = prefs(ctx).getString(KEY_SEEN, "") ?: ""
            val seen = if (raw.isEmpty()) mutableListOf() else raw.split("\n").toMutableList()
            seen.add(key)
            while (seen.size > MAX_SEEN) seen.removeAt(0)
            prefs(ctx).edit().putString(KEY_SEEN, seen.joinToString("\n")).apply()
        }

        @Synchronized
        private fun enqueue(ctx: Context, title: String, text: String, pkg: String, timestamp: Long) {
            val arr = peekQueue(ctx)
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
        }

        @Synchronized
        private fun bumpStats(ctx: Context, lastDesc: String) {
            val p = prefs(ctx)
            p.edit()
                .putInt(KEY_STAT_SEEN, p.getInt(KEY_STAT_SEEN, 0) + 1)
                .putString(KEY_LAST, lastDesc)
                .apply()
        }
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        processNotification(sbn)
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        Log.d(TAG, "Listener conectado — catch-up de notificaciones activas")
        // Catch-up: procesar lo que sigue visible en la barra (recupera compras
        // llegadas mientras el servicio estaba muerto). El dedupe evita dobles.
        try {
            activeNotifications?.forEach { processNotification(it) }
        } catch (e: Exception) {
            Log.w(TAG, "Catch-up falló: ${e.message}")
        }
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        Log.d(TAG, "Listener desconectado")
    }

    /** Pipeline único: filtrar → dedupe → persistir → avisar a JS. */
    private fun processNotification(sbn: StatusBarNotification?) {
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

        // Dedupe: clave = paquete + hora de post + hash del contenido
        val dedupeKey = "$pkg|${sbn.postTime}|${(title + text).hashCode()}"
        if (wasSeen(applicationContext, dedupeKey)) {
            Log.d(TAG, "Duplicada, ignorada: ${text.take(50)}")
            return
        }

        // Persistir PRIMERO y marcar como vista DESPUÉS:
        // si algo falla entre medio, se reintenta en el próximo catch-up
        enqueue(applicationContext, title, text, pkg, sbn.postTime)
        markSeen(applicationContext, dedupeKey)
        bumpStats(applicationContext, "$pkg · ${text.take(60)}")
        Log.d(TAG, "Encolada: $pkg → ${text.take(60)}")

        // Campanilla: si la app está abierta, JS hace pull inmediato
        onNewNotification?.invoke()
    }
}

/** Evento JS de "campanilla" — avisa que hay cola nueva; la fuente de verdad es el pull */
const val EVENT_NAME = "onFalabellaNotification"
