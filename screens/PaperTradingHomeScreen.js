import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, RefreshControl } from 'react-native';
import { useApp } from '../context/AppContext';
import { fetchLivePrice } from '../services/marketData';

const { width } = Dimensions.get('window');

const IndexCard = ({ name, value, change, isSimulated, onPress }) => (
  <TouchableOpacity style={styles.indexCard} onPress={onPress}>
    <View style={styles.indexHeader}>
      <Text style={styles.indexName}>{name}</Text>
      {isSimulated && <Text style={styles.simBadge}>SIM</Text>}
    </View>
    <Text style={styles.indexValue}>{value}</Text>
    <Text style={[styles.indexChange, { color: change >= 0 ? '#34C759' : '#FF3B30' }]}>
      {change >= 0 ? '+' : ''}{change.toFixed(2)}%
    </Text>
    <Text style={styles.optionChainLink}>Option Chain →</Text>
  </TouchableOpacity>
);
export default function PaperTradingHomeScreen({ navigation }) {
  const { balance, positions, history } = useApp();
  const [activeTab, setActiveTab] = useState(0);
  const scrollViewRef = React.useRef(null);
  
  // Live Market Prices
  const [marketData, setMarketData] = useState({
    nifty: { val: 22350.50, chg: 0.45, isSim: false },
    bankNifty: { val: 47280.15, chg: -0.12, isSim: false },
    sensex: { val: 73650.80, chg: 0.32, isSim: false }
  });
  
  const [refreshing, setRefreshing] = useState(false);

  const updateAllIndices = useCallback(async () => {
    const symbols = ['NIFTY', 'BANKNIFTY', 'SENSEX'];
    const results = await Promise.all(symbols.map(s => fetchLivePrice(s)));
    
    setMarketData(prev => {
      const newData = { ...prev };
      results.forEach((res, index) => {
        if (res && res.success) {
          const key = symbols[index] === 'NIFTY' ? 'nifty' : (symbols[index] === 'BANKNIFTY' ? 'bankNifty' : 'sensex');
          newData[key] = { val: res.price, chg: res.changePercent, isSim: res.isSimulated };
        }
      });
      return newData;
    });
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await updateAllIndices();
    setRefreshing(false);
  }, [updateAllIndices]);

  useEffect(() => {
    updateAllIndices();
    const timer = setInterval(updateAllIndices, 2000); // 2 seconds update
    return () => clearInterval(timer);
  }, [updateAllIndices]);

  const handleScroll = (event) => {
    const scrollOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollOffset / width);
    if (index !== activeTab) {
      setActiveTab(index);
    }
  };

  const scrollToTab = (index) => {
    setActiveTab(index);
    scrollViewRef.current?.scrollTo({ x: index * width, animated: true });
  };

  // Calculate Total P/L from positions
  const currentPL = positions.reduce((total, pos) => {
    // Mock current price movement: +/- 2% from entry
    const currentPrice = pos.price * (1 + (Math.random() * 0.04 - 0.02));
    return total + (currentPrice - pos.price) * pos.quantity;
  }, 0);

  const totalCharges = history.reduce((sum, h) => sum + (h.charges || 0), 0);

  return (
    <View style={styles.container}>
      {/* Top Header Summary */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>Virtual Margin</Text>
          <Text style={styles.balanceText}>₹{(balance).toLocaleString()}</Text>
        </View>
        <TouchableOpacity 
          style={styles.tradeLabBtn}
          onPress={() => scrollToTab(0)}
        >
          <Text style={styles.tradeLabText}>Practice Mode</Text>
        </TouchableOpacity>
      </View>

      {/* Navigation Tabs */}
      <View style={styles.tabBar}>
        {['Indices', 'Positions', 'Performance'].map((tab, index) => (
          <TouchableOpacity 
            key={tab} 
            style={[styles.tabItem, activeTab === index && styles.activeTabItem]}
            onPress={() => scrollToTab(index)}
          >
            <Text style={[styles.tabText, activeTab === index && styles.activeTabText]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView 
        ref={scrollViewRef}
        horizontal 
        pagingEnabled 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rowContainer}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3B82F6"
            colors={['#3B82F6']}
          />
        }
      >
        {/* Column 1: Indices */}
        <View style={styles.columnView}>
          <Text style={styles.columnTitle}>Market Indices</Text>
          <IndexCard 
            name="NIFTY 50" 
            value={marketData.nifty.val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 
            change={marketData.nifty.chg}
            isSimulated={marketData.nifty.isSim}
            onPress={() => navigation.navigate('OptionChain', { symbol: 'NIFTY' })}
          />
          <IndexCard 
            name="BANK NIFTY" 
            value={marketData.bankNifty.val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 
            change={marketData.bankNifty.chg}
            isSimulated={marketData.bankNifty.isSim}
            onPress={() => navigation.navigate('OptionChain', { symbol: 'BANKNIFTY' })}
          />
          <IndexCard 
            name="SENSEX" 
            value={marketData.sensex.val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 
            change={marketData.sensex.chg}
            isSimulated={marketData.sensex.isSim}
            onPress={() => navigation.navigate('OptionChain', { symbol: 'SENSEX' })}
          />
          <Text style={styles.swipeHint}>Swipe for Positions →</Text>
        </View>

        {/* Column 2: Positions */}
        <View style={styles.columnView}>
          <View style={styles.columnHeader}>
            <Text style={styles.columnTitle}>My Positions</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Positions')}>
              <Text style={styles.manageBtn}>Manage</Text>
            </TouchableOpacity>
          </View>
          {positions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No open trades</Text>
              <Text style={styles.emptySubText}>Execute trades from Option Chain</Text>
            </View>
          ) : (
            positions.slice(0, 4).map(pos => (
              <TouchableOpacity key={pos.id} style={styles.posCard} onPress={() => navigation.navigate('Positions')}>
                <View style={styles.posHeader}>
                  <Text style={styles.posSymbol}>{pos.symbol} {pos.strike} {pos.optionType}</Text>
                  <Text style={[styles.posPl, { color: '#34C759' }]}>+₹450</Text>
                </View>
                <Text style={styles.posQty}>{pos.quantity} Lots • Avg ₹{pos.price}</Text>
              </TouchableOpacity>
            ))
          )}
          <Text style={styles.swipeHint}>← Swipe for Performance →</Text>
        </View>

        {/* Column 3: Performance */}
        <View style={styles.columnView}>
          <View style={styles.columnHeader}>
            <Text style={styles.columnTitle}>Performance</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Performance')}>
              <Text style={styles.manageBtn}>History</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.perfCard}>
            <Text style={styles.perfHeaderLabel}>Total Unrealized P/L</Text>
            <Text style={[styles.perfHeaderValue, { color: currentPL >= 0 ? '#34C759' : '#FF3B30' }]}>
              ₹{currentPL.toFixed(2)}
            </Text>
            <View style={styles.perfDivider} />
            <View style={styles.perfDetailRow}>
              <Text style={styles.perfDetailLabel}>Est. Charges</Text>
              <Text style={styles.perfDetailValue}>₹{totalCharges.toFixed(2)}</Text>
            </View>
          </View>
          
          <Text style={[styles.columnTitle, { marginTop: 24 }]}>Recent Trades</Text>
          {history.length === 0 ? (
            <Text style={styles.emptyText}>No recent activity</Text>
          ) : (
            history.slice(0, 3).map(h => (
              <View key={h.id} style={styles.historyItem}>
                <Text style={styles.historySymbol}>{h.symbol} {h.strike} {h.optionType}</Text>
                <Text style={[styles.historyType, { color: h.type === 'buy' ? '#007AFF' : '#FF9500' }]}>
                  {h.type === 'buy' ? 'BOUGHT' : 'CLOSED'}
                </Text>
              </View>
            ))
          )}
          <Text style={styles.swipeHint}>← Swipe back for Market</Text>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120', // Pro Dark Blue Theme
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#1E293B',
  },
  headerLabel: {
    color: '#94A3B8',
    fontSize: 12,
  },
  balanceText: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: 'bold',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabItem: {
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#3B82F6',
  },
  tradeLabBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  tradeLabText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: 'bold',
  },
  rowContainer: {
    flexGrow: 1,
  },
  columnView: {
    width: width,
    padding: 24,
  },
  columnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  manageBtn: {
    color: '#3B82F6',
    fontWeight: 'bold',
  },
  swipeHint: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 40,
    fontStyle: 'italic',
  },
  // ... other styles same or updated below
  columnTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  indexCard: {
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  indexHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  simBadge: {
    backgroundColor: '#334155',
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  indexName: {
    color: '#94A3B8',
    fontSize: 14,
  },
  indexValue: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: 'bold',
  },
  indexChange: {
    fontSize: 14,
    marginTop: 4,
  },
  optionChainLink: {
    color: '#3B82F6',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'right',
  },
  posCard: {
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  posHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  posSymbol: {
    color: '#F8FAFC',
    fontWeight: '600',
  },
  posQty: {
    color: '#94A3B8',
  },
  posFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  posAvg: {
    color: '#94A3B8',
    fontSize: 12,
  },
  posPl: {
    fontWeight: 'bold',
  },
  emptyCard: {
    backgroundColor: '#1E293B',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyText: {
    color: '#64748B',
  },
  emptySubText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  perfCard: {
    backgroundColor: '#1E293B',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  perfHeaderLabel: {
    color: '#94A3B8',
    fontSize: 14,
  },
  perfHeaderValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginVertical: 8,
  },
  perfDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 12,
  },
  perfDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  perfDetailLabel: {
    color: '#94A3B8',
  },
  perfDetailValue: {
    color: '#F8FAFC',
    fontWeight: '500',
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  historySymbol: {
    color: '#F8FAFC',
  },
  historyType: {
    fontWeight: '600',
    fontSize: 12,
  },
  viewMore: {
    color: '#3B82F6',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  }
});
