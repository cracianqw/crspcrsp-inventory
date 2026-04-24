// ── Crsp Crsp Design System ─────────────────────────────────────
// 정확한 스펙: 입력 48px / 버튼 44px / 행 52px / 패딩 기준 준수
import { useEffect, useState } from 'react'
import { X, AlertCircle, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'

// ── 품목 드롭다운 라벨 — 외주 품목은 "[외주] " 접두 ─────────
export function itemLabel(item, opts = {}) {
  if (!item) return ''
  const base = opts.withCode && item.code ? `${item.name} (${item.code})` : item.name
  return item.production_type === 'outsourced' ? `[외주] ${base}` : base
}

// ── 사용자 맵 (id → 이름/아이디) 캐시 ────────────────────────
let _userMapCache = null
let _userMapPromise = null
export function useUserMap() {
  const [map, setMap] = useState(_userMapCache || {})
  useEffect(() => {
    if (_userMapCache) return
    if (!_userMapPromise) {
      _userMapPromise = supabase.from('users').select('id, name, email').then(({ data }) => {
        const m = {}
        ;(data || []).forEach(u => { m[u.id] = u.name || (u.email ? u.email.split('@')[0] : '—') })
        _userMapCache = m
        return m
      })
    }
    _userMapPromise.then(m => setMap(m))
  }, [])
  return map
}

// ── 감사 정보 셀 ─────────────────────────────────────────────
// { userId, at } 한 쌍 표시 — 예: {홍길동 / 3/15 14:22}
export function AuditStamp({ userName, at }) {
  if (!at) return <span style={{ color: '#d1d5db', fontSize: 13 }}>—</span>
  const d = new Date(at)
  const dt = `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  return (
    <div style={{ fontSize: 12, lineHeight: 1.35, whiteSpace: 'nowrap' }}>
      <div style={{ fontWeight: 600, color: '#374151' }}>{userName || '—'}</div>
      <div style={{ color: '#9ca3af', marginTop: 1 }}>{dt}</div>
    </div>
  )
}

// ── Form ─────────────────────────────────────────────────────────
export function Label({ children, required }) {
  return (
    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 8 }}>
      {children}{required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
    </label>
  )
}

export function Input({ value, onChange, type = 'text', placeholder, disabled }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        display: 'block', width: '100%', height: 48,
        padding: '0 16px', fontSize: 15, color: '#111827',
        backgroundColor: disabled ? '#f9fafb' : '#ffffff',
        border: '1.5px solid #e5e7eb', borderRadius: 10,
        outline: 'none', transition: 'border-color 0.15s',
      }}
      onFocus={e => !disabled && (e.target.style.borderColor = '#004634')}
      onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
    />
  )
}

export function Textarea({ value, onChange, rows = 3, placeholder }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      style={{
        display: 'block', width: '100%', padding: '12px 16px',
        fontSize: 15, color: '#111827', backgroundColor: '#ffffff',
        border: '1.5px solid #e5e7eb', borderRadius: 10,
        outline: 'none', resize: 'none', transition: 'border-color 0.15s',
      }}
      onFocus={e => (e.target.style.borderColor = '#004634')}
      onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
    />
  )
}

export function SelectInput({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        display: 'block', width: '100%', height: 48,
        padding: '0 16px', fontSize: 15, color: '#111827',
        backgroundColor: '#ffffff', border: '1.5px solid #e5e7eb',
        borderRadius: 10, outline: 'none', transition: 'border-color 0.15s',
      }}
      onFocus={e => (e.target.style.borderColor = '#004634')}
      onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
    >
      {children}
    </select>
  )
}

// ── Buttons ──────────────────────────────────────────────────────
const BTN_VARIANTS = {
  primary:   { background: '#004634', color: '#ffffff', border: '1.5px solid #004634' },
  secondary: { background: '#ffffff', color: '#374151', border: '1.5px solid #e5e7eb' },
  danger:    { background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fecaca' },
  ghost:     { background: 'transparent', color: '#6b7280', border: '1.5px solid transparent' },
  accent:    { background: '#FCF4E2', color: '#C49A5A', border: '1.5px solid #D4A96A40' },
}

export function Btn({ children, onClick, disabled, variant = 'primary', full, type = 'button' }) {
  const v = disabled
    ? { background: '#f3f4f6', color: '#9ca3af', border: '1.5px solid #e5e7eb' }
    : BTN_VARIANTS[variant] || BTN_VARIANTS.primary
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: 8, height: 48, padding: '0 28px', fontSize: 16, fontWeight: 700,
        borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer',
        width: full ? '100%' : undefined, transition: 'all 0.15s',
        boxShadow: !disabled && variant === 'primary' ? '0 2px 6px rgba(0,70,52,0.25)' : 'none',
        ...v,
      }}
    >
      {children}
    </button>
  )
}

export function RegisterBtn({ children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', lineHeight: 1,
        gap: 10, height: 52, padding: '0 32px',
        fontSize: 20, fontWeight: 700,
        borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer',
        background: disabled ? '#f3f4f6' : '#B2EF8B',
        color: disabled ? '#9ca3af' : '#004634',
        border: disabled ? '1.5px solid #e5e7eb' : '1.5px solid #B2EF8B',
        boxShadow: disabled ? 'none' : '0 2px 8px rgba(178,239,139,0.35)',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

export function IconBtn({ icon: Icon, onClick, variant = 'secondary', label }) {
  const v = BTN_VARIANTS[variant] || BTN_VARIANTS.secondary
  return (
    <button onClick={onClick} title={label}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 36, height: 36, borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
        ...v,
      }}>
      <Icon size={15} />
    </button>
  )
}

// ── Modal ────────────────────────────────────────────────────────
export function Overlay({ children, onClose, size = 'md' }) {
  const widths = { sm: 480, md: 600, lg: 720, xl: 880 }
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', width: '100%', maxWidth: widths[size], maxHeight: '92vh', overflowY: 'auto', position: 'relative' }}>
        <button onClick={onClose}
          style={{ position: 'absolute', top: 20, right: 20, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', background: '#f3f4f6', color: '#6b7280', cursor: 'pointer', zIndex: 1 }}>
          <X size={16} />
        </button>
        {children}
      </div>
    </div>
  )
}

export function ModalHeader({ children, sub }) {
  return (
    <div style={{ padding: '28px 32px 24px', borderBottom: '1px solid #f3f4f6' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{children}</h2>
      {sub && <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>{sub}</p>}
    </div>
  )
}

export function ModalBody({ children }) {
  return <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>{children}</div>
}

export function ModalFooter({ children }) {
  return (
    <div style={{ padding: '20px 32px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 12, justifyContent: 'flex-end', position: 'sticky', bottom: 0, background: '#fff' }}>
      {children}
    </div>
  )
}

// ── Feedback ─────────────────────────────────────────────────────
export function ErrorBox({ msg }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, fontSize: 14, color: '#dc2626' }}>
      <AlertCircle size={15} style={{ marginTop: 1, flexShrink: 0 }} /><span>{msg}</span>
    </div>
  )
}

export function SuccessBox({ msg }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, fontSize: 14, color: '#166534' }}>
      <Check size={15} style={{ flexShrink: 0 }} /><span>{msg}</span>
    </div>
  )
}

// ── Layout ───────────────────────────────────────────────────────
export function Card({ children, className = '' }) {
  return (
    <div className={className} style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e9ecef', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      {children}
    </div>
  )
}

export function CardHeader({ title, sub, action }) {
  return (
    <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{title}</h2>
        {sub && <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>{sub}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

export function PageHeader({ title, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 56 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', lineHeight: 1.25 }}>{title}</h1>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  )
}

export function StatCard({ label, value, unit, sub, icon: Icon, onClick, active, alert }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: '#ffffff', borderRadius: 12, padding: 24,
        textAlign: 'left', width: '100%', transition: 'all 0.15s',
        cursor: onClick ? 'pointer' : 'default',
        border: active ? '2px solid #004634' : alert ? '1.5px solid #fbbf24' : '1px solid #e9ecef',
        boxShadow: active ? '0 0 0 4px rgba(0,70,52,0.08)' : '0 4px 12px rgba(0,0,0,0.06)',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#6b7280' }}>{label}</span>
        {Icon && <Icon size={18} color="#d1d5db" />}
      </div>
      <p style={{ fontSize: 40, fontWeight: 700, color: active ? '#004634' : alert ? '#d97706' : '#111827', lineHeight: 1.1 }}>
        {value}
        {unit && <span style={{ fontSize: 16, fontWeight: 400, color: '#9ca3af', marginLeft: 6 }}>{unit}</span>}
      </p>
      {sub && <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 8 }}>{sub}</p>}
    </button>
  )
}

// ── Table ────────────────────────────────────────────────────────
export function Th({ children, className = '' }) {
  return (
    <th className={className} style={{ padding: '14px 16px', textAlign: 'left', fontSize: 14, fontWeight: 700, color: '#374151', whiteSpace: 'nowrap', backgroundColor: '#f5f5f0', borderBottom: '1px solid #e5e7eb' }}>
      {children}
    </th>
  )
}

export function Td({ children, className = '', style = {} }) {
  return (
    <td className={className} style={{ padding: '16px', fontSize: 15, color: '#374151', borderBottom: '1px solid #f1f1ec', height: 52, ...style }}>
      {children}
    </td>
  )
}

// ── Badges ───────────────────────────────────────────────────────
export function Badge({ label, color = '#6b7280', bg = '#f3f4f6' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 6, color, backgroundColor: bg }}>
      {label}
    </span>
  )
}

export function LotBadge({ children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', fontFamily: 'monospace', fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 6, backgroundColor: '#FCF4E2', color: '#C49A5A', border: '1px solid #D4A96A25' }}>
      {children}
    </span>
  )
}

export function DateBadge({ children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 6, backgroundColor: '#f3f4f6', color: '#6b7280' }}>
      {children}
    </span>
  )
}

// ── Misc ─────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, text, sub }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '72px 24px' }}>
      {Icon && <Icon size={44} color="#e5e7eb" style={{ marginBottom: 16 }} />}
      <p style={{ fontSize: 15, fontWeight: 500, color: '#9ca3af' }}>{text}</p>
      {sub && <p style={{ fontSize: 13, color: '#d1d5db', marginTop: 6 }}>{sub}</p>}
    </div>
  )
}

export function Spinner({ size = 'md' }) {
  const s = { sm: 20, md: 28, lg: 40 }[size] || 28
  return (
    <div style={{ width: s, height: s, border: `2.5px solid #004634`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
  )
}

export function Section({ title, action, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder, icon: Icon }) {
  return (
    <div style={{ position: 'relative' }}>
      {Icon && <Icon size={17} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />}
      <input
        type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{
          width: '100%', height: 44, paddingLeft: Icon ? 44 : 16, paddingRight: 16,
          fontSize: 15, backgroundColor: '#fff', color: '#111827',
          border: '1.5px solid #d1d5db', borderRadius: 10, outline: 'none',
          transition: 'border-color 0.15s',
        }}
        onFocus={e => (e.target.style.borderColor = '#004634')}
        onBlur={e => (e.target.style.borderColor = '#d1d5db')}
      />
    </div>
  )
}

export function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
      {tabs.map(tab => (
        <button key={tab.key} onClick={() => onChange(tab.key)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 20px', fontSize: 14, fontWeight: 500,
            borderBottom: `2px solid ${active === tab.key ? '#004634' : 'transparent'}`,
            color: active === tab.key ? '#004634' : '#6b7280',
            cursor: 'pointer', background: 'none', border: 'none',
            borderBottom: `2px solid ${active === tab.key ? '#004634' : 'transparent'}`,
            marginBottom: -1, transition: 'all 0.15s',
          }}>
          {tab.icon && <tab.icon size={15} />}{tab.label}
        </button>
      ))}
    </div>
  )
}

export function InfoBanner({ children, type = 'info' }) {
  const styles = {
    info:    { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
    warning: { bg: '#fefce8', border: '#fde047', text: '#854d0e' },
    success: { bg: '#f0fdf4', border: '#86efac', text: '#166534' },
    brand:   { bg: '#FCF4E2', border: '#D4A96A40', text: '#92400e' },
  }[type]
  return (
    <div style={{ padding: '16px 20px', borderRadius: 12, backgroundColor: styles.bg, border: `1px solid ${styles.border}`, color: styles.text, fontSize: 14 }}>
      {children}
    </div>
  )
}
