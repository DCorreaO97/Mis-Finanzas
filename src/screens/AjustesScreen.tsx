import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Alert, StyleSheet, Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeModules } from 'react-native';
import { useApp } from '../context/AppContext';
import { CATEGORIES, INCOME_TYPES } from '../constants/categories';
import { COLORS } from '../constants/colors';
import { Storage } from '../storage';

const { NotificationListener } = NativeModules;

export function AjustesScreen() {
  const { apiKey, setApiKey, merchantMemory, clearData, requestNotificationPermission } = useApp();

  const [apiKeyInput,    setApiKeyInput]    = useState(apiKey);
  const [showKey,        setShowKey]        = useState(false);
  const [notifGranted,   setNotifGranted]   = useState<boolean | null>(null);
  const [isSavingKey,    setIsSavingKey]    = useState(false);
  const [lastNotifPkg,   setLastNotifPkg]   = useState<string | null>(null);
  const [watchedPkgs,    setWatchedPkgs]    = useState<string[]>([]);
  const [showPkgDebug,   setShowPkgDebug]   = useState(false);

  useEffect(() => { setApiKeyInput(apiKey); }, [apiKey]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !NotificationListener) return;
    NotificationListener.isPermissionGranted()
      .then(setNotifGranted)
      .catch(() => setNotifGranted(false));
    NotificationListener.getWatchedPackages?.()
      .then((pkgs: string[]) => setWatchedPkgs(pkgs))
      .catch(() => {});
  }, []);

  const handleSaveKey = async () => {
    setIsSavingKey(true);
    await setApiKey(apiKeyInput);
    setIsSavingKey(false);
    Alert.alert('✅ Guardado', 'La API key se guardó correctamente.');
  };

  const handleClearData = () => {
    Alert.alert(
      'Limpiar todos los datos',
      '¿Estás seguro? Esto eliminará todas las transacciones y la memoria de comercios. La API key se conservará.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Limpiar', style: 'destructive', onPress: clearData },
      ]
    );
  };

  const handleDeleteMerchant = (key: string) => {
    Alert.alert(
      'Eliminar comercio',
      `¿Olvidar la categoría de "${key}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const updated = { ...merchantMemory };
            delete updated[key];
            await Storage.saveMerchantMemory(updated);
            Alert.alert('Eliminado', 'Se olvidó este comercio.');
          },
        },
      ]
    );
  };

  const maskedKey = apiKeyInput
    ? `${apiKeyInput.slice(0, 8)}${'•'.repeat(Math.max(0, apiKeyInput.length - 12))}${apiKeyInput.slice(-4)}`
    : '';

  const merchantEntries = Object.entries(merchantMemory);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ajustes</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ─── API Key ──────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🤖 API Key de Anthropic</Text>
          <Text style={styles.sectionDesc}>
            Permite que Claude AI categorice automáticamente los comercios nuevos.
          </Text>
          <View style={styles.keyRow}>
            <TextInput
              style={[styles.input, styles.keyInput]}
              value={showKey ? apiKeyInput : maskedKey}
              onChangeText={setApiKeyInput}
              placeholder="sk-ant-..."
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry={!showKey}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.showBtn} onPress={() => setShowKey(s => !s)}>
              <Text style={styles.showBtnText}>{showKey ? 'Ocultar' : 'Ver'}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.btn, isSavingKey && styles.btnDisabled]}
            onPress={handleSaveKey}
            disabled={isSavingKey}
          >
            <Text style={styles.btnText}>{isSavingKey ? 'Guardando...' : 'Guardar API Key'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL('https://console.anthropic.com')}>
            <Text style={styles.link}>Obtener key en console.anthropic.com →</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Notificaciones Android ──────────────── */}
        {Platform.OS === 'android' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔔 Lector Banco Falabella</Text>
            <Text style={styles.sectionDesc}>
              Cuando llegue una notificación del Banco Falabella, la app la leerá y registrará
              la transacción automáticamente.
            </Text>

            {/* Estado del permiso */}
            <View style={styles.permRow}>
              <View style={[styles.permDot, notifGranted === true && styles.permDotGreen]} />
              <Text style={styles.permText}>
                {notifGranted === null
                  ? 'Verificando...'
                  : notifGranted
                    ? '✓ Acceso a notificaciones activo'
                    : '✗ Sin acceso a notificaciones'}
              </Text>
            </View>

            {notifGranted === true && (
              <View style={styles.notifOkCard}>
                <Text style={styles.notifOkText}>
                  ✅ Todo listo. Las próximas compras con tu tarjeta CMR o movimientos en
                  Banco Falabella se registrarán automáticamente.
                </Text>
              </View>
            )}

            {!notifGranted && (
              <>
                <View style={styles.stepCard}>
                  <Text style={styles.stepTitle}>Cómo activarlo:</Text>
                  <Text style={styles.stepText}>1. Toca el botón de abajo</Text>
                  <Text style={styles.stepText}>2. En la lista, activa <Text style={styles.stepBold}>Finanzas Chuma</Text></Text>
                  <Text style={styles.stepText}>3. Acepta la advertencia de Android</Text>
                  <Text style={styles.stepText}>4. Vuelve a esta pantalla</Text>
                </View>
                <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={requestNotificationPermission}>
                  <Text style={[styles.btnText, { color: COLORS.green }]}>
                    Abrir Ajustes → Acceso a notificaciones
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* Debug: paquetes vigilados */}
            <TouchableOpacity
              style={styles.debugToggle}
              onPress={() => setShowPkgDebug(v => !v)}
            >
              <Text style={styles.debugToggleText}>
                {showPkgDebug ? '▲' : '▼'} Info técnica (paquetes vigilados)
              </Text>
            </TouchableOpacity>
            {showPkgDebug && (
              <View style={styles.debugBox}>
                <Text style={styles.debugTitle}>Paquetes Android que se escuchan:</Text>
                {watchedPkgs.map(p => (
                  <Text key={p} style={styles.debugPkg}>{p}</Text>
                ))}
                <Text style={styles.debugNote}>
                  Si tu app del Banco Falabella no está en esta lista, contáctame con el
                  nombre de paquete y lo agrego. Puedes verlo en Ajustes → Apps → Banco Falabella → info.
                </Text>
                {lastNotifPkg && (
                  <Text style={styles.debugPkg}>Último recibido: {lastNotifPkg}</Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* ─── iOS banner ───────────────────────────── */}
        {Platform.OS === 'ios' && (
          <View style={[styles.section, styles.iosBanner]}>
            <Text style={styles.iosBannerTitle}>📱 iPhone detectado</Text>
            <Text style={styles.iosBannerText}>
              iOS no permite que las apps lean notificaciones de otras apps.{'\n\n'}
              Usa el botón <Text style={{ fontWeight: '800', color: COLORS.greenMid }}>+</Text> y pega el texto de la notificación manualmente.
            </Text>
          </View>
        )}

        {/* ─── Memoria de comercios ─────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧠 Comercios recordados</Text>
          <Text style={styles.sectionDesc}>
            {merchantEntries.length === 0
              ? 'Aún no hay comercios aprendidos.'
              : `${merchantEntries.length} comercio${merchantEntries.length > 1 ? 's' : ''} categorizados automáticamente.`}
          </Text>
          {merchantEntries.map(([key, catId]) => {
            const cat    = CATEGORIES.find(c => c.id === catId);
            const income = INCOME_TYPES.find(i => i.id === catId);
            const icon   = cat?.icon ?? income?.icon ?? '❓';
            const label  = cat?.label ?? income?.label ?? catId;
            return (
              <View key={key} style={styles.memoryRow}>
                <View style={[styles.memoryIconWrap, { backgroundColor: (cat?.color ?? COLORS.green) + '18' }]}>
                  <Text style={styles.memoryIcon}>{icon}</Text>
                </View>
                <View style={styles.memoryInfo}>
                  <Text style={styles.memoryMerchant}>{key}</Text>
                  <Text style={styles.memoryCategory}>{label}</Text>
                </View>
                <TouchableOpacity style={styles.memoryDelBtn} onPress={() => handleDeleteMerchant(key)}>
                  <Text style={styles.memoryDelText}>✕</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* ─── Datos ────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🗃️ Datos</Text>
          <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={handleClearData}>
            <Text style={styles.btnText}>Limpiar todos los datos</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Falabella Finanzas v1.0.0</Text>
          <Text style={styles.footerSub}>Tus datos se guardan solo en este dispositivo.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: COLORS.background },
  header:           { backgroundColor: COLORS.surface, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle:      { color: COLORS.green, fontSize: 24, fontWeight: '800' },
  scroll:           { flex: 1, backgroundColor: COLORS.background, padding: 16 },
  section:          { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 },
  sectionTitle:     { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  sectionDesc:      { color: COLORS.textMuted, fontSize: 12, marginBottom: 12, lineHeight: 18 },
  keyRow:           { flexDirection: 'row', gap: 8, marginBottom: 10 },
  input:            { backgroundColor: COLORS.surfaceHigh, borderRadius: 10, padding: 13, color: COLORS.textPrimary, fontSize: 14, borderWidth: 1.5, borderColor: COLORS.border },
  keyInput:         { flex: 1 },
  showBtn:          { backgroundColor: COLORS.surfaceHigh, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.border },
  showBtnText:      { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  btn:              { backgroundColor: COLORS.green, borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 8 },
  btnOutline:       { backgroundColor: COLORS.greenFaint, borderWidth: 1.5, borderColor: COLORS.green },
  btnDanger:        { backgroundColor: '#FEEBEB', borderWidth: 1.5, borderColor: COLORS.expense + '60' },
  btnDisabled:      { opacity: 0.5 },
  btnText:          { color: '#fff', fontSize: 14, fontWeight: '700' },
  link:             { color: COLORS.green, fontSize: 12, textAlign: 'center', marginTop: 2 },
  permRow:          { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  permDot:          { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.expense },
  permDotGreen:     { backgroundColor: COLORS.income },
  permText:         { color: COLORS.textSecondary, fontSize: 13 },
  notifOkCard:      { backgroundColor: COLORS.greenFaint, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.green + '40' },
  notifOkText:      { color: COLORS.greenMid, fontSize: 12, lineHeight: 18 },
  stepCard:         { backgroundColor: COLORS.surfaceHigh, borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  stepTitle:        { color: COLORS.textPrimary, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  stepText:         { color: COLORS.textSecondary, fontSize: 12, marginBottom: 3 },
  stepBold:         { fontWeight: '700', color: COLORS.textPrimary },
  debugToggle:      { paddingVertical: 8, alignItems: 'center', marginTop: 4 },
  debugToggleText:  { color: COLORS.textMuted, fontSize: 11 },
  debugBox:         { backgroundColor: COLORS.surfaceHigh, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: COLORS.border },
  debugTitle:       { color: COLORS.textMuted, fontSize: 10, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase' },
  debugPkg:         { color: COLORS.green, fontSize: 11, fontFamily: 'monospace', marginBottom: 3 },
  debugNote:        { color: COLORS.textMuted, fontSize: 10, lineHeight: 15, marginTop: 8 },
  iosBanner:        { backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#C7D2FE' },
  iosBannerTitle:   { color: '#3730A3', fontSize: 14, fontWeight: '700', marginBottom: 6 },
  iosBannerText:    { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20 },
  memoryRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  memoryIconWrap:   { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  memoryIcon:       { fontSize: 18 },
  memoryInfo:       { flex: 1 },
  memoryMerchant:   { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
  memoryCategory:   { color: COLORS.textMuted, fontSize: 11, marginTop: 1 },
  memoryDelBtn:     { padding: 6 },
  memoryDelText:    { color: COLORS.textMuted, fontSize: 14 },
  footer:           { alignItems: 'center', paddingVertical: 24 },
  footerText:       { color: COLORS.textMuted, fontSize: 12, fontWeight: '600' },
  footerSub:        { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
});
