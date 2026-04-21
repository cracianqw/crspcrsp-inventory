import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart3, Package, Wheat, RefreshCw } from 'lucide-react'
import { StatCard, Card, TabBar, Btn, EmptyState, Spinner, Th, Td, Badge, LotBadge, InfoBanner } from '../components/UI'

export default function Inventory() {
  const [tab, setTab] = useState('finished')
  const [rawStock, setRawStock] = useState([])
  const [finishedStock, setFinishedStock] = useState([])
  const [summary, setSummary] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: raw }, { data: fin }, { data: sum }] = await Promise.all([
      supabase.from('raw_material_stock').select('*').order('received_at', { ascending: false }),
      supabase.from('finished_goods_stock').select('*, items(name, code)').gt('quantity', 0).order('expires_at'),
      supabase.from('inventory_summary').select('*').order('item_name'),
    ])
    setRawStock(raw || []); setFinishedStock(fin || []); setSummary(sum || [])
    setLoading(false)
  }

  const totalFinished = finishedStock.reduce((s, r) => s + (Number(r.quantity) || 0), 0)
  const totalRaw = rawStock.reduce((s, r) => s + (Number(r.remaining_qty) || 0), 0)
  const soonExpiry = finishedStock.filter(r => { if (!r.expires_at) return false; const d = (new Date(r.expires_at) - new Date()) / 86400000; return d <= 7 && d >= 0 })

  const tabs = [
    { key: 'finished', label: '완제품 재고', icon: Package },
    { key: 'raw',      label: '원재료 재고', icon: Wheat },
    { key: 'summary',  label: '품목별 요약', icon: BarChart3 },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827' }}>재고 현황</h1>
        <Btn variant="secondary" onClick={fetchAll}><RefreshCw size={18} /> 새로고침</Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="완제품 재고" value={totalFinished.toLocaleString()} unit="박스" sub={`${summary.length}종`} />
        <StatCard label="원재료 잔여량" value={totalRaw.toFixed(1)} sub="통합 잔여" />
        <StatCard label="소비기한 임박" value={soonExpiry.length} unit="건" sub="7일 이내" alert={soonExpiry.length > 0} />
        <StatCard label="원재료 LOT" value={rawStock.length} unit="건" sub="전체 입고" />
      </div>

      {soonExpiry.length > 0 && (
        <div style={{ marginBottom: 24 }}>
        <InfoBanner type="warning">
          <p style={{ fontWeight: 600, marginBottom: 8 }}>⚠️ 소비기한 임박 품목 (7일 이내)</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {soonExpiry.map(r => { const diff = Math.ceil((new Date(r.expires_at) - new Date()) / 86400000); return (
              <span key={r.id} style={{ fontSize: 13, fontWeight: 500, padding: '3px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.6)' }}>
                {r.items?.name} — {r.batch_number} (D-{diff})
              </span>
            )})}
          </div>
        </InfoBanner>
        </div>
      )}

      <Card>
        <div style={{ padding: '0 24px', paddingTop: 16 }}>
          <TabBar tabs={tabs} active={tab} onChange={setTab} />
        </div>
        {loading ? (
          <div style={{ padding: '72px 0', display: 'flex', justifyContent: 'center' }}><Spinner /></div>
        ) : tab === 'finished' ? <FinishedTable data={finishedStock} />
          : tab === 'raw'      ? <RawTable data={rawStock} />
          :                      <SummaryTable data={summary} />}
      </Card>
    </div>
  )
}

function FinishedTable({ data }) {
  if (data.length === 0) return <EmptyState icon={Package} text="완제품 재고가 없습니다" />
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr>{['배치번호', '품목', '수량', '소비기한', 'D-Day'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
      <tbody>
        {data.map((r, i) => {
          const diff = r.expires_at ? Math.ceil((new Date(r.expires_at) - new Date()) / 86400000) : null
          const expired = diff !== null && diff < 0
          const urgent  = diff !== null && diff <= 7 && diff >= 0
          return (
            <tr key={r.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
              <Td><LotBadge>{r.batch_number}</LotBadge></Td>
              <Td><span style={{ fontWeight: 500, color: '#111827' }}>{r.items?.name}</span></Td>
              <Td><span style={{ fontWeight: 600, fontSize: 16 }}>{Number(r.quantity).toLocaleString()}</span> <span style={{ fontSize: 13, color: '#9ca3af' }}>박스</span></Td>
              <Td style={{ color: expired ? '#dc2626' : '#374151' }}>{r.expires_at ? new Date(r.expires_at).toLocaleDateString('ko-KR') : '—'}</Td>
              <Td>{diff !== null && <Badge label={expired ? `만료 ${Math.abs(diff)}일` : `D-${diff}`} color={expired ? '#dc2626' : urgent ? '#d97706' : '#059669'} bg={expired ? '#fee2e2' : urgent ? '#fef3c7' : '#d1fae5'} />}</Td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function RawTable({ data }) {
  if (data.length === 0) return <EmptyState icon={Wheat} text="원재료 재고가 없습니다" />
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr>{['LOT 번호', '원자재', '입고량', '잔여량', '사용률', '공급업체', '입고일'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
      <tbody>
        {data.map((r, i) => {
          const remaining = Number(r.remaining_qty) || 0, received = Number(r.received_qty) || 0
          const pct = received > 0 ? ((received - remaining) / received) * 100 : 0
          return (
            <tr key={r.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
              <Td><LotBadge>{r.lot_number}</LotBadge></Td>
              <Td><span style={{ fontWeight: 500, color: '#111827' }}>{r.material_name}</span></Td>
              <Td style={{ color: '#374151' }}>{received.toLocaleString()} {r.unit}</Td>
              <Td><span style={{ fontWeight: 600, color: remaining <= 0 ? '#9ca3af' : '#111827' }}>{remaining.toFixed(1)} {r.unit}</span></Td>
              <Td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 64, height: 6, backgroundColor: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}><div style={{ width: `${Math.min(pct,100)}%`, height: '100%', backgroundColor: pct >= 100 ? '#d1d5db' : '#004634', borderRadius: 99 }} /></div>
                  <span style={{ fontSize: 13, color: '#9ca3af' }}>{pct.toFixed(0)}%</span>
                </div>
              </Td>
              <Td style={{ color: '#6b7280' }}>{r.supplier_name || '—'}</Td>
              <Td style={{ color: '#6b7280' }}>{r.received_at ? new Date(r.received_at).toLocaleDateString('ko-KR') : '—'}</Td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function SummaryTable({ data }) {
  if (data.length === 0) return <EmptyState icon={BarChart3} text="재고 정보가 없습니다" />
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr>{['품목명', '코드', '총 재고', '배치 수', '가장 빠른 소비기한'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
      <tbody>
        {data.map((r, i) => (
          <tr key={r.item_id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
            <Td><span style={{ fontWeight: 500, color: '#111827' }}>{r.item_name}</span></Td>
            <Td><LotBadge>{r.item_code}</LotBadge></Td>
            <Td><span style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{Number(r.total_qty || 0).toLocaleString()}</span> <span style={{ fontSize: 13, color: '#9ca3af' }}>박스</span></Td>
            <Td style={{ color: '#6b7280' }}>{r.batch_count ?? 0}개</Td>
            <Td style={{ color: '#6b7280' }}>{r.nearest_expiry ? new Date(r.nearest_expiry).toLocaleDateString('ko-KR') : '—'}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
