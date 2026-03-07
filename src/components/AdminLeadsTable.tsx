import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Download, 
  RefreshCw, 
  X, 
  Mail, 
  Calendar, 
  User, 
  Building2, 
  ShieldCheck,
  ChevronDown,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Lead {
  id: number;
  timestamp: string;
  contactType: string;
  contactValue: string;
  mainBorrowerName: string;
  propertyAddress: string;
  propertyType: string;
  spaPrice: number;
  loanAmount: number;
  dsrMain: number;
  dsrJoint: number;
  combinedDsr: number;
  netMonthlyIncomeMain: number;
  netMonthlyIncomeJoint: number;
  stressTestInstallment: number;
  approvalProbability: number;
  bankCategory: string;
  riskGrade: string;
}

interface Props {
  email: string;
  token: string;
  onClose: () => void;
}

export const AdminLeadsTable: React.FC<Props> = ({ email, token, onClose }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedLead, setExpandedLead] = useState<number | null>(null);

  const fetchLeads = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leads?email=${encodeURIComponent(email)}&token=${token}`);
      const data = await res.json();
      if (res.ok) {
        setLeads(data.leads || []);
      } else {
        setError(data.error || 'Failed to fetch leads');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [email, token]);

  const filteredLeads = leads.filter(lead => 
    lead.mainBorrowerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.contactValue.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.propertyAddress.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDownload = () => {
    window.location.href = `/api/admin/leads/download?email=${encodeURIComponent(email)}&token=${token}`;
  };

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 md:p-8">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-7xl h-full max-h-[90vh] bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200">
              <ShieldCheck className="text-emerald-400" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-serif italic text-slate-900">Lead Management</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Authorized Admin: {email}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative flex-grow md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search leads..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={fetchLeads}
              className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all"
              title="Refresh"
            >
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button 
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
            >
              <Download size={18} />
              <span className="hidden md:inline">Export CSV</span>
            </button>
            <button 
              onClick={onClose}
              className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-900 transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-auto p-6 md:p-8">
          {isLoading && leads.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
              <Loader2 className="animate-spin" size={48} />
              <p className="font-bold uppercase tracking-widest text-xs">Loading Leads...</p>
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center text-rose-500 gap-4">
              <ShieldCheck size={48} />
              <p className="font-bold">{error}</p>
              <button onClick={fetchLeads} className="text-sm underline">Try Again</button>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
              <Search size={48} className="opacity-20" />
              <p className="font-bold uppercase tracking-widest text-xs">No leads found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Desktop Table Header */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <div className="col-span-3">Borrower / Contact</div>
                <div className="col-span-3">Property</div>
                <div className="col-span-2 text-center">Income / DSR</div>
                <div className="col-span-2 text-center">Risk Grade</div>
                <div className="col-span-2 text-right">Date</div>
              </div>

              {/* Lead Rows */}
              {filteredLeads.map((lead) => (
                <div 
                  key={lead.id}
                  className={`group border rounded-2xl transition-all duration-300 ${
                    expandedLead === lead.id ? 'border-slate-900 bg-slate-50' : 'border-slate-100 bg-white hover:border-slate-200'
                  }`}
                >
                  <div 
                    className="p-4 md:p-6 cursor-pointer grid grid-cols-1 md:grid-cols-12 gap-4 items-center"
                    onClick={() => setExpandedLead(expandedLead === lead.id ? null : lead.id)}
                  >
                    <div className="md:col-span-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{lead.mainBorrowerName}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          lead.riskGrade === 'A' ? 'bg-emerald-100 text-emerald-700' :
                          lead.riskGrade === 'B' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          Grade {lead.riskGrade}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Mail size={12} />
                        {lead.contactValue}
                      </div>
                    </div>

                    <div className="md:col-span-3 space-y-1">
                      <div className="text-xs font-bold text-slate-700 truncate">{lead.propertyAddress}</div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider">{lead.propertyType}</div>
                    </div>

                    <div className="md:col-span-2 text-center space-y-1">
                      <div className="text-xs font-bold text-slate-900">RM {lead.netMonthlyIncomeMain.toLocaleString()}</div>
                      <div className={`text-[10px] font-bold ${lead.combinedDsr > 70 ? 'text-rose-500' : 'text-emerald-600'}`}>
                        {lead.combinedDsr}% DSR
                      </div>
                    </div>

                    <div className="md:col-span-2 flex justify-center">
                      <div className="flex flex-col items-center">
                        <div className="text-xs font-bold text-slate-900">{lead.approvalProbability}%</div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">Approval</div>
                      </div>
                    </div>

                    <div className="md:col-span-2 text-right flex items-center justify-end gap-3">
                      <div className="text-[10px] text-slate-400 font-medium">
                        {new Date(lead.timestamp).toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })}
                      </div>
                      <ChevronDown 
                        size={16} 
                        className={`text-slate-400 transition-transform duration-300 ${expandedLead === lead.id ? 'rotate-180' : ''}`} 
                      />
                    </div>
                  </div>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {expandedLead === lead.id && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-slate-200/50"
                      >
                        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                          <div className="space-y-4">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Financial Details</h4>
                            <div className="space-y-2">
                              <DetailRow label="Net Income (Main)" value={`RM ${lead.netMonthlyIncomeMain.toLocaleString()}`} />
                              <DetailRow label="Net Income (Joint)" value={lead.netMonthlyIncomeJoint ? `RM ${lead.netMonthlyIncomeJoint.toLocaleString()}` : '-'} />
                              <DetailRow label="Stress Installment" value={`RM ${lead.stressTestInstallment.toLocaleString()}`} />
                              <DetailRow label="Bank Category" value={lead.bankCategory} />
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Property Details</h4>
                            <div className="space-y-2">
                              <DetailRow label="SPA Price" value={`RM ${lead.spaPrice.toLocaleString()}`} />
                              <DetailRow label="Loan Amount" value={`RM ${lead.loanAmount.toLocaleString()}`} />
                              <DetailRow label="Property Type" value={lead.propertyType} />
                              <DetailRow label="Address" value={lead.propertyAddress} className="text-[10px]" />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lead Info</h4>
                            <div className="space-y-2">
                              <DetailRow label="Verified Email" value={lead.contactValue} />
                              <DetailRow label="Timestamp" value={new Date(lead.timestamp).toLocaleString()} />
                              <DetailRow label="Lead ID" value={`#${lead.id}`} />
                              <div className="pt-2">
                                <a 
                                  href={`mailto:${lead.contactValue}`}
                                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                                >
                                  Contact via Email <ExternalLink size={12} />
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <ShieldCheck size={12} className="text-emerald-500" />
            Authorized Session
          </div>
          <div>{filteredLeads.length} Leads Found</div>
        </div>
      </motion.div>
    </div>
  );
};

const DetailRow = ({ label, value, className = "" }: { label: string, value: string, className?: string }) => (
  <div className="flex justify-between items-center gap-4">
    <span className="text-[10px] text-slate-400 font-medium">{label}</span>
    <span className={`text-xs font-bold text-slate-700 ${className}`}>{value}</span>
  </div>
);

const Loader2 = ({ className, size }: { className?: string, size?: number }) => (
  <RefreshCw className={`${className} animate-spin`} size={size} />
);
