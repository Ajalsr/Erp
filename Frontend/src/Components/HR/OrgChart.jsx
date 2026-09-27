import { useState, useEffect, useCallback } from 'react';
import { FaUserTie } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../helper/axiosInstance';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import nexusToast from '../../helper/nexusToast';

export default function OrgChart() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = { ...getTheme(isDark), isDark };
  const navigate = useNavigate();

  const [roots, setRoots] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchChart = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/employees/orgchart');
      setRoots(res.data?.data?.roots || []);
    } catch {
      nexusToast.error('Failed to load org chart');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchChart(); }, [fetchChart]);

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 32px', fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap');
        * { box-sizing: border-box; }
        .oc-scroll { overflow-x: auto; padding-bottom: 20px; }
        .oc-tree, .oc-tree ul { list-style: none; margin: 0; padding: 0; text-align: center; }
        .oc-tree { display: inline-flex; }
        .oc-tree ul { display: flex; padding-top: 28px; position: relative; }
        .oc-tree li { display: flex; flex-direction: column; align-items: center; padding: 0 12px; position: relative; }
        .oc-tree li::before { content: ''; position: absolute; top: 0; left: 50%; width: 1px; height: 28px; background: ${T.border}; }
        .oc-tree > li::before { display: none; }
        .oc-tree li ul::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: ${T.border}; }
        .oc-tree li:only-child ul::before { display: none; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: '-0.03em' }}>Org Chart</h1>
          <p style={{ fontSize: 13, color: T.textSec, margin: '4px 0 0' }}>Derived from each employee's reporting line</p>
        </div>
        <button onClick={() => navigate('/HR/Employees')}
          style={{ padding: '10px 16px', background: 'transparent', color: T.textPri, border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          Manage Employees
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', fontSize: 13, color: T.textSec }}>Loading…</div>
      ) : roots.length === 0 ? (
        <div style={{ padding: 64, textAlign: 'center', background: T.surface, borderRadius: 16, border: `1.5px solid ${T.border}` }}>
          <FaUserTie size={28} color={T.border} style={{ display: 'block', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 15, fontWeight: 700, color: T.textPri, margin: '0 0 6px' }}>No employees yet</p>
          <p style={{ fontSize: 13, color: T.textSec, margin: 0 }}>Add employees and set "Reports To" to build the chart.</p>
        </div>
      ) : (
        <div className="oc-scroll">
          <ul className="oc-tree">
            {roots.map(r => <OrgNode key={r.id} node={r} T={T} isDark={isDark} />)}
          </ul>
        </div>
      )}
    </div>
  );
}

function OrgNode({ node, T, isDark }) {
  return (
    <li>
      <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 12, padding: '12px 16px', minWidth: 180, boxShadow: isDark ? '0 2px 8px rgba(0,0,0,.25)' : '0 2px 6px rgba(0,0,0,.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {node.photo ? <img src={node.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <FaUserTie size={14} color="#3b82f6" />}
          </div>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: 0, whiteSpace: 'nowrap' }}>{node.name}</p>
            <p style={{ fontSize: 11, color: T.textSec, margin: 0, whiteSpace: 'nowrap' }}>{node.jobTitle}</p>
          </div>
        </div>
      </div>
      {node.children && node.children.length > 0 && (
        <ul>
          {node.children.map(c => <OrgNode key={c.id} node={c} T={T} isDark={isDark} />)}
        </ul>
      )}
    </li>
  );
}
