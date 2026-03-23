import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchLivePrice, calculateOptionPrice } from '../utils/marketService';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [balance, setBalance] = useState(2000000); // 20L Virtual Money
  const [positions, setPositions] = useState([]);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initial Load
  useEffect(() => {
    const loadState = async () => {
      try {
        const savedBalance = await AsyncStorage.getItem('@trading_balance');
        const savedPositions = await AsyncStorage.getItem('@trading_positions');
        const savedHistory = await AsyncStorage.getItem('@trading_history');

        if (savedBalance) setBalance(JSON.parse(savedBalance));
        if (savedPositions) setPositions(JSON.parse(savedPositions));
        if (savedHistory) setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to load trading state', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadState();
  }, []);

  // Persistence
  useEffect(() => {
    const saveState = async () => {
      try {
        await AsyncStorage.setItem('@trading_balance', JSON.stringify(balance));
        await AsyncStorage.setItem('@trading_positions', JSON.stringify(positions));
        await AsyncStorage.setItem('@trading_history', JSON.stringify(history));
      } catch (e) {
        console.error('Failed to save trading state', e);
      }
    };
    if (!isLoading) saveState();
  }, [balance, positions, history, isLoading]);

  const executeTrade = (trade) => {
    // trade: { symbol, type (buy/sell), price, quantity, expiry, strike, optionType }
    const totalCost = trade.price * trade.quantity;
    const charges = 20; // Flat mock brokerage

    if (totalCost + charges > balance) {
      return { success: false, message: 'Insufficient Balance' };
    }

    setBalance(prev => prev - (totalCost + charges));
    
    // Add to positions (super simplified: just appending for now)
    const newPosition = {
      id: Date.now().toString(),
      ...trade,
      timestamp: new Date().toISOString(),
    };
    setPositions(prev => [...prev, newPosition]);
    
    // Log history
    setHistory(prev => [{ ...newPosition, charges }, ...prev]);
    
    return { success: true };
  };

  const closePosition = (id, currentPrice) => {
    const posIndex = positions.findIndex(p => p.id === id);
    if (posIndex === -1) return;

    const pos = positions[posIndex];
    const proceeds = currentPrice * pos.quantity;
    const charges = 20;

    setBalance(prev => prev + proceeds - charges);
    
    // Remove from positions
    const updatedPositions = [...positions];
    updatedPositions.splice(posIndex, 1);
    setPositions(updatedPositions);

    // Update history with P/L
    const pnl = (currentPrice - pos.price) * pos.quantity - (charges + 20); // 20 for entry, 20 for exit
    setHistory(prev => [{
      ...pos,
      type: 'close',
      exitPrice: currentPrice,
      pnl,
      charges: charges + 20,
      timestamp: new Date().toISOString()
    }, ...prev]);
  };

  const modifyPosition = (id, target, stopLoss) => {
    setPositions(prev => prev.map(p => 
      p.id === id ? { ...p, target, stopLoss } : p
    ));
  };

  // Background Target/Stop-Loss Auto Execution Engine
  // Use a ref to always access the latest state without resetting the interval constantly
  const stateRef = useRef({ positions, closePosition });
  useEffect(() => {
    stateRef.current = { positions, closePosition };
  }, [positions, closePosition]);

  useEffect(() => {
    const checkLimits = async () => {
      const { positions, closePosition } = stateRef.current;
      if (positions.length === 0) return;
      
      const symbolsToFetch = [...new Set(positions.map(p => p.symbol))];
      const spotPrices = {};
      
      await Promise.all(symbolsToFetch.map(async (sym) => {
        const res = await fetchLivePrice(sym);
        if (res.success) spotPrices[sym] = res.price;
      }));
      
      positions.forEach(pos => {
        const spot = spotPrices[pos.symbol];
        if (!spot) return;
        
        const currentLTP = calculateOptionPrice(spot, pos.strike, pos.optionType, pos.optionType === 'CE');
        
        let shouldClose = false;
        if (pos.type === 'buy') {
          if (pos.target && currentLTP >= pos.target) shouldClose = true;
          if (pos.stopLoss && currentLTP <= pos.stopLoss) shouldClose = true;
        } else {
          // sell order
          if (pos.target && currentLTP <= pos.target) shouldClose = true;
          if (pos.stopLoss && currentLTP >= pos.stopLoss) shouldClose = true;
        }
        
        if (shouldClose) {
          closePosition(pos.id, currentLTP);
        }
      });
    };
    
    // Check every 4 seconds to act like a real broker execution engine
    const timer = setInterval(checkLimits, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <AppContext.Provider value={{ 
      balance, 
      positions, 
      history, 
      executeTrade, 
      closePosition,
      modifyPosition,
      isLoading 
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
