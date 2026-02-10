// workoutBuilder.js - Build workouts from templates
import { EXERCISE_LIBRARY, VOLUME_TARGETS } from '../db/schema.js';

// Calculate weight from percentage
export function calcWeight(percent, oneRM, increment = 1.25, mode = 'nearest') {
  const raw = Math.round((percent / 100) * oneRM * 100) / 100;
  let rounded;
  if (mode === 'up') {
    rounded = Math.ceil(raw / increment) * increment;
  } else if (mode === 'down') {
    rounded = Math.floor(raw / increment) * increment;
  } else {
    rounded = Math.round(raw / increment) * increment;
  }
  rounded = Math.round(rounded * 100) / 100;
  return { raw, rounded };
}

// Suggest plates for a given weight
export function suggestPlates(weight) {
  const barWeight = 20;
  let perSide = (weight - barWeight) / 2;
  if (perSide <= 0) return [{ plate: 'bar only', count: 1 }];
  const plates = [25, 20, 15, 10, 5, 2.5, 1.25];
  const result = [];
  for (const p of plates) {
    while (perSide >= p) {
      result.push(p);
      perSide -= p;
    }
  }
  return result.map(p => `${p}kg`).join(' + ');
}

// Generate warmup sets for a main lift
export function generateWarmup(exercise, workingWeight, phase = 'hypertrophy') {
  const warmupType = EXERCISE_LIBRARY.find(e => e.name === exercise)?.warmup_type;
  if (!warmupType) return [];

  const protocols = {
    squat: {
      hypertrophy: [
        { note: 'Movilidad: goblet squat 2×8, paused bodyweight squat 1×10' },
        { percent: 40, reps: 5, sets: 3 },
        { percent: 55, reps: 3, sets: 2 },
        { percent: 67, reps: 2, sets: 2 },
        { percent: 75, reps: 1, sets: 1 }
      ],
      strength: [
        { note: 'Movilidad: goblet squat 2×6, hip circles, ankle mobilization' },
        { percent: 40, reps: 5, sets: 2 },
        { percent: 55, reps: 3, sets: 2 },
        { percent: 67, reps: 2, sets: 2 },
        { percent: 75, reps: 1, sets: 1 },
        { percent: 82, reps: 1, sets: 1 }
      ],
      specific: [
        { note: 'Movilidad articular específica: hip openers, ankle dorsiflexion, paused goblet 1×5' },
        { percent: 40, reps: 5, sets: 2 },
        { percent: 50, reps: 3, sets: 1 },
        { percent: 60, reps: 2, sets: 1 },
        { percent: 70, reps: 1, sets: 1 },
        { percent: 80, reps: 1, sets: 1 },
        { percent: 87, reps: 1, sets: 1 }
      ]
    },
    bench: {
      hypertrophy: [
        { note: 'Activación escápula: band pull-apart 2×15, push-ups 1×10' },
        { percent: 40, reps: 8, sets: 2 },
        { percent: 55, reps: 5, sets: 2 },
        { percent: 67, reps: 3, sets: 1 },
        { percent: 75, reps: 1, sets: 1 }
      ],
      strength: [
        { note: 'Activación: band pull-apart 2×15, DB row 1×10, push-ups 1×10' },
        { percent: 40, reps: 5, sets: 2 },
        { percent: 55, reps: 3, sets: 2 },
        { percent: 67, reps: 2, sets: 1 },
        { percent: 75, reps: 1, sets: 1 },
        { percent: 82, reps: 1, sets: 1 }
      ],
      specific: [
        { note: 'Activación escápula + rotador externo: band pull-apart 3×12, face pull 1×12' },
        { percent: 40, reps: 5, sets: 2 },
        { percent: 50, reps: 3, sets: 1 },
        { percent: 60, reps: 2, sets: 1 },
        { percent: 70, reps: 1, sets: 1 },
        { percent: 80, reps: 1, sets: 1 },
        { percent: 87, reps: 1, sets: 1 }
      ]
    },
    deadlift: {
      hypertrophy: [
        { note: 'Hinge pattern: hip hinge 2×10, light RDL 1×8, cat-cow 1×10' },
        { percent: 40, reps: 5, sets: 2 },
        { percent: 55, reps: 3, sets: 2 },
        { percent: 67, reps: 2, sets: 1 },
        { percent: 75, reps: 1, sets: 1 }
      ],
      strength: [
        { note: 'Hinge: hip hinge 2×8, light RDL 1×6, glute bridges 1×10' },
        { percent: 40, reps: 5, sets: 2 },
        { percent: 55, reps: 3, sets: 2 },
        { percent: 67, reps: 2, sets: 1 },
        { percent: 75, reps: 1, sets: 1 },
        { percent: 82, reps: 1, sets: 1 }
      ],
      specific: [
        { note: 'Hinge pattern: hip hinge 2×6, light RDL 1×5, glute activation, hip flexor stretch' },
        { percent: 40, reps: 5, sets: 2 },
        { percent: 50, reps: 3, sets: 1 },
        { percent: 60, reps: 2, sets: 1 },
        { percent: 70, reps: 1, sets: 1 },
        { percent: 80, reps: 1, sets: 1 },
        { percent: 87, reps: 1, sets: 1 }
      ]
    }
  };

  const phaseKey = phase.includes('hyp') ? 'hypertrophy' : phase.includes('str') || phase.includes('fuerza') ? 'strength' : 'specific';
  const protocol = protocols[warmupType]?.[phaseKey] || protocols[warmupType]?.hypertrophy || [];

  return protocol.map(p => {
    if (p.note) return { type: 'note', note: p.note };
    const wt = calcWeight(p.percent, workingWeight / (workingWeight > 0 ? 1 : 1));
    return {
      type: 'warmup_set',
      percent: p.percent,
      reps: p.reps,
      sets: p.sets,
      weight_raw: calcWeight(p.percent, workingWeight).raw,
      weight_rounded: calcWeight(p.percent, workingWeight).rounded
    };
  });
}

// Session templates per phase
export const SESSION_TEMPLATES = {
  // S1-S4: Hypertrophy (5 days/week)
  hypertrophy: {
    days_per_week: 5,
    sessions: [
      { // Day 1: Squat focus
        name: 'Squat + Accesorios pierna',
        exercises: [
          { exercise: 'Squat', sets: 4, reps: 8, percent: 67, rpe: 7, is_topset: false, rest: 180, tempo: '3-1-1-0' },
          { exercise: 'Front Squat', sets: 3, reps: 8, percent: 55, rpe: 7, is_topset: false, rest: 150, tempo: '3-0-1-0' },
          { exercise: 'Leg Press', sets: 3, reps: 12, weight_kg: null, rpe: 7, is_topset: false, rest: 120, tempo: '2-0-1-0' },
          { exercise: 'Leg Curl', sets: 3, reps: 12, weight_kg: null, rpe: 7, is_topset: false, rest: 90, tempo: '2-1-1-0' },
          { exercise: 'Calf Raise', sets: 3, reps: 15, weight_kg: null, rpe: 7, is_topset: false, rest: 60, tempo: '2-1-1-0' },
          { exercise: 'Plank', sets: 3, reps: 1, weight_kg: null, rpe: 7, is_topset: false, rest: 60, tempo: '30s hold' }
        ]
      },
      { // Day 2: Bench focus
        name: 'Bench + Pecho/Hombro',
        exercises: [
          { exercise: 'Bench Press', sets: 4, reps: 8, percent: 67, rpe: 7, is_topset: false, rest: 180, tempo: '3-1-1-0' },
          { exercise: 'Incline Bench Press', sets: 3, reps: 10, percent: 55, rpe: 7, is_topset: false, rest: 120, tempo: '2-1-1-0' },
          { exercise: 'Overhead Press', sets: 3, reps: 10, weight_kg: null, rpe: 7, is_topset: false, rest: 120, tempo: '2-0-1-0' },
          { exercise: 'Lateral Raise', sets: 4, reps: 15, weight_kg: null, rpe: 7, is_topset: false, rest: 60, tempo: '2-1-1-0' },
          { exercise: 'Triceps Pushdown', sets: 3, reps: 12, weight_kg: null, rpe: 7, is_topset: false, rest: 60, tempo: '2-1-1-0' }
        ]
      },
      { // Day 3: Deadlift focus
        name: 'Deadlift + Posterior',
        exercises: [
          { exercise: 'Deadlift', sets: 4, reps: 6, percent: 70, rpe: 7, is_topset: false, rest: 210, tempo: '2-1-1-0' },
          { exercise: 'Romanian Deadlift', sets: 3, reps: 10, percent: 55, rpe: 7, is_topset: false, rest: 150, tempo: '3-0-1-0' },
          { exercise: 'Barbell Row', sets: 4, reps: 10, weight_kg: null, rpe: 7, is_topset: false, rest: 120, tempo: '2-1-1-0' },
          { exercise: 'Face Pull', sets: 3, reps: 15, weight_kg: null, rpe: 7, is_topset: false, rest: 60, tempo: '2-1-1-0' },
          { exercise: 'Barbell Curl', sets: 3, reps: 12, weight_kg: null, rpe: 7, is_topset: false, rest: 60, tempo: '2-1-1-0' }
        ]
      },
      { // Day 4: Upper accessory
        name: 'Upper Accesorios',
        exercises: [
          { exercise: 'Close Grip Bench', sets: 4, reps: 8, percent: 60, rpe: 7, is_topset: false, rest: 150, tempo: '2-1-1-0' },
          { exercise: 'Lat Pulldown', sets: 4, reps: 10, weight_kg: null, rpe: 7, is_topset: false, rest: 90, tempo: '2-1-1-0' },
          { exercise: 'Dumbbell Fly', sets: 3, reps: 12, weight_kg: null, rpe: 7, is_topset: false, rest: 60, tempo: '3-1-1-0' },
          { exercise: 'Cable Row', sets: 3, reps: 12, weight_kg: null, rpe: 7, is_topset: false, rest: 90, tempo: '2-1-1-0' },
          { exercise: 'Lateral Raise', sets: 3, reps: 15, weight_kg: null, rpe: 7, is_topset: false, rest: 60, tempo: '2-1-1-0' },
          { exercise: 'Barbell Curl', sets: 3, reps: 12, weight_kg: null, rpe: 7, is_topset: false, rest: 60, tempo: '2-0-1-0' }
        ]
      },
      { // Day 5: Lower accessory
        name: 'Lower Accesorios + Core',
        exercises: [
          { exercise: 'Paused Squat', sets: 3, reps: 5, percent: 60, rpe: 7, is_topset: false, rest: 150, tempo: '3-2-1-0' },
          { exercise: 'Hip Thrust', sets: 4, reps: 10, weight_kg: null, rpe: 7, is_topset: false, rest: 120, tempo: '2-1-1-0' },
          { exercise: 'Leg Extension', sets: 3, reps: 15, weight_kg: null, rpe: 7, is_topset: false, rest: 60, tempo: '2-1-1-0' },
          { exercise: 'Leg Curl', sets: 3, reps: 12, weight_kg: null, rpe: 7, is_topset: false, rest: 60, tempo: '2-1-1-0' },
          { exercise: 'Calf Raise', sets: 3, reps: 15, weight_kg: null, rpe: 7, is_topset: false, rest: 60, tempo: '2-1-1-0' },
          { exercise: 'Ab Wheel', sets: 3, reps: 12, weight_kg: null, rpe: 7, is_topset: false, rest: 60, tempo: '2-0-1-0' }
        ]
      }
    ]
  },
  // S5-S7: Strength base (5 days/week)
  strength: {
    days_per_week: 5,
    sessions: [
      {
        name: 'Squat Heavy',
        exercises: [
          { exercise: 'Squat', sets: 1, reps: 3, percent: 82, rpe: 8, is_topset: true, rest: 240, tempo: '2-1-1-0' },
          { exercise: 'Squat', sets: 3, reps: 5, percent: 72, rpe: 7, is_topset: false, rest: 180, tempo: '2-1-1-0' },
          { exercise: 'Leg Press', sets: 3, reps: 8, weight_kg: null, rpe: 7, is_topset: false, rest: 120, tempo: '2-0-1-0' },
          { exercise: 'Leg Curl', sets: 3, reps: 10, weight_kg: null, rpe: 7, is_topset: false, rest: 90, tempo: '2-1-1-0' },
          { exercise: 'Plank', sets: 3, reps: 1, weight_kg: null, rpe: 7, is_topset: false, rest: 60, tempo: '45s hold' }
        ]
      },
      {
        name: 'Bench Heavy',
        exercises: [
          { exercise: 'Bench Press', sets: 1, reps: 3, percent: 82, rpe: 8, is_topset: true, rest: 240, tempo: '2-1-1-0' },
          { exercise: 'Bench Press', sets: 3, reps: 5, percent: 72, rpe: 7, is_topset: false, rest: 180, tempo: '2-1-1-0' },
          { exercise: 'Overhead Press', sets: 3, reps: 8, weight_kg: null, rpe: 7, is_topset: false, rest: 120, tempo: '2-0-1-0' },
          { exercise: 'Lat Pulldown', sets: 4, reps: 10, weight_kg: null, rpe: 7, is_topset: false, rest: 90, tempo: '2-1-1-0' },
          { exercise: 'Triceps Pushdown', sets: 3, reps: 12, weight_kg: null, rpe: 7, is_topset: false, rest: 60, tempo: '2-1-1-0' }
        ]
      },
      {
        name: 'Deadlift Heavy',
        exercises: [
          { exercise: 'Deadlift', sets: 1, reps: 3, percent: 82, rpe: 8, is_topset: true, rest: 300, tempo: '1-0-1-0' },
          { exercise: 'Deadlift', sets: 3, reps: 4, percent: 72, rpe: 7, is_topset: false, rest: 210, tempo: '1-0-1-0' },
          { exercise: 'Barbell Row', sets: 4, reps: 8, weight_kg: null, rpe: 7, is_topset: false, rest: 120, tempo: '2-1-1-0' },
          { exercise: 'Face Pull', sets: 3, reps: 15, weight_kg: null, rpe: 7, is_topset: false, rest: 60, tempo: '2-1-1-0' },
          { exercise: 'Barbell Curl', sets: 3, reps: 10, weight_kg: null, rpe: 7, is_topset: false, rest: 60, tempo: '2-0-1-0' }
        ]
      },
      {
        name: 'Bench Volume',
        exercises: [
          { exercise: 'Close Grip Bench', sets: 4, reps: 6, percent: 70, rpe: 7, is_topset: false, rest: 150, tempo: '2-1-1-0' },
          { exercise: 'Incline Bench Press', sets: 3, reps: 8, percent: 60, rpe: 7, is_topset: false, rest: 120, tempo: '2-1-1-0' },
          { exercise: 'Cable Row', sets: 4, reps: 10, weight_kg: null, rpe: 7, is_topset: false, rest: 90, tempo: '2-1-1-0' },
          { exercise: 'Lateral Raise', sets: 4, reps: 12, weight_kg: null, rpe: 7, is_topset: false, rest: 60, tempo: '2-1-1-0' },
          { exercise: 'Triceps Pushdown', sets: 3, reps: 12, weight_kg: null, rpe: 7, is_topset: false, rest: 60, tempo: '2-0-1-0' }
        ]
      },
      {
        name: 'Squat Volume + Posterior',
        exercises: [
          { exercise: 'Paused Squat', sets: 4, reps: 4, percent: 70, rpe: 7, is_topset: false, rest: 180, tempo: '3-2-1-0' },
          { exercise: 'Romanian Deadlift', sets: 3, reps: 8, percent: 60, rpe: 7, is_topset: false, rest: 150, tempo: '3-0-1-0' },
          { exercise: 'Hip Thrust', sets: 3, reps: 10, weight_kg: null, rpe: 7, is_topset: false, rest: 120, tempo: '2-1-1-0' },
          { exercise: 'Leg Extension', sets: 3, reps: 12, weight_kg: null, rpe: 7, is_topset: false, rest: 60, tempo: '2-1-1-0' },
          { exercise: 'Calf Raise', sets: 3, reps: 15, weight_kg: null, rpe: 7, is_topset: false, rest: 60, tempo: '2-1-1-0' }
        ]
      }
    ]
  },
  // S8-S9: Specific / Peaking (4-5 days)
  specific: {
    days_per_week: 4,
    sessions: [
      {
        name: 'Squat Específico',
        exercises: [
          { exercise: 'Squat', sets: 1, reps: 2, percent: 87, rpe: 8.5, is_topset: true, rest: 300, tempo: '2-1-1-0' },
          { exercise: 'Squat', sets: 3, reps: 3, percent: 77, rpe: 7, is_topset: false, rest: 210, tempo: '2-1-1-0' },
          { exercise: 'Leg Press', sets: 2, reps: 8, weight_kg: null, rpe: 7, is_topset: false, rest: 120, tempo: '2-0-1-0' },
          { exercise: 'Plank', sets: 2, reps: 1, weight_kg: null, rpe: 7, is_topset: false, rest: 60, tempo: '45s hold' }
        ]
      },
      {
        name: 'Bench Específico',
        exercises: [
          { exercise: 'Bench Press', sets: 1, reps: 2, percent: 87, rpe: 8.5, is_topset: true, rest: 300, tempo: '2-1-1-0' },
          { exercise: 'Bench Press', sets: 3, reps: 3, percent: 77, rpe: 7, is_topset: false, rest: 210, tempo: '2-1-1-0' },
          { exercise: 'Close Grip Bench', sets: 2, reps: 6, percent: 65, rpe: 7, is_topset: false, rest: 120, tempo: '2-1-1-0' },
          { exercise: 'Lat Pulldown', sets: 3, reps: 10, weight_kg: null, rpe: 7, is_topset: false, rest: 90, tempo: '2-1-1-0' }
        ]
      },
      {
        name: 'Deadlift Específico',
        exercises: [
          { exercise: 'Deadlift', sets: 1, reps: 2, percent: 87, rpe: 8.5, is_topset: true, rest: 300, tempo: '1-0-1-0' },
          { exercise: 'Deadlift', sets: 3, reps: 3, percent: 77, rpe: 7, is_topset: false, rest: 240, tempo: '1-0-1-0' },
          { exercise: 'Barbell Row', sets: 3, reps: 8, weight_kg: null, rpe: 7, is_topset: false, rest: 120, tempo: '2-1-1-0' },
          { exercise: 'Face Pull', sets: 3, reps: 12, weight_kg: null, rpe: 7, is_topset: false, rest: 60, tempo: '2-1-1-0' }
        ]
      },
      {
        name: 'Volumen Ligero (Accesorios)',
        exercises: [
          { exercise: 'Paused Squat', sets: 3, reps: 3, percent: 65, rpe: 6, is_topset: false, rest: 150, tempo: '3-2-1-0' },
          { exercise: 'Paused Bench', sets: 3, reps: 3, percent: 65, rpe: 6, is_topset: false, rest: 150, tempo: '3-2-1-0' },
          { exercise: 'Romanian Deadlift', sets: 3, reps: 6, percent: 55, rpe: 6, is_topset: false, rest: 120, tempo: '3-0-1-0' },
          { exercise: 'Lateral Raise', sets: 3, reps: 12, weight_kg: null, rpe: 6, is_topset: false, rest: 60, tempo: '2-1-1-0' },
          { exercise: 'Barbell Curl', sets: 2, reps: 12, weight_kg: null, rpe: 6, is_topset: false, rest: 60, tempo: '2-0-1-0' }
        ]
      }
    ]
  },
  // S10: Taper (3 days/week)
  taper: {
    days_per_week: 3,
    sessions: [
      {
        name: 'Squat Opener',
        exercises: [
          { exercise: 'Squat', sets: 1, reps: 1, percent: 90, rpe: 8, is_topset: true, rest: 300, tempo: 'comp' },
          { exercise: 'Squat', sets: 2, reps: 2, percent: 80, rpe: 6, is_topset: false, rest: 210, tempo: 'comp' },
          { exercise: 'Plank', sets: 2, reps: 1, weight_kg: null, rpe: 5, is_topset: false, rest: 60, tempo: '30s hold' }
        ]
      },
      {
        name: 'Bench Opener',
        exercises: [
          { exercise: 'Bench Press', sets: 1, reps: 1, percent: 90, rpe: 8, is_topset: true, rest: 300, tempo: 'comp' },
          { exercise: 'Bench Press', sets: 2, reps: 2, percent: 80, rpe: 6, is_topset: false, rest: 210, tempo: 'comp' },
          { exercise: 'Face Pull', sets: 2, reps: 12, weight_kg: null, rpe: 5, is_topset: false, rest: 60, tempo: '2-1-1-0' }
        ]
      },
      {
        name: 'Deadlift Opener',
        exercises: [
          { exercise: 'Deadlift', sets: 1, reps: 1, percent: 90, rpe: 8, is_topset: true, rest: 300, tempo: 'comp' },
          { exercise: 'Deadlift', sets: 2, reps: 2, percent: 80, rpe: 6, is_topset: false, rest: 240, tempo: 'comp' }
        ]
      }
    ]
  }
};

// Get the lift name mapped to 1RM key
export function getLiftKey(exerciseName) {
  const map = {
    'Squat': 'squat', 'Paused Squat': 'squat', 'Front Squat': 'squat', 'Goblet Squat': 'squat',
    'Bench Press': 'bench', 'Close Grip Bench': 'bench', 'Paused Bench': 'bench', 'Incline Bench Press': 'bench',
    'Deadlift': 'deadlift', 'Deficit Deadlift': 'deadlift', 'Romanian Deadlift': 'deadlift', 'Paused Deadlift': 'deadlift'
  };
  return map[exerciseName] || null;
}

// Build exercises for a session with actual weights
export function buildSessionExercises(template, oneRMs, increment = 1.25, mode = 'nearest') {
  return template.exercises.map(ex => {
    const liftKey = getLiftKey(ex.exercise);
    let raw = null, rounded = null;
    if (ex.percent && liftKey && oneRMs[liftKey]) {
      const result = calcWeight(ex.percent, oneRMs[liftKey].value_kg, increment, mode);
      raw = result.raw;
      rounded = result.rounded;
    }
    return {
      ...ex,
      weight_raw: raw,
      weight_rounded: rounded,
      lift_key: liftKey
    };
  });
}

// Calculate volume per muscle for a set of exercises
export function calculateVolumePerMuscle(sessions) {
  const volume = {};
  for (const session of sessions) {
    const exercises = session.exercises || [];
    for (const ex of exercises) {
      const exDef = EXERCISE_LIBRARY.find(e => e.name === ex.exercise);
      if (!exDef) continue;
      for (const mg of exDef.muscle_groups) {
        volume[mg] = (volume[mg] || 0) + (ex.sets || 0);
      }
    }
  }
  return volume;
}
