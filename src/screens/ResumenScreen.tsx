import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { COLORS } from '../constants/colors';
import { formatCLP } from '../utils/parseNotification';
import { getMonthSummary, getCategoryTotals } from '../utils/summary';

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

export function ResumenScreen() {
  const { transactions } = useApp();

  const now       = new Date();
  const year      = now.getFullYear();
  const month     = now.getMonth();
  const summary   = getMonthSummary(transactions, year, month);
  const catTotals = getCategoryTotals(transactions, year, month);

  const savingsColor = summary.savingsRate >= 20 ? COLORS.income
    : summary.savingsRate >= 0 ? COLORS.pending
    : COLORS.expense;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header verde oscuro estilo Falabella */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreeting}>Mi resumen</Text>
          <Text style={styles.headerMonth}>{MONTH_NAMES[month]} {year}</Text>
        </View>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>BF</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Card balance principal */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Balance del mes</Text>
          <Text style={[
            styles.balanceAmount,
            { color: summary.balance >= 0 ? COLORS.income : COLORS.expense },
          ]}>
            {summary.balance >= 0 ? '+' : ''}{formatCLP(summary.balance)}
          </Text>

          <View style={styles.subRow}>
            <View style={[styles.subCard, styles.subCardIncome]}>
              <Text style={styles.subCardIcon}>↓</Text>
              <View>
                <Text style={styles.subCardLabel}>Ingresos</Text>
                <Text style={[styles.subCardAmount, { color: COLORS.income }]}>
                  {formatCLP(summary.income)}
                </Text>
              </View>
            </View>
            <View style={[styles.subCard, styles.subCardExpense]}>
              <Text style={[styles.subCardIcon, { color: COLORS.expense }]}>↑</Text>
              <View>
                <Text style={styles.subCardLabel}>Gastos</Text>
                <Text style={[styles.subCardAmount, { color: COLORS.expense }]}>
                  {formatCLP(summary.expenses)}
                </Text>
              </View>
            </View>
          </View>

          {/* Tasa de ahorro */}
          <View style={styles.savingsWrap}>
            <View style={styles.savingsRow}>
              <Text style={styles.savingsLabel}>Tasa de ahorro</Text>
              <Text style={[styles.savingsRate, { color: savingsColor }]}>
                {summary.savingsRate}%
              </Text>
            </View>
            <View style={styles.savingsBarBg}>
              <View style={[
                styles.savingsBarFill,
                { width: `${Math.min(Math.max(summary.savingsRate, 0), 100)}%`, backgroundColor: savingsColor },
              ]} />
            </View>
          </View>

          {summary.pending > 0 && (
            <View style={styles.pendingAlert}>
              <Text style={styles.pendingAlertIcon}>⚠️</Text>
              <Text style={styles.pendingAlertText}>
                {summary.pending} gasto{summary.pending > 1 ? 's' : ''} pendiente{summary.pending > 1 ? 's' : ''} de categorizar
              </Text>
            </View>
          )}
        </View>

        {/* Categorías */}
        {catTotals.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gastos por categoría</Text>
            {catTotals.map(cat => {
              const pct = summary.income > 0
                ? Math.round((cat.total / summary.income) * 100) : 0;
              return (
                <View key={cat.id} style={styles.catCard}>
                  <View style={styles.catCardTop}>
                    <View style={styles.catLeft}>
                      <View style={[styles.catIconWrap, { backgroundColor: cat.color + '18' }]}>
                        <Text style={styles.catIcon}>{cat.icon}</Text>
                      </View>
                      <View>
                        <Text style={styles.catName}>{cat.label}</Text>
                        <Text style={styles.catCount}>
                          {cat.count} movimiento{cat.count !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.catAmount}>{formatCLP(cat.total)}</Text>
                      <Text style={styles.catPct}>{pct}% del ingreso</Text>
                    </View>
                  </View>
                  <View style={styles.catBarBg}>
                    <View style={[
                      styles.catBarFill,
                      { width: `${Math.min(pct * 2, 100)}%`, backgroundColor: cat.color },
                    ]} />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {catTotals.length === 0 && summary.txCount === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>Sin movimientos este mes</Text>
            <Text style={styles.emptySub}>
              Usa el botón + para agregar uno manualmente.
            </Text>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: COLORS.background },
  header:           { backgroundColor: COLORS.surface, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerGreeting:   { color: COLORS.green, fontSize: 24, fontWeight: '800' },
  headerMonth:      { color: COLORS.textMuted, fontSize: 13, marginTop: 2 },
  headerBadge:      { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.greenFaint, borderWidth: 1.5, borderColor: COLORS.green + '60', alignItems: 'center', justifyContent: 'center' },
  headerBadgeText:  { color: COLORS.green, fontSize: 14, fontWeight: '800' },
  scroll:           { flex: 1, backgroundColor: COLORS.background },
  balanceCard:      { backgroundColor: COLORS.surface, margin: 16, borderRadius: 16, padding: 20, shadowColor: COLORS.shadowMd, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 4 },
  balanceLabel:     { color: COLORS.textMuted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  balanceAmount:    { fontSize: 36, fontWeight: '800', marginBottom: 16 },
  subRow:           { flexDirection: 'row', gap: 10, marginBottom: 16 },
  subCard:          { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, borderWidth: 1 },
  subCardIncome:    { backgroundColor: COLORS.greenFaint, borderColor: COLORS.green + '40' },
  subCardExpense:   { backgroundColor: '#FEEBEB', borderColor: COLORS.expense + '40' },
  subCardIcon:      { fontSize: 18, color: COLORS.income },
  subCardLabel:     { color: COLORS.textMuted, fontSize: 11, marginBottom: 2 },
  subCardAmount:    { fontSize: 14, fontWeight: '700' },
  savingsWrap:      { marginBottom: 4 },
  savingsRow:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  savingsLabel:     { color: COLORS.textSecondary, fontSize: 13 },
  savingsRate:      { fontSize: 13, fontWeight: '700' },
  savingsBarBg:     { height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  savingsBarFill:   { height: 6, borderRadius: 3 },
  pendingAlert:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: '#FFF3E0', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#FFB74D40' },
  pendingAlertIcon: { fontSize: 16 },
  pendingAlertText: { color: COLORS.pendingText, fontSize: 12, fontWeight: '600', flex: 1 },
  section:          { paddingHorizontal: 16 },
  sectionTitle:     { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  catCard:          { backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, marginBottom: 8, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 },
  catCardTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  catLeft:          { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catIconWrap:      { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  catIcon:          { fontSize: 20 },
  catName:          { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
  catCount:         { color: COLORS.textMuted, fontSize: 11, marginTop: 1 },
  catAmount:        { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },
  catPct:           { color: COLORS.textMuted, fontSize: 11, marginTop: 1 },
  catBarBg:         { height: 4, backgroundColor: COLORS.border, borderRadius: 2, overflow: 'hidden' },
  catBarFill:       { height: 4, borderRadius: 2 },
  emptyState:       { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyIcon:        { fontSize: 48, marginBottom: 12 },
  emptyTitle:       { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700', marginBottom: 6 },
  emptySub:         { color: COLORS.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
