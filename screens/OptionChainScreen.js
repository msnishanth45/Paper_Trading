import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Animated, Dimensions, TextInput, Modal, Switch, KeyboardAvoidingView, Platform, RefreshControl } from 'react-native';
import { useApp } from '../context/AppContext';
import { fetchLivePrice, calculateOptionPrice, LOT_SIZES } from '../utils/marketService';

const { width, height } = Dimensions.get('window');

export default function OptionChainScreen({ route, navigation }) {
  const { symbol: initialSymbol } = route.params;
  const { executeTrade, balance } = useApp();
  
  const [symbol, setSymbol] = useState(initialSymbol);
  const [showDropdown, setShowDropdown] = useState(false);
  const [viewMode, setViewMode] = useState('LTP'); // LTP or OI
  const [selectedStrike, setSelectedStrike] = useState(null);
  const [orderMode, setOrderMode] = useState(null); // 'buy' or 'sell'
  const [isOrderFormVisible, setIsOrderFormVisible] = useState(false);
  
  // Order Form State
  const [quantity, setQuantity] = useState('1'); // Default to 1 lot
  const [priceLimit, setPriceLimit] = useState('');
  const [isMarketPrice, setIsMarketPrice] = useState(true);
  const [target, setTarget] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const data = await fetchLivePrice(symbol);
    if (data.success) {
      setSpotPrice(data.price);
      setMarketMeta({ change: data.change, changePercent: data.changePercent });
    }
    setRefreshing(false);
  }, [symbol]);

  // Market Spot Price and Data
  const [spotPrice, setSpotPrice] = useState(symbol === 'NIFTY' ? 22350.50 : (symbol === 'BANKNIFTY' ? 47280.15 : 73650.80));
  const [marketMeta, setMarketMeta] = useState({ change: 0, changePercent: 0 });
  const [isLive, setIsLive] = useState(false);
  
  // Market Hours Check (NSE: Mon-Fri, 9:15 AM - 3:30 PM IST)
  const isMarketOpen = () => {
    const now = new Date();
    // Convert current time to IST
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffset);
    
    const day = istTime.getDay();
    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();
    const currentTimeInMinutes = hours * 60 + minutes;

    const isWeekday = day >= 1 && day <= 5;
    const isAfterOpen = currentTimeInMinutes >= (9 * 60 + 15);
    const isBeforeClose = currentTimeInMinutes < (15 * 60 + 30);

    return isWeekday && isAfterOpen && isBeforeClose;
  };

  useEffect(() => {
    const updateMarketData = async () => {
      const data = await fetchLivePrice(symbol);
      if (data.success) {
        setSpotPrice(data.price);
        setMarketMeta({ change: data.change, changePercent: data.changePercent });
        setIsLive(true);
      } else {
        setIsLive(false);
        // Fallback or handle error
      }
    };

    updateMarketData(); // Immediate fetch

    const timer = setInterval(() => {
      if (isMarketOpen()) {
        updateMarketData();
      }
    }, 5000); // Update every 5 seconds for live feel
    return () => clearInterval(timer);
  }, [symbol]);

  const step = symbol === 'NIFTY' ? 50 : (symbol === 'BANKNIFTY' ? 100 : 100);
  const strikes = [];
  const baseStrike = Math.round(spotPrice / step) * step;

  // Generate a wider range of strikes (e.g., 20 instead of 10) for better dynamics
  for (let i = -15; i <= 15; i++) {
    const strike = baseStrike + (i * step);
    const distance = Math.abs(spotPrice - strike);
    // Realistik OI: Higher near ATM, decays as we go OTM
    const ceOI = (Math.exp(-distance / (spotPrice * 0.05)) * (Math.random() * 5 + 5)).toFixed(1) + 'M';
    const peOI = (Math.exp(-distance / (spotPrice * 0.05)) * (Math.random() * 5 + 5)).toFixed(1) + 'M';

    strikes.push({
      strike,
      ce: { 
        price: calculateOptionPrice(spotPrice, strike, 'CE', true),
        oi: ceOI
      },
      pe: { 
        price: calculateOptionPrice(spotPrice, strike, 'PE', false),
        oi: peOI
      }
    });
  }

  const handleStrikeSelect = (item, type, price) => {
    setSelectedStrike({ ...item, type, price });
  };

  const handleExecuteOrder = () => {
    const finalPrice = isMarketPrice ? selectedStrike.price : parseFloat(priceLimit);
    const lotQuantity = parseInt(quantity);
    if (isNaN(lotQuantity) || lotQuantity <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid number of lots.');
      return;
    }
    
    const lotSize = LOT_SIZES[symbol] || 1;
    const totalShares = lotQuantity * lotSize;

    const res = executeTrade({
      symbol,
      strike: selectedStrike.strike,
      optionType: selectedStrike.type,
      price: finalPrice,
      quantity: totalShares,
      displayQuantity: lotQuantity, // store lots for UI
      lotSize: lotSize,
      target: target ? parseFloat(target) : null,
      stopLoss: stopLoss ? parseFloat(stopLoss) : null,
      type: orderMode
    });

    if (res.success) {
      Alert.alert('Order Successful', `${orderMode.toUpperCase()} order for ${lotQuantity} lot(s) (${totalShares} Qty) executed at ₹${finalPrice.toFixed(2)}`);
      setIsOrderFormVisible(false);
      setSelectedStrike(null);
      // Reset form
      setQuantity('1');
      setTarget('');
      setStopLoss('');
      navigation.goBack();
    } else {
      Alert.alert('Error', res.message);
    }
  };

  const renderStrike = ({ item, index }) => {
    const isATM = item.strike === baseStrike;
    const isNextATM = strikes[index + 1]?.strike === baseStrike;

    return (
      <View>
        <View style={styles.strikeRow}>
          <TouchableOpacity 
            style={[styles.priceCell, selectedStrike?.strike === item.strike && selectedStrike?.type === 'CE' && styles.selectedCell]} 
            onPress={() => handleStrikeSelect(item, 'CE', item.ce.price)}
          >
            <Text style={styles.priceText}>
              {viewMode === 'LTP' ? item.ce.price.toFixed(2) : item.ce.oi}
            </Text>
          </TouchableOpacity>
          
          <View style={styles.strikeCell}>
            <Text style={styles.strikeText}>{item.strike}</Text>
          </View>

          <TouchableOpacity 
            style={[styles.priceCell, selectedStrike?.strike === item.strike && selectedStrike?.type === 'PE' && styles.selectedCell]}
            onPress={() => handleStrikeSelect(item, 'PE', item.pe.price)}
          >
            <Text style={styles.priceText}>
              {viewMode === 'LTP' ? item.pe.price.toFixed(2) : item.pe.oi}
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Animated ATM Line Flow */}
        {((spotPrice >= item.strike && spotPrice < item.strike + step) || (spotPrice < item.strike && index === 0)) && (
          <View style={[styles.atmLineContainer, { 
            top: 45 * ((spotPrice - item.strike) / step) 
          }]}>
            <View style={styles.atmLine} />
            <View style={styles.atmLabel}>
              <Text style={styles.atmLabelText}>{spotPrice.toFixed(2)}</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Enhanced Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Text style={styles.dateText}>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</Text>
            <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowDropdown(!showDropdown)}>
              <Text style={styles.dropdownText}>{symbol} ▼</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.priceInfo}>
              <View style={styles.liveIndicatorRow}>
                {isLive && <View style={styles.liveDot} />}
                <Text style={styles.headerPrice}>{spotPrice.toFixed(2)}</Text>
              </View>
              <Text style={[styles.changeText, { color: marketMeta.change >= 0 ? '#34C759' : '#FF3B30' }]}>
                {marketMeta.change >= 0 ? '+' : ''}{marketMeta.change.toFixed(2)} ({marketMeta.changePercent.toFixed(2)}%)
              </Text>
            </View>
          </View>
        </View>

        {showDropdown && (
          <View style={styles.dropdownMenu}>
            {['NIFTY', 'BANKNIFTY', 'SENSEX'].map(s => (
              <TouchableOpacity key={s} style={styles.dropdownItem} onPress={() => { setSymbol(s); setShowDropdown(false); }}>
                <Text style={styles.dropdownItemText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.toggleRow}>
          <TouchableOpacity 
            style={[styles.toggleBtn, viewMode === 'LTP' && styles.activeToggle]} 
            onPress={() => setViewMode('LTP')}
          >
            <Text style={[styles.toggleText, viewMode === 'LTP' && styles.activeToggleText]}>LTP</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleBtn, viewMode === 'OI' && styles.activeToggle]} 
            onPress={() => setViewMode('OI')}
          >
            <Text style={[styles.toggleText, viewMode === 'OI' && styles.activeToggleText]}>OI</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tableHeader}>
          <Text style={styles.headerTitle}>CALLS {viewMode}</Text>
          <Text style={styles.headerTitle}>STRIKE</Text>
          <Text style={styles.headerTitle}>PUTS {viewMode}</Text>
        </View>
      </View>

      <FlatList
        data={strikes}
        keyExtractor={item => item.strike.toString()}
        renderItem={renderStrike}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3B82F6"
            colors={['#3B82F6']}
          />
        }
      />

      {/* Strike Selection Sliding Window */}
      {selectedStrike && !isOrderFormVisible && (
        <View style={styles.slidingWindow}>
          <View style={styles.windowHeader}>
            <View>
              <Text style={styles.windowTitle}>{symbol} {selectedStrike.strike} {selectedStrike.type}</Text>
              <Text style={styles.windowPrice}>₹{selectedStrike.price.toFixed(2)}</Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedStrike(null)}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.windowActions}>
            <TouchableOpacity style={[styles.actionBtn, styles.buyBtn]} onPress={() => { setOrderMode('buy'); setIsOrderFormVisible(true); }}>
              <Text style={styles.actionBtnText}>BUY</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.sellBtn]} onPress={() => { setOrderMode('sell'); setIsOrderFormVisible(true); }}>
              <Text style={styles.actionBtnText}>SELL</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Order Form Modal */}
    <Modal visible={isOrderFormVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidingView}
          >
            <View style={styles.orderForm}>
              <View style={[styles.orderHeader, { backgroundColor: orderMode === 'buy' ? '#34C759' : '#FF3B30' }]}>
                <Text style={styles.orderTitle}>{orderMode?.toUpperCase()} {symbol} {selectedStrike?.strike} {selectedStrike?.type}</Text>
                <TouchableOpacity onPress={() => setIsOrderFormVisible(false)}>
                  <Text style={styles.closeBtn}>✕</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.orderContent}>
                <View style={styles.inputRow}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Quantity (Lots)</Text>
                    <TextInput style={styles.input} value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Price</Text>
                    <TextInput 
                      style={[styles.input, isMarketPrice && styles.disabledInput]} 
                      value={isMarketPrice ? selectedStrike?.price.toFixed(2) : priceLimit} 
                      onChangeText={setPriceLimit} 
                      keyboardType="numeric"
                      editable={!isMarketPrice}
                    />
                  </View>
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>At Market Price</Text>
                  <Switch value={isMarketPrice} onValueChange={setIsMarketPrice} trackColor={{ false: '#2D343E', true: '#34C759' }} />
                </View>

                <View style={styles.inputRow}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Target</Text>
                    <TextInput style={styles.input} value={target} onChangeText={setTarget} placeholder="0.00" keyboardType="numeric" />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Stop Loss</Text>
                    <TextInput style={styles.input} value={stopLoss} onChangeText={setStopLoss} placeholder="0.00" keyboardType="numeric" />
                  </View>
                </View>

                <TouchableOpacity 
                  style={[styles.executeBtn, { backgroundColor: orderMode === 'buy' ? '#34C759' : '#FF3B30' }]}
                  onPress={handleExecuteOrder}
                >
                  <Text style={styles.executeBtnText}>{orderMode?.toUpperCase()} NOW</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  header: {
    backgroundColor: '#1E293B',
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerLeft: {
    alignItems: 'flex-start',
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  dropdownText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  dateText: {
    color: '#8E949D',
    fontSize: 12,
  },
  priceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerPrice: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 18,
    marginRight: 8,
  },
  changeText: {
    fontSize: 12,
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759',
    marginRight: 6,
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 5,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 95,
    left: 16,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    zIndex: 1000,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#334155',
    width: 150,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  dropdownItemText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  toggleBtn: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 10,
    backgroundColor: '#334155',
  },
  activeToggle: {
    backgroundColor: '#3B82F6',
  },
  toggleText: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 12,
  },
  activeToggleText: {
    color: '#FFFFFF',
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#1E293B',
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  headerTitle: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  strikeRow: {
    flexDirection: 'row',
    height: 45,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  priceCell: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  selectedCell: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  strikeCell: {
    width: 80,
    height: '100%',
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  priceText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  strikeText: {
    color: '#FF9500',
    fontWeight: 'bold',
  },
  atmLineContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  atmLine: {
    width: '100%',
    height: 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 5,
  },
  atmLabel: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  atmLabelText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  slidingWindow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1E293B',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  windowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  windowTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  windowPrice: {
    color: '#8E949D',
    fontSize: 14,
    marginTop: 4,
  },
  closeBtn: {
    color: '#8E949D',
    fontSize: 20,
    paddingHorizontal: 8,
  },
  windowActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buyBtn: {
    backgroundColor: '#34C759',
    marginRight: 10,
  },
  sellBtn: {
    backgroundColor: '#FF3B30',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  orderForm: {
    backgroundColor: '#0B1120',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: height * 0.5,
    width: '100%',
  },
  keyboardAvoidingView: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  orderHeader: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  orderTitle: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  orderContent: {
    padding: 24,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  inputGroup: {
    flex: 0.48,
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  disabledInput: {
    opacity: 0.6,
    backgroundColor: '#334155',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  switchLabel: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  executeBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  executeBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 18,
  }
});
