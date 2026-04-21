import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, Package, Building2, PackageOpen,
  Factory, Archive, BarChart3, Truck, Scissors, Users, LogOut,
  CalendarDays,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const NAV = [
  { to: '/',           label: '대시보드',   icon: LayoutDashboard },
  { to: '/items',      label: '품목 관리',   icon: Package },
  { to: '/partners',   label: '거래처 관리', icon: Building2 },
  { to: '/receiving',  label: '입고 관리',   icon: PackageOpen },
  { to: '/production-plan', label: '생산 계획', icon: CalendarDays },
  { to: '/production', label: '생산 관리',   icon: Factory },
  { to: '/packaging',  label: '완제품 포장', icon: Archive },
  { to: '/inventory',  label: '재고 현황',   icon: BarChart3 },
  { to: '/shipping',   label: '출고 관리',   icon: Truck },
  { to: '/waste',      label: '파지 관리',   icon: Scissors },
  { to: '/users',      label: '사용자 관리', icon: Users },
]

const ROLE_LABELS = { master: '마스터', manager: '매니저', worker: '작업자' }

export default function Layout() {
  const { profile, signOut } = useAuth()

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ── 사이드바 ── */}
      <aside style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', backgroundColor: '#004634', overflow: 'hidden' }}>

        {/* 로고 */}
        <div style={{ padding: '28px 24px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <p style={{ color: '#ffffff', fontSize: 20, fontWeight: 900, letterSpacing: '0.12em' }}>CRSP CRSP</p>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 4, letterSpacing: '0.1em' }}>
            생산·재고 관리 시스템
          </p>
        </div>

        {/* 내비게이션 */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 12px' }}>
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 12,
                minHeight: 52, padding: '0 14px',
                borderRadius: 10, marginBottom: 4,
                fontSize: 16, fontWeight: isActive ? 600 : 400,
                color: isActive ? '#ffffff' : 'rgba(255,255,255,0.5)',
                backgroundColor: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                textDecoration: 'none', transition: 'all 0.15s',
              })}
              onMouseEnter={e => { if (!e.currentTarget.classList.contains('active')) { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)' } }}
              onMouseLeave={e => { /* let NavLink handle active state */ }}
            >
              {({ isActive }) => (
                <>
                  <Icon size={22} strokeWidth={isActive ? 2 : 1.7} style={{ flexShrink: 0 }} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* 사용자 영역 */}
        <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {profile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', marginBottom: 4 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#D4A96A', color: '#004634', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>
                {(profile.name?.[0] || profile.email?.[0] || '?').toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#ffffff', fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profile.name || (profile.email ? profile.email.split('@')[0] : '')}
                </p>
                <p style={{ color: 'rgba(212,169,106,0.85)', fontSize: 12, marginTop: 2 }}>
                  {ROLE_LABELS[profile.role] || profile.role}
                </p>
              </div>
            </div>
          )}
          <button onClick={signOut}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, padding: '0 14px', borderRadius: 10, border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}>
            <LogOut size={17} /><span>로그아웃</span>
          </button>
        </div>
      </aside>

      {/* ── 메인 콘텐츠 ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#eee8db' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
