import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PackageOpen, Search } from 'lucide-react'
import { StatCard, Card, CardHeader, Btn, RegisterBtn, Label, Input, SelectInput, Textarea, Overlay, ModalHeader, ModalBody, ModalFooter, ErrorBox, EmptyState, Spinner, Th, Td, LotBadge, SearchInput, AuditStamp, useUserMap, itemLabel } from '../components/UI'

function ReceivingModal({ rawMaterials, outsourcedItems, onClose, onSave }) {
  const { user } = useAuth()
  const [mode, setMode] = useState('raw')  // 'raw' | 'outsourced'
  const [form, setForm] = useState({
    raw_material_id: '', lot_number: '', quantity: '', unit: 'kg',
    received_at: new Date().toISOString().split('T')[0],
    supplier_name: '', notes: '',
    // 외주 전용
    item_id: '', expiry_date: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  function handleMaterialChange(id) {
    const mat = rawMaterials.find(r => r.id === id)
    setForm(p => ({ ...p, raw_material_id: id, unit: mat?.unit || 'kg' }))
  }

  async function handleSaveRaw() {
    if (!form.raw_material_id) { setError('원자재를 선택해 주세요.'); return }
    if (!form.lot_number) { setError('LOT 번호를 입력해 주세요.'); return }
    if (!form.quantity || Number(form.quantity) <= 0) { setError('수량을 입력해 주세요.'); return }
    setSaving(true); setError('')
    const { error } = await supabase.from('receiving_lots').insert({
      raw_material_id: form.raw_material_id,
      lot_number: form.lot_number,
      quantity: Number(form.quantity),
      unit: form.unit,
      received_at: form.received_at,
      supplier_name: form.supplier_name,
      notes: form.notes,
      created_by: user?.id,
    })
    if (error) setError(error.message); else onSave()
    setSaving(false)
  }

  async function handleSaveOutsourced() {
    if (!form.item_id)                                 { setError('외주 완성품을 선택해 주세요.'); return }
    if (!form.quantity || Number(form.quantity) <= 0) { setError('수량을 입력해 주세요.'); return }
    setSaving(true); setError('')
    const batch = `OUT-${form.received_at.replace(/-/g,'')}-${String(Math.floor(Math.random()*900+100))}`
    // 1) outsourced_receipts 입고 이력
    const { error: e1 } = await supabase.from('outsourced_receipts').insert({
      item_id: form.item_id,
      quantity: Number(form.quantity),
      expiry_date: form.expiry_date || null,
      received_date: form.received_at,
      batch_number: batch,
      notes: form.notes || null,
      created_by: user?.id,
    })
    if (e1) { setError(e1.message); setSaving(false); return }
    // 2) finished_goods_stock 즉시 반영
    const { error: e2 } = await supabase.from('finished_goods_stock').insert({
      batch_number: batch,
      item_id: form.item_id,
      quantity: Number(form.quantity),
      expires_at: form.expiry_date || null,
    })
    if (e2) { setError(e2.message); setSaving(false); return }
    setSaving(false); onSave()
  }

  const handleSave = mode === 'raw' ? handleSaveRaw : handleSaveOutsourced

  return (
    <Overlay onClose={onClose} size="md">
      <ModalHeader>{mode === 'raw' ? '원자재' : '외주 완성품'} 입고 등록</ModalHeader>
      <ModalBody>
        {error && <ErrorBox msg={error} />}
        {/* 입고 유형 토글 */}
        <div style={{ display: 'inline-flex', background: '#f5f5f0', borderRadius: 10, padding: 4 }}>
          {[
            { v: 'raw',        label: '원자재' },
            { v: 'outsourced', label: '외주 완성품' },
          ].map(o => (
            <button key={o.v} type="button" onClick={() => setMode(o.v)}
              style={{
                padding: '10px 20px', fontSize: 14, fontWeight: 600,
                border: 'none', borderRadius: 8, cursor: 'pointer',
                background: mode === o.v ? '#004634' : 'transparent',
                color: mode === o.v ? '#fff' : '#6b7280',
              }}>{o.label}</button>
          ))}
        </div>

        {mode === 'raw' ? (
          <>
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
          </>
        ) : (
          <>
            <div>
              <Label required>외주 완성품</Label>
              <SelectInput value={form.item_id} onChange={v => f('item_id', v)}>
                <option value="">외주 완성품 선택...</option>
                {outsourcedItems.map(it => <option key={it.id} value={it.id}>{itemLabel(it, { withCode: true })}</option>)}
              </SelectInput>
              {outsourcedItems.length === 0 && <p style={{ fontSize: 13, color: '#d97706', marginTop: 6 }}>품목 관리에서 '외주' 생산 유형 품목을 먼저 등록해 주세요.</p>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div><Label required>입고일</Label><Input type="date" value={form.received_at} onChange={v => f('received_at', v)} /></div>
              <div><Label>소비기한</Label><Input type="date" value={form.expiry_date} onChange={v => f('expiry_date', v)} /></div>
            </div>
            <div><Label required>수량 (박스)</Label><Input type="number" value={form.quantity} onChange={v => f('quantity', v)} placeholder="0" /></div>
            <p style={{ fontSize: 12, color: '#6b7280', marginTop: -4 }}>
              외주 완성품은 LOT 없이 바로 완제품 재고로 반영됩니다. 배치번호는 자동 생성됩니다.
            </p>
          </>
        )}
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
  const userMap = useUserMap()
  const [lots, setLots] = useState([])
  const [audit, setAudit] = useState({})
  const [rawMaterials, setRawMaterials] = useState([])
  const [outsourcedItems, setOutsourcedItems] = useState([])
  const [outsourcedReceipts, setOutsourcedReceipts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: ls }, { data: lotRaw }, { data: rms }, { data: outItems }, { data: outReceipts }] = await Promise.all([
      supabase.from('raw_material_stock').select('*').order('received_at', { ascending: false }),
      supabase.from('receiving_lots').select('id, created_by, created_at, updated_by, updated_at').is('deleted_at', null),
      supabase.from('raw_materials').select('*').is('deleted_at', null).order('name'),
      supabase.from('items').select('*').eq('is_active', true).eq('production_type', 'outsourced').is('deleted_at', null).order('name'),
      supabase.from('outsourced_receipts').select('*, items(name, code)').is('deleted_at', null).order('received_date', { ascending: false }),
    ])
    const a = {}
    ;(lotRaw || []).forEach(r => { a[r.id] = r })
    setLots(ls || []); setAudit(a); setRawMaterials(rms || [])
    setOutsourcedItems(outItems || []); setOutsourcedReceipts(outReceipts || [])
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
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
          <div className="tbl-wrap"><table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['LOT 번호', '원자재', '입고일', '입고량', '잔여량 / 사용률', '공급업체', '등록', '수정'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
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
                    <Td><AuditStamp userName={userMap[audit[lot.id]?.created_by]} at={audit[lot.id]?.created_at} /></Td>
                    <Td><AuditStamp userName={userMap[audit[lot.id]?.updated_by]} at={audit[lot.id]?.updated_at} /></Td>
                  </tr>
                )
              })}
            </tbody>
          </table></div>
        )}
      </Card>

      {/* 외주 완성품 입고 이력 */}
      <div style={{ marginTop: 24 }}>
        <Card>
          <CardHeader title="외주 완성품 입고 이력" sub={`${outsourcedReceipts.length}건`} />
          {outsourcedReceipts.length === 0 ? (
            <EmptyState icon={PackageOpen} text="외주 입고 이력이 없습니다" />
          ) : (
            <div className="tbl-wrap"><table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['배치번호', '품목', '입고일', '수량', '소비기한', '비고'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
              <tbody>
                {outsourcedReceipts.map((r, i) => (
                  <tr key={r.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <Td><LotBadge>{r.batch_number || '—'}</LotBadge></Td>
                    <Td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 500, color: '#111827' }}>{r.items?.name || '—'}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: '#ffedd5', color: '#7c2d12' }}>외주</span>
                      </div>
                    </Td>
                    <Td style={{ color: '#6b7280' }}>{r.received_date ? new Date(r.received_date).toLocaleDateString('ko-KR') : '—'}</Td>
                    <Td><span style={{ fontWeight: 600 }}>{Number(r.quantity).toLocaleString()}</span> <span style={{ fontSize: 13, color: '#9ca3af' }}>박스</span></Td>
                    <Td style={{ color: '#6b7280' }}>{r.expiry_date ? new Date(r.expiry_date).toLocaleDateString('ko-KR') : '—'}</Td>
                    <Td style={{ color: '#6b7280' }}>{r.notes || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </Card>
      </div>

      {showModal && (
        <ReceivingModal rawMaterials={rawMaterials} outsourcedItems={outsourcedItems}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); fetchAll() }} />
      )}
    </div>
  )
}
