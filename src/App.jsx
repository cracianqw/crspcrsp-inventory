import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Items from './pages/Items'
import Partners from './pages/Partners'
import Receiving from './pages/Receiving'
import Production from './pages/Production'
import ProductionPlan from './pages/ProductionPlan'
import Packaging from './pages/Packaging'
import Inventory from './pages/Inventory'
import Shipping from './pages/Shipping'
import Waste from './pages/Waste'
import Users from './pages/Users'

function ProtectedLayout() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FCF4E2' }}>
        <div className="text-center">
          <div
            className="w-10 h-10 rounded-full border-4 animate-spin mx-auto mb-3"
            style={{ borderColor: '#004634', borderTopColor: 'transparent' }}
          />
          <p className="text-sm font-semibold tracking-wide" style={{ color: '#004634' }}>불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <Layout />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="items" element={<Items />} />
            <Route path="partners" element={<Partners />} />
            <Route path="receiving" element={<Receiving />} />
            <Route path="production-plan" element={<ProductionPlan />} />
            <Route path="production" element={<Production />} />
            <Route path="packaging" element={<Packaging />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="shipping" element={<Shipping />} />
            <Route path="waste" element={<Waste />} />
            <Route path="users" element={<Users />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
