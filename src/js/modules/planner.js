// planner.js - Macrocycle planner and session generator
import { SESSION_TEMPLATES, buildSessionExercises, calcWeight } from './workoutBuilder.js';

// Default macrocycle structure (Abr 2026 -> Mar 2027)
export function getDefaultMacrocycle(startDate = '2026-04-01', competitionDate = '2027-03-20') {
  const start = new Date(startDate);
  const comp = new Date(competitionDate);
  const totalWeeks = Math.floor((comp - start) / (7 * 86400000));

  // Reserve last weeks for competition phases
  const taperWeeks = 2;
  const peakingWeeks = 4; // S8-S9
  const volumeCompWeeks = 4; // competition volume block
  const offSeasonReducedWeeks = 6;
  const compPhaseTotal = taperWeeks + peakingWeeks + volumeCompWeeks;
  const offSeasonWeeks = totalWeeks - compPhaseTotal - offSeasonReducedWeeks;
  const hypertrophyWeeks = Math.ceil(offSeasonWeeks * 0.55);
  const strengthWeeks = offSeasonWeeks - hypertrophyWeeks;

  let cursor = new Date(start);
  const blocks = [];

  function addBlock(name, phase, weeks, daysPerWeek) {
    const blockStart = new Date(cursor);
    cursor.setDate(cursor.getDate() + weeks * 7);
    const blockEnd = new Date(cursor);
    blockEnd.setDate(blockEnd.getDate() - 1);
    blocks.push({
      name, phase, weeks, days_per_week: daysPerWeek,
      start_date: blockStart.toISOString().split('T')[0],
      end_date: blockEnd.toISOString().split('T')[0]
    });
  }

  addBlock('Hipertrofia (Off-season)', 'hypertrophy', hypertrophyWeeks, 5);
  addBlock('Fuerza Base (Off-season)', 'strength', strengthWeeks, 5);
  addBlock('Off-season Reducido', 'strength', offSeasonReducedWeeks, 4);
  addBlock('Volumen Competición', 'specific', volumeCompWeeks, 4);
  addBlock('Peaking', 'specific', peakingWeeks, 4);
  addBlock('Taper', 'taper', taperWeeks, 3);

  return { start_date: startDate, competition_date: competitionDate, blocks, total_weeks: totalWeeks };
}

// Generate planned sessions from macrocycle
export function generatePlannedSessions(macrocycle, oneRMs, increment = 1.25, roundingMode = 'nearest') {
  const sessions = [];
  let globalWeekIndex = 0;

  for (const block of macrocycle.blocks) {
    const template = SESSION_TEMPLATES[block.phase] || SESSION_TEMPLATES.hypertrophy;
    const blockStart = new Date(block.start_date);

    for (let week = 0; week < block.weeks; week++) {
      globalWeekIndex++;
      const weekStart = new Date(blockStart);
      weekStart.setDate(weekStart.getDate() + week * 7);

      // Check if this is a deload week (every 4th week in hypertrophy/strength)
      const isDeload = (block.phase === 'hypertrophy' || block.phase === 'strength') && ((week + 1) % 4 === 0);

      const sessionsPerWeek = Math.min(template.sessions.length, block.days_per_week);

      for (let dayIdx = 0; dayIdx < sessionsPerWeek; dayIdx++) {
        const sessionTemplate = template.sessions[dayIdx];
        const sessionDate = new Date(weekStart);
        // Spread sessions: Mon, Tue, Wed, Thu, Fri (skip weekends)
        const dayOffsets = [0, 1, 2, 3, 4]; // Mon-Fri
        sessionDate.setDate(sessionDate.getDate() + (dayOffsets[dayIdx] || dayIdx));

        const exercises = buildSessionExercises(sessionTemplate, oneRMs, increment, roundingMode);

        // Apply deload modifications
        let finalExercises = exercises;
        if (isDeload) {
          finalExercises = exercises.map(ex => {
            const newSets = Math.max(1, Math.round(ex.sets * 0.6));
            let newPercent = ex.percent ? Math.round(ex.percent * 0.95) : ex.percent;
            let newRaw = ex.weight_raw, newRounded = ex.weight_rounded;
            if (newPercent && ex.lift_key && oneRMs[ex.lift_key]) {
              const w = calcWeight(newPercent, oneRMs[ex.lift_key].value_kg, increment, roundingMode);
              newRaw = w.raw;
              newRounded = w.rounded;
            }
            return { ...ex, sets: newSets, percent: newPercent, weight_raw: newRaw, weight_rounded: newRounded, rpe: Math.max(5, (ex.rpe || 7) - 1) };
          });
        }

        // Apply weekly progression for hypertrophy (+2.5kg per week on compounds if not deload)
        if (!isDeload && block.phase === 'hypertrophy' && week > 0) {
          finalExercises = finalExercises.map(ex => {
            if (ex.lift_key && ex.weight_rounded !== null) {
              const progression = week * 2.5;
              const newRounded = ex.weight_rounded + progression;
              return { ...ex, weight_rounded: newRounded, weight_raw: ex.weight_raw + progression };
            }
            return ex;
          });
        }

        sessions.push({
          date: sessionDate.toISOString().split('T')[0],
          name: sessionTemplate.name + (isDeload ? ' (Deload)' : ''),
          phase: block.phase,
          block_name: block.name,
          week_index: globalWeekIndex,
          week_in_block: week + 1,
          day_in_week: dayIdx + 1,
          is_deload: isDeload,
          completed: false,
          updated_from_1RM_change: false,
          notes: '',
          exercises: finalExercises
        });
      }
    }
  }
  return sessions;
}

// Recalculate future sessions after 1RM change
export function recalculateFutureSessions(sessions, oneRMs, increment = 1.25, mode = 'nearest') {
  const today = new Date().toISOString().split('T')[0];
  return sessions.map(session => {
    if (session.date <= today || session.completed) return session;
    const updatedExercises = session.exercises.map(ex => {
      if (!ex.percent || !ex.lift_key || !oneRMs[ex.lift_key]) return ex;
      const w = calcWeight(ex.percent, oneRMs[ex.lift_key].value_kg, increment, mode);
      return { ...ex, weight_raw: w.raw, weight_rounded: w.rounded };
    });
    return { ...session, exercises: updatedExercises, updated_from_1RM_change: true };
  });
}

// Apply failure handling rules
export function handleFailure(failureReason, exercise, currentSession, oneRMs) {
  const recommendations = [];

  if (failureReason === 'tecnica') {
    recommendations.push({
      type: 'reduce_weight',
      description: `Bajar 2.5 kg en próximo topset de ${exercise.exercise}`,
      action: { adjust_kg: -2.5, target: 'next_topset' }
    });
    recommendations.push({
      type: 'corrective_block',
      description: `Añadir bloque correctivo: 2-3 sesiones con paused reps, tempo ecc., 5-6 sets técnicos de ${exercise.exercise}`,
      action: { insert_corrective: true, exercise: exercise.exercise, sessions: 3, sets: 5, reps: 4, percent: 60 }
    });
  } else if (failureReason === 'fatiga') {
    recommendations.push({
      type: 'repeat_weight',
      description: `Repetir misma carga en próxima sesión, reducir reps objetivo en 1-2`,
      action: { repeat: true, reduce_reps: 1 }
    });
    recommendations.push({
      type: 'potential_deload',
      description: `Si falla 2x en 14 días → insertar deload week (vol -40%)`,
      action: { check_double_failure: true, deload_if_needed: true }
    });
  } else if (failureReason === 'lesion') {
    recommendations.push({
      type: 'consult',
      description: 'Sugerir consulta profesional. No se aplicarán cambios automáticos al plan.',
      action: { no_auto_change: true }
    });
  }

  return recommendations;
}

// Competition date change protocols
export function getCompetitionChangeProtocol(currentDate, newDate) {
  const today = new Date();
  const newComp = new Date(newDate);
  const leadTimeDays = Math.floor((newComp - today) / 86400000);
  const leadTimeWeeks = Math.floor(leadTimeDays / 7);

  let protocol, description, blocks;

  if (leadTimeWeeks <= 4) {
    protocol = 'B3';
    description = 'Emergency mini-peak/taper (≤4 semanas)';
    blocks = [
      { name: 'Mini-Peak', phase: 'specific', weeks: Math.max(1, leadTimeWeeks - 1), days_per_week: 3 },
      { name: 'Taper', phase: 'taper', weeks: 1, days_per_week: 2 }
    ];
  } else if (leadTimeWeeks <= 8) {
    protocol = 'B2';
    description = 'Condensed peak (4-8 semanas)';
    blocks = [
      { name: 'Volumen Condensado', phase: 'specific', weeks: 2, days_per_week: 4 },
      { name: 'Peaking', phase: 'specific', weeks: Math.max(1, leadTimeWeeks - 4), days_per_week: 4 },
      { name: 'Taper', phase: 'taper', weeks: 2, days_per_week: 3 }
    ];
  } else {
    protocol = 'B1';
    description = 'Reconstrucción completa (≥8 semanas)';
    const remainingWeeks = leadTimeWeeks - 6; // Reserve 6 for peak+taper
    blocks = [
      { name: 'Fuerza Base', phase: 'strength', weeks: Math.floor(remainingWeeks * 0.6), days_per_week: 5 },
      { name: 'Específico', phase: 'specific', weeks: Math.ceil(remainingWeeks * 0.4), days_per_week: 4 },
      { name: 'Peaking', phase: 'specific', weeks: 4, days_per_week: 4 },
      { name: 'Taper', phase: 'taper', weeks: 2, days_per_week: 3 }
    ];
  }

  return { protocol, description, leadTimeDays, leadTimeWeeks, blocks, newDate };
}

// Check RPE trends for 1RM adjustment suggestions
export function checkRPETrend(loggedSessions, liftKey) {
  const recent = loggedSessions
    .filter(s => s.exercises?.some(e => e.lift_key === liftKey && e.is_topset))
    .slice(-6); // Last 6 sessions with this lift

  const topsetRPEs = [];
  for (const s of recent) {
    for (const e of s.exercises) {
      if (e.lift_key === liftKey && e.is_topset && e.rpe_actual != null) {
        topsetRPEs.push(e.rpe_actual);
      }
    }
  }

  if (topsetRPEs.length < 3) return null;

  const last3 = topsetRPEs.slice(-3);
  const avgRPE = last3.reduce((a, b) => a + b, 0) / last3.length;

  if (avgRPE <= 6) {
    return {
      suggestion: 'easy',
      avgRPE,
      options: [
        { label: 'A', description: 'Incrementar 1RM (+2.5-5 kg) — evidencia consistente de 3 sesiones con RPE ≤6 en topsets', risk: 'Medio — puede ser prematuro si la forma no es consistente', benefit: 'Carga más ajustada a nivel real' },
        { label: 'B', description: 'Subir RPE objetivo (ej: de RPE 7 → 8) para próximas sesiones', risk: 'Bajo — más esfuerzo percibido pero controlable', benefit: 'Más estímulo sin cambiar 1RM' },
        { label: 'C', description: 'Mantener y añadir small top sets/AMRAPs en accesorios (solo off-season)', risk: 'Bajo — volumen extra moderado', benefit: 'Más volumen de práctica sin estresar recuperación' }
      ]
    };
  }
  return null;
}
