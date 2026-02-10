// import.js - Backup import with diff and merge
import * as DB from '../db/dexie-wrapper.js';

export function validateBackupSchema(data) {
  const errors = [];
  if (!data.meta) errors.push('Falta campo "meta"');
  if (!data.meta?.version) errors.push('Falta "meta.version"');
  if (!data.one_rms || !Array.isArray(data.one_rms)) errors.push('Falta o inválido "one_rms"');
  if (data.planned_sessions && !Array.isArray(data.planned_sessions)) errors.push('"planned_sessions" inválido');
  if (data.logged_sessions && !Array.isArray(data.logged_sessions)) errors.push('"logged_sessions" inválido');
  return { valid: errors.length === 0, errors };
}

export async function computeDiff(importData) {
  const current = {
    one_rms: await DB.getAll('one_rms'),
    planned_sessions: await DB.getAll('planned_sessions'),
    logged_sessions: await DB.getAll('logged_sessions'),
    settings: await DB.getAll('settings')
  };

  return {
    one_rms: { current: current.one_rms.length, incoming: (importData.one_rms || []).length },
    planned_sessions: { current: current.planned_sessions.length, incoming: (importData.planned_sessions || []).length },
    logged_sessions: { current: current.logged_sessions.length, incoming: (importData.logged_sessions || []).length },
    settings: { current: current.settings.length, incoming: Object.keys(importData.settings || {}).length }
  };
}

export async function importBackup(data, mode = 'merge') {
  const db = DB.getDB();

  if (mode === 'replace') {
    await db.one_rms.clear();
    await db.planned_sessions.clear();
    await db.logged_sessions.clear();
    await db.settings.clear();
    await db.competition.clear();
  }

  // Import 1RMs
  if (data.one_rms) {
    for (const rm of data.one_rms) {
      const { id, ...rest } = rm;
      await db.one_rms.add(rest);
    }
  }

  // Import planned sessions
  if (data.planned_sessions) {
    for (const ps of data.planned_sessions) {
      const { id, ...rest } = ps;
      await db.planned_sessions.add(rest);
    }
  }

  // Import logged sessions (with confirmation in merge mode)
  if (data.logged_sessions) {
    for (const ls of data.logged_sessions) {
      const { id, ...rest } = ls;
      await db.logged_sessions.add(rest);
    }
  }

  // Import settings
  if (data.settings) {
    if (Array.isArray(data.settings)) {
      for (const s of data.settings) {
        await db.settings.put(s);
      }
    } else {
      for (const [key, value] of Object.entries(data.settings)) {
        await db.settings.put({ key, value });
      }
    }
  }

  // Import competition
  if (data.competition) {
    await db.competition.clear();
    if (Array.isArray(data.competition)) {
      for (const c of data.competition) {
        const { id, ...rest } = c;
        await db.competition.add(rest);
      }
    } else {
      await db.competition.add(data.competition);
    }
  }

  await DB.addHistory('import', { mode, date: new Date().toISOString() });
  return true;
}
