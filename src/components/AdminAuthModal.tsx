import React, { useState } from 'react';
import { Mail, ShieldAlert, Loader2, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminAuthModal({ isOpen, onClose }: AdminAuthModalProps) {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/auth/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok) {
        setStep('otp');
      } else {
        setError(data.error || 'Failed to send code');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otp })
      });
      const data = await res.json();
      if (res.ok) {
        // Success: Trigger download
        window.location.href = `/api/admin/leads/download?email=${encodeURIComponent(email)}&token=${data.token}`;
        onClose();
      } else {
        setError(data.error || 'Invalid code');
      }
    } catch (err) {
      setError('Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-8 space-y-6">
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center">
              <ShieldAlert className="text-slate-900" size={24} />
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-900 transition-colors">
              <Loader2 className="animate-spin opacity-0" size={20} />
              ✕
            </button>
          </div>

          <div className="space-y-2">
            <h3 className="text-2xl font-serif italic text-slate-900">Admin Access</h3>
            <p className="text-slate-500 text-sm">
              {step === 'email' 
                ? "Enter your authorized admin email to receive an access code." 
                : `We've sent a 6-digit code to ${email}`}
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={step === 'email' ? handleSendOtp : handleVerifyOtp} className="space-y-4">
            {step === 'email' ? (
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="email"
                  required
                  placeholder="admin@rumakau.com"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-slate-900 outline-none transition-all text-sm font-medium"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            ) : (
              <div className="flex gap-2 justify-center">
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="000000"
                  className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-slate-900 outline-none transition-all text-center text-2xl font-bold tracking-[0.5em]"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : step === 'email' ? (
                "Send Access Code"
              ) : (
                <>
                  Verify & Download <CheckCircle2 size={18} />
                </>
              )}
            </button>
          </form>

          {step === 'otp' && (
            <button 
              onClick={() => setStep('email')}
              className="w-full text-center text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors"
            >
              Change Email
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
