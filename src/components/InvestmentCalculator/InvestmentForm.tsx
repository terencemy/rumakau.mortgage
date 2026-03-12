import React, { useState } from 'react';
import { InvestmentCalculatorInput } from '../../types';
import { Calculator, TrendingUp, Home, Percent, Wallet, ShieldAlert, Info } from 'lucide-react';

interface Props {
  onSubmit: (data: InvestmentCalculatorInput) => void;
  isLoading: boolean;
}

export const InvestmentForm: React.FC<Props> = ({ onSubmit, isLoading }) => {
  const [formData, setFormData] = useState<InvestmentCalculatorInput>({
    propertyPrice: 500000,
    downPayment: 50000,
    loanAmount: 450000,
    interestRate: 4.2,
    tenure: 35,
    monthlyRental: 2500,
    maintenanceFees: 300,
    propertyTax: 1200,
    insurance: 600,
    vacancyRate: 8,
    appreciationRate: 0,
    renovationCost: 20000,
    legalFees: 10000
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = parseFloat(value) || 0;
    
    setFormData(prev => {
      const newData = { ...prev, [name]: numValue };
      
      // Auto-calculate loan amount if price or downpayment changes
      if (name === 'propertyPrice' || name === 'downPayment') {
        newData.loanAmount = Math.max(0, newData.propertyPrice - newData.downPayment);
      }
      
      return newData;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Property & Loan Details */}
        <div className="space-y-6 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
              <Home className="text-emerald-400" size={20} />
            </div>
            <h3 className="text-lg font-serif italic text-slate-900">Property & Loan</h3>
          </div>

          <div className="space-y-4">
            <InputField 
              label="Property Price (RM)" 
              name="propertyPrice" 
              value={formData.propertyPrice} 
              onChange={handleChange} 
              icon={<Wallet size={16} />}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField 
                label="Down Payment (RM)" 
                name="downPayment" 
                value={formData.downPayment} 
                onChange={handleChange} 
              />
              <InputField 
                label="Loan Amount (RM)" 
                name="loanAmount" 
                value={formData.loanAmount} 
                onChange={handleChange} 
                disabled
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField 
                label="Interest Rate (%)" 
                name="interestRate" 
                value={formData.interestRate} 
                onChange={handleChange} 
                step="0.1"
              />
              <InputField 
                label="Tenure (Years)" 
                name="tenure" 
                value={formData.tenure} 
                onChange={handleChange} 
              />
            </div>
          </div>
        </div>

        {/* Income & Expenses */}
        <div className="space-y-6 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
              <TrendingUp className="text-emerald-400" size={20} />
            </div>
            <h3 className="text-lg font-serif italic text-slate-900">Income & Expenses</h3>
          </div>

          <div className="space-y-4">
            <InputField 
              label="Monthly Rental (RM)" 
              name="monthlyRental" 
              value={formData.monthlyRental} 
              onChange={handleChange} 
              icon={<Wallet size={16} />}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField 
                label="Maintenance (RM/mo)" 
                name="maintenanceFees" 
                value={formData.maintenanceFees} 
                onChange={handleChange} 
              />
              <InputField 
                label="Vacancy Rate (%)" 
                name="vacancyRate" 
                value={formData.vacancyRate} 
                onChange={handleChange} 
                tooltip={
                  <div className="space-y-2">
                    <p>Vacancy Rate (%) is the percentage of time a rental property is not occupied during a year.</p>
                    <div className="p-2 bg-white/10 rounded-lg">
                      <p className="font-bold mb-1">Example:</p>
                      <p>If a property is empty 1 month out of 12 months, the vacancy rate is:</p>
                      <p className="font-mono mt-1">(1 ÷ 12) × 100 = 8.33%</p>
                    </div>
                    <p className="text-emerald-400">This means the property is vacant 8.33% of the year and rented 91.67% of the time.</p>
                  </div>
                }
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField 
                label="Annual Property Tax" 
                name="propertyTax" 
                value={formData.propertyTax} 
                onChange={handleChange} 
              />
              <InputField 
                label="Annual Insurance" 
                name="insurance" 
                value={formData.insurance} 
                onChange={handleChange} 
              />
            </div>
          </div>
        </div>

        {/* Initial Costs */}
        <div className="md:col-span-2 space-y-6 bg-slate-900 p-6 sm:p-8 rounded-[2rem] shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <Percent className="text-emerald-400" size={20} />
            </div>
            <h3 className="text-lg font-serif italic text-white">Initial Investment Costs</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <InputField 
              label="Renovation Cost (RM)" 
              name="renovationCost" 
              value={formData.renovationCost} 
              onChange={handleChange} 
              dark
            />
            <InputField 
              label="Legal Fees & Stamp Duty" 
              name="legalFees" 
              value={formData.legalFees} 
              onChange={handleChange} 
              dark
            />
            <InputField 
              label="Expected Appreciation (%)" 
              name="appreciationRate" 
              value={formData.appreciationRate} 
              onChange={handleChange} 
              step="0.1"
              dark
              tooltip={
                <div className="space-y-2">
                  <p>Expected Appreciation (%) is the estimated yearly increase in a property's value.</p>
                  <div className="p-2 bg-white/10 rounded-lg">
                    <p className="font-bold mb-1">Example:</p>
                    <p>If a property costs RM500,000 and the expected appreciation is 4% per year, the value next year would be:</p>
                    <p className="font-mono mt-1">RM500,000 × 1.04 = RM520,000</p>
                  </div>
                  <p className="text-emerald-400">This means the property value increases by RM20,000 in one year.</p>
                </div>
              }
            />
          </div>
        </div>
      </div>

      <div className="flex justify-center pt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="group relative px-12 py-5 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200 disabled:opacity-50"
        >
          <span className="flex items-center gap-3">
            {isLoading ? "Calculating..." : "Run ROI Check"}
            <Calculator className="group-hover:rotate-12 transition-transform" size={24} />
          </span>
        </button>
      </div>
    </form>
  );
};

const InputField = ({ label, name, value, onChange, icon, step = "1", disabled = false, dark = false, tooltip }: any) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center flex-wrap gap-1.5">
        <label className={`text-[10px] font-bold uppercase tracking-widest shrink-0 ${dark ? 'text-slate-400' : 'text-slate-400'}`}>
          {label}
        </label>
        {tooltip && (
          <div className="relative shrink-0">
            <button 
              type="button"
              onClick={() => setShowTooltip(!showTooltip)}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className="flex items-center focus:outline-none touch-manipulation"
              aria-label={`Information about ${label}`}
            >
              <Info 
                size={14} 
                className={`${dark ? 'text-slate-500 hover:text-emerald-400' : 'text-slate-400 hover:text-slate-600'} ${showTooltip ? (dark ? 'text-emerald-400' : 'text-slate-600') : ''} cursor-help transition-colors`} 
              />
            </button>
            {showTooltip && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[calc(100vw-4rem)] sm:w-64 p-3 bg-slate-900 text-white text-[10px] rounded-xl z-50 shadow-xl border border-white/10 text-left pointer-events-none">
                <div className="relative leading-relaxed">
                  {tooltip}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="relative">
        {icon && (
          <div className={`absolute left-4 top-1/2 -translate-y-1/2 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
            {icon}
          </div>
        )}
        <input
          type="number"
          name={name}
          value={value}
          onChange={onChange}
          step={step}
          disabled={disabled}
          aria-label={label}
          className={`w-full ${icon ? 'pl-12' : 'px-4'} py-4 rounded-2xl text-sm font-bold outline-none transition-all ${
            dark 
              ? 'bg-white/5 border border-white/10 text-white focus:bg-white/10 focus:border-emerald-500/50' 
              : 'bg-slate-50 border border-slate-100 text-slate-900 focus:bg-white focus:border-slate-900'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
      </div>
    </div>
  );
};
