import { useState } from 'react';
import { TopNav } from './components/TopNav';
import { MetricCards } from './components/MetricCards';
import { TelemetryPanel } from './components/TelemetryPanel';
import { EventStream } from './components/EventStream';
import { ActionLog } from './components/ActionLog';
import { useSimulation } from './lib/simulation';
import type { Transaction } from './lib/types';

function App() {
  const {
    transactions,
    totalTransactions,
    threatsBlocked,
    cardsFrozen,
    latency,
    activeWorkers
  } = useSimulation();

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans text-slate-200">
      <TopNav />
      
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
