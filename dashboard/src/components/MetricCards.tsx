import { Activity, AlertTriangle, Lock, Timer } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface MetricCardsProps {
  totalTransactions: number;
  threatsBlocked: number;
  cardsFrozen: number;
  latency: number;
}

export function MetricCards({ totalTransactions, threatsBlocked, cardsFrozen, latency }: MetricCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <MetricCard
        title="Total Transactions"
        value={totalTransactions.toLocaleString()}
        icon={<Activity className="h-5 w-5" />}
        color="text-slate-300"
        bgColor="bg-slate-800/50"
      />
      <MetricCard
        title="Threats Blocked"
        value={threatsBlocked.toLocaleString()}
        icon={<AlertTriangle className="h-5 w-5" />}
        color="text-crimson-vibrant"
        bgColor="bg-crimson-vibrant/10"
        flashOnUpdate={threatsBlocked}
      />
      <MetricCard
        title="Cards Frozen"
        value={cardsFrozen.toLocaleString()}
        icon={<Lock className="h-5 w-5" />}
        color="text-amber-500"
        bgColor="bg-amber-500/10"
        flashOnUpdate={cardsFrozen}
      />
      <MetricCard
        title="Pipeline E2E Latency"
        value={`${latency.toFixed(2)}ms`}
        icon={<Timer className="h-5 w-5" />}
        color="text-emerald-safe"
        bgColor="bg-emerald-safe/10"
      />
    </div>
  );
}

function MetricCard({ title, value, icon, color, bgColor, flashOnUpdate }: { title: string, value: string | number, icon: React.ReactNode, color: string, bgColor: string, flashOnUpdate?: number }) {
  const [isFlashing, setIsFlashing] = useState(false);

  useEffect(() => {
    if (flashOnUpdate !== undefined && flashOnUpdate > 0) {
      setIsFlashing(true);
      const timer = setTimeout(() => setIsFlashing(false), 500);
      return () => clearTimeout(timer);
    }
  }, [flashOnUpdate]);

  return (
    <motion.div
      animate={{
        scale: isFlashing ? 1.05 : 1,
        borderColor: isFlashing ? 'rgba(239, 68, 68, 0.8)' : 'rgba(30, 41, 59, 0.5)'
      }}
      transition={{ duration: 0.2 }}
      className={`p-5 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm flex flex-col gap-3 shadow-lg relative overflow-hidden`}
    >
      {isFlashing && (
        <motion.div
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 bg-crimson-vibrant/20 pointer-events-none"
        />
      )}
      <div className="flex items-center justify-between text-slate-400">
        <span className="text-sm font-medium tracking-wide uppercase">{title}</span>
        <div className={`p-2 rounded-lg ${bgColor} ${color}`}>
          {icon}
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className={`text-3xl font-bold font-mono tracking-tight ${color === 'text-slate-300' ? 'text-white' : color}`}>
          {value}
        </span>
      </div>
    </motion.div>
  );
}
