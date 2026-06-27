import Dexie from 'dexie';

// Local IndexedDB for offline storage
const offlineDB = new Dexie('BarManagementOffline');

offlineDB.version(1).stores({
    products: 'id, product_code, name, category_id',
    pendingTabs: '++localId, syncStatus',
    pendingPayments: '++localId, syncStatus',
    pendingStockCounts: '++localId, syncStatus',
    offlineShifts: 'id, status',
    syncQueue: '++id, table, operation, recordId, timestamp',
});

// Add to sync queue
export async function queueForSync(table, operation, recordId, data) {
    await offlineDB.syncQueue.add({
        table,
        operation,
        recordId,
        data: JSON.stringify(data),
        timestamp: new Date().toISOString(),
    });
}

// Process sync queue when online
export async function processSyncQueue(supabase) {
    const queue = await offlineDB.syncQueue.toArray();
    
    for (const item of queue) {
        try {
            const data = JSON.parse(item.data);
            
            switch (item.operation) {
                case 'INSERT':
                    await supabase.from(item.table).insert(data);
                    break;
                case 'UPDATE':
                    await supabase.from(item.table).update(data).eq('id', item.recordId);
                    break;
                case 'DELETE':
                    await supabase.from(item.table).delete().eq('id', item.recordId);
                    break;
            }
            
            // Remove from queue on success
            await offlineDB.syncQueue.delete(item.id);
        } catch (error) {
            console.error(`Sync failed for item ${item.id}:`, error);
        }
    }
}

// Check if online
export function isOnline() {
    return navigator.onLine;
}

// Listen for connectivity changes
export function listenToConnectivity(supabase) {
    window.addEventListener('online', () => {
        console.log('🌐 Back online - syncing...');
        processSyncQueue(supabase);
    });
    
    window.addEventListener('offline', () => {
        console.log('📡 Offline - changes will sync later');
    });
}

export default offlineDB;
