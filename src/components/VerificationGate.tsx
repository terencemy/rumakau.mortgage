import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, MessageSquare, ShieldCheck, ArrowRight, RefreshCw, CheckCircle2, Bell } from 'lucide-react';

interface Props {
  onVerified: (contactInfo: { type: 'email' | 'whatsapp', value: string }) => void;
  isProcessing: boolean;
}

export const VerificationGate: React.FC<Props> = ({ onVerified, isProcessing }) => {
  const [method, setMethod] = useState<'email' | 'whatsapp' | 'sms' | null>('email');
  const [value, setValue] = useState('');
  const [step, setStep] = useState<'input' | 'otp'>('input');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(60);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<{ 
    resend: { status: 'ready' | 'missing', preview?: string }
  }>({ 
    resend: { status: 'missing' }
  });

  useEffect(() => {
    // Check if API is configured on mount
    fetch('/api/verify/status')
      .then(res => res.json())
      .then(data => setApiStatus({ 
        resend: { status: data.hasResend ? 'ready' : 'missing', preview: data.resendPreview }
      }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let interval: any;
    if (step === 'otp' && timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value || !method) return;
    
    setError(null);
    setIsVerifying(true);
    
    try {
      const response = await fetch('/api/verify/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactType: method, contactValue: value }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send code');
      
      if (data.success) {
        setStep('otp');
        setTimer(60);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleOtpChange = (index: number, val: string) => {
    if (isNaN(Number(val))) return;
    const newOtp = [...otp];
    newOtp[index] = val.slice(-1);
    setOtp(newOtp);

    // Auto-focus next input
    if (val && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleVerify = async () => {
    if (!method || !value) return;
    
    setError(null);
    setIsVerifying(true);
    
    try {
      const response = await fetch('/api/verify/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactValue: value, code: otp.join(''), contactType: method }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Invalid code');
      
      onVerified({ type: method, value });
    } catch (err: any) {
      setError(err.message);
      setOtp(['', '', '', '', '', '']);
      document.getElementById('otp-0')?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const isOtpComplete = otp.every(digit => digit !== '');

  return (
    <div className="max-w-md mx-auto relative">
      <div className="glass-panel rounded-3xl p-8 shadow-xl border-emerald-100">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl mb-4 shadow-inner">
            <ShieldCheck size={32} />
          </div>
          <h2 className="text-2xl font-serif italic text-slate-900">Security Verification</h2>
          <p className="text-sm text-slate-500 mt-2">
            To comply with BNM security standards, please verify your identity before viewing the risk report.
          </p>
          
          <div className="mt-4 flex flex-col items-center gap-2">
            <div className="flex gap-2">
              {apiStatus.resend.status === 'ready' ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-600 uppercase tracking-wider border border-emerald-100">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Email Verification Active
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border border-slate-100">
                  Email Simulated
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs font-bold text-rose-600">
              {error}
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {step === 'input' ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="space-y-4">
                <form onSubmit={handleSendCode} className="space-y-4">
                  <div>
                    <label className="label-text">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="name@example.com"
                      className="input-field"
                      value={value}
                      onChange={e => setValue(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold text-sm hover:bg-slate-900 transition-all flex items-center justify-center gap-2 group"
                  >
                    Send Verification Code
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                  
                  <div className="pt-4 border-t border-slate-100 flex flex-col gap-3">
                    <a 
                      href="https://wa.me/60123632338?text=Hi%20Terence%2C%20I%E2%80%99m%20planning%20to%20purchase%20a%20property%20and%20would%20like%20to%20check%20my%20home%20loan%20eligibility.%20Could%20you%20assist%20me%20with%20the%20mortgage%20application%3F"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-emerald-600 transition-colors text-center"
                    >
                      Need help? Contact Support
                    </a>
                  </div>
                </form>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="text-center">
                <p className="text-sm text-slate-600">
                  We've sent a 6-digit code to <br />
                  <span className="font-bold text-slate-900">{value}</span>
                </p>
                <button 
                  onClick={() => setStep('input')}
                  className="text-xs font-bold text-emerald-600 mt-2 hover:underline"
                >
                  Change {method === 'email' ? 'email' : 'number'}
                </button>
              </div>

              <div className="flex justify-between gap-2">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`otp-${idx}`}
                    type="text"
                    maxLength={1}
                    className="w-12 h-14 text-center text-xl font-bold bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                    value={digit}
                    onChange={e => handleOtpChange(idx, e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Backspace' && !digit && idx > 0) {
                        document.getElementById(`otp-${idx - 1}`)?.focus();
                      }
                    }}
                  />
                ))}
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleVerify}
                  disabled={!isOtpComplete || isVerifying}
                  className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isVerifying ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      Verify & View Report
                      <CheckCircle2 size={18} />
                    </>
                  )}
                </button>

                <div className="text-center">
                  {timer > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400">
                        Resend code in <span className="font-bold">{timer}s</span>
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <button 
                        onClick={handleSendCode}
                        className="text-xs font-bold text-emerald-600 hover:underline"
                      >
                        Resend Code
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <div className="mt-6 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        <ShieldCheck size={12} className="text-emerald-500" />
        Secure Session • No Data Stored
      </div>
    </div>
  );
};
