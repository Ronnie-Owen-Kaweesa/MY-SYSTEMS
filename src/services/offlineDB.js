import Dexie from 'dexie';

const db = new Dexie('BarManagementOffline');

db.version(5).stores({
  products: 'id, product_code, name, category_id, is_active',
  categories: 'id, name',
  shifts: 'id, status, cashier_id',
  tabs: 'id, status, customer_name',
  tabItems: 'id, tab_id, product_id',
  payments: 'id, tab_id, amount, payment_method',
  expenses: 'id, amount, description',
  users: 'id, full_name, role, pin_code, password',
  mutationQueue: '++localId, syncStatus, tableName, operationType, recordId, data, timestamp',
});

// ---------- GENERIC QUEUE ----------
export async function enqueueMutation(mutation) {
  await db.mutationQueue.add({ ...mutation, timestamp: new Date().toISOString(), syncStatus: 'pending' });
}
export async function getPendingMutations() {
  return await db.mutationQueue.where('syncStatus').equals('pending').toArray();
}
export async function markMutationSynced(localId) {
  await db.mutationQueue.update(localId, { syncStatus: 'synced' });
}
export async function clearSyncedMutations() {
  await db.mutationQueue.where('syncStatus').equals('synced').delete();
}

// ---------- TABLE CACHE ----------
export async function cacheTable(tableName, rows) {
  await db.table(tableName).clear();
  if (rows && rows.length > 0) await db.table(tableName).bulkPut(rows);
}
export async function getCachedTable(tableName) {
  return await db.table(tableName).toArray();
}

// ---------- USER CREDENTIAL CACHE ----------
export async function cacheUsers(users) {
  await db.users.clear();
  if (users && users.length > 0) {
    const minimal = users.map(u => ({
      id: u.id,
      full_name: u.full_name,
      role: u.role,
      pin_code: u.pin_code,
      password: u.password,
    }));
    await db.users.bulkPut(minimal);
  }
}
export async function getCachedUserByPin(pin) {
  return await db.users.where('pin_code').equals(pin).first();
}
export async function getCachedUserByPassword(password) {
  return await db.users.where('password').equals(password).first();
}

export function isOnline() {
  return navigator.onLine;
}
export function listenToConnectivity(callback) {
  window.addEventListener('online', callback);
}
export default db;
