import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useOrganization from '../../helper/useOrganization'
import useAuthStore from '../../store/useAuthStore'
import nexusToast from '../../helper/nexusToast'

const MODULE_LABELS = {
  items: 'Items', item_groups: 'Item Groups', price_lists: 'Price Lists',
  warehouses: 'Warehouses', adjustments: 'Stock Adjustments', grns: 'GRNs',
  customers: 'Customers', enquiries: 'Enquiries', quotes: 'Quotes',
  sales_orders: 'Sales Orders', delivery_notes: 'Delivery Notes', invoices: 'Invoices',
  credit_notes: 'Credit Notes', letters: 'Letters',
  vendors: 'Vendors', purchase_orders: 'Purchase Orders', bills: 'Bills',
  debit_notes: 'Debit Notes', vendor_credits: 'Vendor Credits',
  accounts: 'Accounts', journal_entries: 'Journal Entries', payments: 'Payments Received',
  vendor_payments: 'Payments Made', advance_payments: 'Advance Payments',
  reports: 'Reports', dashboard: 'Dashboard',
  employees: 'Employees', payroll: 'Payroll', timeoff: 'Time Off',
  projects: 'Projects',
}
const moduleLabel = (m) => MODULE_LABELS[m] || m

const CreateOrganization = () => {
  const navigate = useNavigate()
  const { createOrganization, verifyLicenseKey, getMyOrganizations } = useOrganization()
  const user = useAuthStore((s) => s.user)
  const setActiveOrg = useAuthStore((s) => s.setActiveOrg)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const [licenseKeyInput, setLicenseKeyInput] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [license, setLicense] = useState(null) // verified plan summary
  const [selectedModules, setSelectedModules] = useState([])
  const [maxUsers, setMaxUsers] = useState(1)

  const atCap = license && license.orgsUsed >= license.maxOrganizations
  const usersCeiling = license?.maxUsersPerOrg || 0 // 0 = unlimited
  const usersInvalid = usersCeiling > 0 && (maxUsers < 1 || maxUsers > usersCeiling)
  const canSubmit = !!license && !atCap && selectedModules.length > 0 && !usersInvalid

  const handleVerify = async () => {
    const key = licenseKeyInput.trim()
    if (!key) { nexusToast.error('Enter a license key'); return }
    setVerifying(true)
    try {
      const data = await verifyLicenseKey(key)
      if (data.status !== 'active') {
        nexusToast.error(`This license key is ${data.status}`)
        setLicense(null)
        return
      }
      setLicense(data)
      setSelectedModules(data.allowedModules || []) // default: all licensed modules on
      setMaxUsers(data.maxUsersPerOrg > 0 ? data.maxUsersPerOrg : 1) // default: full seat ceiling, or 1 if unlimited
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || 'License key not found')
      setLicense(null)
    } finally {
      setVerifying(false)
    }
  }

  const toggleModule = (m) => {
    setSelectedModules((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m])
  }

  const handleCreate = async () => {
    if (!name.trim()) { nexusToast.error('Organization name is required'); return }
    if (!license) { nexusToast.error('Verify a license key first'); return }
    if (selectedModules.length === 0) { nexusToast.error('Select at least one module'); return }
    if (usersInvalid) { nexusToast.error(`Number of users must be between 1 and ${usersCeiling}`); return }
    setLoading(true)
    try {
      const res = await createOrganization({
        name: name.trim(),
        description: description.trim(),
        licenseKey: licenseKeyInput.trim(),
        modulesEnabled: selectedModules,
        maxUsers,
      })
      const org = res.data
      setActiveOrg({ ...org, role: 'owner' })
      await getMyOrganizations()
      nexusToast.success('Organization created!')
      navigate('/Home')
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || 'Failed to create organization')
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
        .co-btn-ghost {
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          transition: all 0.2s;
        }
        .co-btn-ghost:hover:not(:disabled) { background: rgba(255,255,255,0.09); }
        .co-btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }
        .co-mod {
          display: flex; align-items: center; gap: 8px; padding: 8px 10px;
          border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); cursor: pointer;
          background: rgba(255,255,255,0.03);
        }
        .co-mod:hover { background: rgba(255,255,255,0.06); }
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
        <div className="co-card rounded-2xl w-full max-w-lg p-8 md:p-10 shadow-2xl" style={{ maxHeight: '92vh', overflowY: 'auto' }}>

          {/* Back — this page is reachable both from the zero-org gate (nothing
              meaningful behind it) and from the org switcher's "New Organization"
              item (a real previous page); browser history back does the right
              thing in both cases. */}
          <button
            onClick={() => navigate(-1)}
            className="co-fade co-1"
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 20 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back
          </button>

          {/* Logo */}
          <div className="co-fade co-1 flex items-center gap-2 mb-8">
            <img src="/spifora-icon.png" alt="Spifora" style={{ height: 32, width: 32, objectFit: 'contain' }} />
            <span className="co-heading text-white font-bold text-lg">SPIFORA</span>
          </div>

          <div className="co-fade co-1 mb-6">
            <h1 className="co-heading text-white text-2xl font-bold">Create your organization</h1>
            <p className="text-slate-400 text-sm mt-1">
              {user?.userId ? `Welcome, ${user.userId}! ` : ''}A license key is required — it determines which modules your organization can use.
            </p>
          </div>

          {/* Step 1: License key */}
          <div className="co-fade co-2 mb-6">
            <label className="block text-slate-400 text-xs font-medium uppercase tracking-widest mb-2">
              License Key *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                className="co-input flex-1 px-4 py-3 rounded-xl text-sm"
                placeholder="SPF-XXXX-XXXX-XXXX"
                value={licenseKeyInput}
                onChange={(e) => { setLicenseKeyInput(e.target.value); setLicense(null) }}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              />
              <button onClick={handleVerify} disabled={verifying} className="co-btn-ghost px-5 rounded-xl text-white text-sm font-semibold whitespace-nowrap">
                {verifying ? 'Checking…' : 'Verify'}
              </button>
            </div>
            <p className="text-slate-600 text-xs mt-2">
              Don't have a key? <a href="https://spifora.com/spifora.html" target="_blank" rel="noreferrer" className="text-blue-400">Request one on spifora.com</a>.
            </p>
          </div>

          {/* Plan summary + module picker — only after a successful verify */}
          {license && (
            <div className="co-fade mb-6 p-4 rounded-xl" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-white text-sm font-semibold">{license.planName || 'Plan'} — {license.customerName}</p>
                <span className={`text-xs font-semibold ${atCap ? 'text-red-400' : 'text-emerald-400'}`}>
                  {license.orgsUsed} of {license.maxOrganizations} organizations used
                </span>
              </div>
              {license.expiresAt && (
                <p className="text-slate-500 text-xs mb-3">Expires {new Date(license.expiresAt).toLocaleDateString()}</p>
              )}
              {atCap ? (
                <p className="text-red-400 text-xs font-medium">This key's organization limit has been reached — contact whoever issued it.</p>
              ) : (
                <>
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-widest mb-2">Modules for this organization</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(license.allowedModules || []).map((m) => (
                      <label key={m} className="co-mod">
                        <input type="checkbox" checked={selectedModules.includes(m)} onChange={() => toggleModule(m)} />
                        <span className="text-slate-200 text-xs">{moduleLabel(m)}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-slate-600 text-xs mt-2">You can only pick from what this license allows — not every module your plan doesn't include.</p>

                  <p className="text-slate-400 text-xs font-medium uppercase tracking-widest mt-4 mb-2">Number of users</p>
                  <input
                    type="number"
                    min={1}
                    max={usersCeiling > 0 ? usersCeiling : undefined}
                    className="co-input w-full px-4 py-2 rounded-xl text-sm"
                    value={maxUsers}
                    onChange={(e) => setMaxUsers(Number(e.target.value) || 1)}
                  />
                  <p className={`text-xs mt-1 ${usersInvalid ? 'text-red-400' : 'text-slate-600'}`}>
                    {usersCeiling > 0 ? `max ${usersCeiling} users on this plan` : 'unlimited users on this plan'} — the owner counts as one seat.
                  </p>
                </>
              )}
            </div>
          )}

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
              />
            </div>

            <div className="co-fade co-2">
              <label className="block text-slate-400 text-xs font-medium uppercase tracking-widest mb-2">
                Description <span className="normal-case text-slate-600">(optional)</span>
              </label>
              <textarea
                className="co-input w-full px-4 py-3 rounded-xl text-sm resize-none"
                placeholder="What does your organization do?"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="co-fade co-3 pt-2">
              <button
                onClick={handleCreate}
                disabled={loading || !canSubmit}
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
