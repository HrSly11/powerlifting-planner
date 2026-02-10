// analytics.js - Analytics and reporting
import * as DB from '../db/dexie-wrapper.js';
import { VOLUME_TARGETS, EXERCISE_LIBRARY } from '../db/schema.js';
import { calculateVolumePerMuscle } from './workoutBuilder.js';

// Get weekly volume summary
export async function getWeeklyVolume(weekStartDate) {
  const db = DB.getDB();
  const start = new Date(weekStartDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];

  const planned = await db.planned_sessions
    .where('date').between(startStr, endStr, true, true).toArray();
  const logged = await db.logged_sessions
    .where('date').between(startStr, endStr, true, true).toArray();

  const plannedVolume = calculateVolumePerMuscle(planned);
  const loggedVolume = {};

  for (const ls of logged) {
    for (const ex of (ls.exercises || [])) {
      const exDef = EXERCISE_LIBRARY.find(e => e.name === ex.exercise);
      if (!exDef) continue;
      for (const mg of exDef.muscle_groups) {
        loggedVolume[mg] = (loggedVolume[mg] || 0) + (ex.sets_completed || 0);
      }
    }
  }

  // Determine current phase
  const phase = planned.length > 0 ? planned[0].phase : 'hypertrophy';
  const targets = VOLUME_TARGETS[phase] || VOLUME_TARGETS.hypertrophy;

  const muscles = Object.keys(targets);
  return muscles.map(m => ({
    muscle: m,
    planned: plannedVolume[m] || 0,
    logged: loggedVolume[m] || 0,
    target_min: targets[m].min,
    target_max: targets[m].max,
    target_optimal: targets[m].optimal,
    status: (loggedVolume[m] || 0) >= targets[m].min ? 'ok' :
            (plannedVolume[m] || 0) >= targets[m].min ? 'pending' : 'low'
  }));
}

// Get progress data for main lifts
export async function getLiftProgress(lift) {
  const db = DB.getDB();
  const logs = await db.logged_sessions.toArray();
  const dataPoints = [];

  for (const session of logs) {
    for (const ex of (session.exercises || [])) {
      if (ex.lift_key === lift && ex.is_topset) {
        const maxWeight = ex.sets ? Math.max(...ex.sets.map(s => s.weight_kg || 0)) : (ex.planned_weight || 0);
        const maxReps = ex.sets ? Math.max(...ex.sets.map(s => s.reps || 0)) : (ex.planned_reps || 0);
        dataPoints.push({
          date: session.date,
          weight: maxWeight,
          reps: maxReps,
          rpe: ex.rpe_actual,
          e1rm: maxWeight * (1 + maxReps / 30) // Epley formula
        });
      }
    }
  }

  return dataPoints.sort((a, b) => a.date.localeCompare(b.date));
}

// Get 1RM history
export async function get1RMTimeline() {
  const all = await DB.getAll('one_rms');
  const byLift = {};
  for (const rm of all) {
    if (!byLift[rm.lift]) byLift[rm.lift] = [];
    byLift[rm.lift].push({ date: rm.date, value: rm.value_kg, reason: rm.reason });
  }
  for (const lift of Object.keys(byLift)) {
    byLift[lift].sort((a, b) => a.date.localeCompare(b.date));
  }
  return byLift;
}

// Generate full backup data
export async function generateBackupData() {
  const db = DB.getDB();
  return {
    meta: {
      version: "1.0",
      exported_at: new Date().toISOString(),
      user: "Harry"
    },
    user: (await db.users.toArray())[0] || {},
    one_rms: await db.one_rms.toArray(),
    planned_sessions: await db.planned_sessions.toArray(),
    logged_sessions: await db.logged_sessions.toArray(),
    settings: await db.settings.toArray(),
    competition: await db.competition.toArray(),
    exercises: await db.exercises.toArray(),
    history: await db.history.toArray()
  };
}

// Get compliance summary for recent weeks
export async function getComplianceSummary(weeks = 4) {
  const db = DB.getDB();
  const results = [];
  const now = new Date();

  for (let w = 0; w < weeks; w++) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - (weekStart.getDay() || 7) + 1 - (w * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const startStr = weekStart.toISOString().split('T')[0];
    const endStr = weekEnd.toISOString().split('T')[0];

    const planned = await db.planned_sessions
      .where('date').between(startStr, endStr, true, true).toArray();
    const logged = await db.logged_sessions
      .where('date').between(startStr, endStr, true, true).toArray();

    let pSets = 0, lSets = 0;
    planned.forEach(s => (s.exercises || []).forEach(e => pSets += e.sets || 0));
    logged.forEach(s => (s.exercises || []).forEach(e => lSets += e.sets_completed || 0));

    results.push({
      week_start: startStr,
      week_end: endStr,
      planned_sets: pSets,
      logged_sets: lSets,
      compliance: pSets > 0 ? Math.round((lSets / pSets) * 100) : 0,
      sessions_planned: planned.length,
      sessions_logged: logged.length
    });
  }

  return results;
}
