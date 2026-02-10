// logger.js - Session logging functionality
import * as DB from '../db/dexie-wrapper.js';

export const FAILURE_REASONS = [
  { value: 'none', label: 'Sin fallo' },
  { value: 'tecnica', label: 'Técnica' },
  { value: 'fatiga', label: 'Fatiga' },
  { value: 'lesion', label: 'Lesión/Dolor' },
  { value: 'otro', label: 'Otro' }
];

// Log a session
export async function logSession(plannedSessionId, exerciseLogs, notes = '') {
  const logEntry = {
    planned_session_id: plannedSessionId || null,
    date: new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString(),
    exercises: exerciseLogs,
    notes,
    immutable: true
  };

  const id = await DB.add('logged_sessions', logEntry);

  // Mark planned session as completed if linked
  if (plannedSessionId) {
    await DB.update('planned_sessions', plannedSessionId, { completed: true });
  }

  return id;
}

// Get pending planned sessions (not completed, future or recent)
export async function getPendingSessions(daysBack = 7, daysForward = 14) {
  const db = DB.getDB();
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - daysBack);
  const end = new Date(now);
  end.setDate(end.getDate() + daysForward);

  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];

  const all = await db.planned_sessions
    .where('date')
    .between(startStr, endStr, true, true)
    .toArray();

  return all.filter(s => !s.completed);
}

// Get logged sessions
export async function getLoggedSessions(daysBack = 30) {
  const db = DB.getDB();
  const start = new Date();
  start.setDate(start.getDate() - daysBack);
  const startStr = start.toISOString().split('T')[0];

  return db.logged_sessions
    .where('date')
    .above(startStr)
    .reverse()
    .toArray();
}

// Calculate weekly compliance
export async function calculateCompliance(weekStartDate) {
  const db = DB.getDB();
  const weekStart = new Date(weekStartDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const startStr = weekStart.toISOString().split('T')[0];
  const endStr = weekEnd.toISOString().split('T')[0];

  const planned = await db.planned_sessions
    .where('date')
    .between(startStr, endStr, true, true)
    .toArray();

  const logged = await db.logged_sessions
    .where('date')
    .between(startStr, endStr, true, true)
    .toArray();

  let totalPlannedSets = 0;
  let totalLoggedSetsForPlanned = 0;

  for (const ps of planned) {
    for (const ex of (ps.exercises || [])) {
      totalPlannedSets += ex.sets || 0;
    }
  }

  for (const ls of logged) {
    if (ls.planned_session_id) {
      for (const ex of (ls.exercises || [])) {
        totalLoggedSetsForPlanned += (ex.sets_completed || ex.sets || 0);
      }
    }
  }

  const compliance = totalPlannedSets > 0
    ? Math.round((totalLoggedSetsForPlanned / totalPlannedSets) * 100)
    : 0;

  return {
    week_start: startStr,
    planned_sets: totalPlannedSets,
    logged_sets: totalLoggedSetsForPlanned,
    compliance,
    sessions_planned: planned.length,
    sessions_logged: logged.filter(l => l.planned_session_id).length
  };
}

// Create exercise log entry
export function createExerciseLog(exercise, setsData) {
  return {
    exercise: exercise.exercise || exercise.name,
    lift_key: exercise.lift_key || null,
    is_topset: exercise.is_topset || false,
    planned_sets: exercise.sets,
    planned_reps: exercise.reps,
    planned_percent: exercise.percent || null,
    planned_weight: exercise.weight_rounded || null,
    sets: setsData.map((set, idx) => ({
      set_number: idx + 1,
      weight_kg: set.weight_kg,
      reps: set.reps,
      rpe_actual: set.rpe,
      failed: set.failed || false,
      failure_reason: set.failure_reason || 'none',
      notes: set.notes || ''
    })),
    sets_completed: setsData.filter(s => !s.failed).length,
    rpe_actual: setsData.length > 0 ? setsData[setsData.length - 1].rpe : null,
    recommendation_applied: null
  };
}
