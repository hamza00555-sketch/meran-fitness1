import { openDB } from 'idb';

const DB_NAME = 'ratebi-db';
const DB_VERSION = 1;

let _db;
async function db() {
  if (!_db) {
    _db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        database.createObjectStore('settings', { keyPath: 'key' });
        database.createObjectStore('commitments', { keyPath: 'id' });
        database.createObjectStore('goals', { keyPath: 'id' });
        const expenses = database.createObjectStore('expenses', { keyPath: 'id' });
        expenses.createIndex('month', 'month');
        database.createObjectStore('monthlyRecords', { keyPath: 'month' });
      },
    });
  }
  return _db;
}

export async function getSetting(key) {
  const r = await (await db()).get('settings', key);
  return r ? r.value : null;
}
export async function setSetting(key, value) {
  await (await db()).put('settings', { key, value });
}
export async function getAllSettings() {
  const all = await (await db()).getAll('settings');
  return all.reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {});
}

export async function getCommitments() { return (await db()).getAll('commitments'); }
export async function saveCommitment(c) { await (await db()).put('commitments', c); }
export async function deleteCommitment(id) { await (await db()).delete('commitments', id); }

export async function getGoals() { return (await db()).getAll('goals'); }
export async function saveGoal(g) { await (await db()).put('goals', g); }
export async function deleteGoal(id) { await (await db()).delete('goals', id); }

export async function getExpenses() { return (await db()).getAll('expenses'); }
export async function getExpensesByMonth(month) {
  return (await db()).getAllFromIndex('expenses', 'month', month);
}
export async function saveExpense(e) { await (await db()).put('expenses', e); }
export async function deleteExpense(id) { await (await db()).delete('expenses', id); }

export async function getMonthlyRecords() { return (await db()).getAll('monthlyRecords'); }
export async function saveMonthlyRecord(r) { await (await db()).put('monthlyRecords', r); }

export async function exportAll() {
  const d = await db();
  const [settings, commitments, goals, expenses, monthlyRecords] = await Promise.all([
    d.getAll('settings'), d.getAll('commitments'), d.getAll('goals'),
    d.getAll('expenses'), d.getAll('monthlyRecords'),
  ]);
  return { settings, commitments, goals, expenses, monthlyRecords, exportDate: new Date().toISOString() };
}

export async function importAll(data) {
  const d = await db();
  const stores = ['settings', 'commitments', 'goals', 'expenses', 'monthlyRecords'];
  const tx = d.transaction(stores, 'readwrite');
  for (const store of stores) await tx.objectStore(store).clear();
  for (const item of data.settings || []) await tx.objectStore('settings').put(item);
  for (const item of data.commitments || []) await tx.objectStore('commitments').put(item);
  for (const item of data.goals || []) await tx.objectStore('goals').put(item);
  for (const item of data.expenses || []) await tx.objectStore('expenses').put(item);
  for (const item of data.monthlyRecords || []) await tx.objectStore('monthlyRecords').put(item);
  await tx.done;
}
