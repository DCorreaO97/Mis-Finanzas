package com.falabellafinanzas

import android.content.Intent
import android.provider.Settings
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Módulo React Native que expone:
 *  - isPermissionGranted()     → Promise<Boolean>
 *  - openPermissionSettings()  → abre pantalla de acceso a notificaciones
 *  - addListener / removeListeners (requeridos por NativeEventEmitter en RN)
 *
 * También registra el callback en FalabellaNotificationService para que
 * las notificaciones encoladas (app en background) lleguen al JS al abrir la app.
 */
class NotificationListenerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "NotificationListener"

    override fun initialize() {
        super.initialize()
        // Cuando el módulo se inicializa, registrar el callback y vaciar la cola
        FalabellaNotificationService.registerCallback { params ->
            sendEvent(params)
        }
    }

    override fun invalidate() {
        FalabellaNotificationService.unregisterCallback()
        super.invalidate()
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
    fun addListener(eventName: String) { /* required */ }

    @ReactMethod
    fun removeListeners(count: Int) { /* required */ }

    // ── Helper interno ──────────────────────────────────────────────────────
    private fun sendEvent(params: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(EVENT_NAME, params)
    }
}
