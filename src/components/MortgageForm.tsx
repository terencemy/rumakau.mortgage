import React, { useState } from 'react';
import { 
  Building2, 
  User, 
  Wallet, 
  ShieldCheck, 
  ChevronRight, 
  ChevronLeft,
  Info,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MortgageAnalysisRequest } from '../types';

interface Props {
  onSubmit: (data: MortgageAnalysisRequest) => void;
  isAnalyzing: boolean;
}

const STEPS = [
  { id: 'property', title: 'Property & Loan', icon: Building2 },
  { id: 'borrower', title: 'Borrower Profile', icon: User },
  { id: 'additional', title: 'Additional Info', icon: Wallet },
  { id: 'review', title: 'Review & Submit', icon: ShieldCheck },
];

export const MortgageForm: React.FC<Props> = ({ onSubmit, isAnalyzing }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [hasJointBorrower, setHasJointBorrower] = useState(false);
  const [formData, setFormData] = useState<Partial<MortgageAnalysisRequest>>({
    property: {
      address: '',
      propertyType: 'Residential (Landed)',
      isBumi: false,
      size: '',
      renovationDetails: '',
      spaPrice: 0,
      marginRequested: 90,
      loanAmount: 0,
      loanTenure: 35,
      marketValue: 0,
      valuerName: '',
      lawyerFirm: '',
    },
    mainBorrower: {
      name: '',
      nricLast4: '',
      age: 30,
      educationLevel: 'Degree',
      isSmoking: false,
      maritalStatus: 'Single',
      numberOfChildren: 0,
      stayLength: '',
      employment: {
        companyName: '',
        natureOfBusiness: '',
        position: '',
        dateJoined: '',
        monthlyGrossIncome: 0,
        fixedIncome: 0,
        variableIncome: 0,
        otherIncome: 0,
      },
      commitments: {
        carLoan: 0,
        personalLoan: 0,
        creditCardOutstanding: 0,
        otherLoans: 0,
        ccrisStatus: 'Clean',
      }
    },
    loanTypes: ['Conventional Loan'],
  });

  const updateProperty = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      property: { ...prev.property!, [field]: value }
    }));
  };

  const updateBorrower = (target: 'mainBorrower' | 'jointBorrower', field: string, value: any) => {
    setFormData(prev => {
      const borrower = prev[target] || {
        name: '',
        nricLast4: '',
        age: 30,
        educationLevel: 'Degree',
        isSmoking: false,
        maritalStatus: 'Single',
        numberOfChildren: 0,
        stayLength: '',
        employment: {
          companyName: '',
          natureOfBusiness: '',
          position: '',
          dateJoined: '',
          monthlyGrossIncome: 0,
          fixedIncome: 0,
          variableIncome: 0,
          otherIncome: 0,
        },
        commitments: {
          carLoan: 0,
          personalLoan: 0,
          creditCardOutstanding: 0,
          otherLoans: 0,
          ccrisStatus: 'Clean',
        }
      };
      return {
        ...prev,
        [target]: { ...borrower, [field]: value }
      };
    });
  };

  const updateEmployment = (target: 'mainBorrower' | 'jointBorrower', field: string, value: any) => {
    setFormData(prev => {
      const borrower = prev[target]!;
      return {
        ...prev,
        [target]: {
          ...borrower,
          employment: { ...borrower.employment, [field]: value }
        }
      };
    });
  };

  const updateCommitments = (target: 'mainBorrower' | 'jointBorrower', field: string, value: any) => {
    setFormData(prev => {
      const borrower = prev[target]!;
      return {
        ...prev,
        [target]: {
          ...borrower,
          commitments: { ...borrower.commitments, [field]: value }
        }
      };
    });
  };

  const toggleLoanType = (type: string) => {
    setFormData(prev => {
      const current = prev.loanTypes || [];
      const next = current.includes(type) 
        ? current.filter(t => t !== type)
        : [...current, type];
      return { ...prev, loanTypes: next };
    });
  };

  const nextStep = () => setCurrentStep(s => Math.min(s + 1, STEPS.length - 1));
  const prevStep = () => setCurrentStep(s => Math.max(s - 1, 0));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.property && formData.mainBorrower) {
      const submission = { ...formData };
      if (!hasJointBorrower) {
        delete submission.jointBorrower;
      }
      onSubmit(submission as MortgageAnalysisRequest);
    }
  };

  const renderBorrowerFields = (target: 'mainBorrower' | 'jointBorrower', title: string) => {
    const borrower = formData[target];
    if (!borrower && target === 'jointBorrower') return null;

    return (
      <div className="space-y-6">
        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <User size={16} className="text-emerald-600" />
          {title}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="label-text">Name</label>
            <input 
              type="text" 
              className="input-field" 
              value={borrower?.name}
              onChange={e => updateBorrower(target, 'name', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label-text">NRIC (Last 4 Digits)</label>
            <input 
              type="text" 
              maxLength={4}
              className="input-field font-mono" 
              placeholder="e.g. 5678"
              value={borrower?.nricLast4}
              onChange={e => updateBorrower(target, 'nricLast4', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label-text">Age</label>
            <input 
              type="number" 
              className="input-field font-mono" 
              value={borrower?.age}
              onChange={e => updateBorrower(target, 'age', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label-text">Monthly Gross Income (RM)</label>
            <input 
              type="number" 
              className="input-field font-mono" 
              value={borrower?.employment.monthlyGrossIncome}
              onChange={e => updateEmployment(target, 'monthlyGrossIncome', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label-text">Fixed Income (RM)</label>
            <input 
              type="number" 
              className="input-field font-mono" 
              value={borrower?.employment.fixedIncome}
              onChange={e => updateEmployment(target, 'fixedIncome', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label-text">Car Loan (Monthly)</label>
            <input 
              type="number" 
              className="input-field font-mono" 
              value={borrower?.commitments.carLoan}
              onChange={e => updateCommitments(target, 'carLoan', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label-text">Personal Loan (Monthly)</label>
            <input 
              type="number" 
              className="input-field font-mono" 
              value={borrower?.commitments.personalLoan}
              onChange={e => updateCommitments(target, 'personalLoan', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label-text">CCRIS Status</label>
            <select 
              className="input-field"
              value={borrower?.commitments.ccrisStatus}
              onChange={e => updateCommitments(target, 'ccrisStatus', e.target.value)}
            >
              <option>Clean</option>
              <option>Late Payment</option>
              <option>Restructured</option>
            </select>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-12">
        <div className="flex justify-between items-center relative">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -translate-y-1/2 z-0" />
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = idx === currentStep;
            const isCompleted = idx < currentStep;
            return (
              <div key={step.id} className="relative z-10 flex flex-col items-center">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isActive ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' : 
                    isCompleted ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400 border-2 border-slate-200'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 size={20} /> : <Icon size={20} />}
                </div>
                <span className={`mt-2 text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-emerald-700' : 'text-slate-400'}`}>
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="glass-panel rounded-2xl p-8 min-h-[500px] flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-grow"
          >
            {currentStep === 0 && (
              <div className="space-y-6">
                <h2 className="section-title">Property & Loan Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="label-text">Property Address</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="Enter full property address"
                      value={formData.property?.address}
                      onChange={e => updateProperty('address', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="label-text">Property Type</label>
                    <select 
                      className="input-field"
                      value={formData.property?.propertyType}
                      onChange={e => updateProperty('propertyType', e.target.value)}
                    >
                      <option>Residential (Landed)</option>
                      <option>Residential (High-rise)</option>
                      <option>Commercial (SOHO/Serviced)</option>
                      <option>Industrial</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-text">Bumi Status</label>
                    <div className="flex gap-4 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          checked={formData.property?.isBumi} 
                          onChange={() => updateProperty('isBumi', true)}
                          className="accent-emerald-600"
                        />
                        <span className="text-sm">Bumi</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          checked={!formData.property?.isBumi} 
                          onChange={() => updateProperty('isBumi', false)}
                          className="accent-emerald-600"
                        />
                        <span className="text-sm">Non-Bumi</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="label-text">SPA Price (RM)</label>
                    <input 
                      type="number" 
                      className="input-field font-mono" 
                      value={formData.property?.spaPrice}
                      onChange={e => updateProperty('spaPrice', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="label-text">Market Value (RM)</label>
                    <input 
                      type="number" 
                      className="input-field font-mono" 
                      value={formData.property?.marketValue}
                      onChange={e => updateProperty('marketValue', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="label-text">Margin Requested (%)</label>
                    <input 
                      type="number" 
                      className="input-field font-mono" 
                      value={formData.property?.marginRequested}
                      onChange={e => updateProperty('marginRequested', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="label-text">Loan Tenure (Years)</label>
                    <input 
                      type="number" 
                      className="input-field font-mono" 
                      value={formData.property?.loanTenure}
                      onChange={e => updateProperty('loanTenure', Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <h2 className="section-title mb-0">Borrower Profile</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setHasJointBorrower(!hasJointBorrower);
                      if (!hasJointBorrower && !formData.jointBorrower) {
                        updateBorrower('jointBorrower', 'name', '');
                      }
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border-2 ${
                      hasJointBorrower 
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100' 
                        : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    {hasJointBorrower ? 'Joint Application Active' : '+ Add Joint Borrower'}
                  </button>
                </div>

                {renderBorrowerFields('mainBorrower', 'Main Borrower')}
                
                {hasJointBorrower && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="pt-8 border-t border-slate-100"
                  >
                    {renderBorrowerFields('jointBorrower', 'Joint Borrower')}
                  </motion.div>
                )}
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <h2 className="section-title">Additional Info</h2>
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="label-text">Banks Already Submitted (if any)</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="e.g. Maybank, CIMB"
                      value={formData.banksSubmitted}
                      onChange={e => setFormData(prev => ({ ...prev, banksSubmitted: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label-text">Remarks / Special Cases</label>
                    <textarea 
                      className="input-field min-h-[100px]" 
                      placeholder="Any additional info for the risk engine..."
                      value={formData.remarks}
                      onChange={e => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <h2 className="section-title">Review & Loan Selection</h2>
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100 mb-6">
                  <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-600" />
                    Select Loan Types to Apply For
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {['Conventional Loan', 'Islamic Loan', 'Fully Flexi Loan', 'Semi Flexi Loan'].map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => toggleLoanType(type)}
                        className={`px-4 py-3 rounded-lg text-sm font-medium border transition-all text-left flex items-center justify-between ${
                          formData.loanTypes?.includes(type)
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 ring-1 ring-emerald-200'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {type}
                        {formData.loanTypes?.includes(type) && <CheckCircle2 size={16} />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 flex gap-3">
                  <Info className="text-amber-600 shrink-0" size={20} />
                  <p className="text-xs text-amber-800 leading-relaxed">
                    By submitting this analysis, you agree to comply with Malaysia PDPA principles. 
                    Personal data is processed session-based and not stored. 
                    The analysis provided is for risk assessment only and does not guarantee bank approval.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-12 pt-8 border-t border-slate-100 flex justify-between items-center">
          <button
            type="button"
            onClick={prevStep}
            disabled={currentStep === 0 || isAnalyzing}
            className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-800 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={18} />
            Back
          </button>

          {currentStep < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={nextStep}
              className="flex items-center gap-2 bg-slate-800 text-white px-8 py-2.5 rounded-lg text-sm font-bold hover:bg-slate-900 transition-all shadow-sm"
            >
              Continue
              <ChevronRight size={18} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isAnalyzing}
              className="flex items-center gap-2 bg-emerald-600 text-white px-10 py-2.5 rounded-lg text-sm font-bold hover:bg-emerald-700 transition-all shadow-md disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyzing Risk...
                </>
              ) : (
                <>
                  Generate Risk Report
                  <FileText size={18} />
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
