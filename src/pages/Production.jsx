import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Factory, X, Check, Camera, ChevronDown, ChevronUp, Trash2, Search } from 'lucide-react'
import {
  StatCard, Card, CardHeader, Btn, RegisterBtn,
  Label, Input, SelectInput, Textarea,
  Overlay, ModalHeader, ModalBody, ModalFooter,
  ErrorBox, EmptyState, Spinner, Section,
  Th, Td, Badge, LotBadge, DateBadge, SearchInput,
  AuditStamp, useUserMap, itemLabel,
} from '../components/UI'

const QC_STATUS = [
  { value: 'pending', label: '검수 대기', color: '#d97706', bg: '#fef3c7' },
  { value: 'pass',    label: '합격',      color: '#059669', bg: '#d1fae5' },
  { value: 'fail',    label: '불합격',    color: '#dc2626', bg: '#fee2e2' },
]
const PHOTO_TYPES = [
  { value: 'before', label: '작업 전' }, { value: 'during', label: '작업 중' },
  { value: 'complete', label: '완성' },  { value: 'inspection', label: '검수' },
]
const QC_CHECKLIST = ['원자재 상태 이상 없음','작업 환경 위생 확인','계량 정확성 확인','외관 검사 완료','중량 규격 적합','포장 상태 양호']

function ProductionModal({ items, availableLots, onClose, onSave }) {
  const { user } = useAuth()
  const [form, setForm] = useState({ item_id: '', plan_date: new Date().toISOString().split('T')[0], planned_qty: '', actual_qty: '', waste_qty: '', qc_status: 'pending', qc_notes: '' })
  const [lotInputs, setLotInputs] = useState([])
  const [checklist, setChecklist] = useState({})
  const [photos, setPhotos] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const yieldRate = form.actual_qty && form.planned_qty
    ? ((Number(form.actual_qty) / Number(form.planned_qty)) * 100).toFixed(1) : null

  function addLot() { setLotInputs(p => [...p, { lot_id: '', quantity_used: '' }]) }
  function updateLot(idx, key, val) { setLotInputs(p => p.map((l, i) => i === idx ? { ...l, [key]: val } : l)) }
  function removeLot(idx) { setLotInputs(p => p.filter((_, i) => i !== idx)) }

  function handlePhotoAdd(e) {
    const type = e.target.dataset.photoType || 'before'
    setPhotos(p => [...p, ...Array.from(e.target.files).map(file => ({ type, file, preview: URL.createObjectURL(file) }))])
  }
  function removePhoto(idx) {
    setPhotos(p => { URL.revokeObjectURL(p[idx].preview); return p.filter((_, i) => i !== idx) })
  }

  async function handleSave() {
    if (!form.item_id) { setError('품목을 선택해 주세요.'); return }
    setSaving(true); setError('')
    try {
      const { data: prod, error: e } = await supabase.from('production_records').insert({
        item_id: form.item_id, plan_date: form.plan_date,
        planned_qty: form.planned_qty ? Number(form.planned_qty) : null,
        actual_qty:  form.actual_qty  ? Number(form.actual_qty)  : null,
        waste_qty:   form.waste_qty   ? Number(form.waste_qty)   : null,
        yield_rate:  yieldRate        ? Number(yieldRate)        : null,
        qc_status: form.qc_status, qc_notes: form.qc_notes || null, created_by: user?.id,
      }).select().single()
      if (e) throw e
      const validLots = lotInputs.filter(l => l.lot_id && l.quantity_used)
      if (validLots.length > 0) {
        await supabase.from('production_lot_inputs').insert(validLots.map(l => ({ production_id: prod.id, lot_id: l.lot_id, quantity_used: Number(l.quantity_used) })))
      }
      for (const photo of photos) {
        const ext = photo.file.name.split('.').pop()
        const path = `${prod.id}/${photo.type}_${Date.now()}.${ext}`
        const { error: ue } = await supabase.storage.from('production-photos').upload(path, photo.file)
        if (!ue) await supabase.from('production_photos').insert({ production_id: prod.id, photo_type: photo.type, storage_path: path })
      }
      onSave()
    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  const checkDone = Object.values(checklist).filter(Boolean).length

  return (
    <Overlay onClose={onClose} size="lg">
      <ModalHeader sub="생산 실적 · 투입 LOT · 검수 · 사진을 함께 저장">생산 기록 등록</ModalHeader>
      <ModalBody>
        {error && <ErrorBox msg={error} />}

        <Section title="기본 정보">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <Label required>완성품</Label>
              <SelectInput value={form.item_id} onChange={v => f('item_id', v)}>
                <option value="">품목 선택...</option>
                {items.map(item => <option key={item.id} value={item.id}>{itemLabel(item, { withCode: true })}</option>)}
              </SelectInput>
            </div>
            <div>
              <Label required>생산일</Label>
              <Input type="date" value={form.plan_date} onChange={v => f('plan_date', v)} />
            </div>
            <div>
              <Label>계획 수량 (박스)</Label>
              <Input type="number" value={form.planned_qty} onChange={v => f('planned_qty', v)} placeholder="0" />
            </div>
          </div>
        </Section>

        <Section title="투입 LOT"
          action={availableLots.length > 0 && (
            <button type="button" onClick={addLot}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', borderRadius: 8, cursor: 'pointer' }}>
              <Plus size={13} /> LOT 추가
            </button>
          )}>
          {lotInputs.length === 0 && (
            <p style={{ fontSize: 14, color: '#9ca3af', padding: '4px 0' }}>
              {availableLots.length === 0 ? '사용 가능한 LOT이 없습니다. 입고 관리에서 먼저 등록해 주세요.' : 'LOT 추가 버튼으로 투입 원료를 등록하세요.'}
            </p>
          )}
          {lotInputs.map((li, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 48px', gap: 12, marginBottom: 10 }}>
              <SelectInput value={li.lot_id} onChange={v => updateLot(idx, 'lot_id', v)}>
                <option value="">LOT 선택...</option>
                {availableLots.map(lot => <option key={lot.id} value={lot.id}>{lot.lot_number} — {lot.material_name} (잔여 {Number(lot.remaining_qty).toFixed(1)}{lot.unit})</option>)}
              </SelectInput>
              <Input type="number" value={li.quantity_used} onChange={v => updateLot(idx, 'quantity_used', v)} placeholder="사용량" />
              <button type="button" onClick={() => removeLot(idx)}
                style={{ height: 48, width: 48, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #fecaca', background: '#fef2f2', color: '#dc2626', borderRadius: 10, cursor: 'pointer' }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </Section>

        <Section title="생산 결과">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <Label>실제 수량 (박스)</Label>
              <Input type="number" value={form.actual_qty} onChange={v => f('actual_qty', v)} placeholder="0" />
            </div>
            <div>
              <Label>파지 수량</Label>
              <Input type="number" value={form.waste_qty} onChange={v => f('waste_qty', v)} placeholder="0" />
            </div>
            <div>
              <Label>수율</Label>
              <div style={{
                height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#f9fafb',
                fontSize: 18, fontWeight: 700,
                color: yieldRate ? (Number(yieldRate) >= 90 ? '#059669' : Number(yieldRate) >= 70 ? '#d97706' : '#dc2626') : '#9ca3af',
              }}>
                {yieldRate ? `${yieldRate}%` : '—'}
              </div>
            </div>
          </div>
        </Section>

        <Section title={`검수 체크리스트 (${checkDone}/${QC_CHECKLIST.length})`}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
            {QC_CHECKLIST.map((item, i) => (
              <button key={i} type="button" onClick={() => setChecklist(p => ({ ...p, [i]: !p[i] }))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 10, textAlign: 'left', fontSize: 14,
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: checklist[i] ? '#f0fdf4' : '#f9fafb',
                  border: `1.5px solid ${checklist[i] ? '#86efac' : '#e5e7eb'}`,
                  color: checklist[i] ? '#166534' : '#6b7280',
                }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: checklist[i] ? '#22c55e' : '#e5e7eb',
                }}>
                  {checklist[i] && <Check size={11} color="#fff" />}
                </div>
                {item}
              </button>
            ))}
          </div>
          <div style={{ marginBottom: 20 }}>
            <Label>검수 상태</Label>
            <div style={{ display: 'flex', gap: 8 }}>
              {QC_STATUS.map(s => {
                const active = form.qc_status === s.value
                return (
                  <button key={s.value} type="button" onClick={() => f('qc_status', s.value)}
                    style={{
                      flex: 1, height: 48, fontSize: 14, fontWeight: 600,
                      borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                      background: active ? s.bg : '#f9fafb',
                      color: active ? s.color : '#9ca3af',
                      border: active ? `1.5px solid ${s.color}` : '1.5px solid #e5e7eb',
                    }}>
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>
          <Label>검수 메모</Label>
          <Textarea value={form.qc_notes} onChange={v => f('qc_notes', v)} rows={2} placeholder="검수 특이사항..." />
        </Section>

        <Section title="생산 사진">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            {PHOTO_TYPES.map(pt => (
              <label key={pt.value}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 8, height: 96, borderRadius: 10,
                  border: '2px dashed #e5e7eb', cursor: 'pointer', transition: 'all 0.15s',
                  background: '#fff',
                }}>
                <input type="file" accept="image/*" multiple style={{ display: 'none' }} data-photo-type={pt.value} onChange={handlePhotoAdd} />
                <Camera size={18} color="#d1d5db" />
                <span style={{ fontSize: 12, color: '#9ca3af' }}>{pt.label}</span>
              </label>
            ))}
          </div>
          {photos.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {photos.map((p, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={p.preview} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10, border: '1px solid #f3f4f6' }} />
                  <span style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center',
                    color: '#fff', fontSize: 11, padding: '2px 0', borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
                    background: 'rgba(0,0,0,0.5)',
                  }}>
                    {PHOTO_TYPES.find(t => t.value === p.type)?.label}
                  </span>
                  <button type="button" onClick={() => removePhoto(i)}
                    style={{
                      position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 999,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer',
                    }}>
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>
      </ModalBody>
      <ModalFooter>
        <Btn variant="secondary" onClick={onClose}>취소</Btn>
        <Btn disabled={saving} onClick={handleSave}>{saving ? '저장 중...' : '생산 기록 저장'}</Btn>
      </ModalFooter>
    </Overlay>
  )
}

function ProductionRow({ record, index, userMap }) {
  const [open, setOpen] = useState(false)
  const [lotInputs, setLotInputs] = useState([])
  const [photos, setPhotos] = useState([])
  const qc = QC_STATUS.find(s => s.value === record.qc_status) || QC_STATUS[0]

  async function loadDetail() {
    if (open) { setOpen(false); return }
    const [{ data: lots }, { data: ph }] = await Promise.all([
      supabase.from('production_lot_inputs').select('*, receiving_lots(lot_number, raw_materials(name))').eq('production_id', record.id),
      supabase.from('production_photos').select('*').eq('production_id', record.id),
    ])
    setLotInputs(lots || []); setPhotos(ph || []); setOpen(true)
  }

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors cursor-pointer" style={{ borderBottom: '1px solid #f9fafb' }} onClick={loadDetail}>
        <Td><DateBadge>{new Date(record.plan_date).toLocaleDateString('ko-KR', { month:'short', day:'numeric' })}</DateBadge></Td>
        <Td><span className="font-medium text-gray-900">{record.items?.name || '—'}</span></Td>
        <Td className="text-gray-600">{record.planned_qty?.toLocaleString() || '—'}</Td>
        <Td><span className="font-semibold text-gray-900">{record.actual_qty?.toLocaleString() || '—'}</span></Td>
        <Td className="text-gray-600">{record.waste_qty?.toLocaleString() || '—'}</Td>
        <Td>
          {record.yield_rate != null && (
            <span className="font-bold" style={{ color: record.yield_rate >= 90 ? '#059669' : record.yield_rate >= 70 ? '#d97706' : '#dc2626' }}>
              {Number(record.yield_rate).toFixed(1)}%
            </span>
          )}
        </Td>
        <Td><Badge label={qc.label} color={qc.color} bg={qc.bg} /></Td>
        <Td><AuditStamp userName={userMap[record.created_by]} at={record.created_at} /></Td>
        <Td><AuditStamp userName={userMap[record.updated_by]} at={record.updated_at} /></Td>
        <Td>{open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}</Td>
      </tr>
      {open && (
        <tr>
          <td colSpan={10} className="px-8 py-6 bg-gray-50/50" style={{ borderBottom: '1px solid #f9fafb' }}>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">투입 LOT</p>
                {lotInputs.length === 0 ? <p className="text-sm text-gray-400">기록 없음</p> : (
                  <div className="space-y-2">
                    {lotInputs.map(li => (
                      <div key={li.id} className="flex items-center gap-3">
                        <LotBadge>{li.receiving_lots?.lot_number}</LotBadge>
                        <span className="text-sm text-gray-500">{li.receiving_lots?.raw_materials?.name}</span>
                        <span className="text-sm font-medium text-gray-900 ml-auto">{li.quantity_used} 사용</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">사진</p>
                {photos.length === 0 ? <p className="text-sm text-gray-400">등록된 사진 없음</p> : (
                  <div className="flex flex-wrap gap-2">
                    {photos.map(ph => {
                      const { data } = supabase.storage.from('production-photos').getPublicUrl(ph.storage_path)
                      return (
                        <div key={ph.id} className="relative">
                          <img src={data.publicUrl} alt="" className="w-14 h-14 object-cover rounded-lg border border-gray-100" />
                          <span className="absolute bottom-0 left-0 right-0 text-center text-white text-xs py-0.5 rounded-b-lg" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                            {PHOTO_TYPES.find(t => t.value === ph.photo_type)?.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
            {record.qc_notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">검수 메모</p>
                <p className="text-sm text-gray-600">{record.qc_notes}</p>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

export default function Production() {
  const userMap = useUserMap()
  const [records, setRecords] = useState([])
  const [items, setItems] = useState([])
  const [availableLots, setAvailableLots] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: recs }, { data: its }, { data: lots }] = await Promise.all([
      supabase.from('production_records').select('*, items(name, code)').is('deleted_at', null).order('plan_date', { ascending: false }).limit(100),
      supabase.from('items').select('*').eq('is_active', true).is('deleted_at', null).order('name'),
      supabase.from('raw_material_stock').select('*').gt('remaining_qty', 0).order('received_at', { ascending: false }),
    ])
    setRecords(recs || []); setItems(its || []); setAvailableLots(lots || [])
    setLoading(false)
  }

  const filtered = records.filter(r =>
    r.items?.name?.toLowerCase().includes(search.toLowerCase()) || r.plan_date?.includes(search)
  )
  const totalActual = records.reduce((s, r) => s + (Number(r.actual_qty) || 0), 0)
  const yieldRecs = records.filter(r => r.yield_rate)
  const avgYield = yieldRecs.length > 0 ? (yieldRecs.reduce((s, r) => s + Number(r.yield_rate), 0) / yieldRecs.length).toFixed(1) : null
  const passRate = records.length > 0 ? ((records.filter(r => r.qc_status === 'pass').length / records.length) * 100).toFixed(0) : null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827' }}>생산 관리</h1>
        <RegisterBtn onClick={() => setShowModal(true)}>생산 기록 등록</RegisterBtn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard label="전체 기록" value={records.length} unit="건" />
        <StatCard label="총 생산량" value={totalActual.toLocaleString()} unit="박스" />
        <StatCard label="평균 수율" value={avgYield ?? '—'} unit={avgYield ? '%' : ''} />
        <StatCard label="합격률" value={passRate ?? '—'} unit={passRate ? '%' : ''} />
      </div>

      <div style={{ marginBottom: 24 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="품목명, 날짜 검색..." icon={Search} />
      </div>

      <Card>
        <CardHeader title="생산 기록" sub={`${filtered.length}건`} />
        {loading ? (
          <div className="py-20 flex items-center justify-center"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Factory} text={search ? '검색 결과가 없습니다' : '등록된 생산 기록이 없습니다'} />
        ) : (
          <div className="tbl-wrap"><table className="w-full">
            <thead><tr>{['생산일', '품목', '계획', '실적', '파지', '수율', '검수', '등록', '수정', ''].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {filtered.map((record, i) => <ProductionRow key={record.id} record={record} index={i} userMap={userMap} />)}
            </tbody>
          </table></div>
        )}
      </Card>

      {showModal && (
        <ProductionModal items={items} availableLots={availableLots}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); fetchAll() }} />
      )}
    </div>
  )
}
