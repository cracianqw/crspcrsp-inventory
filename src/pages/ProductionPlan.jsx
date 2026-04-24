import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  Calendar, CalendarDays, CalendarRange, Plus, Trash2, Edit2,
  Factory, Package, Wrench, X, AlertTriangle,
} from 'lucide-react'
import {
  Card, CardHeader, Btn, RegisterBtn, IconBtn, StatCard, Badge,
  Label, Input, SelectInput, Textarea,
  Overlay, ModalHeader, ModalBody, ModalFooter,
  ErrorBox, EmptyState, Spinner, Th, Td,
  AuditStamp, useUserMap, itemLabel,
} from '../components/UI'

// ── 날짜 유틸 ─────────────────────────────────────────────────────
function startOfWeek(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0)
  const day = x.getDay()
  x.setDate(x.getDate() - (day === 0 ? 6 : day - 1))
  return x
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function fmtISO(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
function fmtKDate(iso) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
function fmtKDateFull(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`
}
function dayLabel(iso) {
  const d = new Date(iso)
  return ['일','월','화','수','목','금','토'][d.getDay()]
}
function datesInRange(startIso, endIso) {
  const out = []
  const s = new Date(startIso); const e = new Date(endIso)
  for (let d = new Date(s); d <= e; d = addDays(d, 1)) out.push(fmtISO(d))
  return out
}
function addDaysIso(iso, n) { return fmtISO(addDays(new Date(iso), n)) }

// ── 달성률 색상 ─────────────────────────────────────────────
function achColor(pct) {
  if (pct == null) return { color: '#9ca3af', bg: '#f3f4f6' }
  if (pct >= 100) return { color: '#059669', bg: '#d1fae5' }
  if (pct >= 80)  return { color: '#d97706', bg: '#fef3c7' }
  return { color: '#dc2626', bg: '#fee2e2' }
}

// ── 외포장 옵션 ─────────────────────────────────────────────
const OUTER_PACKING_OPTIONS = [
  { value: '종이',   label: '종이' },
  { value: '부직포', label: '부직포' },
  { value: 'custom', label: '직접입력' },
]

// ── 기본 행 생성기 ─────────────────────────────────────────
const mkProductionRow = (date) => ({
  key: Math.random().toString(36).slice(2),
  target_date: date || '',
  item_id: '',
  produce_qty_bags: '',
  materials: [{ key: Math.random().toString(36).slice(2), raw_material_id: '', planned_qty: '' }],
})
const mkPackagingRow = (date) => ({
  key: Math.random().toString(36).slice(2),
  target_date: date || '',
  item_id: '',
  pkg_unit: '',
  box_pkg_unit: '',
  bags_per_box: '',
  total_boxes: '',
  expiry_date: '',
})
const mkOtherRow = (date) => ({
  key: Math.random().toString(36).slice(2),
  target_date: date || '',
  custom_item_name: '',
  work_qty: '',
  outer_packing: '종이',
  outer_packing_custom: '',
  combined_packing: false,
  combined_unit: '',
})

// ============================================================
// 계획 등록/수정 모달
// ============================================================
function PlanRegisterModal({ plan, items, rawMaterials, profile, onClose, onSave }) {
  const isEdit = !!plan?.id
  const defaultStart = fmtISO(startOfWeek(new Date()))
  const defaultEnd   = fmtISO(addDays(startOfWeek(new Date()), 6))

  // 헤더 상태
  const [planType, setPlanType]       = useState(plan?.plan_type || 'weekly')
  const [periodStart, setPeriodStart] = useState(plan?.period_start || defaultStart)
  const [periodEnd, setPeriodEnd]     = useState(plan?.period_end   || defaultEnd)
  const [holidays, setHolidays]       = useState(plan?.holidays || [])
  const [notes, setNotes]             = useState(plan?.notes || '')
  const [diffFromWeekly, setDiffFromWeekly] = useState(plan?.differs_from_weekly || false)
  const [diffReason, setDiffReason]   = useState(plan?.diff_reason || '')
  const [weeklyRefPlan, setWeeklyRefPlan] = useState(null)
  const [weeklyRefItems, setWeeklyRefItems] = useState([])

  // 항목 상태 (신규는 빈 행 하나씩, 수정은 useEffect에서 채움)
  const [tab, setTab] = useState('production')
  const initDate = plan?.period_start || (planType === 'daily' ? defaultStart : '')
  const [prodRows, setProdRows]   = useState(() => isEdit ? [] : [mkProductionRow(initDate)])
  const [pkgRows,  setPkgRows]    = useState(() => isEdit ? [] : [mkPackagingRow(initDate)])
  const [otherRows, setOtherRows] = useState(() => isEdit ? [] : [mkOtherRow(initDate)])

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [conflictState, setConflictState] = useState(null)  // 주간 append 시 (kind, 날짜) 충돌 해결 대기

  // 계획 유형 토글: 일간이면 종료일을 시작일로 맞춘다
  function changePlanType(v) {
    setPlanType(v)
    if (v === 'daily') setPeriodEnd(periodStart)
  }

  // 기존 계획 로드 (수정)
  useEffect(() => {
    if (!isEdit) return
    ;(async () => {
      const { data: itemRows } = await supabase
        .from('production_plan_items')
        .select('*')
        .eq('plan_id', plan.id)
        .order('sort_order', { ascending: true })
      const planItemIds = (itemRows || []).map(r => r.id)
      const { data: matRows } = planItemIds.length
        ? await supabase.from('production_plan_materials').select('*').in('plan_item_id', planItemIds).order('sort_order')
        : { data: [] }
      const matsByItem = {}
      ;(matRows || []).forEach(m => {
        if (!matsByItem[m.plan_item_id]) matsByItem[m.plan_item_id] = []
        matsByItem[m.plan_item_id].push(m)
      })
      const pr = [], pk = [], ot = []
      ;(itemRows || []).forEach(r => {
        if (r.kind === 'production') {
          pr.push({
            key: r.id, _id: r.id,
            target_date: r.target_date || '',
            item_id: r.item_id || '',
            produce_qty_bags: r.produce_qty_bags ?? '',
            materials: (matsByItem[r.id] || []).map(m => ({
              key: m.id, _id: m.id,
              raw_material_id: m.raw_material_id,
              planned_qty: m.planned_qty ?? '',
            })).concat(
              (matsByItem[r.id] || []).length === 0
                ? [{ key: Math.random().toString(36).slice(2), raw_material_id: '', planned_qty: '' }]
                : []
            ),
          })
        } else if (r.kind === 'packaging') {
          pk.push({
            key: r.id, _id: r.id,
            target_date: r.target_date || '',
            item_id: r.item_id || '',
            pkg_unit: r.pkg_unit || '',
            box_pkg_unit: r.box_pkg_unit || '',
            bags_per_box: r.bags_per_box ?? '',
            total_boxes: r.total_boxes ?? '',
            expiry_date: r.expiry_date || '',
          })
        } else {
          ot.push({
            key: r.id, _id: r.id,
            target_date: r.target_date || '',
            custom_item_name: r.custom_item_name || '',
            work_qty: r.work_qty ?? '',
            outer_packing: r.outer_packing || '종이',
            outer_packing_custom: r.outer_packing_custom || '',
            combined_packing: !!r.combined_packing,
            combined_unit: r.combined_unit || '',
          })
        }
      })
      setProdRows(pr.length ? pr : [mkProductionRow(planType === 'daily' ? periodStart : '')])
      setPkgRows(pk.length ? pk : [mkPackagingRow(planType === 'daily' ? periodStart : '')])
      setOtherRows(ot.length ? ot : [mkOtherRow(planType === 'daily' ? periodStart : '')])
    })()
  }, [isEdit]) // eslint-disable-line

  // 일간 모드에서 해당일을 포함하는 주간 계획 로드 (참고용 상단 표시)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (planType !== 'daily' || !periodStart) {
        if (!cancelled) { setWeeklyRefPlan(null); setWeeklyRefItems([]) }
        return
      }
      const { data: wplans } = await supabase
        .from('production_plans')
        .select('*')
        .eq('plan_type', 'weekly')
        .is('deleted_at', null)
        .lte('period_start', periodStart)
        .gte('period_end',   periodStart)
        .order('created_at', { ascending: false })
        .limit(1)
      if (cancelled) return
      const wp = (wplans || [])[0]
      setWeeklyRefPlan(wp || null)
      if (!wp) { setWeeklyRefItems([]); return }
      const { data: its } = await supabase
        .from('production_plan_items')
        .select('*')
        .eq('plan_id', wp.id)
        .order('sort_order')
      if (!cancelled) {
        setWeeklyRefItems((its || []).filter(it => !it.target_date || it.target_date === periodStart))
      }
    })()
    return () => { cancelled = true }
  }, [planType, periodStart])

  const rangeDates = useMemo(
    () => (periodStart && periodEnd ? datesInRange(periodStart, periodEnd) : []),
    [periodStart, periodEnd],
  )

  function toggleHoliday(iso) {
    setHolidays(p => p.includes(iso) ? p.filter(x => x !== iso) : [...p, iso])
  }

  function setPeriodPreset(weeks) {
    const s = periodStart || defaultStart
    const end = addDaysIso(s, weeks * 7 - 1)
    setPeriodEnd(end)
  }

  // ── 행 조작 ──
  const addProdRow = () => setProdRows(p => [...p, mkProductionRow(planType === 'daily' ? periodStart : '')])
  const removeProdRow = (k) => setProdRows(p => p.length > 1 ? p.filter(r => r.key !== k) : p)
  const updProd = (k, patch) => setProdRows(p => p.map(r => r.key === k ? { ...r, ...patch } : r))
  const addProdMat = (rowKey) => setProdRows(p => p.map(r => r.key === rowKey ? { ...r, materials: [...r.materials, { key: Math.random().toString(36).slice(2), raw_material_id: '', planned_qty: '' }] } : r))
  const removeProdMat = (rowKey, matKey) => setProdRows(p => p.map(r => r.key === rowKey ? { ...r, materials: r.materials.length > 1 ? r.materials.filter(m => m.key !== matKey) : r.materials } : r))
  const updProdMat = (rowKey, matKey, patch) => setProdRows(p => p.map(r => r.key === rowKey ? { ...r, materials: r.materials.map(m => m.key === matKey ? { ...m, ...patch } : m) } : r))

  const addPkgRow = () => setPkgRows(p => [...p, mkPackagingRow(planType === 'daily' ? periodStart : '')])
  const removePkgRow = (k) => setPkgRows(p => p.length > 1 ? p.filter(r => r.key !== k) : p)
  const updPkg = (k, patch) => setPkgRows(p => p.map(r => {
    if (r.key !== k) return r
    const nr = { ...r, ...patch }
    // 품목 선택 시 소비기한 자동 계산
    if ('item_id' in patch && patch.item_id) {
      const it = items.find(i => i.id === patch.item_id)
      if (it?.shelf_life_days) {
        const base = new Date()
        nr.expiry_date = fmtISO(addDays(base, Number(it.shelf_life_days)))
      }
    }
    return nr
  }))

  const addOtherRow = () => setOtherRows(p => [...p, mkOtherRow(planType === 'daily' ? periodStart : '')])
  const removeOtherRow = (k) => setOtherRows(p => p.length > 1 ? p.filter(r => r.key !== k) : p)
  const updOther = (k, patch) => setOtherRows(p => p.map(r => r.key === k ? { ...r, ...patch } : r))

  // ── 유효성 검사 및 저장 ──
  function validate() {
    if (!periodStart || !periodEnd) return '기간을 설정해 주세요.'
    if (new Date(periodEnd) < new Date(periodStart)) return '종료일이 시작일보다 빠를 수 없습니다.'

    const prod = prodRows.filter(r => r.item_id || r.produce_qty_bags)
    const pkg  = pkgRows.filter(r => r.item_id || r.total_boxes)
    const other = otherRows.filter(r => r.custom_item_name || r.work_qty)
    if (prod.length === 0 && pkg.length === 0 && other.length === 0) {
      return '생산/포장/기타 중 하나 이상의 항목을 입력해 주세요.'
    }
    if (planType === 'weekly') {
      for (const r of prod)  if (r.target_date && !rangeDates.includes(r.target_date)) return '생산계획 날짜가 기간을 벗어났습니다.'
      for (const r of pkg)   if (r.target_date && !rangeDates.includes(r.target_date)) return '포장계획 날짜가 기간을 벗어났습니다.'
      for (const r of other) if (r.target_date && !rangeDates.includes(r.target_date)) return '기타작업 날짜가 기간을 벗어났습니다.'
    }
    if (planType === 'daily' && diffFromWeekly && !diffReason.trim()) {
      return '주간계획과 차이 사유를 입력해 주세요.'
    }
    return null
  }

  // 입력된 행들을 DB insert 페이로드 배열로 변환 (plan_id/sort_order 는 insertItems 에서 부여)
  function buildItemPayload() {
    const defaultDate = planType === 'daily' ? periodStart : null
    const payload = []
    prodRows.forEach(r => {
      if (!r.item_id && !r.produce_qty_bags) return
      payload.push({
        kind: 'production',
        target_date: r.target_date || defaultDate || null,
        item_id: r.item_id || null,
        produce_qty_bags: r.produce_qty_bags === '' ? null : Number(r.produce_qty_bags),
        _materials: r.materials.filter(m => m.raw_material_id && m.planned_qty !== ''),
      })
    })
    pkgRows.forEach(r => {
      if (!r.item_id && !r.total_boxes) return
      const bpb = r.bags_per_box === '' ? null : Number(r.bags_per_box)
      const tb  = r.total_boxes === '' ? null : Number(r.total_boxes)
      payload.push({
        kind: 'packaging',
        target_date: r.target_date || defaultDate || null,
        item_id: r.item_id || null,
        pkg_unit: r.pkg_unit || null,
        box_pkg_unit: r.box_pkg_unit || null,
        bags_per_box: bpb,
        total_boxes: tb,
        total_bags: (bpb != null && tb != null) ? bpb * tb : null,
        expiry_date: r.expiry_date || null,
      })
    })
    otherRows.forEach(r => {
      if (!r.custom_item_name && !r.work_qty) return
      payload.push({
        kind: 'other',
        target_date: r.target_date || defaultDate || null,
        custom_item_name: r.custom_item_name || null,
        work_qty: r.work_qty === '' ? null : Number(r.work_qty),
        outer_packing: r.outer_packing || null,
        outer_packing_custom: r.outer_packing === 'custom' ? (r.outer_packing_custom || null) : null,
        combined_packing: !!r.combined_packing,
        combined_unit: r.combined_packing ? (r.combined_unit || null) : null,
      })
    })
    return payload
  }

  async function insertItems(planId, items, startSort = 0) {
    for (let i = 0; i < items.length; i++) {
      const { _materials, ...rest } = items[i]
      const { data: ins, error: ie } = await supabase
        .from('production_plan_items')
        .insert({ ...rest, plan_id: planId, sort_order: startSort + i })
        .select().single()
      if (ie) throw ie
      if (_materials && _materials.length > 0) {
        const matsPay = _materials.map((m, idx) => ({
          plan_item_id: ins.id,
          raw_material_id: m.raw_material_id,
          planned_qty: Number(m.planned_qty),
          unit: 'kg',
          sort_order: idx,
        }))
        const { error: me } = await supabase.from('production_plan_materials').insert(matsPay)
        if (me) throw me
      }
    }
  }

  async function deletePlanItems(itemIds) {
    if (itemIds.length === 0) return
    await supabase.from('production_plan_materials').delete().in('plan_item_id', itemIds)
    await supabase.from('production_plan_items').delete().in('id', itemIds)
  }

  async function handleSave() {
    const msg = validate()
    if (msg) { setError(msg); return }
    setSaving(true); setError('')

    const header = {
      plan_type: planType,
      period_start: periodStart,
      period_end: planType === 'daily' ? periodStart : periodEnd,
      holidays,
      notes: notes || null,
      differs_from_weekly: planType === 'daily' ? diffFromWeekly : false,
      diff_reason: planType === 'daily' && diffFromWeekly ? diffReason : null,
      weekly_plan_id: planType === 'daily' ? (weeklyRefPlan?.id || null) : null,
    }
    const itemPayload = buildItemPayload()

    try {
      if (isEdit) {
        // 수정: 헤더 갱신 + 기존 항목 전부 교체
        const { error: e } = await supabase.from('production_plans').update({
          ...header,
          updated_by: profile?.id || null,
          updated_at: new Date().toISOString(),
        }).eq('id', plan.id)
        if (e) throw e
        const { data: oldItems } = await supabase
          .from('production_plan_items').select('id').eq('plan_id', plan.id)
        await deletePlanItems((oldItems || []).map(x => x.id))
        await insertItems(plan.id, itemPayload, 0)
        onSave()
        setSaving(false)
        return
      }

      // 신규 + 주간: 동일 기간의 주간계획이 이미 있으면 append
      if (planType === 'weekly') {
        const { data: existing } = await supabase
          .from('production_plans')
          .select('*')
          .eq('plan_type', 'weekly')
          .eq('period_start', periodStart)
          .eq('period_end', periodEnd)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
        const existingPlan = (existing || [])[0]
        if (existingPlan) {
          const { data: existItems } = await supabase
            .from('production_plan_items')
            .select('*')
            .eq('plan_id', existingPlan.id)

          // (kind, target_date) 별로 충돌 검출
          const existByKey = {}
          ;(existItems || []).forEach(it => {
            const key = `${it.kind}|${it.target_date || ''}`
            if (!existByKey[key]) existByKey[key] = []
            existByKey[key].push(it)
          })
          const conflictKeys = new Set()
          itemPayload.forEach(it => {
            const key = `${it.kind}|${it.target_date || ''}`
            if (existByKey[key]?.length > 0) conflictKeys.add(key)
          })

          if (conflictKeys.size > 0) {
            // 충돌 → 사용자 결정 대기
            setConflictState({
              existingPlan,
              existingItems: existItems || [],
              itemPayload,
              conflictKeys: Array.from(conflictKeys),
            })
            setSaving(false)
            return
          }

          // 충돌 없음 → 그대로 append
          const nextSort = (existItems || []).length
          await insertItems(existingPlan.id, itemPayload, nextSort)
          onSave()
          setSaving(false)
          return
        }
      }

      // 신규 plan 생성 (주간이지만 기존 없음 / 일간)
      const { data: created, error: ce } = await supabase.from('production_plans').insert({
        ...header,
        created_by: profile?.id || null,
      }).select().single()
      if (ce) throw ce
      await insertItems(created.id, itemPayload, 0)
      onSave()
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  // 충돌 해결: 'keep' (기존 유지) | 'overwrite' (덮어쓰기)
  async function resolveConflict(mode) {
    if (!conflictState) return
    const { existingPlan, existingItems, itemPayload, conflictKeys } = conflictState
    const keySet = new Set(conflictKeys)
    setSaving(true); setError('')
    try {
      let toInsert = itemPayload
      let existingCount = existingItems.length
      if (mode === 'keep') {
        // 충돌 (kind, 날짜) 에 해당하는 새 항목은 스킵
        toInsert = itemPayload.filter(it => !keySet.has(`${it.kind}|${it.target_date || ''}`))
      } else {
        // overwrite: 충돌 (kind, 날짜) 에 해당하는 기존 항목 삭제
        const toDelete = existingItems
          .filter(it => keySet.has(`${it.kind}|${it.target_date || ''}`))
          .map(it => it.id)
        await deletePlanItems(toDelete)
        existingCount -= toDelete.length
      }
      await insertItems(existingPlan.id, toInsert, existingCount)
      setConflictState(null)
      onSave()
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  // ── 렌더 ──
  return (
    <>
    <Overlay onClose={onClose} size="xl">
      <ModalHeader sub={isEdit ? '계획 수정' : '새 계획을 등록합니다'}>
        {isEdit ? '계획 수정' : '계획 등록'}
      </ModalHeader>
      <ModalBody>
        {error && <ErrorBox msg={error} />}

        {/* ── 플랜 유형 / 기간 ── */}
        <div>
          <Label required>계획 유형</Label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { v: 'weekly', label: '주간 계획', icon: CalendarRange },
              { v: 'daily',  label: '일간 계획', icon: CalendarDays },
            ].map(o => {
              const Icon = o.icon
              const active = planType === o.v
              return (
                <button key={o.v} type="button" onClick={() => changePlanType(o.v)}
                  style={{
                    flex: 1, height: 56, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    border: active ? '2px solid #004634' : '1.5px solid #e5e7eb',
                    background: active ? '#004634' : '#fff',
                    color: active ? '#fff' : '#374151',
                    borderRadius: 12, cursor: 'pointer', fontSize: 15, fontWeight: 600,
                  }}>
                  <Icon size={18} />{o.label}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: planType === 'daily' ? '1fr' : '1fr 1fr auto', gap: 16, alignItems: 'end' }}>
          <div>
            <Label required>{planType === 'daily' ? '계획 일자' : '시작일'}</Label>
            <Input type="date" value={periodStart} onChange={v => { setPeriodStart(v); if (planType === 'daily') setPeriodEnd(v) }} />
          </div>
          {planType === 'weekly' && (
            <>
              <div>
                <Label required>종료일</Label>
                <Input type="date" value={periodEnd} onChange={setPeriodEnd} />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => setPeriodPreset(1)}
                  style={{ height: 48, padding: '0 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, background: '#fff', color: '#374151', fontWeight: 600, cursor: 'pointer' }}>
                  1주
                </button>
                <button type="button" onClick={() => setPeriodPreset(2)}
                  style={{ height: 48, padding: '0 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, background: '#fff', color: '#374151', fontWeight: 600, cursor: 'pointer' }}>
                  2주
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── 휴일 체크 ── */}
        {planType === 'weekly' && rangeDates.length > 0 && (
          <div>
            <Label>휴일 체크</Label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
              {rangeDates.map(iso => {
                const holiday = holidays.includes(iso)
                return (
                  <button key={iso} type="button" onClick={() => toggleHoliday(iso)}
                    style={{
                      padding: '10px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                      border: holiday ? '2px solid #dc2626' : '1.5px solid #e5e7eb',
                      background: holiday ? '#fef2f2' : '#fff',
                      color: holiday ? '#dc2626' : '#374151',
                      borderRadius: 10, cursor: 'pointer', fontWeight: 600,
                    }}>
                    <span style={{ fontSize: 12 }}>{dayLabel(iso)} {fmtKDate(iso)}</span>
                    <span style={{ fontSize: 11, color: holiday ? '#dc2626' : '#9ca3af' }}>{holiday ? '휴일' : '근무'}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── 일간: 주간 참고 블록 ── */}
        {planType === 'daily' && weeklyRefPlan && (
          <div style={{ padding: 16, background: '#FCF4E2', border: '1px solid #D4A96A40', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <CalendarRange size={16} color="#92400e" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>
                {fmtKDateFull(periodStart)} 해당일의 주간 계획
              </span>
              <Badge label={`${weeklyRefItems.length}건`} color="#92400e" bg="#fff" />
            </div>
            {weeklyRefItems.length === 0 ? (
              <p style={{ fontSize: 13, color: '#92400e' }}>해당일에 지정된 주간 항목이 없습니다.</p>
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                {weeklyRefItems.map(it => {
                  const name = it.kind === 'other'
                    ? (it.custom_item_name || '—')
                    : (itemLabel(items.find(i => i.id === it.item_id)) || '—')
                  const qty = it.kind === 'production' ? `${Number(it.produce_qty_bags || 0).toLocaleString()}봉`
                            : it.kind === 'packaging'  ? `${Number(it.total_boxes || 0).toLocaleString()}박스`
                            : `${Number(it.work_qty || 0).toLocaleString()}건`
                  const kindLabel = it.kind === 'production' ? '생산' : it.kind === 'packaging' ? '포장' : '기타'
                  return (
                    <div key={it.id} style={{ display: 'flex', gap: 10, fontSize: 13, color: '#7c2d12', alignItems: 'center' }}>
                      <Badge label={kindLabel} color="#92400e" bg="#fff" />
                      <span style={{ fontWeight: 600 }}>{name}</span>
                      <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{qty}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── 탭 ── */}
        <div style={{ borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 4 }}>
          {[
            { k: 'production', label: '완성품 생산계획', icon: Factory, count: prodRows.length },
            { k: 'packaging',  label: '완제품 포장계획', icon: Package, count: pkgRows.length },
            { k: 'other',      label: '기타작업',       icon: Wrench,  count: otherRows.length },
          ].map(t => {
            const Icon = t.icon
            const active = tab === t.k
            return (
              <button key={t.k} type="button" onClick={() => setTab(t.k)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '10px 18px', fontSize: 14, fontWeight: 600,
                  border: 'none', borderBottom: `2px solid ${active ? '#004634' : 'transparent'}`,
                  background: 'transparent', color: active ? '#004634' : '#6b7280',
                  cursor: 'pointer', marginBottom: -1,
                }}>
                <Icon size={15} />{t.label}
                <span style={{ fontSize: 12, padding: '1px 7px', borderRadius: 99, background: active ? '#004634' : '#e5e7eb', color: active ? '#fff' : '#6b7280' }}>{t.count}</span>
              </button>
            )
          })}
        </div>

        {/* ── 탭 본문 ── */}
        {tab === 'production' && (
          <ProductionTab
            rows={prodRows} items={items} rawMaterials={rawMaterials}
            planType={planType} rangeDates={rangeDates}
            onAdd={addProdRow} onRemove={removeProdRow} onUpdate={updProd}
            onAddMat={addProdMat} onRemoveMat={removeProdMat} onUpdMat={updProdMat}
          />
        )}
        {tab === 'packaging' && (
          <PackagingTab
            rows={pkgRows} items={items}
            planType={planType} rangeDates={rangeDates}
            onAdd={addPkgRow} onRemove={removePkgRow} onUpdate={updPkg}
          />
        )}
        {tab === 'other' && (
          <OtherTab
            rows={otherRows}
            planType={planType} rangeDates={rangeDates}
            onAdd={addOtherRow} onRemove={removeOtherRow} onUpdate={updOther}
          />
        )}

        {/* ── 비고 ── */}
        <div>
          <Label>비고</Label>
          <Textarea value={notes} onChange={setNotes} rows={2} placeholder="특이사항..." />
        </div>

        {/* ── 일간: 주간 차이 체크 ── */}
        {planType === 'daily' && (
          <div style={{ padding: 16, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={diffFromWeekly} onChange={e => setDiffFromWeekly(e.target.checked)} style={{ width: 18, height: 18 }} />
              <AlertTriangle size={16} color="#d97706" />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#92400e' }}>주간 계획과 차이가 있습니다</span>
            </label>
            {diffFromWeekly && (
              <div style={{ marginTop: 12 }}>
                <Label required>차이 사유</Label>
                <Textarea value={diffReason} onChange={setDiffReason} rows={2} placeholder="예) 원재료 입고 지연으로 생산량 조정..." />
              </div>
            )}
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Btn variant="secondary" onClick={onClose}>취소</Btn>
        <Btn disabled={saving} onClick={handleSave}>{saving ? '저장 중...' : isEdit ? '수정 저장' : '계획 등록'}</Btn>
      </ModalFooter>
    </Overlay>

    {conflictState && (
      <ConflictDialog
        state={conflictState}
        items={items}
        onKeep={() => resolveConflict('keep')}
        onOverwrite={() => resolveConflict('overwrite')}
        onCancel={() => setConflictState(null)}
        saving={saving}
      />
    )}
    </>
  )
}

// ── 충돌 해결 다이얼로그 ────────────────────────────────────
function ConflictDialog({ state, items, onKeep, onOverwrite, onCancel, saving }) {
  const { conflictKeys, existingItems, itemPayload } = state

  // 충돌 키별 요약 (kind, 날짜, 기존/신규 건수)
  const summary = conflictKeys.map(key => {
    const [kind, date] = key.split('|')
    const exCount = existingItems.filter(it => `${it.kind}|${it.target_date || ''}` === key).length
    const inCount = itemPayload.filter(it => `${it.kind}|${it.target_date || ''}` === key).length
    const exSample = existingItems.find(it => `${it.kind}|${it.target_date || ''}` === key)
    const nameOf = (it) => it?.kind === 'other'
      ? (it.custom_item_name || '—')
      : (items.find(i => i.id === it?.item_id)?.name || '—')
    const kindLabel = kind === 'production' ? '생산' : kind === 'packaging' ? '포장' : '기타'
    return { key, kindLabel, date: date || '—', exCount, inCount, exSampleName: nameOf(exSample) }
  })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.55)' }}>
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ padding: '24px 28px 16px', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <AlertTriangle size={20} color="#d97706" />
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>이미 등록된 항목이 있습니다</h2>
          </div>
          <p style={{ fontSize: 13, color: '#6b7280' }}>
            해당 날짜에 같은 유형의 계획이 이미 존재합니다. 기존 내용을 유지할지, 새 내용으로 덮어쓸지 선택해 주세요.
          </p>
        </div>
        <div style={{ padding: '16px 28px' }}>
          <div style={{ display: 'grid', gap: 8 }}>
            {summary.map(s => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10 }}>
                <Badge label={s.kindLabel} color="#92400e" bg="#fff" />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#7c2d12' }}>{s.date === '—' ? '날짜 미지정' : fmtKDateFull(s.date)}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: '#92400e' }}>
                  기존 {s.exCount}건 · 신규 {s.inCount}건
                </span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 12 }}>
            ※ 충돌 외의 항목은 그대로 추가됩니다.
          </p>
        </div>
        <div style={{ padding: '16px 28px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Btn variant="ghost" onClick={onCancel} disabled={saving}>취소</Btn>
          <Btn variant="secondary" onClick={onKeep} disabled={saving}>기존 유지</Btn>
          <Btn variant="danger" onClick={onOverwrite} disabled={saving}>
            {saving ? '처리 중...' : '덮어쓰기'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

// ── 완성품 생산계획 탭 ──────────────────────────────────────
function ProductionTab({ rows, items, rawMaterials, planType, rangeDates, onAdd, onRemove, onUpdate, onAddMat, onRemoveMat, onUpdMat }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Label>완성품 생산계획</Label>
        <button onClick={onAdd} type="button"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, border: '1.5px solid #004634', background: '#004634', color: '#fff', borderRadius: 8, cursor: 'pointer' }}>
          <Plus size={13} /> 항목 추가
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map(r => (
          <div key={r.key} style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 12, background: '#fafafa' }}>
            <div style={{ display: 'grid', gridTemplateColumns: planType === 'weekly' ? '160px 1fr 160px 40px' : '1fr 180px 40px', gap: 10, alignItems: 'end' }}>
              {planType === 'weekly' && (
                <div>
                  <Label>날짜</Label>
                  <SelectInput value={r.target_date} onChange={v => onUpdate(r.key, { target_date: v })}>
                    <option value="">선택...</option>
                    {rangeDates.map(d => <option key={d} value={d}>{fmtKDate(d)} ({dayLabel(d)})</option>)}
                  </SelectInput>
                </div>
              )}
              <div>
                <Label>완성품</Label>
                <SelectInput value={r.item_id} onChange={v => onUpdate(r.key, { item_id: v })}>
                  <option value="">선택...</option>
                  {items.map(i => <option key={i.id} value={i.id}>{itemLabel(i)}</option>)}
                </SelectInput>
              </div>
              <div>
                <Label>생산계획 (봉)</Label>
                <Input type="number" value={r.produce_qty_bags} onChange={v => onUpdate(r.key, { produce_qty_bags: v })} placeholder="0" />
              </div>
              <button type="button" onClick={() => onRemove(r.key)}
                style={{ height: 48, width: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #fecaca', background: '#fef2f2', color: '#dc2626', borderRadius: 10, cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>

            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>원재료 사용 계획</span>
                <button type="button" onClick={() => onAddMat(r.key)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 12, fontWeight: 600, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', borderRadius: 6, cursor: 'pointer' }}>
                  <Plus size={12} /> 원재료 추가
                </button>
              </div>
              {r.materials.map(m => (
                <div key={m.key} style={{ display: 'grid', gridTemplateColumns: '1fr 180px 40px', gap: 10, marginBottom: 6 }}>
                  <SelectInput value={m.raw_material_id} onChange={v => onUpdMat(r.key, m.key, { raw_material_id: v })}>
                    <option value="">원재료 선택...</option>
                    {rawMaterials.map(rm => <option key={rm.id} value={rm.id}>{rm.name} ({rm.code})</option>)}
                  </SelectInput>
                  <Input type="number" value={m.planned_qty} onChange={v => onUpdMat(r.key, m.key, { planned_qty: v })} placeholder="사용량 (kg)" />
                  <button type="button" onClick={() => onRemoveMat(r.key, m.key)}
                    style={{ height: 48, width: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #e5e7eb', background: '#fff', color: '#6b7280', borderRadius: 10, cursor: 'pointer' }}>
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 완제품 포장계획 탭 ──────────────────────────────────────
function PackagingTab({ rows, items, planType, rangeDates, onAdd, onRemove, onUpdate }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Label>완제품 포장계획</Label>
        <button onClick={onAdd} type="button"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, border: '1.5px solid #004634', background: '#004634', color: '#fff', borderRadius: 8, cursor: 'pointer' }}>
          <Plus size={13} /> 항목 추가
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map(r => {
          const bpb = Number(r.bags_per_box || 0)
          const tb  = Number(r.total_boxes || 0)
          const totalBags = bpb * tb
          return (
            <div key={r.key} style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 12, background: '#fafafa' }}>
              <div style={{ display: 'grid', gridTemplateColumns: planType === 'weekly' ? '140px 1fr 1fr 40px' : '1fr 1fr 40px', gap: 10, alignItems: 'end' }}>
                {planType === 'weekly' && (
                  <div>
                    <Label>날짜</Label>
                    <SelectInput value={r.target_date} onChange={v => onUpdate(r.key, { target_date: v })}>
                      <option value="">선택...</option>
                      {rangeDates.map(d => <option key={d} value={d}>{fmtKDate(d)} ({dayLabel(d)})</option>)}
                    </SelectInput>
                  </div>
                )}
                <div>
                  <Label>완성품</Label>
                  <SelectInput value={r.item_id} onChange={v => onUpdate(r.key, { item_id: v })}>
                    <option value="">선택...</option>
                    {items.map(i => <option key={i.id} value={i.id}>{itemLabel(i)}</option>)}
                  </SelectInput>
                </div>
                <div>
                  <Label>포장단위</Label>
                  <Input value={r.pkg_unit} onChange={v => onUpdate(r.key, { pkg_unit: v })} placeholder="예: 4g 5매" />
                </div>
                <button type="button" onClick={() => onRemove(r.key)}
                  style={{ height: 48, width: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #fecaca', background: '#fef2f2', color: '#dc2626', borderRadius: 10, cursor: 'pointer' }}>
                  <X size={14} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px 1fr', gap: 10, marginTop: 10, alignItems: 'end' }}>
                <div>
                  <Label>박스포장단위</Label>
                  <Input value={r.box_pkg_unit} onChange={v => onUpdate(r.key, { box_pkg_unit: v })} placeholder="예: 24봉/박스" />
                </div>
                <div>
                  <Label>박스당 봉 수</Label>
                  <Input type="number" value={r.bags_per_box} onChange={v => onUpdate(r.key, { bags_per_box: v })} placeholder="24" />
                </div>
                <div>
                  <Label>총 박스</Label>
                  <Input type="number" value={r.total_boxes} onChange={v => onUpdate(r.key, { total_boxes: v })} placeholder="0" />
                </div>
                <div>
                  <Label>소비기한</Label>
                  <Input type="date" value={r.expiry_date} onChange={v => onUpdate(r.key, { expiry_date: v })} />
                </div>
              </div>
              {(totalBags > 0) && (
                <div style={{ marginTop: 10, padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #86efac', fontSize: 13, color: '#166534' }}>
                  총 사용수량: <b>{totalBags.toLocaleString()}봉</b> (= {tb.toLocaleString()}박스 × {bpb}봉)
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 기타작업 탭 ──────────────────────────────────────────────
function OtherTab({ rows, planType, rangeDates, onAdd, onRemove, onUpdate }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Label>기타작업</Label>
        <button onClick={onAdd} type="button"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, border: '1.5px solid #004634', background: '#004634', color: '#fff', borderRadius: 8, cursor: 'pointer' }}>
          <Plus size={13} /> 항목 추가
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map(r => (
          <div key={r.key} style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 12, background: '#fafafa' }}>
            <div style={{ display: 'grid', gridTemplateColumns: planType === 'weekly' ? '140px 1fr 140px 180px 40px' : '1fr 140px 180px 40px', gap: 10, alignItems: 'end' }}>
              {planType === 'weekly' && (
                <div>
                  <Label>날짜</Label>
                  <SelectInput value={r.target_date} onChange={v => onUpdate(r.key, { target_date: v })}>
                    <option value="">선택...</option>
                    {rangeDates.map(d => <option key={d} value={d}>{fmtKDate(d)} ({dayLabel(d)})</option>)}
                  </SelectInput>
                </div>
              )}
              <div>
                <Label>품목 (직접입력)</Label>
                <Input value={r.custom_item_name} onChange={v => onUpdate(r.key, { custom_item_name: v })} placeholder="품목명" />
              </div>
              <div>
                <Label>작업수량</Label>
                <Input type="number" value={r.work_qty} onChange={v => onUpdate(r.key, { work_qty: v })} placeholder="0" />
              </div>
              <div>
                <Label>외포장</Label>
                <SelectInput value={r.outer_packing} onChange={v => onUpdate(r.key, { outer_packing: v })}>
                  {OUTER_PACKING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </SelectInput>
              </div>
              <button type="button" onClick={() => onRemove(r.key)}
                style={{ height: 48, width: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #fecaca', background: '#fef2f2', color: '#dc2626', borderRadius: 10, cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>
            {r.outer_packing === 'custom' && (
              <div style={{ marginTop: 10 }}>
                <Label>외포장 (직접입력)</Label>
                <Input value={r.outer_packing_custom} onChange={v => onUpdate(r.key, { outer_packing_custom: v })} placeholder="외포장 자재명" />
              </div>
            )}
            <div style={{ marginTop: 10, display: 'flex', gap: 12, alignItems: 'end' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Label>합포장</Label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    { v: true,  label: '예' },
                    { v: false, label: '아니요' },
                  ].map(o => {
                    const active = r.combined_packing === o.v
                    return (
                      <button key={String(o.v)} type="button" onClick={() => onUpdate(r.key, { combined_packing: o.v })}
                        style={{
                          padding: '0 16px', height: 40,
                          border: active ? '2px solid #004634' : '1.5px solid #e5e7eb',
                          background: active ? '#004634' : '#fff',
                          color: active ? '#fff' : '#374151',
                          borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                        }}>
                        {o.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              {r.combined_packing && (
                <div style={{ flex: 1 }}>
                  <Label>합포장 단위</Label>
                  <Input value={r.combined_unit} onChange={v => onUpdate(r.key, { combined_unit: v })} placeholder="예: 2개 묶음" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// 메인 페이지
// ============================================================
export default function ProductionPlan() {
  const { profile, isSeniorManager } = useAuth()
  const userMap = useUserMap()

  const [plans, setPlans] = useState([])
  const [items, setItems] = useState([])
  const [rawMaterials, setRawMaterials] = useState([])
  const [planItemsByPlan, setPlanItemsByPlan] = useState({})  // {planId: [items...]}
  const [actuals, setActuals] = useState({})                  // {item_id: output sum today}

  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')         // all | weekly | daily
  const [showModal, setShowModal] = useState(false)
  const [editPlan, setEditPlan] = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const todayIso = fmtISO(new Date())

    const [plansR, itemsR, rawR, actR] = await Promise.all([
      supabase.from('production_plans')
        .select('*')
        .is('deleted_at', null)
        .order('period_start', { ascending: false }),
      supabase.from('items')
        .select('*')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name'),
      supabase.from('raw_materials')
        .select('*')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name'),
      supabase.from('production_records')
        .select('item_id, output_qty, production_date')
        .eq('production_date', todayIso),
    ])

    const loadedPlans = plansR.data || []
    const planIds = loadedPlans.map(p => p.id)
    const { data: itemsByPlan } = planIds.length
      ? await supabase.from('production_plan_items').select('*').in('plan_id', planIds).order('sort_order')
      : { data: [] }
    const grouped = {}
    ;(itemsByPlan || []).forEach(pi => {
      if (!grouped[pi.plan_id]) grouped[pi.plan_id] = []
      grouped[pi.plan_id].push(pi)
    })

    const actByItem = {}
    ;(actR.data || []).forEach(r => {
      actByItem[r.item_id] = (actByItem[r.item_id] || 0) + Number(r.output_qty || 0)
    })

    setPlans(loadedPlans)
    setItems(itemsR.data || [])
    setRawMaterials(rawR.data || [])
    setPlanItemsByPlan(grouped)
    setActuals(actByItem)
    setLoading(false)
  }

  async function softDelete(p) {
    if (!isSeniorManager) return
    if (!confirm('이 계획을 삭제하시겠습니까?\n\n삭제 내역에서 복구할 수 있습니다.')) return
    const { error } = await supabase.from('production_plans').update({
      deleted_at: new Date().toISOString(),
      deleted_by: profile?.id || null,
    }).eq('id', p.id)
    if (error) alert(error.message); else fetchAll()
  }

  const todayIso = fmtISO(new Date())

  // 오늘 기준 진행율 (계획 대비 실적, 당일 생산량)
  function todayProgress(plan) {
    const pitems = planItemsByPlan[plan.id] || []
    const prodItems = pitems.filter(pi => pi.kind === 'production' && pi.item_id && (
      !pi.target_date || pi.target_date === todayIso
    ))
    if (prodItems.length === 0) return null
    const planned = prodItems.reduce((s, pi) => s + Number(pi.produce_qty_bags || 0), 0)
    if (planned <= 0) return null
    const actual  = prodItems.reduce((s, pi) => s + (actuals[pi.item_id] || 0), 0)
    return Math.round((actual / planned) * 100)
  }

  const filtered = plans.filter(p => typeFilter === 'all' || p.plan_type === typeFilter)

  // 요약 지표
  const weeklyCount = plans.filter(p => p.plan_type === 'weekly').length
  const dailyCount  = plans.filter(p => p.plan_type === 'daily').length
  const todayPlans  = plans.filter(p => p.period_start <= todayIso && p.period_end >= todayIso)

  let todayAvgProgress = null
  {
    const vals = todayPlans.map(todayProgress).filter(v => v != null)
    if (vals.length > 0) todayAvgProgress = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827' }}>생산 계획</h1>
        <RegisterBtn onClick={() => { setEditPlan(null); setShowModal(true) }}>
          <Plus size={20} /> 계획 등록
        </RegisterBtn>
      </div>

      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard label="전체 계획" value={plans.length} unit="건" sub={`주간 ${weeklyCount} · 일간 ${dailyCount}`} />
        <StatCard label="오늘 진행중" value={todayPlans.length} unit="건" sub={fmtKDateFull(todayIso)} />
        <div style={{
          background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e9ecef',
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#6b7280' }}>오늘 평균 진행율</span>
          </div>
          <p style={{ fontSize: 40, fontWeight: 700, color: achColor(todayAvgProgress).color, lineHeight: 1.1 }}>
            {todayAvgProgress != null ? `${todayAvgProgress}` : '—'}
            {todayAvgProgress != null && <span style={{ fontSize: 16, fontWeight: 400, color: '#9ca3af', marginLeft: 6 }}>%</span>}
          </p>
          <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 8 }}>오늘자 생산 실적 기준</p>
        </div>
      </div>

      {/* 필터 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { k: 'all',    label: '전체' },
          { k: 'weekly', label: '주간' },
          { k: 'daily',  label: '일간' },
        ].map(t => {
          const active = typeFilter === t.k
          return (
            <button key={t.k} onClick={() => setTypeFilter(t.k)}
              style={{
                padding: '10px 18px', fontSize: 14, fontWeight: 600,
                border: active ? '1.5px solid #004634' : '1.5px solid #e5e7eb',
                background: active ? '#004634' : '#fff',
                color: active ? '#fff' : '#374151',
                borderRadius: 10, cursor: 'pointer',
              }}>
              {t.label}
            </button>
          )
        })}
      </div>

      {/* 목록 */}
      <Card>
        <CardHeader title="등록된 생산 계획" sub={`${filtered.length}건 · 최신순`} />
        {loading ? (
          <div style={{ padding: '72px 0', display: 'flex', justifyContent: 'center' }}><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Calendar} text="등록된 계획이 없습니다" sub={`"계획 등록" 버튼으로 새 계획을 추가하세요`} />
        ) : (
          <div className="tbl-wrap"><table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['유형', '기간', '항목 수', '진행율', '작성자', '최종 수정', isSeniorManager ? '관리' : ''].filter(Boolean).map(h => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {filtered.map((p, i) => {
                const pitems = planItemsByPlan[p.id] || []
                const prodCount = pitems.filter(x => x.kind === 'production').length
                const pkgCount  = pitems.filter(x => x.kind === 'packaging').length
                const otherCount = pitems.filter(x => x.kind === 'other').length
                const withinToday = p.period_start <= todayIso && p.period_end >= todayIso
                const pct = withinToday ? todayProgress(p) : null
                const c = achColor(pct)
                return (
                  <tr key={p.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <Td>
                      <Badge
                        label={p.plan_type === 'weekly' ? '주간' : '일간'}
                        color={p.plan_type === 'weekly' ? '#004634' : '#C49A5A'}
                        bg={p.plan_type === 'weekly' ? '#d1fae5' : '#FCF4E2'}
                      />
                      {p.plan_type === 'daily' && p.differs_from_weekly && (
                        <span style={{ marginLeft: 6 }}>
                          <Badge label="주간차이" color="#dc2626" bg="#fee2e2" />
                        </span>
                      )}
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontWeight: 600, color: '#111827' }}>
                          {fmtKDateFull(p.period_start)}
                          {p.period_start !== p.period_end && ` ~ ${fmtKDateFull(p.period_end)}`}
                        </span>
                        {(p.holidays?.length || 0) > 0 && (
                          <span style={{ fontSize: 12, color: '#dc2626' }}>휴일 {p.holidays.length}일</span>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {prodCount > 0 && <Badge label={`생산 ${prodCount}`} color="#004634" bg="#d1fae5" />}
                        {pkgCount > 0  && <Badge label={`포장 ${pkgCount}`}  color="#1e40af" bg="#dbeafe" />}
                        {otherCount > 0 && <Badge label={`기타 ${otherCount}`} color="#92400e" bg="#fef3c7" />}
                        {pitems.length === 0 && <span style={{ color: '#d1d5db' }}>—</span>}
                      </div>
                    </Td>
                    <Td>
                      {pct == null ? <span style={{ color: '#d1d5db' }}>—</span> : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ flex: 1, maxWidth: 120, height: 8, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(pct, 150) / 1.5}%`, height: '100%', background: c.color, borderRadius: 99 }} />
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 700, color: c.color, minWidth: 48, textAlign: 'right' }}>{pct}%</span>
                        </div>
                      )}
                    </Td>
                    <Td><AuditStamp userName={userMap[p.created_by]} at={p.created_at} /></Td>
                    <Td><AuditStamp userName={userMap[p.updated_by]} at={p.updated_at} /></Td>
                    {isSeniorManager && (
                      <Td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <IconBtn icon={Edit2} onClick={() => { setEditPlan(p); setShowModal(true) }} label="수정" />
                          <IconBtn icon={Trash2} variant="danger" onClick={() => softDelete(p)} label="삭제" />
                        </div>
                      </Td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table></div>
        )}
      </Card>

      {showModal && (
        <PlanRegisterModal
          plan={editPlan}
          items={items}
          rawMaterials={rawMaterials}
          profile={profile}
          onClose={() => { setShowModal(false); setEditPlan(null) }}
          onSave={() => { setShowModal(false); setEditPlan(null); fetchAll() }}
        />
      )}
    </div>
  )
}
