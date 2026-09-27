import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import useSignup from '../../helper/useSignup'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

// Password policy: 6+ chars with upper, lower, number and a symbol.
const PW_RULES = [
  { label: 'At least 6 characters', test: (p) => p.length >= 6 },
  { label: 'One uppercase letter (A-Z)', test: (p) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter (a-z)', test: (p) => /[a-z]/.test(p) },
  { label: 'One number (0-9)', test: (p) => /[0-9]/.test(p) },
  { label: 'One symbol (!@#$ etc.)', test: (p) => /[^A-Za-z0-9]/.test(p) },
]
const pwValid = (p) => PW_RULES.every((r) => r.test(p))

const Signup = () => {
  const { handleSignup } = useSignup()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // Prefill only the email from an invite link (?email=). userId is chosen freely.
  const inviteEmail = searchParams.get('email') || ''
  const inviteToken = searchParams.get('token') || ''
  const [inputs, setInputs] = useState({
    userId: '',
    email: inviteEmail,
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async () => {
    if (!inputs.userId || !inputs.email || !inputs.password) {
      toast.error('Please fill in all fields')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputs.email)) {
      toast.error('Enter a valid email')
      return
    }
    if (!pwValid(inputs.password)) {
      toast.error('Password must be 6+ chars with uppercase, lowercase, number and a symbol')
      return
    }
    setLoading(true)
    try {
      // Create the account. No auto sign-in: the first login must clear an emailed
      // OTP (device-verification), then only a new/changed device triggers another.
      await handleSignup({ userId: inputs.userId, email: inputs.email.trim().toLowerCase(), password: inputs.password, inviteToken })

      setInputs({ userId: '', email: '', password: '' })
      toast.success('Account created! Sign in to continue.')
      const redirectTo = searchParams.get('redirect')
      const loginUrl = redirectTo ? `/?redirect=${encodeURIComponent(redirectTo)}` : '/'
      setTimeout(() => navigate(loginUrl), 900)
    } catch (error) {
      const msg = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Signup failed'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <>
      <ToastContainer position="top-right" autoClose={4000} theme="dark" />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&family=Bebas+Neue&display=swap');
        .signup-root { font-family: 'DM Sans', sans-serif; }
        .signup-heading { font-family: 'Sora', sans-serif; }
        .signup-bg {
          background: #0a0f1e;
          background-image:
            radial-gradient(ellipse 80% 60% at 80% 50%, rgba(30, 64, 175, 0.15) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 20% 20%, rgba(14, 165, 233, 0.08) 0%, transparent 50%);
        }
        .signup-card {
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(20px);
        }
        .su-input {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #f1f5f9;
          transition: all 0.2s;
        }
        .su-input:focus {
          background: rgba(255,255,255,0.08);
          border-color: #3b82f6;
          outline: none;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
        }
        .su-input::placeholder { color: rgba(148,163,184,0.5); }
        .su-btn {
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          border: 1px solid rgba(255,255,255,0.1);
          transition: all 0.2s;
        }
        .su-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          transform: translateY(-1px);
          box-shadow: 0 8px 25px rgba(37,99,235,0.4);
        }
        .su-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .step-dot { transition: all 0.3s; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .su-fade { animation: fadeUp 0.4s ease forwards; }
        .su-1 { animation-delay: 0.1s; opacity: 0; }
        .su-2 { animation-delay: 0.2s; opacity: 0; }
        .su-3 { animation-delay: 0.3s; opacity: 0; }
        .su-4 { animation-delay: 0.4s; opacity: 0; }
      `}</style>

      <div className="signup-root signup-bg min-h-screen flex items-center justify-center p-4">
        <div className="signup-card rounded-2xl w-full max-w-md p-8 md:p-10 shadow-2xl">

          {/* Header */}
          <div className="su-fade su-1 flex items-center gap-2 mb-8">
            <img src="/spifora-icon.png" alt="Spifora" style={{ height: 32, width: 32, objectFit: 'contain' }} />
            <span className="signup-heading text-white font-bold text-lg">SPIFORA</span>
          </div>

          <div className="su-fade su-1 mb-8">
            <h1 className="signup-heading text-white text-2xl font-bold">Create your account</h1>
            <p className="text-slate-400 text-sm mt-1">Join Spifora — your organization will be set up after signup</p>
          </div>

          <div className="space-y-5">
            <div className="su-fade su-2">
              <label className="block text-slate-400 text-xs font-medium uppercase tracking-widest mb-2">
                User ID
              </label>
              <input
                type="text"
                className="su-input w-full px-4 py-3 rounded-xl text-sm"
                placeholder="Choose a unique ID"
                value={inputs.userId}
                onChange={(e) => setInputs({ ...inputs, userId: e.target.value })}
                onKeyDown={handleKeyDown}
              />
              <p className="text-slate-600 text-xs mt-1.5">This will be used to log in — choose carefully</p>
            </div>

            <div className="su-fade su-3">
              <label className="block text-slate-400 text-xs font-medium uppercase tracking-widest mb-2">
                Email
              </label>
              <input
                type="email"
                className="su-input w-full px-4 py-3 rounded-xl text-sm"
                placeholder="you@example.com"
                value={inputs.email}
                onChange={(e) => { if (!inviteEmail) setInputs({ ...inputs, email: e.target.value }) }}
                onKeyDown={handleKeyDown}
                autoComplete="email"
                readOnly={!!inviteEmail}
                style={inviteEmail ? { opacity: 0.75, cursor: 'not-allowed' } : undefined}
              />
              <p className="text-slate-600 text-xs mt-1.5">{inviteEmail ? 'From your invitation — sign up with this email' : 'Used to verify new devices with a login code'}</p>
            </div>

            <div className="su-fade su-3">
              <label className="block text-slate-400 text-xs font-medium uppercase tracking-widest mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="su-input w-full px-4 py-3 rounded-xl text-sm pr-12"
                  placeholder="Min. 6 characters"
                  value={inputs.password}
                  onChange={(e) => setInputs({ ...inputs, password: e.target.value })}
                  onKeyDown={handleKeyDown}
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
              {inputs.password && (
                <ul className="mt-2.5 space-y-1">
                  {PW_RULES.map((r) => {
                    const ok = r.test(inputs.password)
                    return (
                      <li key={r.label} className={`text-xs flex items-center gap-1.5 ${ok ? 'text-green-400' : 'text-slate-500'}`}>
                        <span className="inline-block w-3">{ok ? '✓' : '○'}</span>{r.label}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="su-fade su-4 pt-2">
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="su-btn w-full py-3 rounded-xl text-white text-sm font-semibold tracking-wide"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Creating account...
                  </span>
                ) : 'Create Account'}
              </button>

              <p className="text-center text-slate-500 text-xs mt-4">
                Already have an account?{' '}
                <Link to="/" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default Signup