/**
 * Mode démonstration : données fictives locales.
 * Activé uniquement via VITE_DEMO_MODE=true. Aucune donnée n'est envoyée
 * à Supabase ; les créations/ventes restent en mémoire dans l'onglet.
 */

const now = Date.now()
const day = 86400000

export function buildDemoState() {
  const categories = [
    { id: 1, name: 'Hauts', description: 'T-shirts, chemises, pulls', is_active: true, product_count: 3 },
    { id: 2, name: 'Bas', description: 'Jeans, pantalons, jupes', is_active: true, product_count: 2 },
    { id: 3, name: 'Vestes', description: 'Blousons, manteaux', is_active: true, product_count: 1 },
    { id: 4, name: 'Robes', description: 'Robes et ensembles', is_active: true, product_count: 1 },
    { id: 5, name: 'Accessoires', description: 'Sacs, ceintures', is_active: false, product_count: 0 },
  ]

  const products = [
    { id: 1, sku: 'HA-TSH-001', name: 'T-shirt coton bandana', category: 1, category_name: 'Hauts', size: 'M', color: 'Bleu', condition: 'GOOD', purchase_price: '3000', sale_price: '8000', quantity: 6, low_stock_threshold: 2, image_url: '', is_archived: false, description: '' },
    { id: 2, sku: 'HA-CHM-002', name: 'Chemise hawaïenne vintage', category: 1, category_name: 'Hauts', size: 'L', color: 'Floral', condition: 'VERY_GOOD', purchase_price: '5000', sale_price: '12000', quantity: 2, low_stock_threshold: 1, image_url: '', is_archived: false, description: '' },
    { id: 3, sku: 'HA-PUL-003', name: 'Pull maille écru', category: 1, category_name: 'Hauts', size: 'M', color: 'Écru', condition: 'GOOD', purchase_price: '4000', sale_price: '10000', quantity: 4, low_stock_threshold: 1, image_url: '', is_archived: false, description: '' },
    { id: 4, sku: 'BA-JEA-004', name: "Jean brut Levi's 501", category: 2, category_name: 'Bas', size: 'M', color: 'Indigo', condition: 'GOOD', purchase_price: '4000', sale_price: '15000', quantity: 3, low_stock_threshold: 1, image_url: '', is_archived: false, description: '' },
    { id: 5, sku: 'BA-CAR-005', name: 'Pantalon cargo beige', category: 2, category_name: 'Bas', size: 'L', color: 'Beige', condition: 'NEW', purchase_price: '6000', sale_price: '18000', quantity: 0, low_stock_threshold: 1, image_url: '', is_archived: false, description: '' },
    { id: 6, sku: 'VE-CUI-006', name: 'Blouson en cuir', category: 3, category_name: 'Vestes', size: 'XL', color: 'Noir', condition: 'VERY_GOOD', purchase_price: '10000', sale_price: '35000', quantity: 1, low_stock_threshold: 1, image_url: '', is_archived: false, description: '' },
    { id: 7, sku: 'RO-WAX-007', name: 'Robe wax colorée', category: 4, category_name: 'Robes', size: 'S', color: 'Multicolore', condition: 'GOOD', purchase_price: '4500', sale_price: '14000', quantity: 2, low_stock_threshold: 1, image_url: '', is_archived: false, description: '' },
  ]

  const customers = [
    { id: 1, first_name: 'Moussa', last_name: 'Diop', display_name: 'Moussa Diop', phone: '77 000 00 01', email: '', address: '', notes: '', total_purchases: '43000', purchase_count: 3, created_at: new Date(now - 30 * day).toISOString() },
    { id: 2, first_name: 'Aissatou', last_name: 'Fall', display_name: 'Aissatou Fall', phone: '78 000 00 02', email: 'aissatou@example.sn', address: 'Sacré-Cœur 3', notes: 'Préfère les robes.', total_purchases: '14000', purchase_count: 1, created_at: new Date(now - 12 * day).toISOString() },
    { id: 3, first_name: '', last_name: 'Kane', display_name: 'Kane', phone: '76 000 00 03', email: '', address: '', notes: '', total_purchases: '0', purchase_count: 0, created_at: new Date(now - 3 * day).toISOString() },
  ]

  const suppliers = [
    { id: 1, name: 'Fournisseur Sandaga', phone: '76 111 22 33', email: '', address: 'Marché Sandaga', notes: 'Lots de 20 pièces.', created_at: new Date(now - 60 * day).toISOString() },
    { id: 2, name: 'Import Douala', phone: '69 444 55 66', email: 'contact@douala-import.cm', address: '', notes: '', created_at: new Date(now - 20 * day).toISOString() },
  ]

  const admin = { id: 1, username: 'admin', display_name: 'Admin SEN', first_name: 'Admin', last_name: 'SEN', email: '', phone: '', role: 'ADMIN', is_active: true, is_admin_role: true }
  const vendor = { id: 2, username: 'vendeur', display_name: 'Fatou Sow', first_name: 'Fatou', last_name: 'Sow', email: '', phone: '', role: 'VENDOR', is_active: true, is_admin_role: false }

  const sale = (id, hoursAgo, items, customer, payment, seller) => {
    const createdAt = new Date(now - hoursAgo * 3600000).toISOString()
    const lines = items.map(([product, qty]) => ({
      id: id * 10 + qty,
      product: product.id,
      product_reference: product.sku,
      product_name: product.name,
      product_sku: product.sku,
      quantity: qty,
      unit_price: product.sale_price,
      unit_cost: product.purchase_price,
      line_total: String(Number(product.sale_price) * qty),
    }))
    const total = lines.reduce((s, l) => s + Number(l.line_total), 0)
    const cost = lines.reduce((s, l) => s + Number(l.unit_cost) * l.quantity, 0)
    return {
      id,
      number: `V-${String(id).padStart(6, '0')}`,
      customer: customer?.id ?? null,
      customer_name: customer?.display_name ?? null,
      seller: seller.id,
      seller_name: seller.display_name,
      payment_method: payment,
      payment_method_display: { CASH: 'Espèces', WAVE: 'Wave', ORANGE_MONEY: 'Orange Money' }[payment],
      discount: '0',
      total_amount: String(total),
      cost_amount: String(cost),
      gross_profit: String(total - cost),
      status: 'COMPLETED',
      status_display: 'Validée',
      cancellation_reason: '',
      cancelled_at: null,
      created_at: createdAt,
      updated_at: createdAt,
      items: lines,
    }
  }

  const sales = [
    sale(1, 2, [[products[0], 1], [products[3], 1]], customers[0], 'CASH', vendor),
    sale(2, 6, [[products[6], 1]], customers[1], 'WAVE', vendor),
    sale(3, 26, [[products[1], 1]], customers[0], 'ORANGE_MONEY', vendor),
    sale(4, 50, [[products[2], 1], [products[5], 1]], customers[0], 'CASH', admin),
    sale(5, 74, [[products[3], 1]], null, 'WAVE', vendor),
    sale(6, 98, [[products[0], 2]], customers[1], 'CASH', vendor),
  ]

  const purchases = [
    {
      id: 1, reference: 'FA-000001', supplier: 1, supplier_name: 'Fournisseur Sandaga',
      date: new Date(now - 8 * day).toISOString().slice(0, 10), notes: 'Lot de démo',
      total_cost: '45000', created_by: 1, created_by_name: 'Admin SEN',
      created_at: new Date(now - 8 * day).toISOString(),
      items: [{ id: 1, product: 1, product_name: products[0].name, product_sku: products[0].sku, quantity: 10, unit_cost: '4500', line_total: '45000' }],
    },
  ]

  const auditLogs = [
    { id: 1, user: 2, user_display: 'Fatou Sow', action: 'SALE', action_display: 'Vente', object_type: 'Sale', object_id: '1', summary: 'Vente V-000001 — 23000', created_at: new Date(now - 2 * 3600000).toISOString() },
    { id: 2, user: 1, user_display: 'Admin SEN', action: 'CREATE', action_display: 'Création', object_type: 'Product', object_id: '7', summary: 'Création du produit RO-WAX-007', created_at: new Date(now - 20 * 3600000).toISOString() },
    { id: 3, user: 1, user_display: 'Admin SEN', action: 'LOGIN', action_display: 'Connexion', object_type: 'User', object_id: '1', summary: 'Connexion de admin', created_at: new Date(now - 22 * 3600000).toISOString() },
  ]

  const shopSettings = {
    id: 1,
    shop_name: 'SEN-Friperie (démo)',
    phone: '77 000 00 00',
    email: 'contact@sen-friperie.sn',
    address: 'Dakar, Sénégal',
    currency: 'FCFA',
    default_low_stock_threshold: 1,
    receipt_header: 'SEN-Friperie — Vêtements de seconde main',
    receipt_footer: 'Merci de votre visite ! Échange sous 7 jours avec reçu.',
    payment_methods: ['CASH', 'WAVE', 'ORANGE_MONEY', 'MOOV_MONEY'],
  }

  return {
    nextId: 100,
    categories, products, customers, suppliers, sales, purchases,
    users: [admin, vendor], auditLogs, shopSettings,
    currentUserId: 1,
  }
}

/**
 * Matrice des droits par rôle (mode démonstration).
 * Doit rester alignée avec backend/core/access_rights.py.
 */
export function buildDemoAccessRights() {
  const full = 'full'
  const read = 'read'
  const none = 'none'
  const mod = (key, label, description, admin, vendor) => ({
    key, label, description, access: { ADMIN: admin, VENDOR: vendor },
  })

  return {
    roles: [
      { key: 'ADMIN', label: 'Administrateur' },
      { key: 'VENDOR', label: 'Vendeur' },
    ],
    levels: [
      { key: 'full', label: 'Accès complet', description: 'Peut consulter et modifier (créer, modifier, supprimer ou annuler).' },
      { key: 'read', label: 'Lecture seule', description: 'Peut consulter, mais pas modifier.' },
      { key: 'none', label: 'Aucun accès', description: "Ne voit ni n'utilise cette section." },
    ],
    sections: [
      {
        name: 'Boutique',
        modules: [
          mod('dashboard', 'Tableau de bord', 'Indicateurs de ventes, de stock et de performances.', full, full),
          mod('sales', 'Caisse et ventes', 'Enregistrer, consulter et annuler des ventes ; imprimer les reçus.', full, full),
          mod('purchases', 'Approvisionnements', 'Réception de marchandises et entrées de stock.', full, full),
          mod('stock_movements', 'Mouvements de stock', 'Historique des entrées, sorties et ajustements.', full, full),
        ],
      },
      {
        name: 'Catalogue',
        modules: [
          mod('products', 'Produits', 'Fiches produit, prix, stock, archivage et ajustements.', full, read),
          mod('categories', 'Catégories', 'Classement des produits et archivage.', full, read),
        ],
      },
      {
        name: 'Tiers',
        modules: [
          mod('customers', 'Clients', "Coordonnées et historique d'achat.", full, read),
          mod('suppliers', 'Fournisseurs', 'Coordonnées et achats associés.', full, read),
        ],
      },
      {
        name: 'Pilotage',
        modules: [
          mod('reports', 'Rapports', 'Statistiques de ventes et export CSV.', full, full),
          mod('users', 'Utilisateurs', 'Comptes, rôles et activation des vendeurs.', full, none),
          mod('audit', "Journal d'activité", 'Traçabilité des actions de tous les comptes.', full, none),
          mod('settings', 'Paramètres boutique', 'Informations de la boutique et valeur de la monnaie.', full, read),
        ],
      },
    ],
  }
}
