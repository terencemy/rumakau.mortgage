import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, MessageSquare, ShieldCheck, ArrowRight, RefreshCw, CheckCircle2, Bell } from 'lucide-react';
import { io } from 'socket.io-client';

interface Props {
  onVerified: (contactInfo: { type: 'email' | 'whatsapp', value: string }) => void;
  isProcessing: boolean;
}

export const VerificationGate: React.FC<Props> = ({ onVerified, isProcessing }) => {
  const [method, setMethod] = useState<'email' | 'whatsapp' | null>(null);
  const [value, setValue] = useState('');
  const [step, setStep] = useState<'input' | 'otp'>('input');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(60);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<{ 
    resend: { status: 'ready' | 'missing', preview?: string },
    twilio: { status: 'ready' | 'missing', sidPreview?: string, tokenPreview?: string, numberPreview?: string }
  }>({ 
    resend: { status: 'missing' }, 
    twilio: { status: 'missing' } 
  });
  const [diagResult, setDiagResult] = useState<{ success: boolean, message: string } | null>(null);
  const [isCheckingDiag, setIsCheckingDiag] = useState(false);

  const checkTwilioDiag = async () => {
    setIsCheckingDiag(true);
    setDiagResult(null);
    try {
      const res = await fetch('/api/admin/test-twilio');
      const data = await res.json();
      if (data.success) {
        setDiagResult({ 
          success: true, 
          message: `Twilio API Valid! Account: ${data.friendlyName} (${data.accountStatus})` 
        });
      } else {
        setDiagResult({ success: false, message: `Twilio Error: ${data.error}` });
      }
    } catch (err: any) {
      setDiagResult({ success: false, message: `Request failed: ${err.message}` });
    } finally {
      setIsCheckingDiag(false);
    }
  };

  useEffect(() => {
    // Check if API is configured on mount
    fetch('/api/verify/status')
      .then(res => res.json())
      .then(data => setApiStatus({ 
        resend: { status: data.hasResend ? 'ready' : 'missing', preview: data.resendPreview },
        twilio: { 
          status: data.hasTwilio ? 'ready' : 'missing', 
          sidPreview: data.twilioSidPreview,
          tokenPreview: data.twilioTokenPreview,
          numberPreview: data.twilioNumberPreview
        }
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
        body: JSON.stringify({ contactValue: value, code: otp.join('') }),
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
                  Email Active ({apiStatus.resend.preview})
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border border-slate-100">
                  Email Simulated
                </div>
              )}
              
              {apiStatus.twilio.status === 'ready' ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-600 uppercase tracking-wider border border-emerald-100">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    WhatsApp Active ({apiStatus.twilio.sidPreview})
                  </div>
                  <button 
                    onClick={checkTwilioDiag}
                    disabled={isCheckingDiag}
                    className="text-[9px] font-bold text-slate-400 hover:text-emerald-600 uppercase tracking-widest transition-colors"
                  >
                    {isCheckingDiag ? 'Checking API...' : 'Recheck Twilio API'}
                  </button>
                  {diagResult && (
                    <div className={`text-[9px] font-bold px-2 py-1 rounded ${diagResult.success ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {diagResult.message}
                    </div>
                  )}
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border border-slate-100">
                  WhatsApp Simulated
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
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setMethod('email')}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                    method === 'email' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                  }`}
                >
                  <Mail size={24} />
                  <span className="text-xs font-bold uppercase tracking-wider">Email</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMethod('whatsapp')}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                    method === 'whatsapp' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                  }`}
                >
                  <MessageSquare size={24} />
                  <span className="text-xs font-bold uppercase tracking-wider">WhatsApp</span>
                </button>
              </div>

              {method && (
                <form onSubmit={handleSendCode} className="space-y-4">
                  <div>
                    <label className="label-text">
                      {method === 'email' ? 'Email Address' : 'WhatsApp Number'}
                    </label>
                    <input
                      type={method === 'email' ? 'email' : 'tel'}
                      required
                      placeholder={method === 'email' ? 'name@example.com' : '+60123456789'}
                      className="input-field"
                      value={value}
                      onChange={e => setValue(e.target.value)}
                    />
                    {method === 'whatsapp' && apiStatus.twilio.status === 'ready' && (
                      <p className="mt-2 text-[10px] text-slate-400 leading-relaxed">
                        Note: If using Twilio Sandbox, ensure you have sent <span className="font-mono font-bold text-emerald-600">join [keyword]</span> to the Twilio number first.
                      </p>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold text-sm hover:bg-slate-900 transition-all flex items-center justify-center gap-2 group"
                  >
                    Send Verification Code
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                  
                  {/* Debug Button */}
                  <div className="pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!value) return alert(`Please enter ${method === 'email' ? 'an email' : 'a WhatsApp number'} first`);
                        setIsVerifying(true);
                        try {
                          const response = await fetch('/api/verify/send', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ contactType: method, contactValue: value }),
                          });
                          const data = await response.json();
                          if (response.ok && data.success) alert(`Test ${method} sent! Check your ${method === 'email' ? 'inbox' : 'WhatsApp'}.`);
                          else throw new Error(data.error || "Unknown error");
                        } catch (err: any) {
                          alert("Test failed: " + err.message);
                        } finally {
                          setIsVerifying(false);
                        }
                      }}
                      className="w-full py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-emerald-600 transition-colors"
                    >
                      Send Test {method === 'email' ? 'Email' : 'WhatsApp'} Only
                    </button>
                  </div>
                </form>
              )}
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
