import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Factory, X, Check, Camera, ChevronDown, ChevronUp, Trash2, Search } from 'lucide-react'
import {
  StatCard, Card, CardHeader, Btn, RegisterBtn,
  Label, Input, SelectInput, Textarea,
  ErrorBox, EmptyState, Spinner, Section,
  Th, Td, Badge, LotBadge, DateBadge, SearchInput,
  AuditStamp, useUserMap,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto relative">
        <div className="sticky top-0 bg-white px-8 pt-8 pb-5 z-10 border-b border-gray-100">
          <button onClick={onClose} className="absolute top-6 right-6 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
          <h2 className="text-xl font-bold text-gray-900">생산 기록 등록</h2>
        </div>

        <div className="px-8 py-7 space-y-7">
          {error && <ErrorBox msg={error} />}

          <Section title="기본 정보">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label required>완성품</Label>
                <SelectInput value={form.item_id} onChange={v => f('item_id', v)}>
                  <option value="">품목 선택...</option>
                  {items.map(item => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
                </SelectInput>
              </div>
              <div><Label required>생산일</Label><Input type="date" value={form.plan_date} onChange={v => f('plan_date', v)} /></div>
              <div><Label>계획 수량 (박스)</Label><Input type="number" value={form.planned_qty} onChange={v => f('planned_qty', v)} placeholder="0" /></div>
            </div>
          </Section>

          <Section title="투입 LOT"
            action={availableLots.length > 0 && (
              <button onClick={addLot} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">
                <Plus size={13} /> LOT 추가
              </button>
            )}>
            {lotInputs.length === 0 && (
              <p className="text-sm text-gray-400 py-2">
                {availableLots.length === 0 ? '사용 가능한 LOT이 없습니다. 입고 관리에서 먼저 등록해 주세요.' : 'LOT 추가 버튼으로 투입 원료를 등록하세요.'}
              </p>
            )}
            {lotInputs.map((li, idx) => (
              <div key={idx} className="flex gap-3 mb-3">
                <div className="flex-1"><SelectInput value={li.lot_id} onChange={v => updateLot(idx, 'lot_id', v)}>
                  <option value="">LOT 선택...</option>
                  {availableLots.map(lot => <option key={lot.id} value={lot.id}>{lot.lot_number} — {lot.material_name} (잔여 {Number(lot.remaining_qty).toFixed(1)}{lot.unit})</option>)}
                </SelectInput></div>
                <div className="w-32"><Input type="number" value={li.quantity_used} onChange={v => updateLot(idx, 'quantity_used', v)} placeholder="사용량" /></div>
                <button onClick={() => removeLot(idx)} className="px-3 rounded-lg border border-red-100 bg-red-50 text-red-500 hover:bg-red-100"><Trash2 size={14} /></button>
              </div>
            ))}
          </Section>

          <Section title="생산 결과">
            <div className="grid grid-cols-3 gap-4">
              <div><Label>실제 수량 (박스)</Label><Input type="number" value={form.actual_qty} onChange={v => f('actual_qty', v)} placeholder="0" /></div>
              <div><Label>파지 수량</Label><Input type="number" value={form.waste_qty} onChange={v => f('waste_qty', v)} placeholder="0" /></div>
              <div>
                <Label>수율</Label>
                <div className="h-11 flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-lg font-bold"
                  style={{ color: yieldRate ? (Number(yieldRate) >= 90 ? '#059669' : Number(yieldRate) >= 70 ? '#d97706' : '#dc2626') : '#9ca3af' }}>
                  {yieldRate ? `${yieldRate}%` : '—'}
                </div>
              </div>
            </div>
          </Section>

          <Section title={`검수 체크리스트 (${checkDone}/${QC_CHECKLIST.length})`}>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {QC_CHECKLIST.map((item, i) => (
                <button key={i} onClick={() => setChecklist(p => ({ ...p, [i]: !p[i] }))}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-left transition-all"
                  style={checklist[i] ? { backgroundColor: '#f0fdf4', border: '1px solid #86efac', color: '#166534' } : { backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', color: '#6b7280' }}>
                  <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                    style={checklist[i] ? { backgroundColor: '#22c55e' } : { backgroundColor: '#e5e7eb' }}>
                    {checklist[i] && <Check size={10} color="white" />}
                  </div>
                  {item}
                </button>
              ))}
            </div>
            <Label>검수 상태</Label>
            <div className="flex gap-2 mb-5">
              {QC_STATUS.map(s => (
                <button key={s.value} onClick={() => f('qc_status', s.value)}
                  className="flex-1 h-11 rounded-lg text-sm font-medium transition-all"
                  style={form.qc_status === s.value ? { backgroundColor: s.bg, color: s.color, border: `1.5px solid ${s.color}` } : { backgroundColor: '#f9fafb', color: '#9ca3af', border: '1.5px solid #e5e7eb' }}>
                  {s.label}
                </button>
              ))}
            </div>
            <Label>검수 메모</Label>
            <Textarea value={form.qc_notes} onChange={v => f('qc_notes', v)} rows={2} placeholder="검수 특이사항..." />
          </Section>

          <Section title="생산 사진">
            <div className="grid grid-cols-2 gap-3 mb-3">
              {PHOTO_TYPES.map(pt => (
                <label key={pt.value} className="flex flex-col items-center justify-center gap-2 h-24 rounded-lg border-2 border-dashed border-gray-200 cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition-all">
                  <input type="file" accept="image/*" multiple className="hidden" data-photo-type={pt.value} onChange={handlePhotoAdd} />
                  <Camera size={18} className="text-gray-300" />
                  <span className="text-xs text-gray-400">{pt.label}</span>
                </label>
              ))}
            </div>
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {photos.map((p, i) => (
                  <div key={i} className="relative group">
                    <img src={p.preview} alt="" className="w-16 h-16 object-cover rounded-lg border border-gray-100" />
                    <span className="absolute bottom-0 left-0 right-0 text-center text-white text-xs py-0.5 rounded-b-lg" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                      {PHOTO_TYPES.find(t => t.value === p.type)?.label}
                    </span>
                    <button onClick={() => removePhoto(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full hidden group-hover:flex items-center justify-center bg-red-500 text-white"><X size={10} /></button>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        <div className="sticky bottom-0 bg-white px-8 py-5 border-t border-gray-100 flex gap-3 justify-end">
          <Btn variant="secondary" onClick={onClose}>취소</Btn>
          <Btn disabled={saving} onClick={handleSave}>{saving ? '저장 중...' : '생산 기록 저장'}</Btn>
        </div>
      </div>
    </div>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
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
          <table className="w-full">
            <thead><tr>{['생산일', '품목', '계획', '실적', '파지', '수율', '검수', '등록', '수정', ''].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {filtered.map((record, i) => <ProductionRow key={record.id} record={record} index={i} userMap={userMap} />)}
            </tbody>
          </table>
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
