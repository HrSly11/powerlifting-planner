// competition.js - Competition date management
import * as DB from '../db/dexie-wrapper.js';
import { getCompetitionChangeProtocol, generatePlannedSessions } from './planner.js';
import { SESSION_TEMPLATES, buildSessionExercises } from './workoutBuilder.js';

export async function changeCompetitionDate(newDate) {
  const comp = await DB.getCompetition();
  const oldDate = comp?.current_date || comp?.original_date;

  const protocol = getCompetitionChangeProtocol(oldDate, newDate);

  // Build preview sessions
  const oneRMs = await DB.getLatest1RMs();
  const increment = await DB.getSetting('plate_increment_kg') || 1.25;
  const mode = await DB.getSetting('rounding_mode') || 'nearest';

  let cursor = new Date();
  cursor.setDate(cursor.getDate() + 1);
  const previewSessions = [];

  for (const block of protocol.blocks) {
    const template = SESSION_TEMPLATES[block.phase] || SESSION_TEMPLATES.hypertrophy;
    const blockStart = new Date(cursor);

    for (let week = 0; week < block.weeks; week++) {
      const weekStart = new Date(blockStart);
      weekStart.setDate(weekStart.getDate() + week * 7);
      const sessionsPerWeek = Math.min(template.sessions.length, block.days_per_week);

      for (let dayIdx = 0; dayIdx < sessionsPerWeek; dayIdx++) {
        const st = template.sessions[dayIdx];
        const sessionDate = new Date(weekStart);
        sessionDate.setDate(sessionDate.getDate() + dayIdx);
        const exercises = buildSessionExercises(st, oneRMs, increment, mode);
        previewSessions.push({
          date: sessionDate.toISOString().split('T')[0],
          name: st.name,
          phase: block.phase,
          block_name: block.name,
          exercises
        });
      }
    }
    cursor.setDate(cursor.getDate() + block.weeks * 7);
  }

  return {
    protocol,
    old_date: oldDate,
    new_date: newDate,
    preview_sessions: previewSessions,
    total_sessions: previewSessions.length
  };
}

export async function applyCompetitionChange(newDate, newSessions) {
  const comp = await DB.getCompetition();
  const oldDate = comp?.current_date;

  // Delete future non-completed planned sessions
  const db = DB.getDB();
  const today = new Date().toISOString().split('T')[0];
  const futureSessions = await db.planned_sessions
    .where('date').above(today).toArray();
  const toDelete = futureSessions.filter(s => !s.completed).map(s => s.id);
  await DB.bulkDeletePlannedSessions(toDelete);

  // Add new sessions
  await DB.bulkAddPlannedSessions(newSessions);

  // Update competition record
  const history = comp?.history || [];
  history.push({ from: oldDate, to: newDate, changed_at: new Date().toISOString() });
  await DB.updateCompetition({ current_date: newDate, history });

  await DB.addHistory('competition_change', { old_date: oldDate, new_date: newDate, sessions_added: newSessions.length });

  return true;
}
