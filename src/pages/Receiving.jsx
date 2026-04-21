import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PackageOpen, Search } from 'lucide-react'
import { StatCard, Card, CardHeader, Btn, RegisterBtn, Label, Input, SelectInput, Textarea, Overlay, ModalHeader, ModalBody, ModalFooter, ErrorBox, EmptyState, Spinner, Th, Td, LotBadge, SearchInput } from '../components/UI'

function ReceivingModal({ rawMaterials, onClose, onSave }) {
  const { user } = useAuth()
  const [form, setForm] = useState({ raw_material_id: '', lot_number: '', quantity: '', unit: 'kg', received_at: new Date().toISOString().split('T')[0], supplier_name: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  function handleMaterialChange(id) {
    const mat = rawMaterials.find(r => r.id === id)
    setForm(p => ({ ...p, raw_material_id: id, unit: mat?.unit || 'kg' }))
  }

  async function handleSave() {
    if (!form.raw_material_id) { setError('원자재를 선택해 주세요.'); return }
    if (!form.lot_number) { setError('LOT 번호를 입력해 주세요.'); return }
    if (!form.quantity || Number(form.quantity) <= 0) { setError('수량을 입력해 주세요.'); return }
    setSaving(true); setError('')
    const { error } = await supabase.from('receiving_lots').insert({ ...form, quantity: Number(form.quantity), created_by: user?.id })
    if (error) setError(error.message); else onSave()
    setSaving(false)
  }

  return (
    <Overlay onClose={onClose} size="md">
      <ModalHeader>원자재 입고 등록</ModalHeader>
      <ModalBody>
        {error && <ErrorBox msg={error} />}
        <div>
          <Label required>원자재</Label>
          <SelectInput value={form.raw_material_id} onChange={handleMaterialChange}>
            <option value="">원자재 선택...</option>
            {rawMaterials.map(rm => <option key={rm.id} value={rm.id}>{rm.name} ({rm.unit})</option>)}
          </SelectInput>
          {rawMaterials.length === 0 && <p style={{ fontSize: 13, color: '#d97706', marginTop: 6 }}>품목 관리에서 원자재를 먼저 등록해 주세요.</p>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div><Label required>LOT 번호</Label><Input value={form.lot_number} onChange={v => f('lot_number', v)} placeholder="LOT-2025-001" /></div>
          <div><Label required>입고일</Label><Input type="date" value={form.received_at} onChange={v => f('received_at', v)} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div><Label required>수량</Label><Input type="number" value={form.quantity} onChange={v => f('quantity', v)} placeholder="0" /></div>
          <div><Label>단위</Label><Input value={form.unit} onChange={v => f('unit', v)} placeholder="kg" /></div>
        </div>
        <div><Label>공급업체</Label><Input value={form.supplier_name} onChange={v => f('supplier_name', v)} placeholder="(주)바다김" /></div>
        <div><Label>비고</Label><Textarea value={form.notes} onChange={v => f('notes', v)} rows={2} placeholder="특이사항..." /></div>
      </ModalBody>
      <ModalFooter>
        <Btn variant="secondary" onClick={onClose}>취소</Btn>
        <Btn disabled={saving} onClick={handleSave}>{saving ? '등록 중...' : '입고 등록'}</Btn>
      </ModalFooter>
    </Overlay>
  )
}

export default function Receiving() {
  const [lots, setLots] = useState([])
  const [rawMaterials, setRawMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: ls }, { data: rms }] = await Promise.all([
      supabase.from('raw_material_stock').select('*').order('received_at', { ascending: false }),
      supabase.from('raw_materials').select('*').order('name'),
    ])
    setLots(ls || []); setRawMaterials(rms || [])
    setLoading(false)
  }

  const filtered = lots.filter(l =>
    l.lot_number?.toLowerCase().includes(search.toLowerCase()) ||
    l.material_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.supplier_name?.toLowerCase().includes(search.toLowerCase())
  )

  const totalReceived  = lots.reduce((s, l) => s + (Number(l.received_qty) || 0), 0)
  const totalRemaining = lots.reduce((s, l) => s + (Number(l.remaining_qty) || 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827' }}>입고 관리</h1>
        <RegisterBtn onClick={() => setShowModal(true)}>입고 등록</RegisterBtn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="전체 LOT" value={lots.length} unit="건" />
        <StatCard label="총 입고량" value={totalReceived.toLocaleString()} sub="입고 누계" />
        <StatCard label="총 잔여량" value={totalRemaining.toFixed(1)} sub="현재 재고" />
      </div>

      <div style={{ marginBottom: 24 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="LOT번호, 원자재명, 공급업체 검색..." icon={Search} />
      </div>

      <Card>
        <CardHeader title="LOT 입고 이력" sub={`${filtered.length}건`} />
        {loading ? (
          <div style={{ padding: '72px 0', display: 'flex', justifyContent: 'center' }}><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={PackageOpen} text={search ? '검색 결과가 없습니다' : '등록된 입고 이력이 없습니다'} />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['LOT 번호', '원자재', '입고일', '입고량', '잔여량 / 사용률', '공급업체'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {filtered.map((lot, i) => {
                const remaining = Number(lot.remaining_qty) || 0
                const received  = Number(lot.received_qty)  || 0
                const pct = received > 0 ? ((received - remaining) / received) * 100 : 0
                const low = remaining < received * 0.2 && remaining > 0
                return (
                  <tr key={lot.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <Td><LotBadge>{lot.lot_number}</LotBadge></Td>
                    <Td><span style={{ fontWeight: 500, color: '#111827' }}>{lot.material_name}</span></Td>
                    <Td style={{ color: '#6b7280' }}>{lot.received_at ? new Date(lot.received_at).toLocaleDateString('ko-KR') : '—'}</Td>
                    <Td><span style={{ fontWeight: 600 }}>{received.toLocaleString()}</span> <span style={{ color: '#9ca3af', fontSize: 13 }}>{lot.unit}</span></Td>
                    <Td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontWeight: 600, fontSize: 15, color: remaining <= 0 ? '#9ca3af' : low ? '#d97706' : '#111827' }}>
                          {remaining.toFixed(1)} {lot.unit}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 64, height: 6, backgroundColor: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', backgroundColor: pct >= 100 ? '#d1d5db' : '#004634', borderRadius: 99 }} />
                          </div>
                          <span style={{ fontSize: 12, color: '#9ca3af' }}>{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                    </Td>
                    <Td style={{ color: '#6b7280' }}>{lot.supplier_name || '—'}</Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      {showModal && (
        <ReceivingModal rawMaterials={rawMaterials}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); fetchAll() }} />
      )}
    </div>
  )
}
