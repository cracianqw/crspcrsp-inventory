import { useSupabaseStatus } from '../hooks/useSupabaseStatus'

export default function DbStatusBadge() {
  const { status, error } = useSupabaseStatus()

  const styles = {
    checking:  'bg-yellow-400/20 text-yellow-700',
    connected: 'bg-green-400/20 text-green-700',
    error:     'bg-red-400/20 text-red-700',
  }

  const labels = {
    checking:  '연결 확인 중…',
    connected: 'DB 연결됨',
    error:     `연결 오류: ${error}`,
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}
      title={error ?? undefined}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${
        status === 'connected' ? 'bg-green-500' :
        status === 'error'     ? 'bg-red-500' : 'bg-yellow-500'
      }`} />
      {labels[status]}
    </span>
  )
}
