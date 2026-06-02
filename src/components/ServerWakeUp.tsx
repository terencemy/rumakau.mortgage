import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw } from 'lucide-react';

interface Props {
  onReady: () => void;
}

export const ServerWakeUp: React.FC<Props> = ({ onReady }) => {
  const [isWakingUp, setIsWakingUp] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 15; // Handle slow cold starts up to ~80 seconds comfortably

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
          setTimeout(() => setRetryCount(prev => prev + 1), 5000); // Check every 5 seconds
        } else {
          // Fail-safe: let the app render if the retry limits are exceeded
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
          className="fixed inset-0 z-[9999] bg-slate-950 flex items-center justify-center p-6 text-center"
        >
          <div className="max-w-md w-full space-y-8">
            <div className="flex justify-center">
              <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center relative shadow-[0_0_40px_rgba(16,185,129,0.15)]">
                {/* Pulsing ring */}
                <motion.div
                  animate={{ scale: [1, 1.12, 1], opacity: [0.1, 0.4, 0.1] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 border border-emerald-500 rounded-full"
                />
                <motion.div
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-2 bg-emerald-500/10 rounded-full"
                />
                
                {/* Custom Brand Shield Logo */}
                <motion.img
                  src="/shield_icon.svg"
                  alt="Rumakau Shield"
                  className="w-20 h-20 relative z-10 select-none object-contain pointer-events-none rounded-full"
                  animate={{ rotate: [0, 4, -4, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-serif italic text-white flex items-center justify-center gap-2">
                <span>🚀</span> Waking up server...
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
                Our secure AI engine is currently powering up. This usually takes 15–45 seconds on the first load of a new session. We appreciate your patience!
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 text-emerald-400/80 text-[10px] font-bold uppercase tracking-widest bg-emerald-950/40 border border-emerald-900/40 px-4 py-2 rounded-full w-fit mx-auto backdrop-blur-sm shadow-sm">
              <RefreshCw size={12} className="animate-spin text-emerald-400" />
              Initializing secure link ({retryCount + 1}/{MAX_RETRIES + 1})
            </div>

            <div className="pt-4 max-w-xs mx-auto">
              <div className="w-full bg-slate-800/80 h-1 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 60, ease: "linear" }}
                  className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse"
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
