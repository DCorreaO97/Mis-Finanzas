package com.falabellafinanzas

import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import android.service.notification.NotificationListenerService
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Módulo React Native del lector de notificaciones (modelo "pull"):
 *  - getPendingNotifications() → Promise<Array>  cola persistida, SIN borrar
 *  - ackNotifications(count)                     confirma N procesadas (las borra)
 *  - getDebugStats()           → Promise<Map>    {seen, queued, last} para Ajustes
 *  - isPermissionGranted()     → Promise<Boolean>
 *  - openPermissionSettings()                    abre Ajustes del sistema
 *
 * El evento "onFalabellaNotification" es solo una campanilla: avisa a JS que
 * hay cola nueva para que haga pull inmediato. Si el evento se pierde, no
 * importa — el pull al abrir la app / volver a primer plano lo recupera.
 */
class NotificationListenerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "NotificationListener"

    override fun initialize() {
        super.initialize()
        registerBell()
        // Forzar re-vinculación del listener: tras actualizar la app, Android
        // a veces deja el servicio desconectado hasta un reinicio. Esto lo
        // reconecta (y dispara onListenerConnected → catch-up de notifs).
        try {
            NotificationListenerService.requestRebind(
                ComponentName(reactApplicationContext, FalabellaNotificationService::class.java)
            )
        } catch (_: Exception) {
            // Sin permiso o API antigua: inofensivo
        }
    }

    override fun invalidate() {
        FalabellaNotificationService.onNewNotification = null
        super.invalidate()
    }

    /** Campanilla hacia JS cuando el servicio encola algo con la app viva */
    private fun registerBell() {
        FalabellaNotificationService.onNewNotification = { emitBell() }
    }

    private fun emitBell() {
        try {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit(EVENT_NAME, null)
        } catch (_: Exception) {
            // React context caído: el pull al reabrir recupera la cola
        }
    }

    /** Cola pendiente completa, sin borrarla (confirmar con ackNotifications) */
    @ReactMethod
    fun getPendingNotifications(promise: Promise) {
        try {
            val arr = FalabellaNotificationService.peekQueue(reactApplicationContext)
            val out = Arguments.createArray()
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                out.pushMap(Arguments.createMap().apply {
                    putString("title",     o.optString("title"))
                    putString("text",      o.optString("text"))
                    putString("package",   o.optString("package"))
                    putDouble("timestamp", o.optDouble("timestamp"))
                })
            }
            promise.resolve(out)
        } catch (e: Exception) {
            promise.reject("ERR_QUEUE", e)
        }
    }

    /** Confirma que JS procesó las primeras [count] — se eliminan de la cola */
    @ReactMethod
    fun ackNotifications(count: Int, promise: Promise) {
        try {
            FalabellaNotificationService.ackQueue(reactApplicationContext, count)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR_ACK", e)
        }
    }

    /** Estado del motor para la pantalla de Ajustes */
    @ReactMethod
    fun getDebugStats(promise: Promise) {
        try {
            val (seen, queued, last) = FalabellaNotificationService.getStats(reactApplicationContext)
            promise.resolve(Arguments.createMap().apply {
                putInt("seen",   seen)
                putInt("queued", queued)
                putString("last", last)
            })
        } catch (e: Exception) {
            promise.reject("ERR_STATS", e)
        }
    }

    /** Verifica si el permiso de acceso a notificaciones está activo */
    @ReactMethod
    fun isPermissionGranted(promise: Promise) {
        try {
            val pkgName = reactApplicationContext.packageName
            val listeners = Settings.Secure.getString(
                reactApplicationContext.contentResolver,
                "enabled_notification_listeners"
            )
            val granted = !listeners.isNullOrEmpty() && listeners.contains(pkgName)
            promise.resolve(granted)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    /** Abre la pantalla de Ajustes del sistema para dar acceso a notificaciones */
    @ReactMethod
    fun openPermissionSettings() {
        try {
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /** Devuelve los paquetes filtrados actualmente (útil para debugging) */
    @ReactMethod
    fun getWatchedPackages(promise: Promise) {
        val arr = Arguments.createArray()
        FalabellaNotificationService.FALABELLA_PACKAGES.forEach { arr.pushString(it) }
        promise.resolve(arr)
    }

    // ── Requeridos por NativeEventEmitter de React Native ──────────────────
    @ReactMethod
    fun addListener(eventName: String) {
        // JS acaba de suscribirse: (re)registrar la campanilla en este contexto
        // vivo — cierra la carrera donde initialize() corrió antes de tiempo —
        // y avisar de inmediato si ya hay cola esperando.
        registerBell()
        try {
            if (FalabellaNotificationService.peekQueue(reactApplicationContext).length() > 0) {
                emitBell()
            }
        } catch (_: Exception) { }
    }

    @ReactMethod
    fun removeListeners(count: Int) { /* required */ }
}
