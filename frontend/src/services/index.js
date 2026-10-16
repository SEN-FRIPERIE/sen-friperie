/**
 * Couche de service : seule porte d'entrée vers les données.
 * - Mode réel : appels HTTP vers l'API Django (voir api.js).
 * - Mode démonstration (VITE_DEMO_MODE=true) : données locales en mémoire,
 *   clairement étiquetées, jamais envoyées à Supabase.
 */

import { ApiError, api } from './api'
import { buildDemoAccessRights, buildDemoState } from './demoData'

export const isDemoMode = () => import.meta.env.VITE_DEMO_MODE === 'true'

let demo = null
function store() {
  if (!demo) demo = buildDemoState()
  return demo
}

function paginated(results) {
  return { count: results.length, results }
}

function qs(params = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') search.set(k, v)
  })
  const s = search.toString()
  return s ? `?${s}` : ''
}

/* =============================== AUTH =============================== */
export async function login(username, password) {
  if (isDemoMode()) {
    const s = store()
    const user = s.users.find((u) => u.username === username)
    if (!user || password !== 'demo') {
      throw Object.assign(new Error('Identifiants invalides (démo : mot de passe « demo »).'), {
        status: 401, fields: null,
      })
    }
    s.currentUserId = user.id
    return user
  }
  return api.post('/api/auth/login/', { username, password })
}

export async function logout() {
  if (isDemoMode()) {
    store().currentUserId = null
    return { detail: 'Déconnexion réussie.' }
  }
  return api.post('/api/auth/logout/')
}

export async function register(payload) {
  if (isDemoMode()) {
    const s = store()
    const email = String(payload.email ?? '').trim().toLowerCase()
    if (s.users.some((u) => (u.email ?? '').toLowerCase() === email && email !== '')) {
      throw new ApiError('Un compte existe déjà avec cette adresse e-mail.', {
        status: 400,
        fields: { email: ['Un compte existe déjà avec cette adresse e-mail.'] },
      })
    }
    const user = {
      id: s.nextId++,
      username: email,
      display_name: `${payload.first_name ?? ''} ${payload.last_name ?? ''}`.trim() || email,
      first_name: payload.first_name ?? '',
      last_name: payload.last_name ?? '',
      email,
      phone: payload.phone ?? '',
      role: 'VENDOR',
      is_active: true,
      is_admin_role: false,
    }
    s.users.push(user)
    s.currentUserId = user.id
    return user
  }
  return api.post('/api/auth/register/', payload)
}

export async function fetchMe() {
  if (isDemoMode()) {
    const s = store()
    return s.users.find((u) => u.id === s.currentUserId) ?? null
  }
  try {
    return await api.get('/api/auth/me/')
  } catch (err) {
    if (err.status === 401 || err.status === 403) return null
    throw err
  }
}

/* ============================ PRODUITS ============================== */
export function listProducts(params) {
  if (isDemoMode()) {
    const s = store()
    let results = s.products.filter((p) => !p.is_archived)
    const { search, category, size, condition, availability, ordering } = params ?? {}
    if (search) {
      const q = search.toLowerCase()
      results = results.filter(
        (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
      )
    }
    if (category) results = results.filter((p) => String(p.category) === String(category))
    if (size) results = results.filter((p) => p.size === size)
    if (condition) results = results.filter((p) => p.condition === condition)
    if (availability === 'in_stock') results = results.filter((p) => p.quantity > 0)
    if (availability === 'low') results = results.filter((p) => p.quantity > 0 && p.quantity <= p.low_stock_threshold)
    if (availability === 'out') results = results.filter((p) => p.quantity === 0)
    if (ordering) {
      const desc = ordering.startsWith('-')
      const key = desc ? ordering.slice(1) : ordering
      results = [...results].sort((a, b) => {
        const av = a[key] ?? '', bv = b[key] ?? ''
        return desc ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv))
      })
    }
    return Promise.resolve(paginated(results))
  }
  return api.get(`/api/products/${qs(params)}`)
}

export function createProduct(data) {
  if (isDemoMode()) {
    const s = store()
    const product = {
      ...data, id: s.nextId++, category_name:
        s.categories.find((c) => c.id === Number(data.category))?.name ?? null,
      is_archived: false, is_low_stock: false, is_out_of_stock: Number(data.quantity) === 0,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    s.products.unshift(product)
    return Promise.resolve(product)
  }
  return api.post('/api/products/', data)
}

export function updateProduct(id, data) {
  if (isDemoMode()) {
    const s = store()
    const i = s.products.findIndex((p) => p.id === Number(id))
    if (i >= 0) s.products[i] = { ...s.products[i], ...data }
    return Promise.resolve(s.products[i])
  }
  return api.patch(`/api/products/${id}/`, data)
}

export function archiveProduct(id) {
  if (isDemoMode()) {
    const s = store()
    const i = s.products.findIndex((p) => p.id === Number(id))
    if (i >= 0) s.products[i].is_archived = !s.products[i].is_archived
    return Promise.resolve(s.products[i])
  }
  return api.post(`/api/products/${id}/archive/`, {})
}

export function adjustStock(id, quantity, reason) {
  if (isDemoMode()) {
    const s = store()
    const p = s.products.find((x) => x.id === Number(id))
    if (p) p.quantity += Number(quantity)
    return Promise.resolve(p)
  }
  return api.post(`/api/products/${id}/adjust-stock/`, { quantity, reason })
}

/* =========================== CATÉGORIES ============================= */
export function listCategories(params) {
  if (isDemoMode()) return Promise.resolve(paginated(store().categories))
  return api.get(`/api/categories/${qs(params)}`)
}

export function createCategory(data) {
  if (isDemoMode()) {
    const s = store()
    const cat = { ...data, id: s.nextId++, product_count: 0, is_active: data.is_active ?? true }
    s.categories.push(cat)
    return Promise.resolve(cat)
  }
  return api.post('/api/categories/', data)
}

export function updateCategory(id, data) {
  if (isDemoMode()) {
    const s = store()
    const i = s.categories.findIndex((c) => c.id === Number(id))
    if (i >= 0) s.categories[i] = { ...s.categories[i], ...data }
    return Promise.resolve(s.categories[i])
  }
  return api.patch(`/api/categories/${id}/`, data)
}

export function archiveCategory(id) {
  if (isDemoMode()) {
    const s = store()
    const c = s.categories.find((x) => x.id === Number(id))
    if (c) c.is_active = !c.is_active
    return Promise.resolve(c)
  }
  return api.post(`/api/categories/${id}/archive/`, {})
}

/* ============================ CLIENTS =============================== */
export function listCustomers(params) {
  if (isDemoMode()) {
    const s = store()
    let results = s.customers
    if (params?.search) {
      const q = params.search.toLowerCase()
      results = results.filter((c) => c.display_name.toLowerCase().includes(q) || (c.phone ?? '').includes(q))
    }
    return Promise.resolve(paginated(results))
  }
  return api.get(`/api/customers/${qs(params)}`)
}

export function createCustomer(data) {
  if (isDemoMode()) {
    const s = store()
    const c = {
      ...data, id: s.nextId++,
      display_name: `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim(),
      total_purchases: '0', purchase_count: 0, created_at: new Date().toISOString(),
    }
    s.customers.unshift(c)
    return Promise.resolve(c)
  }
  return api.post('/api/customers/', data)
}

export function updateCustomer(id, data) {
  if (isDemoMode()) {
    const s = store()
    const i = s.customers.findIndex((c) => c.id === Number(id))
    if (i >= 0) {
      s.customers[i] = {
        ...s.customers[i], ...data,
        display_name: `${data.first_name ?? s.customers[i].first_name} ${data.last_name ?? s.customers[i].last_name}`.trim(),
      }
    }
    return Promise.resolve(s.customers[i])
  }
  return api.patch(`/api/customers/${id}/`, data)
}

export function customerSales(id) {
  if (isDemoMode()) {
    const s = store()
    return Promise.resolve(paginated(s.sales.filter((x) => x.customer === Number(id))))
  }
  return api.get(`/api/customers/${id}/sales/`)
}

/* ========================== FOURNISSEURS ============================ */
export function listSuppliers(params) {
  if (isDemoMode()) return Promise.resolve(paginated(store().suppliers))
  return api.get(`/api/suppliers/${qs(params)}`)
}

export function createSupplier(data) {
  if (isDemoMode()) {
    const s = store()
    const sup = { ...data, id: s.nextId++, created_at: new Date().toISOString() }
    s.suppliers.unshift(sup)
    return Promise.resolve(sup)
  }
  return api.post('/api/suppliers/', data)
}

export function updateSupplier(id, data) {
  if (isDemoMode()) {
    const s = store()
    const i = s.suppliers.findIndex((x) => x.id === Number(id))
    if (i >= 0) s.suppliers[i] = { ...s.suppliers[i], ...data }
    return Promise.resolve(s.suppliers[i])
  }
  return api.patch(`/api/suppliers/${id}/`, data)
}

/* ======================== APPROVISIONNEMENTS ======================== */
export function listPurchases(params) {
  if (isDemoMode()) return Promise.resolve(paginated(store().purchases))
  return api.get(`/api/purchases/${qs(params)}`)
}

export function createPurchase(data) {
  if (isDemoMode()) {
    const s = store()
    const items = data.items.map((line) => {
      const product = s.products.find((p) => p.id === Number(line.product_id))
      if (product) product.quantity += Number(line.quantity)
      return {
        id: s.nextId++, product: Number(line.product_id),
        product_name: product?.name ?? '', product_sku: product?.sku ?? '',
        quantity: Number(line.quantity), unit_cost: String(line.unit_cost),
        line_total: String(Number(line.unit_cost) * Number(line.quantity)),
      }
    })
    const purchase = {
      id: s.nextId++, reference: `FA-${String(s.nextId).padStart(6, '0')}`,
      supplier: data.supplier ?? null,
      supplier_name: s.suppliers.find((x) => x.id === Number(data.supplier))?.name ?? null,
      date: data.date ?? new Date().toISOString().slice(0, 10),
      notes: data.notes ?? '',
      total_cost: String(items.reduce((sum, l) => sum + Number(l.line_total), 0)),
      created_by: s.currentUserId, created_by_name: 'Démo',
      created_at: new Date().toISOString(), items,
    }
    s.purchases.unshift(purchase)
    return Promise.resolve(purchase)
  }
  return api.post('/api/purchases/', data)
}

/* ============================== VENTES ============================== */
export function listSales(params) {
  if (isDemoMode()) {
    const s = store()
    let results = [...s.sales]
    if (params?.date_from) results = results.filter((x) => x.created_at.slice(0, 10) >= params.date_from)
    if (params?.date_to) results = results.filter((x) => x.created_at.slice(0, 10) <= params.date_to)
    if (params?.payment_method) results = results.filter((x) => x.payment_method === params.payment_method)
    if (params?.status) results = results.filter((x) => x.status === params.status)
    if (params?.seller) results = results.filter((x) => String(x.seller) === String(params.seller))
    return Promise.resolve(paginated(results))
  }
  return api.get(`/api/sales/${qs(params)}`)
}

export function getSale(id) {
  if (isDemoMode()) {
    const s = store()
    return Promise.resolve(s.sales.find((x) => x.id === Number(id)))
  }
  return api.get(`/api/sales/${id}/`)
}

export function saleReceipt(id) {
  if (isDemoMode()) {
    const s = store()
    const sale = s.sales.find((x) => x.id === Number(id))
    return Promise.resolve({ ...sale, shop: s.shopSettings })
  }
  return api.get(`/api/sales/${id}/receipt/`)
}

export function createSale(payload) {
  if (isDemoMode()) {
    const s = store()
    const lines = payload.items.map((line) => {
      const product = s.products.find((p) => p.id === Number(line.product_id))
      if (!product) throw new Error(`Produit ${line.product_id} introuvable.`)
      if (product.quantity < line.quantity) {
        throw new Error(`Stock insuffisant pour « ${product.name} ».`)
      }
      product.quantity -= line.quantity
      return {
        id: s.nextId++, product: product.id, product_reference: product.sku,
        product_name: product.name, product_sku: product.sku,
        quantity: line.quantity, unit_price: product.sale_price,
        unit_cost: product.purchase_price,
        line_total: String(Number(product.sale_price) * line.quantity),
      }
    })
    const subtotal = lines.reduce((sum, l) => sum + Number(l.line_total), 0)
    const cost = lines.reduce((sum, l) => sum + Number(l.unit_cost) * l.quantity, 0)
    const discount = Number(payload.discount ?? 0)
    const customer = payload.customer ? s.customers.find((c) => c.id === Number(payload.customer)) : null
    const seller = s.users.find((u) => u.id === s.currentUserId)
    const sale = {
      id: s.nextId++, number: `V-${String(s.nextId).padStart(6, '0')}`,
      customer: customer?.id ?? null, customer_name: customer?.display_name ?? null,
      seller: seller?.id ?? null, seller_name: seller?.display_name ?? 'Démo',
      payment_method: payload.payment_method, payment_method_display: payload.payment_method,
      discount: String(discount), total_amount: String(subtotal - discount),
      cost_amount: String(cost), gross_profit: String(subtotal - discount - cost),
      status: 'COMPLETED', status_display: 'Validée', cancellation_reason: '', cancelled_at: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), items: lines,
    }
    s.sales.unshift(sale)
    return Promise.resolve(sale)
  }
  return api.post('/api/sales/', payload)
}

export function cancelSale(id, reason) {
  if (isDemoMode()) {
    const s = store()
    const sale = s.sales.find((x) => x.id === Number(id))
    if (!sale || sale.status === 'CANCELLED') throw new Error('Vente déjà annulée.')
    sale.items.forEach((l) => {
      const p = s.products.find((x) => x.id === l.product)
      if (p) p.quantity += l.quantity
    })
    sale.status = 'CANCELLED'
    sale.status_display = 'Annulée'
    sale.cancellation_reason = reason ?? ''
    sale.cancelled_at = new Date().toISOString()
    return Promise.resolve(sale)
  }
  return api.post(`/api/sales/${id}/cancel/`, { reason })
}

/* ========================= TABLEAU DE BORD ========================== */
export function fetchDashboard(params) {
  if (isDemoMode()) {
    const s = store()
    const period = params?.period ?? '30d'
    const cutoffDays = { today: 0, '7d': 7, '30d': 30 }[period] ?? 30
    const cutoff = new Date(Date.now() - cutoffDays * 86400000)
    const completed = s.sales.filter((x) => x.status === 'COMPLETED')
    const inPeriod = cutoffDays === 0
      ? completed.filter((x) => x.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10))
      : completed.filter((x) => new Date(x.created_at) >= cutoff)
    const revenue = inPeriod.reduce((sum, x) => sum + Number(x.total_amount), 0)
    const cogs = inPeriod.reduce((sum, x) => sum + Number(x.cost_amount), 0)
    const qtyByProduct = {}
    inPeriod.forEach((sale) => sale.items.forEach((l) => {
      const key = l.product
      qtyByProduct[key] = qtyByProduct[key] ?? { product_id: key, name: l.product_name, quantity_sold: 0, revenue: 0 }
      qtyByProduct[key].quantity_sold += l.quantity
      qtyByProduct[key].revenue += Number(l.line_total)
    }))
    const active = s.products.filter((p) => !p.is_archived)
    return Promise.resolve({
      period: { label: { today: "Aujourd'hui", '7d': '7 derniers jours', '30d': '30 derniers jours' }[period] ?? '30 derniers jours', date_from: null, date_to: null },
      revenue: String(revenue), sales_count: inPeriod.length,
      cost_of_goods_sold: String(cogs), gross_profit: String(revenue - cogs),
      currency: 'FCFA',
      products_in_stock: active.filter((p) => p.quantity > 0).length,
      low_stock_count: active.filter((p) => p.quantity > 0 && p.quantity <= p.low_stock_threshold).length,
      out_of_stock_count: active.filter((p) => p.quantity === 0).length,
      stock_value_at_cost: String(active.reduce((sum, p) => sum + Number(p.purchase_price) * p.quantity, 0)),
      sales_over_time: [],
      top_products: Object.values(qtyByProduct).sort((a, b) => b.quantity_sold - a.quantity_sold).slice(0, 5),
      recent_sales: completed.slice(0, 5),
      low_stock_alerts: active.filter((p) => p.quantity <= p.low_stock_threshold)
        .map((p) => ({ id: p.id, sku: p.sku, name: p.name, quantity: p.quantity, low_stock_threshold: p.low_stock_threshold })),
    })
  }
  return api.get(`/api/dashboard/${qs(params)}`)
}

/* ============================= RAPPORTS ============================= */
export function fetchReports(params) {
  if (isDemoMode()) {
    const s = store()
    const completed = s.sales.filter((x) => x.status === 'COMPLETED')
    const revenue = completed.reduce((sum, x) => sum + Number(x.total_amount), 0)
    const cogs = completed.reduce((sum, x) => sum + Number(x.cost_amount), 0)
    const byPay = {}
    completed.forEach((x) => {
      byPay[x.payment_method] = byPay[x.payment_method] ?? { payment_method: x.payment_method, label: x.payment_method_display, revenue: 0, count: 0 }
      byPay[x.payment_method].revenue += Number(x.total_amount)
      byPay[x.payment_method].count += 1
    })
    return Promise.resolve({
      period: { label: 'Tout le démonstrateur', date_from: null, date_to: null },
      group: 'day', sales_by_period: [], payment_breakdown: Object.values(byPay),
      top_products: [], stock_value_at_cost: String(
        s.products.reduce((sum, p) => sum + Number(p.purchase_price) * p.quantity, 0),
      ),
      totals: { revenue: String(revenue), cost_of_goods_sold: String(cogs), gross_profit: String(revenue - cogs), sales_count: completed.length },
      currency: 'FCFA',
    })
  }
  return api.get(`/api/reports/${qs(params)}`)
}

export function reportsCsvUrl(params) {
  const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')
  return `${base}/api/reports/sales/export/${qs(params)}`
}

/* ========================= UTILISATEURS / ADMIN ===================== */
export function listUsers(params) {
  if (isDemoMode()) return Promise.resolve(paginated(store().users))
  return api.get(`/api/users/${qs(params)}`)
}

export function createUser(data) {
  if (isDemoMode()) {
    const s = store()
    const user = {
      ...data, id: s.nextId++,
      display_name: `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim() || data.username,
      is_admin_role: data.role === 'ADMIN', is_active: true,
    }
    s.users.push(user)
    return Promise.resolve(user)
  }
  return api.post('/api/users/', data)
}

export function updateUser(id, data) {
  if (isDemoMode()) {
    const s = store()
    const i = s.users.findIndex((u) => u.id === Number(id))
    if (i >= 0) s.users[i] = { ...s.users[i], ...data, is_admin_role: data.role === 'ADMIN' }
    return Promise.resolve(s.users[i])
  }
  return api.patch(`/api/users/${id}/`, data)
}

export function deactivateUser(id) {
  if (isDemoMode()) {
    const s = store()
    const u = s.users.find((x) => x.id === Number(id))
    if (u) u.is_active = !u.is_active
    return Promise.resolve(u)
  }
  return api.delete(`/api/users/${id}/`)
}

export function listAuditLogs(params) {
  if (isDemoMode()) return Promise.resolve(paginated(store().auditLogs))
  return api.get(`/api/audit-logs/${qs(params)}`)
}

/* ============================ PARAMÈTRES ============================ */
export function fetchShopSettings() {
  if (isDemoMode()) return Promise.resolve(store().shopSettings)
  return api.get('/api/settings/shop/')
}

export function updateShopSettings(data) {
  if (isDemoMode()) {
    const s = store()
    s.shopSettings = { ...s.shopSettings, ...data }
    return Promise.resolve(s.shopSettings)
  }
  return api.patch('/api/settings/shop/', data)
}

/* ========================== DROITS D'ACCÈS ========================== */
export function fetchAccessRights() {
  if (isDemoMode()) return Promise.resolve(buildDemoAccessRights())
  return api.get('/api/access-rights/')
}
