// app.js - Main application controller
import { initDB, getDB, getLatest1RMs, getSetting, setSetting, getAll, add, update, getCompetition } from './db/dexie-wrapper.js';
import { getDefaultMacrocycle, generatePlannedSessions, handleFailure, checkRPETrend } from './modules/planner.js';
import { calcWeight, suggestPlates, generateWarmup, SESSION_TEMPLATES, getLiftKey, calculateVolumePerMuscle } from './modules/workoutBuilder.js';
import { FAILURE_REASONS, logSession, getPendingSessions, getLoggedSessions, calculateCompliance, createExerciseLog } from './modules/logger.js';
import { update1RM, preview1RMChange, get1RMHistory } from './modules/rmManager.js';
import { changeCompetitionDate, applyCompetitionChange } from './modules/competition.js';
import { getWeeklyVolume, getLiftProgress, get1RMTimeline, getComplianceSummary, generateBackupData } from './modules/analytics.js';
import { exportBackup, checkBackupWarning } from './backup/export.js';
import { validateBackupSchema, computeDiff, importBackup } from './backup/import.js';
import { VOLUME_TARGETS } from './db/schema.js';
import { formatDate, formatDateShort, phaseLabel, phaseColor, rpeColor, complianceColor, createEl, showToast, showConfirm, groupSessionsByWeek, getWeekRange } from './modules/uiHelpers.js';

let currentView = 'dashboard';

// ---- INIT ----
async function init() {
  await initDB();
  setupNav();
  await checkAndWarnBackup();
  await renderView('dashboard');
}

function setupNav() {
  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.preventDefault();
      document.querySelectorAll('[data-view]').forEach(n => n.classList.remove('active'));
      el.classList.add('active');
      currentView = el.dataset.view;
      await renderView(currentView);
    });
  });
}

async function checkAndWarnBackup() {
  const needsBackup = await checkBackupWarning();
  if (needsBackup) {
    showToast('⚠️ No has exportado un backup recientemente. Ve a Backup para guardar tus datos.', 'warning');
  }
}

// ---- ROUTER ----
async function renderView(view) {
  const main = document.getElementById('main-content');
  main.innerHTML = '<p style="padding:20px;color:#888;">Cargando...</p>';
  try {
    switch (view) {
      case 'dashboard': await renderDashboard(main); break;
      case 'planner': await renderPlanner(main); break;
      case 'logger': await renderLogger(main); break;
      case 'rm': await renderRMManager(main); break;
      case 'analytics': await renderAnalytics(main); break;
      case 'competition': await renderCompetition(main); break;
      case 'backup': await renderBackup(main); break;
      default: main.innerHTML = '<p>Vista no encontrada</p>';
    }
  } catch (err) {
    main.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
    console.error(err);
  }
}

// ---- DASHBOARD ----
async function renderDashboard(container) {
  const oneRMs = await getLatest1RMs();
  const comp = await getCompetition();
  const pending = await getPendingSessions(3, 7);
  const compliance = await getComplianceSummary(2);

  // Weekly volume
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (now.getDay() || 7) + 1);
  const weekStr = monday.toISOString().split('T')[0];
  let volume = [];
  try { volume = await getWeeklyVolume(weekStr); } catch (e) {}

  const chestVol = volume.find(v => v.muscle === 'chest');
  const greeting = createEl('div', { className: 'card' }, [
    createEl('h2', { textContent: `Hola Harry 👋` }),
    createEl('p', { textContent: chestVol
      ? `Esta semana: Volumen planeado de Pecho: ${chestVol.planned} sets (objetivo S3–S4: ${chestVol.target_min}–${chestVol.target_max}).`
      : 'Genera un macrociclo para ver tu planificación semanal.' }),
  ]);

  const rmCard = createEl('div', { className: 'card' }, [
    createEl('h3', { textContent: '1RMs Actuales' }),
    createEl('div', { className: 'rm-grid' }, [
      rmBox('Bench', oneRMs.bench?.value_kg),
      rmBox('Squat', oneRMs.squat?.value_kg),
      rmBox('Deadlift', oneRMs.deadlift?.value_kg)
    ])
  ]);

  const compCard = createEl('div', { className: 'card' }, [
    createEl('h3', { textContent: '🏆 Competición' }),
    createEl('p', { textContent: comp ? `Fecha: ${formatDate(comp.current_date)} — Faltan ${Math.max(0, Math.floor((new Date(comp.current_date) - new Date()) / 86400000))} días` : 'No configurada' })
  ]);

  const pendingCard = createEl('div', { className: 'card' }, [
    createEl('h3', { textContent: '📋 Próximas Sesiones' }),
    ...(pending.length > 0
      ? pending.slice(0, 5).map(s => createEl('div', { className: 'session-mini', innerHTML: `<strong>${formatDate(s.date)}</strong> — ${s.name} <span class="badge" style="background:${phaseColor(s.phase)}">${phaseLabel(s.phase)}</span>` }))
      : [createEl('p', { textContent: 'No hay sesiones planificadas próximas. Usa el Planner para generar.', className: 'hint' })]
    )
  ]);

  const complianceCard = createEl('div', { className: 'card' }, [
    createEl('h3', { textContent: '📊 Compliance Reciente' }),
    ...(compliance.map(c => createEl('div', { className: 'compliance-row', innerHTML: `Semana ${formatDateShort(c.week_start)}: <strong style="color:${complianceColor(c.compliance)}">${c.compliance}%</strong> (${c.logged_sets}/${c.planned_sets} sets)` })))
  ]);

  container.innerHTML = '';
  container.appendChild(greeting);
  const grid = createEl('div', { className: 'grid-2' }, [rmCard, compCard]);
  container.appendChild(grid);
  container.appendChild(pendingCard);
  container.appendChild(complianceCard);
}

function rmBox(label, value) {
  return createEl('div', { className: 'rm-box', innerHTML: `<span class="rm-label">${label}</span><span class="rm-value">${value || '—'} kg</span>` });
}

// ---- PLANNER ----
async function renderPlanner(container) {
  const db = getDB();
  const oneRMs = await getLatest1RMs();
  const comp = await getCompetition();
  const existingSessions = await db.planned_sessions.count();

  container.innerHTML = '';

  // Macrocycle controls
  const controls = createEl('div', { className: 'card' }, [
    createEl('h2', { textContent: '📅 Macrociclo Planner' }),
    createEl('div', { className: 'form-row' }, [
      createEl('label', { textContent: 'Inicio:', 'for': 'macro-start' }),
      createEl('input', { type: 'date', id: 'macro-start', value: '2026-04-01' }),
      createEl('label', { textContent: 'Competición:', 'for': 'macro-comp' }),
      createEl('input', { type: 'date', id: 'macro-comp', value: comp?.current_date || '2027-03-20' }),
      createEl('button', { className: 'btn btn-primary', textContent: existingSessions > 0 ? '♻️ Regenerar Macrociclo' : '⚡ Generar Macrociclo', onClick: onGenerateMacrocycle }),
    ])
  ]);
  container.appendChild(controls);

  // Timeline preview
  if (existingSessions > 0) {
    container.appendChild(createEl('p', { className: 'hint', textContent: `${existingSessions} sesiones planificadas. Regenerar eliminará las no completadas.` }));
  }

  // Show existing planned sessions
  const sessions = await db.planned_sessions.orderBy('date').toArray();
  if (sessions.length > 0) {
    const weeks = groupSessionsByWeek(sessions);
    const weekContainer = createEl('div', { id: 'weeks-container' });

    for (let i = 0; i < weeks.length; i++) {
      const wk = weeks[i];
      const weekEl = createEl('div', { className: 'week-block' }, [
        createEl('div', { className: 'week-header', innerHTML: `<strong>Semana ${i + 1}</strong> (${formatDate(wk.start)} — ${formatDate(wk.sessions[wk.sessions.length - 1]?.date || wk.start)}) <span class="badge" style="background:${phaseColor(wk.sessions[0]?.phase)}">${phaseLabel(wk.sessions[0]?.phase)}</span> ${wk.sessions[0]?.is_deload ? '<span class="badge deload">DELOAD</span>' : ''}` })
      ]);

      for (const session of wk.sessions) {
        const sEl = createSessionCard(session);
        weekEl.appendChild(sEl);
      }
      weekContainer.appendChild(weekEl);
    }
    container.appendChild(weekContainer);
  }
}

function createSessionCard(session) {
  const card = createEl('div', {
    className: `session-card ${session.completed ? 'completed' : ''} ${session.updated_from_1RM_change ? 'updated-1rm' : ''}`,
    style: { borderLeft: `4px solid ${phaseColor(session.phase)}` }
  });

  const header = createEl('div', { className: 'session-header', innerHTML: `
    <strong>${formatDate(session.date)}</strong> — ${session.name}
    ${session.completed ? '<span class="badge completed">✓ Completada</span>' : ''}
    ${session.updated_from_1RM_change ? '<span class="badge updated">✎ 1RM actualizado</span>' : ''}
  `});
  card.appendChild(header);

  // Exercise table
  const table = createEl('table', { className: 'exercise-table' });
  table.innerHTML = `<thead><tr>
    <th>Ejercicio</th><th>Sets</th><th>Reps</th><th>%1RM</th><th>Raw kg</th><th>Rounded kg</th><th>RPE obj</th><th>Descanso</th><th>Tempo</th><th>Topset</th>
  </tr></thead>`;
  const tbody = createEl('tbody');

  for (const ex of (session.exercises || [])) {
    const tr = createEl('tr', { className: ex.is_topset ? 'topset-row' : '' });
    tr.innerHTML = `
      <td>${ex.exercise}</td>
      <td>${ex.sets}</td>
      <td>${ex.reps}</td>
      <td>${ex.percent || '—'}</td>
      <td>${ex.weight_raw != null ? ex.weight_raw.toFixed(1) : '—'}</td>
      <td><strong>${ex.weight_rounded != null ? ex.weight_rounded.toFixed(1) : '—'}</strong></td>
      <td><span style="color:${rpeColor(ex.rpe)}">${ex.rpe || '—'}</span></td>
      <td>${ex.rest || '—'}s</td>
      <td>${ex.tempo || '—'}</td>
      <td>${ex.is_topset ? '⭐' : ''}</td>
    `;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  card.appendChild(table);

  // Notes
  const notesDiv = createEl('div', { className: 'session-notes' }, [
    createEl('input', {
      type: 'text', placeholder: 'Añadir anotaciones...', value: session.notes || '',
      className: 'note-input',
      onChange: async (e) => {
        await update('planned_sessions', session.id, { notes: e.target.value });
        card.classList.add('saved');
        showToast('Nota guardada', 'success');
      }
    })
  ]);
  card.appendChild(notesDiv);

  // Warmup toggle
  const warmupBtn = createEl('button', { className: 'btn btn-sm', textContent: '🔥 Ver Calentamiento', onClick: () => toggleWarmup(card, session) });
  card.appendChild(warmupBtn);

  return card;
}

function toggleWarmup(card, session) {
  let existing = card.querySelector('.warmup-section');
  if (existing) { existing.remove(); return; }

  const section = createEl('div', { className: 'warmup-section' });
  const mainLifts = (session.exercises || []).filter(e => getLiftKey(e.exercise));

  for (const ex of mainLifts) {
    const workingWeight = ex.weight_rounded || 0;
    const warmups = generateWarmup(ex.exercise, workingWeight, session.phase);
    section.appendChild(createEl('h4', { textContent: `Calentamiento: ${ex.exercise}` }));

    for (const w of warmups) {
      if (w.type === 'note') {
        section.appendChild(createEl('p', { className: 'warmup-note', textContent: w.note }));
      } else {
        section.appendChild(createEl('p', { textContent: `${w.sets}×${w.reps} @ ${w.percent}% (${w.weight_rounded?.toFixed(1) || '—'} kg)` }));
      }
    }
  }
  card.appendChild(section);
}

async function onGenerateMacrocycle() {
  const startDate = document.getElementById('macro-start').value;
  const compDate = document.getElementById('macro-comp').value;
  if (!startDate || !compDate) { showToast('Selecciona fechas', 'warning'); return; }

  const db = getDB();
  const existing = await db.planned_sessions.count();
  if (existing > 0) {
    const ok = await showConfirm(`Ya hay ${existing} sesiones planificadas. ¿Regenerar eliminará las no completadas?`);
    if (!ok) return;
    // Delete non-completed
    const all = await db.planned_sessions.toArray();
    const toDelete = all.filter(s => !s.completed).map(s => s.id);
    await db.planned_sessions.bulkDelete(toDelete);
  }

  const oneRMs = await getLatest1RMs();
  const increment = await getSetting('plate_increment_kg') || 1.25;
  const mode = await getSetting('rounding_mode') || 'nearest';
  const macrocycle = getDefaultMacrocycle(startDate, compDate);
  const sessions = generatePlannedSessions(macrocycle, oneRMs, increment, mode);

  await db.planned_sessions.bulkAdd(sessions);
  showToast(`✅ ${sessions.length} sesiones generadas`, 'success');
  await renderView('planner');
}

// ---- SESSION LOGGER ----
async function renderLogger(container) {
  container.innerHTML = '';
  container.appendChild(createEl('h2', { textContent: '📝 Session Logger' }));

  const pending = await getPendingSessions(7, 14);
  const logged = await getLoggedSessions(30);

  const grid = createEl('div', { className: 'grid-2' });

  // Pending column
  const pendingCol = createEl('div', { className: 'card' }, [
    createEl('h3', { textContent: '⏳ Sesiones Pendientes' })
  ]);
  if (pending.length > 0) {
    for (const s of pending) {
      const btn = createEl('div', { className: 'session-mini clickable', innerHTML: `<strong>${formatDate(s.date)}</strong> — ${s.name}`, onClick: () => openLogForm(s) });
      pendingCol.appendChild(btn);
    }
  } else {
    pendingCol.appendChild(createEl('p', { className: 'hint', textContent: 'No hay sesiones planificadas en este rango. Para registrar una sesión manualmente haz click en "Logear sesión".' }));
  }
  pendingCol.appendChild(createEl('button', { className: 'btn btn-primary', textContent: '+ Logear sesión (sin plan)', onClick: () => openLogForm(null), style: { marginTop: '12px' } }));

  // Logged column
  const loggedCol = createEl('div', { className: 'card' }, [
    createEl('h3', { textContent: '✅ Registradas' })
  ]);
  if (logged.length > 0) {
    for (const ls of logged) {
      const exNames = (ls.exercises || []).map(e => e.exercise).join(', ');
      loggedCol.appendChild(createEl('div', { className: 'session-mini logged', innerHTML: `<strong>${formatDate(ls.date)}</strong> — ${exNames || 'Sesión registrada'} <span class="badge completed">Inmutable</span>` }));
    }
  } else {
    loggedCol.appendChild(createEl('p', { className: 'hint', textContent: 'Aún no hay sesiones registradas. Completa una sesión pendiente o crea una nueva.' }));
  }

  grid.appendChild(pendingCol);
  grid.appendChild(loggedCol);
  container.appendChild(grid);
}

async function openLogForm(plannedSession) {
  const main = document.getElementById('main-content');
  main.innerHTML = '';

  const oneRMs = await getLatest1RMs();
  const form = createEl('div', { className: 'card' }, [
    createEl('h2', { textContent: plannedSession ? `Registrar: ${plannedSession.name}` : 'Registrar sesión libre' }),
    createEl('button', { className: 'btn btn-secondary', textContent: '← Volver', onClick: () => renderView('logger'), style: { marginBottom: '12px' } })
  ]);

  const exercises = plannedSession?.exercises || [];
  const logData = [];

  // If no planned session, allow adding exercises
  if (!plannedSession) {
    const addExBtn = createEl('button', { className: 'btn btn-sm', textContent: '+ Añadir ejercicio' });
    form.appendChild(addExBtn);
    form.appendChild(createEl('div', { id: 'free-exercises' }));

    addExBtn.addEventListener('click', () => {
      const idx = logData.length;
      logData.push({ exercise: '', sets: [] });
      const exDiv = createEl('div', { className: 'exercise-log-block' });
      exDiv.innerHTML = `
        <input type="text" placeholder="Nombre ejercicio" class="input-ex-name" data-idx="${idx}" style="margin-bottom:8px;width:200px;">
        <div class="sets-container" id="sets-${idx}"></div>
        <button class="btn btn-sm add-set-btn" data-idx="${idx}">+ Set</button>
      `;
      document.getElementById('free-exercises').appendChild(exDiv);
      exDiv.querySelector('.add-set-btn').addEventListener('click', () => addSetRow(idx));
    });
  } else {
    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i];
      logData.push({ exercise: ex.exercise, lift_key: ex.lift_key, is_topset: ex.is_topset, sets: [] });

      const exBlock = createEl('div', { className: 'exercise-log-block' }, [
        createEl('h4', { innerHTML: `${ex.exercise} ${ex.is_topset ? '⭐ Topset' : ''} — Plan: ${ex.sets}×${ex.reps} @ ${ex.weight_rounded ? ex.weight_rounded.toFixed(1) + 'kg' : (ex.percent ? ex.percent + '%' : 'RPE')}` }),
        createEl('div', { className: 'sets-container', id: `sets-${i}` }),
        createEl('button', { className: 'btn btn-sm add-set-btn', textContent: '+ Set', 'data-idx': String(i) })
      ]);

      // Pre-fill sets
      for (let s = 0; s < (ex.sets || 1); s++) {
        setTimeout(() => addSetRow(i, ex.weight_rounded, ex.reps, ex.rpe), 0);
      }

      exBlock.querySelector('.add-set-btn').addEventListener('click', () => addSetRow(i));
      form.appendChild(exBlock);
    }
  }

  // Notes field
  form.appendChild(createEl('div', { style: { marginTop: '16px' } }, [
    createEl('label', { textContent: 'Notas de sesión:' }),
    createEl('textarea', { id: 'session-notes', rows: '3', style: { width: '100%' }, placeholder: 'Observaciones, sensaciones...' })
  ]));

  // Save button
  const saveBtn = createEl('button', { className: 'btn btn-primary', textContent: '💾 Guardar Sesión', style: { marginTop: '16px' } });
  saveBtn.addEventListener('click', async () => {
    // Collect data
    const exerciseLogs = [];
    for (let i = 0; i < logData.length; i++) {
      const setsContainer = document.getElementById(`sets-${i}`);
      const setRows = setsContainer?.querySelectorAll('.set-row') || [];
      const setsArr = [];
      setRows.forEach(row => {
        setsArr.push({
          weight_kg: parseFloat(row.querySelector('.set-weight')?.value) || 0,
          reps: parseInt(row.querySelector('.set-reps')?.value) || 0,
          rpe: parseFloat(row.querySelector('.set-rpe')?.value) || 0,
          failed: row.querySelector('.set-failed')?.checked || false,
          failure_reason: row.querySelector('.set-failure-reason')?.value || 'none',
          notes: row.querySelector('.set-notes')?.value || ''
        });
      });

      const exName = exercises[i]?.exercise || document.querySelector(`.input-ex-name[data-idx="${i}"]`)?.value || 'Unknown';
      exerciseLogs.push(createExerciseLog({ ...exercises[i], exercise: exName }, setsArr));
    }

    const notes = document.getElementById('session-notes')?.value || '';
    await logSession(plannedSession?.id || null, exerciseLogs, notes);

    // Check for failures and show recommendations
    for (const exLog of exerciseLogs) {
      for (const set of exLog.sets) {
        if (set.failed && set.failure_reason !== 'none') {
          const recs = handleFailure(set.failure_reason, exLog, plannedSession, oneRMs);
          for (const rec of recs) {
            showToast(`⚠️ ${rec.description}`, 'warning');
          }
        }
      }
    }

    showToast('✅ Registro guardado.', 'success');
    await renderView('logger');
  });
  form.appendChild(saveBtn);
  main.appendChild(form);
}

function addSetRow(exerciseIdx, defaultWeight = '', defaultReps = '', defaultRpe = '') {
  const container = document.getElementById(`sets-${exerciseIdx}`);
  if (!container) return;
  const setNum = container.querySelectorAll('.set-row').length + 1;
  const row = createEl('div', { className: 'set-row' });
  row.innerHTML = `
    <span class="set-num">#${setNum}</span>
    <input type="number" class="set-weight" placeholder="kg" value="${defaultWeight || ''}" step="0.5" style="width:70px;">
    <input type="number" class="set-reps" placeholder="reps" value="${defaultReps || ''}" style="width:60px;">
    <input type="number" class="set-rpe" placeholder="RPE" value="" step="0.5" min="1" max="10" style="width:60px;">
    <label class="fail-label"><input type="checkbox" class="set-failed"> Fallo</label>
    <select class="set-failure-reason" style="width:100px;display:none;">
      ${FAILURE_REASONS.map(r => `<option value="${r.value}">${r.label}</option>`).join('')}
    </select>
    <input type="text" class="set-notes" placeholder="nota" style="width:100px;">
  `;
  // Toggle failure reason visibility
  row.querySelector('.set-failed').addEventListener('change', (e) => {
    row.querySelector('.set-failure-reason').style.display = e.target.checked ? 'inline-block' : 'none';
  });
  container.appendChild(row);
}

// ---- 1RM MANAGER ----
async function renderRMManager(container) {
  container.innerHTML = '';
  const oneRMs = await getLatest1RMs();

  container.appendChild(createEl('h2', { textContent: '🏋️ 1RM Manager' }));

  for (const lift of ['bench', 'squat', 'deadlift']) {
    const current = oneRMs[lift]?.value_kg || 0;
    const history = await get1RMHistory(lift);
    const liftName = { bench: 'Bench Press', squat: 'Squat', deadlift: 'Deadlift' }[lift];

    const card = createEl('div', { className: 'card' }, [
      createEl('h3', { textContent: `${liftName}: ${current} kg` }),
      createEl('div', { className: 'form-row' }, [
        createEl('input', { type: 'number', id: `new-rm-${lift}`, value: String(current), step: '0.5', style: { width: '100px' } }),
        createEl('input', { type: 'text', id: `rm-reason-${lift}`, placeholder: 'Razón', style: { width: '150px' } }),
        createEl('button', { className: 'btn btn-sm', textContent: 'Preview', onClick: () => previewRM(lift) }),
        createEl('button', { className: 'btn btn-primary btn-sm', textContent: 'Aplicar', onClick: () => applyRM(lift) }),
      ]),
      createEl('div', { id: `rm-preview-${lift}` }),
      createEl('details', {}, [
        createEl('summary', { textContent: `Historial (${history.length} entradas)` }),
        ...history.slice(0, 10).map(h => createEl('p', { className: 'history-entry', textContent: `${formatDate(h.date?.split('T')[0])} — ${h.value_kg} kg (${h.reason})` }))
      ])
    ]);
    container.appendChild(card);
  }

  // Plate calculator
  const calcCard = createEl('div', { className: 'card' }, [
    createEl('h3', { textContent: '🔧 Calculadora de peso' }),
    createEl('div', { className: 'form-row' }, [
      createEl('input', { type: 'number', id: 'calc-percent', placeholder: '% 1RM', style: { width: '80px' } }),
      createEl('select', { id: 'calc-lift', innerHTML: '<option value="bench">Bench</option><option value="squat">Squat</option><option value="deadlift">Deadlift</option>' }),
      createEl('button', { className: 'btn btn-sm', textContent: 'Calcular', onClick: doCalc })
    ]),
    createEl('div', { id: 'calc-result' })
  ]);
  container.appendChild(calcCard);
}

async function previewRM(lift) {
  const newVal = parseFloat(document.getElementById(`new-rm-${lift}`).value);
  if (!newVal) return;
  const diff = await preview1RMChange(lift, newVal);
  const previewDiv = document.getElementById(`rm-preview-${lift}`);
  previewDiv.innerHTML = '';
  if (diff.affected_sessions.length === 0) {
    previewDiv.innerHTML = '<p class="hint">Sin cambios en sesiones futuras.</p>';
    return;
  }
  previewDiv.innerHTML = `<p><strong>${diff.affected_sessions.length} ejercicios afectados</strong> (${diff.old_value}→${diff.new_value} kg, diff: ${diff.diff > 0 ? '+' : ''}${diff.diff} kg)</p>`;
  const table = createEl('table', { className: 'exercise-table' });
  table.innerHTML = '<thead><tr><th>Fecha</th><th>Ejercicio</th><th>%</th><th>Antes</th><th>Después</th><th>Diff</th></tr></thead>';
  const tbody = createEl('tbody');
  for (const a of diff.affected_sessions.slice(0, 20)) {
    tbody.innerHTML += `<tr><td>${formatDate(a.date)}</td><td>${a.exercise}</td><td>${a.percent}%</td><td>${a.old_kg}</td><td>${a.new_kg}</td><td style="color:${a.diff > 0 ? '#10b981' : '#ef4444'}">${a.diff > 0 ? '+' : ''}${a.diff.toFixed(1)}</td></tr>`;
  }
  table.appendChild(tbody);
  previewDiv.appendChild(table);
}

async function applyRM(lift) {
  const newVal = parseFloat(document.getElementById(`new-rm-${lift}`).value);
  const reason = document.getElementById(`rm-reason-${lift}`).value || 'manual';
  if (!newVal) return;
  const ok = await showConfirm(`¿Actualizar 1RM de ${lift} a ${newVal} kg? Se recalcularán sesiones futuras.`);
  if (!ok) return;
  const changes = await update1RM(lift, newVal, reason);
  showToast(`✅ 1RM actualizado. ${changes.length} sesiones recalculadas.`, 'success');
  await renderView('rm');
}

async function doCalc() {
  const pct = parseFloat(document.getElementById('calc-percent').value);
  const lift = document.getElementById('calc-lift').value;
  if (!pct) return;
  const oneRMs = await getLatest1RMs();
  const rm = oneRMs[lift]?.value_kg || 0;
  const increment = await getSetting('plate_increment_kg') || 1.25;
  const w = calcWeight(pct, rm, increment);
  const plates = suggestPlates(w.rounded);
  document.getElementById('calc-result').innerHTML = `
    <p>${pct}% de ${rm}kg = <strong>${w.raw.toFixed(1)} kg</strong> (raw) → <strong>${w.rounded.toFixed(1)} kg</strong> (rounded)</p>
    <p>Discos por lado: ${plates}</p>
  `;
}

// ---- ANALYTICS ----
async function renderAnalytics(container) {
  container.innerHTML = '';
  container.appendChild(createEl('h2', { textContent: '📊 Analytics' }));

  // Volume heatmap
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (now.getDay() || 7) + 1);
  const weekStr = monday.toISOString().split('T')[0];
  let volume = [];
  try { volume = await getWeeklyVolume(weekStr); } catch (e) {}

  if (volume.length > 0) {
    const volCard = createEl('div', { className: 'card' }, [
      createEl('h3', { textContent: 'Volumen Semanal por Músculo' }),
    ]);
    const table = createEl('table', { className: 'exercise-table' });
    table.innerHTML = '<thead><tr><th>Músculo</th><th>Planeado</th><th>Registrado</th><th>Objetivo Min</th><th>Objetivo Max</th><th>Estado</th></tr></thead>';
    const tbody = createEl('tbody');
    for (const v of volume) {
      const statusColor = v.status === 'ok' ? '#10b981' : v.status === 'pending' ? '#f59e0b' : '#ef4444';
      tbody.innerHTML += `<tr><td>${v.muscle}</td><td>${v.planned}</td><td>${v.logged}</td><td>${v.target_min}</td><td>${v.target_max}</td><td><span style="color:${statusColor};font-weight:bold;">${v.status === 'ok' ? '✓' : v.status === 'pending' ? '⏳' : '⚠️ Bajo'}</span></td></tr>`;
    }
    table.appendChild(tbody);
    volCard.appendChild(table);
    container.appendChild(volCard);
  } else {
    container.appendChild(createEl('div', { className: 'card' }, [
      createEl('p', { className: 'hint', textContent: 'Genera un macrociclo y registra sesiones para ver analytics.' })
    ]));
  }

  // Compliance
  const compliance = await getComplianceSummary(8);
  const compCard = createEl('div', { className: 'card' }, [
    createEl('h3', { textContent: 'Compliance Semanal' })
  ]);
  if (compliance.length > 0) {
    const cTable = createEl('table', { className: 'exercise-table' });
    cTable.innerHTML = '<thead><tr><th>Semana</th><th>Sets Plan</th><th>Sets Log</th><th>Compliance</th><th>Sesiones</th></tr></thead>';
    const cTbody = createEl('tbody');
    for (const c of compliance) {
      cTbody.innerHTML += `<tr><td>${formatDateShort(c.week_start)}</td><td>${c.planned_sets}</td><td>${c.logged_sets}</td><td style="color:${complianceColor(c.compliance)};font-weight:bold;">${c.compliance}%</td><td>${c.sessions_logged}/${c.sessions_planned}</td></tr>`;
    }
    cTable.appendChild(cTbody);
    compCard.appendChild(cTable);
  }
  container.appendChild(compCard);

  // 1RM Timeline
  const rmTimeline = await get1RMTimeline();
  const rmCard = createEl('div', { className: 'card' }, [
    createEl('h3', { textContent: '1RM Timeline' })
  ]);
  for (const [lift, entries] of Object.entries(rmTimeline)) {
    rmCard.appendChild(createEl('p', { innerHTML: `<strong>${lift}</strong>: ${entries.map(e => `${e.value}kg (${e.reason})`).join(' → ')}` }));
  }
  container.appendChild(rmCard);
}

// ---- COMPETITION ----
async function renderCompetition(container) {
  container.innerHTML = '';
  const comp = await getCompetition();

  container.appendChild(createEl('h2', { textContent: '🏆 Competición' }));

  const card = createEl('div', { className: 'card' }, [
    createEl('p', { innerHTML: `<strong>Fecha original:</strong> ${comp?.original_date || 'No establecida'}` }),
    createEl('p', { innerHTML: `<strong>Fecha actual:</strong> ${comp?.current_date || 'No establecida'}` }),
    createEl('p', { innerHTML: `<strong>Días restantes:</strong> ${comp ? Math.max(0, Math.floor((new Date(comp.current_date) - new Date()) / 86400000)) : '—'}` }),
    createEl('h3', { textContent: 'Cambiar fecha de competición' }),
    createEl('div', { className: 'form-row' }, [
      createEl('input', { type: 'date', id: 'new-comp-date', value: comp?.current_date || '' }),
      createEl('button', { className: 'btn btn-primary', textContent: 'Simular cambio', onClick: onSimulateCompChange })
    ]),
    createEl('div', { id: 'comp-preview' })
  ]);

  // History
  if (comp?.history?.length > 0) {
    card.appendChild(createEl('h3', { textContent: 'Historial de cambios' }));
    for (const h of comp.history) {
      card.appendChild(createEl('p', { textContent: `${formatDate(h.changed_at?.split('T')[0])} — ${h.from} → ${h.to}` }));
    }
  }

  container.appendChild(card);
}

async function onSimulateCompChange() {
  const newDate = document.getElementById('new-comp-date').value;
  if (!newDate) return;
  const result = await changeCompetitionDate(newDate);
  const preview = document.getElementById('comp-preview');
  preview.innerHTML = '';

  preview.appendChild(createEl('div', { className: 'card', style: { background: '#1a1a2e' } }, [
    createEl('h4', { textContent: `Protocolo: ${result.protocol.protocol} — ${result.protocol.description}` }),
    createEl('p', { textContent: `Lead time: ${result.protocol.leadTimeDays} días (${result.protocol.leadTimeWeeks} semanas)` }),
    createEl('p', { textContent: `Sesiones a generar: ${result.total_sessions}` }),
    createEl('h4', { textContent: 'Bloques:' }),
    ...result.protocol.blocks.map(b => createEl('p', { textContent: `${b.name} — ${b.weeks} sem, ${b.days_per_week} días/sem (${phaseLabel(b.phase)})` })),
    createEl('button', { className: 'btn btn-primary', textContent: '✅ Aplicar cambio', style: { marginTop: '12px' }, onClick: async () => {
      const ok = await showConfirm('¿Aplicar este cambio? Se eliminarán sesiones futuras no completadas y se generarán nuevas.');
      if (!ok) return;
      await applyCompetitionChange(newDate, result.preview_sessions);
      showToast('✅ Competición actualizada', 'success');
      await renderView('competition');
    }})
  ]));
}

// ---- BACKUP ----
async function renderBackup(container) {
  container.innerHTML = '';
  container.appendChild(createEl('h2', { textContent: '💾 Backup & Import' }));

  const lastBackup = await getSetting('last_backup');

  const card = createEl('div', { className: 'card' }, [
    createEl('p', { innerHTML: `<strong>Último backup:</strong> ${lastBackup ? formatDate(lastBackup.split('T')[0]) : 'Nunca'}` }),
    createEl('button', { className: 'btn btn-primary', textContent: '📥 Exportar Backup JSON', onClick: async () => { await exportBackup(); showToast('Backup exportado', 'success'); await renderView('backup'); } }),
    createEl('hr'),
    createEl('h3', { textContent: 'Importar Backup' }),
    createEl('input', { type: 'file', id: 'import-file', accept: '.json' }),
    createEl('div', { className: 'form-row', style: { marginTop: '8px' } }, [
      createEl('button', { className: 'btn btn-secondary', textContent: 'Merge (combinar)', onClick: () => doImport('merge') }),
      createEl('button', { className: 'btn btn-secondary', textContent: 'Replace (reemplazar)', onClick: () => doImport('replace') })
    ]),
    createEl('div', { id: 'import-preview' })
  ]);

  container.appendChild(card);
}

async function doImport(mode) {
  const fileInput = document.getElementById('import-file');
  const file = fileInput?.files?.[0];
  if (!file) { showToast('Selecciona un archivo', 'warning'); return; }

  const text = await file.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { showToast('JSON inválido', 'error'); return; }

  const validation = validateBackupSchema(data);
  if (!validation.valid) { showToast(`Schema inválido: ${validation.errors.join(', ')}`, 'error'); return; }

  const diff = await computeDiff(data);
  const preview = document.getElementById('import-preview');
  preview.innerHTML = `
    <div class="card" style="background:#1a1a2e;margin-top:12px;">
      <h4>Diff Preview (modo: ${mode})</h4>
      <p>1RMs: ${diff.one_rms.current} actuales → ${diff.one_rms.incoming} en archivo</p>
      <p>Planned sessions: ${diff.planned_sessions.current} → ${diff.planned_sessions.incoming}</p>
      <p>Logged sessions: ${diff.logged_sessions.current} → ${diff.logged_sessions.incoming}</p>
    </div>
  `;

  const ok = await showConfirm(`¿Importar en modo "${mode}"? ${mode === 'replace' ? 'Se borrarán todos los datos actuales.' : 'Se combinarán los datos.'}`);
  if (!ok) return;

  await importBackup(data, mode);
  showToast('✅ Importación completada', 'success');
  await renderView('backup');
}

// ---- START ----
init().catch(err => console.error('Init failed:', err));
