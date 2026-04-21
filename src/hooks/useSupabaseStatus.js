import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useSupabaseStatus() {
  const [status, setStatus] = useState('checking') // checking | connected | error
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase
      .from('users')
      .select('count', { count: 'exact', head: true })
      .then(({ error }) => {
        if (error && error.code !== 'PGRST116') {
          // PGRST116 = table doesn't exist yet — still means DB is reachable
          if (error.message.includes('relation') || error.code === '42P01') {
            setStatus('connected')
          } else {
            setStatus('error')
            setError(error.message)
          }
        } else {
          setStatus('connected')
        }
      })
  }, [])

  return { status, error }
}
