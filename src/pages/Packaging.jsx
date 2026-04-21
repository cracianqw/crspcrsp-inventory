import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Archive, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import {
  StatCard, Card, CardHeader, Btn, RegisterBtn,
  Label, Input, SelectInput, Textarea,
  Overlay, ModalHeader, ModalBody, ModalFooter,
  ErrorBox, EmptyState, Spinner, Badge, LotBadge,
  AuditStamp, useUserMap,
} from '../components/UI'

function genBatch() {
  const d = new Date()
  return `PKG-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${Math.floor(Math.random()*900+100)}`
}

function PackagingModal({ items, productions, onClose, onSave }) {
  const { user } = useAuth()
  const [form, setForm] = useState({ item_id: '', production_id: '', batch_number: genBatch(), packaged_at: new Date().toISOString().split('T')[0], notes: '' })
  const [expiryRows, setExpiryRows] = useState([{ expires_at: '', quantity: '' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const totalQty = expiryRows.reduce((s, r) => s + (Number(r.quantity) || 0), 0)

  async function handleSave() {
    if (!form.item_id) { setError('품목을 선택해 주세요.'); return }
    const valid = expiryRows.filter(r => r.expires_at && r.quantity)
    if (valid.length === 0) { setError('소비기한과 수량을 입력해 주세요.'); return }
    setSaving(true); setError('')
    try {
      for (const row of valid) {
        const { error: e } = await supabase.from('packaging_records').insert({
          item_id: form.item_id, production_id: form.production_id || null,
          batch_number: form.batch_number, quantity: Number(row.quantity),
          packaged_at: form.packaged_at, expires_at: row.expires_at,
          notes: valid.length > 1 ? `[혼재 ${valid.length}종] ${form.notes}`.trim() : form.notes || null,
          created_by: user?.id,
        })
        if (e) throw e
        await supabase.from('finished_goods_stock').insert({ batch_number: form.batch_number, item_id: form.item_id, quantity: Number(row.quantity), expires_at: row.expires_at })
      }
      onSave()
    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  return (
    <Overlay onClose={onClose} size="lg">
      <ModalHeader>완제품 포장 등록</ModalHeader>
      <ModalBody>
        {error && <ErrorBox msg={error} />}
        <div className="grid grid-cols-2 gap-4">
          <div><Label required>완성품</Label>
            <SelectInput value={form.item_id} onChange={v => f('item_id', v)}>
              <option value="">품목 선택...</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </SelectInput>
          </div>
          <div><Label>연결 생산기록</Label>
            <SelectInput value={form.production_id} onChange={v => f('production_id', v)}>
              <option value="">선택 안 함</option>
              {productions.map(p => <option key={p.id} value={p.id}>{new Date(p.plan_date).toLocaleDateString('ko-KR', { month:'short', day:'numeric' })} — {p.items?.name}</option>)}
            </SelectInput>
          </div>
          <div><Label required>배치번호</Label><Input value={form.batch_number} onChange={v => f('batch_number', v)} /></div>
          <div><Label required>포장일</Label><Input type="date" value={form.packaged_at} onChange={v => f('packaged_at', v)} /></div>
        </div>

        {/* 소비기한 혼재 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Label required>소비기한 · 수량</Label>
              {expiryRows.length > 1 && <Badge label={`혼재 ${expiryRows.length}종`} color="#d97706" bg="#fef3c7" />}
            </div>
            <button onClick={() => setExpiryRows(p => [...p, { expires_at: '', quantity: '' }])}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">
              <Plus size={12} /> 소비기한 추가
            </button>
          </div>
          {expiryRows.map((row, idx) => (
            <div key={idx} className="flex gap-3 mb-2">
              <div className="flex-1">
                <Input type="date" value={row.expires_at} onChange={v => setExpiryRows(p => p.map((r, i) => i === idx ? { ...r, expires_at: v } : r))} />
              </div>
              <div className="w-32">
                <Input type="number" value={row.quantity} onChange={v => setExpiryRows(p => p.map((r, i) => i === idx ? { ...r, quantity: v } : r))} placeholder="박스수" />
              </div>
              {expiryRows.length > 1 && (
                <button onClick={() => setExpiryRows(p => p.filter((_, i) => i !== idx))}
                  className="px-3 rounded-lg border border-red-100 bg-red-50 text-red-500 hover:bg-red-100">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          {expiryRows.length > 1 && (
            <p className="text-right text-sm font-bold text-gray-700 mt-1">합계: {totalQty.toLocaleString()} 박스</p>
          )}
        </div>

        <div><Label>비고</Label><Textarea value={form.notes} onChange={v => f('notes', v)} rows={2} placeholder="특이사항..." /></div>
      </ModalBody>
      <ModalFooter>
        <Btn variant="secondary" onClick={onClose}>취소</Btn>
        <Btn disabled={saving} onClick={handleSave}>{saving ? '등록 중...' : '포장 등록'}</Btn>
      </ModalFooter>
    </Overlay>
  )
}

export default function Packaging() {
  const userMap = useUserMap()
  const [records, setRecords] = useState([])
  const [items, setItems] = useState([])
  const [productions, setProductions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: recs }, { data: its }, { data: prods }] = await Promise.all([
      supabase.from('packaging_records').select('*, items(name, code)').is('deleted_at', null).order('packaged_at', { ascending: false }),
      supabase.from('items').select('*').eq('is_active', true).is('deleted_at', null).order('name'),
      supabase.from('production_records').select('id, plan_date, items(name)').is('deleted_at', null).order('plan_date', { ascending: false }).limit(50),
    ])
    setRecords(recs || []); setItems(its || []); setProductions(prods || [])
    setLoading(false)
  }

  const grouped = records.reduce((acc, r) => {
    if (!acc[r.batch_number]) acc[r.batch_number] = {
      batch_number: r.batch_number, item: r.items, packaged_at: r.packaged_at,
      created_by: r.created_by, created_at: r.created_at,
      updated_by: r.updated_by, updated_at: r.updated_at,
      rows: [],
    }
    acc[r.batch_number].rows.push(r)
    return acc
  }, {})
  const batches = Object.values(grouped).sort((a, b) => (b.packaged_at || '').localeCompare(a.packaged_at || ''))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827' }}>완제품 포장</h1>
        <RegisterBtn onClick={() => setShowModal(true)}>포장 등록</RegisterBtn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard label="전체 배치" value={batches.length} unit="건" />
        <StatCard label="총 포장수량" value={records.reduce((s, r) => s + (Number(r.quantity) || 0), 0).toLocaleString()} unit="박스" />
        <StatCard label="소비기한 혼재 배치" value={Object.values(grouped).filter(b => b.rows.length > 1).length} unit="건" />
      </div>

      <Card>
        <CardHeader title="배치별 포장 이력" />
        {loading ? (
          <div className="py-20 flex items-center justify-center"><Spinner /></div>
        ) : batches.length === 0 ? (
          <EmptyState icon={Archive} text="등록된 포장 이력이 없습니다" />
        ) : (
          <div>
            {batches.map((batch, i) => {
              const isMixed = batch.rows.length > 1
              const totalQty = batch.rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0)
              const isOpen = expanded === batch.batch_number
              return (
                <div key={batch.batch_number} style={{ borderBottom: '1px solid #f9fafb' }}>
                  <div className="px-6 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpanded(isOpen ? null : batch.batch_number)}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <LotBadge>{batch.batch_number}</LotBadge>
                        {isMixed && <Badge label={`소비기한 혼재 ${batch.rows.length}종`} color="#d97706" bg="#fef3c7" />}
                      </div>
                      <p className="text-sm font-medium text-gray-900">{batch.item?.name || '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-gray-900">{totalQty.toLocaleString()} <span className="text-sm font-normal text-gray-400">박스</span></p>
                      <p className="text-xs text-gray-400 mt-0.5">{batch.packaged_at ? new Date(batch.packaged_at).toLocaleDateString('ko-KR') : '—'}</p>
                    </div>
                    <div style={{ minWidth: 110, borderLeft: '1px solid #f3f4f6', paddingLeft: 16 }}>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>등록</div>
                      <AuditStamp userName={userMap[batch.created_by]} at={batch.created_at} />
                    </div>
                    <div style={{ minWidth: 110, borderLeft: '1px solid #f3f4f6', paddingLeft: 16 }}>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>수정</div>
                      <AuditStamp userName={userMap[batch.updated_by]} at={batch.updated_at} />
                    </div>
                    {isOpen ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
                  </div>
                  {isOpen && (
                    <div className="px-6 pb-4 bg-gray-50/50">
                      <table className="w-full rounded-lg overflow-hidden border border-gray-100">
                        <thead>
                          <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                            {['소비기한', '수량 (박스)', '비고'].map(h => (
                              <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {batch.rows.map((row, ri) => (
                            <tr key={row.id} style={{ borderTop: ri > 0 ? '1px solid #f9fafb' : 'none' }}>
                              <td className="px-5 py-3 text-sm font-medium text-gray-900">{row.expires_at ? new Date(row.expires_at).toLocaleDateString('ko-KR') : '—'}</td>
                              <td className="px-5 py-3 text-sm font-bold text-gray-900">{Number(row.quantity).toLocaleString()}</td>
                              <td className="px-5 py-3 text-sm text-gray-400">{row.notes || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {showModal && (
        <PackagingModal items={items} productions={productions}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); fetchAll() }} />
      )}
    </div>
  )
}
