import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Cloud, Wind, Droplets, Thermometer, AlertTriangle, CheckCircle2, Package, Calendar, Target } from 'lucide-react'
import { PageHeader, StatCard, Card, CardHeader, EmptyState, Spinner, LotBadge, Badge } from '../components/UI'

const WMO = {
  0: { label: '맑음', emoji: '☀️' }, 1: { label: '대체로 맑음', emoji: '🌤️' },
  2: { label: '구름 많음', emoji: '⛅' }, 3: { label: '흐림', emoji: '☁️' },
  45: { label: '안개', emoji: '🌫️' }, 48: { label: '짙은 안개', emoji: '🌫️' },
  51: { label: '가랑비', emoji: '🌦️' }, 61: { label: '비', emoji: '🌧️' }, 65: { label: '폭우', emoji: '🌧️' },
  71: { label: '눈', emoji: '❄️' }, 80: { label: '소나기', emoji: '🌦️' }, 82: { label: '강한 소나기', emoji: '⛈️' },
  95: { label: '천둥번개', emoji: '⛈️' },
}

// ── 기상 경보 인디케이터 ────────────────────────────────────
const ALERT = {
  0: { label: '양호', color: '#059669', bg: '#d1fae5' },
  1: { label: '관심', color: '#d97706', bg: '#fef3c7' },
  2: { label: '주의', color: '#ea580c', bg: '#ffedd5' },
  3: { label: '경고', color: '#dc2626', bg: '#fee2e2' },
}
function windLevel(v) {
  if (v >= 60) return { level: 3, msg: '시설 파손 주의' }
  if (v >= 40) return { level: 2, msg: '시설 주의' }
  if (v >= 20) return { level: 1, msg: '바람 주의' }
  return { level: 0, msg: null }
}
function humidityLevel(v) {
  if (v >= 70) return { level: 3, msg: '완성품 체크 필수' }
  if (v >= 60) return { level: 2, msg: '내부 습도 모니터링 필수' }
  if (v >= 50) return { level: 1, msg: '습도 주의' }
  return { level: 0, msg: null }
}
function tempLevel(v) {
  if (v >= 33) return { level: 3, msg: '작업자 건강 확인 필수' }
  if (v >= 27) return { level: 2, msg: '작업장 온도 모니터링 필수' }
  if (v >= 23) return { level: 1, msg: '작업장 고온 주의' }
  return { level: 0, msg: null }
}
function MetricPill({ icon: Icon, value, level }) {
  const c = ALERT[level.level]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 12, fontWeight: 600, padding: '4px 8px',
      borderRadius: 6, background: c.bg, color: c.color,
      whiteSpace: 'nowrap',
    }}>
      <Icon size={11} />{value}
    </span>
  )
}

function getWeek() {
  const now = new Date(), day = now.getDay()
  const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1)); mon.setHours(0,0,0,0)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const fmt = d => `${d.getMonth()+1}/${d.getDate()}`
  return { start: mon.toISOString().split('T')[0], end: sun.toISOString().split('T')[0], label: `${fmt(mon)} ~ ${fmt(sun)}` }
}

export default function Dashboard() {
  const [weather, setWeather] = useState(null)
  const [wLoading, setWLoading] = useState(true)
  const [plans, setPlans] = useState([])
  const [actuals, setActuals] = useState([])
  const [inventory, setInventory] = useState([])
  const week = getWeek()
  const today = new Date().toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric', weekday:'long' })

  useEffect(() => {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=36.13&longitude=129.37&current=temperature_2m,weathercode,windspeed_10m,relativehumidity_2m&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FSeoul&forecast_days=1')
      .then(r => r.json())
      .then(d => setWeather({ temp: Math.round(d.current.temperature_2m), code: d.current.weathercode, wind: Math.round(d.current.windspeed_10m), humidity: d.current.relativehumidity_2m, max: Math.round(d.daily.temperature_2m_max[0]), min: Math.round(d.daily.temperature_2m_min[0]) }))
      .catch(() => {}).finally(() => setWLoading(false))
    supabase.from('weekly_plans').select('*, items(name, code)').gte('week_start', week.start).lte('week_start', week.end).then(({ data }) => setPlans(data || []))
    supabase.from('production_records').select('item_id, output_qty').gte('production_date', week.start).lte('production_date', week.end).then(({ data }) => setActuals(data || []))
    supabase.from('inventory_summary').select('*').order('item_name').then(({ data }) => setInventory(data || []))
  }, [])

  const wmo = weather ? (WMO[weather.code] ?? { label: '알 수 없음', emoji: '🌡️' }) : null
  const windLv = weather ? windLevel(weather.wind) : { level: 0 }
  const humLv  = weather ? humidityLevel(weather.humidity) : { level: 0 }
  const tempLv = weather ? tempLevel(weather.temp) : { level: 0 }
  const compLv = Math.max(windLv.level, humLv.level, tempLv.level)
  const planTotal = plans.reduce((s, p) => s + (Number(p.planned_qty) || 0), 0)
  const actualTotal = actuals.reduce((s, r) => s + (Number(r.output_qty) || 0), 0)
  const achievement = planTotal > 0 ? Math.round((actualTotal / planTotal) * 100) : null
  const achColor = achievement == null ? '#9ca3af' : achievement >= 100 ? '#059669' : achievement >= 80 ? '#d97706' : '#dc2626'
  const achBg    = achievement == null ? '#f3f4f6' : achievement >= 100 ? '#d1fae5' : achievement >= 80 ? '#fef3c7' : '#fee2e2'
  const achLabel = achievement == null ? '계획 없음' : achievement >= 100 ? '달성' : achievement >= 80 ? '근접' : '미달'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <PageHeader title="대시보드" sub={today} />

      {/* 상단 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>

        {/* 날씨 + 기상 경보 */}
        <Card>
          <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#6b7280' }}>포항 청하 날씨</span>
              <Cloud size={18} color="#d1d5db" />
            </div>
            {wLoading ? (
              <div style={{ height: 80, display: 'flex', alignItems: 'center' }}><Spinner /></div>
            ) : weather ? (
              <>
                {/* 메인: 날씨 아이콘 + 온도 + 종합 경보 배지 (큰 크기) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 44, lineHeight: 1 }}>{wmo.emoji}</span>
                  <div>
                    <p style={{ fontSize: 40, fontWeight: 700, color: '#111827', lineHeight: 1 }}>{weather.temp}°</p>
                    <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>{wmo.label}</p>
                  </div>
                  {/* 종합 경보 배지 — 날씨 아이콘 수준 크기 */}
                  <div style={{
                    marginLeft: 'auto', display: 'inline-flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 2, minHeight: 52, padding: '6px 18px',
                    borderRadius: 12,
                    background: ALERT[compLv].bg,
                    color: ALERT[compLv].color,
                    border: `1.5px solid ${ALERT[compLv].color}50`,
                    whiteSpace: 'nowrap',
                  }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                      opacity: 0.85,
                    }}>
                      주의 수준
                    </span>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      fontSize: 18, fontWeight: 800, letterSpacing: '0.05em',
                      lineHeight: 1,
                    }}>
                      <span style={{
                        width: 12, height: 12, borderRadius: '50%',
                        background: ALERT[compLv].color,
                      }} />
                      {ALERT[compLv].label}
                    </div>
                  </div>
                </div>

                {/* 항목별 메트릭 + 경고 문구 */}
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 8,
                  paddingTop: 14, borderTop: '1px solid #f3f4f6',
                }}>
                  {[
                    { lv: windLv, Icon: Wind,        value: `${weather.wind} km/h` },
                    { lv: humLv,  Icon: Droplets,    value: `${weather.humidity} %` },
                    { lv: tempLv, Icon: Thermometer, value: `${weather.temp} °C` },
                  ].map((m, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <MetricPill icon={m.Icon} value={m.value} level={m.lv} />
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 12, fontWeight: 600,
                        color: ALERT[m.lv.level].color,
                      }}>
                        {m.lv.msg ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                        {m.lv.msg || '양호'}
                      </span>
                    </div>
                  ))}
                  <span style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                    ↑{weather.max}° ↓{weather.min}°
                  </span>
                </div>

                {/* 단계 범례 */}
                <div style={{
                  display: 'flex', gap: 14, flexWrap: 'wrap',
                  marginTop: 12, paddingTop: 10,
                  borderTop: '1px dashed #e5e7eb',
                }}>
                  {[0, 1, 2, 3].map(lv => (
                    <span key={lv} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 11, fontWeight: 600, color: '#6b7280',
                    }}>
                      <span style={{
                        width: 9, height: 9, borderRadius: '50%',
                        background: ALERT[lv].color,
                      }} />
                      {ALERT[lv].label}
                    </span>
                  ))}
                </div>
              </>
            ) : <p style={{ fontSize: 14, color: '#9ca3af' }}>날씨 정보를 불러올 수 없습니다</p>}
          </div>
        </Card>

        {/* 주간 계획 */}
        <Card>
          <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#6b7280' }}>주간 생산계획</span>
              <Calendar size={18} color="#d1d5db" />
            </div>
            <p style={{ fontSize: 40, fontWeight: 700, color: '#111827', lineHeight: 1, marginBottom: 8 }}>
              {planTotal.toLocaleString()}
            </p>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 14 }}>총 계획 수량 (박스)</p>
            <div style={{ paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
              <Badge label={week.label} color="#6b7280" bg="#f3f4f6" />
            </div>
          </div>
        </Card>

        {/* 이번 주 달성률 */}
        <Card>
          <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#6b7280' }}>이번 주 달성률</span>
              <Target size={18} color="#d1d5db" />
            </div>
            <p style={{ fontSize: 40, fontWeight: 700, color: achColor, lineHeight: 1, marginBottom: 8 }}>
              {achievement != null ? achievement : '—'}
              {achievement != null && <span style={{ fontSize: 16, fontWeight: 400, color: '#9ca3af', marginLeft: 6 }}>%</span>}
            </p>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 14 }}>
              실적 {actualTotal.toLocaleString()} / 계획 {planTotal.toLocaleString()}
            </p>
            <div style={{ paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
              <Badge label={achLabel} color={achColor} bg={achBg} />
            </div>
          </div>
        </Card>

        {/* 재고 */}
        <Card>
          <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#6b7280' }}>재고 현황</span>
              <Package size={18} color="#d1d5db" />
            </div>
            <p style={{ fontSize: 40, fontWeight: 700, color: '#111827', lineHeight: 1, marginBottom: 8 }}>{inventory.length}</p>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 14 }}>보유 품목 종류</p>
            <p style={{ fontSize: 13, color: '#9ca3af', paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
              총 {inventory.reduce((s, i) => s + (Number(i.total_qty) || 0), 0).toLocaleString()} 박스
            </p>
          </div>
        </Card>
      </div>

      {/* 주간 생산계획 상세 */}
      <Card>
        <CardHeader title="주간 생산 계획 상세"
          action={<Badge label={week.label} color="#6b7280" bg="#f3f4f6" />} />
        {plans.length === 0 ? (
          <EmptyState icon={Calendar} text="이번 주 생산 계획이 없습니다" />
        ) : (
          <div className="tbl-wrap"><table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['품목명', '코드', '계획 수량'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: h === '계획 수량' ? 'right' : 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', backgroundColor: '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plans.map((plan, i) => (
                <tr key={plan.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: 16, fontSize: 15, fontWeight: 500, color: '#111827', borderBottom: '1px solid #f9fafb' }}>{plan.items?.name || '품목 미지정'}</td>
                  <td style={{ padding: 16, borderBottom: '1px solid #f9fafb' }}><LotBadge>{plan.items?.code}</LotBadge></td>
                  <td style={{ padding: 16, fontSize: 15, fontWeight: 700, color: '#111827', textAlign: 'right', borderBottom: '1px solid #f9fafb' }}>
                    {plan.planned_qty?.toLocaleString()} <span style={{ fontSize: 13, fontWeight: 400, color: '#9ca3af' }}>박스</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Card>

      {/* 재고 현황 카드 그리드 */}
      {inventory.length > 0 && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 16 }}>재고 현황</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {inventory.map(item => {
              const diff = item.nearest_expiry ? Math.ceil((new Date(item.nearest_expiry) - new Date()) / 86400000) : null
              const urgent = diff !== null && diff <= 7
              return (
                <Card key={item.item_id}>
                  <div style={{ padding: 20 }}>
                    <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.item_name}</p>
                    <p style={{ fontSize: 28, fontWeight: 700, color: '#111827', lineHeight: 1 }}>
                      {Number(item.total_qty || 0).toLocaleString()}
                      <span style={{ fontSize: 13, fontWeight: 400, color: '#9ca3af', marginLeft: 4 }}>박스</span>
                    </p>
                    {item.nearest_expiry && (
                      <p style={{ fontSize: 12, marginTop: 10, fontWeight: 500, color: urgent ? '#d97706' : '#9ca3af' }}>
                        {new Date(item.nearest_expiry).toLocaleDateString('ko-KR', { month:'short', day:'numeric' })}까지
                        {urgent && ` (D-${diff})`}
                      </p>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
