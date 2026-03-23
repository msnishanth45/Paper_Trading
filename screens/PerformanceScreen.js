import React from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView } from 'react-native';
import { useApp } from '../context/AppContext';

export default function PerformanceScreen() {
  const { history } = useApp();

  const totalPL = history.reduce((sum, item) => sum + (item.pnl || 0), 0);
  const totalCharges = history.reduce((sum, item) => sum + (item.charges || 0), 0);

  const renderHistoryItem = ({ item }) => (
    <View style={styles.historyRow}>
      <View style={{ flex: 2 }}>
        <Text style={styles.symbolText}>{item.symbol} {item.strike} {item.optionType}</Text>
        <Text style={styles.dateText}>{new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString()}</Text>
      </View>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text style={[styles.typeText, { color: item.type === 'buy' ? '#007AFF' : '#FF9500' }]}>
          {item.type.toUpperCase()}
        </Text>
        {item.pnl !== undefined && (
          <Text style={[styles.pnlText, { color: item.pnl >= 0 ? '#34C759' : '#FF3B30' }]}>
            {item.pnl >= 0 ? '+' : ''}₹{item.pnl.toFixed(2)}
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total Realized P/L</Text>
        <Text style={[styles.summaryValue, { color: totalPL >= 0 ? '#34C759' : '#FF3B30' }]}>
          ₹{totalPL.toFixed(2)}
        </Text>
        <View style={styles.divider} />
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Total Charges & Taxes</Text>
          <Text style={styles.detailValue}>₹{totalCharges.toFixed(2)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Net Realized Amount</Text>
          <Text style={styles.detailValue}>₹{(totalPL - totalCharges).toFixed(2)}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Trade History</Text>
      {history.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No trade history available.</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={item => item.id}
          renderItem={renderHistoryItem}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
    padding: 16,
  },
  summaryCard: {
    backgroundColor: '#1E293B',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 24,
  },
  summaryLabel: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    color: '#94A3B8',
  },
  detailValue: {
    color: '#F8FAFC',
    fontWeight: 'bold',
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  symbolText: {
    color: '#F8FAFC',
    fontWeight: '600',
  },
  dateText: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 4,
  },
  typeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  pnlText: {
    fontWeight: 'bold',
    marginTop: 4,
  },
  emptyState: {
    marginTop: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748B',
  }
});
