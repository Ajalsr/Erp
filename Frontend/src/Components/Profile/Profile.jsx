import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaUser, FaBuilding, FaShieldAlt, FaChevronLeft, FaCog, FaSignOutAlt, FaCheckCircle, FaEnvelope } from "react-icons/fa";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import useAuthStore from "../../store/useAuthStore";
import { clearPermissions } from "../../helper/permissions";
import { getDeviceId } from "../../helper/useLogin";
import api from "../../helper/axiosInstance";
import nexusToast from "../../helper/nexusToast";

const roleLabel = (r) => (r ? r.charAt(0).toUpperCase() + r.slice(1) : "Member");

export default function Profile() {
  const navigate = useNavigate();
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);

  const user          = useAuthStore((s) => s.user);
  const activeOrg     = useAuthStore((s) => s.activeOrg);
  const organizations = useAuthStore((s) => s.organizations);
  const setActiveOrg  = useAuthStore((s) => s.setActiveOrg);
  const clearAuth     = useAuthStore((s) => s.clearAuth);

  const name  = user?.name || user?.userId || "User";
  const initial = (name || "U").charAt(0).toUpperCase();

  // Email (used for new-device login OTP) — fetched + editable.
  const [email, setEmail] = useState("");
  const [savedEmail, setSavedEmail] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api.get("/api/users/me")
      .then((r) => { const e = r.data?.data?.email || ""; setEmail(e); setSavedEmail(e); })
      .catch(() => {});
  }, []);
  const saveEmail = async () => {
    const v = email.trim().toLowerCase();
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { nexusToast.error("Enter a valid email"); return; }
    setSaving(true);
    try {
      await api.put("/api/users/me", { email: v });
      setSavedEmail(v); setEmail(v);
      nexusToast.success("Email updated");
    } catch (e) {
      nexusToast.error(e?.response?.data?.message || "Failed to update email");
    } finally { setSaving(false); }
  };

  // Trusted devices (skip OTP). Current device flagged via the local device id.
  const [devices, setDevices] = useState([]);
  const loadDevices = () => {
    api.get(`/api/users/me/devices?deviceId=${encodeURIComponent(getDeviceId())}`)
      .then((r) => setDevices(r.data?.data || []))
      .catch(() => setDevices([]));
  };
  useEffect(() => { loadDevices(); }, []);
  const revokeDevice = async (id) => {
    try {
      await api.delete(`/api/users/me/devices/${encodeURIComponent(id)}`);
      setDevices((d) => d.filter((x) => x.id !== id));
      nexusToast.success("Device removed — it'll need a new code next login");
    } catch (e) {
      nexusToast.error(e?.response?.data?.message || "Failed to remove device");
    }
  };
  const devLabel = (l) => {
    if (!l) return "Unknown device";
    if (/iphone|android|mobile/i.test(l)) return "Mobile device";
    if (/mac/i.test(l)) return "Mac";
    if (/windows/i.test(l)) return "Windows PC";
    return l.length > 48 ? l.slice(0, 48) + "…" : l;
  };
  const fmtWhen = (d) => { try { return new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }); } catch { return ""; } };

  const signOut = () => { clearPermissions(); clearAuth(); navigate("/"); };

  const card  = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14 };
  const label = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: T.textSec };
  const value = { fontSize: 14, fontWeight: 600, color: T.textPri, marginTop: 4, wordBreak: "break-word" };

  const InfoRow = ({ icon, k, v }) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 0", borderBottom: `1px solid ${T.border}` }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: T.blueDim || "rgba(59,130,246,.12)", color: T.blue || "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      <div><div style={label}>{k}</div><div style={value}>{v || "—"}</div></div>
    </div>
  );

  return (
    <div style={{ background: T.bg, minHeight: "calc(100vh - 56px)", color: T.textPri, fontFamily: "'DM Sans', sans-serif", padding: "24px 28px 48px" }}>
      <button onClick={() => navigate(-1)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: T.textSec, cursor: "pointer", padding: "6px 11px", borderRadius: 7, border: `1px solid ${T.border}`, background: "transparent", fontFamily: "inherit", marginBottom: 18 }}>
        <FaChevronLeft size={10} /> Back
      </button>

      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Header card */}
        <div style={{ ...card, padding: "22px 24px", display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800, fontFamily: "'Sora', sans-serif", flexShrink: 0 }}>{initial}</div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 20, fontWeight: 800, margin: 0 }}>{name}</h1>
            <p style={{ fontSize: 13, color: T.textSec, margin: "3px 0 0" }}>{email || activeOrg?.name || user?.companyName || "Organization"}</p>
            {activeOrg?.role && (
              <span style={{ display: "inline-block", marginTop: 8, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: T.blueDim || "rgba(59,130,246,.12)", color: T.blue || "#3b82f6" }}>{roleLabel(activeOrg.role)}</span>
            )}
          </div>
        </div>

        {/* Account details */}
        <div style={{ ...card, padding: "8px 24px 18px" }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: "16px 0 4px" }}>Account</h2>
          <InfoRow icon={<FaUser size={13} />}       k="Name" v={name} />
          <InfoRow icon={<FaBuilding size={13} />}   k="Organization" v={activeOrg?.name || user?.companyName} />
          <InfoRow icon={<FaShieldAlt size={13} />}  k="Role" v={roleLabel(activeOrg?.role)} />
        </div>

        {/* Login email — used to verify new devices with an OTP */}
        <div style={{ ...card, padding: "18px 24px" }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: "0 0 4px" }}>Login email</h2>
          <p style={{ fontSize: 12, color: T.textSec, margin: "0 0 12px" }}>
            We email a verification code here when you sign in from a new device.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
              <FaEnvelope size={12} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textSec }} />
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                style={{ width: "100%", padding: "10px 12px 10px 32px", borderRadius: 9, border: `1px solid ${T.border}`, background: isDark ? T.surface2 : "#fff", color: T.textPri, fontSize: 13, fontFamily: "inherit", outline: "none" }}
              />
            </div>
            <button onClick={saveEmail} disabled={saving || email.trim().toLowerCase() === savedEmail}
              style={{ padding: "10px 18px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: (saving || email.trim().toLowerCase() === savedEmail) ? "not-allowed" : "pointer", background: (T.blue || "#3b82f6"), color: "#fff", border: "none", fontFamily: "inherit", opacity: (saving || email.trim().toLowerCase() === savedEmail) ? 0.6 : 1 }}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {/* Trusted devices */}
        {devices.length > 0 && (
          <div style={{ ...card, padding: "16px 24px 18px" }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: "0 0 4px" }}>Trusted Devices</h2>
            <p style={{ fontSize: 12, color: T.textSec, margin: "0 0 12px" }}>
              These devices skip the login code. Remove any you don't recognize.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {devices.map((d) => (
                <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 10, border: `1px solid ${T.border}` }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: T.blueDim || "rgba(59,130,246,.12)", color: T.blue || "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><FaShieldAlt size={13} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.textPri }}>{devLabel(d.label)}{d.current && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: T.blue || "#3b82f6" }}>● This device</span>}</div>
                    <div style={{ fontSize: 11, color: T.textSec }}>Added {fmtWhen(d.addedAt)}</div>
                  </div>
                  {!d.current && (
                    <button onClick={() => revokeDevice(d.id)} style={{ fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 7, cursor: "pointer", background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", color: "#ef4444", fontFamily: "inherit" }}>Remove</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Organizations */}
        {organizations?.length > 0 && (
          <div style={{ ...card, padding: "16px 24px 18px" }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: "0 0 12px" }}>Your Organizations</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {organizations.map((o) => {
                const isActive = o._id === activeOrg?._id;
                return (
                  <div key={o._id} onClick={() => !isActive && setActiveOrg(o)} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 10,
                    border: `1px solid ${isActive ? (T.blue || "#3b82f6") : T.border}`,
                    background: isActive ? (T.blueDim || "rgba(59,130,246,.08)") : "transparent",
                    cursor: isActive ? "default" : "pointer",
                  }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: T.surface2, color: T.textPri, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, fontFamily: "'Sora', sans-serif" }}>{(o.name || "O").charAt(0).toUpperCase()}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.textPri }}>{o.name}</div>
                      <div style={{ fontSize: 11, color: T.textSec }}>{roleLabel(o.role)}</div>
                    </div>
                    {isActive
                      ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: T.blue || "#3b82f6" }}><FaCheckCircle size={11} /> Active</span>
                      : <span style={{ fontSize: 11, color: T.textSec }}>Switch</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {activeOrg?._id && (
            <button onClick={() => navigate(`/organizations/${activeOrg._id}/settings`)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", background: T.surface, border: `1px solid ${T.border}`, color: T.textPri, fontFamily: "inherit" }}>
              <FaCog size={13} /> Organization Settings
            </button>
          )}
          <button onClick={signOut} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", color: "#ef4444", fontFamily: "inherit" }}>
            <FaSignOutAlt size={13} /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
