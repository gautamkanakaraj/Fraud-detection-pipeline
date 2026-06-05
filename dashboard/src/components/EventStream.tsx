import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
import type { Transaction } from '../lib/types';

interface EventStreamProps {
  transactions: Transaction[];
  onRowClick: (tx: Transaction) => void;
}

export function EventStream({ transactions, onRowClick }: EventStreamProps) {
  return (
    <div className="flex-1 flex flex-col bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden shadow-lg">
      <div className="p-4 border-b border-slate-800 bg-slate-900/80 sticky top-0 z-10 flex items-center justify-between">
        <h2 className="text-lg font-medium text-slate-200">Real-Time Event Stream</h2>
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-mono text-slate-400">LIVE FEED: fraud-alerts</span>
        </div>
      </div>
      
      {/* Table Header */}
      <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-800/50 text-xs font-mono text-slate-500 uppercase tracking-wider bg-slate-900/30">
        <div className="col-span-2">TX ID</div>
        <div className="col-span-2">Card</div>
        <div className="col-span-2">Amount</div>
        <div className="col-span-2">Location</div>
        <div className="col-span-4">Status</div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
        <div className="flex flex-col p-2">
          <AnimatePresence initial={false}>
            {transactions.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} onClick={() => onRowClick(tx)} />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function TransactionRow({ tx, onClick }: { tx: Transaction; onClick: () => void }) {
  const isAlert = tx.status !== 'CLEARED';
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, type: "spring", bounce: 0.2 }}
      onClick={onClick}
      className={`
        grid grid-cols-12 gap-4 px-4 py-3 mb-1 rounded-lg cursor-pointer items-center text-sm font-mono transition-colors
        ${isAlert ? 'bg-slate-800/40 hover:bg-slate-800/60 border border-slate-700/50' : 'hover:bg-slate-800/30 border border-transparent'}
      `}
    >
      <div className="col-span-2 text-slate-400 truncate">{tx.id}</div>
      <div className="col-span-2 text-slate-300">{tx.card}</div>
      <div className="col-span-2 text-slate-200">${tx.amount.toFixed(2)}</div>
      <div className="col-span-2 text-slate-400 truncate">{tx.location}</div>
      <div className="col-span-4">
        <StatusBadge status={tx.status} subtext={tx.subtext} />
      </div>
    </motion.div>
  );
}

function StatusBadge({ status, subtext }: { status: Transaction['status']; subtext?: string }) {
  if (status === 'CLEARED') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
        <ShieldCheck className="h-3.5 w-3.5" />
        <span>CLEARED</span>
      </div>
    );
  }

  if (status === 'GEOSPATIAL_VIOLATION') {
    return (
      <div className="flex flex-col items-start gap-1">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-crimson-vibrant/30 bg-crimson-vibrant/20 text-crimson-vibrant">
          <ShieldAlert className="h-3.5 w-3.5" />
          <span>GEOSPATIAL_VIOLATION</span>
        </div>
        {subtext && <span className="text-[10px] text-red-400/80 max-w-xs truncate">{subtext}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-amber-500/30 bg-amber-500/20 text-amber-500">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>VELOCITY_BREACH</span>
      </div>
      {subtext && <span className="text-[10px] text-amber-400/80 max-w-xs truncate">{subtext}</span>}
    </div>
  );
}
