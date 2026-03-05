import React from 'react';
import { 
  TrendingUp, 
  ShieldAlert, 
  Target, 
  Lightbulb, 
  FileCheck,
  Languages,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck
} from 'lucide-react';
import { motion } from 'motion/react';
import { MortgageAnalysisResult } from '../types';

import { downloadBNMGuidelines } from '../utils/pdfGenerator';

interface Props {
  result: MortgageAnalysisResult;
  onReset: () => void;
}

export const AnalysisDashboard: React.FC<Props> = ({ result, onReset }) => {
  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
      case 'B': return 'text-amber-600 bg-amber-50 border-amber-100';
      case 'C': return 'text-rose-600 bg-rose-50 border-rose-100';
      default: return 'text-slate-600 bg-slate-50 border-slate-100';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="label-text">Combined DSR</span>
            <TrendingUp size={16} className="text-slate-400" />
          </div>
          <div className="text-4xl font-serif italic text-slate-800">
            {result.dsrCombined}%
          </div>
          <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${result.dsrCombined > 70 ? 'bg-rose-500' : result.dsrCombined > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(result.dsrCombined, 100)}%` }}
            />
          </div>
          {result.isJointApplication && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between text-[10px] font-bold uppercase tracking-wider">
              <div className="text-slate-400">Main: <span className="text-slate-600">{result.dsrMain}%</span></div>
              <div className="text-slate-400">Joint: <span className="text-slate-600">{result.dsrJoint}%</span></div>
            </div>
          )}
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-panel rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="label-text">Risk Grade</span>
            <ShieldAlert size={16} className="text-slate-400" />
          </div>
          <div className={`text-4xl font-serif italic px-4 py-1 rounded-lg border inline-block ${getGradeColor(result.riskGrade)}`}>
            {result.riskGrade}
          </div>
          <div className="mt-2 text-[10px] text-slate-400 font-bold uppercase">
            {result.isJointApplication ? 'Joint Application Strength' : 'Single Application Strength'}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-panel rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="label-text">Approval Prob.</span>
            <Target size={16} className="text-slate-400" />
          </div>
          <div className="text-4xl font-serif italic text-slate-800">
            {result.approvalProbability}%
          </div>
          <div className="mt-2 text-[10px] text-slate-400 font-bold uppercase">
            Based on Profile Strength
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-panel rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="label-text">Bank Category</span>
            <Clock size={16} className="text-slate-400" />
          </div>
          <div className="text-2xl font-serif italic text-slate-800">
            {result.bankCategory}
          </div>
          <div className="mt-2 text-[10px] text-slate-400 font-bold uppercase">
            Recommended Target
          </div>
        </motion.div>
      </div>

      {/* BNM Calculation Breakdown */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass-panel rounded-2xl p-8 border-t-4 border-t-emerald-500"
      >
        <div className="flex items-center gap-2 mb-6">
          <ShieldCheck className="text-emerald-600" size={20} />
          <h3 className="font-bold text-slate-800 uppercase tracking-widest text-xs">BNM Regulation Compliance Breakdown</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Net Monthly Income (Main)</div>
            <div className="text-2xl font-mono font-bold text-slate-800">RM {result.netMonthlyIncomeMain.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400 italic">After statutory deductions (EPF/SOCSO/PCB)</div>
          </div>
          {result.isJointApplication && result.netMonthlyIncomeJoint && (
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Net Monthly Income (Joint)</div>
              <div className="text-2xl font-mono font-bold text-slate-800">RM {result.netMonthlyIncomeJoint.toLocaleString()}</div>
              <div className="text-[10px] text-slate-400 italic">After statutory deductions (EPF/SOCSO/PCB)</div>
            </div>
          )}
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Stress Test Installment</div>
            <div className="text-2xl font-mono font-bold text-emerald-600">RM {result.stressTestInstallment.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400 italic">Calculated at 5.5% - 6.0% Stress Rate</div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Analysis */}
        <div className="lg:col-span-2 space-y-8">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-panel rounded-2xl p-8"
          >
            <h3 className="section-title">Risk Flags & Analysis</h3>
            <div className="space-y-4">
              {result.riskFlags.map((flag, idx) => (
                <div key={idx} className="flex gap-3 p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-800">
                  <AlertTriangle size={20} className="shrink-0" />
                  <span className="text-sm font-medium">{flag}</span>
                </div>
              ))}
              <div className="mt-6 p-6 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Loan Type Suitability</h4>
                <p className="text-slate-700 leading-relaxed text-sm">
                  {result.loanTypeSuitability}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-panel rounded-2xl p-8"
          >
            <h3 className="section-title">Structuring Strategy</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                  <Lightbulb size={18} />
                  Improvements
                </div>
                <ul className="space-y-2">
                  {result.structuringImprovements.map((item, idx) => (
                    <li key={idx} className="flex gap-2 text-sm text-slate-600">
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
                  <Clock size={18} />
                  Ideal Tenure
                </div>
                <div className="p-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 italic">
                  {result.idealTenure}
                </div>
                <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                    {result.strategy}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-panel rounded-2xl p-8 border-l-4 border-l-emerald-500"
          >
            <div className="flex items-center gap-3 mb-6">
              <Languages className="text-emerald-600" />
              <h3 className="font-serif italic text-xl text-slate-800">Ringkasan Pelanggan (BM)</h3>
            </div>
            <p className="text-slate-700 leading-relaxed italic">
              "{result.clientExplanationBM}"
            </p>
          </motion.div>
        </div>

        {/* Sidebar: Documents */}
        <div className="space-y-8">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-panel rounded-2xl p-8 sticky top-8"
          >
            <div className="flex items-center gap-2 mb-6">
              <FileCheck className="text-slate-800" />
              <h3 className="font-bold text-slate-800">Required Documents</h3>
            </div>
            <div className="space-y-3">
              {result.requiredDocuments.map((doc, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-white border border-slate-100 rounded-lg hover:border-emerald-200 transition-colors group">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 group-hover:scale-125 transition-transform" />
                  <span className="text-xs font-medium text-slate-600 leading-tight">{doc}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-8 border-t border-slate-100 space-y-3">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Compliance & Support</h4>
              <button
                onClick={downloadBNMGuidelines}
                className="w-full flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 py-3 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all border border-emerald-100 group"
              >
                <FileCheck size={16} />
                Download BNM Guidelines PDF
              </button>
              
              <a
                href="https://wa.me/60123632338?text=Hi%20Terence%2C%20I%E2%80%99m%20planning%20to%20purchase%20a%20property%20and%20would%20like%20to%20check%20my%20home%20loan%20eligibility.%20Could%20you%20assist%20me%20with%20the%20mortgage%20application%3F"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-white text-slate-700 py-3 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all border border-slate-200 group no-print"
              >
                <Languages size={16} className="text-emerald-500" />
                Contact Support (WhatsApp)
              </a>
            </div>
            
            <button
              onClick={onReset}
              className="w-full mt-6 flex items-center justify-center gap-2 bg-slate-800 text-white py-3 rounded-xl text-sm font-bold hover:bg-slate-900 transition-all shadow-md group no-print"
            >
              Start New Analysis
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        </div>
      </div>

    </div>
  );
};
