import { useState, useEffect, useCallback, useRef } from 'react';
import type { Transaction, TransactionStatus } from './types';

const LOCATIONS = ['New York, NY', 'London, UK', 'Tokyo, JP', 'San Francisco, CA', 'Austin, TX', 'Singapore', 'Dubai, UAE', 'Berlin, DE'];

function generateId() {
  return `tx-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
}

function generateCard() {
  const last4 = Math.floor(1000 + Math.random() * 9000);
  return `**** **** **** ${last4}`;
}

export function useSimulation() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [threatsBlocked, setThreatsBlocked] = useState(0);
  const [cardsFrozen, setCardsFrozen] = useState(0);
  const [latency, setLatency] = useState(0.5);
  const [activeWorkers, setActiveWorkers] = useState<number[]>([]);
  
  const selectedCardForVelocityRef = useRef<string | null>(null);

  const addTransaction = useCallback((tx: Transaction) => {
    setTransactions(prev => [tx, ...prev].slice(0, 50)); // Keep last 50
    setTotalTransactions(prev => prev + 1);
    if (tx.status !== 'CLEARED') {
      setThreatsBlocked(prev => prev + 1);
      setCardsFrozen(prev => prev + 1);
    }
    
    // Simulate latency fluctuation
    setLatency(0.45 + Math.random() * 0.4);

    // Flash some workers
    const activeCount = Math.floor(Math.random() * 15) + 5;
    const workers = Array.from({ length: 50 }, (_, i) => i)
      .sort(() => 0.5 - Math.random())
      .slice(0, activeCount);
    setActiveWorkers(workers);

  }, []);

  useEffect(() => {
    // Generate safe transactions continuously
    const safeInterval = setInterval(() => {
      addTransaction({
        id: generateId(),
        card: generateCard(),
        amount: Math.random() * 500 + 10,
        location: LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)],
        status: 'CLEARED',
        timestamp: new Date(),
      });
    }, 1500);

    // Generate attacks periodically
    const attackInterval = setInterval(() => {
      const isVelocity = Math.random() > 0.5;
      
      if (isVelocity) {
        // Multi-swipe velocity attack
        const card = generateCard();
        const loc = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
        let count = 0;
        
        const burstInterval = setInterval(() => {
          count++;
          if (count > 4) {
            clearInterval(burstInterval);
            return;
          }
          
          addTransaction({
            id: generateId(),
            card: card,
            amount: Math.random() * 1000 + 500,
            location: loc,
            status: count > 1 ? 'VELOCITY_BREACH' : 'CLEARED',
            subtext: count > 1 ? `${count} swipes inside 5-min window` : undefined,
            timestamp: new Date(),
          });
        }, 300); // 300ms bursts
        
      } else {
        // Geospatial mismatch
        const loc1 = 'London, UK';
        const loc2 = 'New York, NY';
        
        addTransaction({
          id: generateId(),
          card: generateCard(),
          amount: Math.random() * 2000 + 100,
          location: loc1,
          status: 'GEOSPATIAL_VIOLATION',
          subtext: `Swipe in ${loc1} mismatching ${loc2} profile`,
          timestamp: new Date(),
        });
      }
    }, 8000); // Attack every 8 seconds

    return () => {
      clearInterval(safeInterval);
      clearInterval(attackInterval);
    };
  }, [addTransaction]);

  return {
    transactions,
    totalTransactions,
    threatsBlocked,
    cardsFrozen,
    latency,
    activeWorkers
  };
}
