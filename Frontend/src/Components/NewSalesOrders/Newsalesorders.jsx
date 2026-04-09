import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import useGetItem from '../../helper/useGetItem';
import useGetCustomers from '../../helper/useGetCustomers';
import useAddSalesOrder from '../../helper/useAddSalesOrder';
import { debounce } from 'lodash';
import DatePicker from 'react-datepicker';
import { format, addDays, addMonths, addYears, isSameDay } from 'date-fns';
import {
  FaCalendarAlt, FaChevronLeft, FaChevronRight, FaTimes,
  FaClock, FaRegCalendarAlt, FaCheck, FaSearch, FaBox,
  FaPlus, FaTrash, FaPaperclip,
  FaBarcode, FaWarehouse, FaMoneyBill,
  FaTag, FaPercent, FaMoneyBillWave,
  FaCheckCircle
} from 'react-icons/fa';
import ReactDOM from 'react-dom';
import 'react-datepicker/dist/react-datepicker.css';

const buildCSS = (isDark) => {
  const bg        = isDark ? '#080d1a' : '#f1f5f9';
  const surface   = isDark ? '#0d1526' : '#ffffff';
  const surface2  = isDark ? '#111d30' : '#f8fafc';
  const border    = isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0';
  const border2   = isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9';
  const text      = isDark ? '#e2e8f0' : '#0f172a';
  const textSec   = isDark ? '#64748b' : '#64748b';
  const textMuted = isDark ? '#475569' : '#94a3b8';
  const inp       = isDark ? '#111d30' : '#ffffff';
  const inpBdr    = isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0';
  const tblHead   = isDark ? '#0a1220' : '#f8fafc';
  const sticky    = isDark ? 'rgba(8,13,26,.95)' : 'rgba(241,245,249,.95)';
  const sbar      = isDark ? 'rgba(255,255,255,0.04)' : '#ffffff';
  const scrollThumb = isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0';

  return `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');
  .nso-root*,.nso-root *::before,.nso-root *::after{box-sizing:border-box;}
  .nso-root{font-family:'DM Sans',sans-serif;color:${text};background:${bg};}
  .nso-root input,.nso-root select,.nso-root textarea,.nso-root button{font-family:'DM Sans',sans-serif;color:${text};}
  .nso-root input::placeholder,.nso-root textarea::placeholder{color:${textMuted};}
  .nso-root *::-webkit-scrollbar{width:5px;height:5px;}
  .nso-root *::-webkit-scrollbar-track{background:transparent;}
  .nso-root *::-webkit-scrollbar-thumb{background:${scrollThumb};border-radius:99px;}
  @keyframes nsoFadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes nsoSlide{from{opacity:0;transform:translateY(-8px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
  @keyframes nsoSpin{to{transform:rotate(360deg)}}
  @keyframes nsoModal{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}
  .nso-card{animation:nsoFadeUp .3s ease both;}
  .nso-dd{animation:nsoSlide .18s ease both;}
  .nso-inp{width:100%;padding:10px 14px;border:1.5px solid ${inpBdr};border-radius:10px;font-size:13px;color:${text};background:${inp};outline:none;transition:border-color .15s,box-shadow .15s;}
  .nso-inp:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12);}
  .nso-inp:disabled{background:${surface2};color:${textMuted};cursor:not-allowed;}
  .nso-lbl{display:block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${textSec};margin-bottom:6px;}
  .nso-req{color:#ef4444;margin-left:2px;}
  .nso-section{background:${surface};border-radius:16px;border:1.5px solid ${border};overflow:hidden;margin-bottom:16px;box-shadow:${isDark?'0 2px 12px rgba(0,0,0,.3)':'0 1px 4px rgba(0,0,0,.04)'};}
  .nso-sbar{height:3px;}
  .nso-sin{padding:22px 24px;}
  .nso-stitle{font-family:'Sora',sans-serif;font-size:14px;font-weight:700;color:${text};margin:0 0 18px;letter-spacing:-.02em;display:flex;align-items:center;gap:9px;}
  .nso-sicon{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
  .nso-table{width:100%;border-collapse:separate;border-spacing:0;}
  .nso-table thead tr th{padding:11px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${textMuted};background:${tblHead};border-bottom:1.5px solid ${border};text-align:left;white-space:nowrap;}
  .nso-table tbody tr{transition:background .12s;}
  .nso-table tbody tr:hover{background:${surface2};}
  .nso-table tbody tr td{padding:12px 14px;border-bottom:1.5px solid ${border2};vertical-align:middle;}
  .nso-table tbody tr:last-child td{border-bottom:none;}
  .nso-tinp{width:100%;padding:8px 11px;border:1.5px solid ${inpBdr};border-radius:8px;font-size:13px;color:${text};background:${inp};outline:none;transition:border-color .15s,box-shadow .15s;font-family:'DM Sans',sans-serif;}
  .nso-tinp:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.1);}
  .nso-qty{display:flex;align-items:center;}
  .nso-qbtn{width:28px;height:34px;border:1.5px solid ${inpBdr};background:${surface2};color:${textSec};cursor:pointer;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;transition:all .12s;flex-shrink:0;}
  .nso-qbtn:first-child{border-radius:8px 0 0 8px;border-right:none;}
  .nso-qbtn:last-child{border-radius:0 8px 8px 0;border-left:none;}
  .nso-qbtn:hover{background:${isDark?'rgba(255,255,255,0.08)':'#e0e7ef'};color:${text};}
  .nso-qnum{width:44px;height:34px;text-align:center;border:1.5px solid ${inpBdr};border-left:none;border-right:none;font-size:13px;font-weight:600;color:${text};background:${inp};outline:none;font-family:'DM Mono',monospace;}
  .nso-amt{font-family:'DM Mono',monospace;font-size:13px;font-weight:700;color:${text};white-space:nowrap;padding:8px 12px;background:${surface2};border:1.5px solid ${border};border-radius:8px;min-width:110px;text-align:right;display:inline-block;}
  .nso-dtype{padding:8px 10px;border:1.5px solid ${inpBdr};border-radius:8px 0 0 8px;border-right:none;background:${surface2};color:${textSec};cursor:pointer;font-size:11px;font-weight:700;white-space:nowrap;transition:all .12s;display:flex;align-items:center;gap:4px;}
  .nso-dtype:hover{background:${isDark?'rgba(59,130,246,0.15)':'#eff6ff'};color:#3b82f6;border-color:#3b82f6;}
  .nso-dinp{flex:1;min-width:60px;padding:8px 10px;border:1.5px solid ${inpBdr};border-radius:0 8px 8px 0;font-size:13px;color:${text};background:${inp};outline:none;transition:border-color .15s,box-shadow .15s;font-family:'DM Mono',monospace;}
  .nso-dinp:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.1);}
  .nso-srow{display:flex;justify-content:space-between;align-items:center;padding:10px 0;}
  .nso-srow+.nso-srow{border-top:1px solid ${border2};}
  .nso-bg{padding:10px 20px;border:1.5px solid ${border};border-radius:10px;background:${surface};color:${textSec};font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;font-family:'DM Sans',sans-serif;}
  .nso-bg:hover{background:${surface2};border-color:${isDark?'rgba(255,255,255,0.15)':'#cbd5e1'};color:${text};}
  .nso-bd{padding:10px 20px;border:1.5px solid ${border};border-radius:10px;background:${surface2};color:${textSec};font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;font-family:'DM Sans',sans-serif;}
  .nso-bd:hover:not(:disabled){background:${isDark?'rgba(255,255,255,0.08)':'#e0e7ef'};color:${text};}
  .nso-bd:disabled{opacity:.45;cursor:not-allowed;}
  .nso-bp{padding:10px 24px;border:none;border-radius:10px;background:#3b82f6;color:#fff;font-size:13px;font-weight:700;cursor:pointer;transition:all .18s cubic-bezier(.34,1.56,.64,1);font-family:'DM Sans',sans-serif;box-shadow:0 4px 12px rgba(59,130,246,.3);display:flex;align-items:center;gap:7px;}
  .nso-bp:hover:not(:disabled){background:#2563eb;box-shadow:0 8px 20px rgba(59,130,246,.4);transform:translateY(-1px);}
  .nso-bp:active:not(:disabled){transform:scale(.98);}
  .nso-bp:disabled{opacity:.45;cursor:not-allowed;box-shadow:none;}
  .nso-addrow{display:inline-flex;align-items:center;gap:7px;padding:9px 16px;border:1.5px dashed #3b82f6;border-radius:10px;background:${isDark?'rgba(59,130,246,0.1)':'#eff6ff'};color:#3b82f6;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s;font-family:'DM Sans',sans-serif;}
  .nso-addrow:hover{background:${isDark?'rgba(59,130,246,0.18)':'#dbeafe'};border-color:#2563eb;color:#2563eb;}
  .nso-chip{margin-top:8px;padding:12px 16px;background:${isDark?'rgba(59,130,246,0.1)':'linear-gradient(135deg,#eff6ff,#f0fdf4)'};border:1.5px solid ${isDark?'rgba(59,130,246,0.25)':'#bfdbfe'};border-radius:12px;animation:nsoFadeUp .2s ease both;}
  .nso-fchip{display:flex;align-items:center;gap:10px;padding:10px 14px;background:${surface2};border:1.5px solid ${border};border-radius:10px;transition:border-color .15s;}
  .nso-fchip:hover{border-color:#3b82f6;}
  .nso-idd{background:${surface};border:1.5px solid ${border};border-radius:14px;box-shadow:${isDark?'0 20px 60px rgba(0,0,0,.5)':'0 20px 60px rgba(0,0,0,.12)'};max-height:380px;overflow-y:auto;}
  .nso-irow{padding:11px 14px;cursor:pointer;border-bottom:1px solid ${border2};transition:background .1s;display:flex;gap:12px;align-items:flex-start;}
  .nso-irow:last-child{border-bottom:none;}
  .nso-irow:hover{background:${isDark?'rgba(59,130,246,0.08)':'#eff6ff'};}
  .nso-sticky{position:sticky;top:0;z-index:30;background:${sticky};backdrop-filter:blur(12px);padding:12px 0;margin-bottom:20px;}
  .nso-bottombar{position:fixed;bottom:0;left:220px;right:0;z-index:20;background:${isDark?'rgba(8,13,26,.97)':'rgba(255,255,255,.97)'};backdrop-filter:blur(14px);border-top:1.5px solid ${border};padding:14px 32px;display:flex;align-items:center;justify-content:space-between;box-shadow:${isDark?'0 -8px 32px rgba(0,0,0,.4)':'0 -8px 32px rgba(0,0,0,.06)'};}
  .react-datepicker{font-family:'DM Sans',sans-serif!important;border:1.5px solid ${border}!important;border-radius:14px!important;box-shadow:${isDark?'0 20px 40px rgba(0,0,0,.5)':'0 20px 40px rgba(0,0,0,.12)'}!important;background:${surface}!important;}
  .react-datepicker__header{background:${surface2}!important;border-bottom:1.5px solid ${border}!important;border-radius:14px 14px 0 0!important;padding-top:14px!important;}
  .react-datepicker__current-month{font-size:14px!important;font-weight:700!important;color:${text}!important;font-family:'Sora',sans-serif!important;}
  .react-datepicker__day-name{color:${textMuted}!important;font-weight:600!important;font-size:11px!important;}
  .react-datepicker__day{width:2.2rem!important;height:2.2rem!important;line-height:2.2rem!important;border-radius:8px!important;font-size:13px!important;transition:all .12s!important;color:${text}!important;}
  .react-datepicker__day:hover{background:${isDark?'rgba(59,130,246,0.2)':'#eff6ff'}!important;color:#3b82f6!important;}
  .react-datepicker__day--selected{background:#3b82f6!important;color:#fff!important;font-weight:700!important;box-shadow:0 2px 8px rgba(59,130,246,.3)!important;}
  .react-datepicker__day--today{background:${isDark?'rgba(59,130,246,0.15)':'#dbeafe'}!important;color:#2563eb!important;font-weight:700!important;}
  .react-datepicker__day--outside-month{color:${textMuted}!important;}
  `;
};

/* ── Field ── */
const Field = ({ label, req, children, hint }) => {
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);
  return (<div>
    <label className="nso-lbl">{label}{req && <span className="nso-req">*</span>}
      {hint && <span style={{marginLeft:6,fontWeight:400,textTransform:'none',letterSpacing:0,fontSize:10,color:T.textSec,fontStyle:'italic'}}>{hint}</span>}
    </label>
    {children}
  </div>);
};

/* ── PortalSelect — matches customer dropdown style ── */
const Sel = ({ value, onChange, required, options=[], placeholder='Select…', icon=null }) => {
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);
  const [open,setOpen]=useState(false);
  const triggerRef=useRef(null);
  const portalRef=useRef(null);
  const [pos,setPos]=useState({top:0,left:0,width:0});

  const selected=options.find(o=>o.value===value)||null;

  const updatePos=()=>{
    if(triggerRef.current){
      const r=triggerRef.current.getBoundingClientRect();
      setPos({top:r.bottom,left:r.left,width:r.width});
    }
  };
  useEffect(()=>{if(open)updatePos();},[open]);
  useEffect(()=>{
    const h=e=>{
      if(!triggerRef.current?.contains(e.target)&&!portalRef.current?.contains(e.target))setOpen(false);
    };
    // Close on external scroll only (not scrolling inside the dropdown itself)
    const onScroll=(e)=>{if(open&&!portalRef.current?.contains(e.target))setOpen(false);};
    document.addEventListener('mousedown',h);
    window.addEventListener('scroll',onScroll,true);
    return()=>{document.removeEventListener('mousedown',h);window.removeEventListener('scroll',onScroll,true);};
  },[open]);

  const handleSelect=(opt)=>{
    onChange({target:{value:opt.value}});
    setOpen(false);
  };

  return (
    <div style={{position:'relative'}}>
      {/* Trigger */}
      <button type="button" ref={triggerRef} onClick={()=>setOpen(!open)}
        style={{
          width:'100%',padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,
          border:`1.5px solid ${open?'#3b82f6':selected?'#3b82f6':T.border}`,
          borderRadius:10,background:selected?(isDark?'rgba(59,130,246,0.15)':'#eff6ff'):T.surface,
          cursor:'pointer',fontSize:13,transition:'all .15s',
          boxShadow:open?'0 0 0 3px rgba(59,130,246,.12)':'none',
          fontFamily:"'DM Sans',sans-serif",
        }}>
        <div style={{display:'flex',alignItems:'center',gap:9,minWidth:0}}>
          {icon && <div style={{width:24,height:24,borderRadius:7,background:selected?(isDark?'rgba(59,130,246,0.2)':'#dbeafe'):(isDark?'rgba(255,255,255,0.07)':'#f1f5f9'),color:selected?'#2563eb':T.textSec,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,flexShrink:0,transition:'all .15s'}}>{icon}</div>}
          <span style={{color:selected?T.textPri:T.textSec,fontWeight:selected?600:400,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            {selected?selected.label:placeholder}
          </span>
        </div>
        <svg style={{flexShrink:0,transition:'transform .2s',transform:open?'rotate(180deg)':'rotate(0deg)',color:open?'#3b82f6':'#94a3b8'}}
          width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {/* Portal dropdown */}
      {open && ReactDOM.createPortal(
        <div ref={portalRef} className="nso-dd" style={{
          position:'fixed',zIndex:9996,top:pos.top+4,left:pos.left,width:Math.max(pos.width,240),
          background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:14,
          boxShadow:'0 24px 64px rgba(0,0,0,.14)',maxHeight:320,display:'flex',flexDirection:'column',overflow:'hidden',
        }}>
          {/* Header */}
          <div style={{padding:'8px 12px 8px',borderBottom:`1.5px solid ${T.border}`,background:T.surface2}}>
            <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.07em',color:T.textSec}}>
              {options.length} option{options.length!==1?'s':''}
            </div>
          </div>
          {/* Options */}
          <div style={{overflowY:'auto',flex:1,maxHeight:240,WebkitOverflowScrolling:'touch'}}>
          {options.map((opt,i)=>{
            const isActive=opt.value===value;
            const colors=[['#eff6ff','#2563eb'],['#fdf4ff','#9333ea'],['#f0fdf4','#16a34a'],['#fff7ed','#ea580c'],['#fef2f2','#dc2626']];
            const [bg,fg]=colors[i%5];
            return (
              <div key={opt.value} onClick={()=>handleSelect(opt)}
                style={{padding:'10px 14px',cursor:'pointer',borderBottom:`1px solid ${T.border}`,
                  background:isActive?(isDark?'rgba(59,130,246,0.15)':'#eff6ff'):T.surface,display:'flex',gap:10,alignItems:'center',transition:'background .1s'}}
                onMouseEnter={e=>{if(!isActive)e.currentTarget.style.background=T.surface2;}}
                onMouseLeave={e=>{if(!isActive)e.currentTarget.style.background=T.surface;}}>
                {/* Color dot */}
                <div style={{width:32,height:32,borderRadius:9,background:isActive?'#dbeafe':bg,color:isActive?'#2563eb':fg,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:12,flexShrink:0,border:`1.5px solid ${isActive?'#bfdbfe':fg+'22'}`,transition:'all .15s'}}>
                  {opt.label.charAt(0).toUpperCase()}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:isActive?700:500,color:isActive?T.blue:T.textPri,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {opt.label}
                  </div>
                  {opt.sub && <div style={{fontSize:10,color:T.textSec,marginTop:1}}>{opt.sub}</div>}
                </div>
                {isActive && (
                  <div style={{width:20,height:20,borderRadius:6,background:'#3b82f6',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

/* ── Section ── */
const Section = ({ title, icon, accent='#3b82f6', children }) => (
  <div className="nso-section nso-card">
    <div className="nso-sbar" style={{background:`linear-gradient(90deg,${accent},transparent 80%)`}}/>
    <div className="nso-sin">
      <div className="nso-stitle">
        <div className="nso-sicon" style={{background:`${accent}18`,color:accent}}>{icon}</div>
        {title}
      </div>
      {children}
    </div>
  </div>
);

/* ── Toaster ── */
const Toaster = ({ message, type='info', onConfirm, onCancel, isVisible }) => {
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);
  if (!isVisible) return null;
  const cfg={warning:{icon:'⚠️',btnBg:'#ef4444',btnLabel:'Yes, Cancel Order'},info:{icon:'ℹ️',btnBg:'#3b82f6',btnLabel:'OK'},error:{icon:'❌',btnBg:'#ef4444',btnLabel:'OK'},success:{icon:'✅',btnBg:'#10b981',btnLabel:'OK'}}[type];
  return ReactDOM.createPortal(
    <div style={{position:'fixed',inset:0,zIndex:10000,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(15,23,42,.55)',backdropFilter:'blur(8px)'}}>
      <div style={{background:T.surface,borderRadius:20,padding:'32px 36px',width:380,textAlign:'center',boxShadow:'0 40px 80px rgba(0,0,0,.3)',border:`1.5px solid ${T.border}`,animation:'nsoModal .2s ease both'}}>
        <div style={{fontSize:36,marginBottom:14}}>{cfg.icon}</div>
        <h3 style={{fontFamily:"'Sora',sans-serif",fontSize:18,fontWeight:700,color:T.textPri,margin:'0 0 10px'}}>{type==='warning'?'Cancel this order?':'Notification'}</h3>
        <p style={{fontSize:13,color:T.textSec,margin:'0 0 24px',lineHeight:1.6}}>{message}</p>
        <div style={{display:'flex',gap:10}}>
          {onCancel&&<button onClick={onCancel} style={{flex:1,padding:11,background:T.surface2,color:T.textSec,border:`1.5px solid ${T.border}`,borderRadius:12,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Keep Editing</button>}
          <button onClick={onConfirm} style={{flex:1,padding:11,background:cfg.btnBg,color:'#fff',border:'none',borderRadius:12,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>{cfg.btnLabel}</button>
        </div>
      </div>
    </div>, document.body
  );
};

/* ── SuccessToaster ── */
const SuccessToaster = ({ message, isVisible, onClose }) => {
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);
  const [ex,setEx]=useState(false);
  useEffect(()=>{
    if(isVisible){const t=setTimeout(()=>{setEx(true);setTimeout(()=>{onClose?.();setEx(false);},300);},3000);return()=>clearTimeout(t);}
  },[isVisible,onClose]);
  if(!isVisible&&!ex)return null;
  return ReactDOM.createPortal(
    <div style={{position:'fixed',top:20,right:20,zIndex:10001,transition:'all .3s',opacity:ex?0:1,transform:ex?'translateX(120%)':'translateX(0)'}}>
      <div style={{background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:14,padding:'14px 18px',display:'flex',alignItems:'center',gap:12,minWidth:320,boxShadow:'0 20px 40px rgba(0,0,0,.12)'}}>
        <div style={{width:32,height:32,borderRadius:10,background:'#dcfce7',color:'#10b981',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:14}}>✓</div>
        <p style={{flex:1,fontSize:13,fontWeight:600,color:T.textPri,margin:0}}>{message}</p>
        <button onClick={()=>{setEx(true);setTimeout(()=>{onClose?.();setEx(false);},300);}} style={{color:T.textSec,background:'none',border:'none',cursor:'pointer',padding:2,fontSize:14}}>✕</button>
      </div>
    </div>, document.body
  );
};

/* ── DropdownPortal — fixed so it escapes overflow:hidden sections ── */
const DropdownPortal = ({ children, targetRef, isVisible }) => {
  const [pos,setPos]=useState({top:0,left:0,width:0});
  useEffect(()=>{
    // Capture position once when shown
    if(targetRef?.current&&isVisible){const r=targetRef.current.getBoundingClientRect();setPos({top:r.bottom,left:r.left,width:r.width});}
    // No scroll listener — portal stays locked at captured position
  },[targetRef,isVisible]);
  if(!children||!isVisible)return null;
  return ReactDOM.createPortal(
    <div style={{position:'fixed',zIndex:9999,top:pos.top+4,left:pos.left,width:Math.max(pos.width,480)}}>
      {children}
    </div>,
    document.body
  );
};

/* ── DatePicker — portal-based so it escapes overflow:hidden ── */
const ModernDatePicker = ({ value, onChange, label, required=false, placeholder='Select date' }) => {
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);
  const [open,setOpen]=useState(false);
  const [mode,setMode]=useState('calendar');
  const triggerRef=useRef(null);
  const portalRef=useRef(null);
  const [pos,setPos]=useState({top:0,left:0,width:0});
  const presets=[
    {label:'Today',value:new Date()},{label:'Tomorrow',value:addDays(new Date(),1)},
    {label:'Next Week',value:addDays(new Date(),7)},{label:'Next Month',value:addMonths(new Date(),1)},
    {label:'3 Months',value:addMonths(new Date(),3)},{label:'6 Months',value:addMonths(new Date(),6)},
    {label:'1 Year',value:addYears(new Date(),1)},
  ];
  const sel=value?new Date(value):null;

  const updatePos=()=>{
    if(triggerRef.current){
      const r=triggerRef.current.getBoundingClientRect();
      setPos({top:r.bottom,left:r.left,width:r.width});
    }
  };

  useEffect(()=>{
    if(open)updatePos();
  },[open]);

  useEffect(()=>{
    const h=e=>{
      const inTrigger=triggerRef.current?.contains(e.target);
      const inPortal=portalRef.current?.contains(e.target);
      if(!inTrigger&&!inPortal)setOpen(false);
    };
    // Close on external scroll only
    const onScroll=(e)=>{if(open&&!portalRef.current?.contains(e.target))setOpen(false);};
    document.addEventListener('mousedown',h);
    window.addEventListener('scroll',onScroll,true);
    return()=>{document.removeEventListener('mousedown',h);window.removeEventListener('scroll',onScroll,true);};
  },[open]);

  const pickerPanel = open ? ReactDOM.createPortal(
    <div ref={portalRef} className="nso-dd" style={{
      position:'fixed',zIndex:9998,top:pos.top+6,left:pos.left,
      background:T.surface,borderRadius:16,border:`1.5px solid ${T.border}`,
      boxShadow:'0 24px 60px rgba(0,0,0,.14)',width:Math.max(pos.width,340),
      overflow:'hidden',
    }}>
      {/* Tab header */}
      <div style={{display:'flex',gap:0,borderBottom:`1.5px solid ${T.border}`,background:T.surface2}}>
        {[['calendar','calendar'],['presets','quick']].map(([v,l])=>(
          <button key={v} onClick={()=>setMode(v)} style={{
            flex:1,padding:'12px 8px',fontSize:12,fontWeight:700,
            border:'none',cursor:'pointer',transition:'all .15s',
            background:'transparent',
            color:mode===v?'#2563eb':'#94a3b8',
            borderBottom:mode===v?'2px solid #3b82f6':'2px solid transparent',
            display:'flex',alignItems:'center',justifyContent:'center',gap:6,
          }}>
            {v==='calendar'
              ? <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x={3} y={4} width={18} height={18} rx={3}/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
              : <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            }
            {l.charAt(0).toUpperCase()+l.slice(1)}
          </button>
        ))}
      </div>

      <div style={{padding:'14px 14px 10px'}}>
        {mode==='calendar' ? (
          <DatePicker selected={sel} onChange={d=>{onChange(d.toISOString().split('T')[0]);setOpen(false);setMode('calendar');}} inline
            renderCustomHeader={({date,decreaseMonth,increaseMonth,prevMonthButtonDisabled,nextMonthButtonDisabled})=>(
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,padding:'0 2px'}}>
                <button onClick={decreaseMonth} disabled={prevMonthButtonDisabled}
                  style={{width:28,height:28,borderRadius:8,border:`1.5px solid ${T.border}`,background:T.surface,cursor:'pointer',color:T.textSec,display:'flex',alignItems:'center',justifyContent:'center',transition:'all .12s'}}
                  onMouseEnter={e=>{e.currentTarget.style.background=isDark?'rgba(59,130,246,0.1)':'#eff6ff';e.currentTarget.style.borderColor='#3b82f6';}}
                  onMouseLeave={e=>{e.currentTarget.style.background='#fff';e.currentTarget.style.borderColor='#e2e8f0';}}>
                  <FaChevronLeft style={{fontSize:10}}/>
                </button>
                <span style={{fontFamily:"'Sora',sans-serif",fontWeight:800,fontSize:14,color:T.textPri,letterSpacing:'-.01em'}}>
                  {format(date,'MMMM yyyy')}
                </span>
                <button onClick={increaseMonth} disabled={nextMonthButtonDisabled}
                  style={{width:28,height:28,borderRadius:8,border:`1.5px solid ${T.border}`,background:T.surface,cursor:'pointer',color:T.textSec,display:'flex',alignItems:'center',justifyContent:'center',transition:'all .12s'}}
                  onMouseEnter={e=>{e.currentTarget.style.background=isDark?'rgba(59,130,246,0.1)':'#eff6ff';e.currentTarget.style.borderColor='#3b82f6';}}
                  onMouseLeave={e=>{e.currentTarget.style.background='#fff';e.currentTarget.style.borderColor='#e2e8f0';}}>
                  <FaChevronRight style={{fontSize:10}}/>
                </button>
              </div>
            )}
          />
        ) : (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
            {presets.map(p=>{
              const active=sel&&isSameDay(sel,p.value);
              return (
                <button key={p.label} onClick={()=>{onChange(p.value.toISOString().split('T')[0]);setOpen(false);setMode('calendar');}}
                  style={{padding:'10px 12px',borderRadius:10,textAlign:'left',cursor:'pointer',transition:'all .15s',
                    border:`1.5px solid ${active?'#3b82f6':'#e2e8f0'}`,
                    background:active?'#eff6ff':'#fff',
                  }}
                  onMouseEnter={e=>{if(!active){e.currentTarget.style.background='#f8fafc';e.currentTarget.style.borderColor='#bfdbfe';}}}
                  onMouseLeave={e=>{if(!active){e.currentTarget.style.background='#fff';e.currentTarget.style.borderColor='#e2e8f0';}}}>
                  <div style={{fontSize:12,fontWeight:700,color:active?'#2563eb':'#0f172a'}}>{p.label}</div>
                  <div style={{fontSize:10,color:T.textSec,marginTop:2,fontFamily:"'DM Mono',monospace"}}>{format(p.value,'MMM dd, yyyy')}</div>
                </button>
              );
            })}
          </div>
        )}

        {sel && (
          <div style={{marginTop:10,padding:'9px 12px',background:isDark?'rgba(16,185,129,0.1)':'linear-gradient(135deg,#f0fdf4,#eff6ff)',borderRadius:10,border:`1.5px solid ${isDark?'rgba(16,185,129,0.3)':'#bbf7d0'}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div>
              <div style={{fontSize:9,color:'#16a34a',fontWeight:800,textTransform:'uppercase',letterSpacing:'.08em'}}>Selected Date</div>
              <div style={{fontSize:13,fontWeight:700,color:T.textPri,marginTop:1,fontFamily:"'DM Sans',sans-serif"}}>{format(sel,'EEE, MMM dd, yyyy')}</div>
            </div>
            <div style={{width:24,height:24,borderRadius:8,background:'#dcfce7',color:'#16a34a',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <FaCheck style={{fontSize:10}}/>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div>
      <label className="nso-lbl">{label}{required&&<span className="nso-req">*</span>}</label>
      <button type="button" ref={triggerRef} onClick={()=>setOpen(!open)} style={{
        width:'100%',padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',
        border:`1.5px solid ${open?'#3b82f6':sel?'#3b82f6':'#e2e8f0'}`,
        borderRadius:10,background:sel?'#eff6ff':'#fff',cursor:'pointer',fontSize:13,transition:'all .15s',
        boxShadow:open?'0 0 0 3px rgba(59,130,246,.12)':'none',
      }}>
        <span style={{color:sel?'#0f172a':'#94a3b8',fontWeight:sel?600:400,fontFamily:"'DM Sans',sans-serif"}}>
          {sel?format(new Date(value),'MMM dd, yyyy'):placeholder}
        </span>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {sel&&(
            <span onClick={e=>{e.stopPropagation();onChange('');setOpen(false);}}
              style={{width:18,height:18,borderRadius:5,background:T.surface2,color:T.textSec,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,cursor:'pointer',transition:'all .12s'}}
              onMouseEnter={e=>{e.currentTarget.style.background='#fee2e2';e.currentTarget.style.color='#ef4444';}}
              onMouseLeave={e=>{e.currentTarget.style.background='#f1f5f9';e.currentTarget.style.color='#94a3b8';}}>✕</span>
          )}
          <div style={{width:28,height:28,borderRadius:8,background:open||sel?'#eff6ff':'#f8fafc',border:`1.5px solid ${open||sel?'#bfdbfe':'#e2e8f0'}`,display:'flex',alignItems:'center',justifyContent:'center',transition:'all .15s'}}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={open||sel?'#3b82f6':'#94a3b8'} strokeWidth={2} strokeLinecap="round"><rect x={3} y={4} width={18} height={18} rx={3}/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          </div>
        </div>
      </button>
      {pickerPanel}
    </div>
  );
};


/* ════════════════════ MAIN ════════════════════════════════════════ */
const Newsalesorders = () => {
  const [items,setItems]=useState([{id:1,itemId:'',details:'',sku:'',quantity:1,rate:'',discount:'',discountType:'percentage',amount:'',unit:''}]);
  const [showItemDropdown,setShowItemDropdown]=useState(null);
  const [searchTerm,setSearchTerm]=useState('');
  const [filteredItems,setFilteredItems]=useState([]);
  const [customerSearch,setCustomerSearch]=useState('');
  const [selectedCustomer,setSelectedCustomer]=useState(null);
  const [showCustomerDropdown,setShowCustomerDropdown]=useState(false);
  const [custDropPos,setCustDropPos]=useState({top:0,left:0,width:360});
  const [filteredCustomers,setFilteredCustomers]=useState([]);
  const [salesType,setSalesType]=useState('SO');
  const [orderDate,setOrderDate]=useState('');
  const [lpoDate,setLpoDate]=useState('');
  const [lpoNumber,setLpoNumber]=useState('');
  const [lpoValue,setLpoValue]=useState('');
  const [expectedShipmentDate,setExpectedShipmentDate]=useState('');
  const [paymentTerms,setPaymentTerms]=useState('due_on_receipt');
  const [salesperson,setSalesperson]=useState('');
  const [orderNumber,setOrderNumber]=useState('');
  const [shippingCharges,setShippingCharges]=useState('0');
  const [adjustment,setAdjustment]=useState('0');
  const [customerNotes,setCustomerNotes]=useState('');
  const [termsAndConditions,setTermsAndConditions]=useState('');
  const [attachedFiles,setAttachedFiles]=useState([]);
  const [showCancelToaster,setShowCancelToaster]=useState(false);
  const [showSuccessToaster,setShowSuccessToaster]=useState(false);
  const [successMessage,setSuccessMessage]=useState('');

  const {handleGetItem,data:inventoryData,loading:inventoryLoading}=useGetItem();
  const {handleGetCustomers,data:customersData,loading:customersLoading}=useGetCustomers();
  const {handleAddSalesOrder,loading:addSalesOrderLoading}=useAddSalesOrder();
  const itemInputRefs=useRef([]);
  const customerDropdownRef=useRef(null);
  const fileInputRef=useRef(null);
  const navigate=useNavigate();

  const salesTypeOptions=[{value:'SO',label:'SO — Standard Sale Order'},{value:'MOA',label:'MOA — Material on Approval'},{value:'MOA_COLLECT',label:'MOA Collect — Material on Approval Collect'},{value:'FREE_DELIVERY',label:'Free Delivery'}];
  const paymentTermsOptions=[{value:'due_on_receipt',label:'Due on Receipt'},{value:'net_15',label:'Net 15'},{value:'net_30',label:'Net 30'},{value:'net_60',label:'Net 60'}];
  const salespersonOptions=[{value:'john_doe',label:'John Doe'},{value:'jane_smith',label:'Jane Smith'},{value:'mike_johnson',label:'Mike Johnson'}];

  // Calculate final line amount after discount
  const calcAmt=(q,r,d=0,dt='percentage')=>{
    const qty=parseFloat(q)||0,rte=parseFloat(r)||0,dis=parseFloat(d)||0,base=qty*rte;
    if(base<=0)return '0.00';
    const finalAmt=dt==='percentage'?(base-base*(dis/100)):(base-dis);
    return Math.max(0,finalAmt).toFixed(2);
  };
  // Returns AED discount amount (for display in the amount cell)
  const calcDiscountAED=(q,r,d=0,dt='percentage')=>{
    const qty=parseFloat(q)||0,rte=parseFloat(r)||0,dis=parseFloat(d)||0,base=qty*rte;
    if(base<=0||dis<=0)return null;
    const discAED=dt==='percentage'?base*(dis/100):dis;
    return Math.min(base,discAED).toFixed(2);
  };
  // Sum of all discounts in AED (for summary)
  const calcTotalDiscountAED=()=>items.reduce((t,i)=>{
    const d=calcDiscountAED(i.quantity,i.rate,i.discount,i.discountType);
    return t+(parseFloat(d)||0);
  },0);
  const calcSub=()=>items.reduce((t,i)=>t+(parseFloat(i.amount)||0),0);
  const calcVAT=()=>calcSub()*0.05;
  const calcTotal=()=>calcSub()+calcVAT()+(parseFloat(shippingCharges)||0)+(parseFloat(adjustment)||0);

  useEffect(()=>{
    setOrderDate(new Date().toISOString().split('T')[0]);
    const d=new Date(),m=(d.getMonth()+1).toString().padStart(2,'0'),y=d.getFullYear();
    setOrderNumber(`SO-${y}${m}-${Math.floor(Math.random()*1000).toString().padStart(3,'0')}`);
  },[]);
  useEffect(()=>{handleGetItem();handleGetCustomers();},[]);
  useEffect(()=>{
    if(!inventoryData)return;
    setFilteredItems(!searchTerm?inventoryData.slice(0,10):inventoryData.filter(i=>i.name?.toLowerCase().includes(searchTerm.toLowerCase())||i._id?.toString().includes(searchTerm)||i.item_code?.toLowerCase().includes(searchTerm.toLowerCase())||i.sku?.toLowerCase().includes(searchTerm.toLowerCase())).slice(0,10));
  },[searchTerm,inventoryData]);
  useEffect(()=>{
    if(!customersData)return;
    setFilteredCustomers(!customerSearch?customersData:customersData.filter(c=>c.customerDisplayName?.toLowerCase().includes(customerSearch.toLowerCase())||c.companyName?.toLowerCase().includes(customerSearch.toLowerCase())||c.customerEmail?.toLowerCase().includes(customerSearch.toLowerCase())||c.customerPhone?.includes(customerSearch)||c.customerCode?.toLowerCase().includes(customerSearch.toLowerCase())).slice(0,10));
  },[customerSearch,customersData]);
  useEffect(()=>{
    const h=e=>{
      if(showItemDropdown!==null){const onI=itemInputRefs.current[showItemDropdown]?.contains(e.target),onD=document.querySelector('.item-dropdown-container')?.contains(e.target);if(!onI&&!onD)setShowItemDropdown(null);}
      if(showCustomerDropdown){
        const inRef=customerDropdownRef.current?.contains(e.target);
        const inPortal=document.querySelector('.nso-dd')?.contains(e.target);
        if(!inRef&&!inPortal)setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h);
  },[showItemDropdown,showCustomerDropdown]);

  // Close customer dropdown on page scroll, but ignore scrolls inside the dropdown itself
  const custPortalRef = useRef(null);
  useEffect(()=>{
    if(!showCustomerDropdown)return;
    const close=(e)=>{
      // If scroll happened inside the dropdown portal, don't close
      if(custPortalRef.current?.contains(e.target))return;
      setShowCustomerDropdown(false);
    };
    window.addEventListener('scroll',close,true);
    return()=>window.removeEventListener('scroll',close,true);
  },[showCustomerDropdown]);


  const handleCustomerSelect=c=>{setSelectedCustomer(c);setCustomerSearch(`${c.customerCode} - ${c.customerDisplayName}${c.companyName?` (${c.companyName})`:''}`);setShowCustomerDropdown(false);};
  const addNewRow=()=>{const id=items.length>0?Math.max(...items.map(i=>i.id))+1:1;setItems([...items,{id,itemId:'',details:'',sku:'',quantity:1,rate:'',discount:'',discountType:'percentage',amount:'',unit:''}]);};
  const handleRemoveItem=idx=>{
    if(items.length<=1){const u=[...items];u[idx]={id:u[idx].id,itemId:'',details:'',sku:'',quantity:1,rate:'',discount:'',discountType:'percentage',amount:'',unit:''};setItems(u);return;}
    setItems(items.filter((_,i)=>i!==idx));if(showItemDropdown===idx)setShowItemDropdown(null);
  };
  const handleItemSelect=(idx,sel)=>{const u=[...items],rate=sel.selling_price||sel.price||0,qty=1;u[idx]={...u[idx],itemId:sel._id||sel.itemId,details:sel.name||sel.itemName||'No name',sku:sel.sku||'No SKU',rate,unit:sel.unit||sel.Unit||'pcs',quantity:qty,amount:calcAmt(qty,rate,u[idx].discount,u[idx].discountType)};setItems(u);setShowItemDropdown(null);setSearchTerm('');};
  const handleQuantityChange=(idx,val)=>{const u=[...items],qty=parseFloat(val)||1;u[idx].quantity=qty;if(u[idx].rate)u[idx].amount=calcAmt(qty,u[idx].rate,u[idx].discount,u[idx].discountType);setItems(u);};
  const handleRateChange=(idx,val)=>{const u=[...items],rate=parseFloat(val)||0;u[idx].rate=rate;if(u[idx].quantity)u[idx].amount=calcAmt(u[idx].quantity,rate,u[idx].discount,u[idx].discountType);setItems(u);};
  const handleDiscountChange=(idx,val)=>{const u=[...items];u[idx].discount=val;if(u[idx].quantity&&u[idx].rate)u[idx].amount=calcAmt(u[idx].quantity,u[idx].rate,val,u[idx].discountType);setItems(u);};
  const handleDiscountTypeChange=(idx,type)=>{const u=[...items];u[idx].discountType=type;if(u[idx].quantity&&u[idx].rate&&u[idx].discount)u[idx].amount=calcAmt(u[idx].quantity,u[idx].rate,u[idx].discount,type);setItems(u);};
  const handleFileUpload=e=>{const files=Array.from(e.target.files);if(attachedFiles.length+files.length>10){setSuccessMessage('Maximum 10 files allowed');setShowSuccessToaster(true);return;}setAttachedFiles([...attachedFiles,...files.map(f=>({id:Date.now()+Math.random(),name:f.name,size:(f.size/1024/1024).toFixed(2),type:f.type,file:f}))]);};
  const handleRemoveFile=id=>setAttachedFiles(attachedFiles.filter(f=>f.id!==id));
  const handleCancel=()=>setShowCancelToaster(true);
  const confirmCancel=()=>{setShowCancelToaster(false);navigate('/sales/salesorders');};
  const cancelCancel=()=>setShowCancelToaster(false);

  const prepareSalesOrderData=status=>{
    const sub=calcSub(),vat=calcVAT(),ship=parseFloat(shippingCharges)||0,adj=parseFloat(adjustment)||0,total=sub+vat+ship+adj;
    const apiItems=items.filter(i=>i.details&&i.quantity>0).map(i=>{
      const qty=parseFloat(i.quantity)||0;
      const rate=parseFloat(i.rate)||0;
      const discVal=parseFloat(i.discount)||0;
      const dt=i.discountType||'percentage';
      const base=qty*rate;
      const discountAED=dt==='percentage'?parseFloat((base*(discVal/100)).toFixed(2)):discVal;
      const amount=parseFloat(i.amount)||0;
      return {
        itemId:i.itemId,
        name:i.details,
        sku:i.sku||'',
        quantity:qty,
        rate:rate,
        discount:discVal,
        discountType:dt,
        discountUnit:dt==='percentage'?'%':'AED',
        discountAED:discountAED,
        amount:amount,
        unit:i.unit||'pcs',
      };
    });
    if(apiItems.length===0)throw new Error('Please add at least one item to the sales order');
    if(!selectedCustomer)throw new Error('Please select a customer');
    if(!lpoNumber.trim())throw new Error('LPO Number is required');
    return {orderNumber,customerId:selectedCustomer._id,customerName:selectedCustomer.customerDisplayName,customerCode:selectedCustomer.customerCode,salesType,orderDate:orderDate?new Date(orderDate).toISOString():new Date().toISOString(),lpoNumber,lpoDate:lpoDate?new Date(lpoDate).toISOString():null,lpoValue:parseFloat(lpoValue)||0,expectedShipmentDate:expectedShipmentDate?new Date(expectedShipmentDate).toISOString():null,paymentTerms,salesperson,items:apiItems,shippingCharges:ship,adjustment:adj,customerNotes,termsAndConditions,attachments:attachedFiles.map(f=>({name:f.name,size:f.size,type:f.type,url:URL.createObjectURL(f.file)})),status,subTotal:sub,vat,total,createdBy:'current_user_id'};
  };
  const handleSaveAsDraft=async()=>{try{const d=prepareSalesOrderData('draft'),r=await handleAddSalesOrder(d);if(r?.data?.id){setSuccessMessage('Saved as draft!');setShowSuccessToaster(true);setTimeout(()=>navigate(`/sales/salesorders/${r.data.id}`),1500);}}catch(e){setSuccessMessage(e.message||'Failed to save draft');setShowSuccessToaster(true);}};
  const handleSaveAndSend=async()=>{try{const d=prepareSalesOrderData('open'),r=await handleAddSalesOrder(d);if(r?.data?.id){setSuccessMessage('Sales order created!');setShowSuccessToaster(true);setTimeout(()=>navigate('/sales/salesorders'),1500);}}catch(e){setSuccessMessage(e.message||'Failed. Check required fields.');setShowSuccessToaster(true);}};

  const debouncedSearch=useCallback(debounce(t=>setSearchTerm(t),300),[]);
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);
  const hasItemsAdded=items.some(i=>i.details&&i.quantity>0);

  return (
    <div className="nso-root" style={{minHeight:'100vh',background:T.bg,padding:'20px 20px 90px'}}>
      <style>{buildCSS(isDark)}</style>
      <Toaster message="Are you sure you want to cancel? All unsaved changes will be lost." type="warning" isVisible={showCancelToaster} onConfirm={confirmCancel} onCancel={cancelCancel}/>
      <SuccessToaster message={successMessage} isVisible={showSuccessToaster} onClose={()=>setShowSuccessToaster(false)}/>

      <div style={{maxWidth:1100,margin:'0 auto'}}>

        {/* Top bar */}
        <div className="nso-sticky">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',alignItems:'center',gap:14}}>
              <button onClick={handleCancel} style={{width:36,height:36,borderRadius:10,border:`1.5px solid ${T.border}`,background:T.surface,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:T.textSec}}>
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
              <div style={{width:1,height:24,background:T.border}}/>
              <div>
                <h1 style={{fontFamily:"'Sora',sans-serif",fontSize:18,fontWeight:800,color:T.textPri,margin:0,letterSpacing:'-.02em'}}>New Sales Order</h1>
                <p style={{fontSize:11,color:T.textSec,margin:'2px 0 0',fontFamily:"'DM Mono',monospace"}}>{orderNumber}</p>
              </div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{padding:'5px 12px',borderRadius:99,background:'#fef9c3',border:'1.5px solid #fef08a',fontSize:11,fontWeight:700,color:'#854d0e',letterSpacing:'.04em'}}>● DRAFT</span>
              <button onClick={handleCancel} className="nso-bg">Cancel</button>
              <button onClick={handleSaveAsDraft} className="nso-bd" disabled={addSalesOrderLoading||!selectedCustomer||!hasItemsAdded}>{addSalesOrderLoading?'Saving…':'Save Draft'}</button>
              <button onClick={handleSaveAndSend} className="nso-bp" disabled={addSalesOrderLoading||!selectedCustomer||!hasItemsAdded||!lpoNumber.trim()}>
                {addSalesOrderLoading?<><div style={{width:13,height:13,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'nsoSpin .7s linear infinite'}}/>Processing…</>:<><svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>Save & Send</>}
              </button>
            </div>
          </div>
        </div>

        {/* Section 1 — Order Info */}
        <Section title="Order Information" icon="📋" accent="#3b82f6">
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18,marginBottom:18}}>
            {/* Customer — portal dropdown */}
            <div>
              <Field label="Customer Name" req>
                <div style={{position:'relative'}} ref={customerDropdownRef}>
                  <div style={{position:'relative'}}>
                    <FaSearch style={{position:'absolute',left:13,top:'50%',transform:'translateY(-50%)',color:T.textSec,fontSize:12,pointerEvents:'none',zIndex:1}}/>
                    <input type="text" value={customerSearch}
                      onChange={e=>{setCustomerSearch(e.target.value);setShowCustomerDropdown(true);}}
                      onFocus={()=>{
                        const r=customerDropdownRef.current?.getBoundingClientRect();
                        if(r) setCustDropPos({top:r.bottom+4,left:r.left,width:Math.max(r.width,360)});
                        setShowCustomerDropdown(true);
                      }}
                      className="nso-inp"
                      placeholder="Search by name, company, email…"
                      style={{paddingLeft:36,paddingRight:40,
                        borderColor:showCustomerDropdown?'#3b82f6':'#e2e8f0',
                        boxShadow:showCustomerDropdown?'0 0 0 3px rgba(59,130,246,.12)':'none'}}
                    />
                    <button onClick={()=>{
                        if(!showCustomerDropdown){
                          const r=customerDropdownRef.current?.getBoundingClientRect();
                          if(r) setCustDropPos({top:r.bottom+4,left:r.left,width:Math.max(r.width,360)});
                        }
                        setShowCustomerDropdown(!showCustomerDropdown);
                      }}
                      style={{position:'absolute',right:10,top:'50%',transform:`translateY(-50%) rotate(${showCustomerDropdown?180:0}deg)`,background:'none',border:'none',cursor:'pointer',color:T.textSec,padding:4,transition:'transform .2s',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                    </button>
                  </div>
                  {showCustomerDropdown && ReactDOM.createPortal(
                    (
                        <div ref={custPortalRef} className="nso-dd" style={{
                          position:'fixed',zIndex:9997,
                          top:custDropPos.top,left:custDropPos.left,width:custDropPos.width,
                          background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:16,
                          boxShadow:'0 24px 64px rgba(0,0,0,.14)',maxHeight:360,display:'flex',flexDirection:'column',overflow:'hidden'
                        }}>
                          {/* Search input inside dropdown */}
                          <div style={{padding:'10px 12px',borderBottom:`1.5px solid ${T.border}`,background:T.surface2,flexShrink:0}}>
                            <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:T.surface,borderRadius:10,border:`1.5px solid ${T.border}`}}>
                              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2.5} strokeLinecap="round"><circle cx={11} cy={11} r={8}/><path d="m21 21-4.35-4.35"/></svg>
                              <span style={{fontSize:12,color:T.textSec,flex:1}}>{customerSearch||'Type to filter…'}</span>
                              {customersLoading && <div style={{width:12,height:12,border:`2px solid ${T.border}`,borderTopColor:'#3b82f6',borderRadius:'50%',animation:'nsoSpin .7s linear infinite',flexShrink:0}}/>}
                            </div>
                          </div>

                          {/* Results */}
                          <div style={{overflowY:'auto',flex:1,maxHeight:260,WebkitOverflowScrolling:'touch'}}>
                            {customersLoading ? (
                              <div style={{padding:'24px 16px',textAlign:'center',color:T.textSec,fontSize:13}}>
                                <div style={{width:20,height:20,border:`2px solid ${T.border}`,borderTopColor:'#3b82f6',borderRadius:'50%',animation:'nsoSpin .7s linear infinite',margin:'0 auto 10px'}}/>
                                Loading customers…
                              </div>
                            ) : filteredCustomers.length===0 ? (
                              <div style={{padding:'28px 16px',textAlign:'center'}}>
                                <div style={{fontSize:28,marginBottom:8}}>{customerSearch?'🔍':'👥'}</div>
                                <div style={{fontSize:13,fontWeight:600,color:T.textSec}}>{customerSearch?'No customers match':'Start typing to search'}</div>
                                {customerSearch && <div style={{fontSize:11,color:T.textSec,marginTop:4}}>Try a different name, code, or email</div>}
                              </div>
                            ) : (
                              <>
                                <div style={{padding:'7px 14px',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.07em',color:T.textSec,borderBottom:`1px solid ${T.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',background:T.surface2}}>
                                  <span>{filteredCustomers.length} customer{filteredCustomers.length!==1?'s':''}</span>
                                  {selectedCustomer && <span style={{color:'#10b981'}}>✓ {selectedCustomer.customerDisplayName}</span>}
                                </div>
                                {filteredCustomers.map((c,ci)=>{
                                  const isActive=selectedCustomer?._id===c._id;
                                  const initials=c.customerDisplayName?.slice(0,2).toUpperCase()||'??';
                                  const colors=[['#eff6ff','#2563eb'],['#fdf4ff','#9333ea'],['#f0fdf4','#16a34a'],['#fff7ed','#ea580c'],['#fef2f2','#dc2626']];
                                  const [bg,fg]=colors[ci%5];
                                  return (
                                    <div key={c._id||c.id}
                                      onClick={()=>handleCustomerSelect(c)}
                                      style={{padding:'10px 14px',cursor:'pointer',borderBottom:`1px solid ${T.border}`,background:isActive?(isDark?'rgba(59,130,246,0.15)':'#eff6ff'):T.surface,display:'flex',gap:12,alignItems:'center',transition:'background .1s'}}
                                      onMouseEnter={e=>{if(!isActive)e.currentTarget.style.background=T.surface2;}}
                                      onMouseLeave={e=>{if(!isActive)e.currentTarget.style.background=T.surface;}}>
                                      {/* Avatar */}
                                      <div style={{width:36,height:36,borderRadius:10,background:bg,color:fg,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:13,flexShrink:0,letterSpacing:'-.02em',border:`1.5px solid ${fg}22`}}>
                                        {initials}
                                      </div>
                                      <div style={{flex:1,minWidth:0}}>
                                        <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:2}}>
                                          <span style={{fontSize:13,fontWeight:700,color:T.textPri,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.customerDisplayName||'Unnamed'}</span>
                                          <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,padding:'2px 6px',background:bg,color:fg,borderRadius:5,flexShrink:0,border:`1px solid ${fg}33`}}>{c.customerCode||'N/A'}</span>
                                          {isActive && <span style={{fontSize:10,color:'#10b981'}}>✓</span>}
                                        </div>
                                        <div style={{fontSize:11,color:T.textSec,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'flex',gap:8,alignItems:'center'}}>
                                          {c.companyName && <span>🏢 {c.companyName}</span>}
                                          {c.companyName && c.customerEmail && <span style={{color:T.border}}>·</span>}
                                          {c.customerEmail && <span>{c.customerEmail}</span>}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </>
                            )}
                          </div>

                          {/* Add new footer */}
                          <div
                            onClick={()=>{navigate('/sales/customers/newcustomers');setShowCustomerDropdown(false);}}
                            style={{padding:'11px 14px',cursor:'pointer',borderTop:`1.5px solid ${T.border}`,display:'flex',alignItems:'center',gap:10,background:T.surface2,transition:'background .15s',flexShrink:0}}
                            onMouseEnter={e=>e.currentTarget.style.background=isDark?'rgba(59,130,246,0.1)':'#eff6ff'}
                            onMouseLeave={e=>e.currentTarget.style.background=T.surface2}>
                            <div style={{width:28,height:28,borderRadius:8,background:'#3b82f6',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,flexShrink:0}}>+</div>
                            <div>
                              <div style={{fontSize:13,fontWeight:700,color:'#2563eb'}}>Add New Customer</div>
                              <div style={{fontSize:11,color:T.textSec}}>Create a new customer record</div>
                            </div>
                          </div>
                        </div>
                    ),
                    document.body
                  )}
                </div>
              </Field>
              {selectedCustomer&&(
                <div className="nso-chip">
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10}}>
                    <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
                      <div style={{width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,#3b82f6,#6366f1)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:15,flexShrink:0}}>{selectedCustomer.customerDisplayName?.charAt(0)}</div>
                      <div>
                        <div style={{fontSize:13,fontWeight:800,color:T.blue}}>{selectedCustomer.customerDisplayName}</div>
                        <div style={{fontSize:11,color:'#3b82f6',marginTop:2}}>{[selectedCustomer.companyName&&`🏢 ${selectedCustomer.companyName}`,selectedCustomer.customerEmail&&`✉ ${selectedCustomer.customerEmail}`,selectedCustomer.customerPhone&&`📞 ${selectedCustomer.customerPhone}`].filter(Boolean).join('  ·  ')}</div>
                      </div>
                    </div>
                    <button onClick={()=>{setSelectedCustomer(null);setCustomerSearch('');}} style={{fontSize:11,color:'#ef4444',background:'#fef2f2',border:'1.5px solid #fecaca',borderRadius:7,padding:'4px 10px',cursor:'pointer',fontWeight:700,flexShrink:0}}>Clear</button>
                  </div>
                </div>
              )}
            </div>
            {/* Order # */}
            <Field label="Sales Order #" req>
              <input type="text" value={orderNumber} onChange={e=>setOrderNumber(e.target.value)} className="nso-inp" style={{fontFamily:"'DM Mono',monospace",background:T.surface2,color:T.textSec}} readOnly/>
              <p style={{fontSize:11,color:T.textSec,marginTop:5}}>Auto-generated — read only</p>
            </Field>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18,marginBottom:18}}>
            <Field label="Sales Type" req><Sel value={salesType} onChange={e=>setSalesType(e.target.value)} required options={salesTypeOptions} placeholder="Select sales type…" icon="📦"/></Field>
            <ModernDatePicker value={orderDate} onChange={setOrderDate} label="Sales Order Date" required placeholder="Select order date"/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18}}>
            <Field label="Payment Terms" req><Sel value={paymentTerms} onChange={e=>setPaymentTerms(e.target.value)} required options={paymentTermsOptions} placeholder="Select payment terms…" icon="💳"/></Field>
            <Field label="Salesperson" req><Sel value={salesperson} onChange={e=>setSalesperson(e.target.value)} required options={salespersonOptions} placeholder="Select salesperson…" icon="👤"/></Field>
          </div>
        </Section>

        {/* Section 2 — LPO */}
        <Section title="LPO Details" icon="📄" accent="#8b5cf6">
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18,marginBottom:18}}>
            <Field label="LPO Number" req><input type="text" value={lpoNumber} onChange={e=>setLpoNumber(e.target.value)} className="nso-inp" placeholder="LPO-2024-001" style={{fontFamily:"'DM Mono',monospace"}}/></Field>
            <ModernDatePicker value={lpoDate} onChange={setLpoDate} label="LPO Date" placeholder="Select LPO date"/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18}}>
            <Field label="LPO Value (AED)" req>
              <div style={{position:'relative'}}>
                <span style={{position:'absolute',left:13,top:'50%',transform:'translateY(-50%)',fontSize:12,fontWeight:700,color:T.textSec,fontFamily:"'DM Mono',monospace"}}>AED</span>
                <input type="number" value={lpoValue} onChange={e=>setLpoValue(e.target.value)} className="nso-inp" placeholder="0.00" step="0.01" style={{paddingLeft:46,fontFamily:"'DM Mono',monospace"}}/>
              </div>
            </Field>
            <ModernDatePicker value={expectedShipmentDate} onChange={setExpectedShipmentDate} label="Expected Shipment Date" placeholder="Select shipment date"/>
          </div>
        </Section>

        {/* Section 3 — Items */}
        <div className="nso-section nso-card" style={{marginBottom:16}}>
          <div className="nso-sbar" style={{background:'linear-gradient(90deg,#10b981,transparent 80%)'}}/>
          <div className="nso-sin">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18}}>
              <div className="nso-stitle" style={{margin:0}}>
                <div className="nso-sicon" style={{background:'#10b98118',color:'#10b981'}}>🛒</div>
                Line Items
                <span style={{fontSize:11,fontWeight:700,color:'#10b981',background:'#d1fae5',padding:'2px 9px',borderRadius:99,marginLeft:4}}>{items.filter(i=>i.details).length} added</span>
              </div>
              <button onClick={addNewRow} className="nso-addrow"><FaPlus style={{fontSize:11}}/> Add Item Row</button>
            </div>
            <div style={{borderRadius:12,overflow:'hidden',border:`1.5px solid ${T.border}`}}>
              <table className="nso-table">
                <thead><tr>
                  <th style={{width:'35%'}}>Item Details</th>
                  <th>Quantity</th>
                  <th>Rate (AED)</th>
                  <th>Discount</th>
                  <th style={{textAlign:'right'}}>Amount</th>
                  <th style={{width:40}}></th>
                </tr></thead>
                <tbody>
                  {items.map((item,index)=>(
                    <tr key={item.id}>
                      <td>
                        <div style={{position:'relative'}} ref={el=>itemInputRefs.current[index]=el}>
                          <input className="nso-tinp" placeholder="Search or type item name…" value={item.details}
                            onChange={e=>{const u=[...items];u[index].details=e.target.value;setItems(u);debouncedSearch(e.target.value);setShowItemDropdown(index);}}
                            onFocus={()=>{setShowItemDropdown(index);if(!item.details)setSearchTerm('');}}
                          />
                          {item.sku&&<div style={{marginTop:5,display:'flex',alignItems:'center',gap:6,fontSize:10,color:T.textSec}}><FaBarcode style={{fontSize:9}}/><span style={{fontFamily:"'DM Mono',monospace"}}>{item.sku}</span>{item.unit&&<span>· {item.unit}</span>}</div>}
                        </div>
                      </td>
                      <td>
                        <div className="nso-qty">
                          <button className="nso-qbtn" onClick={()=>handleQuantityChange(index,Math.max(1,(parseFloat(item.quantity)||1)-1))}>−</button>
                          <input type="number" className="nso-qnum" value={item.quantity} onChange={e=>handleQuantityChange(index,e.target.value)} min="1"/>
                          <button className="nso-qbtn" onClick={()=>handleQuantityChange(index,(parseFloat(item.quantity)||1)+1)}>+</button>
                        </div>
                      </td>
                      <td><input type="text" value={item.rate} onChange={e=>handleRateChange(index,e.target.value)} className="nso-tinp" placeholder="0.00" style={{fontFamily:"'DM Mono',monospace",width:110}}/></td>
                      <td>
                        <div style={{display:'flex',alignItems:'center'}}>
                          <button type="button" className="nso-dtype" 
                            onClick={()=>handleDiscountTypeChange(index,item.discountType==='percentage'?'fixed':'percentage')}
                            title={item.discountType==='percentage'?'Switch to fixed AED discount':'Switch to % discount'}
                            style={{minWidth:52,fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:700}}>
                            {item.discountType==='percentage'
                              ? <><FaPercent style={{fontSize:9}}/>&nbsp;<span>%</span></>
                              : <><span style={{fontSize:10}}>AED</span></>}
                          </button>
                          <input type="number" value={item.discount} onChange={e=>handleDiscountChange(index,e.target.value)} className="nso-dinp" 
                            placeholder={item.discountType==='percentage'?'0':'0.00'} 
                            min="0" step={item.discountType==='percentage'?'1':'0.01'}
                            style={{width:72,fontFamily:"'DM Mono',monospace"}}/>
                        </div>
                      </td>
                      <td style={{textAlign:'right'}}>
                        <div className="nso-amt">AED {item.amount||'0.00'}</div>
                        {calcDiscountAED(item.quantity,item.rate,item.discount,item.discountType)&&(
                          <div style={{fontSize:10,color:'#16a34a',fontWeight:700,marginTop:3,display:'flex',alignItems:'center',justifyContent:'flex-end',gap:3}}>
                            <span style={{color:'#10b981'}}>↓</span>
                            <span>−AED {calcDiscountAED(item.quantity,item.rate,item.discount,item.discountType)} off</span>
                          </div>
                        )}
                      </td>
                      <td>
                        <button onClick={()=>handleRemoveItem(index)}
                          style={{width:28,height:28,borderRadius:8,border:'1.5px solid #fecaca',background:'#fef2f2',color:'#ef4444',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,transition:'all .12s'}}
                          onMouseEnter={e=>{e.currentTarget.style.background='#ef4444';e.currentTarget.style.color='#fff';}}
                          onMouseLeave={e=>{e.currentTarget.style.background='#fef2f2';e.currentTarget.style.color='#ef4444';}}>
                          <FaTrash/>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!hasItemsAdded&&(
                    <tr><td colSpan={6} style={{padding:32,textAlign:'center'}}>
                      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10,color:T.textSec}}>
                        <div style={{width:44,height:44,borderRadius:14,background:T.surface2,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>🛍</div>
                        <div style={{fontSize:13,fontWeight:600,color:T.textSec}}>No items added yet</div>
                        <div style={{fontSize:11}}>Click "Add Item Row" to start</div>
                      </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <DropdownPortal targetRef={{current:itemInputRefs.current[showItemDropdown]}} isVisible={showItemDropdown!==null}>
              <div className="item-dropdown-container nso-idd nso-dd">
                {inventoryLoading?(
                  <div style={{padding:20,textAlign:'center',color:T.textSec,fontSize:13}}><div style={{width:16,height:16,border:`2px solid ${T.border}`,borderTopColor:'#3b82f6',borderRadius:'50%',animation:'nsoSpin .7s linear infinite',margin:'0 auto 8px'}}/>Loading items…</div>
                ):filteredItems.length===0?(
                  <div style={{padding:24,textAlign:'center',color:T.textSec,fontSize:13}}>{searchTerm?'No items match your search':'Start typing to search items'}</div>
                ):(
                  <>
                    <div style={{padding:'8px 14px',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.07em',color:T.textSec,borderBottom:'1.5px solid #f1f5f9',display:'flex',justifyContent:'space-between'}}><span>{filteredItems.length} item{filteredItems.length!==1?'s':''}</span><span>Click to select</span></div>
                    {filteredItems.map(inv=>(
                      <div key={inv._id||inv.itemId} className="nso-irow" onClick={()=>handleItemSelect(showItemDropdown,inv)}>
                        <div style={{width:38,height:38,borderRadius:10,background:isDark?'rgba(59,130,246,0.15)':'linear-gradient(135deg,#eff6ff,#dbeafe)',color:T.blue,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:16}}><FaBox/></div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:8}}>
                            <span style={{fontSize:13,fontWeight:700,color:T.textPri,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{inv.name||inv.itemName||'No name'}</span>
                            <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,padding:'2px 7px',background:isDark?'rgba(59,130,246,0.15)':'#eff6ff',color:T.blue,borderRadius:5,flexShrink:0}}>SKU: {inv.sku||'N/A'}</span>
                          </div>
                          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginTop:8}}>
                            {[{icon:<FaMoneyBill style={{color:'#10b981'}}/>,label:'Price',val:`AED ${inv.selling_price||inv.price||0}`,mono:true},{icon:<FaWarehouse style={{color:'#f59e0b'}}/>,label:'Stock',val:`${inv.quantity||0} units`,color:(inv.quantity||0)>10?'#10b981':(inv.quantity||0)>0?'#f59e0b':'#ef4444'},{icon:<FaTag style={{color:'#8b5cf6'}}/>,label:'Unit',val:inv.unit||inv.Unit||'pcs'}].map(m=>(
                              <div key={m.label} style={{display:'flex',alignItems:'center',gap:6}}>
                                <div style={{fontSize:11}}>{m.icon}</div>
                                <div>
                                  <div style={{fontSize:9,color:T.textSec,textTransform:'uppercase',letterSpacing:'.05em',fontWeight:700}}>{m.label}</div>
                                  <div style={{fontSize:12,fontWeight:700,color:m.color||'#0f172a',fontFamily:m.mono?"'DM Mono',monospace":undefined}}>{m.val}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                          {inv.item_code&&<div style={{marginTop:6,fontSize:10,color:T.textSec,fontFamily:"'DM Mono',monospace"}}>Code: {inv.item_code}</div>}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </DropdownPortal>
          </div>
        </div>

        {/* Section 4 — Summary + Notes */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
          {/* Summary */}
          <div className="nso-section nso-card" style={{marginBottom:0}}>
            <div className="nso-sbar" style={{background:'linear-gradient(90deg,#f59e0b,transparent 80%)'}}/>
            <div className="nso-sin">
              <div className="nso-stitle"><div className="nso-sicon" style={{background:'#f59e0b18',color:'#f59e0b'}}>💰</div>Order Summary</div>
              <div className="nso-srow"><span style={{fontSize:13,color:T.textSec,fontWeight:500}}>Sub Total</span><span style={{fontSize:13,fontWeight:700,fontFamily:"'DM Mono',monospace",color:T.textPri}}>AED {calcSub().toFixed(2)}</span></div>
              <div className="nso-srow" style={{alignItems:'center'}}><span style={{fontSize:13,color:T.textSec,fontWeight:500}}>Shipping</span><div style={{display:'flex',alignItems:'center',gap:6}}><span style={{fontSize:11,fontWeight:700,color:T.textSec,fontFamily:"'DM Mono',monospace"}}>AED</span><input type="number" value={shippingCharges} onChange={e=>setShippingCharges(e.target.value)} className="nso-tinp" placeholder="0.00" step="0.01" min="0" style={{width:88,textAlign:'right',fontFamily:"'DM Mono',monospace"}}/></div></div>
              <div className="nso-srow" style={{alignItems:'center'}}><span style={{fontSize:13,color:T.textSec,fontWeight:500}}>Adjustment</span><div style={{display:'flex',alignItems:'center',gap:6}}><span style={{fontSize:11,fontWeight:700,color:T.textSec,fontFamily:"'DM Mono',monospace"}}>AED</span><input type="number" value={adjustment} onChange={e=>setAdjustment(e.target.value)} className="nso-tinp" placeholder="0.00" step="0.01" style={{width:88,textAlign:'right',fontFamily:"'DM Mono',monospace"}}/></div></div>
              {calcTotalDiscountAED()>0&&(
                <div className="nso-srow">
                  <span style={{fontSize:13,color:'#16a34a',fontWeight:600}}>
                    <span style={{marginRight:4}}>🏷</span>Discount
                  </span>
                  <span style={{fontSize:13,fontWeight:700,fontFamily:"'DM Mono',monospace",color:'#16a34a'}}>
                    −AED {calcTotalDiscountAED().toFixed(2)}
                  </span>
                </div>
              )}
              <div className="nso-srow"><span style={{fontSize:13,color:T.textSec,fontWeight:500}}>VAT (5%)</span><span style={{fontSize:13,fontWeight:700,fontFamily:"'DM Mono',monospace",color:T.textPri}}>AED {calcVAT().toFixed(2)}</span></div>
              <div style={{borderTop:`1.5px solid ${T.border}`,marginTop:12,paddingTop:14,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontFamily:"'Sora',sans-serif",fontSize:15,fontWeight:800,color:T.textPri}}>Total</span>
                <span style={{fontSize:18,fontWeight:800,color:T.blue,fontFamily:"'DM Mono',monospace"}}>AED {calcTotal().toFixed(2)}</span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:16,paddingTop:16,borderTop:`1.5px solid ${T.border}`}}>
                {[{label:'Line Items',val:items.filter(i=>i.details).length,color:T.blue,bg:isDark?'rgba(59,130,246,0.12)':'#eff6ff'},{label:'Total Qty',val:items.reduce((t,i)=>t+(parseFloat(i.quantity)||0),0),color:T.green,bg:isDark?'rgba(16,185,129,0.12)':'#f0fdf4'}].map(s=>(
                  <div key={s.label} style={{textAlign:'center',padding:'12px 8px',background:s.bg,borderRadius:12}}>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:22,fontWeight:800,color:s.color}}>{s.val}</div>
                    <div style={{fontSize:10,fontWeight:700,color:s.color,textTransform:'uppercase',letterSpacing:'.06em',marginTop:2}}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Notes */}
          <div className="nso-section nso-card" style={{marginBottom:0}}>
            <div className="nso-sbar" style={{background:'linear-gradient(90deg,#06b6d4,transparent 80%)'}}/>
            <div className="nso-sin">
              <div className="nso-stitle"><div className="nso-sicon" style={{background:'#06b6d418',color:'#06b6d4'}}>📝</div>Notes & Terms</div>
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                <Field label="Customer Notes"><textarea value={customerNotes} onChange={e=>setCustomerNotes(e.target.value)} className="nso-inp" placeholder="Notes visible to the customer…" style={{resize:'none',height:96,lineHeight:1.6}}/></Field>
                <Field label="Terms & Conditions"><textarea value={termsAndConditions} onChange={e=>setTermsAndConditions(e.target.value)} className="nso-inp" placeholder="Enter terms and conditions…" style={{resize:'none',height:96,lineHeight:1.6}}/></Field>
              </div>
            </div>
          </div>
        </div>

        {/* Section 5 — Attachments */}
        <Section title="Attachments" icon="📎" accent="#ef4444">
          <div onClick={()=>fileInputRef.current?.click()}
            style={{border:`2px dashed ${T.border}`,borderRadius:14,padding:'32px 24px',textAlign:'center',cursor:'pointer',background:T.surface2,transition:'all .2s'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='#3b82f6';e.currentTarget.style.background=isDark?'rgba(59,130,246,0.1)':'#eff6ff';}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=T.surface2;}}>
            <div style={{width:48,height:48,borderRadius:14,background:isDark?'rgba(239,68,68,0.15)':'#fef2f2',color:T.red,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px',fontSize:20}}>📎</div>
            <p style={{fontSize:14,fontWeight:700,color:T.textPri,margin:'0 0 6px'}}>Drag & drop or click to upload</p>
            <p style={{fontSize:11,color:T.textSec,margin:0}}>Max 10 files · 5 MB each · PDF, DOC, XLS, JPG, PNG</p>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple style={{display:'none'}} accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"/>
          </div>
          {attachedFiles.length>0&&(
            <div style={{marginTop:14,display:'flex',flexDirection:'column',gap:8}}>
              <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',color:T.textSec,margin:'0 0 4px'}}>Attached ({attachedFiles.length}/10)</p>
              {attachedFiles.map(f=>(
                <div key={f.id} className="nso-fchip">
                  <div style={{width:32,height:32,borderRadius:8,background:isDark?'rgba(59,130,246,0.15)':'#eff6ff',color:T.blue,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,flexShrink:0}}>📄</div>
                  <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600,color:T.textPri,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.name}</div><div style={{fontSize:11,color:T.textSec}}>{f.size} MB</div></div>
                  <button onClick={()=>handleRemoveFile(f.id)} style={{color:'#94a3b8',background:'none',border:'none',cursor:'pointer',padding:4,fontSize:13,transition:'color .12s'}} onMouseEnter={e=>e.currentTarget.style.color='#ef4444'} onMouseLeave={e=>e.currentTarget.style.color=T.textSec}><svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Bottom bar */}
        <div className="nso-bottombar">
          <div>
            <div style={{fontSize:13,fontWeight:700,color:T.textPri}}>{items.filter(i=>i.details).length} item{items.filter(i=>i.details).length!==1?'s':''}&nbsp;·&nbsp;<span style={{fontFamily:"'DM Mono',monospace",color:T.blue}}>AED {calcTotal().toFixed(2)}</span></div>
            <div style={{fontSize:11,color:T.textSec,marginTop:2}}>Fields marked with <span style={{color:T.red}}>*</span> are required</div>
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={handleCancel} className="nso-bg">Cancel</button>
            <button onClick={handleSaveAsDraft} className="nso-bd" disabled={addSalesOrderLoading||!selectedCustomer||!hasItemsAdded}>{addSalesOrderLoading?'Saving…':'Save as Draft'}</button>
            <button onClick={handleSaveAndSend} className="nso-bp" disabled={addSalesOrderLoading||!selectedCustomer||!hasItemsAdded||!lpoNumber.trim()}>
              {addSalesOrderLoading?<><div style={{width:13,height:13,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'nsoSpin .7s linear infinite'}}/>Processing…</>:<><svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>Save & Send</>}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Newsalesorders;