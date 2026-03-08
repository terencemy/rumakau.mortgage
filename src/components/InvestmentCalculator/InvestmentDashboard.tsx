import React from 'react';
import { InvestmentAnalysisResult, InvestmentCalculatorInput } from '../../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, AreaChart, Area 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Wallet, Percent, ShieldCheck, 
  AlertTriangle, Info, Download, Share2, MessageSquare, Sparkles, Check 
} from 'lucide-react';
import { motion } from 'motion/react';
import { downloadInvestmentReport } from '../../utils/pdfGenerator';

interface Props {
  result: InvestmentAnalysisResult;
  input: InvestmentCalculatorInput;
  onReset: () => void;
}

export const InvestmentDashboard: React.FC<Props> = ({ result, input, onReset }) => {
  const [isShared, setIsShared] = React.useState(false);

  const handleShare = async () => {
    try {
      const dataToEncode = { input, result };
      const jsonStr = JSON.stringify(dataToEncode);
      const encodedData = window.btoa(unescape(encodeURIComponent(jsonStr)));
      const shareUrl = `${window.location.origin}${window.location.pathname}?tool=investment&data=${encodedData}`;

      const shareData = {
        title: 'Rumakau ROI Check',
        text: `I just analyzed a property deal on Rumakau.com! ROI Score: ${result.smartScore}/100. Check it out!`,
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

  const cashFlowData = [
    { name: 'Rental', value: input.monthlyRental, color: '#10b981' },
    { name: 'Loan', value: -result.monthlyRepayment, color: '#f43f5e' },
    { name: 'Maint.', value: -input.maintenanceFees, color: '#64748b' },
    { name: 'Tax/Ins', value: -(input.propertyTax + input.insurance) / 12, color: '#94a3b8' },
    { name: 'Vacancy', value: -(input.monthlyRental * input.vacancyRate) / 100, color: '#cbd5e1' },
  ];

  const scenarioData = [
    { name: 'Current', value: result.netMonthlyCashFlow },
    { name: 'Int +1%', value: result.scenarios.interestPlus1 },
    { name: 'Int +2%', value: result.scenarios.interestPlus2 },
    { name: 'Vac 10%', value: result.scenarios.vacancy10 },
    { name: 'Vac 20%', value: result.scenarios.vacancy20 },
    { name: 'Rent -10%', value: result.scenarios.rentalDrop10 },
  ];

  const riskColors = {
    Low: 'text-emerald-500 bg-emerald-50 border-emerald-100',
    Moderate: 'text-amber-500 bg-amber-50 border-amber-100',
    High: 'text-rose-500 bg-rose-50 border-rose-100',
    Negative: 'text-rose-600 bg-rose-100 border-rose-200',
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Deal Analyzer Score - Viral Feature */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-900 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 blur-[100px] -ml-32 -mb-32" />
        
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
                <Sparkles size={12} /> Viral Deal Analyzer
              </div>
              <h2 className="text-4xl md:text-5xl font-serif italic text-white">ROI Score: <span className="text-emerald-400">{result.smartScore}</span> <span className="text-white/30 text-2xl">/ 100</span></h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rental Yield</div>
                <div className="text-2xl font-bold text-white">{Math.round(result.rentalYield)}%</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cash Flow</div>
                <div className={`text-2xl font-bold ${result.netMonthlyCashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {result.netMonthlyCashFlow >= 0 ? '+' : ''}RM {Math.abs(result.netMonthlyCashFlow).toFixed(0)}<span className="text-xs text-white/30">/mo</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Risk Level</div>
                <div className={`text-2xl font-bold ${
                  result.riskLevel === 'Low' ? 'text-emerald-400' : 
                  result.riskLevel === 'Moderate' ? 'text-amber-400' : 'text-rose-400'
                }`}>{result.riskLevel}</div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Verdict</div>
              <div className="text-2xl font-serif italic text-white">{result.verdict}</div>
            </div>
          </div>

          <div className="hidden lg:flex justify-center">
            <div className="relative w-64 h-64 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="128" cy="128" r="110" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-white/5" />
                <motion.circle 
                  initial={{ strokeDashoffset: 690 }}
                  animate={{ strokeDashoffset: 690 - (690 * result.smartScore) / 100 }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  cx="128" 
                  cy="128" 
                  r="110" 
                  stroke="currentColor" 
                  strokeWidth="12" 
                  fill="transparent" 
                  strokeDasharray={690} 
                  className="text-emerald-400"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-6xl font-bold text-white">{result.smartScore}</span>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Score</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard 
          label="Net Monthly Cash Flow" 
          value={`RM ${result.netMonthlyCashFlow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subValue={result.netMonthlyCashFlow > 0 ? "Positive Cash Flow" : "Negative Cash Flow"}
          icon={<Wallet className={result.netMonthlyCashFlow > 0 ? "text-emerald-500" : "text-rose-500"} />}
          trend={result.netMonthlyCashFlow > 0 ? "up" : "down"}
        />
        <StatCard 
          label="Annual ROI" 
          value={`${Math.round(result.roi)}%`}
          subValue={`RM ${(result.netMonthlyCashFlow * 12).toLocaleString()} / year`}
          icon={<TrendingUp className="text-indigo-500" />}
          trend={result.roi > 5 ? "up" : "down"}
        />
        <StatCard 
          label="Net Rental Yield" 
          value={`${Math.round(result.netRentalYield)}%`}
          subValue={`Gross: ${Math.round(result.rentalYield)}%`}
          icon={<Percent className="text-emerald-500" />}
        />
        <StatCard 
          label="Smart ROI Score" 
          value={result.smartScore.toString()}
          subValue={result.recommendation}
          icon={<ShieldCheck className="text-slate-900" />}
          score={result.smartScore}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cash Flow Breakdown */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-serif italic text-slate-900">Monthly Cash Flow Breakdown</h3>
            <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${riskColors[result.riskLevel]}`}>
              {result.riskLevel} Risk
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlowData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {cashFlowData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            <DetailItem label="Property Price" value={`RM ${input.propertyPrice.toLocaleString()}`} />
            <DetailItem label="Loan Repayment" value={`RM ${result.monthlyRepayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
            <DetailItem label="Total Invested" value={`RM ${result.totalCashInvested.toLocaleString()}`} />
            <DetailItem label="LTV Ratio" value={`${Math.round((input.loanAmount / input.propertyPrice) * 100)}%`} />
          </div>
        </div>

        {/* Investment Score & Recommendation */}
        <div className="bg-slate-900 p-8 rounded-[2rem] shadow-xl text-white space-y-8">
          <div className="space-y-2">
            <h3 className="text-xl font-serif italic">ROI Verdict</h3>
            <p className="text-slate-400 text-sm">Based on Malaysia market benchmarks</p>
          </div>

          <div className="flex flex-col items-center justify-center py-4">
            <div className="relative w-40 h-40 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/10" />
                <circle 
                  cx="80" 
                  cy="80" 
                  r="70" 
                  stroke="currentColor" 
                  strokeWidth="8" 
                  fill="transparent" 
                  strokeDasharray={440} 
                  strokeDashoffset={440 - (440 * result.smartScore) / 100} 
                  className="text-emerald-400 transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-bold">{result.smartScore}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Score</span>
              </div>
            </div>
            <div className="mt-6 text-center">
              <div className="text-lg font-bold text-emerald-400">{result.recommendation}</div>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                {result.smartScore > 70 
                  ? "This property shows strong cash flow and ROI potential. Excellent for long-term wealth building."
                  : result.smartScore > 40
                  ? "Average performance. Consider negotiating a lower price or increasing rental yield to improve ROI."
                  : "High risk profile. Negative cash flow or low ROI may strain your finances. Re-evaluate the deal."}
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-4">
            <button className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold text-sm hover:bg-emerald-600 transition-all flex items-center justify-center gap-2">
              <MessageSquare size={18} /> Speak to Mortgage Advisor
            </button>
            <div className="flex gap-3">
              <button 
                onClick={() => downloadInvestmentReport(result, input)}
                className="flex-1 py-3 bg-white/10 text-white rounded-xl text-xs font-bold hover:bg-white/20 transition-all flex items-center justify-center gap-2"
              >
                <Download size={14} /> PDF Report
              </button>
              <button 
                onClick={handleShare}
                className="flex-1 py-3 bg-white/10 text-white rounded-xl text-xs font-bold hover:bg-white/20 transition-all flex items-center justify-center gap-2"
              >
                {isShared ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
                {isShared ? 'Copied!' : 'Share Link'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Scenario Simulation */}
      <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
            <AlertTriangle className="text-amber-500" size={20} />
          </div>
          <div>
            <h3 className="text-xl font-serif italic text-slate-900">Stress Test & Scenarios</h3>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Impact on Monthly Cash Flow</p>
          </div>
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={scenarioData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Area type="monotone" dataKey="value" stroke="#10b981" fillOpacity={1} fill="url(#colorValue)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ScenarioCard 
            title="Interest Rate Hike" 
            impact1={`+1%: RM ${result.scenarios.interestPlus1.toFixed(0)}`}
            impact2={`+2%: RM ${result.scenarios.interestPlus2.toFixed(0)}`}
            status={result.scenarios.interestPlus2 > 0 ? "Safe" : "Critical"}
          />
          <ScenarioCard 
            title="Vacancy Risk" 
            impact1={`10%: RM ${result.scenarios.vacancy10.toFixed(0)}`}
            impact2={`20%: RM ${result.scenarios.vacancy20.toFixed(0)}`}
            status={result.scenarios.vacancy20 > 0 ? "Safe" : "Critical"}
          />
          <ScenarioCard 
            title="Market Downturn" 
            impact1={`Rent -10%: RM ${result.scenarios.rentalDrop10.toFixed(0)}`}
            impact2={`Appreciation: ${Math.round(input.appreciationRate)}%`}
            status={result.scenarios.rentalDrop10 > 0 ? "Safe" : "Critical"}
          />
        </div>

        <div className="pt-4 border-t border-slate-100">
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-6">Annual Appreciation Projections</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ScenarioCard 
              title="Conservative (2%)" 
              impact1={`Value: RM ${(input.propertyPrice * 1.02).toLocaleString()}`}
              impact2={`Gain: RM ${result.scenarios.appreciationConservative.toLocaleString()}`}
              status="Growth"
            />
            <ScenarioCard 
              title="Moderate (4%)" 
              impact1={`Value: RM ${(input.propertyPrice * 1.04).toLocaleString()}`}
              impact2={`Gain: RM ${result.scenarios.appreciationModerate.toLocaleString()}`}
              status="Growth"
            />
            <ScenarioCard 
              title="Optimistic (6%)" 
              impact1={`Value: RM ${(input.propertyPrice * 1.06).toLocaleString()}`}
              impact2={`Gain: RM ${result.scenarios.appreciationOptimistic.toLocaleString()}`}
              status="Growth"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, subValue, icon, trend, score }: any) => (
  <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
    <div className="flex justify-between items-start">
      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
        {icon}
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-[10px] font-bold ${trend === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>
          {trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {trend === 'up' ? 'Positive' : 'Negative'}
        </div>
      )}
    </div>
    <div>
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</div>
      <div className="text-2xl font-bold text-slate-900 mt-1">{value}</div>
      <div className="text-[10px] font-bold text-slate-400 mt-1">{subValue}</div>
    </div>
  </div>
);

const DetailItem = ({ label, value }: any) => (
  <div className="space-y-1">
    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</div>
    <div className="text-sm font-bold text-slate-900">{value}</div>
  </div>
);

const ScenarioCard = ({ title, impact1, impact2, status }: any) => (
  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
    <div className="flex justify-between items-center">
      <h4 className="text-xs font-bold text-slate-900">{title}</h4>
      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
        status === 'Safe' || status === 'Growth' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
      }`}>
        {status}
      </span>
    </div>
    <div className="space-y-1">
      <div className="text-[10px] text-slate-500 font-medium">{impact1} {status === 'Growth' ? '' : '/ mo'}</div>
      <div className="text-[10px] text-slate-500 font-medium">{impact2} {status === 'Growth' ? '' : '/ mo'}</div>
    </div>
  </div>
);
