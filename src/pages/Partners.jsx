import { Building2 } from 'lucide-react'
import { Card, CardHeader, RegisterBtn, EmptyState } from '../components/UI'

export default function Partners() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827' }}>거래처 관리</h1>
        <RegisterBtn onClick={() => {}}>거래처 추가</RegisterBtn>
      </div>

      <Card>
        <CardHeader title="거래처 목록" />
        <EmptyState icon={Building2} text="준비 중입니다" sub="거래처 관리 기능이 곧 추가됩니다" />
      </Card>
    </div>
  )
}
