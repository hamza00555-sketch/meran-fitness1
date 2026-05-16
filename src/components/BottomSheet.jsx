import { useEffect } from 'react';

export default function BottomSheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end',
    }} className="anim-fadein">
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(2px)',
      }} />
      <div style={{
        position: 'relative', width: '100%', maxWidth: 430, margin: '0 auto',
        background: '#1A1650', borderRadius: '24px 24px 0 0',
        padding: '0 0 calc(env(safe-area-inset-bottom) + 24px)',
        maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        animation: 'slideUp .3s cubic-bezier(.4,0,.2,1)',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#2A2660' }} />
        </div>
        {title && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 20px 16px',
          }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{title}</span>
            <button onClick={onClose} className="btn-icon" style={{ color: '#9B99C8' }}>✕</button>
          </div>
        )}
        <div style={{ overflowY: 'auto', padding: '0 20px 8px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
