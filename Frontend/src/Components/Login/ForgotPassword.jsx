import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useLogin from '../../helper/useLogin'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

// Same password policy as Signup.jsx — 6+ chars with upper, lower, number and a symbol.
const PW_RULES = [
  { label: 'At least 6 characters', test: (p) => p.length >= 6 },
  { label: 'One uppercase letter (A-Z)', test: (p) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter (a-z)', test: (p) => /[a-z]/.test(p) },
  { label: 'One number (0-9)', test: (p) => /[0-9]/.test(p) },
  { label: 'One symbol (!@#$ etc.)', test: (p) => /[^A-Za-z0-9]/.test(p) },
]
const pwValid = (p) => PW_RULES.every((r) => r.test(p))

const ForgotPassword = () => {
  const { forgotPassword, resetPassword } = useLogin()
  const navigate = useNavigate()

  const [step, setStep] = useState('userId') // 'userId' | 'reset'
  const [userId, setUserId] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resendIn, setResendIn] = useState(0)

  const handleSendCode = async () => {
    if (!userId.trim()) { toast.error('Enter your user ID'); return }
    setLoading(true)
    try {
      const res = await forgotPassword(userId.trim())
      toast.success(res?.message || "If that user ID has an email on file, we've sent it a code.")
      setStep('reset')
      setResendIn(30)
    } catch {
      // toast already shown by useLogin
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendIn > 0) return
    try {
      await forgotPassword(userId.trim())
      toast.success('Code resent')
      setResendIn(30)
    } catch {
      // toast already shown
    }
  }

  const handleReset = async () => {
    if (!otp.trim()) { toast.error('Enter the code from your email'); return }
    if (!pwValid(newPassword)) { toast.error('Password must be 6+ chars with uppercase, lowercase, number and a symbol'); return }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return }
    setLoading(true)
    try {
      await resetPassword(userId.trim(), otp.trim(), newPassword)
      toast.success('Password reset — sign in with your new password')
      navigate('/')
    } catch {
      // toast already shown by useLogin
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') (step === 'userId' ? handleSendCode : handleReset)()
  }

  return (
    <>
      <ToastContainer position="top-right" autoClose={4000} theme="dark" />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&family=Bebas+Neue&display=swap');
        .login-root { font-family: 'DM Sans', sans-serif; }
        .login-heading { font-family: 'Sora', sans-serif; }
        .login-bg {
          background: #0a0f1e;
          background-image:
            radial-gradient(ellipse 80% 60% at 20% 50%, rgba(30, 64, 175, 0.15) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 80% 20%, rgba(14, 165, 233, 0.08) 0%, transparent 50%);
        }
        .login-card {
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(20px);
        }
        .input-field {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #f1f5f9;
          transition: all 0.2s ease;
        }
        .input-field:focus {
          background: rgba(255,255,255,0.08);
          border-color: #3b82f6;
          outline: none;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }
        .input-field::placeholder { color: rgba(148,163,184,0.5); }
        .btn-primary {
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          border: 1px solid rgba(255,255,255,0.1);
          transition: all 0.2s ease;
        }
        .btn-primary:hover:not(:disabled) {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          transform: translateY(-1px);
          box-shadow: 0 8px 25px rgba(37, 99, 235, 0.4);
        }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.5s ease forwards; }
        .fade-up-1 { animation-delay: 0.1s; opacity: 0; }
        .fade-up-2 { animation-delay: 0.2s; opacity: 0; }
        .fade-up-3 { animation-delay: 0.3s; opacity: 0; }
        .fade-up-4 { animation-delay: 0.4s; opacity: 0; }
      `}</style>

      <div className="login-root login-bg min-h-screen flex items-center justify-center p-4">
        <div className="login-card rounded-2xl overflow-hidden w-full max-w-md shadow-2xl p-8 md:p-10">

          <div className="flex items-center gap-3 mb-8">
            <img src="/spifora-icon.png" alt="Spifora" style={{ height: 34, width: 34, objectFit: 'contain' }} />
            <span className="login-heading text-white font-bold tracking-widest">SPIFORA</span>
          </div>

          {step === 'userId' ? (
            <>
              <div className="fade-up fade-up-1">
                <h1 className="login-heading text-white text-2xl font-bold">Forgot password?</h1>
                <p className="text-slate-400 text-sm mt-2">Enter your user ID — we'll email a code to the address linked to it.</p>
              </div>

              <div className="mt-8 space-y-5">
                <div className="fade-up fade-up-2">
                  <label className="block text-slate-400 text-xs font-medium uppercase tracking-widest mb-2">User ID</label>
                  <input
                    type="text"
                    className="input-field w-full px-4 py-3 rounded-xl text-sm"
                    placeholder="Enter your user ID"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    autoComplete="username"
                  />
                </div>

                <div className="fade-up fade-up-3">
                  <button
                    onClick={handleSendCode}
                    disabled={loading}
                    className="btn-primary w-full py-3 rounded-xl text-white text-sm font-semibold tracking-wide"
                  >
                    {loading ? 'Sending…' : 'Send reset code'}
                  </button>
                </div>

                <div className="fade-up fade-up-4 text-center">
                  <button onClick={() => navigate('/')} className="text-blue-400 text-xs hover:text-blue-300 transition-colors">
                    ← Back to sign in
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="fade-up fade-up-1">
                <h1 className="login-heading text-white text-2xl font-bold">Reset your password</h1>
                <p className="text-slate-400 text-sm mt-2">
                  If <span className="text-slate-200">{userId}</span> has an email on file, we sent it a code. Enter it below with your new password.
                </p>
              </div>

              <div className="mt-8 space-y-5">
                <div className="fade-up fade-up-2">
                  <label className="block text-slate-400 text-xs font-medium uppercase tracking-widest mb-2">Verification Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    className="input-field w-full px-4 py-3 rounded-xl text-lg tracking-[0.4em] text-center"
                    placeholder="••••••"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={handleKeyDown}
                    autoFocus
                  />
                  <div className="flex items-center justify-between mt-2">
                    <button type="button" onClick={() => { setStep('userId'); setOtp('') }} className="text-blue-400 text-xs hover:text-blue-300">
                      ← Change user ID
                    </button>
                    <button type="button" onClick={handleResend} disabled={resendIn > 0} className="text-blue-400 text-xs hover:text-blue-300 disabled:text-slate-600 disabled:cursor-not-allowed">
                      {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                    </button>
                  </div>
                </div>

                <div className="fade-up fade-up-3">
                  <label className="block text-slate-400 text-xs font-medium uppercase tracking-widest mb-2">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="input-field w-full px-4 py-3 rounded-xl text-sm pr-12"
                      placeholder="At least 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      onKeyDown={handleKeyDown}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPassword ? (
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Password requirements checklist */}
                  {newPassword && (
                    <ul className="mt-2.5 space-y-1">
                      {PW_RULES.map((r) => {
                        const ok = r.test(newPassword)
                        return (
                          <li key={r.label} className={`text-xs flex items-center gap-1.5 ${ok ? 'text-green-400' : 'text-slate-500'}`}>
                            <span className="inline-block w-3">{ok ? '✓' : '○'}</span>{r.label}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>

                <div className="fade-up fade-up-3">
                  <label className="block text-slate-400 text-xs font-medium uppercase tracking-widest mb-2">Confirm Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input-field w-full px-4 py-3 rounded-xl text-sm"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoComplete="new-password"
                  />
                </div>

                <div className="fade-up fade-up-4">
                  <button
                    onClick={handleReset}
                    disabled={loading}
                    className="btn-primary w-full py-3 rounded-xl text-white text-sm font-semibold tracking-wide"
                  >
                    {loading ? 'Resetting…' : 'Reset password'}
                  </button>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </>
  )
}

export default ForgotPassword
