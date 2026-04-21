import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Trash2, RotateCcw, X, Shield } from 'lucide-react'
import { Card, Btn, EmptyState, Spinner, Th, Td, Badge, LotBadge } from '../components/UI'

// ── 모듈 정의: 각 탭 ─────────────────────────────────────────
// selectExtra: 조인된 관계 컬럼 (예: 품목명 등)
// cols: 표시할 컬럼 [{key, label, render?}]
const MODULES = [
  {
    key: 'items', label: '품목',
    table: 'items',
    selectExtra: '',
    title: r => r.name,
    cols: [
      { key: 'code', label: '코드', render: r => <LotBadge>{r.code}</LotBadge> },
      { key: 'name', label: '품명', render: r => <b>{r.name}</b> },
      { key: 'category', label: '카테고리' },
      { key: 'unit', label: '단위' },
    ],
  },
  {
    key: 'raw_materials', label: '원자재',
    table: 'raw_materials', selectExtra: '',
    cols: [
      { key: 'code', label: '코드', render: r => <LotBadge>{r.code}</LotBadge> },
      { key: 'name', label: '원자재명', render: r => <b>{r.name}</b> },
      { key: 'unit', label: '단위' },
    ],
  },
  {
    key: 'partners', label: '거래처',
    table: 'partners', selectExtra: '',
    cols: [
      { key: 'code', label: '코드', render: r => <LotBadge>{r.code}</LotBadge> },
      { key: 'name', label: '거래처명', render: r => <b>{r.name}</b> },
      { key: 'type', label: '유형' },
    ],
  },
  {
    key: 'receiving_lots', label: '입고',
    table: 'receiving_lots',
    selectExtra: ', raw_materials(name)',
    cols: [
      { key: 'lot_number', label: 'LOT', render: r => <LotBadge>{r.lot_number}</LotBadge> },
      { key: 'material', label: '원자재', render: r => r.raw_materials?.name || '—' },
      { key: 'quantity', label: '수량', render: r => `${Number(r.quantity || 0).toLocaleString()} ${r.unit || ''}` },
      { key: 'received_date', label: '입고일' },
    ],
  },
  {
    key: 'production_records', label: '생산',
    table: 'production_records',
    selectExtra: ', items(name, code)',
    cols: [
      { key: 'record_number', label: '생산번호', render: r => <LotBadge>{r.record_number}</LotBadge> },
      { key: 'item', label: '품목', render: r => r.items?.name || '—' },
      { key: 'output_qty', label: '생산량', render: r => Number(r.output_qty || 0).toLocaleString() },
      { key: 'production_date', label: '생산일' },
    ],
  },
  {
    key: 'packaging_records', label: '포장',
    table: 'packaging_records',
    selectExtra: ', items(name, code)',
    cols: [
      { key: 'batch_number', label: '배치', render: r => <LotBadge>{r.batch_number}</LotBadge> },
      { key: 'item', label: '품목', render: r => r.items?.name || '—' },
      { key: 'quantity', label: '수량', render: r => `${Number(r.quantity || 0).toLocaleString()} 박스` },
      { key: 'packaged_date', label: '포장일' },
    ],
  },
  {
    key: 'shipping_orders', label: '출고',
    table: 'shipping_orders',
    selectExtra: ', partners(name)',
    cols: [
      { key: 'order_number', label: '출고번호', render: r => <LotBadge>{r.order_number}</LotBadge> },
      { key: 'partner', label: '거래처', render: r => r.partners?.name || '—' },
      { key: 'shipping_date', label: '출고일' },
      { key: 'status', label: '상태', render: r => <Badge label={r.status} color="#6b7280" bg="#f3f4f6" /> },
    ],
  },
  {
    key: 'waste_records', label: '파지',
    table: 'waste_records', selectExtra: '',
    cols: [
      { key: 'waste_date', label: '발생일' },
      { key: 'waste_type', label: '유형' },
      { key: 'quantity', label: '수량', render: r => `${Number(r.quantity || 0).toLocaleString()} ${r.unit || ''}` },
      { key: 'reason', label: '사유', render: r => <span style={{ color: '#6b7280' }}>{r.reason || '—'}</span> },
    ],
  },
  {
    key: 'users', label: '사용자',
    table: 'users', selectExtra: '',
    cols: [
      { key: 'email', label: '아이디', render: r => r.email?.split('@')[0] },
      { key: 'name', label: '이름', render: r => <b>{r.name}</b> },
      { key: 'role', label: '권한' },
    ],
  },
]

// ── 삭제자 프로필 캐시 ────────────────────────────────────
function useUserMap() {
  const [map, setMap] = useState({})
  useEffect(() => {
    supabase.from('users').select('id, name, email').then(({ data }) => {
      const m = {}
      ;(data || []).forEach(u => {
        m[u.id] = u.name || (u.email ? u.email.split('@')[0] : '—')
      })
      setMap(m)
    })
  }, [])
  return map
}

export default function DeletedItems() {
  const { profile, canRestore, canHardDelete } = useAuth()
  const [active, setActive] = useState(MODULES[0].key)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const userMap = useUserMap()

  const mod = useMemo(() => MODULES.find(m => m.key === active), [active])

  useEffect(() => { fetchDeleted() }, [active])

  async function fetchDeleted() {
    setLoading(true)
    const select = `*${mod.selectExtra}`
    const { data, error } = await supabase
      .from(mod.table)
      .select(select)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    if (error) {
      setRows([])
      setToast(`조회 오류: ${error.message}`)
    } else {
      setRows(data || [])
    }
    setLoading(false)
  }

  async function restore(row) {
    if (!canRestore) return
    if (!confirm('이 항목을 복구하시겠습니까?')) return
    const { error } = await supabase
      .from(mod.table)
      .update({ deleted_at: null, deleted_by: null, updated_by: profile?.id, updated_at: new Date().toISOString() })
      .eq('id', row.id)
    setToast(error ? `오류: ${error.message}` : '복구되었습니다')
    setTimeout(() => setToast(''), 2500)
    fetchDeleted()
  }

  async function hardDelete(row) {
    if (!canHardDelete) return
    if (!confirm('영구 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) return
    const { error } = await supabase.from(mod.table).delete().eq('id', row.id)
    setToast(error ? `오류: ${error.message}` : '영구 삭제되었습니다')
    setTimeout(() => setToast(''), 2500)
    fetchDeleted()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', lineHeight: 1.2, margin: 0 }}>삭제 내역</h1>
        {toast && <span style={{ fontSize: 14, color: toast.startsWith('오류') ? '#dc2626' : '#059669', fontWeight: 600 }}>{toast}</span>}
      </div>

      <Card>
        {/* 탭 스트립 */}
        <div style={{
          padding: '16px 24px 0', display: 'flex', gap: 4, flexWrap: 'wrap',
          borderBottom: '1px solid #e5e7eb',
        }}>
          {MODULES.map(m => {
            const isActive = active === m.key
            return (
              <button key={m.key} onClick={() => setActive(m.key)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '10px 24px', fontSize: 14, fontWeight: 600, lineHeight: 1,
                  background: isActive ? '#FF6B35' : '#e8e4dc',
                  color: isActive ? '#ffffff' : '#6b7280',
                  border: 'none', borderRadius: '8px 8px 0 0',
                  marginBottom: isActive ? -1 : 0,
                  cursor: 'pointer', transition: 'all 0.15s',
                  position: 'relative', zIndex: isActive ? 1 : 0,
                }}>
                {m.label}
              </button>
            )
          })}
        </div>

        {/* 리스트 */}
        {loading ? (
          <div style={{ padding: '72px 0', display: 'flex', justifyContent: 'center' }}><Spinner /></div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Trash2} text={`삭제된 ${mod.label} 항목이 없습니다`} />
        ) : (
          <div className="tbl-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {mod.cols.map(c => <Th key={c.key}>{c.label}</Th>)}
                <Th>삭제자</Th>
                <Th>삭제 일시</Th>
                <Th>관리</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  {mod.cols.map(c => (
                    <Td key={c.key}>{c.render ? c.render(r) : (r[c.key] ?? '—')}</Td>
                  ))}
                  <Td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Shield size={13} color="#9ca3af" />
                      {userMap[r.deleted_by] || '—'}
                    </span>
                  </Td>
                  <Td style={{ color: '#6b7280' }}>
                    {r.deleted_at ? new Date(r.deleted_at).toLocaleString('ko-KR') : '—'}
                  </Td>
                  <Td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {canRestore && (
                        <button onClick={() => restore(r)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            height: 32, padding: '0 14px', fontSize: 13, fontWeight: 600,
                            border: '1px solid #d1fae5', background: '#f0fdf4', color: '#059669',
                            borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap',
                          }}>
                          <RotateCcw size={12} /> 복구
                        </button>
                      )}
                      {canHardDelete && (
                        <button onClick={() => hardDelete(r)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            height: 32, padding: '0 14px', fontSize: 13, fontWeight: 600,
                            border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626',
                            borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap',
                          }}>
                          <X size={12} /> 영구삭제
                        </button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>
    </div>
  )
}
