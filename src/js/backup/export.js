// export.js - Backup export
import { generateBackupData } from '../modules/analytics.js';
import * as DB from '../db/dexie-wrapper.js';

export async function exportBackup() {
  const data = await generateBackupData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `harry-powerlifting-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  await DB.setSetting('last_backup', new Date().toISOString());
  return true;
}

export async function checkBackupWarning() {
  const lastBackup = await DB.getSetting('last_backup');
  const warningDays = await DB.getSetting('backup_warning_days') || 7;
  if (!lastBackup) return true; // Never backed up
  const diff = (Date.now() - new Date(lastBackup).getTime()) / 86400000;
  return diff > warningDays;
}
