import { motion, AnimatePresence } from 'framer-motion';
import { Shield, X, CheckCircle2, ArrowRightCircle, AlertOctagon, Smartphone, Lock } from 'lucide-react';
import type { Transaction } from '../lib/types';
import { useEffect, useState } from 'react';

interface ActionLogProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export function ActionLog({ transaction, onClose }: ActionLogProps) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (transaction && transaction.status !== 'CLEARED') {
      setActiveStep(0);
      const timers: NodeJS.Timeout[] = [];
      
      // Simulate sequential interdiction milestones
      for (let i = 1; i <= 5; i++) {
        timers.push(setTimeout(() => {
          setActiveStep(i);
        }, i * 800)); // 800ms between each step
      }

      return () => timers.forEach(clearTimeout);
    }
  }, [transaction]);

  const milestones = [
    { icon: <ArrowRightCircle className="h-5 w-5" />, title: "Ingestion Event Captured by Zone 1 Gateway API", color: "text-blue-400" },
    { icon: <CheckCircle2 className="h-5 w-5" />, title: "Kafka Partition Router Assigned (Card Key Lock)", color: "text-emerald-400" },
    { icon: <AlertOctagon className="h-5 w-5" />, title: `Worker Pool Thread #${Math.floor(Math.random() * 50)} Flagged Violation`, color: "text-crimson-vibrant" },
    { icon: <Smartphone className="h-5 w-5" />, title: "[SMS SENT] Out-of-band cellular warning webhook fired to user device", color: "text-amber-400" },
    { icon: <Lock className="h-5 w-5" />, title: "[REDIS UPDATE] Card status flipped to FROZEN in active cache", color: "text-neon-purple" },
  ];

  return (
    <AnimatePresence>
      {transaction && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
          />
          <motion.div
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.5 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed lg:relative inset-y-0 right-0 z-50 w-96 max-w-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col"
          >
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 sticky top-0">
              <div className="flex items-center gap-2 text-slate-200">
                <Shield className="h-5 w-5 text-neon-purple" />
                <h2 className="font-semibold tracking-wide">Zone 4 Action Log</h2>
              </div>
              <button 
                onClick={onClose}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              <div className="mb-8">
                <h3 className="text-xs font-mono text-slate-500 mb-2 uppercase tracking-wider">Target Incident</h3>
                <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700 font-mono text-sm">
                  <div className="flex justify-between mb-2">
                    <span className="text-slate-400">TX ID:</span>
                    <span className="text-slate-200">{transaction.id}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-slate-400">CARD:</span>
                    <span className="text-slate-200">{transaction.card}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-slate-400">AMOUNT:</span>
                    <span className="text-slate-200">${transaction.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">VIOLATION:</span>
                    <span className="text-crimson-vibrant">{transaction.status}</span>
                  </div>
                </div>
              </div>

              {transaction.status !== 'CLEARED' ? (
                <div>
                  <h3 className="text-xs font-mono text-slate-500 mb-6 uppercase tracking-wider">Interdiction Shield Response</h3>
                  <div className="relative pl-6 border-l-2 border-slate-800 space-y-8">
                    {milestones.map((milestone, index) => {
                      const isComplete = activeStep > index;
                      const isCurrent = activeStep === index;
                      
                      return (
                        <motion.div 
                          key={index}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ 
                            opacity: isComplete || isCurrent ? 1 : 0.3, 
                            x: isComplete || isCurrent ? 0 : -10 
                          }}
                          className="relative"
                        >
                          <div className={`absolute -left-[35px] bg-slate-900 rounded-full p-1 border-2 ${isComplete ? 'border-neon-purple' : isCurrent ? 'border-amber-500 animate-pulse' : 'border-slate-800'} ${milestone.color}`}>
                            {milestone.icon}
                          </div>
                          <div className={`text-sm ${isComplete ? 'text-slate-200' : isCurrent ? 'text-white font-medium' : 'text-slate-600'}`}>
                            Milestone {index + 1}: {milestone.title}
                          </div>
                          {isCurrent && (
                            <div className="mt-2 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                              <motion.div 
                                className="h-full bg-amber-500" 
                                animate={{ width: ['0%', '100%'] }} 
                                transition={{ duration: 0.8 }}
                              />
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                  <Shield className="h-12 w-12 mb-4 opacity-20" />
                  <p>Transaction Cleared. No interdiction required.</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
