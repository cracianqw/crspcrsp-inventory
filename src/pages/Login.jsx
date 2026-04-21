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
    // 아이디 → 이메일로 변환: 이미 @ 포함 시 그대로, 아니면 @crspcrsp.com 덧붙임
    const id = username.trim().toLowerCase()
    const email = id.includes('@') ? id : `${id}@${EMAIL_DOMAIN}`
    const { error } = await signIn(email, password)
    if (error) setError('아이디 또는 비밀번호가 올바르지 않습니다.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#FCF4E2' }}>
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 shadow-lg"
            style={{ backgroundColor: '#004634' }}
          >
            <span className="text-white text-xl font-black tracking-widest">CC</span>
          </div>
          <h1 className="text-2xl font-black tracking-[0.25em]" style={{ color: '#004634' }}>
            CRSP CRSP
          </h1>
          <p className="text-xs font-semibold mt-1.5 tracking-widest uppercase" style={{ color: '#D4A96A' }}>
            생산·재고 관리 시스템
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl p-8" style={{ border: '1.5px solid #D4A96A30' }}>
          <h2 className="text-base font-bold mb-6" style={{ color: '#004634' }}>로그인</h2>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm text-red-700 bg-red-50 border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold mb-2 tracking-widest uppercase" style={{ color: '#004634' }}>
                아이디
              </label>
              {username.includes('@') ? (
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="paul@olistable.com"
                  required
                  autoCapitalize="off" autoCorrect="off" autoComplete="username"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{ border: '2px solid #e5e7eb', backgroundColor: '#fafafa' }}
                  onFocus={e => (e.target.style.borderColor = '#004634')}
                  onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
                />
              ) : (
                <div className="flex items-stretch">
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="stock01"
                    required
                    autoCapitalize="off" autoCorrect="off" autoComplete="username"
                    className="flex-1 min-w-0 px-4 py-3 rounded-l-xl text-sm outline-none transition-all"
                    style={{ border: '2px solid #e5e7eb', borderRight: 'none', backgroundColor: '#fafafa' }}
                    onFocus={e => (e.target.style.borderColor = '#004634')}
                    onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
                  />
                  <span
                    className="inline-flex items-center px-3 rounded-r-xl text-sm font-semibold"
                    style={{ border: '2px solid #e5e7eb', borderLeft: 'none', backgroundColor: '#f3f4f6', color: '#6b7280' }}>
                    @{EMAIL_DOMAIN}
                  </span>
                </div>
              )}
              <p className="text-[11px] mt-1.5" style={{ color: '#9ca3af' }}>
                일반 직원은 아이디만, 마스터는 전체 이메일 입력
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold mb-2 tracking-widest uppercase" style={{ color: '#004634' }}>
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{ border: '2px solid #e5e7eb', backgroundColor: '#fafafa' }}
                onFocus={e => (e.target.style.borderColor = '#004634')}
                onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all mt-2"
              style={{ backgroundColor: loading ? '#9ca3af' : '#004634', letterSpacing: '0.05em' }}
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6 font-medium" style={{ color: '#D4A96A' }}>
          © 2025 Crsp Crsp. All rights reserved.
        </p>
      </div>
    </div>
  )
}
