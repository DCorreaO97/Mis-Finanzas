import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { COLORS } from '../constants/colors';
import { formatCLP } from '../utils/parseNotification';
import { getAllMonths, getMonthSummary, getCategoryTotals } from '../utils/summary';

export function HistorialScreen() {
  const { transactions } = useApp();
  const months = getAllMonths(transactions);
  const [expandedKey, setExpandedKey] = useState<string | null>(
    months.length > 0 ? `${months[0].year}-${months[0].month}` : null
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Historial</Text>
        <Text style={styles.headerSub}>
          {months.length} mes{months.length !== 1 ? 'es' : ''} registrado{months.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {months.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={styles.emptyTitle}>Sin historial aún</Text>
          <Text style={styles.emptySub}>Tus movimientos aparecerán aquí agrupados por mes.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {months.map(mk => {
            const key      = `${mk.year}-${mk.month}`;
            const summary  = getMonthSummary(transactions, mk.year, mk.month);
            const isOpen   = expandedKey === key;
            const catTotals = isOpen ? getCategoryTotals(transactions, mk.year, mk.month) : [];
            const balColor  = summary.balance >= 0 ? COLORS.income : COLORS.expense;

            return (
              <View key={key} style={styles.monthCard}>
                <TouchableOpacity
                  style={styles.monthHeader}
                  onPress={() => setExpandedKey(isOpen ? null : key)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.monthDot, { backgroundColor: balColor }]} />
                  <View style={styles.monthHeaderInfo}>
                    <Text style={styles.monthLabel}>{mk.label}</Text>
                    <Text style={styles.monthMeta}>
                      {summary.txCount} movimientos
                      {summary.pending > 0 ? `  ·  ⚠️ ${summary.pending} pendiente${summary.pending > 1 ? 's' : ''}` : '  ·  ✓ Completo'}
                    </Text>
                  </View>
                  <View style={styles.monthHeaderRight}>
                    <Text style={[styles.monthBalance, { color: balColor }]}>
                      {summary.balance >= 0 ? '+' : ''}{formatCLP(summary.balance)}
                    </Text>
                    <Text style={styles.chevron}>{isOpen ? '▲' : '▼'}</Text>
                  </View>
                </TouchableOpacity>

                {isOpen && (
                  <View style={styles.monthBody}>
                    <View style={styles.summaryRow}>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Ingresos</Text>
                        <Text style={[styles.summaryVal, { color: COLORS.income }]}>
                          {formatCLP(summary.income)}
                        </Text>
                      </View>
                      <View style={styles.summaryDivider} />
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Gastos</Text>
                        <Text style={[styles.summaryVal, { color: COLORS.expense }]}>
                          {formatCLP(summary.expenses)}
                        </Text>
                      </View>
                      <View style={styles.summaryDivider} />
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Ahorro</Text>
                        <Text style={[styles.summaryVal, { color: COLORS.income }]}>
                          {summary.savingsRate}%
                        </Text>
                      </View>
                    </View>

                    {catTotals.length > 0 && (
                      <>
                        <Text style={styles.catSectionTitle}>Por categoría</Text>
                        {catTotals.map(cat => {
                          const pct = summary.expenses > 0
                            ? Math.round((cat.total / summary.expenses) * 100) : 0;
                          return (
                            <View key={cat.id} style={styles.catRow}>
                              <View style={[styles.catIconWrap, { backgroundColor: cat.color + '18' }]}>
                                <Text style={styles.catIcon}>{cat.icon}</Text>
                              </View>
                              <View style={styles.catBarWrap}>
                                <View style={styles.catBarMeta}>
                                  <Text style={styles.catName}>{cat.label}</Text>
                                  <Text style={styles.catAmount}>{formatCLP(cat.total)}</Text>
                                </View>
                                <View style={styles.catBarBg}>
                                  <View style={[styles.catBarFill, { width: `${pct}%`, backgroundColor: cat.color }]} />
                                </View>
                              </View>
                            </View>
                          );
                        })}
                      </>
                    )}
                  </View>
                )}
              </View>
            );
          })}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: COLORS.background },
  header:         { backgroundColor: COLORS.surface, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle:    { color: COLORS.green, fontSize: 24, fontWeight: '800' },
  headerSub:      { color: COLORS.textMuted, fontSize: 13, marginTop: 2 },
  scroll:         { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 16, paddingTop: 14 },
  emptyState:     { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  emptyIcon:      { fontSize: 48 },
  emptyTitle:     { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700' },
  emptySub:       { color: COLORS.textMuted, fontSize: 13, textAlign: 'center' },
  monthCard:      { backgroundColor: COLORS.surface, borderRadius: 14, marginBottom: 10, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 3, overflow: 'hidden' },
  monthHeader:    { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 10 },
  monthDot:       { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  monthHeaderInfo: { flex: 1 },
  monthLabel:     { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  monthMeta:      { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  monthHeaderRight: { alignItems: 'flex-end', gap: 3 },
  monthBalance:   { fontSize: 15, fontWeight: '700' },
  chevron:        { color: COLORS.textMuted, fontSize: 10 },
  monthBody:      { borderTopWidth: 1, borderTopColor: COLORS.border, padding: 16 },
  summaryRow:     { flexDirection: 'row', backgroundColor: COLORS.surfaceHigh, borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  summaryItem:    { flex: 1, alignItems: 'center' },
  summaryLabel:   { color: COLORS.textMuted, fontSize: 10, marginBottom: 4, fontWeight: '600' },
  summaryVal:     { fontSize: 13, fontWeight: '700' },
  summaryDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  catSectionTitle: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  catRow:         { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  catIconWrap:    { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  catIcon:        { fontSize: 16 },
  catBarWrap:     { flex: 1 },
  catBarMeta:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  catName:        { color: COLORS.textSecondary, fontSize: 12 },
  catAmount:      { color: COLORS.textPrimary, fontSize: 12, fontWeight: '600' },
  catBarBg:       { height: 4, backgroundColor: COLORS.border, borderRadius: 2, overflow: 'hidden' },
  catBarFill:     { height: 4, borderRadius: 2 },
});
