import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Edit2, Package, Wheat, History, Power, PowerOff } from 'lucide-react'
import {
  Card, Btn, RegisterBtn, IconBtn,
  Label, Input, SelectInput,
  Overlay, ModalHeader, ModalBody, ModalFooter,
  ErrorBox, EmptyState, Spinner, Th, Td, Badge, LotBadge,
} from '../components/UI'

const CATEGORIES  = ['조미김', '구운김']
const UNITS       = ['봉', '캔']
const PACK_TYPES  = ['전장', '절단']
const RAW_UNITS   = ['kg', 'g', 'L', 'ml', '개', '롤', '장']

// 변경 감지: oldItem/newItem 비교하여 {field: {before, after}} 리턴
function diffItem(oldItem, newItem) {
  const tracked = ['code','name','category','unit','weight_g','sheet_count','packaging_type','raw_sheets_per_unit','shelf_life_days','is_active']
  const changes = {}
  for (const k of tracked) {
    const a = oldItem?.[k] ?? null
    const b = newItem?.[k] ?? null
    if (String(a) !== String(b)) changes[k] = { before: a, after: b }
  }
  return changes
}

async function logChange({ itemId, profile, action, changes }) {
  await supabase.from('item_change_logs').insert({
    item_id: itemId,
    user_id: profile?.id || null,
    user_name: profile?.name || profile?.email || null,
    action,
    changes: Object.keys(changes || {}).length ? changes : null,
  })
}

// ── 완성품 모달 ─────────────────────────────────────
function ItemModal({ item, profile, onClose, onSave }) {
  const [form, setForm] = useState({
    code:                item?.code || '',
    name:                item?.name || '',
    category:            item?.category || CATEGORIES[0],
    unit:                item?.unit || UNITS[0],
    weight_g:            item?.weight_g ?? '',
    sheet_count:         item?.sheet_count ?? '',
    packaging_type:      item?.packaging_type || PACK_TYPES[0],
    raw_sheets_per_unit: item?.raw_sheets_per_unit ?? '',
    shelf_life_days:     item?.shelf_life_days ?? 365,
    is_active:           item?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!form.code?.trim()) { setError('품목 코드를 입력해 주세요.'); return }
    if (!form.name?.trim()) { setError('품목명을 입력해 주세요.'); return }
    setSaving(true); setError('')

    // 중복 체크: 같은 code를 가진 다른 품목이 있으면 거부
    const { data: dup } = await supabase.from('items').select('id').eq('code', form.code.trim()).limit(1)
    if (dup && dup.length > 0 && dup[0].id !== item?.id) {
      setSaving(false); setError(`이미 사용 중인 품목 코드입니다: ${form.code}`); return
    }

    const payload = {
      code:                form.code.trim(),
      name:                form.name.trim(),
      category:            form.category,
      unit:                form.unit,
      weight_g:            form.weight_g  === '' ? null : Number(form.weight_g),
      sheet_count:         form.sheet_count === '' ? null : Number(form.sheet_count),
      packaging_type:      form.packaging_type,
      raw_sheets_per_unit: form.raw_sheets_per_unit === '' ? null : Number(form.raw_sheets_per_unit),
      shelf_life_days:     form.shelf_life_days === '' ? null : Number(form.shelf_life_days),
      is_active:           !!form.is_active,
    }

    if (item?.id) {
      const { error } = await supabase.from('items').update(payload).eq('id', item.id)
      if (error) { setError(error.message); setSaving(false); return }
      const changes = diffItem(item, payload)
      if (Object.keys(changes).length > 0) {
        const action = changes.is_active ? (payload.is_active ? 'activate' : 'deactivate') : 'update'
        await logChange({ itemId: item.id, profile, action, changes })
      }
    } else {
      const { data, error } = await supabase.from('items').insert(payload).select().single()
      if (error) { setError(error.message); setSaving(false); return }
      await logChange({ itemId: data.id, profile, action: 'create', changes: diffItem({}, payload) })
    }
    setSaving(false)
    onSave()
  }

  return (
    <Overlay onClose={onClose} size="lg">
      <ModalHeader>{item ? '완성품 수정' : '완성품 등록'}</ModalHeader>
      <ModalBody>
        {error && <ErrorBox msg={error} />}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <Label required>품목 코드</Label>
            <Input value={form.code} onChange={v => f('code', v)} placeholder="IT-001" />
          </div>
          <div>
            <Label required>품목명</Label>
            <Input value={form.name} onChange={v => f('name', v)} placeholder="CRSP CRSP 오리지널" />
          </div>
          <div>
            <Label required>카테고리</Label>
            <SelectInput value={form.category} onChange={v => f('category', v)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </SelectInput>
          </div>
          <div>
            <Label required>단위</Label>
            <SelectInput value={form.unit} onChange={v => f('unit', v)}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </SelectInput>
          </div>
          <div>
            <Label>중량 (g)</Label>
            <Input type="number" value={form.weight_g} onChange={v => f('weight_g', v)} placeholder="15" />
          </div>
          <div>
            <Label>매수 (sheet_count)</Label>
            <Input type="number" value={form.sheet_count} onChange={v => f('sheet_count', v)} placeholder="9" />
          </div>
          <div>
            <Label required>포장 타입</Label>
            <SelectInput value={form.packaging_type} onChange={v => f('packaging_type', v)}>
              {PACK_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
            </SelectInput>
          </div>
          <div>
            <Label>장당 원초 소요 (장/단위)</Label>
            <Input type="number" value={form.raw_sheets_per_unit} onChange={v => f('raw_sheets_per_unit', v)} placeholder="1" />
          </div>
          <div>
            <Label>소비기한 (일)</Label>
            <Input type="number" value={form.shelf_life_days} onChange={v => f('shelf_life_days', v)} placeholder="365" />
          </div>
          <div>
            <Label>상태</Label>
            <SelectInput value={form.is_active ? 'active' : 'inactive'} onChange={v => f('is_active', v === 'active')}>
              <option value="active">활성 (생산 중)</option>
              <option value="inactive">생산중지</option>
            </SelectInput>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Btn variant="secondary" onClick={onClose}>취소</Btn>
        <Btn disabled={saving} onClick={handleSave}>{saving ? '저장 중...' : '저장'}</Btn>
      </ModalFooter>
    </Overlay>
  )
}

// ── 원자재 모달 (기존 유지) ─────────────────────────
function RawMaterialModal({ item, onClose, onSave }) {
  const [form, setForm] = useState({ code: item?.code || '', name: item?.name || '', unit: item?.unit || 'kg' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!form.code?.trim() || !form.name?.trim()) { setError('코드와 품명은 필수입니다.'); return }
    setSaving(true); setError('')
    const payload = { code: form.code.trim(), name: form.name.trim(), unit: form.unit }
    const { error } = item?.id
      ? await supabase.from('raw_materials').update(payload).eq('id', item.id)
      : await supabase.from('raw_materials').insert(payload)
    if (error) setError(error.message); else onSave()
    setSaving(false)
  }

  return (
    <Overlay onClose={onClose} size="sm">
      <ModalHeader>{item ? '원자재 수정' : '원자재 등록'}</ModalHeader>
      <ModalBody>
        {error && <ErrorBox msg={error} />}
        <div><Label required>원자재 코드</Label><Input value={form.code} onChange={v => f('code', v)} placeholder="RM-001" /></div>
        <div><Label required>원자재명</Label><Input value={form.name} onChange={v => f('name', v)} placeholder="조미김 원초" /></div>
        <div><Label>단위</Label><SelectInput value={form.unit} onChange={v => f('unit', v)}>{RAW_UNITS.map(u => <option key={u} value={u}>{u}</option>)}</SelectInput></div>
      </ModalBody>
      <ModalFooter>
        <Btn variant="secondary" onClick={onClose}>취소</Btn>
        <Btn disabled={saving} onClick={handleSave}>{saving ? '저장 중...' : '저장'}</Btn>
      </ModalFooter>
    </Overlay>
  )
}

// ── 변경 이력 모달 ─────────────────────────────────
const FIELD_LABELS = {
  code: '품목 코드', name: '품목명', category: '카테고리', unit: '단위',
  weight_g: '중량(g)', sheet_count: '매수', packaging_type: '포장 타입',
  raw_sheets_per_unit: '장당 원초 소요', shelf_life_days: '소비기한(일)',
  is_active: '활성 상태',
}
const ACTION_LABELS = {
  create: { label: '생성', color: '#059669', bg: '#d1fae5' },
  update: { label: '수정', color: '#2563eb', bg: '#dbeafe' },
  activate: { label: '활성화', color: '#059669', bg: '#d1fae5' },
  deactivate: { label: '생산중지', color: '#9ca3af', bg: '#f3f4f6' },
}
function fmtVal(v) {
  if (v === true) return '활성'; if (v === false) return '생산중지'
  if (v == null || v === '') return '—'
  return String(v)
}

function HistoryModal({ item, onClose }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('item_change_logs').select('*').eq('item_id', item.id).order('created_at', { ascending: false })
      .then(({ data }) => { setLogs(data || []); setLoading(false) })
  }, [item.id])
  return (
    <Overlay onClose={onClose} size="lg">
      <ModalHeader sub={`${item.code} · ${item.name}`}>변경 이력</ModalHeader>
      <ModalBody>
        {loading ? <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Spinner /></div>
          : logs.length === 0 ? <EmptyState icon={History} text="변경 이력이 없습니다" /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {logs.map(log => {
              const a = ACTION_LABELS[log.action] || { label: log.action, color: '#6b7280', bg: '#f3f4f6' }
              return (
                <div key={log.id} style={{ padding: 16, border: '1px solid #f3f4f6', borderRadius: 10, background: '#fafafa' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <Badge label={a.label} color={a.color} bg={a.bg} />
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{log.user_name || '—'}</span>
                    <span style={{ fontSize: 13, color: '#9ca3af', marginLeft: 'auto' }}>
                      {new Date(log.created_at).toLocaleString('ko-KR')}
                    </span>
                  </div>
                  {log.changes && Object.keys(log.changes).length > 0 && (
                    <div style={{ fontSize: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {Object.entries(log.changes).map(([field, { before, after }]) => (
                        <div key={field} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                          <span style={{ fontWeight: 600, color: '#374151', minWidth: 140 }}>{FIELD_LABELS[field] || field}</span>
                          {log.action === 'create' ? (
                            <span style={{ color: '#111827' }}>{fmtVal(after)}</span>
                          ) : (
                            <>
                              <span style={{ color: '#9ca3af', textDecoration: 'line-through' }}>{fmtVal(before)}</span>
                              <span style={{ color: '#6b7280' }}>→</span>
                              <span style={{ color: '#004634', fontWeight: 500 }}>{fmtVal(after)}</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </ModalBody>
      <ModalFooter><Btn variant="secondary" onClick={onClose}>닫기</Btn></ModalFooter>
    </Overlay>
  )
}

// ── 메인 ─────────────────────────────────────────────
export default function Items() {
  const { isMaster, profile } = useAuth()
  // 마스터 계정만 추가/수정/생산중지/이력 가능 — 일반 사용자는 조회 전용
  const canEdit = isMaster
  const [tab, setTab] = useState('items')
  const [items, setItems] = useState([])
  const [rawMaterials, setRawMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [activeFilter, setActiveFilter] = useState('active') // 'active' | 'all' | 'inactive'

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: its }, { data: rms }] = await Promise.all([
      supabase.from('items').select('*').order('code'),
      supabase.from('raw_materials').select('*').order('code'),
    ])
    setItems(its || []); setRawMaterials(rms || [])
    setLoading(false)
  }

  async function toggleActive(item) {
    const next = !item.is_active
    const msg = next ? '이 품목을 다시 활성화(생산 재개) 하시겠습니까?' : '이 품목을 생산중지 처리하시겠습니까?\n(데이터는 보존되며 언제든지 재활성화할 수 있습니다)'
    if (!confirm(msg)) return
    const { error } = await supabase.from('items').update({ is_active: next }).eq('id', item.id)
    if (error) { alert(error.message); return }
    await logChange({
      itemId: item.id, profile,
      action: next ? 'activate' : 'deactivate',
      changes: { is_active: { before: item.is_active, after: next } },
    })
    fetchAll()
  }

  function handleSaved() { setModal(null); setSelected(null); fetchAll() }

  const filtered = useMemo(() => {
    if (activeFilter === 'active')   return items.filter(i => i.is_active)
    if (activeFilter === 'inactive') return items.filter(i => !i.is_active)
    return items
  }, [items, activeFilter])
  const activeCount   = items.filter(i => i.is_active).length
  const inactiveCount = items.length - activeCount

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', lineHeight: 1.2, display: 'flex', alignItems: 'center', margin: 0 }}>품목 관리</h1>
        {canEdit && (
          <RegisterBtn onClick={() => { setSelected(null); setModal(tab === 'items' ? 'new-item' : 'new-raw') }}>
            품목 추가
          </RegisterBtn>
        )}
      </div>

      <Card>
        <div style={{
          padding: '16px 24px 0', display: 'flex', gap: 4,
          borderBottom: '1px solid #e5e7eb',
        }}>
          {[
            { key: 'items', label: '완성품', icon: Package },
            { key: 'raw',   label: '원자재', icon: Wheat },
          ].map(t => {
            const active = tab === t.key
            const Icon = t.icon
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '10px 48px', fontSize: 14, fontWeight: 600, lineHeight: 1,
                  textAlign: 'center',
                  background: active ? '#FF6B35' : '#e8e4dc',
                  color: active ? '#ffffff' : '#6b7280',
                  border: 'none',
                  borderRadius: '8px 8px 0 0',
                  marginBottom: active ? -1 : 0,
                  cursor: 'pointer', transition: 'all 0.15s',
                  position: 'relative', zIndex: active ? 1 : 0,
                }}>
                <Icon size={15} />{t.label}
              </button>
            )
          })}
        </div>

        {/* 완성품 탭의 필터 */}
        {tab === 'items' && !loading && (
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}>
            {[
              { v: 'active',   label: `활성 (${activeCount})` },
              { v: 'all',      label: `전체 (${items.length})` },
              { v: 'inactive', label: `생산중지 (${inactiveCount})` },
            ].map(o => (
              <button key={o.v} onClick={() => setActiveFilter(o.v)}
                style={{
                  padding: '8px 16px', fontSize: 14, fontWeight: 600,
                  border: 'none', borderRadius: 8, cursor: 'pointer',
                  background: activeFilter === o.v ? '#004634' : '#f5f5f0',
                  color: activeFilter === o.v ? '#fff' : '#6b7280',
                  transition: 'all 0.15s',
                }}>
                {o.label}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '72px 0', display: 'flex', justifyContent: 'center' }}><Spinner /></div>
        ) : tab === 'items' ? (
          filtered.length === 0 ? <EmptyState icon={Package} text={activeFilter === 'inactive' ? '생산중지 품목이 없습니다' : '등록된 완성품이 없습니다'} /> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['코드', '품명', '카테고리', '단위', '중량(g)', '매수', '포장', '장당원초', '소비기한', '상태', canEdit ? '관리' : ''].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
              <tbody>
                {filtered.map((item, i) => {
                  const dim = !item.is_active
                  const rowStyle = {
                    backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa',
                    opacity: dim ? 0.55 : 1,
                  }
                  return (
                    <tr key={item.id} style={rowStyle}>
                      <Td><LotBadge>{item.code}</LotBadge></Td>
                      <Td><span style={{ fontWeight: 500, color: '#111827' }}>{item.name}</span></Td>
                      <Td style={{ color: '#6b7280' }}>{item.category || '—'}</Td>
                      <Td style={{ color: '#6b7280' }}>{item.unit || '—'}</Td>
                      <Td style={{ color: '#6b7280' }}>{item.weight_g ?? '—'}</Td>
                      <Td style={{ color: '#6b7280' }}>{item.sheet_count ?? '—'}</Td>
                      <Td><Badge label={item.packaging_type || '—'} color="#6b7280" bg="#f3f4f6" /></Td>
                      <Td style={{ color: '#6b7280' }}>{item.raw_sheets_per_unit ?? '—'}</Td>
                      <Td style={{ color: '#6b7280' }}>{item.shelf_life_days ?? '—'}</Td>
                      <Td>
                        <Badge
                          label={item.is_active ? '활성' : '생산중지'}
                          color={item.is_active ? '#059669' : '#9ca3af'}
                          bg={item.is_active ? '#d1fae5' : '#f3f4f6'} />
                      </Td>
                      {canEdit && (
                        <Td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <IconBtn icon={Edit2} onClick={() => { setSelected(item); setModal('edit-item') }} label="수정" />
                            <IconBtn icon={History} onClick={() => { setSelected(item); setModal('history') }} label="변경 이력" />
                            <IconBtn
                              icon={item.is_active ? PowerOff : Power}
                              variant={item.is_active ? 'danger' : 'accent'}
                              onClick={() => toggleActive(item)}
                              label={item.is_active ? '생산중지' : '재활성화'} />
                          </div>
                        </Td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )
        ) : (
          rawMaterials.length === 0 ? <EmptyState icon={Wheat} text="등록된 원자재가 없습니다" /> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['코드', '원자재명', '단위', canEdit ? '관리' : ''].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
              <tbody>
                {rawMaterials.map((rm, i) => (
                  <tr key={rm.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <Td><LotBadge>{rm.code}</LotBadge></Td>
                    <Td><span style={{ fontWeight: 500, color: '#111827' }}>{rm.name}</span></Td>
                    <Td style={{ color: '#6b7280' }}>{rm.unit}</Td>
                    {canEdit && (
                      <Td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <IconBtn icon={Edit2} onClick={() => { setSelected(rm); setModal('edit-raw') }} label="수정" />
                        </div>
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </Card>

      {(modal === 'new-item' || modal === 'edit-item') && (
        <ItemModal item={selected} profile={profile} onClose={() => { setModal(null); setSelected(null) }} onSave={handleSaved} />
      )}
      {(modal === 'new-raw' || modal === 'edit-raw') && (
        <RawMaterialModal item={selected} onClose={() => { setModal(null); setSelected(null) }} onSave={handleSaved} />
      )}
      {modal === 'history' && selected && (
        <HistoryModal item={selected} onClose={() => { setModal(null); setSelected(null) }} />
      )}
    </div>
  )
}
