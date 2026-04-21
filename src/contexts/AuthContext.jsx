import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase.from('users').select('*').eq('id', userId).maybeSingle()
    setProfile(data)
    setLoading(false)
  }

  async function signIn(email, password) {
    return supabase.auth.signInWithPassword({ email, password })
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const role = profile?.role
  const isMaster        = role === 'master'
  const isSeniorManager = role === 'master' || role === 'senior_manager'
  const isManager       = role === 'master' || role === 'senior_manager' || role === 'manager'
  const isWorker        = role === 'worker'

  // 기능별 헬퍼
  const canInsert        = isManager        // 등록
  const canUpdate        = isSeniorManager  // 수정
  const canDelete        = isSeniorManager  // 삭제 (소프트)
  const canManage        = isMaster         // 계정/권한 관리
  const canViewDeleted   = isSeniorManager  // 삭제 내역 열람
  const canRestore       = isSeniorManager  // 복구
  const canHardDelete    = isMaster         // 영구 삭제는 마스터만

  return (
    <AuthContext.Provider value={{
      user, profile, loading, signIn, signOut,
      role, isMaster, isSeniorManager, isManager, isWorker,
      canInsert, canUpdate, canDelete, canManage, canViewDeleted, canRestore, canHardDelete,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
