import { Cpu, Database, Network, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

export function TelemetryPanel({ activeWorkers }: { activeWorkers: number[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      {/* Worker Pool */}
      <div className="col-span-2 p-5 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm shadow-lg">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-neon-purple" />
            <h2 className="text-lg font-medium text-slate-200">Zone 2 & 3 Worker Pool</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">ACTIVE THREADS</span>
            <span className="text-sm font-bold font-mono text-neon-purple bg-neon-purple/10 px-2 py-0.5 rounded">
              {activeWorkers.length} / 50
            </span>
          </div>
        </div>

        <div className="grid grid-cols-10 gap-2">
          {Array.from({ length: 50 }).map((_, i) => {
            const isActive = activeWorkers.includes(i);
            const isProcessingFraud = isActive && Math.random() > 0.5; // Simulate some working on fraud

            return (
              <motion.div
                key={i}
                initial={false}
                animate={{
                  backgroundColor: isProcessingFraud 
                    ? '#ef4444' // Crimson for fraud processing
                    : isActive 
                      ? '#8b5cf6' // Purple for normal processing
                      : '#10b981', // Emerald for idle/ready
                  scale: isActive ? 1.1 : 1,
                }}
                transition={{ duration: 0.2 }}
                className="h-6 rounded flex items-center justify-center border border-slate-800/50"
              >
                <span className="text-[9px] font-mono opacity-50 text-white mix-blend-overlay">
                  {i.toString().padStart(2, '0')}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Redis Data Layers */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm shadow-lg flex flex-col gap-4">
        <div className="flex items-center gap-2 mb-2 pb-4 border-b border-slate-800">
          <Database className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-medium text-slate-200">Redis Data Layers</h2>
        </div>

        <div className="flex-1 flex flex-col gap-4">
          <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/50 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-amber-400 font-semibold uppercase tracking-wider">Hashes</span>
              <Network className="h-3 w-3 text-amber-500" />
            </div>
            <p className="text-sm text-slate-300">User Profiles Cached</p>
            <div className="mt-2 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-amber-500" 
                animate={{ width: ['70%', '75%', '72%', '78%'] }} 
                transition={{ duration: 4, repeat: Infinity, repeatType: 'reverse' }}
              />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/50 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-emerald-400 font-semibold uppercase tracking-wider">Sorted Sets</span>
              <Activity className="h-3 w-3 text-emerald-500" />
            </div>
            <p className="text-sm text-slate-300">Sliding 5-Min Time Windows</p>
            <div className="mt-2 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-emerald-500" 
                animate={{ width: ['40%', '55%', '45%', '60%'] }} 
                transition={{ duration: 3, repeat: Infinity, repeatType: 'reverse' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
