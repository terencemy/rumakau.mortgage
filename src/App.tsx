import React, { useState } from 'react';
import { MortgageForm } from './components/MortgageForm';
import { AnalysisDashboard } from './components/AnalysisDashboard';
import { VerificationGate } from './components/VerificationGate';
import { analyzeMortgage } from './components/services/gemini';
import { MortgageAnalysisRequest, MortgageAnalysisResult } from './types';
import { ShieldCheck, Calculator, FileText, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type AppState = 'form' | 'verifying' | 'dashboard';

export default function App() {
  const [state, setState] = useState<AppState>('form');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisRequest, setAnalysisRequest] = useState<MortgageAnalysisRequest | null>(null);
  const [analysisResult, setAnalysisResult] = useState<MortgageAnalysisResult | null>(null);

  const handleFormSubmit = async (data: MortgageAnalysisRequest) => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeMortgage(data);
      setAnalysisRequest(data);
      setAnalysisResult(result);
      setState('verifying');
    } catch (error) {
      console.error("Analysis failed:", error);
      alert("Analysis failed. Please check your API key and try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleVerified = async (contactInfo: { type: 'email' | 'whatsapp', value: string }) => {
    // Capture lead
    if (analysisRequest && analysisResult) {
      try {
        await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...contactInfo,
            mainBorrowerName: analysisRequest.mainBorrower.name,
            combinedDsr: analysisResult.dsrCombined,
            riskGrade: analysisResult.riskGrade,
            timestamp: new Date().toISOString()
          })
        });
      } catch (e) {
        console.error("Failed to capture lead:", e);
      }
    }
    setState('dashboard');
  };

  const resetApp = () => {
    setState('form');
    setAnalysisRequest(null);
    setAnalysisResult(null);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Navigation */}
      <nav className="border-b border-slate-200 bg-white/50 backdrop-blur-md sticky top-0 z-50 no-print">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
              <ShieldCheck className="text-emerald-400" size={20} />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-900">Rumakau.com</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Risk & Structuring Engine</p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
              <Calculator size={14} />
              DSR Calculator
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
              <FileText size={14} />
              Policy Check
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {state === 'form' && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <div className="text-center max-w-2xl mx-auto space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                  <Sparkles size={12} />
                  Powered by Gemini 3.0 Flash
                </div>
                <h2 className="text-4xl md:text-5xl font-serif italic text-slate-900">
                  Precision Mortgage Risk Analysis
                </h2>
                <p className="text-slate-500 text-lg leading-relaxed">
                  Advanced structuring engine for Malaysian property loans. 
                  Analyze DSR, identify risk flags, and generate client-ready strategies in seconds.
                </p>
              </div>

              <MortgageForm onSubmit={handleFormSubmit} isAnalyzing={isAnalyzing} />
            </motion.div>
          )}

          {state === 'verifying' && (
            <motion.div
              key="verifying"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="py-12"
            >
              <VerificationGate onVerified={handleVerified} isProcessing={false} />
            </motion.div>
          )}

          {state === 'dashboard' && analysisResult && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 no-print">
                <div className="space-y-2">
                  <h2 className="text-3xl font-serif italic text-slate-900">Risk Assessment Report</h2>
                  <p className="text-slate-500">Generated for {analysisRequest?.mainBorrower.name}</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => window.print()}
                    className="px-6 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-white transition-all"
                  >
                    Download PDF
                  </button>
                  <button 
                    onClick={resetApp}
                    className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-all shadow-lg"
                  >
                    New Analysis
                  </button>
                </div>
              </div>
              <AnalysisDashboard result={analysisResult} onReset={resetApp} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-slate-200 py-12 mt-20 no-print">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2 opacity-50">
            <ShieldCheck size={18} />
            <span className="text-xs font-bold uppercase tracking-widest">Bank-Grade Security</span>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            © 2026 Rumakau.com For professional use only. Data processed session-based.
          </p>
          <div className="flex gap-6 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <a href="#" className="hover:text-slate-900 transition-colors">Privacy</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Terms</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
