import React, { useState, useEffect } from 'react';
import { MortgageForm } from './components/MortgageForm';
import { AnalysisDashboard } from './components/AnalysisDashboard';
import { VerificationGate } from './components/VerificationGate';
import { AdminAuthModal } from './components/AdminAuthModal';
import { InvestmentForm } from './components/InvestmentCalculator/InvestmentForm';
import { InvestmentDashboard } from './components/InvestmentCalculator/InvestmentDashboard';
import { analyzeMortgage } from './components/services/gemini';
import { calculateInvestment } from './utils/investmentCalculations';
import { MortgageAnalysisRequest, MortgageAnalysisResult, InvestmentCalculatorInput, InvestmentAnalysisResult } from './types';
import { ShieldCheck, Calculator, FileText, Sparkles, TrendingUp, Home, ChevronRight, Share2, Check, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { downloadBNMGuidelines, downloadMortgageReport, downloadInvestmentReport } from './utils/pdfGenerator';
import { ServerWakeUp } from './components/ServerWakeUp';

type ToolType = 'mortgage' | 'investment';
type AppState = 'form' | 'verifying' | 'dashboard';

export default function App() {
  const [isServerReady, setIsServerReady] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolType>('mortgage');
  const [state, setState] = useState<AppState>('form');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isShared, setIsShared] = useState(false);
  
  // Mortgage State
  const [analysisRequest, setAnalysisRequest] = useState<MortgageAnalysisRequest | null>(null);
  const [analysisResult, setAnalysisResult] = useState<MortgageAnalysisResult | null>(null);
  
  // Investment State
  const [investmentInput, setInvestmentInput] = useState<InvestmentCalculatorInput | null>(null);
  const [investmentResult, setInvestmentResult] = useState<InvestmentAnalysisResult | null>(null);
  
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isSharedLink, setIsSharedLink] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedData = params.get('data');
    const tool = params.get('tool');
    
    if (sharedData && tool) {
      try {
        // Use a more robust way to decode base64 with potential Unicode characters
        const decodedStr = decodeURIComponent(escape(window.atob(sharedData)));
        const decoded = JSON.parse(decodedStr);
        
        if (tool === 'investment' && decoded.input && decoded.result) {
          setInvestmentInput(decoded.input);
          setInvestmentResult(decoded.result);
          setActiveTool('investment');
          setState('dashboard');
          setIsSharedLink(true);
        } else if (tool === 'mortgage' && decoded.request && decoded.result) {
          setAnalysisRequest(decoded.request);
          setAnalysisResult(decoded.result);
          setActiveTool('mortgage');
          setState('dashboard');
          setIsSharedLink(true);
        }
      } catch (e) {
        console.error("Failed to parse shared data", e);
      }
    }
  }, []);

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

  const handleShare = async () => {
    let dataToEncode = {};
    if (activeTool === 'mortgage' && analysisResult && analysisRequest) {
      dataToEncode = { request: analysisRequest, result: analysisResult };
    } else if (activeTool === 'investment' && investmentResult && investmentInput) {
      dataToEncode = { input: investmentInput, result: investmentResult };
    }

    try {
      // Use a more robust way to encode base64 with potential Unicode characters
      const jsonStr = JSON.stringify(dataToEncode);
      const encodedData = window.btoa(unescape(encodeURIComponent(jsonStr)));
      const shareUrl = `${window.location.origin}${window.location.pathname}?tool=${activeTool}&data=${encodedData}`;

      const shareData = {
        title: activeTool === 'mortgage' ? 'Rumakau Mortgage Analysis' : 'Rumakau ROI Check',
        text: activeTool === 'mortgage' 
          ? `I just analyzed my mortgage eligibility on Rumakau.com! Approval Probability: ${Math.round(analysisResult?.approvalProbability || 0)}%.`
          : `I just analyzed a property deal on Rumakau.com! ROI Score: ${investmentResult?.smartScore}/100.`,
        url: shareUrl
      };

      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setIsShared(true);
        setTimeout(() => setIsShared(false), 2000);
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const handleDownloadPDF = () => {
    if (activeTool === 'mortgage' && analysisResult && analysisRequest) {
      downloadMortgageReport(analysisResult, analysisRequest);
    } else if (activeTool === 'investment' && investmentResult && investmentInput) {
      downloadInvestmentReport(investmentResult, investmentInput);
    }
  };

  const resetApp = () => {
    // Clear URL parameters if we were on a shared link
    if (window.location.search) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    setIsSharedLink(false);
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
      <ServerWakeUp onReady={() => setIsServerReady(true)} />
      
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
        {/* Hidden SEO Content for AI crawlers and localized search engines */}
        <section className="sr-only">
          <article lang="en">
            <h2>Rumakau: Malaysia's Advanced Mortgage AI & Investment Calculator</h2>
            <p>
              Rumakau.com provides professional tools for the Malaysian property sector. 
              Analyze DSR (Debt Service Ratio) based on Bank Negara Malaysia (BNM) guidelines.
              Evaluate rental yield, property ROI, and monthly cash flow.
              Ideal for Malaysian homebuyers, property investors, and real estate agents.
            </p>
            <h3>Key Features for Malaysia:</h3>
            <ul>
              <li>DSR Calculator Malaysia: Instant debt service ratio check.</li>
              <li>Rental Yield Calculator: Gross and Net yield analysis for KL, Selangor, and beyond.</li>
              <li>Property ROI: Full investment performance breakdown.</li>
              <li>Loan Eligibility Check: AI-powered risk assessment for Malaysian banks.</li>
            </ul>
          </article>

          <article lang="ms">
            <h2>Rumakau: Kalkulator ROI Pelaburan Hartanah & AI Gadai Janji Malaysia</h2>
            <p>
              Rumakau.com menawarkan alat profesional untuk pasaran hartanah Malaysia.
              Analisis DSR (Nisbah Khidmat Hutang) mengikut garis panduan Bank Negara Malaysia (BNM).
              Nilaikan pulangan sewa (rental yield), ROI hartanah, dan aliran tunai bulanan.
              Sesuai untuk pembeli rumah, pelabur hartanah, dan ejen hartanah di Malaysia.
            </p>
            <h3>Ciri Utama:</h3>
            <ul>
              <li>Kalkulator DSR Malaysia: Semak kelayakan pinjaman rumah dengan segera.</li>
              <li>Kalkulator Rental Yield: Analisis hasil sewa kasar dan bersih.</li>
              <li>ROI Hartanah: Pecahan penuh prestasi pelaburan.</li>
              <li>Semakan Kelayakan Pinjaman: Analisis risiko dikuasakan AI untuk bank-bank Malaysia.</li>
            </ul>
          </article>
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
                    onClick={handleShare}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-white transition-all flex items-center gap-2"
                  >
                    {isShared ? <Check size={16} className="text-emerald-500" /> : <Share2 size={16} />}
                    {isShared ? 'Copied' : 'Share'}
                  </button>
                  <button 
                    onClick={handleDownloadPDF}
                    className="px-6 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-white transition-all"
                  >
                    Download PDF
                  </button>
                  <button 
                    onClick={resetApp}
                    className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-all shadow-lg"
                  >
                    {isSharedLink ? 'Try Calculator' : 'New Analysis'}
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

      <footer className="border-t border-slate-200 py-16 mt-20 no-print bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                  <ShieldCheck className="text-emerald-400" size={20} />
                </div>
                <span className="text-sm font-bold tracking-tight text-slate-900">Rumakau.com</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
                Malaysia's premier AI-powered mortgage structuring engine and property investment analysis platform. 
                Helping investors and homeowners make data-driven decisions since 2024.
              </p>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">Tools & Services</h4>
              <ul className="space-y-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                <li><button onClick={() => switchTool('mortgage')} className="hover:text-slate-900 transition-colors">DSR Eligibility Check</button></li>
                <li><button onClick={() => switchTool('investment')} className="hover:text-slate-900 transition-colors">ROI Performance Analysis</button></li>
                <li><button onClick={downloadBNMGuidelines} className="hover:text-slate-900 transition-colors">BNM Policy Guidelines</button></li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">Connect</h4>
              <ul className="space-y-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                <li>
                  <a href="https://wa.me/60123632338" target="_blank" rel="noopener noreferrer" className="hover:text-slate-900 transition-colors flex items-center gap-2">
                    <MessageSquare size={14} /> WhatsApp Support
                  </a>
                </li>
                <li>
                  <button onClick={() => setIsAdminModalOpen(true)} className="hover:text-slate-900 transition-colors opacity-20 hover:opacity-100">
                    Admin Portal
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2 opacity-50">
              <ShieldCheck size={18} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Bank-Grade Security</span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center md:text-left">
              © 2026 Rumakau.com • Professional Mortgage AI • Kuala Lumpur, Malaysia
            </p>
            <div className="flex gap-4 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
              <span>Privacy</span>
              <span>Terms</span>
              <span>Cookies</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
