import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const EMAIL_DOMAIN = 'crspcrsp.com'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, user } = useAuth()

  if (user) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const id = username.trim().toLowerCase()
    const email = id.includes('@') ? id : `${id}@${EMAIL_DOMAIN}`
    const { error } = await signIn(email, password)
    if (error) setError('아이디 또는 비밀번호가 올바르지 않습니다.')
    setLoading(false)
  }

  // 입력에 @ 포함 시 suffix 숨김 — 단, <input>은 항상 wrapper 안 같은 위치에 유지해 커서 보존
  const showSuffix = !username.includes('@')

  const inputBase = {
    width: '100%', height: 56, padding: '0 18px',
    fontSize: 16, color: '#111827',
    backgroundColor: '#fafafa',
    border: '2px solid #e5e7eb',
    borderRadius: 12, outline: 'none',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, backgroundColor: '#FCF4E2',
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 64, height: 64, borderRadius: 16, marginBottom: 20,
            background: '#004634', boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
          }}>
            <span style={{ color: '#fff', fontSize: 22, fontWeight: 900, letterSpacing: '0.15em' }}>CC</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '0.25em', color: '#004634', margin: 0 }}>
            CRSP CRSP
          </h1>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', color: '#D4A96A', marginTop: 6, textTransform: 'uppercase' }}>
            생산·재고 관리 시스템
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff', borderRadius: 24, padding: 36,
          border: '1.5px solid rgba(212,169,106,0.2)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#004634', marginBottom: 28 }}>로그인</h2>

          {error && (
            <div style={{
              marginBottom: 20, padding: '14px 16px', borderRadius: 12,
              fontSize: 14, color: '#b91c1c', background: '#fef2f2',
              border: '1px solid #fecaca',
            }}>{error}</div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <label style={{
                display: 'block', fontSize: 12, fontWeight: 700,
                letterSpacing: '0.2em', textTransform: 'uppercase',
                color: '#004634', marginBottom: 10,
              }}>아이디</label>
              <div style={{ display: 'flex', alignItems: 'stretch' }}>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder={showSuffix ? 'stock01' : 'paul@olistable.com'}
                  required
                  autoCapitalize="off" autoCorrect="off" autoComplete="username"
                  style={{
                    ...inputBase,
                    flex: 1, minWidth: 0,
                    borderTopRightRadius:    showSuffix ? 0 : 12,
                    borderBottomRightRadius: showSuffix ? 0 : 12,
                    borderRightWidth: showSuffix ? 0 : 2,
                  }}
                  onFocus={e => (e.target.style.borderColor = '#004634')}
                  onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
                />
                {showSuffix && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '0 16px',
                    fontSize: 14, fontWeight: 600, color: '#6b7280',
                    background: '#f3f4f6',
                    border: '2px solid #e5e7eb', borderLeft: 'none',
                    borderTopRightRadius: 12, borderBottomRightRadius: 12,
                  }}>@{EMAIL_DOMAIN}</span>
                )}
              </div>
            </div>

            <div>
              <label style={{
                display: 'block', fontSize: 12, fontWeight: 700,
                letterSpacing: '0.2em', textTransform: 'uppercase',
                color: '#004634', marginBottom: 10,
              }}>비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={inputBase}
                onFocus={e => (e.target.style.borderColor = '#004634')}
                onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', height: 56,
                marginTop: 8, padding: 0,
                borderRadius: 12, border: 'none',
                fontSize: 15, fontWeight: 700, letterSpacing: '0.06em',
                color: '#fff',
                background: loading ? '#9ca3af' : '#004634',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}>
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, marginTop: 24, fontWeight: 500, color: '#D4A96A' }}>
          © 2025 Crsp Crsp. All rights reserved.
        </p>
      </div>
    </div>
  )
}
