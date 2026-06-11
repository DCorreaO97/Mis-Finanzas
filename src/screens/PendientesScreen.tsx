import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { TransactionItem } from '../components/TransactionItem';
import { COLORS } from '../constants/colors';
import { Transaction } from '../types';

export function PendientesScreen() {
  const { transactions } = useApp();

  const pending: Transaction[] = transactions
    .filter(t => t.direction === 'out' && t.category === null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pendientes</Text>
        {pending.length > 0 && (
          <Text style={styles.headerSub}>
            {pending.length} gasto{pending.length > 1 ? 's' : ''} sin categorizar
          </Text>
        )}
      </View>

      {pending.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Text style={styles.emptyIcon}>✅</Text>
          </View>
          <Text style={styles.emptyTitle}>¡Todo al día!</Text>
          <Text style={styles.emptySub}>
            No tienes gastos pendientes de categorizar.
          </Text>
        </View>
      ) : (
        <FlatList
          data={pending}
          keyExtractor={item => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.banner}>
              <View style={styles.bannerLeft}>
                <Text style={styles.bannerIcon}>⚠️</Text>
              </View>
              <View style={styles.bannerRight}>
                <Text style={styles.bannerTitle}>
                  {pending.length} gasto{pending.length > 1 ? 's' : ''} sin categorizar
                </Text>
                <Text style={styles.bannerSub}>
                  Toca cada ítem para asignarle una categoría.
                </Text>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <TransactionItem transaction={item} defaultExpanded />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: COLORS.background },
  header:       { backgroundColor: COLORS.surface, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle:  { color: COLORS.green, fontSize: 24, fontWeight: '800' },
  headerSub:    { color: COLORS.textMuted, fontSize: 13, marginTop: 2 },
  list:         { backgroundColor: COLORS.background },
  listContent:  { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 24 },
  banner:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF3E0', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#FFB74D60', marginBottom: 14 },
  bannerLeft:   {},
  bannerIcon:   { fontSize: 28 },
  bannerRight:  { flex: 1 },
  bannerTitle:  { color: COLORS.pendingText, fontSize: 14, fontWeight: '700' },
  bannerSub:    { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  emptyState:   { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.greenFaint, alignItems: 'center', justifyContent: 'center' },
  emptyIcon:    { fontSize: 40 },
  emptyTitle:   { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800' },
  emptySub:     { color: COLORS.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
