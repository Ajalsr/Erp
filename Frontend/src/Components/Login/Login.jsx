import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import useLogin from '../../helper/useLogin'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

const Login = () => {
  const { handleSignin } = useLogin()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [inputs, setInputs] = useState({ userId: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async () => {
    if (!inputs.userId || !inputs.password) {
      toast.error('Please fill in all fields')
      return
    }
    setLoading(true)
    try {
      await handleSignin(inputs)
      setInputs({ userId: '', password: '' })
      // If an invite (or any page) redirected here, go back there after login
      const redirectTo = searchParams.get('redirect')
      navigate(redirectTo ? decodeURIComponent(redirectTo) : '/Home')
    } catch (error) {
      toast.error(error?.error || 'Sign in failed')
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
        .login-panel {
          background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 50%, #0c4a6e 100%);
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
          position: relative;
          overflow: hidden;
        }
        .btn-primary:hover:not(:disabled) {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          transform: translateY(-1px);
          box-shadow: 0 8px 25px rgba(37, 99, 235, 0.4);
        }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .grid-overlay {
          background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .stat-chip {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.5s ease forwards; }
        .fade-up-1 { animation-delay: 0.1s; opacity: 0; }
        .fade-up-2 { animation-delay: 0.2s; opacity: 0; }
        .fade-up-3 { animation-delay: 0.3s; opacity: 0; }
        .fade-up-4 { animation-delay: 0.4s; opacity: 0; }
        .fade-up-5 { animation-delay: 0.5s; opacity: 0; }
      `}</style>

      <div className="login-root login-bg min-h-screen flex items-center justify-center p-4">
        <div className="login-card rounded-2xl overflow-hidden w-full max-w-4xl flex shadow-2xl">

          {/* Left decorative panel */}
          <div className="login-panel hidden md:flex flex-col justify-between p-10 w-[420px] flex-shrink-0 relative overflow-hidden">
            <div className="grid-overlay absolute inset-0" />
            {/* Floating orb */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%)' }} />

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <svg width="38" height="38" viewBox="0 0 120 120">
                  <rect width="120" height="120" rx="24" fill="#1a1a1a"/>
                  <line x1="28" y1="28" x2="92" y2="92" stroke="#f43f5e" strokeWidth="9" strokeLinecap="round"/>
                  <line x1="92" y1="28" x2="28" y2="92" stroke="#3b82f6" strokeWidth="9" strokeLinecap="round"/>
                  <circle cx="28" cy="28" r="9" fill="#f43f5e"/>
                  <circle cx="92" cy="92" r="9" fill="#f43f5e"/>
                  <circle cx="92" cy="28" r="9" fill="#3b82f6"/>
                  <circle cx="28" cy="92" r="9" fill="#3b82f6"/>
                  <circle cx="60" cy="60" r="13" fill="#f59e0b"/>
                </svg>
                <div>
                  <span className="login-heading text-white font-bold text-xl tracking-widest block">NEXUS</span>
                  <span style={{ fontSize: '10px', letterSpacing: '0.15em', color: '#94a3b8', fontWeight: 500 }}>ALL-IN-ONE</span>
                </div>
              </div>
            </div>

            <div className="relative z-10 space-y-6">
              <div>
                <h2 className="login-heading text-white text-3xl font-bold leading-tight">
                  Enterprise<br />Resource<br />Planning
                </h2>
                <p className="text-slate-400 text-sm mt-3 leading-relaxed">
                  Manage inventory, sales, purchases, and financials — all in one place.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Modules', value: '12+' },
                  { label: 'Real-time', value: 'Sync' },
                  { label: 'Reports', value: '50+' },
                  { label: 'Uptime', value: '99.9%' },
                ].map(({ label, value }) => (
                  <div key={label} className="stat-chip rounded-xl p-3">
                    <p className="text-blue-400 font-bold text-lg login-heading">{value}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative z-10">
              <p className="text-slate-600 text-xs">© 2026 Nexus. All rights reserved.</p>
            </div>
          </div>

          {/* Right form panel */}
          <div className="flex-1 flex flex-col justify-center p-8 md:p-12">
            <div className="max-w-sm w-full mx-auto">

              {/* Mobile logo */}
              <div className="flex items-center gap-3 mb-8 md:hidden">
                <svg width="30" height="30" viewBox="0 0 120 120">
                  <rect width="120" height="120" rx="24" fill="#1a1a1a"/>
                  <line x1="28" y1="28" x2="92" y2="92" stroke="#f43f5e" strokeWidth="9" strokeLinecap="round"/>
                  <line x1="92" y1="28" x2="28" y2="92" stroke="#3b82f6" strokeWidth="9" strokeLinecap="round"/>
                  <circle cx="28" cy="28" r="9" fill="#f43f5e"/>
                  <circle cx="92" cy="92" r="9" fill="#f43f5e"/>
                  <circle cx="92" cy="28" r="9" fill="#3b82f6"/>
                  <circle cx="28" cy="92" r="9" fill="#3b82f6"/>
                  <circle cx="60" cy="60" r="13" fill="#f59e0b"/>
                </svg>
                <span className="login-heading text-white font-bold tracking-widest">NEXUS</span>
              </div>

              <div className="fade-up fade-up-1">
                <h1 className="login-heading text-white text-3xl font-bold">Welcome back</h1>
                <p className="text-slate-400 text-sm mt-2">Sign in to your account to continue</p>
              </div>

              <div className="mt-8 space-y-5">
                <div className="fade-up fade-up-2">
                  <label className="block text-slate-400 text-xs font-medium uppercase tracking-widest mb-2">
                    User ID
                  </label>
                  <input
                    type="text"
                    className="input-field w-full px-4 py-3 rounded-xl text-sm"
                    placeholder="Enter your user ID"
                    value={inputs.userId}
                    onChange={(e) => setInputs({ ...inputs, userId: e.target.value })}
                    onKeyDown={handleKeyDown}
                    autoComplete="username"
                  />
                </div>

                <div className="fade-up fade-up-3">
                  <label className="block text-slate-400 text-xs font-medium uppercase tracking-widest mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="input-field w-full px-4 py-3 rounded-xl text-sm pr-12"
                      placeholder="Enter your password"
                      value={inputs.password}
                      onChange={(e) => setInputs({ ...inputs, password: e.target.value })}
                      onKeyDown={handleKeyDown}
                      autoComplete="current-password"
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
                </div>

                <div className="fade-up fade-up-4 flex justify-end">
                  <button className="text-blue-400 text-xs hover:text-blue-300 transition-colors">
                    Forgot password?
                  </button>
                </div>

                <div className="fade-up fade-up-5">
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="btn-primary w-full py-3 rounded-xl text-white text-sm font-semibold tracking-wide"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Signing in...
                      </span>
                    ) : 'Sign In'}
                  </button>

                  <p className="text-center text-slate-500 text-xs mt-5">
                    Don't have an account?{' '}
                    <Link to="/Signup" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                      Create one
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default Login