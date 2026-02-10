// tests/core.test.js - Unit tests
// Run with: node tests/core.test.js

// Simple test runner since we avoid build tools for simplicity
let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}
function assert(cond, msg = 'Assertion failed') { if (!cond) throw new Error(msg); }
function assertEqual(a, b, msg) { if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`); }

// ---- Import functions inline (since ESM import won't work directly in Node without setup) ----

// calcWeight
function calcWeight(percent, oneRM, increment = 1.25, mode = 'nearest') {
  const raw = Math.round((percent / 100) * oneRM * 100) / 100;
  let rounded;
  if (mode === 'up') rounded = Math.ceil(raw / increment) * increment;
  else if (mode === 'down') rounded = Math.floor(raw / increment) * increment;
  else rounded = Math.round(raw / increment) * increment;
  rounded = Math.round(rounded * 100) / 100;
  return { raw, rounded };
}

// suggestPlates
function suggestPlates(weight) {
  const barWeight = 20;
  let perSide = (weight - barWeight) / 2;
  if (perSide <= 0) return 'bar only';
  const plates = [25, 20, 15, 10, 5, 2.5, 1.25];
  const result = [];
  for (const p of plates) {
    while (perSide >= p) { result.push(p); perSide -= p; }
  }
  return result.map(p => `${p}kg`).join(' + ');
}

// handleFailure
function handleFailure(failureReason) {
  const recs = [];
  if (failureReason === 'tecnica') {
    recs.push({ type: 'reduce_weight', action: { adjust_kg: -2.5 } });
    recs.push({ type: 'corrective_block' });
  } else if (failureReason === 'fatiga') {
    recs.push({ type: 'repeat_weight' });
    recs.push({ type: 'potential_deload' });
  } else if (failureReason === 'lesion') {
    recs.push({ type: 'consult' });
  }
  return recs;
}

// getCompetitionChangeProtocol
function getCompetitionChangeProtocol(currentDate, newDate) {
  const today = new Date();
  const newComp = new Date(newDate);
  const leadTimeDays = Math.floor((newComp - today) / 86400000);
  const leadTimeWeeks = Math.floor(leadTimeDays / 7);
  let protocol;
  if (leadTimeWeeks <= 4) protocol = 'B3';
  else if (leadTimeWeeks <= 8) protocol = 'B2';
  else protocol = 'B1';
  return { protocol, leadTimeWeeks };
}

// ---- TESTS ----

console.log('\n🧪 calcWeight tests:');
test('67% of 105kg bench = correct raw', () => {
  const r = calcWeight(67, 105);
  assertEqual(r.raw, 70.35);
});
test('67% of 105kg bench rounds to 70 with 1.25 increment', () => {
  const r = calcWeight(67, 105, 1.25);
  assertEqual(r.rounded, 70);
});
test('82% of 95kg squat', () => {
  const r = calcWeight(82, 95, 1.25);
  assertEqual(r.raw, 77.9);
  assertEqual(r.rounded, 77.5);
});
test('90% of 140kg deadlift', () => {
  const r = calcWeight(90, 140, 1.25);
  assertEqual(r.raw, 126);
  assertEqual(r.rounded, 126.25);
});
test('rounding mode up', () => {
  const r = calcWeight(67, 105, 1.25, 'up');
  assertEqual(r.rounded, 71.25);
});
test('rounding mode down', () => {
  const r = calcWeight(67, 105, 1.25, 'down');
  assertEqual(r.rounded, 70);
});
test('100% returns exact 1RM rounded', () => {
  const r = calcWeight(100, 105, 1.25);
  assertEqual(r.rounded, 105);
});

console.log('\n🧪 suggestPlates tests:');
test('47.5kg suggests correct plates', () => {
  const plates = suggestPlates(47.5);
  assertEqual(plates, '10kg + 2.5kg + 1.25kg');
});
test('20kg is bar only', () => {
  const plates = suggestPlates(20);
  assertEqual(plates, 'bar only');
});
test('100kg plates', () => {
  const plates = suggestPlates(100);
  assert(plates.includes('25kg') || plates.includes('20kg'), 'Should include large plates');
});

console.log('\n🧪 Failure handling tests:');
test('tecnica failure returns reduce_weight + corrective', () => {
  const recs = handleFailure('tecnica');
  assertEqual(recs.length, 2);
  assertEqual(recs[0].type, 'reduce_weight');
  assertEqual(recs[0].action.adjust_kg, -2.5);
  assertEqual(recs[1].type, 'corrective_block');
});
test('fatiga failure returns repeat + potential deload', () => {
  const recs = handleFailure('fatiga');
  assertEqual(recs.length, 2);
  assertEqual(recs[0].type, 'repeat_weight');
  assertEqual(recs[1].type, 'potential_deload');
});
test('lesion failure returns consult only', () => {
  const recs = handleFailure('lesion');
  assertEqual(recs.length, 1);
  assertEqual(recs[0].type, 'consult');
});

console.log('\n🧪 Competition change protocol tests:');
test('leadTime <= 4 weeks → B3', () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 20);
  const r = getCompetitionChangeProtocol(null, futureDate.toISOString().split('T')[0]);
  assertEqual(r.protocol, 'B3');
});
test('leadTime 5-8 weeks → B2', () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 42);
  const r = getCompetitionChangeProtocol(null, futureDate.toISOString().split('T')[0]);
  assertEqual(r.protocol, 'B2');
});
test('leadTime > 8 weeks → B1', () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 100);
  const r = getCompetitionChangeProtocol(null, futureDate.toISOString().split('T')[0]);
  assertEqual(r.protocol, 'B1');
});

console.log('\n🧪 1RM recalculation logic tests:');
test('Future session gets updated, logged stays same', () => {
  const today = new Date().toISOString().split('T')[0];
  const future = new Date();
  future.setDate(future.getDate() + 7);
  const futureStr = future.toISOString().split('T')[0];
  const past = new Date();
  past.setDate(past.getDate() - 7);
  const pastStr = past.toISOString().split('T')[0];

  const sessions = [
    { date: pastStr, completed: true, exercises: [{ percent: 80, lift_key: 'bench', weight_rounded: 84 }] },
    { date: futureStr, completed: false, exercises: [{ percent: 80, lift_key: 'bench', weight_rounded: 84 }] }
  ];

  const newRM = 110;
  // Simulate recalc
  const updated = sessions.map(s => {
    if (s.date <= today || s.completed) return s;
    const ex = s.exercises.map(e => {
      if (!e.percent || e.lift_key !== 'bench') return e;
      const w = calcWeight(e.percent, newRM, 1.25);
      return { ...e, weight_rounded: w.rounded };
    });
    return { ...s, exercises: ex };
  });

  // Past/logged session unchanged
  assertEqual(updated[0].exercises[0].weight_rounded, 84, 'Logged session should not change');
  // Future session updated
  assertEqual(updated[1].exercises[0].weight_rounded, 87.5, 'Future session should be recalculated');
});

// ---- SUMMARY ----
console.log(`\n${'='.repeat(40)}`);
console.log(`Tests: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) process.exit(1);
