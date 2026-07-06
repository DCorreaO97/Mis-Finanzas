import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Transaction } from '../types';
import { COLORS } from '../constants/colors';
import { getAllMonths, getMonthSummary } from '../utils/summary';

const MONTH_SHORT = [
  'ene','feb','mar','abr','may','jun',
  'jul','ago','sep','oct','nov','dic',
];

const CHART_HEIGHT = 110;

interface Props {
  transactions: Transaction[];
}

/**
 * Gráfico de barras agrupadas (ingresos vs gastos) de los últimos meses.
 * Hecho con Views puras — sin dependencias de SVG.
 */
export function TrendChart({ transactions }: Props) {
  const data = useMemo(() => {
    // getAllMonths viene ordenado del más reciente al más antiguo
    const months = getAllMonths(transactions).slice(0, 7).reverse();
    return months.map(mk => {
      const s = getMonthSummary(transactions, mk.year, mk.month);
      return {
        key:      `${mk.year}-${mk.month}`,
        label:    `${MONTH_SHORT[mk.month]}${mk.month === 0 ? ` ${String(mk.year).slice(2)}` : ''}`,
        income:   s.income,
        expenses: Math.max(s.expenses, 0),
        balance:  s.balance,
      };
    });
  }, [transactions]);

  if (data.length < 2) return null;

  const maxVal = Math.max(...data.map(d => Math.max(d.income, d.expenses)), 1);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>📈 Tendencia mensual</Text>

      <View style={styles.chartArea}>
        {data.map(d => (
          <View key={d.key} style={styles.monthCol}>
            <View style={styles.barsRow}>
              <View style={[
                styles.bar, styles.barIncome,
                { height: Math.max((d.income / maxVal) * CHART_HEIGHT, 2) },
              ]} />
              <View style={[
                styles.bar, styles.barExpense,
                { height: Math.max((d.expenses / maxVal) * CHART_HEIGHT, 2) },
              ]} />
            </View>
            <Text style={styles.monthLabel}>{d.label}</Text>
            <Text style={[
              styles.balanceLabel,
              { color: d.balance >= 0 ? COLORS.income : COLORS.expense },
            ]}>
              {d.balance >= 0 ? '+' : '−'}{formatShort(Math.abs(d.balance))}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.income }]} />
          <Text style={styles.legendText}>Ingresos</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.expense }]} />
          <Text style={styles.legendText}>Gastos</Text>
        </View>
      </View>
    </View>
  );
}

/** $1.234.567 → "1,2M" · $850.000 → "850k" */
function formatShort(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace('.', ',')}M`;
  if (n >= 1000)    return `${Math.round(n / 1000)}k`;
  return String(n);
}

const styles = StyleSheet.create({
  card:         { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border },
  title:        { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 14 },
  chartArea:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  monthCol:     { flex: 1, alignItems: 'center' },
  barsRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: CHART_HEIGHT },
  bar:          { width: 9, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  barIncome:    { backgroundColor: COLORS.income },
  barExpense:   { backgroundColor: COLORS.expense },
  monthLabel:   { color: COLORS.textMuted, fontSize: 10, marginTop: 6, fontWeight: '600' },
  balanceLabel: { fontSize: 9, fontWeight: '700', marginTop: 2 },
  legend:       { flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:    { width: 8, height: 8, borderRadius: 4 },
  legendText:   { color: COLORS.textSecondary, fontSize: 11 },
});
