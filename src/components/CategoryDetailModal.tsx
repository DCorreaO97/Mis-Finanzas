import React, { useState, useMemo, useCallback } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { CATEGORIES } from '../constants/categories';
import { COLORS } from '../constants/colors';
import { formatCLP } from '../utils/parseNotification';

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

interface Props {
  visible:    boolean;
  categoryId: string | null;
  year:       number;
  month:      number;   // 0-based
  onClose:    () => void;
}

/**
 * Panel deslizable desde abajo con los movimientos de una categoría en
 * un mes. Tocar un movimiento despliega la edición: nombre y categoría.
 */
export function CategoryDetailModal({ visible, categoryId, year, month, onClose }: Props) {
  const { transactions, updateTransaction } = useApp();

  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editMerchant, setEditMerchant] = useState('');
  const [editCat,      setEditCat]      = useState<string>('');

  const cat = CATEGORIES.find(c => c.id === categoryId);

  const txs = useMemo(() => {
    if (!categoryId) return [];
    return transactions
      .filter(t => {
        const d = new Date(t.date);
        return t.category === categoryId &&
          t.type !== 'pago_interno' &&
          d.getFullYear() === year && d.getMonth() === month;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, categoryId, year, month]);

  const total = useMemo(() => txs.reduce((s, t) =>
    t.direction === 'out'
      ? s + Math.abs(t.amount)
      : s - Math.abs(t.amount),   // devoluciones restan
  0), [txs]);

  const startEdit = useCallback((txId: string, merchant: string, category: string | null) => {
    setEditingId(txId);
    setEditMerchant(merchant);
    setEditCat(category ?? '');
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditMerchant('');
    setEditCat('');
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    await updateTransaction(editingId, {
      merchant: editMerchant,
      ...(editCat ? { category: editCat } : {}),
    });
    cancelEdit();
  }, [editingId, editMerchant, editCat, updateTransaction, cancelEdit]);

  const handleClose = useCallback(() => {
    cancelEdit();
    onClose();
  }, [cancelEdit, onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        {/* Tocar el fondo cierra el panel */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.headerIconWrap, { backgroundColor: (cat?.color ?? COLORS.green) + '20' }]}>
              <Text style={styles.headerIcon}>{cat?.icon ?? '📦'}</Text>
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>{cat?.label ?? categoryId}</Text>
              <Text style={styles.headerSub}>
                {MONTH_NAMES[month]} {year} · {txs.length} movimiento{txs.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <Text style={styles.headerTotal}>{formatCLP(total)}</Text>
          </View>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {txs.length === 0 && (
              <Text style={styles.emptyText}>Sin movimientos este mes.</Text>
            )}

            {txs.map(tx => {
              const d = new Date(tx.date);
              const isRefund = tx.direction === 'in';
              const isEditing = editingId === tx.id;
              return (
                <View key={tx.id} style={[styles.txCard, isEditing && styles.txCardEditing]}>
                  <TouchableOpacity
                    style={styles.txRow}
                    activeOpacity={0.7}
                    onPress={() => isEditing ? cancelEdit() : startEdit(tx.id, tx.merchant, tx.category)}
                  >
                    <View style={styles.txInfo}>
                      <Text style={styles.txMerchant} numberOfLines={1}>{tx.merchant}</Text>
                      <Text style={styles.txDate}>
                        {d.getDate()} de {MONTH_NAMES[d.getMonth()].toLowerCase()}
                        {isRefund ? '  ·  devolución' : ''}
                      </Text>
                    </View>
                    <Text style={[styles.txAmount, isRefund && styles.txAmountRefund]}>
                      {isRefund ? '−' : ''}{formatCLP(Math.abs(tx.amount))}
                    </Text>
                  </TouchableOpacity>

                  {/* Panel de edición */}
                  {isEditing && (
                    <View style={styles.editPanel}>
                      <Text style={styles.editLabel}>Nombre</Text>
                      <TextInput
                        style={styles.editInput}
                        value={editMerchant}
                        onChangeText={setEditMerchant}
                        placeholder="Nombre del comercio"
                        placeholderTextColor={COLORS.textMuted}
                        autoCapitalize="characters"
                      />

                      <Text style={styles.editLabel}>Categoría</Text>
                      <View style={styles.catGrid}>
                        {CATEGORIES.filter(c => c.id !== 'pago_interno').map(c => {
                          const selected = editCat === c.id;
                          return (
                            <TouchableOpacity
                              key={c.id}
                              style={[styles.catChip, selected && styles.catChipSelected]}
                              onPress={() => setEditCat(c.id)}
                            >
                              <Text style={styles.catChipIcon}>{c.icon}</Text>
                              <Text style={[styles.catChipLabel, selected && styles.catChipLabelSelected]}
                                numberOfLines={1}>
                                {c.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <View style={styles.editBtnRow}>
                        <TouchableOpacity style={styles.editBtnSave} onPress={saveEdit}>
                          <Text style={styles.editBtnSaveText}>Guardar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.editBtnCancel} onPress={cancelEdit}>
                          <Text style={styles.editBtnCancelText}>Cancelar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:          { flex: 1, justifyContent: 'flex-end' },
  backdrop:         { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:            { backgroundColor: COLORS.background, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '82%', borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 16 },
  handle:           { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  header:           { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerIconWrap:   { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  headerIcon:       { fontSize: 21 },
  headerInfo:       { flex: 1 },
  headerTitle:      { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800' },
  headerSub:        { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  headerTotal:      { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800' },
  list:             { paddingTop: 10 },
  emptyText:        { color: COLORS.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 30 },
  txCard:           { backgroundColor: COLORS.surface, borderRadius: 12, marginBottom: 6, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  txCardEditing:    { borderColor: COLORS.green + '70' },
  txRow:            { flexDirection: 'row', alignItems: 'center', padding: 13, gap: 10 },
  txInfo:           { flex: 1 },
  txMerchant:       { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
  txDate:           { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  txAmount:         { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },
  txAmountRefund:   { color: COLORS.income },
  editPanel:        { borderTopWidth: 1, borderTopColor: COLORS.border, padding: 13, backgroundColor: COLORS.surfaceHigh },
  editLabel:        { color: COLORS.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  editInput:        { backgroundColor: COLORS.background, borderRadius: 9, borderWidth: 1, borderColor: COLORS.border, color: COLORS.textPrimary, fontSize: 13, padding: 10, marginBottom: 12 },
  catGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  catChip:          { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.background, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 6, paddingHorizontal: 8, maxWidth: '48%' },
  catChipSelected:  { backgroundColor: COLORS.greenFaint, borderColor: COLORS.green },
  catChipIcon:      { fontSize: 13 },
  catChipLabel:     { color: COLORS.textSecondary, fontSize: 11, flexShrink: 1 },
  catChipLabelSelected: { color: COLORS.green, fontWeight: '700' },
  editBtnRow:       { flexDirection: 'row', gap: 8 },
  editBtnSave:      { flex: 1, backgroundColor: COLORS.green, borderRadius: 10, padding: 11, alignItems: 'center' },
  editBtnSaveText:  { color: '#fff', fontSize: 13, fontWeight: '700' },
  editBtnCancel:    { flex: 1, backgroundColor: COLORS.surface, borderRadius: 10, padding: 11, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  editBtnCancelText:{ color: COLORS.textMuted, fontSize: 13, fontWeight: '600' },
});
