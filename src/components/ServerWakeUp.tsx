import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, RefreshCw } from 'lucide-react';

interface Props {
  onReady: () => void;
}

export const ServerWakeUp: React.FC<Props> = ({ onReady }) => {
  const [isWakingUp, setIsWakingUp] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  useEffect(() => {
    const wakeUp = async () => {
      try {
        const response = await fetch('/health');
        if (response.ok) {
          setIsWakingUp(false);
          onReady();
        } else {
          throw new Error('Server not ready');
        }
      } catch (error) {
        console.warn(`[WAKEUP] Attempt ${retryCount + 1} failed:`, error);
        if (retryCount < MAX_RETRIES) {
          setTimeout(() => setRetryCount(prev => prev + 1), 5000); // Wait 5s before retry
        } else {
          // Fail silently and let the app render
          setIsWakingUp(false);
          onReady();
        }
      }
    };

    wakeUp();
  }, [retryCount, onReady]);

  return (
    <AnimatePresence>
      {isWakingUp && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-slate-900 flex items-center justify-center p-6 text-center"
        >
          <div className="max-w-md w-full space-y-8">
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center relative">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 border-2 border-dashed border-emerald-500/30 rounded-3xl"
                />
                <Sparkles className="text-emerald-400" size={40} />
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-serif italic text-white">🚀 Waking up server...</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Our AI engine is currently powering up. This usually takes 30–60 seconds on the first load. 
                Please stay with us!
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 text-emerald-400/60 text-[10px] font-bold uppercase tracking-widest">
              <RefreshCw size={12} className="animate-spin" />
              Attempting connection {retryCount + 1}/{MAX_RETRIES + 1}
            </div>

            <div className="pt-8">
              <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 45, ease: "linear" }}
                  className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
