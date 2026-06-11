import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, SectionList, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { TransactionItem } from '../components/TransactionItem';
import { CATEGORIES } from '../constants/categories';
import { COLORS } from '../constants/colors';
import { Transaction } from '../types';

type DirectionFilter = 'all' | 'out' | 'in';

function dayKey(dateString: string): string {
  const d = new Date(dateString);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(dateString: string): string {
  const d   = new Date(dateString);
  const now = new Date();
  const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  if (dayKey(dateString) === dayKey(now.toISOString()))                              return 'Hoy';
  if (dayKey(dateString) === dayKey(new Date(now.getTime() - 86400000).toISOString())) return 'Ayer';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function MovimientosScreen() {
  const { transactions } = useApp();
  const [dirFilter, setDirFilter] = useState<DirectionFilter>('all');
  const [catFilter, setCatFilter] = useState<string | null>(null);

  const filtered = useMemo(() => transactions
    .filter(t => {
      if (dirFilter === 'out' && t.direction !== 'out') return false;
      if (dirFilter === 'in'  && t.direction !== 'in')  return false;
      if (catFilter && t.category !== catFilter)         return false;
      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  [transactions, dirFilter, catFilter]);

  const sections = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    filtered.forEach(t => {
      const k = dayKey(t.date);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    });
    return Array.from(map.entries()).map(([, data]) => ({
      title: dayLabel(data[0].date),
      data,
    }));
  }, [filtered]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Movimientos</Text>
      </View>

      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {(['all', 'out', 'in'] as DirectionFilter[]).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, dirFilter === f && !catFilter && styles.filterChipActive]}
              onPress={() => { setDirFilter(f); setCatFilter(null); }}
            >
              <Text style={[styles.filterChipText, dirFilter === f && !catFilter && styles.filterChipTextActive]}>
                {f === 'all' ? 'Todos' : f === 'out' ? '💳 Gastos' : '📥 Ingresos'}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={styles.filterSep} />
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.filterChip, catFilter === cat.id && { borderColor: cat.color, backgroundColor: cat.color + '18' }]}
              onPress={() => { setCatFilter(catFilter === cat.id ? null : cat.id); setDirFilter('all'); }}
            >
              <Text style={[styles.filterChipText, catFilter === cat.id && { color: cat.color, fontWeight: '700' }]}>
                {cat.icon} {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {sections.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>💳</Text>
          <Text style={styles.emptyTitle}>Sin resultados</Text>
          <Text style={styles.emptySub}>No hay movimientos con estos filtros.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{section.title}</Text>
              <Text style={styles.sectionHeaderCount}>{section.data.length}</Text>
            </View>
          )}
          renderItem={({ item }) => <TransactionItem transaction={item} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:                { flex: 1, backgroundColor: COLORS.background },
  header:              { backgroundColor: COLORS.surface, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle:         { color: COLORS.green, fontSize: 24, fontWeight: '800' },
  filterBar:           { backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  filterRow:           { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  filterChip:          { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: COLORS.surfaceHigh, borderWidth: 1.5, borderColor: COLORS.border },
  filterChipActive:    { borderColor: COLORS.green, backgroundColor: COLORS.greenFaint },
  filterChipText:      { color: COLORS.textSecondary, fontSize: 12, fontWeight: '500' },
  filterChipTextActive: { color: COLORS.greenMid, fontWeight: '700' },
  filterSep:           { width: 1, backgroundColor: COLORS.border, marginVertical: 2 },
  list:                { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, backgroundColor: COLORS.background },
  sectionHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.background, paddingVertical: 8 },
  sectionHeaderText:   { color: COLORS.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionHeaderCount:  { color: COLORS.textMuted, fontSize: 11 },
  emptyState:          { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyIcon:           { fontSize: 48 },
  emptyTitle:          { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700' },
  emptySub:            { color: COLORS.textMuted, fontSize: 13 },
});
