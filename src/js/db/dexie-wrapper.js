// dexie-wrapper.js - IndexedDB wrapper using Dexie (loaded globally via script tag)
import { DB_NAME, STORES, SEED_DATA, EXERCISE_LIBRARY } from './schema.js';

let db = null;

export async function initDB() {
  if (db) return db;
  if (typeof Dexie === 'undefined') {
    throw new Error('Dexie.js not loaded. Check CDN script in index.html');
  }
  db = new Dexie(DB_NAME);
  db.version(1).stores(STORES);
  await db.open();
  const userCount = await db.users.count();
  if (userCount === 0) await seedDatabase();
  return db;
}

export function getDB() {
  if (!db) throw new Error('DB not initialized. Call initDB() first.');
  return db;
}

async function seedDatabase() {
  await db.users.add({ name: SEED_DATA.user.name, created_at: SEED_DATA.user.created_at });
  for (const rm of SEED_DATA.one_rms) await db.one_rms.add(rm);
  for (const [key, value] of Object.entries(SEED_DATA.settings)) await db.settings.put({ key, value });
  await db.competition.add({ original_date: SEED_DATA.competition.original_date, current_date: SEED_DATA.competition.current_date, history: [] });
  for (const ex of EXERCISE_LIBRARY) await db.exercises.add(ex);
  console.log('Database seeded with Harry defaults');
}

export async function getAll(store) { return db[store].toArray(); }
export async function getById(store, id) { return db[store].get(id); }
export async function add(store, data) { return db[store].add(data); }
export async function update(store, id, data) { return db[store].update(id, data); }
export async function remove(store, id) { return db[store].delete(id); }
export async function clearStore(store) { return db[store].clear(); }

export async function getSetting(key) {
  const row = await db.settings.get(key);
  return row ? row.value : null;
}
export async function setSetting(key, value) { return db.settings.put({ key, value }); }

export async function getLatest1RMs() {
  const all = await db.one_rms.toArray();
  const latest = {};
  for (const rm of all) {
    if (!latest[rm.lift] || new Date(rm.date) > new Date(latest[rm.lift].date)) latest[rm.lift] = rm;
  }
  return latest;
}

export async function add1RM(lift, value_kg, reason) {
  return db.one_rms.add({ lift, value_kg, date: new Date().toISOString(), reason });
}

export async function getFuturePlannedSessions() {
  const today = new Date().toISOString().split('T')[0];
  return db.planned_sessions.where('date').above(today).toArray();
}

export async function getCompetition() {
  const comps = await db.competition.toArray();
  return comps[0] || null;
}

export async function updateCompetition(data) {
  const comp = await getCompetition();
  if (comp) return db.competition.update(comp.id, data);
  return db.competition.add(data);
}

export async function addHistory(type, data) {
  return db.history.add({ type, date: new Date().toISOString(), data });
}

export async function bulkAddPlannedSessions(sessions) { return db.planned_sessions.bulkAdd(sessions); }
export async function bulkDeletePlannedSessions(ids) { return db.planned_sessions.bulkDelete(ids); }
export async function clearPlannedSessions() { return db.planned_sessions.clear(); }
