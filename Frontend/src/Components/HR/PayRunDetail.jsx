import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaDownload, FaEnvelope } from 'react-icons/fa';
import axiosInstance from '../../helper/axiosInstance';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import nexusToast from '../../helper/nexusToast';

export default function PayRunDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isDark = useThemeStore((s) => s.isDark);
  const T = { ...getTheme(isDark), isDark };

  const [run, setRun] = useState(null);
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/api/payroll/pay-runs/${id}`);
      setRun(res.data?.data?.payRun || null);
      setPayslips(res.data?.data?.payslips || []);
    } catch { nexusToast.error('Failed to load pay run'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const downloadPdf = async (payslipId, number) => {
    setBusy(payslipId + 'dl');
    try {
      const res = await axiosInstance.get(`/api/payroll/payslips/${payslipId}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `payslip-${number}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { nexusToast.error('Failed to download PDF'); }
    finally { setBusy(null); }
  };

  const sendEmail = async (payslipId) => {
    setBusy(payslipId + 'email');
    try {
      const res = await axiosInstance.post(`/api/payroll/payslips/${payslipId}/send-email`, {});
      nexusToast.success(res.data?.message || 'Payslip emailed');
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || 'Failed to send email');
    } finally { setBusy(null); }
  };

  if (loading) return <div style={{ background: T.bg, minHeight: '100vh', padding: 48, textAlign: 'center', fontSize: 13, color: T.textSec }}>Loading…</div>;
  if (!run) return <div style={{ background: T.bg, minHeight: '100vh', padding: 48, textAlign: 'center', fontSize: 13, color: T.textSec }}>Pay run not found</div>;

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 32px', fontFamily: "'DM Sans',sans-serif" }}>
      <button onClick={() => navigate('/HR/Payroll')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: T.textSec, fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0, fontFamily: 'inherit' }}>
        <FaArrowLeft size={11} /> Back to Payroll
      </button>

      <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: '-0.03em' }}>{run.runNumber}</h1>
      <p style={{ fontSize: 13, color: T.textSec, margin: '4px 0 20px' }}>{run.periodStart} → {run.periodEnd} · Pay date {run.payDate} · Status: {run.status}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Gross', val: (run.totalGross || 0).toFixed(2) },
          { label: 'Total Deductions', val: (run.totalDeductions || 0).toFixed(2) },
          { label: 'Total Net', val: (run.totalNet || 0).toFixed(2) },
        ].map(s => (
          <div key={s.label} style={{ padding: '14px 18px', background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, margin: '0 0 6px' }}>{s.label}</p>
            <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 20, fontWeight: 700, color: T.textPri, margin: 0 }}>{s.val}</p>
          </div>
        ))}
      </div>

      <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc' }}>
              {['Payslip #', 'Employee', 'Job Title', 'Gross', 'Deductions', 'Net', 'Status', ''].map(h => (
                <th key={h} style={{ textAlign: h === 'Gross' || h === 'Deductions' || h === 'Net' ? 'right' : 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: T.textSec }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payslips.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: T.textSec }}>No payslips generated yet — go back and click "Generate" on this draft run.</td></tr>
            ) : payslips.map(p => (
              <tr key={p._id} style={{ borderTop: `1px solid ${T.border}` }}>
                <td style={{ padding: '10px 14px', fontFamily: "'DM Mono',monospace", color: T.textPri }}>{p.payslipNumber}</td>
                <td style={{ padding: '10px 14px', color: T.textPri, fontWeight: 600 }}>
                  {p.employeeName}
                  {p.unpaidLeaveDays > 0 && (
                    <span style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#ef4444', marginTop: 2 }}>
                      −{p.unpaidLeaveDays.toFixed(1)}d unpaid leave ({p.currency} {p.unpaidLeaveDeduction.toFixed(2)})
                    </span>
                  )}
                </td>
                <td style={{ padding: '10px 14px', color: T.textSec }}>{p.jobTitle}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', color: T.textPri }}>{p.currency} {p.grossPay.toFixed(2)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', color: T.textPri }}>{p.currency} {p.totalDeductions.toFixed(2)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', color: T.textPri, fontWeight: 700 }}>{p.currency} {p.netPay.toFixed(2)}</td>
                <td style={{ padding: '10px 14px', textTransform: 'capitalize', color: T.textSec }}>{p.status}</td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => downloadPdf(p._id, p.payslipNumber)} disabled={busy === p._id + 'dl'}
                      title="Download PDF"
                      style={{ width: 30, height: 30, border: `1px solid ${T.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}>
                      <FaDownload size={11} />
                    </button>
                    <button onClick={() => sendEmail(p._id)} disabled={busy === p._id + 'email'}
                      title="Email payslip"
                      style={{ width: 30, height: 30, border: `1px solid ${T.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}>
                      <FaEnvelope size={11} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
