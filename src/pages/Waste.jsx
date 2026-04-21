import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Scissors } from 'lucide-react'
import {
  Card, CardHeader, Btn, RegisterBtn,
  Label, Input, SelectInput, Textarea,
  Overlay, ModalHeader, ModalBody, ModalFooter,
  ErrorBox, EmptyState, Spinner, Badge, LotBadge, DateBadge,
  Th, Td, AuditStamp, useUserMap,
} from '../components/UI'

const WASTE_TYPES = [
  { value: 'production', label: '생산 파지', color: '#d97706', bg: '#fef3c7' },
  { value: 'inspection', label: '검수 파지', color: '#dc2626', bg: '#fee2e2' },
  { value: 'other',      label: '기타',      color: '#6b7280', bg: '#f3f4f6' },
]

function WasteModal({ items, productions, onClose, onSave }) {
  const { user } = useAuth()
  const [form, setForm] = useState({ item_id: '', production_id: '', waste_type: 'production', quantity: '', reason: '', occurred_at: new Date().toISOString().split('T')[0] })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!form.item_id) { setError('품목을 선택해 주세요.'); return }
    if (!form.quantity || Number(form.quantity) <= 0) { setError('수량을 입력해 주세요.'); return }
    setSaving(true); setError('')
    const { error } = await supabase.from('waste_records').insert({ ...form, quantity: Number(form.quantity), production_id: form.production_id || null, created_by: user?.id })
    if (error) setError(error.message); else onSave()
    setSaving(false)
  }

  return (
    <Overlay onClose={onClose} size="md">
      <ModalHeader>파지 등록</ModalHeader>
      <ModalBody>
        {error && <ErrorBox msg={error} />}
        <div className="grid grid-cols-2 gap-4">
          <div><Label required>품목</Label>
            <SelectInput value={form.item_id} onChange={v => f('item_id', v)}>
              <option value="">품목 선택...</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </SelectInput>
          </div>
          <div><Label required>발생일</Label><Input type="date" value={form.occurred_at} onChange={v => f('occurred_at', v)} /></div>
        </div>
        <div>
          <Label>파지 유형</Label>
          <div className="flex gap-2">
            {WASTE_TYPES.map(wt => (
              <button key={wt.value} onClick={() => f('waste_type', wt.value)}
                className="flex-1 h-11 rounded-lg text-sm font-medium transition-all"
                style={form.waste_type === wt.value
                  ? { backgroundColor: wt.bg, color: wt.color, border: `1.5px solid ${wt.color}` }
                  : { backgroundColor: '#f9fafb', color: '#9ca3af', border: '1.5px solid #e5e7eb' }}>
                {wt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label required>수량</Label><Input type="number" value={form.quantity} onChange={v => f('quantity', v)} placeholder="0" /></div>
          <div><Label>연결 생산기록</Label>
            <SelectInput value={form.production_id} onChange={v => f('production_id', v)}>
              <option value="">선택 안 함</option>
              {productions.map(p => <option key={p.id} value={p.id}>{new Date(p.plan_date).toLocaleDateString('ko-KR', { month:'short', day:'numeric' })} — {p.items?.name}</option>)}
            </SelectInput>
          </div>
        </div>
        <div><Label>발생 사유</Label><Textarea value={form.reason} onChange={v => f('reason', v)} rows={3} placeholder="파지 발생 사유를 상세히 기록해 주세요..." /></div>
      </ModalBody>
      <ModalFooter>
        <Btn variant="secondary" onClick={onClose}>취소</Btn>
        <Btn disabled={saving} onClick={handleSave}>{saving ? '등록 중...' : '파지 등록'}</Btn>
      </ModalFooter>
    </Overlay>
  )
}

export default function Waste() {
  const userMap = useUserMap()
  const [records, setRecords] = useState([])
  const [items, setItems] = useState([])
  const [productions, setProductions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [typeFilter, setTypeFilter] = useState('all')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: recs }, { data: its }, { data: prods }] = await Promise.all([
      supabase.from('waste_records').select('*, items(name)').is('deleted_at', null).order('occurred_at', { ascending: false }),
      supabase.from('items').select('*').eq('is_active', true).is('deleted_at', null).order('name'),
      supabase.from('production_records').select('id, plan_date, items(name)').is('deleted_at', null).order('plan_date', { ascending: false }).limit(50),
    ])
    setRecords(recs || []); setItems(its || []); setProductions(prods || [])
    setLoading(false)
  }

  const filtered = typeFilter === 'all' ? records : records.filter(r => r.waste_type === typeFilter)
  const totalAll = records.reduce((s, r) => s + (Number(r.quantity) || 0), 0)
  const totals = WASTE_TYPES.reduce((acc, wt) => { acc[wt.value] = records.filter(r => r.waste_type === wt.value).reduce((s, r) => s + (Number(r.quantity) || 0), 0); return acc }, {})

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827' }}>파지 관리</h1>
        <RegisterBtn onClick={() => setShowModal(true)}>파지 등록</RegisterBtn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <button onClick={() => setTypeFilter('all')}
          style={{
            background: '#ffffff', borderRadius: 12, padding: 24, textAlign: 'left',
            cursor: 'pointer', transition: 'all 0.15s',
            border: typeFilter === 'all' ? '2px solid #004634' : '1px solid #e9ecef',
            boxShadow: typeFilter === 'all' ? '0 0 0 4px rgba(0,70,52,0.08)' : '0 4px 12px rgba(0,0,0,0.06)',
          }}>
          <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 14, fontWeight: 500 }}>전체</p>
          <p style={{ fontSize: 40, fontWeight: 700, color: typeFilter === 'all' ? '#004634' : '#111827', lineHeight: 1.1 }}>{totalAll.toLocaleString()}</p>
        </button>
        {WASTE_TYPES.map(wt => {
          const active = typeFilter === wt.value
          return (
            <button key={wt.value} onClick={() => setTypeFilter(wt.value)}
              style={{
                background: '#ffffff', borderRadius: 12, padding: 24, textAlign: 'left',
                cursor: 'pointer', transition: 'all 0.15s',
                border: active ? `2px solid ${wt.color}` : '1px solid #e9ecef',
                boxShadow: active ? `0 0 0 4px ${wt.bg}` : '0 4px 12px rgba(0,0,0,0.06)',
              }}>
              <p style={{ fontSize: 14, marginBottom: 14, fontWeight: 500, color: wt.color }}>{wt.label}</p>
              <p style={{ fontSize: 40, fontWeight: 700, color: '#111827', lineHeight: 1.1 }}>{(totals[wt.value] || 0).toLocaleString()}</p>
            </button>
          )
        })}
      </div>

      <Card>
        <CardHeader title="파지 기록" sub={`${filtered.length}건`} />
        {loading ? (
          <div className="py-20 flex items-center justify-center"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Scissors} text="등록된 파지 기록이 없습니다" />
        ) : (
          <table className="w-full">
            <thead><tr>{['발생일', '품목', '유형', '수량', '발생 사유', '등록', '수정'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {filtered.map((r, i) => {
                const wt = WASTE_TYPES.find(w => w.value === r.waste_type) || WASTE_TYPES[2]
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors" style={{ borderBottom: '1px solid #f9fafb' }}>
                    <Td><DateBadge>{r.occurred_at ? new Date(r.occurred_at).toLocaleDateString('ko-KR', { month:'short', day:'numeric' }) : '—'}</DateBadge></Td>
                    <Td><span className="font-medium text-gray-900">{r.items?.name || '—'}</span></Td>
                    <Td><Badge label={wt.label} color={wt.color} bg={wt.bg} /></Td>
                    <Td><span className="text-lg font-bold text-gray-900">{Number(r.quantity).toLocaleString()}</span></Td>
                    <Td className="text-gray-500 max-w-xs"><span className="truncate block">{r.reason || '—'}</span></Td>
                    <Td><AuditStamp userName={userMap[r.created_by]} at={r.created_at} /></Td>
                    <Td><AuditStamp userName={userMap[r.updated_by]} at={r.updated_at} /></Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      {showModal && (
        <WasteModal items={items} productions={productions}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); fetchAll() }} />
      )}
    </div>
  )
}
