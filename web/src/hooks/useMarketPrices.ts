"use client";

import { useState, useEffect } from 'react';
import { socketService } from '../services/socketService';

interface Prices {
  [symbol: string]: number;
}

export function useMarketPrices() {
  const [prices, setPrices] = useState<Prices>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    socketService.connect();
    
    // Send subscription command
    socketService.subscribe('subscribe-prices');

    const unsubscribe = socketService.on('price-update', (data: { prices: Prices; timestamp: number }) => {
      setPrices((prev) => ({ ...prev, ...data.prices }));
      setLastUpdated(new Date(data.timestamp));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return { prices, lastUpdated };
}
