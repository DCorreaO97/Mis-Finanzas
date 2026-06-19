import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Transaction, effectiveAmount } from '../types';
import { CATEGORIES, INCOME_TYPES } from '../constants/categories';
import { COLORS } from '../constants/colors';
import { formatCLP, timeAgo } from '../utils/parseNotification';
import { useApp } from '../context/AppContext';

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

interface Props {
  transaction: Transaction;
  isNew?: boolean;
  defaultExpanded?: boolean;
}

export function TransactionItem({ transaction: tx, isNew = false, defaultExpanded = false }: Props) {
  const { categorize, moveTransaction } = useApp();
  const [expanded, setExpanded]     = useState(defaultExpanded);
  const [movingMes, setMovingMes]   = useState(false);

  const txDate    = new Date(tx.date);
  const txYear    = txDate.getFullYear();
  const txMonth   = txDate.getMonth() + 1; // 1-12

  const isIncome      = tx.direction === 'in';
  const hasSplit      = tx.split !== null && tx.direction === 'out';
  const cat           = CATEGORIES.find(c => c.id === tx.category);
  const incomeType    = INCOME_TYPES.find(i => i.id === tx.category);
  const displayAmount = hasSplit ? tx.split!.myShare : tx.amount;

  const metaLabel = isIncome
    ? '📥 Ingreso'
    : tx.type === 'transferencia' ? '🔄 Transferencia'
    : tx.type === 'pago'         ? '📄 Pago'
    : '💳 Compra';

  const srcLabel = tx.aiSource === 'memory' ? '🧠 Recordado'
    : tx.aiSource === 'ai'     ? '✦ IA'
    : tx.aiSource === 'manual' ? '✓ Manual'
    : tx.aiSource === 'local'  ? '✓ Auto'
    : null;

  return (
    <View style={[
      styles.container,
      isNew && styles.containerNew,
      isIncome && styles.containerIncome,
      !isIncome && !tx.category && styles.containerPending,
    ]}>
      <TouchableOpacity
        style={styles.row}
        onPress={() => { if (!isIncome) setExpanded(e => !e); }}
        activeOpacity={0.7}
      >
        {/* Ícono */}
        <View style={[
          styles.iconWrap,
          isIncome
            ? { backgroundColor: COLORS.greenFaint }
            : cat
              ? { backgroundColor: cat.color + '18' }
              : { backgroundColor: '#FFF3E0' },
        ]}>
          <Text style={styles.icon}>
            {isIncome ? (incomeType?.icon ?? '📥') : (cat?.icon ?? '❓')}
          </Text>
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.merchant} numberOfLines={1}>{tx.merchant}</Text>
          <Text style={styles.meta}>
            {metaLabel}{'  ·  '}{timeAgo(tx.date)}
            {hasSplit ? '  ·  👥 Dividido' : ''}
          </Text>
        </View>

        {/* Monto */}
        <View style={styles.amountWrap}>
          <Text style={[styles.amount, isIncome ? styles.amountIn : styles.amountOut]}>
            {isIncome ? '+' : '-'}{formatCLP(displayAmount)}
          </Text>
          {hasSplit && (
            <Text style={styles.amountSplit}>de {formatCLP(tx.amount)}</Text>
          )}
          {!isIncome && !tx.category && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>PENDIENTE</Text>
            </View>
          )}
          {!isIncome && srcLabel && (
            <Text style={styles.srcLabel}>{srcLabel}</Text>
          )}
        </View>
      </TouchableOpacity>

      {/* Panel expandido */}
      {expanded && !isIncome && (
        <View style={styles.expandedWrap}>
          {hasSplit && (
            <View style={styles.splitCard}>
              <Text style={styles.splitTitle}>👥 {tx.split!.description}</Text>
              <View style={styles.splitRow}>
                <Text style={styles.splitLabel}>Total pagado</Text>
                <Text style={styles.splitVal}>{formatCLP(tx.amount)} ÷ {tx.split!.totalPeople} personas</Text>
              </View>
              <View style={styles.splitRow}>
                <Text style={styles.splitLabel}>Tu parte</Text>
                <Text style={[styles.splitVal, { color: COLORS.greenMid, fontWeight: '700' }]}>
                  {formatCLP(tx.split!.myShare)}
                </Text>
              </View>
              <View style={styles.splitRow}>
                <Text style={styles.splitLabel}>Recuperado</Text>
                <Text style={[styles.splitVal, { color: COLORS.income }]}>
                  {formatCLP(tx.split!.recovered)}
                </Text>
              </View>
            </View>
          )}

          {!tx.category && (
            <>
              <Text style={styles.catLabel}>Selecciona una categoría:</Text>
              <View style={styles.catGrid}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.catChip, { borderColor: c.color + '60', backgroundColor: c.color + '10' }]}
                    onPress={() => { categorize(tx.id, c.id); setExpanded(false); }}
                  >
                    <Text style={styles.catChipIcon}>{c.icon}</Text>
                    <Text style={[styles.catChipLabel, { color: c.color }]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {tx.category && (
            <View style={styles.catConfirmed}>
              <Text style={styles.catConfirmedText}>
                {cat?.icon} {cat?.label ?? tx.category}
              </Text>
              <TouchableOpacity onPress={() => setExpanded(false)}>
                <Text style={styles.collapseBtn}>Cerrar ▲</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Mover a otro mes ── */}
          {!movingMes ? (
            <TouchableOpacity
              style={styles.moveBtn}
              onPress={() => setMovingMes(true)}
            >
              <Text style={styles.moveBtnText}>📅 Mover a otro mes</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.movePanel}>
              <Text style={styles.movePanelTitle}>¿A qué mes mover esta transacción?</Text>
              <View style={styles.moveYearRow}>
                <TouchableOpacity onPress={() => {}} style={styles.moveYearBtn}>
                  <Text style={styles.moveYearBtnText}>◀ {txYear - 1}</Text>
                </TouchableOpacity>
                <Text style={styles.moveYearLabel}>{txYear}</Text>
                <TouchableOpacity onPress={() => {}} style={styles.moveYearBtn}>
                  <Text style={styles.moveYearBtnText}>{txYear + 1} ▶</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.moveGrid}>
                {MONTH_NAMES.map((name, idx) => {
                  const m    = idx + 1;
                  const curr = m === txMonth;
                  return (
                    <TouchableOpacity
                      key={m}
                      disabled={curr}
                      style={[styles.moveMonthChip, curr && styles.moveMonthChipCurr]}
                      onPress={async () => {
                        await moveTransaction(tx.id, txYear, m);
                        setMovingMes(false);
                        setExpanded(false);
                      }}
                    >
                      <Text style={[styles.moveMonthLabel, curr && styles.moveMonthLabelCurr]}>
                        {name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity onPress={() => setMovingMes(false)}>
                <Text style={styles.moveCancelBtn}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 3, elevation: 2 },
  containerNew:     { borderColor: COLORS.green + '80', borderWidth: 1.5 },
  containerIncome:  { borderLeftWidth: 3, borderLeftColor: COLORS.income },
  containerPending: { borderLeftWidth: 3, borderLeftColor: COLORS.pending },
  row:              { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap:         { width: 44, height: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  icon:             { fontSize: 22 },
  info:             { flex: 1 },
  merchant:         { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  meta:             { color: COLORS.textMuted, fontSize: 11, marginTop: 3 },
  amountWrap:       { alignItems: 'flex-end' },
  amount:           { fontSize: 14, fontWeight: '700' },
  amountIn:         { color: COLORS.income },
  amountOut:        { color: COLORS.textPrimary },
  amountSplit:      { color: COLORS.textMuted, fontSize: 10, marginTop: 1 },
  pendingBadge:     { backgroundColor: '#FFF3E0', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 3, borderWidth: 1, borderColor: '#FFB74D80' },
  pendingBadgeText: { color: COLORS.pendingText, fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
  srcLabel:         { color: COLORS.textMuted, fontSize: 10, marginTop: 2 },
  expandedWrap:     { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  splitCard:        { backgroundColor: COLORS.greenFaint, borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: COLORS.green + '30' },
  splitTitle:       { color: COLORS.greenMid, fontSize: 12, fontWeight: '700', marginBottom: 8 },
  splitRow:         { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  splitLabel:       { color: COLORS.textSecondary, fontSize: 12 },
  splitVal:         { color: COLORS.textPrimary, fontSize: 12 },
  catLabel:         { color: COLORS.textMuted, fontSize: 11, marginBottom: 10 },
  catGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip:          { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 4 },
  catChipIcon:      { fontSize: 13 },
  catChipLabel:     { fontSize: 11, fontWeight: '600' },
  catConfirmed:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catConfirmedText: { color: COLORS.textSecondary, fontSize: 12 },
  collapseBtn:      { color: COLORS.green, fontSize: 11, fontWeight: '600' },

  // ── Mover mes ──
  moveBtn:           { marginTop: 12, paddingVertical: 8, alignItems: 'center', borderRadius: 10, backgroundColor: COLORS.surfaceHigh, borderWidth: 1, borderColor: COLORS.border },
  moveBtnText:       { color: COLORS.textMuted, fontSize: 12, fontWeight: '600' },
  movePanel:         { marginTop: 12, backgroundColor: COLORS.surfaceHigh, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  movePanelTitle:    { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 10, textAlign: 'center' },
  moveYearRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  moveYearBtn:       { padding: 6 },
  moveYearBtnText:   { color: COLORS.green, fontSize: 12, fontWeight: '700' },
  moveYearLabel:     { color: COLORS.textPrimary, fontSize: 14, fontWeight: '800' },
  moveGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  moveMonthChip:     { width: '23%', paddingVertical: 7, alignItems: 'center', borderRadius: 8, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  moveMonthChipCurr: { backgroundColor: COLORS.greenFaint, borderColor: COLORS.green },
  moveMonthLabel:    { color: COLORS.textSecondary, fontSize: 12, fontWeight: '500' },
  moveMonthLabelCurr:{ color: COLORS.green, fontWeight: '700' },
  moveCancelBtn:     { color: COLORS.textMuted, fontSize: 11, textAlign: 'center', paddingVertical: 4 },
});
