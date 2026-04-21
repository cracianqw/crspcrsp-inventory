import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Truck, X, ChevronDown, ChevronUp, CalendarClock, Edit2, Trash2 } from 'lucide-react'
import {
  Card, CardHeader, Btn, RegisterBtn, IconBtn,
  Label, Input, SelectInput, Textarea,
  Overlay, ModalHeader, ModalBody, ModalFooter,
  ErrorBox, EmptyState, Spinner, Badge, LotBadge, DateBadge,
  Th, Td, AuditStamp, useUserMap,
} from '../components/UI'

const STATUS = {
  pending:   { label: '대기중',   color: '#d97706', bg: '#fef3c7' },
  shipped:   { label: '출고완료', color: '#2563eb', bg: '#dbeafe' },
  delivered: { label: '납품완료', color: '#059669', bg: '#d1fae5' },
  cancelled: { label: '취소',     color: '#9ca3af', bg: '#f3f4f6' },
}

function ShippingModal({ partners, items, stock, onClose, onSave }) {
  const { user } = useAuth()
  const [form, setForm] = useState({ partner_id: '', order_date: new Date().toISOString().split('T')[0], notes: '' })
  const [orderItems, setOrderItems] = useState([{ item_id: '', batch_number: '', quantity: '', unit_price: '' }])
  const [partnerSpecs, setPartnerSpecs] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function loadSpecs(id) {
    if (!id) { setPartnerSpecs([]); return }
    const { data } = await supabase.from('partner_specs').select('*, items(name)').eq('partner_id', id)
    setPartnerSpecs(data || [])
  }

  function handleItemChange(idx, itemId) {
    setOrderItems(p => p.map((it, i) => i === idx ? { ...it, item_id: itemId, batch_number: '' } : it))
    const spec = partnerSpecs.find(s => s.item_id === itemId)
    if (spec?.box_qty) setOrderItems(p => p.map((it, i) => i === idx ? { ...it, quantity: String(spec.box_qty) } : it))
  }

  async function handleSave() {
    if (!form.partner_id) { setError('거래처를 선택해 주세요.'); return }
    const valid = orderItems.filter(it => it.item_id && it.quantity)
    if (valid.length === 0) { setError('출고 품목을 입력해 주세요.'); return }
    setSaving(true); setError('')
    try {
      const { data: order, error: e } = await supabase.from('shipping_orders').insert({ ...form, status: 'pending', created_by: user?.id }).select().single()
      if (e) throw e
      await supabase.from('shipping_items').insert(valid.map(it => ({ order_id: order.id, item_id: it.item_id, batch_number: it.batch_number || null, quantity: Number(it.quantity), unit_price: it.unit_price ? Number(it.unit_price) : null })))
      onSave()
    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  const availableBatches = (itemId) => stock.filter(s => s.item_id === itemId && Number(s.quantity) > 0)
  const totalAmt = orderItems.reduce((s, it) => s + (it.unit_price && it.quantity ? Number(it.unit_price) * Number(it.quantity) : 0), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-8 pt-8 pb-5 border-b border-gray-100 z-10">
          <button onClick={onClose} className="absolute top-6 right-6 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
          <h2 className="text-xl font-bold text-gray-900">출고 주문 등록</h2>
        </div>
        <div className="px-8 py-7 space-y-6">
          {error && <ErrorBox msg={error} />}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label required>거래처</Label>
              <SelectInput value={form.partner_id} onChange={v => { f('partner_id', v); loadSpecs(v) }}>
                <option value="">거래처 선택...</option>
                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </SelectInput>
              {partners.length === 0 && <p className="text-xs text-amber-600 mt-1.5">거래처 관리 페이지에서 먼저 등록하세요</p>}
            </div>
            <div><Label required>출고일</Label><Input type="date" value={form.order_date} onChange={v => f('order_date', v)} /></div>
          </div>

          {partnerSpecs.length > 0 && (
            <div className="rounded-lg p-4 bg-amber-50 border border-amber-100">
              <p className="text-xs font-semibold text-amber-700 mb-2">📋 납품 규격</p>
              <div className="flex flex-wrap gap-2">
                {partnerSpecs.map(spec => (
                  <span key={spec.id} className="text-xs font-medium px-2.5 py-1 rounded-md bg-white border border-amber-100 text-gray-700">
                    {spec.items?.name}: {spec.box_qty}박스{spec.label_type ? ` / ${spec.label_type}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <Label>출고 품목</Label>
              <button onClick={() => setOrderItems(p => [...p, { item_id: '', batch_number: '', quantity: '', unit_price: '' }])}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">
                <Plus size={12} /> 품목 추가
              </button>
            </div>
            <div className="space-y-2">
              {orderItems.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-4">
                    <SelectInput value={it.item_id} onChange={v => handleItemChange(idx, v)}>
                      <option value="">품목...</option>
                      {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </SelectInput>
                  </div>
                  <div className="col-span-3">
                    <SelectInput value={it.batch_number} onChange={v => setOrderItems(p => p.map((x, i) => i === idx ? { ...x, batch_number: v } : x))}>
                      <option value="">배치 선택...</option>
                      {availableBatches(it.item_id).map(s => <option key={s.id} value={s.batch_number}>{s.batch_number} ({Number(s.quantity)}박스)</option>)}
                    </SelectInput>
                  </div>
                  <div className="col-span-2">
                    <input type="number" value={it.quantity} onChange={e => setOrderItems(p => p.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))}
                      placeholder="수량" className="w-full h-11 px-3 text-sm border border-gray-200 rounded-lg outline-none"
                      onFocus={e => (e.target.style.borderColor = '#004634')} onBlur={e => (e.target.style.borderColor = '#e5e7eb')} />
                  </div>
                  <div className="col-span-2">
                    <input type="number" value={it.unit_price} onChange={e => setOrderItems(p => p.map((x, i) => i === idx ? { ...x, unit_price: e.target.value } : x))}
                      placeholder="단가" className="w-full h-11 px-3 text-sm border border-gray-200 rounded-lg outline-none"
                      onFocus={e => (e.target.style.borderColor = '#004634')} onBlur={e => (e.target.style.borderColor = '#e5e7eb')} />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {orderItems.length > 1 && (
                      <button onClick={() => setOrderItems(p => p.filter((_, i) => i !== idx))}
                        className="w-8 h-8 flex items-center justify-center rounded-md bg-red-50 text-red-500 hover:bg-red-100">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {totalAmt > 0 && <p className="text-right text-sm font-bold text-gray-700">합계: ₩{totalAmt.toLocaleString()}</p>}
            </div>
          </div>
          <div><Label>메모</Label><Textarea value={form.notes} onChange={v => f('notes', v)} rows={2} placeholder="배송 메모, 특이사항..." /></div>
        </div>
        <div className="sticky bottom-0 bg-white px-8 py-5 border-t border-gray-100 flex gap-3 justify-end">
          <Btn variant="secondary" onClick={onClose}>취소</Btn>
          <Btn disabled={saving} onClick={handleSave}>{saving ? '등록 중...' : '출고 등록'}</Btn>
        </div>
      </div>
    </div>
  )
}

function OrderRow({ order, index, onStatusChange, userMap }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const st = STATUS[order.status] || STATUS.pending

  async function loadItems() {
    if (open) { setOpen(false); return }
    const { data } = await supabase.from('shipping_items').select('*, items(name, code)').eq('order_id', order.id)
    setItems(data || []); setOpen(true)
  }

  const total = items.reduce((s, it) => s + (it.unit_price && it.quantity ? it.unit_price * it.quantity : 0), 0)

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors cursor-pointer" style={{ borderBottom: '1px solid #f9fafb' }} onClick={loadItems}>
        <Td><DateBadge>{new Date(order.order_date).toLocaleDateString('ko-KR', { month:'short', day:'numeric' })}</DateBadge></Td>
        <Td><span className="font-medium text-gray-900">{order.partners?.name || '—'}</span></Td>
        <Td className="text-gray-400 text-xs max-w-xs">{order.notes || '—'}</Td>
        <Td onClick={e => e.stopPropagation()}>
          <select value={order.status} onChange={e => { e.stopPropagation(); onStatusChange(order.id, e.target.value) }}
            className="text-xs font-medium px-3 py-1.5 rounded-full outline-none cursor-pointer appearance-none"
            style={{ backgroundColor: st.bg, color: st.color, border: 'none' }}>
            {Object.entries(STATUS).map(([val, s]) => <option key={val} value={val}>{s.label}</option>)}
          </select>
        </Td>
        <Td><AuditStamp userName={userMap[order.created_by]} at={order.created_at} /></Td>
        <Td><AuditStamp userName={userMap[order.updated_by]} at={order.updated_at} /></Td>
        <Td>{open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}</Td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} className="px-8 py-5 bg-gray-50/50" style={{ borderBottom: '1px solid #f9fafb' }}>
            {items.length === 0 ? <p className="text-sm text-gray-400">품목 정보 없음</p> : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {['품목', '배치', '수량', '단가', '금액'].map(h => (
                        <th key={h} className="text-left pb-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(it => (
                      <tr key={it.id} className="border-t border-gray-100">
                        <td className="py-2.5 font-medium text-gray-900">{it.items?.name}</td>
                        <td className="py-2.5">{it.batch_number ? <LotBadge>{it.batch_number}</LotBadge> : '—'}</td>
                        <td className="py-2.5 text-gray-700">{it.quantity} 박스</td>
                        <td className="py-2.5 text-gray-500">{it.unit_price ? `₩${Number(it.unit_price).toLocaleString()}` : '—'}</td>
                        <td className="py-2.5 font-medium text-gray-900">{it.unit_price && it.quantity ? `₩${(it.unit_price * it.quantity).toLocaleString()}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {total > 0 && <p className="text-sm font-bold text-gray-800 text-right mt-3 pt-3 border-t border-gray-100">합계: ₩{total.toLocaleString()}</p>}
              </>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ── 출고 계획 모달 ──────────────────────────────────
function PlanModal({ plan, partners, items, profile, onClose, onSave }) {
  const [form, setForm] = useState({
    partner_id:   plan?.partner_id   || '',
    item_id:      plan?.item_id      || '',
    planned_date: plan?.planned_date || new Date().toISOString().split('T')[0],
    quantity:     plan?.quantity     || '',
    manager:      plan?.manager      || '',
    notes:        plan?.notes        || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!form.partner_id)               { setError('거래처를 선택해 주세요.'); return }
    if (!form.item_id)                  { setError('품목을 선택해 주세요.');   return }
    if (!form.quantity || Number(form.quantity) <= 0) { setError('수량을 입력해 주세요.'); return }
    setSaving(true); setError('')
    const payload = {
      partner_id:   form.partner_id,
      item_id:      form.item_id,
      planned_date: form.planned_date,
      quantity:     Number(form.quantity),
      manager:      form.manager || null,
      notes:        form.notes || null,
    }
    let err = null
    if (plan?.id) {
      const { error } = await supabase.from('shipping_plans').update({
        ...payload,
        updated_by: profile?.id || null,
        updated_at: new Date().toISOString(),
      }).eq('id', plan.id)
      err = error
    } else {
      const { error } = await supabase.from('shipping_plans').insert({
        ...payload,
        created_by: profile?.id || null,
      })
      err = error
    }
    setSaving(false)
    if (err) setError(err.message); else onSave()
  }

  return (
    <Overlay onClose={onClose} size="md">
      <ModalHeader>{plan ? '출고 계획 수정' : '출고 계획 등록'}</ModalHeader>
      <ModalBody>
        {error && <ErrorBox msg={error} />}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <Label required>거래처</Label>
            <SelectInput value={form.partner_id} onChange={v => f('partner_id', v)}>
              <option value="">거래처 선택...</option>
              {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </SelectInput>
          </div>
          <div>
            <Label required>출고 예정일</Label>
            <Input type="date" value={form.planned_date} onChange={v => f('planned_date', v)} />
          </div>
          <div>
            <Label required>품목</Label>
            <SelectInput value={form.item_id} onChange={v => f('item_id', v)}>
              <option value="">품목 선택...</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </SelectInput>
          </div>
          <div>
            <Label required>수량 (박스)</Label>
            <Input type="number" value={form.quantity} onChange={v => f('quantity', v)} placeholder="0" />
          </div>
          <div>
            <Label>담당자</Label>
            <Input value={form.manager} onChange={v => f('manager', v)} placeholder="홍길동" />
          </div>
        </div>
        <div>
          <Label>메모</Label>
          <Textarea value={form.notes} onChange={v => f('notes', v)} rows={2} placeholder="특이사항..." />
        </div>
      </ModalBody>
      <ModalFooter>
        <Btn variant="secondary" onClick={onClose}>취소</Btn>
        <Btn disabled={saving} onClick={handleSave}>{saving ? '저장 중...' : plan ? '수정 저장' : '계획 등록'}</Btn>
      </ModalFooter>
    </Overlay>
  )
}

export default function Shipping() {
  const { profile, isSeniorManager } = useAuth()
  const userMap = useUserMap()
  const [tab, setTab] = useState('orders')          // 'orders' | 'plans'
  const [plans, setPlans] = useState([])
  const [editPlan, setEditPlan] = useState(null)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [orders, setOrders] = useState([])
  const [partners, setPartners] = useState([])
  const [items, setItems] = useState([])
  const [stock, setStock] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: ords }, { data: pts }, { data: its }, { data: st }, { data: pls }] = await Promise.all([
      supabase.from('shipping_orders').select('*, partners(name)').is('deleted_at', null).order('order_date', { ascending: false }),
      supabase.from('partners').select('*').in('type', ['customer', 'both']).is('deleted_at', null).order('name'),
      supabase.from('items').select('*').eq('is_active', true).is('deleted_at', null).order('name'),
      supabase.from('finished_goods_stock').select('*').gt('quantity', 0),
      supabase.from('shipping_plans').select('*, partners(name), items(name, code)').is('deleted_at', null).order('planned_date'),
    ])
    setOrders(ords || []); setPartners(pts || []); setItems(its || []); setStock(st || [])
    setPlans(pls || [])
    setLoading(false)
  }

  async function softDeletePlan(plan) {
    if (!isSeniorManager) return
    if (!confirm(`이 출고 계획을 삭제하시겠습니까?\n\n삭제 내역 메뉴에서 복구 가능합니다.`)) return
    const { error } = await supabase.from('shipping_plans').update({
      deleted_at: new Date().toISOString(),
      deleted_by: profile?.id || null,
    }).eq('id', plan.id)
    if (error) alert(error.message)
    else fetchAll()
  }

  async function handleStatusChange(orderId, newStatus) {
    await supabase.from('shipping_orders').update({ status: newStatus }).eq('id', orderId)
    setOrders(p => p.map(o => o.id === orderId ? { ...o, status: newStatus } : o))
  }

  const filtered = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter)
  const counts = { all: orders.length, pending: orders.filter(o => o.status === 'pending').length, shipped: orders.filter(o => o.status === 'shipped').length, delivered: orders.filter(o => o.status === 'delivered').length }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827' }}>출고 관리</h1>
        {tab === 'orders' ? (
          <RegisterBtn onClick={() => setShowModal(true)}>출고 등록</RegisterBtn>
        ) : isSeniorManager ? (
          <RegisterBtn onClick={() => { setEditPlan(null); setShowPlanModal(true) }}>출고 계획 등록</RegisterBtn>
        ) : null}
      </div>

      {/* 탭 스위처 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #e5e7eb' }}>
        {[
          { key: 'orders', label: '출고 이력', icon: Truck },
          { key: 'plans',  label: '출고 계획', icon: CalendarClock },
        ].map(t => {
          const active = tab === t.key
          const Icon = t.icon
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px 48px', fontSize: 14, fontWeight: 600, lineHeight: 1,
                background: active ? '#FF6B35' : '#e8e4dc',
                color: active ? '#ffffff' : '#6b7280',
                border: 'none', borderRadius: '8px 8px 0 0',
                marginBottom: active ? -1 : 0,
                cursor: 'pointer', transition: 'all 0.15s',
                position: 'relative', zIndex: active ? 1 : 0,
              }}>
              <Icon size={15} />{t.label}
            </button>
          )
        })}
      </div>

      {tab === 'orders' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            {[{ key: 'all', label: '전체' }, { key: 'pending', label: '대기중' }, { key: 'shipped', label: '출고완료' }, { key: 'delivered', label: '납품완료' }].map(({ key, label }) => {
              const active = statusFilter === key
              const st = key !== 'all' ? STATUS[key] : null
              return (
                <button key={key} onClick={() => setStatusFilter(key)}
                  style={{
                    background: '#ffffff', borderRadius: 12, padding: 24, textAlign: 'left',
                    cursor: 'pointer', transition: 'all 0.15s',
                    border: active ? '2px solid #004634' : '1px solid #e9ecef',
                    boxShadow: active ? '0 0 0 4px rgba(0,70,52,0.08)' : '0 4px 12px rgba(0,0,0,0.06)',
                  }}>
                  <p style={{ fontSize: 14, marginBottom: 14, color: active && st ? st.color : '#6b7280', fontWeight: active ? 600 : 500 }}>{label}</p>
                  <p style={{ fontSize: 40, fontWeight: 700, color: active ? '#004634' : '#111827', lineHeight: 1.1 }}>{counts[key]}</p>
                </button>
              )
            })}
          </div>

          <Card>
            <CardHeader title="출고 이력" sub={`${filtered.length}건`} />
            {loading ? (
              <div className="py-20 flex items-center justify-center"><Spinner /></div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={Truck} text="출고 이력이 없습니다" />
            ) : (
              <div className="tbl-wrap"><table className="w-full">
                <thead><tr>{['출고일', '거래처', '메모', '상태', '등록', '수정', ''].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
                <tbody>
                  {filtered.map((order, i) => <OrderRow key={order.id} order={order} index={i} onStatusChange={handleStatusChange} userMap={userMap} />)}
                </tbody>
              </table></div>
            )}
          </Card>
        </>
      ) : (
        // ── 출고 계획 뷰 ──
        <Card>
          <CardHeader title="출고 계획" sub={`${plans.length}건 · 예정일 오름차순`} />
          {loading ? (
            <div className="py-20 flex items-center justify-center"><Spinner /></div>
          ) : plans.length === 0 ? (
            <EmptyState icon={CalendarClock} text="등록된 출고 계획이 없습니다" />
          ) : (
            <div className="tbl-wrap"><table className="w-full">
              <thead><tr>{['예정일', '거래처', '품목', '수량', '담당자', '상태', '등록', '수정', isSeniorManager ? '관리' : ''].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
              <tbody>
                {plans.map((p, i) => {
                  const st = STATUS[p.status] || STATUS.pending
                  const d = new Date(p.planned_date)
                  const today = new Date(); today.setHours(0,0,0,0)
                  const diff = Math.ceil((d - today) / 86400000)
                  return (
                    <tr key={p.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <Td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <DateBadge>{d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</DateBadge>
                          {diff >= 0 && diff <= 7 && (
                            <span style={{ fontSize: 11, color: diff === 0 ? '#dc2626' : diff <= 3 ? '#d97706' : '#6b7280', fontWeight: 600 }}>
                              {diff === 0 ? '오늘' : `D-${diff}`}
                            </span>
                          )}
                        </div>
                      </Td>
                      <Td><span style={{ fontWeight: 500, color: '#111827' }}>{p.partners?.name || '—'}</span></Td>
                      <Td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 500, color: '#111827' }}>{p.items?.name || '—'}</span>
                          {p.items?.code && <LotBadge>{p.items.code}</LotBadge>}
                        </div>
                      </Td>
                      <Td><span style={{ fontWeight: 700 }}>{Number(p.quantity).toLocaleString()}</span> <span style={{ fontSize: 13, color: '#9ca3af' }}>박스</span></Td>
                      <Td style={{ color: '#6b7280' }}>{p.manager || '—'}</Td>
                      <Td><Badge label={st.label} color={st.color} bg={st.bg} /></Td>
                      <Td><AuditStamp userName={userMap[p.created_by]} at={p.created_at} /></Td>
                      <Td><AuditStamp userName={userMap[p.updated_by]} at={p.updated_at} /></Td>
                      {isSeniorManager && (
                        <Td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <IconBtn icon={Edit2} onClick={() => { setEditPlan(p); setShowPlanModal(true) }} label="수정" />
                            <IconBtn icon={Trash2} variant="danger" onClick={() => softDeletePlan(p)} label="삭제" />
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
      )}

      {showModal && (
        <ShippingModal partners={partners} items={items} stock={stock}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); fetchAll() }} />
      )}
      {showPlanModal && (
        <PlanModal plan={editPlan} partners={partners} items={items} profile={profile}
          onClose={() => { setShowPlanModal(false); setEditPlan(null) }}
          onSave={() => { setShowPlanModal(false); setEditPlan(null); fetchAll() }} />
      )}
    </div>
  )
}
