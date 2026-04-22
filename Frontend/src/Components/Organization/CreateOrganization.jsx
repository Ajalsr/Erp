import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useOrganization from '../../helper/useOrganization'
import useAuthStore from '../../store/useAuthStore'
import toast from 'react-hot-toast'

const CreateOrganization = () => {
  const navigate = useNavigate()
  const { createOrganization, getMyOrganizations } = useOrganization()
  const user = useAuthStore((s) => s.user)
  const setActiveOrg = useAuthStore((s) => s.setActiveOrg)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Organization name is required')
      return
    }
    setLoading(true)
    try {
      const res = await createOrganization({ name: name.trim(), description: description.trim() })
      const org = res.data
      setActiveOrg({ ...org, role: 'owner' })
      await getMyOrganizations()
      toast.success('Organization created!')
      navigate('/Home')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create organization')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&family=Bebas+Neue&display=swap');
        .co-root { font-family: 'DM Sans', sans-serif; }
        .co-heading { font-family: 'Sora', sans-serif; }
        .co-bg {
          background: #0a0f1e;
          background-image:
            radial-gradient(ellipse 80% 60% at 20% 50%, rgba(30,64,175,0.15) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 80% 20%, rgba(14,165,233,0.08) 0%, transparent 50%);
        }
        .co-card {
          background: rgba(15,23,42,0.95);
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(20px);
        }
        .co-input {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #f1f5f9;
          transition: all 0.2s;
        }
        .co-input:focus {
          background: rgba(255,255,255,0.08);
          border-color: #3b82f6;
          outline: none;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
        }
        .co-input::placeholder { color: rgba(148,163,184,0.5); }
        .co-btn {
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          border: 1px solid rgba(255,255,255,0.1);
          transition: all 0.2s;
        }
        .co-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          transform: translateY(-1px);
          box-shadow: 0 8px 25px rgba(37,99,235,0.4);
        }
        .co-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .co-fade { animation: fadeUp 0.4s ease forwards; }
        .co-1 { animation-delay: 0.05s; opacity: 0; }
        .co-2 { animation-delay: 0.15s; opacity: 0; }
        .co-3 { animation-delay: 0.25s; opacity: 0; }
      `}</style>

      <div className="co-root co-bg min-h-screen flex items-center justify-center p-4">
        <div className="co-card rounded-2xl w-full max-w-md p-8 md:p-10 shadow-2xl">

          {/* Logo */}
          <div className="co-fade co-1 flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
              </svg>
            </div>
            <span className="co-heading text-white font-bold text-lg">NEXUS ERP</span>
          </div>

          <div className="co-fade co-1 mb-8">
            <h1 className="co-heading text-white text-2xl font-bold">Create your organization</h1>
            <p className="text-slate-400 text-sm mt-1">
              {user?.userId ? `Welcome, ${user.userId}! ` : ''}Set up a workspace to get started.
            </p>
          </div>

          {/* Org icon preview */}
          <div className="co-fade co-2 flex items-center gap-3 mb-6 p-3 rounded-xl" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-blue-400 font-bold text-sm co-heading">
                {name ? name.charAt(0).toUpperCase() : '?'}
              </span>
            </div>
            <div>
              <p className="text-white text-sm font-medium">{name || 'Organization name'}</p>
              <p className="text-slate-500 text-xs">You'll be the owner</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="co-fade co-2">
              <label className="block text-slate-400 text-xs font-medium uppercase tracking-widest mb-2">
                Organization Name *
              </label>
              <input
                type="text"
                className="co-input w-full px-4 py-3 rounded-xl text-sm"
                placeholder="e.g. Acme Trading LLC"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
            </div>

            <div className="co-fade co-2">
              <label className="block text-slate-400 text-xs font-medium uppercase tracking-widest mb-2">
                Description <span className="normal-case text-slate-600">(optional)</span>
              </label>
              <textarea
                className="co-input w-full px-4 py-3 rounded-xl text-sm resize-none"
                placeholder="What does your organization do?"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="co-fade co-3 pt-2">
              <button
                onClick={handleCreate}
                disabled={loading}
                className="co-btn w-full py-3 rounded-xl text-white text-sm font-semibold tracking-wide"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Creating...
                  </span>
                ) : 'Create Organization'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default CreateOrganization
