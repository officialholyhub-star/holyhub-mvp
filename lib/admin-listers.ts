type Application = { id: string; user_id: string; business_name: string; contact_name: string | null; email: string; category_type: string; description: string; website_or_social: string; status: string };
type Shop = { user_id: string; business_name: string; category_type: string };

// Existing listers may predate applications (including role-enabled test accounts).
// Identity is always user_id, never a business name, which need not be unique.
export function adminListerDirectory(applications: Application[], shops: Shop[], listerRoles: { user_id: string }[]) {
  const entries = new Map(applications.map(application => [application.user_id, { ...application, hasApplication: true }]));
  const shopMap = new Map(shops.map(shop => [shop.user_id, shop]));
  for (const { user_id } of listerRoles) {
    if (entries.has(user_id)) continue;
    const shop = shopMap.get(user_id);
    entries.set(user_id, { id: user_id, user_id, business_name: shop?.business_name ?? "HolyHub lister", contact_name: null, email: "", category_type: shop?.category_type ?? "", description: "", website_or_social: "", status: "Lister access enabled", hasApplication: false });
  }
  return [...entries.values()].sort((a, b) => (shopMap.get(a.user_id)?.business_name ?? a.business_name).localeCompare(shopMap.get(b.user_id)?.business_name ?? b.business_name) || a.user_id.localeCompare(b.user_id));
}

export function catalogueCounts(products: { review_status: string; is_published: boolean }[]) {
  return { total: products.length, live: products.filter(p => p.review_status === "approved" && p.is_published).length, pending: products.filter(p => p.review_status === "pending").length };
}

// Account identity is the user ID; equal shop names never combine accounts.
export function listerReadiness(applications: { user_id: string }[], roles: { user_id: string }[], shops: { user_id: string }[], products: { lister_user_id: string; review_status: string; is_published: boolean }[]) {
  const accounts = new Set([...applications, ...roles].map(row => row.user_id));
  const savedShops = new Set(shops.map(row => row.user_id));
  const preparedAccounts = new Set(products.filter(row => row.review_status === "approved" && row.is_published).map(row => row.lister_user_id));
  return {
    total: accounts.size,
    setupNeeded: [...accounts].filter(id => !savedShops.has(id)).length,
    prepared: [...accounts].filter(id => savedShops.has(id) && preparedAccounts.has(id)).length,
    notPrepared: [...accounts].filter(id => savedShops.has(id) && !preparedAccounts.has(id)).length,
  };
}
