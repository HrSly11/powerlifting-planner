// schema.js - Database schema definitions
export const DB_NAME = 'HarryPowerliftingDB';
export const DB_VERSION = 1;

export const STORES = {
  users: '++id, name',
  one_rms: '++id, lift, date, value_kg, reason',
  planned_sessions: '++id, date, phase, week_index, completed, updated_from_1RM_change',
  logged_sessions: '++id, planned_session_id, date, created_at',
  exercises: '++id, name, category, muscle_groups',
  settings: 'key',
  competition: '++id, original_date, current_date',
  history: '++id, type, date, data'
};

export const SEED_DATA = {
  meta: { version: "1.0", exported_at: new Date().toISOString(), user: "Harry" },
  user: { id: "u_harry", name: "Harry", created_at: "2026-02-10T00:00:00Z" },
  one_rms: [
    { lift: "bench", value_kg: 105, date: "2026-02-10T00:00:00Z", reason: "seed" },
    { lift: "squat", value_kg: 95, date: "2026-02-10T00:00:00Z", reason: "seed" },
    { lift: "deadlift", value_kg: 140, date: "2026-02-10T00:00:00Z", reason: "seed" }
  ],
  settings: {
    plate_increment_kg: 1.25,
    rounding_mode: "nearest",
    timezone: "America/Lima",
    last_backup: null,
    backup_warning_days: 7
  },
  competition: {
    original_date: "2027-03-20",
    current_date: "2027-03-20",
    history: []
  }
};

// Exercise library
export const EXERCISE_LIBRARY = [
  // Main lifts
  { name: "Squat", category: "main", muscle_groups: ["quads", "glutes", "lower_back"], warmup_type: "squat" },
  { name: "Bench Press", category: "main", muscle_groups: ["chest", "front_delts", "triceps"], warmup_type: "bench" },
  { name: "Deadlift", category: "main", muscle_groups: ["hamstrings", "glutes", "lower_back", "traps"], warmup_type: "deadlift" },
  // Squat variations
  { name: "Paused Squat", category: "variation", muscle_groups: ["quads", "glutes"], warmup_type: "squat" },
  { name: "Front Squat", category: "variation", muscle_groups: ["quads", "core"], warmup_type: "squat" },
  { name: "Goblet Squat", category: "accessory", muscle_groups: ["quads", "glutes"], warmup_type: null },
  // Bench variations
  { name: "Close Grip Bench", category: "variation", muscle_groups: ["triceps", "chest"], warmup_type: "bench" },
  { name: "Paused Bench", category: "variation", muscle_groups: ["chest", "front_delts"], warmup_type: "bench" },
  { name: "Incline Bench Press", category: "variation", muscle_groups: ["chest", "front_delts"], warmup_type: "bench" },
  // Deadlift variations
  { name: "Deficit Deadlift", category: "variation", muscle_groups: ["hamstrings", "glutes", "lower_back"], warmup_type: "deadlift" },
  { name: "Romanian Deadlift", category: "variation", muscle_groups: ["hamstrings", "glutes"], warmup_type: "deadlift" },
  { name: "Paused Deadlift", category: "variation", muscle_groups: ["hamstrings", "lower_back"], warmup_type: "deadlift" },
  // Accessories
  { name: "Barbell Row", category: "accessory", muscle_groups: ["lats", "upper_back", "biceps"], warmup_type: null },
  { name: "Lat Pulldown", category: "accessory", muscle_groups: ["lats", "biceps"], warmup_type: null },
  { name: "Overhead Press", category: "accessory", muscle_groups: ["front_delts", "triceps"], warmup_type: null },
  { name: "Lateral Raise", category: "accessory", muscle_groups: ["side_delts"], warmup_type: null },
  { name: "Face Pull", category: "accessory", muscle_groups: ["rear_delts", "upper_back"], warmup_type: null },
  { name: "Triceps Pushdown", category: "accessory", muscle_groups: ["triceps"], warmup_type: null },
  { name: "Barbell Curl", category: "accessory", muscle_groups: ["biceps"], warmup_type: null },
  { name: "Leg Press", category: "accessory", muscle_groups: ["quads", "glutes"], warmup_type: null },
  { name: "Leg Curl", category: "accessory", muscle_groups: ["hamstrings"], warmup_type: null },
  { name: "Leg Extension", category: "accessory", muscle_groups: ["quads"], warmup_type: null },
  { name: "Calf Raise", category: "accessory", muscle_groups: ["calves"], warmup_type: null },
  { name: "Plank", category: "accessory", muscle_groups: ["core"], warmup_type: null },
  { name: "Ab Wheel", category: "accessory", muscle_groups: ["core"], warmup_type: null },
  { name: "Hip Thrust", category: "accessory", muscle_groups: ["glutes"], warmup_type: null },
  { name: "Dumbbell Fly", category: "accessory", muscle_groups: ["chest"], warmup_type: null },
  { name: "Cable Row", category: "accessory", muscle_groups: ["lats", "upper_back"], warmup_type: null }
];

// Volume targets per muscle per phase (sets per week) S1-S10
export const VOLUME_TARGETS = {
  // S1-S4: Hypertrophy
  hypertrophy: {
    chest: { min: 12, max: 16, optimal: 14 },
    lats: { min: 12, max: 16, optimal: 14 },
    quads: { min: 12, max: 18, optimal: 15 },
    hamstrings: { min: 10, max: 14, optimal: 12 },
    glutes: { min: 8, max: 12, optimal: 10 },
    front_delts: { min: 8, max: 12, optimal: 10 },
    side_delts: { min: 12, max: 16, optimal: 14 },
    rear_delts: { min: 10, max: 14, optimal: 12 },
    triceps: { min: 10, max: 14, optimal: 12 },
    biceps: { min: 10, max: 14, optimal: 12 },
    upper_back: { min: 10, max: 14, optimal: 12 },
    lower_back: { min: 6, max: 10, optimal: 8 },
    core: { min: 6, max: 10, optimal: 8 },
    calves: { min: 8, max: 12, optimal: 10 },
    traps: { min: 6, max: 10, optimal: 8 }
  },
  // S5-S7: Strength base
  strength: {
    chest: { min: 8, max: 12, optimal: 10 },
    lats: { min: 8, max: 12, optimal: 10 },
    quads: { min: 8, max: 14, optimal: 11 },
    hamstrings: { min: 8, max: 12, optimal: 10 },
    glutes: { min: 6, max: 10, optimal: 8 },
    front_delts: { min: 6, max: 10, optimal: 8 },
    side_delts: { min: 8, max: 12, optimal: 10 },
    rear_delts: { min: 8, max: 12, optimal: 10 },
    triceps: { min: 8, max: 12, optimal: 10 },
    biceps: { min: 6, max: 10, optimal: 8 },
    upper_back: { min: 8, max: 12, optimal: 10 },
    lower_back: { min: 6, max: 10, optimal: 8 },
    core: { min: 4, max: 8, optimal: 6 },
    calves: { min: 6, max: 10, optimal: 8 },
    traps: { min: 4, max: 8, optimal: 6 }
  },
  // S8-S9: Specific/Peaking
  specific: {
    chest: { min: 6, max: 10, optimal: 8 },
    lats: { min: 6, max: 10, optimal: 8 },
    quads: { min: 6, max: 12, optimal: 9 },
    hamstrings: { min: 6, max: 10, optimal: 8 },
    glutes: { min: 4, max: 8, optimal: 6 },
    front_delts: { min: 4, max: 8, optimal: 6 },
    side_delts: { min: 6, max: 10, optimal: 8 },
    rear_delts: { min: 6, max: 10, optimal: 8 },
    triceps: { min: 6, max: 10, optimal: 8 },
    biceps: { min: 4, max: 8, optimal: 6 },
    upper_back: { min: 6, max: 10, optimal: 8 },
    lower_back: { min: 4, max: 8, optimal: 6 },
    core: { min: 3, max: 6, optimal: 4 },
    calves: { min: 4, max: 8, optimal: 6 },
    traps: { min: 3, max: 6, optimal: 4 }
  },
  // S10: Taper
  taper: {
    chest: { min: 4, max: 6, optimal: 5 },
    lats: { min: 4, max: 6, optimal: 5 },
    quads: { min: 4, max: 8, optimal: 6 },
    hamstrings: { min: 4, max: 6, optimal: 5 },
    glutes: { min: 2, max: 4, optimal: 3 },
    front_delts: { min: 2, max: 4, optimal: 3 },
    side_delts: { min: 4, max: 6, optimal: 5 },
    rear_delts: { min: 4, max: 6, optimal: 5 },
    triceps: { min: 4, max: 6, optimal: 5 },
    biceps: { min: 2, max: 4, optimal: 3 },
    upper_back: { min: 4, max: 6, optimal: 5 },
    lower_back: { min: 2, max: 4, optimal: 3 },
    core: { min: 2, max: 4, optimal: 3 },
    calves: { min: 2, max: 4, optimal: 3 },
    traps: { min: 2, max: 4, optimal: 3 }
  }
};
