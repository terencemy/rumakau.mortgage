import React, { useState } from 'react';
import { MortgageForm } from './components/MortgageForm';
import { AnalysisDashboard } from './components/AnalysisDashboard';
import { VerificationGate } from './components/VerificationGate';
import { AdminAuthModal } from './components/AdminAuthModal';
import { InvestmentForm } from './components/InvestmentCalculator/InvestmentForm';
import { InvestmentDashboard } from './components/InvestmentCalculator/InvestmentDashboard';
import { analyzeMortgage } from './components/services/gemini';
import { calculateInvestment } from './utils/investmentCalculations';
import { MortgageAnalysisRequest, MortgageAnalysisResult, InvestmentCalculatorInput, InvestmentAnalysisResult } from './types';
import { ShieldCheck, Calculator, FileText, Sparkles, TrendingUp, Home, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { downloadBNMGuidelines } from './utils/pdfGenerator';

type ToolType = 'mortgage' | 'investment';
type AppState = 'form' | 'verifying' | 'dashboard';

export default function App() {
  const [activeTool, setActiveTool] = useState<ToolType>('mortgage');
  const [state, setState] = useState<AppState>('form');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Mortgage State
  const [analysisRequest, setAnalysisRequest] = useState<MortgageAnalysisRequest | null>(null);
  const [analysisResult, setAnalysisResult] = useState<MortgageAnalysisResult | null>(null);
  
  // Investment State
  const [investmentInput, setInvestmentInput] = useState<InvestmentCalculatorInput | null>(null);
  const [investmentResult, setInvestmentResult] = useState<InvestmentAnalysisResult | null>(null);
  
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  const handleMortgageSubmit = async (data: MortgageAnalysisRequest) => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeMortgage(data);
      setAnalysisRequest(data);
      setAnalysisResult(result);
      setState('verifying');
    } catch (error: any) {
      console.error("Analysis failed:", error);
      alert(`Analysis failed: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleInvestmentSubmit = (data: InvestmentCalculatorInput) => {
    setIsAnalyzing(true);
    setTimeout(() => {
      const result = calculateInvestment(data);
      setInvestmentInput(data);
      setInvestmentResult(result);
      setState('verifying');
      setIsAnalyzing(false);
    }, 1500);
  };

  const handleVerified = async (contactInfo: { type: 'email', value: string }) => {
    // Capture lead
    const leadData = activeTool === 'mortgage' && analysisRequest && analysisResult ? {
      contactType: contactInfo.type,
      contactValue: contactInfo.value,
      mainBorrowerName: analysisRequest.mainBorrower.name,
      propertyAddress: analysisRequest.property.address,
      propertyType: analysisRequest.property.propertyType,
      spaPrice: analysisRequest.property.spaPrice,
      loanAmount: analysisRequest.property.loanAmount,
      dsrMain: analysisResult.dsrMain,
      dsrJoint: analysisResult.dsrJoint,
      combinedDsr: analysisResult.dsrCombined,
      netMonthlyIncomeMain: analysisResult.netMonthlyIncomeMain,
      netMonthlyIncomeJoint: analysisResult.netMonthlyIncomeJoint,
      stressTestInstallment: analysisResult.stressTestInstallment,
      approvalProbability: analysisResult.approvalProbability,
      bankCategory: analysisResult.bankCategory,
      riskGrade: analysisResult.riskGrade,
      leadType: 'mortgage',
      roi: 0,
      timestamp: new Date().toISOString()
    } : activeTool === 'investment' && investmentInput && investmentResult ? {
      contactType: contactInfo.type,
      contactValue: contactInfo.value,
      mainBorrowerName: "Investor Lead",
      propertyAddress: "ROI Check",
      propertyType: "Investment",
      spaPrice: investmentInput.propertyPrice,
      loanAmount: investmentInput.loanAmount,
      dsrMain: 0,
      dsrJoint: 0,
      combinedDsr: 0,
      netMonthlyIncomeMain: investmentResult.netMonthlyCashFlow,
      netMonthlyIncomeJoint: 0,
      stressTestInstallment: investmentResult.monthlyRepayment,
      approvalProbability: investmentResult.smartScore,
      bankCategory: investmentResult.riskLevel,
      riskGrade: "INV",
      leadType: 'investment',
      roi: investmentResult.roi,
      timestamp: new Date().toISOString()
    } : null;

    if (leadData) {
      try {
        await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(leadData)
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
    setInvestmentInput(null);
    setInvestmentResult(null);
  };

  const switchTool = (tool: ToolType) => {
    setActiveTool(tool);
    resetApp();
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
              <div className="text-sm font-bold tracking-tight text-slate-900">Rumakau.com</div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Mortgage & Investment AI</p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-4">
            <button 
              onClick={() => switchTool('mortgage')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${activeTool === 'mortgage' ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'text-slate-400 hover:text-slate-900'}`}
            >
              <Calculator size={14} /> DSR Check
            </button>
            <button 
              onClick={() => switchTool('investment')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${activeTool === 'investment' ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'text-slate-400 hover:text-slate-900'}`}
            >
              <TrendingUp size={14} /> ROI Check
            </button>
            <div className="h-4 w-[1px] bg-slate-200 mx-2" />
            <button 
              onClick={downloadBNMGuidelines}
              className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors"
            >
              <FileText size={14} /> Policy
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Tool Switcher */}
      <div className="md:hidden flex p-2 bg-white border-b border-slate-100 no-print">
        <button 
          onClick={() => switchTool('mortgage')}
          className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${activeTool === 'mortgage' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}
        >
          DSR Check
        </button>
        <button 
          onClick={() => switchTool('investment')}
          className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${activeTool === 'investment' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}
        >
          ROI Check
        </button>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Hidden SEO Content for AI Crawlers */}
        <section className="sr-only">
          <h2>Rumakau: Malaysia's Advanced Mortgage AI & Investment Calculator</h2>
          <p>
            Rumakau.com offers professional tools for the Malaysian property market. 
            Our Property Investment Calculator helps investors evaluate rental yield, ROI, and cash flow.
            Calculate mortgage repayments, net rental income, and perform stress tests on interest rate hikes.
            Optimized for Malaysian property investors, real estate agents, and mortgage bankers.
          </p>
          <h3>ROI Check Features:</h3>
          <ul>
            <li>Rental Yield Calculator Malaysia: Gross and Net yield analysis.</li>
            <li>Property ROI Calculator: Calculate return on investment including legal fees and renovation.</li>
            <li>Cash Flow Analysis: Monthly net profit after all expenses.</li>
            <li>Stress Test Scenarios: Interest rate and vacancy risk simulation.</li>
            <li>Smart Investment Score: Automated deal grading.</li>
          </ul>
        </section>

        <AnimatePresence mode="wait">
          {state === 'form' && (
            <motion.div
              key={`${activeTool}-form`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <div className="text-center max-w-2xl mx-auto space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                  <Sparkles size={12} />
                  {activeTool === 'mortgage' ? 'Gemini 3.0 Flash Analysis' : 'Professional Investment Engine'}
                </div>
                <h1 className="text-4xl md:text-5xl font-serif italic text-slate-900">
                  {activeTool === 'mortgage' ? 'DSR Check' : 'ROI Check'}
                </h1>
                <p className="text-slate-500 text-lg leading-relaxed">
                  {activeTool === 'mortgage' 
                    ? 'Advanced structuring engine for Malaysian property loans. Analyze DSR and generate client-ready strategies.'
                    : 'Evaluate rental profitability, ROI, and cash flow for Malaysian properties. Make data-driven investment decisions.'}
                </p>
              </div>

              {activeTool === 'mortgage' ? (
                <MortgageForm onSubmit={handleMortgageSubmit} isAnalyzing={isAnalyzing} />
              ) : (
                <InvestmentForm onSubmit={handleInvestmentSubmit} isLoading={isAnalyzing} />
              )}
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

          {state === 'dashboard' && (
            <motion.div
              key={`${activeTool}-dashboard`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 no-print">
                <div className="space-y-2">
                  <h2 className="text-3xl font-serif italic text-slate-900">
                    {activeTool === 'mortgage' ? 'Risk Assessment Report' : 'ROI Performance Report'}
                  </h2>
                  <p className="text-slate-500">
                    {activeTool === 'mortgage' 
                      ? `Generated for ${analysisRequest?.mainBorrower.name}` 
                      : `Analysis for RM ${investmentInput?.propertyPrice.toLocaleString()} Property`}
                  </p>
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
              
              {activeTool === 'mortgage' && analysisResult ? (
                <AnalysisDashboard result={analysisResult} onReset={resetApp} />
              ) : investmentResult && investmentInput ? (
                <InvestmentDashboard result={investmentResult} input={investmentInput} onReset={resetApp} />
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AdminAuthModal 
        isOpen={isAdminModalOpen} 
        onClose={() => setIsAdminModalOpen(false)} 
      />

      <footer className="border-t border-slate-200 py-12 mt-20 no-print">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2 opacity-50">
            <ShieldCheck size={18} />
            <span className="text-xs font-bold uppercase tracking-widest">Bank-Grade Security</span>
          </div>
          <p className="text-xs text-slate-400 font-medium text-center md:text-left">
            © 2026 Rumakau.com For professional use only. Data processed session-based.
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <button onClick={() => switchTool('mortgage')} className="hover:text-slate-900 transition-colors">DSR Tool</button>
            <button onClick={() => switchTool('investment')} className="hover:text-slate-900 transition-colors">ROI Check Tool</button>
            <button 
              onClick={() => setIsAdminModalOpen(true)} 
              className="hover:text-slate-900 transition-colors opacity-20 hover:opacity-100"
            >
              Admin
            </button>
            <a 
              href="https://wa.me/60123632338" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-slate-900 transition-colors"
            >
              Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
