import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  Calendar, Save, TrendingUp, TrendingDown, Minus, Edit2, Check, X,
} from 'lucide-react'
import {
  Card, CardHeader, Btn, RegisterBtn, StatCard, Badge,
  EmptyState, Spinner, Th, Td, LotBadge,
} from '../components/UI'

// ── 날짜 유틸 (주: 월 시작, 월~금 근무 기준) ────────────────────
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
function fmtShort(d) { return `${d.getMonth() + 1}/${d.getDate()}` }
function weekLabel(s) { return `${fmtShort(s)} ~ ${fmtShort(addDays(s, 4))}` }

// ── 달성률 색상 ─────────────────────────────────────────────
function achColor(pct) {
  if (pct == null) return { color: '#9ca3af', bg: '#f3f4f6', label: '—' }
  if (pct >= 100) return { color: '#059669', bg: '#d1fae5', label: `${pct}%` }
  if (pct >= 80)  return { color: '#d97706', bg: '#fef3c7', label: `${pct}%` }
  return { color: '#dc2626', bg: '#fee2e2', label: `${pct}%` }
}

// ── 화살표 추이 ─────────────────────────────────────────────
function TrendArrow({ from, to }) {
  if (!from) return <span style={{ color: '#9ca3af', fontSize: 13 }}>—</span>
  const diff = to - from
  const pct = Math.round((diff / from) * 100)
  if (pct === 0) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#9ca3af' }}><Minus size={12} />0%</span>
  const up = pct > 0
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, color: up ? '#059669' : '#dc2626' }}>
      {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{up ? '+' : ''}{pct}%
    </span>
  )
}

export default function ProductionPlan() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)     // 0: 이번 주, 1: 다음 주
  const [mode, setMode] = useState('boxes')            // 'boxes' | 'sheets'
  const [plans, setPlans] = useState({})               // {iso: {itemId: qty}}
  const [yearPlans, setYearPlans] = useState({})       // {itemId: qty}
  const [actuals, setActuals] = useState({})           // {itemId: output}
  const [draft, setDraft] = useState({})               // {itemId: qty(boxes)}
  const [editingRSP, setEditingRSP] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [toast, setToast] = useState('')

  const thisWeek = useMemo(() => startOfWeek(new Date()), [])
  const weekStart = useMemo(() => addDays(thisWeek, weekOffset * 7), [thisWeek, weekOffset])
  const weekEnd   = useMemo(() => addDays(weekStart, 4), [weekStart])
  const currentIso = fmtISO(weekStart)

  useEffect(() => { fetchAll() }, [weekOffset])

  async function fetchAll() {
    setLoading(true)
    const w4ago   = fmtISO(addDays(weekStart, -28))
    const yearAgo = fmtISO(addDays(weekStart, -364))

    const [itemsR, planR, yearR, prodR] = await Promise.all([
      supabase.from('items').select('*').eq('is_active', true).order('code'),
      supabase.from('weekly_plans').select('*').gte('week_start', w4ago).lte('week_start', currentIso),
      supabase.from('weekly_plans').select('*').eq('week_start', yearAgo),
      supabase.from('production_records')
        .select('item_id, output_qty')
        .gte('production_date', currentIso)
        .lte('production_date', fmtISO(weekEnd)),
    ])

    const grouped = {}
    ;(planR.data || []).forEach(p => {
      if (!grouped[p.week_start]) grouped[p.week_start] = {}
      grouped[p.week_start][p.item_id] = Number(p.planned_qty) || 0
    })
    const ya = {}
    ;(yearR.data || []).forEach(p => { ya[p.item_id] = Number(p.planned_qty) || 0 })
    const act = {}
    ;(prodR.data || []).forEach(r => { act[r.item_id] = (act[r.item_id] || 0) + (Number(r.output_qty) || 0) })

    const d = {}
    ;(itemsR.data || []).forEach(it => { d[it.id] = grouped[currentIso]?.[it.id] || '' })

    setItems(itemsR.data || [])
    setPlans(grouped); setYearPlans(ya); setActuals(act); setDraft(d)
    setLoading(false)
  }

  function setBoxQty(itemId, raw) {
    const rsp = items.find(i => i.id === itemId)?.raw_sheets_per_unit || 1
    if (raw === '') { setDraft(p => ({ ...p, [itemId]: '' })); return }
    const num = Number(raw); if (isNaN(num) || num < 0) return
    const boxes = mode === 'sheets' ? Math.round(num / rsp) : num
    setDraft(p => ({ ...p, [itemId]: boxes }))
  }
  function displayVal(itemId) {
    const v = draft[itemId]
    if (v === '' || v == null) return ''
    const rsp = items.find(i => i.id === itemId)?.raw_sheets_per_unit || 1
    return mode === 'sheets' ? v * rsp : v
  }

  async function savePlan() {
    setSaving(true); setToast('')
    const rows = items
      .filter(it => draft[it.id] !== '' && draft[it.id] != null && Number(draft[it.id]) > 0)
      .map(it => ({
        week_start: currentIso,
        item_id: it.id,
        planned_qty: Number(draft[it.id]),
        created_by: user?.id || null,
      }))
    const zeroItems = items
      .filter(it => (draft[it.id] === '' || draft[it.id] == null || Number(draft[it.id]) === 0) && plans[currentIso]?.[it.id])
      .map(it => it.id)

    let err = null
    if (rows.length > 0) {
      const { error } = await supabase.from('weekly_plans').upsert(rows, { onConflict: 'week_start,item_id' })
      if (error) err = error
    }
    if (!err && zeroItems.length > 0) {
      const { error } = await supabase.from('weekly_plans').delete().eq('week_start', currentIso).in('item_id', zeroItems)
      if (error) err = error
    }
    setSaving(false)
    setToast(err ? `오류: ${err.message}` : '저장 완료')
    setTimeout(() => setToast(''), 2500)
    if (!err) fetchAll()
  }

  async function saveRSP(itemId) {
    const n = Number(editVal)
    if (!n || n < 1) { setEditingRSP(null); setEditVal(''); return }
    await supabase.from('items').update({ raw_sheets_per_unit: n }).eq('id', itemId)
    setEditingRSP(null); setEditVal('')
    fetchAll()
  }

  // ── 집계 ──
  const planTotal = items.reduce((s, it) => s + (plans[currentIso]?.[it.id] || 0), 0)
  const actualTotal = items.reduce((s, it) => s + (actuals[it.id] || 0), 0)
  const achievement = planTotal > 0 ? Math.round((actualTotal / planTotal) * 100) : null
  const ach = achColor(achievement)

  const weekOffsets = [-4, -3, -2, -1, 0]
  const weekStarts  = weekOffsets.map(n => addDays(weekStart, n * 7))
  const weekIsos    = weekStarts.map(fmtISO)

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827' }}>생산 계획</h1>
        <RegisterBtn onClick={savePlan} disabled={saving || loading}>
          <Save size={20} /> {saving ? '저장 중...' : '계획 저장'}
        </RegisterBtn>
        {toast && <span style={{ fontSize: 14, color: toast.startsWith('오류') ? '#dc2626' : '#059669', fontWeight: 600 }}>{toast}</span>}
      </div>

      {/* 컨트롤 바: 주 선택 + 입력 단위 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 4 }}>
          {[{ v: 0, label: '이번 주' }, { v: 1, label: '다음 주' }].map(o => (
            <button key={o.v} onClick={() => setWeekOffset(o.v)}
              style={{
                padding: '10px 20px', fontSize: 15, fontWeight: 600,
                border: 'none', borderRadius: 8, cursor: 'pointer',
                background: weekOffset === o.v ? '#004634' : 'transparent',
                color: weekOffset === o.v ? '#fff' : '#6b7280',
                transition: 'all 0.15s',
              }}>
              {o.label}
            </button>
          ))}
        </div>
        <Badge label={weekLabel(weekStart)} color="#004634" bg="#FCF4E2" />

        <div style={{ marginLeft: 'auto', display: 'inline-flex', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 4 }}>
          {[{ v: 'boxes', label: '박스 기준' }, { v: 'sheets', label: '장 기준' }].map(o => (
            <button key={o.v} onClick={() => setMode(o.v)}
              style={{
                padding: '10px 16px', fontSize: 14, fontWeight: 600,
                border: 'none', borderRadius: 8, cursor: 'pointer',
                background: mode === o.v ? '#B2EF8B' : 'transparent',
                color: mode === o.v ? '#004634' : '#6b7280',
              }}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="이번 주 계획 총량" value={planTotal.toLocaleString()} unit="박스" />
        <StatCard label="이번 주 실적 누계" value={actualTotal.toLocaleString()} unit="박스" />
        <div style={{
          background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e9ecef',
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#6b7280' }}>달성률</span>
            <Badge label={ach.label} color={ach.color} bg={ach.bg} />
          </div>
          <p style={{ fontSize: 40, fontWeight: 700, color: ach.color, lineHeight: 1.1 }}>
            {achievement != null ? `${achievement}` : '—'}
            {achievement != null && <span style={{ fontSize: 16, fontWeight: 400, color: '#9ca3af', marginLeft: 6 }}>%</span>}
          </p>
          <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 8 }}>계획 대비 실적</p>
        </div>
        <StatCard label="등록 품목" value={items.length} unit="종" sub="활성 품목 기준" />
      </div>

      {/* 계획 입력 테이블 */}
      <Card>
        <CardHeader title={`${weekLabel(weekStart)} 계획 입력`} sub={weekOffset === 0 ? '이번 주' : '다음 주'} />
        {loading ? (
          <div style={{ padding: '72px 0', display: 'flex', justifyContent: 'center' }}><Spinner /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={Calendar} text="활성 품목이 없습니다" />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['품목', '코드', '규격', '박스당 장수', `계획 (${mode === 'sheets' ? '장' : '박스'})`, '변환 표시'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {items.map((it, i) => {
                const rsp = it.raw_sheets_per_unit || 1
                const boxVal = Number(draft[it.id] || 0)
                const sheetVal = boxVal * rsp
                return (
                  <tr key={it.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <Td><span style={{ fontWeight: 500, color: '#111827' }}>{it.name}</span></Td>
                    <Td><LotBadge>{it.code}</LotBadge></Td>
                    <Td style={{ color: '#6b7280' }}>{it.packaging_type || '—'} {it.sheet_count ? `${it.sheet_count}매` : ''} {it.weight_g ? `· ${it.weight_g}g` : ''}</Td>
                    <Td>
                      {editingRSP === it.id ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <input type="number" value={editVal} autoFocus onChange={e => setEditVal(e.target.value)}
                            style={{ width: 60, height: 32, padding: '0 8px', fontSize: 14, border: '1.5px solid #004634', borderRadius: 6, outline: 'none' }} />
                          <button onClick={() => saveRSP(it.id)} style={{ width: 28, height: 28, border: 'none', background: '#004634', color: '#fff', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Check size={14} /></button>
                          <button onClick={() => { setEditingRSP(null); setEditVal('') }} style={{ width: 28, height: 28, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 600, color: '#111827' }}>{rsp}</span>
                          <span style={{ color: '#9ca3af', fontSize: 13 }}>장/박스</span>
                          <button onClick={() => { setEditingRSP(it.id); setEditVal(String(rsp)) }}
                            style={{ width: 24, height: 24, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Edit2 size={12} />
                          </button>
                        </span>
                      )}
                    </Td>
                    <Td>
                      <input type="number" min={0}
                        value={displayVal(it.id)}
                        onChange={e => setBoxQty(it.id, e.target.value)}
                        style={{ width: 140, height: 40, padding: '0 12px', fontSize: 15, fontWeight: 600, border: '1.5px solid #e5e7eb', borderRadius: 8, outline: 'none' }}
                        onFocus={e => (e.target.style.borderColor = '#004634')}
                        onBlur={e => (e.target.style.borderColor = '#e5e7eb')} />
                    </Td>
                    <Td style={{ color: '#6b7280' }}>
                      {boxVal > 0 ? (
                        mode === 'boxes'
                          ? <>= <b style={{ color: '#111827' }}>{sheetVal.toLocaleString()}</b> 장</>
                          : <>= <b style={{ color: '#111827' }}>{boxVal.toLocaleString()}</b> 박스</>
                      ) : '—'}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* 이전 4주 + 전년 동기 비교 */}
      <div style={{ marginTop: 24 }}>
        <Card>
          <CardHeader title="이전 4주 · 전년 동기 비교" sub="품목별 주간 계획량 (박스)" />
          {loading ? (
            <div style={{ padding: '72px 0', display: 'flex', justifyContent: 'center' }}><Spinner /></div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <Th>품목</Th>
                  {weekStarts.map((ws, idx) => (
                    <Th key={idx}>
                      {idx === 4 ? '이번 주' : `W-${4 - idx}`}
                      <div style={{ fontSize: 11, fontWeight: 400, color: '#9ca3af', marginTop: 2 }}>{fmtShort(ws)}</div>
                    </Th>
                  ))}
                  <Th>전년 동기</Th>
                  <Th>추이 (WoW)</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const vals = weekIsos.map(iso => plans[iso]?.[it.id] || 0)
                  const prevWeek = vals[3], curr = vals[4]
                  const ya = yearPlans[it.id] || 0
                  return (
                    <tr key={it.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <Td><span style={{ fontWeight: 500, color: '#111827' }}>{it.name}</span></Td>
                      {vals.map((v, idx) => (
                        <Td key={idx} style={{ textAlign: 'right', fontWeight: idx === 4 ? 700 : 500, color: idx === 4 ? '#004634' : '#374151' }}>
                          {v ? v.toLocaleString() : <span style={{ color: '#d1d5db' }}>—</span>}
                        </Td>
                      ))}
                      <Td style={{ textAlign: 'right', color: '#6b7280' }}>
                        {ya ? ya.toLocaleString() : <span style={{ color: '#d1d5db' }}>—</span>}
                      </Td>
                      <Td><TrendArrow from={prevWeek} to={curr} /></Td>
                    </tr>
                  )
                })}
                {/* 합계 */}
                <tr style={{ background: '#f5f5f0', fontWeight: 700 }}>
                  <Td><span style={{ fontWeight: 700, color: '#111827' }}>합계</span></Td>
                  {weekIsos.map((iso, idx) => {
                    const sum = items.reduce((s, it) => s + (plans[iso]?.[it.id] || 0), 0)
                    return <Td key={idx} style={{ textAlign: 'right', fontWeight: 700, color: idx === 4 ? '#004634' : '#111827' }}>{sum.toLocaleString()}</Td>
                  })}
                  <Td style={{ textAlign: 'right', fontWeight: 700, color: '#6b7280' }}>
                    {Object.values(yearPlans).reduce((s, v) => s + v, 0).toLocaleString()}
                  </Td>
                  <Td>
                    <TrendArrow
                      from={items.reduce((s, it) => s + (plans[weekIsos[3]]?.[it.id] || 0), 0)}
                      to={planTotal}
                    />
                  </Td>
                </tr>
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* 계획 대비 실적 */}
      <div style={{ marginTop: 24 }}>
        <Card>
          <CardHeader title="이번 주 계획 대비 실적" sub="실적 = production_records.output_qty" />
          {loading ? (
            <div style={{ padding: '72px 0', display: 'flex', justifyContent: 'center' }}><Spinner /></div>
          ) : items.length === 0 ? (
            <EmptyState icon={Calendar} text="품목이 없습니다" />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['품목', '코드', '계획 (박스)', '실적 (박스)', '달성률', '상태'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
              <tbody>
                {items.map((it, i) => {
                  const plan = plans[currentIso]?.[it.id] || 0
                  const actual = actuals[it.id] || 0
                  const pct = plan > 0 ? Math.round((actual / plan) * 100) : null
                  const c = achColor(pct)
                  return (
                    <tr key={it.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <Td><span style={{ fontWeight: 500, color: '#111827' }}>{it.name}</span></Td>
                      <Td><LotBadge>{it.code}</LotBadge></Td>
                      <Td style={{ textAlign: 'right', fontWeight: 600 }}>{plan ? plan.toLocaleString() : <span style={{ color: '#d1d5db' }}>—</span>}</Td>
                      <Td style={{ textAlign: 'right', fontWeight: 600, color: '#004634' }}>{actual ? actual.toLocaleString() : <span style={{ color: '#d1d5db' }}>—</span>}</Td>
                      <Td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ flex: 1, maxWidth: 120, height: 8, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(pct || 0, 150) / 1.5}%`, height: '100%', background: c.color, borderRadius: 99 }} />
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 700, color: c.color, minWidth: 52, textAlign: 'right' }}>
                            {pct != null ? `${pct}%` : '—'}
                          </span>
                        </div>
                      </Td>
                      <Td>
                        {pct == null ? <Badge label="계획 없음" color="#9ca3af" bg="#f3f4f6" /> :
                          pct >= 100 ? <Badge label="달성" color="#059669" bg="#d1fae5" /> :
                          pct >= 80  ? <Badge label="근접" color="#d97706" bg="#fef3c7" /> :
                                       <Badge label="미달" color="#dc2626" bg="#fee2e2" />}
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  )
}
