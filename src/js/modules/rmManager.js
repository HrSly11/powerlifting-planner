// rmManager.js - 1RM management
import * as DB from '../db/dexie-wrapper.js';
import { calcWeight } from './workoutBuilder.js';

// Get all 1RM history for a lift
export async function get1RMHistory(lift) {
  const db = DB.getDB();
  return db.one_rms.where('lift').equals(lift).reverse().sortBy('date');
}

// Update 1RM and recalculate future sessions
export async function update1RM(lift, newValue, reason = 'manual') {
  // Save new 1RM entry
  await DB.add1RM(lift, newValue, reason);

  // Get latest 1RMs
  const oneRMs = await DB.getLatest1RMs();

  // Get future planned sessions
  const futureSessions = await DB.getFuturePlannedSessions();
  const settings = {
    increment: await DB.getSetting('plate_increment_kg') || 1.25,
    mode: await DB.getSetting('rounding_mode') || 'nearest'
  };

  const changes = [];

  for (const session of futureSessions) {
    if (session.completed) continue;
    let changed = false;
    const updatedExercises = (session.exercises || []).map(ex => {
      if (!ex.percent || ex.lift_key !== lift) return ex;
      const oldRounded = ex.weight_rounded;
      const w = calcWeight(ex.percent, newValue, settings.increment, settings.mode);
      if (w.rounded !== oldRounded) {
        changed = true;
        return { ...ex, weight_raw: w.raw, weight_rounded: w.rounded };
      }
      return ex;
    });

    if (changed) {
      changes.push({
        session_id: session.id,
        date: session.date,
        name: session.name,
        old_exercises: session.exercises,
        new_exercises: updatedExercises
      });
      await DB.update('planned_sessions', session.id, {
        exercises: updatedExercises,
        updated_from_1RM_change: true
      });
    }
  }

  // Log history
  await DB.addHistory('1rm_change', { lift, new_value: newValue, reason, affected_sessions: changes.length });

  return changes;
}

// Get diff preview before applying 1RM change
export async function preview1RMChange(lift, newValue) {
  const oneRMs = await DB.getLatest1RMs();
  const oldValue = oneRMs[lift]?.value_kg || 0;
  const futureSessions = await DB.getFuturePlannedSessions();
  const settings = {
    increment: await DB.getSetting('plate_increment_kg') || 1.25,
    mode: await DB.getSetting('rounding_mode') || 'nearest'
  };

  const affected = [];
  for (const session of futureSessions) {
    if (session.completed) continue;
    for (const ex of (session.exercises || [])) {
      if (ex.percent && ex.lift_key === lift) {
        const oldW = calcWeight(ex.percent, oldValue, settings.increment, settings.mode);
        const newW = calcWeight(ex.percent, newValue, settings.increment, settings.mode);
        if (oldW.rounded !== newW.rounded) {
          affected.push({
            date: session.date,
            name: session.name,
            exercise: ex.exercise,
            percent: ex.percent,
            old_kg: oldW.rounded,
            new_kg: newW.rounded,
            diff: newW.rounded - oldW.rounded
          });
        }
      }
    }
  }

  return { lift, old_value: oldValue, new_value: newValue, diff: newValue - oldValue, affected_sessions: affected };
}
