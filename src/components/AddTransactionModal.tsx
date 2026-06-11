import React, { useState, useCallback } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS } from '../constants/colors';
import { INCOME_TYPES } from '../constants/categories';
import { formatCLP, parseNotification } from '../utils/parseNotification';
import { useApp, AddTransactionParams } from '../context/AppContext';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Step = 'direction' | 'expense' | 'income';

const SPLIT_OPTIONS = [2, 3, 4, 5, 6];

export function AddTransactionModal({ visible, onClose }: Props) {
  const { addTransaction } = useApp();

  const [step,         setStep]         = useState<Step>('direction');
  const [merchant,     setMerchant]     = useState('');
  const [amountRaw,    setAmountRaw]    = useState('');
  const [notifText,    setNotifText]    = useState('');
  const [incomeType,   setIncomeType]   = useState<string>('sueldo');
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitPeople,  setSplitPeople]  = useState(2);
  const [splitCustom,  setSplitCustom]  = useState('');
  const [splitRecov,   setSplitRecov]   = useState('');
  const [splitDesc,    setSplitDesc]    = useState('');
  const [isAdding,     setIsAdding]     = useState(false);

  const reset = useCallback(() => {
    setStep('direction'); setMerchant(''); setAmountRaw(''); setNotifText('');
    setIncomeType('sueldo'); setSplitEnabled(false); setSplitPeople(2);
    setSplitCustom(''); setSplitRecov(''); setSplitDesc(''); setIsAdding(false);
  }, []);

  const handleClose = useCallback(() => { reset(); onClose(); }, [reset, onClose]);

  const handleNotifChange = useCallback((text: string) => {
    setNotifText(text);
    if (text.length < 10) return;
    const parsed = parseNotification('', text);
    if (parsed) {
      if (parsed.merchant !== 'Desconocido') setMerchant(parsed.merchant);
      setAmountRaw(String(parsed.amount));
    }
  }, []);

  const parsedPeople = parseInt(splitCustom) || splitPeople;
  const amount       = parseInt(amountRaw.replace(/\D/g, '')) || 0;
  const myShare      = amount > 0 ? Math.round(amount / parsedPeople) : 0;
  const recovered    = parseInt(splitRecov.replace(/\D/g, '')) || 0;

  const handleAddExpense = useCallback(async () => {
    if (!merchant.trim() || amount <= 0) return;
    setIsAdding(true);
    try {
      const params: AddTransactionParams = {
        merchant: merchant.trim(), amount, type: 'compra', direction: 'out',
        rawText: notifText || undefined,
        split: splitEnabled
          ? { totalPeople: parsedPeople, recovered, description: splitDesc || 'Gasto compartido' }
          : null,
      };
      await addTransaction(params);
      handleClose();
    } finally { setIsAdding(false); }
  }, [merchant, amount, notifText, splitEnabled, parsedPeople, recovered, splitDesc, addTransaction, handleClose]);

  const handleAddIncome = useCallback(async () => {
    if (!merchant.trim() || amount <= 0) return;
    setIsAdding(true);
    try {
      await addTransaction({ merchant: merchant.trim(), amount, type: incomeType, direction: 'in' });
      handleClose();
    } finally { setIsAdding(false); }
  }, [merchant, amount, incomeType, addTransaction, handleClose]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            {step !== 'direction' && (
              <TouchableOpacity onPress={() => setStep('direction')} style={styles.backBtn}>
                <Text style={styles.backBtnText}>‹ Volver</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.headerTitle}>
              {step === 'direction' ? 'Nuevo movimiento'
                : step === 'expense' ? '💳 Agregar gasto'
                : '📥 Agregar ingreso'}
            </Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* PASO 1 — Dirección */}
            {step === 'direction' && (
              <View style={styles.dirWrap}>
                <TouchableOpacity style={styles.dirBtn} onPress={() => setStep('expense')}>
                  <View style={[styles.dirBtnIcon, { backgroundColor: '#FEF3E2' }]}>
                    <Text style={styles.dirBtnEmoji}>💳</Text>
                  </View>
                  <View style={styles.dirBtnInfo}>
                    <Text style={styles.dirBtnLabel}>Registrar gasto</Text>
                    <Text style={styles.dirBtnSub}>Compras, pagos, transferencias</Text>
                  </View>
                  <Text style={styles.dirArrow}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.dirBtn} onPress={() => setStep('income')}>
                  <View style={[styles.dirBtnIcon, { backgroundColor: COLORS.greenFaint }]}>
                    <Text style={styles.dirBtnEmoji}>📥</Text>
                  </View>
                  <View style={styles.dirBtnInfo}>
                    <Text style={styles.dirBtnLabel}>Registrar ingreso</Text>
                    <Text style={styles.dirBtnSub}>Sueldo, devoluciones, cobros</Text>
                  </View>
                  <Text style={styles.dirArrow}>›</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* PASO 2 — Gasto */}
            {step === 'expense' && (
              <View style={styles.formWrap}>
                <Text style={styles.fieldLabel}>Pegar notificación del banco (opcional)</Text>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  placeholder="Compra aprobada en JUMBO por $23.500..."
                  placeholderTextColor={COLORS.textMuted}
                  multiline numberOfLines={3}
                  value={notifText}
                  onChangeText={handleNotifChange}
                />

                <Text style={styles.fieldLabel}>Comercio *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: Jumbo Las Condes"
                  placeholderTextColor={COLORS.textMuted}
                  value={merchant}
                  onChangeText={setMerchant}
                />

                <Text style={styles.fieldLabel}>Monto (CLP) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="23500"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numeric"
                  value={amountRaw}
                  onChangeText={setAmountRaw}
                />
                {amount > 0 && (
                  <Text style={styles.amountPreview}>{formatCLP(amount)}</Text>
                )}

                {/* Toggle gasto compartido */}
                <TouchableOpacity
                  style={[styles.splitToggle, splitEnabled && styles.splitToggleActive]}
                  onPress={() => setSplitEnabled(e => !e)}
                >
                  <Text style={[styles.splitToggleText, splitEnabled && { color: COLORS.greenMid }]}>
                    👥 Gasto compartido {splitEnabled ? '▲' : '▼'}
                  </Text>
                </TouchableOpacity>

                {splitEnabled && (
                  <View style={styles.splitSection}>
                    <Text style={styles.fieldLabel}>¿Entre cuántos se divide?</Text>
                    <View style={styles.splitPeopleRow}>
                      {SPLIT_OPTIONS.map(n => (
                        <TouchableOpacity
                          key={n}
                          style={[styles.splitPeopleBtn, splitPeople === n && !splitCustom && styles.splitPeopleBtnActive]}
                          onPress={() => { setSplitPeople(n); setSplitCustom(''); }}
                        >
                          <Text style={[styles.splitPeopleBtnText, splitPeople === n && !splitCustom && { color: '#fff' }]}>
                            {n}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      <TextInput
                        style={[styles.splitPeopleInput, splitCustom ? styles.splitPeopleBtnActive : null]}
                        placeholder="+"
                        placeholderTextColor={COLORS.textMuted}
                        keyboardType="numeric"
                        value={splitCustom}
                        onChangeText={setSplitCustom}
                        maxLength={2}
                      />
                    </View>

                    {amount > 0 && parsedPeople > 1 && (
                      <View style={styles.splitPreview}>
                        <Text style={styles.splitPreviewLabel}>Tu parte:</Text>
                        <Text style={styles.splitPreviewAmt}>{formatCLP(myShare)}</Text>
                        <Text style={styles.splitPreviewOf}>de {formatCLP(amount)}</Text>
                      </View>
                    )}

                    <Text style={styles.fieldLabel}>Ya recuperé de mis amigos (opcional)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder={myShare > 0 ? String(myShare) : '0'}
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="numeric"
                      value={splitRecov}
                      onChangeText={setSplitRecov}
                    />

                    <Text style={styles.fieldLabel}>Descripción</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Ej: Asado cumpleaños"
                      placeholderTextColor={COLORS.textMuted}
                      value={splitDesc}
                      onChangeText={setSplitDesc}
                    />
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.submitBtn, (!merchant.trim() || amount <= 0 || isAdding) && styles.submitBtnDisabled]}
                  onPress={handleAddExpense}
                  disabled={!merchant.trim() || amount <= 0 || isAdding}
                >
                  <Text style={styles.submitBtnText}>{isAdding ? 'Agregando...' : 'Agregar gasto'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* PASO 2 — Ingreso */}
            {step === 'income' && (
              <View style={styles.formWrap}>
                <Text style={styles.fieldLabel}>Origen / Comercio *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: Empresa S.A."
                  placeholderTextColor={COLORS.textMuted}
                  value={merchant}
                  onChangeText={setMerchant}
                />

                <Text style={styles.fieldLabel}>Monto (CLP) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="1200000"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numeric"
                  value={amountRaw}
                  onChangeText={setAmountRaw}
                />
                {amount > 0 && (
                  <Text style={[styles.amountPreview, { color: COLORS.income }]}>{formatCLP(amount)}</Text>
                )}

                <Text style={styles.fieldLabel}>Tipo de ingreso</Text>
                <View style={styles.incomeGrid}>
                  {INCOME_TYPES.map(it => (
                    <TouchableOpacity
                      key={it.id}
                      style={[styles.incomeTypeBtn, incomeType === it.id && styles.incomeTypeBtnActive]}
                      onPress={() => setIncomeType(it.id)}
                    >
                      <Text style={styles.incomeTypeIcon}>{it.icon}</Text>
                      <Text style={[styles.incomeTypeLabel, incomeType === it.id && { color: COLORS.greenMid, fontWeight: '700' }]}>
                        {it.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, styles.submitBtnIncome, (!merchant.trim() || amount <= 0 || isAdding) && styles.submitBtnDisabled]}
                  onPress={handleAddIncome}
                  disabled={!merchant.trim() || amount <= 0 || isAdding}
                >
                  <Text style={styles.submitBtnText}>{isAdding ? 'Agregando...' : 'Agregar ingreso'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:           { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:             { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 40, maxHeight: '92%' },
  handle:            { width: 36, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  header:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: 8 },
  headerTitle:       { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  backBtn:           { position: 'absolute', left: 0, zIndex: 1 },
  backBtnText:       { color: COLORS.green, fontSize: 15 },
  closeBtn:          { position: 'absolute', right: 0, zIndex: 1, padding: 4 },
  closeBtnText:      { color: COLORS.textMuted, fontSize: 18 },
  dirWrap:           { paddingVertical: 16, gap: 10 },
  dirBtn:            { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.surfaceHigh, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  dirBtnIcon:        { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dirBtnEmoji:       { fontSize: 24 },
  dirBtnInfo:        { flex: 1 },
  dirBtnLabel:       { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  dirBtnSub:         { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  dirArrow:          { color: COLORS.textMuted, fontSize: 22 },
  formWrap:          { paddingTop: 4, gap: 4 },
  fieldLabel:        { color: COLORS.textMuted, fontSize: 11, fontWeight: '700', marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:             { backgroundColor: COLORS.surfaceHigh, borderRadius: 10, padding: 13, color: COLORS.textPrimary, fontSize: 14, borderWidth: 1.5, borderColor: COLORS.border },
  textarea:          { minHeight: 72, textAlignVertical: 'top' },
  amountPreview:     { color: COLORS.green, fontSize: 15, fontWeight: '700', marginTop: 4, marginLeft: 2 },
  splitToggle:       { marginTop: 14, padding: 13, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surfaceHigh, alignItems: 'center' },
  splitToggleActive: { borderColor: COLORS.green, backgroundColor: COLORS.greenFaint },
  splitToggleText:   { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  splitSection:      { backgroundColor: COLORS.surfaceHigh, borderRadius: 12, padding: 14, marginTop: 8, borderWidth: 1, borderColor: COLORS.border, gap: 2 },
  splitPeopleRow:    { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  splitPeopleBtn:    { width: 40, height: 40, borderRadius: 10, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.border },
  splitPeopleBtnActive: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  splitPeopleBtnText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  splitPeopleInput:  { width: 52, height: 40, borderRadius: 10, backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border, color: COLORS.textPrimary, fontSize: 13, textAlign: 'center', paddingHorizontal: 4 },
  splitPreview:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.greenFaint, borderRadius: 10, padding: 12, marginVertical: 6, borderWidth: 1, borderColor: COLORS.green + '40' },
  splitPreviewLabel: { color: COLORS.textSecondary, fontSize: 12 },
  splitPreviewAmt:   { color: COLORS.greenMid, fontSize: 16, fontWeight: '800', flex: 1 },
  splitPreviewOf:    { color: COLORS.textMuted, fontSize: 11 },
  incomeGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  incomeTypeBtn:     { flex: 1, minWidth: '45%', padding: 12, borderRadius: 12, backgroundColor: COLORS.surfaceHigh, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', gap: 4 },
  incomeTypeBtnActive: { borderColor: COLORS.green, backgroundColor: COLORS.greenFaint },
  incomeTypeIcon:    { fontSize: 22 },
  incomeTypeLabel:   { color: COLORS.textSecondary, fontSize: 11, fontWeight: '500', textAlign: 'center' },
  submitBtn:         { marginTop: 20, backgroundColor: COLORS.green, borderRadius: 14, padding: 16, alignItems: 'center' },
  submitBtnIncome:   { backgroundColor: COLORS.greenMid },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText:     { color: '#fff', fontSize: 15, fontWeight: '700' },
});
