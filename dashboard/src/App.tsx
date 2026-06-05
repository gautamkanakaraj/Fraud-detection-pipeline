import { useState, useCallback } from 'react';
import { TopNav } from './components/TopNav';
import { MetricCards } from './components/MetricCards';
import { TelemetryPanel } from './components/TelemetryPanel';
import { EventStream } from './components/EventStream';
import { ActionLog } from './components/ActionLog';
import { useSimulation } from './lib/simulation';
import { useLiveStream } from './lib/liveStream';
import type { Transaction } from './lib/types';
import type { FraudAlertPayload } from './lib/liveStream';

function App() {
  const [isLive, setIsLive] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [threatsBlocked, setThreatsBlocked] = useState(0);
  const [cardsFrozen, setCardsFrozen] = useState(0);
  const [latency, setLatency] = useState(0.5);
  const [activeWorkers, setActiveWorkers] = useState<number[]>([]);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Common handler to append transactions
  const handleNewTransaction = useCallback((tx: Transaction) => {
    setTransactions((prev) => {
      // If the incoming transaction is an alert, or if it already exists, update it.
      // In a live system, a transaction is clear first, then a threat is flagged later.
      const existsIdx = prev.findIndex((p) => p.id === tx.id);
      if (existsIdx > -1) {
        const updated = [...prev];
        updated[existsIdx] = { ...updated[existsIdx], ...tx };
        return updated;
      }
      return [tx, ...prev].slice(0, 50);
    });

    setTotalTransactions((prev) => prev + 1);
    if (tx.status !== 'CLEARED') {
      setThreatsBlocked((prev) => prev + 1);
      setCardsFrozen((prev) => prev + 1);
    }

    // Fluctuate latency
    setLatency(0.45 + Math.random() * 0.4);

    // Randomize active workers
    const activeCount = Math.floor(Math.random() * 15) + 5;
    const workers = Array.from({ length: 50 }, (_, i) => i)
      .sort(() => 0.5 - Math.random())
      .slice(0, activeCount);
    setActiveWorkers(workers);
  }, []);

  // Handler for live fraud alerts
  const handleFraudAlert = useCallback((alert: FraudAlertPayload) => {
    // Override the transaction in the list
    setTransactions((prev) => {
      const existsIdx = prev.findIndex((p) => p.id === alert.transaction_id);
      
      // Determine violation type from backend violations list
      let status: Transaction['status'] = 'VELOCITY_BREACH';
      let subtext = undefined;
      
      if (alert.violations && alert.violations.length > 0) {
        const v = alert.violations[0];
        if (v.toLowerCase().includes('geospatial') || v.toLowerCase().includes('location')) {
          status = 'GEOSPATIAL_VIOLATION';
        }
        subtext = v;
      }

      const updatedAlertTx: Transaction = {
        id: alert.transaction_id,
        card: alert.card_number,
        amount: existsIdx > -1 ? prev[existsIdx].amount : Math.random() * 1000 + 500,
        location: existsIdx > -1 ? prev[existsIdx].location : 'Unknown',
        status: status,
        subtext: subtext,
        timestamp: new Date(alert.timestamp * 1000),
      };

      // Auto-open side drawer for the incoming live alert
      setSelectedTx(updatedAlertTx);

      if (existsIdx > -1) {
        const updated = [...prev];
        updated[existsIdx] = updatedAlertTx;
        return updated;
      }
      return [updatedAlertTx, ...prev].slice(0, 50);
    });

    setThreatsBlocked((prev) => prev + 1);
    setCardsFrozen((prev) => prev + 1);
  }, []);

  // Initialize simulation when not live
  useSimulation({
    enabled: !isLive,
    onTransaction: handleNewTransaction,
  });

  // Initialize live WebSocket stream when live
  const { status: wsStatus } = useLiveStream({
    enabled: isLive,
    onTransaction: handleNewTransaction,
    onFraudAlert: handleFraudAlert,
  });

  // Handle mode toggle (clear list when switching modes for visual clarity)
  const handleToggleLive = (val: boolean) => {
    setIsLive(val);
    setTransactions([]);
    setTotalTransactions(0);
    setThreatsBlocked(0);
    setCardsFrozen(0);
    setSelectedTx(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans text-slate-200">
      <TopNav isLive={isLive} setIsLive={handleToggleLive} wsStatus={wsStatus} />
      
      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 p-6 overflow-y-auto flex flex-col">
          <MetricCards 
            totalTransactions={totalTransactions}
            threatsBlocked={threatsBlocked}
            cardsFrozen={cardsFrozen}
            latency={latency}
          />
          
          <TelemetryPanel activeWorkers={activeWorkers} />
          
          <EventStream 
            transactions={transactions} 
            onRowClick={(tx) => setSelectedTx(tx)} 
          />
        </div>

        {selectedTx && (
          <ActionLog 
            transaction={selectedTx} 
            onClose={() => setSelectedTx(null)} 
          />
        )}
      </main>
    </div>
  );
}

export default App;
