import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Shield, Key, Check, Eye, EyeOff, Users as UsersIcon, Trash2 } from 'lucide-react'

const EMAIL_DOMAIN = 'crspcrsp.com'
const toEmail = u => (u || '').trim().toLowerCase().includes('@')
  ? (u || '').trim().toLowerCase()
  : `${(u || '').trim().toLowerCase()}@${EMAIL_DOMAIN}`
const toUsername = e => {
  if (!e) return ''
  const [local, domain] = String(e).split('@')
  return (domain === EMAIL_DOMAIN) ? local : e
}
import {
  Card, CardHeader, Btn, RegisterBtn,
  Label, Input, SelectInput,
  Overlay, ModalHeader, ModalBody, ModalFooter,
  ErrorBox, SuccessBox, EmptyState, Spinner, Badge, InfoBanner,
} from '../components/UI'

const ROLES = [
  { value: 'master',         label: '마스터',       color: '#92400e', bg: '#fef3c7', desc: '전체 + 계정 관리' },
  { value: 'senior_manager', label: '시니어 매니저', color: '#7c2d12', bg: '#ffedd5', desc: '조회·입력·수정·삭제' },
  { value: 'manager',        label: '매니저',       color: '#065f46', bg: '#d1fae5', desc: '조회·입력' },
  { value: 'worker',         label: '작업자',       color: '#374151', bg: '#f3f4f6', desc: '조회 전용' },
]

function NewUserModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'worker' })
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    const uname = form.username.trim().toLowerCase()
    if (!form.name || !uname || !form.password) { setError('이름, 아이디, 비밀번호는 필수입니다.'); return }
    if (!/^[a-z0-9_.-]+$/.test(uname)) { setError('아이디는 영문 소문자/숫자/_/./-만 사용할 수 있습니다.'); return }
    if (form.password.length < 6) { setError('비밀번호는 최소 6자 이상이어야 합니다.'); return }
    const email = toEmail(uname)
    setSaving(true); setError('')
    const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password: form.password })
    if (authErr) { setError(authErr.message); setSaving(false); return }
    if (authData.user) {
      const { error: pErr } = await supabase.from('users').insert({ id: authData.user.id, name: form.name, email, role: form.role })
      if (pErr && pErr.code !== '23505') { setError(pErr.message); setSaving(false); return }
    }
    setSuccess(`계정이 생성되었습니다. 바로 로그인 가능: ${uname}`)
    setSaving(false)
    setTimeout(() => onSave(), 1500)
  }

  return (
    <Overlay onClose={onClose} size="md">
      <ModalHeader>신규 계정 생성</ModalHeader>
      <ModalBody>
        {error && <ErrorBox msg={error} />}
        {success && <SuccessBox msg={success} />}
        <div><Label required>이름</Label><Input value={form.name} onChange={v => f('name', v)} placeholder="홍길동" /></div>
        <div>
          <Label required>아이디</Label>
          <div style={{ display: 'flex', alignItems: 'stretch' }}>
            <input
              type="text" value={form.username}
              onChange={e => f('username', e.target.value)}
              placeholder="stock01" autoCapitalize="off" autoCorrect="off"
              style={{
                flex: 1, minWidth: 0, height: 48, padding: '0 16px',
                fontSize: 15, color: '#111827', backgroundColor: '#fff',
                border: '1.5px solid #e5e7eb', borderRight: 'none',
                borderTopLeftRadius: 10, borderBottomLeftRadius: 10, outline: 'none',
              }}
              onFocus={e => (e.target.style.borderColor = '#004634')}
              onBlur={e => (e.target.style.borderColor = '#e5e7eb')} />
            <span style={{
              display: 'inline-flex', alignItems: 'center', padding: '0 14px',
              fontSize: 14, fontWeight: 600, color: '#6b7280',
              background: '#f5f5f0', border: '1.5px solid #e5e7eb', borderLeft: 'none',
              borderTopRightRadius: 10, borderBottomRightRadius: 10,
            }}>@{EMAIL_DOMAIN}</span>
          </div>
          {form.username && <p style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>로그인 이메일: <b>{toEmail(form.username)}</b></p>}
        </div>
        <div>
          <Label required>비밀번호</Label>
          <div className="relative">
            <Input type={showPw ? 'text' : 'password'} value={form.password} onChange={v => f('password', v)} placeholder="최소 6자" />
            <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div>
          <Label>권한</Label>
          <div className="grid grid-cols-3 gap-3">
            {ROLES.map(role => (
              <button key={role.value} onClick={() => f('role', role.value)}
                className="p-4 rounded-lg text-left transition-all border"
                style={form.role === role.value
                  ? { backgroundColor: role.bg, borderColor: role.color }
                  : { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }}>
                <p className="text-sm font-semibold" style={{ color: form.role === role.value ? role.color : '#374151' }}>{role.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{role.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Btn variant="secondary" onClick={onClose}>취소</Btn>
        <Btn disabled={saving || !!success} onClick={handleSave}>{saving ? '생성 중...' : '계정 생성'}</Btn>
      </ModalFooter>
    </Overlay>
  )
}

function EditRoleModal({ targetUser, onClose, onSave }) {
  const [role, setRole] = useState(targetUser.role || 'worker')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('users').update({ role }).eq('id', targetUser.id)
    if (error) { setError(error.message); setSaving(false); return }
    onSave()
  }

  return (
    <Overlay onClose={onClose} size="sm">
      <ModalHeader sub={targetUser.name || toUsername(targetUser.email)}>권한 변경</ModalHeader>
      <ModalBody>
        {error && <ErrorBox msg={error} />}
        <div className="grid grid-cols-3 gap-3">
          {ROLES.map(r => (
            <button key={r.value} onClick={() => setRole(r.value)}
              className="p-4 rounded-lg text-left transition-all border"
              style={role === r.value ? { backgroundColor: r.bg, borderColor: r.color } : { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }}>
              <p className="text-sm font-semibold" style={{ color: role === r.value ? r.color : '#374151' }}>{r.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{r.desc}</p>
            </button>
          ))}
        </div>
      </ModalBody>
      <ModalFooter>
        <Btn variant="secondary" onClick={onClose}>취소</Btn>
        <Btn disabled={saving} onClick={handleSave}>{saving ? '저장 중...' : '변경 저장'}</Btn>
      </ModalFooter>
    </Overlay>
  )
}

export default function Users() {
  const { isMaster, user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [resetStatus, setResetStatus] = useState({})

  useEffect(() => { if (isMaster) fetchUsers() }, [isMaster])

  async function fetchUsers() {
    setLoading(true)
    const { data } = await supabase.from('users').select('*').is('deleted_at', null).order('created_at')
    setUsers(data || []); setLoading(false)
  }

  async function sendResetEmail(u) {
    setResetStatus(p => ({ ...p, [u.id]: 'sending' }))
    await supabase.auth.resetPasswordForEmail(u.email, { redirectTo: `${window.location.origin}/reset-password` })
    setResetStatus(p => ({ ...p, [u.id]: 'sent' }))
    setTimeout(() => setResetStatus(p => ({ ...p, [u.id]: undefined })), 3500)
  }

  async function deleteUser(u) {
    if (u.id === currentUser?.id) { alert('본인 계정은 삭제할 수 없습니다.'); return }
    const uname = toUsername(u.email)
    if (!confirm(`[${uname}] 계정을 삭제하시겠습니까?\n\n소프트 딜리트 처리되며 "삭제 내역" 메뉴에서 복구할 수 있습니다.\n(Supabase Auth 자격증명은 Dashboard에서 별도 정리 필요)`)) return
    const { error } = await supabase.from('users').update({
      deleted_at: new Date().toISOString(),
      deleted_by: currentUser?.id || null,
    }).eq('id', u.id)
    if (error) { alert(error.message); return }
    fetchUsers()
  }

  function handleSaved() { setModal(null); setSelected(null); fetchUsers() }

  if (!isMaster) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="text-center">
          <Shield size={44} className="text-gray-200 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-700">마스터 전용 페이지입니다</p>
          <p className="text-sm text-gray-400 mt-1">접근 권한이 없습니다</p>
        </div>
      </div>
    )
  }

  const roleCounts = ROLES.reduce((acc, r) => { acc[r.value] = users.filter(u => u.role === r.value).length; return acc }, {})

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827' }}>사용자 관리</h1>
        <RegisterBtn onClick={() => setModal('new')}>사용자 추가</RegisterBtn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e9ecef', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', padding: 24 }}>
          <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 14, fontWeight: 500 }}>전체</p>
          <p style={{ fontSize: 40, fontWeight: 700, color: '#111827', lineHeight: 1.1 }}>{users.length}</p>
        </div>
        {ROLES.map(role => (
          <div key={role.value} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e9ecef', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', padding: 24 }}>
            <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 14, color: role.color }}>{role.label}</p>
            <p style={{ fontSize: 40, fontWeight: 700, color: '#111827', lineHeight: 1.1 }}>{roleCounts[role.value] || 0}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader title="사용자 목록" />
        {loading ? (
          <div className="py-20 flex items-center justify-center"><Spinner /></div>
        ) : users.length === 0 ? (
          <EmptyState icon={UsersIcon} text="등록된 사용자가 없습니다" />
        ) : (
          <div>
            {users.map((u, i) => {
              const role = ROLES.find(r => r.value === u.role) || ROLES[2]
              const isSelf = u.id === currentUser?.id
              const rs = resetStatus[u.id]
              return (
                <div key={u.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '16px 24px',
                    borderBottom: i < users.length - 1 ? '1px solid #f9fafb' : 'none',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                    style={{ backgroundColor: role.bg, color: role.color }}>
                    {(u.name?.[0] || u.email?.[0] || '?').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{u.name || '이름 없음'}</p>
                      {isSelf && <Badge label="나" color="#92400e" bg="#fef3c7" />}
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{toUsername(u.email)}</p>
                  </div>
                  <Badge label={role.label} color={role.color} bg={role.bg} />
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setSelected(u); setModal('edit-role') }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        height: 36, padding: '0 24px',
                        fontSize: 14, fontWeight: 500,
                        borderRadius: 8, cursor: 'pointer',
                        backgroundColor: '#fff', border: '1px solid #e5e7eb', color: '#6b7280',
                        whiteSpace: 'nowrap', transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#fff')}>
                      <Shield size={13} /> 권한
                    </button>
                    <button onClick={() => sendResetEmail(u)} disabled={!!rs}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        height: 36, padding: '0 24px',
                        fontSize: 14, fontWeight: 500,
                        borderRadius: 8, cursor: rs ? 'default' : 'pointer',
                        whiteSpace: 'nowrap', transition: 'background 0.15s',
                        ...(rs === 'sent'
                          ? { backgroundColor: '#d1fae5', border: '1px solid #86efac', color: '#065f46' }
                          : { backgroundColor: '#fff',    border: '1px solid #e5e7eb', color: '#6b7280' }),
                      }}>
                      {rs === 'sending' ? (
                        <div style={{ width: 14, height: 14, border: '2px solid #9ca3af', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                      ) : rs === 'sent' ? (
                        <><Check size={13} /> 전송됨</>
                      ) : (
                        <><Key size={13} /> 비밀번호 재설정</>
                      )}
                    </button>
                    {!isSelf && (
                      <button onClick={() => deleteUser(u)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          height: 36, padding: '0 24px',
                          fontSize: 14, fontWeight: 500,
                          borderRadius: 8, cursor: 'pointer',
                          backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
                          whiteSpace: 'nowrap', transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#fee2e2')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#fef2f2')}>
                        <Trash2 size={13} /> 삭제
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <div style={{ marginTop: 24 }}>
      <InfoBanner type="brand">
        <strong>💡 비밀번호 재설정 안내</strong><br />
        비밀번호 재설정 버튼을 누르면 해당 사용자 이메일로 재설정 링크가 전송됩니다.
        신규 계정은 생성 즉시 로그인 가능합니다 (이메일 인증 비활성화됨).
      </InfoBanner>
      </div>

      {modal === 'new' && <NewUserModal onClose={() => setModal(null)} onSave={handleSaved} />}
      {modal === 'edit-role' && selected && <EditRoleModal targetUser={selected} onClose={() => { setModal(null); setSelected(null) }} onSave={handleSaved} />}
    </div>
  )
}
