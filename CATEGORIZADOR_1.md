# CATEGORIZADOR 1 — Contexto de sesión
> Di "volvamos al categorizador 1" para retomar desde aquí.

---

## ¿Qué es esta app?

**Falabella Finanzas** — App React Native (Expo bare workflow) para gestión de gastos personales.

- Lee notificaciones push del **Banco Falabella** en Android automáticamente
- En iOS: el usuario pega el texto manualmente (Apple no permite leer notificaciones de otras apps)
- Categoriza gastos con **Claude AI (Anthropic)** y recuerda comercios ya categorizados
- Maneja ingresos, gastos, gastos divididos y pendientes
- Pantallas: Resumen, Historial, Movimientos, Pendientes, Ajustes

---

## Ubicación del proyecto

```
C:\Proyectos\FalabellaFinanzas\
```

---

## Estado actual del código ✅

### Diseño visual
- Tema claro estilo Banco Falabella
- **Header blanco** con **título en verde Falabella `#00A651`**
- Fondo general: `#F4F5F7` (gris muy claro)
- Cards blancas con sombra sutil
- Tab bar blanca con íconos verdes (activo) y `#3A3A3A` (inactivo)
- `StatusBar` en modo `"dark"` (íconos oscuros sobre fondo blanco)

### Colores principales (`src/constants/colors.ts`)
```
green:       '#00A651'   // Verde primario Falabella
greenDark:   '#006B35'   // Verde oscuro (ya NO se usa en headers)
background:  '#F4F5F7'
surface:     '#FFFFFF'
textPrimary: '#1A1A1A'
textMuted:   '#999999'
expense:     '#E53935'
pending:     '#F57C00'
```

### Archivos clave
| Archivo | Estado |
|---------|--------|
| `App.tsx` | ✅ Listo — tab bar, StatusBar dark, navegación |
| `src/constants/colors.ts` | ✅ Listo — colores Falabella |
| `src/screens/ResumenScreen.tsx` | ✅ Header blanco, título verde |
| `src/screens/MovimientosScreen.tsx` | ✅ Header blanco, título verde |
| `src/screens/HistorialScreen.tsx` | ✅ Header blanco, título verde |
| `src/screens/PendientesScreen.tsx` | ✅ Header blanco, título verde |
| `src/screens/AjustesScreen.tsx` | ✅ Header blanco, título verde |
| `src/components/TransactionItem.tsx` | ✅ Listo |
| `src/components/AddTransactionModal.tsx` | ✅ Listo |
| `src/context/AppContext.tsx` | ✅ Listo — estado global, datos de muestra |
| `android/...` (Kotlin) | ✅ Listo — NotificationListenerService |
| `preview/index.html` | ✅ Demo browser funcionando |

### Módulos nativos Android (Kotlin)
- `FalabellaNotificationService.kt` — intercepta notificaciones del Banco Falabella
- `NotificationListenerModule.kt` — puente Kotlin ↔ JavaScript
- `NotificationListenerPackage.kt` — registra el módulo
- `MainApplication.kt` — incluye el paquete
- `AndroidManifest.xml` — permisos declarados

---

## Estado de instalación ✅

La app ya fue compilada e instalada en el celular (Samsung SM-S948B) en modo **debug**.

### Variables de entorno configuradas (para el usuario `domin`):
- `JAVA_HOME` = `C:\Program Files\Android\Android Studio\jbr`
- `ANDROID_HOME` = `C:\Users\domin\AppData\Local\Android\Sdk`
- ADB en PATH: `C:\Users\domin\AppData\Local\Android\Sdk\platform-tools`
- `android\local.properties` ya creado con `sdk.dir`

### Build de producción ✅

La app fue compilada en modo release (`--variant release`) y está instalada en el Samsung SM-S948B. Funciona sin cable USB ni Metro Bundler.

---

## Cambios pendientes de compilar (código ya modificado ✅)

Los siguientes cambios están en el código pero **aún NO se han compilado** — requieren un nuevo build:

### 1. Nombre cambiado ✅ (en código)
- `app.json`: "Falabella Finanzas" → "Mis Gastos"
- `android/app/src/main/res/values/strings.xml`: ídem

### 2. Datos reales del Excel cargados ✅ (en código)
- `src/context/AppContext.tsx`: `buildSampleData()` reemplazada con las 42 transacciones reales del archivo Excel del usuario (Mayo–Junio 2026)
- Categorías asignadas automáticamente: supermercado, ropa, restaurantes, transporte, deporte, departamento, carrete, devolucion
- Entradas sin categoría (MERCADOPAGO sin contexto, etc.) quedan como `null` para categorizar con Claude AI
- **Después del build**: el usuario debe ir a Ajustes → "Borrar todos los datos" para que se carguen los datos reales

### 3. Ícono ⚠️ (pendiente de archivo)
- El usuario tiene una imagen con ícono nuevo (checkmark verde + símbolo $)
- Necesita guardar esa imagen en: `C:\Proyectos\FalabellaFinanzas\assets\icon.png` y también como `adaptive-icon.png`
- Sin este paso, el ícono en el celular no cambia

### Próximo paso al retomar:
1. Pedir al usuario que guarde el ícono en `assets/`
2. Lanzar el build de producción:
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "C:\Users\domin\AppData\Local\Android\Sdk"
$env:PATH = "$env:JAVA_HOME\bin;C:\Users\domin\AppData\Local\Android\Sdk\platform-tools;$env:PATH"
cd C:\Proyectos\FalabellaFinanzas
npx expo run:android --variant release
```
3. Después del build: abrir app → Ajustes → Borrar todos los datos → los datos reales se cargan solos

---

## Próximos pasos adicionales (post-build)
- Activar acceso a notificaciones: app → Ajustes → "Activar acceso a notificaciones"
- Configurar API key de Claude en Ajustes

---

## Features para el futuro
- [ ] Importar movimientos históricos desde CSV
- [ ] Gráficos de evolución mensual
- [ ] Exportar datos

---

## Notas técnicas
- La app usa **Expo bare workflow** (NO managed) — necesita compilación nativa
- NO funciona con Expo Go por el módulo de notificaciones
- API de categorización: Claude Haiku (`claude-haiku-4-5-20251001`)
- Storage: AsyncStorage (todo local, sin backend)
- Al primer arranque carga 3 meses de datos de muestra
