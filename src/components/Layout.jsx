import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Package, Building2, PackageOpen,
  Factory, Archive, BarChart3, Truck, Scissors, Users, LogOut,
  CalendarDays, Trash2, Menu, X,
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
  { to: '/users',      label: '사용자 관리', icon: Users, roleMin: 'master' },
  { to: '/deleted',    label: '삭제 내역',   icon: Trash2, roleMin: 'senior_manager' },
]

const ROLE_LABELS = {
  master: '마스터',
  senior_manager: '시니어 매니저',
  manager: '매니저',
  worker: '작업자',
}
const ROLE_RANK = { worker: 0, manager: 1, senior_manager: 2, master: 3 }

const MOBILE_BP = 768
const TOPBAR_HEIGHT = 56

export default function Layout() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= MOBILE_BP : false
  )
  const [drawerOpen, setDrawerOpen] = useState(false)

  // 뷰포트 변경 감지
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BP}px)`)
    const handle = e => setIsMobile(e.matches)
    handle(mq)
    mq.addEventListener('change', handle)
    return () => mq.removeEventListener('change', handle)
  }, [])

  // 경로 변경 시 드로어 자동 닫힘
  useEffect(() => { setDrawerOpen(false) }, [location.pathname])

  // 드로어 열렸을 때 body 스크롤 잠금
  useEffect(() => {
    if (isMobile && drawerOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [isMobile, drawerOpen])

  const sidebarVisible = !isMobile || drawerOpen

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      position: 'relative',
    }}>

      {/* 모바일 상단바 */}
      {isMobile && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: TOPBAR_HEIGHT,
          background: '#004634', display: 'flex', alignItems: 'center',
          padding: '0 16px', gap: 12, zIndex: 30,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          <button onClick={() => setDrawerOpen(v => !v)}
            aria-label="메뉴"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 40, height: 40, border: 'none', borderRadius: 8,
              background: 'rgba(255,255,255,0.1)', color: '#fff',
              cursor: 'pointer',
            }}>
            {drawerOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: '#fff', fontSize: 16, fontWeight: 900, letterSpacing: '0.1em', lineHeight: 1 }}>CRSP CRSP</span>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, letterSpacing: '0.08em', marginTop: 3 }}>생산·재고 관리</span>
          </div>
        </div>
      )}

      {/* 모바일 오버레이 */}
      {isMobile && drawerOpen && (
        <div onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            background: 'rgba(0,0,0,0.5)',
            transition: 'opacity 0.2s',
          }} />
      )}

      {/* 사이드바 */}
      <aside style={{
        width: 260,
        display: 'flex', flexDirection: 'column',
        backgroundColor: '#004634', overflow: 'hidden',
        ...(isMobile ? {
          position: 'fixed', top: 0, bottom: 0,
          left: drawerOpen ? 0 : -280,
          transition: 'left 0.25s ease',
          zIndex: 50,
          boxShadow: drawerOpen ? '2px 0 24px rgba(0,0,0,0.25)' : 'none',
        } : {
          flexShrink: 0,
          position: 'relative',
        }),
      }}>

        {/* 로고 — 모바일에서는 축소 */}
        <div style={{
          padding: isMobile ? '20px 20px 16px' : '28px 24px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <p style={{ color: '#ffffff', fontSize: 20, fontWeight: 900, letterSpacing: '0.12em' }}>CRSP CRSP</p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 4, letterSpacing: '0.1em' }}>
              생산·재고 관리 시스템
            </p>
          </div>
          {isMobile && (
            <button onClick={() => setDrawerOpen(false)} aria-label="닫기"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, border: 'none', borderRadius: 8,
                background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
              }}>
              <X size={18} />
            </button>
          )}
        </div>

        {/* 내비게이션 */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 12px' }}>
          {NAV.filter(item => !item.roleMin || (ROLE_RANK[profile?.role] ?? -1) >= ROLE_RANK[item.roleMin]).map(({ to, label, icon: Icon }) => (
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
              onMouseLeave={() => {}}
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

      {/* 메인 콘텐츠 */}
      <main style={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: '#eee8db',
        paddingTop: isMobile ? TOPBAR_HEIGHT : 0,
        width: '100%',
      }}>
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: isMobile ? '16px 16px 32px' : 32,
        }}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
