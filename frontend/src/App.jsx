import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import AccessRights from './pages/AccessRights'
import AuditLog from './pages/AuditLog'
import Caisse from './pages/Caisse'
import Categories from './pages/Categories'
import Customers from './pages/Customers'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import { Forbidden, NotFound } from './pages/NotFound'
import Products from './pages/Products'
import Profile from './pages/Profile'
import Purchases from './pages/Purchases'
import Register from './pages/Register'
import Reports from './pages/Reports'
import SaleDetail from './pages/SaleDetail'
import Sales from './pages/Sales'
import Settings from './pages/Settings'
import Suppliers from './pages/Suppliers'
import Users from './pages/Users'

function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Login />} />
      <Route path="/inscription" element={<Register />} />
      <Route path="/acces-refuse" element={<Forbidden />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="caisse" element={<Caisse />} />
          <Route path="ventes" element={<Sales />} />
          <Route path="ventes/:id" element={<SaleDetail />} />
          <Route path="produits" element={<Products />} />
          <Route path="categories" element={<Categories />} />
          <Route path="approvisionnements" element={<Purchases />} />
          <Route path="clients" element={<Customers />} />
          <Route path="fournisseurs" element={<Suppliers />} />
          <Route path="rapports" element={<Reports />} />
          <Route path="profil" element={<Profile />} />

          <Route element={<ProtectedRoute adminOnly />}>
            <Route path="utilisateurs" element={<Users />} />
            <Route path="journal" element={<AuditLog />} />
            <Route path="droits-acces" element={<AccessRights />} />
            <Route path="parametres" element={<Settings />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
