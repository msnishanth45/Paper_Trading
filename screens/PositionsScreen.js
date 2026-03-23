import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useApp } from '../context/AppContext';

export default function PositionsScreen({ navigation }) {
  const { positions, closePosition, modifyPosition } = useApp();
  const [modifyModalVisible, setModifyModalVisible] = useState(false);
  const [selectedPos, setSelectedPos] = useState(null);
  const [target, setTarget] = useState('');
  const [stopLoss, setStopLoss] = useState('');

  const handleClose = (pos) => {
    // In a real app, we'd use the accurate real-time price
    const currentPrice = pos.price * (1 + (Math.random() * 0.06 - 0.02));
    
    Alert.alert(
      'Close Position',
      `Close ${pos.symbol} ${pos.strike} ${pos.optionType} at ₹${currentPrice.toFixed(2)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm Match', 
          style: 'destructive',
          onPress: () => {
            closePosition(pos.id, currentPrice);
            Alert.alert('Success', 'Position closed successfully');
          }
        }
      ]
    );
  };

  const handleModifyPress = (pos) => {
    setSelectedPos(pos);
    setTarget(pos.target ? pos.target.toString() : '');
    setStopLoss(pos.stopLoss ? pos.stopLoss.toString() : '');
    setModifyModalVisible(true);
  };

  const handleSaveModify = () => {
    modifyPosition(
      selectedPos.id, 
      target ? parseFloat(target) : null,
      stopLoss ? parseFloat(stopLoss) : null
    );
    setModifyModalVisible(false);
    Alert.alert('Success', 'Order target and stop-loss updated.');
  };

  const renderItem = ({ item }) => {
    const currentPrice = item.price * 1.05; // Mock current price
    const pnl = (currentPrice - item.price) * item.quantity;
    
    return (
      <View style={styles.posCard}>
        <View style={styles.posMain}>
          <View>
            <Text style={styles.symbolText}>{item.displayQuantity || item.quantity / (item.lotSize || 1)} Lot(s) • {item.symbol} {item.strike} {item.optionType}</Text>
            <Text style={styles.detailText}>{item.quantity} Qty @ ₹{item.price.toFixed(2)}</Text>
            {(item.target || item.stopLoss) && (
              <View style={styles.limitsRow}>
                {item.target && <Text style={styles.limitText}>TGT: ₹{item.target}</Text>}
                {item.stopLoss && <Text style={styles.limitText}>SL: ₹{item.stopLoss}</Text>}
              </View>
            )}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.pnlText, { color: pnl >= 0 ? '#34C759' : '#FF3B30' }]}>
              {pnl >= 0 ? '+' : ''}₹{pnl.toFixed(2)}
            </Text>
            <Text style={styles.ltpText}>LTP: ₹{currentPrice.toFixed(2)}</Text>
          </View>
        </View>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.modifyBtn} onPress={() => handleModifyPress(item)}>
            <Text style={styles.modifyBtnText}>MODIFY</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeBtn} onPress={() => handleClose(item)}>
            <Text style={styles.closeBtnText}>EXIT</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const totalUnrealizedPnL = positions.reduce((sum, item) => sum + ((item.price * 1.05) - item.price) * item.quantity, 0);

  return (
    <View style={styles.container}>
      <View style={styles.overallHeader}>
        <Text style={styles.overallHeaderLabel}>Total Unrealized P&L</Text>
        <Text style={[styles.overallHeaderValue, { color: totalUnrealizedPnL >= 0 ? '#34C759' : '#FF3B30' }]}>
          {totalUnrealizedPnL >= 0 ? '+' : ''}₹{totalUnrealizedPnL.toFixed(2)}
        </Text>
      </View>

      {positions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No Open Positions</Text>
          <Text style={styles.emptySub}>Your active trades will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={positions}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        />
      )}

      <Modal visible={modifyModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoidingView}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Modify Order Limits</Text>
                <TouchableOpacity onPress={() => setModifyModalVisible(false)}>
                  <Text style={styles.closeIcon}>✕</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Target Price</Text>
                <TextInput style={styles.input} value={target} onChangeText={setTarget} placeholder="0.00" keyboardType="numeric" />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Stop Loss Price</Text>
                <TextInput style={styles.input} value={stopLoss} onChangeText={setStopLoss} placeholder="0.00" keyboardType="numeric" />
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveModify}>
                <Text style={styles.saveBtnText}>SAVE MODIFICATION</Text>
              </TouchableOpacity>
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
  overallHeader: {
    backgroundColor: '#1E293B',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    alignItems: 'center',
  },
  overallHeaderLabel: {
    color: '#94A3B8',
    fontSize: 14,
  },
  overallHeaderValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 8,
  },
  posCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  posMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 12,
  },
  symbolText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: 'bold',
  },
  detailText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  limitsRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 12,
  },
  limitText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pnlText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  ltpText: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  modifyBtn: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#334155',
  },
  modifyBtnText: {
    color: '#3B82F6',
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 1,
  },
  closeBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    padding: 12,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#FF3B30',
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: 'bold',
  },
  emptySub: {
    color: '#64748B',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  keyboardAvoidingView: {
    width: '100%',
  },
  modalContent: {
    backgroundColor: '#0B1120',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeIcon: {
    color: '#94A3B8',
    fontSize: 20,
  },
  inputGroup: {
    marginBottom: 16,
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
    color: '#F8FAFC',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  saveBtn: {
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
