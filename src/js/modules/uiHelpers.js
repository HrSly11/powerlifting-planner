// uiHelpers.js - UI utility functions

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' });
}

export function getWeekNumber(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = d - start;
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7);
}

export function getWeekRange(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0]
  };
}

export function phaseLabel(phase) {
  const labels = {
    hypertrophy: 'Hipertrofia',
    strength: 'Fuerza Base',
    specific: 'Específico',
    taper: 'Taper'
  };
  return labels[phase] || phase;
}

export function phaseColor(phase) {
  const colors = {
    hypertrophy: '#3b82f6',
    strength: '#f59e0b',
    specific: '#ef4444',
    taper: '#10b981'
  };
  return colors[phase] || '#6b7280';
}

export function rpeColor(rpe) {
  if (rpe <= 6) return '#10b981';
  if (rpe <= 7) return '#3b82f6';
  if (rpe <= 8) return '#f59e0b';
  if (rpe <= 9) return '#ef4444';
  return '#dc2626';
}

export function complianceColor(pct) {
  if (pct >= 90) return '#10b981';
  if (pct >= 70) return '#f59e0b';
  return '#ef4444';
}

export function createEl(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') el.className = v;
    else if (k === 'textContent') el.textContent = v;
    else if (k === 'innerHTML') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v);
  }
  for (const child of children) {
    if (typeof child === 'string') el.appendChild(document.createTextNode(child));
    else if (child) el.appendChild(child);
  }
  return el;
}

export function showToast(message, type = 'info') {
  const colors = { info: '#3b82f6', success: '#10b981', warning: '#f59e0b', error: '#ef4444' };
  const toast = createEl('div', {
    className: 'toast',
    textContent: message,
    style: { background: colors[type] || colors.info }
  });
  document.getElementById('toast-container')?.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

export function showConfirm(message) {
  return new Promise(resolve => {
    const overlay = createEl('div', { className: 'modal-overlay' });
    const modal = createEl('div', { className: 'modal' }, [
      createEl('p', { textContent: message, style: { marginBottom: '16px' } }),
      createEl('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } }, [
        createEl('button', { className: 'btn btn-secondary', textContent: 'Cancelar', onClick: () => { overlay.remove(); resolve(false); } }),
        createEl('button', { className: 'btn btn-primary', textContent: 'Confirmar', onClick: () => { overlay.remove(); resolve(true); } })
      ])
    ]);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  });
}

export function groupSessionsByWeek(sessions) {
  const weeks = {};
  for (const s of sessions) {
    const { start } = getWeekRange(s.date);
    if (!weeks[start]) weeks[start] = { start, sessions: [] };
    weeks[start].sessions.push(s);
  }
  return Object.values(weeks).sort((a, b) => a.start.localeCompare(b.start));
}
