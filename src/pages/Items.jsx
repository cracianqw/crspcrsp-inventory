import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Edit2, Package, Wheat, History, Power, PowerOff, Trash2, Settings, ArrowUp, ArrowDown, Plus } from 'lucide-react'
import {
  Card, Btn, RegisterBtn, IconBtn,
  Label, Input, SelectInput,
  Overlay, ModalHeader, ModalBody, ModalFooter,
  ErrorBox, EmptyState, Spinner, Th, Td, Badge, LotBadge,
} from '../components/UI'

const CATEGORIES  = ['조미김', '구운김']
const UNITS       = ['봉', '캔']
const PACK_TYPES  = ['전장', '절단']
const PROD_TYPES  = [
  { value: 'internal',    label: '자체생산' },
  { value: 'outsourced',  label: '외주' },
]
const MONTHS = [1,2,3,4,5,6,7,8,9,10,11,12]
const PACK_UNIT_OPTIONS = ['', 'kg', 'g', 'L', 'ml', '개', '롤', '장', '속', '박스', '통', '포대']

// 변경 감지: oldItem/newItem 비교하여 {field: {before, after}} 리턴
function diffItem(oldItem, newItem) {
  const tracked = ['code','name','category','unit','weight_g','sheet_count','packaging_type','raw_sheets_per_unit','shelf_life_days','is_active','production_type']
  const changes = {}
  for (const k of tracked) {
    const a = oldItem?.[k] ?? null
    const b = newItem?.[k] ?? null
    if (String(a) !== String(b)) changes[k] = { before: a, after: b }
  }
  // 월별 안전재고는 JSON 비교 (변경 시 전체 기록)
  const oldSS = JSON.stringify(oldItem?.safety_stock_by_month || {})
  const newSS = JSON.stringify(newItem?.safety_stock_by_month || {})
  if (oldSS !== newSS) changes.safety_stock_by_month = { before: oldItem?.safety_stock_by_month, after: newItem?.safety_stock_by_month }
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
    production_type:     item?.production_type || 'internal',
    weight_g:            item?.weight_g ?? '',
    sheet_count:         item?.sheet_count ?? '',
    packaging_type:      item?.packaging_type || PACK_TYPES[0],
    raw_sheets_per_unit: item?.raw_sheets_per_unit ?? '',
    shelf_life_days:     item?.shelf_life_days ?? 365,
    is_active:           item?.is_active ?? true,
  })
  const [safetyStock, setSafetyStock] = useState(() => {
    const ss = item?.safety_stock_by_month || {}
    const obj = {}
    MONTHS.forEach(m => { obj[m] = ss[m] ?? ss[String(m)] ?? '' })
    return obj
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!form.code?.trim()) { setError('품목보고번호를 입력해 주세요.'); return }
    if (!form.name?.trim()) { setError('품목명을 입력해 주세요.'); return }
    setSaving(true); setError('')

    // 중복 체크: code + unit + weight_g + sheet_count 네 가지가 모두 동일할 때만 거부
    const weightVal = form.weight_g === '' ? null : Number(form.weight_g)
    const sheetVal  = form.sheet_count === '' ? null : Number(form.sheet_count)
    let dupQuery = supabase.from('items')
      .select('id')
      .eq('code', form.code.trim())
      .eq('unit', form.unit)
      .is('deleted_at', null)
    dupQuery = weightVal === null ? dupQuery.is('weight_g', null) : dupQuery.eq('weight_g', weightVal)
    dupQuery = sheetVal  === null ? dupQuery.is('sheet_count', null) : dupQuery.eq('sheet_count', sheetVal)
    const { data: dup } = await dupQuery.limit(1)
    if (dup && dup.length > 0 && dup[0].id !== item?.id) {
      setSaving(false)
      setError(`동일한 품목보고번호/단위/중량/매수 조합이 이미 존재합니다: ${form.code}`)
      return
    }

    // 월별 안전재고 payload 구성 (빈 값은 제외)
    const ssPayload = {}
    MONTHS.forEach(m => {
      const v = safetyStock[m]
      if (v !== '' && v != null) ssPayload[m] = Number(v)
    })

    const payload = {
      code:                form.code.trim(),
      name:                form.name.trim(),
      category:            form.category,
      unit:                form.unit,
      production_type:     form.production_type,
      weight_g:            form.weight_g  === '' ? null : Number(form.weight_g),
      sheet_count:         form.sheet_count === '' ? null : Number(form.sheet_count),
      packaging_type:      form.packaging_type,
      raw_sheets_per_unit: form.raw_sheets_per_unit === '' ? null : Number(form.raw_sheets_per_unit),
      shelf_life_days:     form.shelf_life_days === '' ? null : Number(form.shelf_life_days),
      is_active:           !!form.is_active,
      safety_stock_by_month: ssPayload,
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
            <Label required>품목보고번호</Label>
            <Input value={form.code} onChange={v => f('code', v)} placeholder="식약처 품목보고번호" />
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
            <Label required>생산 유형</Label>
            <SelectInput value={form.production_type} onChange={v => f('production_type', v)}>
              {PROD_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
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

        {/* 월별 안전재고 */}
        <div style={{ marginTop: 8 }}>
          <Label>월별 주간 안전재고 ({form.unit})</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
            {MONTHS.map(m => (
              <div key={m} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textAlign: 'center' }}>{m}월</span>
                <input
                  type="number" min={0}
                  value={safetyStock[m]}
                  onChange={e => setSafetyStock(p => ({ ...p, [m]: e.target.value }))}
                  placeholder="0"
                  style={{
                    width: '100%', height: 40, padding: '0 10px',
                    fontSize: 14, textAlign: 'center',
                    border: '1.5px solid #e5e7eb', borderRadius: 8,
                    outline: 'none', transition: 'border-color 0.15s',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#004634')}
                  onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
                />
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>
            설정된 월의 주간 재고가 해당 수량 미만일 때 재고부족 경고가 표시됩니다.
          </p>
        </div>
      </ModalBody>
      <ModalFooter>
        <Btn variant="secondary" onClick={onClose}>취소</Btn>
        <Btn disabled={saving} onClick={handleSave}>{saving ? '저장 중...' : '저장'}</Btn>
      </ModalFooter>
    </Overlay>
  )
}

// ── 원자재 모달 ─────────────────────────────────────
const FREE_TEXT_NAMES = ['기타', '직접입력']
const isFreeTextSub = sub => !!sub && FREE_TEXT_NAMES.includes(sub.name)
const codePrefixOf = cat => (cat?.name || '').slice(0, 2)

async function nextRawCode(category) {
  const prefix = codePrefixOf(category)
  if (!prefix) return ''
  const { data } = await supabase
    .from('raw_materials')
    .select('code')
    .ilike('code', `${prefix}-%`)
  const re = new RegExp(`^${prefix}-(\\d+)$`)
  const used = (data || [])
    .map(r => { const m = re.exec(r.code || ''); return m ? parseInt(m[1], 10) : null })
    .filter(n => Number.isFinite(n))
  const max = used.length ? Math.max(...used) : 0
  return `${prefix}-${String(max + 1).padStart(3, '0')}`
}

function RawMaterialModal({ item, categories, subcategories, onClose, onSave }) {
  const initialSub = subcategories.find(s => s.id === item?.subcategory_id) || null
  const [form, setForm] = useState({
    code:           item?.code || '',
    category_id:    item?.category_id || '',
    subcategory_id: item?.subcategory_id || '',
    custom_name:    initialSub && isFreeTextSub(initialSub) ? (item?.name || '') : '',
    inner_unit:     item?.inner_unit ?? item?.unit ?? '',
    outer_unit:     item?.outer_unit ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const filteredSubs = useMemo(
    () => subcategories.filter(s => s.category_id === form.category_id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [subcategories, form.category_id]
  )
  const selectedSub = subcategories.find(s => s.id === form.subcategory_id) || null
  const needsCustomName = isFreeTextSub(selectedSub)

  // 신규 등록: 카테고리 선택 시 다음 코드 자동 부여 (수정 모드는 기존 코드 유지)
  useEffect(() => {
    if (item?.id) return
    if (!form.category_id) { setForm(p => ({ ...p, code: '' })); return }
    const cat = categories.find(c => c.id === form.category_id)
    if (!cat) return
    let cancelled = false
    nextRawCode(cat).then(code => {
      if (!cancelled) setForm(p => ({ ...p, code }))
    })
    return () => { cancelled = true }
  }, [form.category_id, item?.id, categories])

  async function handleSave() {
    if (!form.code?.trim()) { setError('원자재 코드는 필수입니다.'); return }
    if (!form.category_id) { setError('카테고리를 선택해 주세요.'); return }
    if (!form.subcategory_id) { setError('항목을 선택해 주세요.'); return }
    const finalName = needsCustomName ? form.custom_name.trim() : (selectedSub?.name || '').trim()
    if (!finalName) { setError(needsCustomName ? '원자재명을 입력해 주세요.' : '항목명이 비어있습니다.'); return }
    setSaving(true); setError('')
    const payload = {
      code:           form.code.trim(),
      name:           finalName,
      category_id:    form.category_id,
      subcategory_id: form.subcategory_id,
      unit:           form.inner_unit || 'kg', // 기존 컬럼 호환 (입고/생산 화면에서 사용)
      inner_unit:     form.inner_unit || null,
      outer_unit:     form.outer_unit || null,
    }
    const { error } = item?.id
      ? await supabase.from('raw_materials').update(payload).eq('id', item.id)
      : await supabase.from('raw_materials').insert(payload)
    if (error) setError(error.message); else onSave()
    setSaving(false)
  }

  const sortedCategories = [...categories].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  return (
    <Overlay onClose={onClose} size="md">
      <ModalHeader>{item ? '원자재 수정' : '원자재 등록'}</ModalHeader>
      <ModalBody>
        {error && <ErrorBox msg={error} />}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <Label required>카테고리</Label>
            <SelectInput value={form.category_id} onChange={v => setForm(p => ({ ...p, category_id: v, subcategory_id: '', custom_name: '' }))}>
              <option value="">— 선택 —</option>
              {sortedCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </SelectInput>
          </div>
          <div>
            <Label required>항목</Label>
            <SelectInput value={form.subcategory_id} onChange={v => f('subcategory_id', v)}>
              <option value="">— 선택 —</option>
              {filteredSubs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </SelectInput>
          </div>
        </div>

        {needsCustomName && (
          <div style={{ marginTop: 16 }}>
            <Label required>원자재명 (직접 입력)</Label>
            <Input value={form.custom_name} onChange={v => f('custom_name', v)} placeholder="원자재명을 입력하세요" />
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <Label required>원자재 코드 (자호)</Label>
          <Input value={form.code} onChange={() => {}} disabled placeholder="카테고리 선택 시 자동 생성" />
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>
            카테고리별 자동 부여: {`{카테고리명 앞 2자}-{3자리 순번}`}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          <div>
            <Label>내포장 단위</Label>
            <SelectInput value={form.inner_unit} onChange={v => f('inner_unit', v)}>
              {PACK_UNIT_OPTIONS.map(u => <option key={u || 'none'} value={u}>{u || '없음'}</option>)}
            </SelectInput>
          </div>
          <div>
            <Label>외포장 단위</Label>
            <SelectInput value={form.outer_unit} onChange={v => f('outer_unit', v)}>
              {PACK_UNIT_OPTIONS.map(u => <option key={u || 'none'} value={u}>{u || '없음'}</option>)}
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

// ── 변경 이력 모달 ─────────────────────────────────
const FIELD_LABELS = {
  code: '품목보고번호', name: '품목명', category: '카테고리', unit: '단위',
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

// ── 품목 유형 선택 모달 ─────────────────────────────
function TypeChooserModal({ onChoose, onClose }) {
  const OPTIONS = [
    { key: 'item', label: '완성품',   icon: Package, hint: 'CRSP CRSP · 뿅김 등 완성된 제품', color: '#004634', bg: '#FCF4E2' },
    { key: 'raw',  label: '원자재',   icon: Wheat,   hint: '조미김 원초 · 구운김 원초 등',     color: '#7c2d12', bg: '#ffedd5' },
  ]
  return (
    <Overlay onClose={onClose} size="sm">
      <ModalHeader sub="등록할 품목의 유형을 선택해 주세요">품목 유형 선택</ModalHeader>
      <ModalBody>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {OPTIONS.map(o => {
            const Icon = o.icon
            return (
              <button key={o.key} onClick={() => onChoose(o.key)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 12, padding: '28px 16px',
                  background: '#fff', border: `2px solid ${o.color}40`,
                  borderRadius: 14, cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = o.bg
                  e.currentTarget.style.borderColor = o.color
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#fff'
                  e.currentTarget.style.borderColor = `${o.color}40`
                  e.currentTarget.style.transform = 'translateY(0)'
                }}>
                <Icon size={40} color={o.color} />
                <div style={{ fontSize: 18, fontWeight: 800, color: o.color }}>{o.label}</div>
                <div style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', lineHeight: 1.4 }}>{o.hint}</div>
              </button>
            )
          })}
        </div>
      </ModalBody>
      <ModalFooter>
        <Btn variant="secondary" onClick={onClose}>취소</Btn>
      </ModalFooter>
    </Overlay>
  )
}

// ── 원자재 카테고리 관리 (마스터 전용) ──────────────
function CategoryManagerTab({ categories, subcategories, onRefresh }) {
  const [selectedCatId, setSelectedCatId] = useState(categories[0]?.id || '')
  const sortedCats = [...categories].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const sortedSubs = subcategories
    .filter(s => s.category_id === selectedCatId)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  async function addCategory() {
    const name = prompt('새 카테고리 이름을 입력하세요')
    if (!name?.trim()) return
    const maxOrder = Math.max(0, ...categories.map(c => c.sort_order ?? 0))
    const { error } = await supabase.from('raw_material_categories').insert({ name: name.trim(), sort_order: maxOrder + 1 })
    if (error) { alert(error.message); return }
    onRefresh()
  }
  async function renameCategory(cat) {
    const name = prompt('카테고리 이름 수정', cat.name)
    if (!name?.trim() || name.trim() === cat.name) return
    const { error } = await supabase.from('raw_material_categories').update({ name: name.trim() }).eq('id', cat.id)
    if (error) { alert(error.message); return }
    onRefresh()
  }
  async function deleteCategory(cat) {
    if (!confirm(`[${cat.name}] 카테고리와 모든 하위 항목을 삭제하시겠습니까?\n해당 카테고리를 사용 중인 원자재의 카테고리는 자동으로 비워집니다.`)) return
    const { error } = await supabase.from('raw_material_categories').delete().eq('id', cat.id)
    if (error) { alert(error.message); return }
    if (selectedCatId === cat.id) setSelectedCatId('')
    onRefresh()
  }
  async function moveCategory(idx, delta) {
    const a = sortedCats[idx], b = sortedCats[idx + delta]
    if (!a || !b) return
    await Promise.all([
      supabase.from('raw_material_categories').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('raw_material_categories').update({ sort_order: a.sort_order }).eq('id', b.id),
    ])
    onRefresh()
  }

  async function addSubcategory() {
    if (!selectedCatId) { alert('먼저 카테고리를 선택해 주세요.'); return }
    const name = prompt('새 항목 이름을 입력하세요')
    if (!name?.trim()) return
    const sameCatSubs = subcategories.filter(s => s.category_id === selectedCatId)
    const maxOrder = Math.max(0, ...sameCatSubs.map(s => s.sort_order ?? 0))
    const { error } = await supabase.from('raw_material_subcategories').insert({
      category_id: selectedCatId, name: name.trim(), sort_order: maxOrder + 1,
    })
    if (error) { alert(error.message); return }
    onRefresh()
  }
  async function renameSubcategory(sub) {
    const name = prompt('항목 이름 수정', sub.name)
    if (!name?.trim() || name.trim() === sub.name) return
    const { error } = await supabase.from('raw_material_subcategories').update({ name: name.trim() }).eq('id', sub.id)
    if (error) { alert(error.message); return }
    onRefresh()
  }
  async function deleteSubcategory(sub) {
    if (!confirm(`[${sub.name}] 항목을 삭제하시겠습니까?\n해당 항목을 사용 중인 원자재의 항목은 자동으로 비워집니다.`)) return
    const { error } = await supabase.from('raw_material_subcategories').delete().eq('id', sub.id)
    if (error) { alert(error.message); return }
    onRefresh()
  }
  async function moveSubcategory(idx, delta) {
    const a = sortedSubs[idx], b = sortedSubs[idx + delta]
    if (!a || !b) return
    await Promise.all([
      supabase.from('raw_material_subcategories').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('raw_material_subcategories').update({ sort_order: a.sort_order }).eq('id', b.id),
    ])
    onRefresh()
  }

  const PaneHeader = ({ title, onAdd, addLabel }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #e5e7eb', background: '#fafafa' }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{title}</span>
      <button onClick={onAdd}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '6px 10px', fontSize: 12, fontWeight: 600,
          background: '#004634', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
        }}>
        <Plus size={14} />{addLabel}
      </button>
    </div>
  )

  const ListRow = ({ active, onSelect, label, onUp, onDown, onEdit, onDelete }) => (
    <div onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px',
        borderBottom: '1px solid #f3f4f6', cursor: onSelect ? 'pointer' : 'default',
        background: active ? '#FCF4E2' : 'transparent',
      }}>
      <span style={{ flex: 1, fontSize: 14, fontWeight: active ? 600 : 500, color: '#111827' }}>{label}</span>
      <IconBtn icon={ArrowUp} onClick={e => { e?.stopPropagation?.(); onUp() }} label="위로" />
      <IconBtn icon={ArrowDown} onClick={e => { e?.stopPropagation?.(); onDown() }} label="아래로" />
      <IconBtn icon={Edit2} onClick={e => { e?.stopPropagation?.(); onEdit() }} label="수정" />
      <IconBtn icon={Trash2} variant="danger" onClick={e => { e?.stopPropagation?.(); onDelete() }} label="삭제" />
    </div>
  )

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
          <PaneHeader title="카테고리" onAdd={addCategory} addLabel="카테고리 추가" />
          {sortedCats.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>등록된 카테고리가 없습니다</div>
          ) : sortedCats.map((c, idx) => (
            <ListRow key={c.id} active={c.id === selectedCatId}
              onSelect={() => setSelectedCatId(c.id)}
              label={c.name}
              onUp={() => moveCategory(idx, -1)}
              onDown={() => moveCategory(idx, +1)}
              onEdit={() => renameCategory(c)}
              onDelete={() => deleteCategory(c)} />
          ))}
        </div>

        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
          <PaneHeader
            title={selectedCatId ? `항목 — ${sortedCats.find(c => c.id === selectedCatId)?.name || ''}` : '항목 (카테고리 선택)'}
            onAdd={addSubcategory} addLabel="항목 추가" />
          {!selectedCatId ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>왼쪽에서 카테고리를 선택해 주세요</div>
          ) : sortedSubs.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>등록된 항목이 없습니다</div>
          ) : sortedSubs.map((s, idx) => (
            <ListRow key={s.id}
              label={s.name}
              onUp={() => moveSubcategory(idx, -1)}
              onDown={() => moveSubcategory(idx, +1)}
              onEdit={() => renameSubcategory(s)}
              onDelete={() => deleteSubcategory(s)} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── 메인 ─────────────────────────────────────────────
export default function Items() {
  const { profile, canInsert, canUpdate, canDelete, canManage } = useAuth()
  // 조회는 모두, 입력=매니저+, 수정/삭제=시니어+, 카테고리 관리=마스터
  const canEditRow = canUpdate  // 수정/생산중지
  const canSoftDelete = canDelete
  const [tab, setTab] = useState('items')
  const [items, setItems] = useState([])
  const [rawMaterials, setRawMaterials] = useState([])
  const [rmCategories, setRmCategories] = useState([])
  const [rmSubcategories, setRmSubcategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [activeFilter, setActiveFilter] = useState('active') // 'active' | 'all' | 'inactive'

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: its }, { data: rms }, { data: cats }, { data: subs }] = await Promise.all([
      supabase.from('items').select('*').is('deleted_at', null).order('name'),
      supabase.from('raw_materials').select('*').is('deleted_at', null).order('name'),
      supabase.from('raw_material_categories').select('*').order('sort_order'),
      supabase.from('raw_material_subcategories').select('*').order('sort_order'),
    ])
    // 정렬: 품명 오름차순, 동일 품명 내에서 자체생산(internal) 먼저, 외주(outsourced) 뒤
    const sorted = (its || []).slice().sort((a, b) => {
      const n = (a.name || '').localeCompare(b.name || '')
      if (n !== 0) return n
      const order = { internal: 0, outsourced: 1 }
      return (order[a.production_type] ?? 0) - (order[b.production_type] ?? 0)
    })
    setItems(sorted); setRawMaterials(rms || [])
    setRmCategories(cats || []); setRmSubcategories(subs || [])
    setLoading(false)
  }

  async function softDeleteItem(item) {
    if (!confirm(`[${item.name}] 품목을 삭제하시겠습니까?\n\n삭제 내역 메뉴에서 복구할 수 있습니다.`)) return
    const { error } = await supabase.from('items').update({
      deleted_at: new Date().toISOString(),
      deleted_by: profile?.id || null,
    }).eq('id', item.id)
    if (error) { alert(error.message); return }
    await logChange({ itemId: item.id, profile, action: 'deactivate', changes: { deleted_at: { before: null, after: 'deleted' } } })
    fetchAll()
  }
  async function softDeleteRaw(rm) {
    if (!confirm(`[${rm.name}] 원자재를 삭제하시겠습니까?\n\n삭제 내역 메뉴에서 복구할 수 있습니다.`)) return
    const { error } = await supabase.from('raw_materials').update({
      deleted_at: new Date().toISOString(),
      deleted_by: profile?.id || null,
    }).eq('id', rm.id)
    if (error) { alert(error.message); return }
    fetchAll()
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
        {canInsert && (
          <RegisterBtn onClick={() => { setSelected(null); setModal('choose-type') }}>
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
            ...(canManage ? [{ key: 'raw-categories', label: '원자재 카테고리', icon: Settings }] : []),
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
        ) : tab === 'raw-categories' ? (
          canManage ? (
            <CategoryManagerTab categories={rmCategories} subcategories={rmSubcategories} onRefresh={fetchAll} />
          ) : <EmptyState icon={Settings} text="권한이 없습니다" />
        ) : tab === 'items' ? (
          filtered.length === 0 ? <EmptyState icon={Package} text={activeFilter === 'inactive' ? '생산중지 품목이 없습니다' : '등록된 완성품이 없습니다'} /> : (
            <div className="tbl-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['품목보고번호', '품명', '카테고리', '단위', '중량(g)', '매수', '포장', '장당원초', '소비기한', '상태', canEditRow ? '관리' : ''].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
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
                      <Td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 500, color: '#111827' }}>{item.name}</span>
                          {item.production_type === 'outsourced' && (
                            <Badge label="외주" color="#7c2d12" bg="#ffedd5" />
                          )}
                        </div>
                      </Td>
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
                      {canEditRow && (
                        <Td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <IconBtn icon={Edit2} onClick={() => { setSelected(item); setModal('edit-item') }} label="수정" />
                            <IconBtn icon={History} onClick={() => { setSelected(item); setModal('history') }} label="변경 이력" />
                            <IconBtn
                              icon={item.is_active ? PowerOff : Power}
                              variant={item.is_active ? 'danger' : 'accent'}
                              onClick={() => toggleActive(item)}
                              label={item.is_active ? '생산중지' : '재활성화'} />
                            {canSoftDelete && (
                              <IconBtn icon={Trash2} variant="danger" onClick={() => softDeleteItem(item)} label="삭제" />
                            )}
                          </div>
                        </Td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          )
        ) : (
          rawMaterials.length === 0 ? <EmptyState icon={Wheat} text="등록된 원자재가 없습니다" /> : (
            <div className="tbl-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['원자재코드(자호)', '원자재명', '단위', canEditRow ? '관리' : ''].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
              <tbody>
                {rawMaterials.map((rm, i) => {
                  const inner = rm.inner_unit || rm.unit || ''
                  const outer = rm.outer_unit || ''
                  const unitLabel = inner && outer ? `${inner} / ${outer}` : (inner || outer || '—')
                  return (
                  <tr key={rm.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <Td>
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#111827', letterSpacing: '0.2px' }}>{rm.code}</span>
                    </Td>
                    <Td>
                      <span style={{ color: '#111827' }}>{rm.name}</span>
                    </Td>
                    <Td style={{ color: '#6b7280' }}>{unitLabel}</Td>
                    {canEditRow && (
                      <Td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <IconBtn icon={Edit2} onClick={() => { setSelected(rm); setModal('edit-raw') }} label="수정" />
                          {canSoftDelete && <IconBtn icon={Trash2} variant="danger" onClick={() => softDeleteRaw(rm)} label="삭제" />}
                        </div>
                      </Td>
                    )}
                  </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          )
        )}
      </Card>

      {modal === 'choose-type' && (
        <TypeChooserModal
          onChoose={key => setModal(key === 'item' ? 'new-item' : 'new-raw')}
          onClose={() => setModal(null)} />
      )}
      {(modal === 'new-item' || modal === 'edit-item') && (
        <ItemModal item={selected} profile={profile} onClose={() => { setModal(null); setSelected(null) }} onSave={handleSaved} />
      )}
      {(modal === 'new-raw' || modal === 'edit-raw') && (
        <RawMaterialModal item={selected} categories={rmCategories} subcategories={rmSubcategories}
          onClose={() => { setModal(null); setSelected(null) }} onSave={handleSaved} />
      )}
      {modal === 'history' && selected && (
        <HistoryModal item={selected} onClose={() => { setModal(null); setSelected(null) }} />
      )}
    </div>
  )
}
