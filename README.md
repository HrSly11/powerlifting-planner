# ⚡ PowerLog - Harry Powerlifting Periodization & Logger

Aplicación web frontend-only para periodización, rutinas y logging de powerlifting.

## Características

- **Macrociclo Planner**: Genera planificación Abr→Mar con bloques Hipertrofia/Fuerza/Específico/Peaking/Taper
- **Session Logger**: Registra sesiones con peso, reps, RPE, fallos y recomendaciones automáticas
- **1RM Manager**: Gestiona 1RMs con recálculo automático de sesiones futuras
- **Analytics**: Volumen semanal por músculo, compliance, progreso de lifts
- **Competición**: Cambio de fecha con protocolos A/B automáticos
- **Backup**: Export/Import JSON con diff y merge
- **Offline**: Funciona sin conexión tras primera carga (Service Worker)
- **Calentamiento**: Warmups específicos por lift y fase

## Datos por defecto (Seed)

- **Usuario**: Harry
- **1RMs**: Bench 105 kg, Squat 95 kg, Deadlift 140 kg
- **Plate increment**: 1.25 kg
- **Competición**: 2027-03-20

## Tech Stack

- Vanilla JS (ES Modules)
- IndexedDB via Dexie.js (CDN)
- CSS custom (dark theme)
- Python CLI para análisis de backups

## Estructura

```
src/
  index.html          # Entry point
  styles.css          # Estilos
  sw.js               # Service Worker
  manifest.json       # PWA manifest
  js/
    app.js            # Controlador principal SPA
    db/
      schema.js       # Schema DB, ejercicios, volumen targets
      dexie-wrapper.js # IndexedDB wrapper
    modules/
      planner.js      # Macrociclo y generación de sesiones
      workoutBuilder.js # Templates, calcWeight, warmups
      logger.js       # Session logging
      rmManager.js    # 1RM management
      competition.js  # Cambio fecha competición
      analytics.js    # Analytics y reporting
      uiHelpers.js    # Utilidades UI
    backup/
      export.js       # Export JSON
      import.js       # Import con validación y diff
  tests/
    core.test.js      # Unit tests
analyze_backup.py     # Python CLI análisis
README.md
```

## Correr en local

```bash
# Opción 1: Python
cd src
python3 -m http.server 8080
# Abrir http://localhost:8080

# Opción 2: Node
npx serve src

# Opción 3: cualquier servidor estático
```

## Tests

```bash
node src/tests/core.test.js
```

## Deploy en Netlify (gratis)

1. Crear cuenta en [netlify.com](https://netlify.com)
2. Click "Add new site" → "Deploy manually"
3. Arrastra la carpeta `src/` al área de deploy
4. ¡Listo! Tu app estará en `https://tu-sitio.netlify.app`

**Alternativa con CLI:**
```bash
npm install -g netlify-cli
netlify login
cd src
netlify deploy --prod --dir=.
```

**Alternativa con Git:**
1. Push el repo a GitHub
2. En Netlify: "Import from Git" → seleccionar repo
3. Build command: (vacío)
4. Publish directory: `src`

## Export/Import Backup

### Exportar
1. Ve a la sección **Backup** en la app
2. Click **Exportar Backup JSON**
3. Se descargará `harry-powerlifting-backup-YYYY-MM-DD.json`

### Importar
1. Ve a **Backup**
2. Selecciona archivo `.json`
3. Elige **Merge** (combinar) o **Replace** (reemplazar)
4. Revisa el diff y confirma

### Análisis con Python
```bash
pip install matplotlib pandas
python analyze_backup.py harry-powerlifting-backup-2026-02-10.json --output-dir ./output
# Genera: one_rm_history.csv, logged_sessions.csv, volume_by_muscle.csv, rm_progression.png, volume_by_muscle.png
```

## Reglas de Progresión

| Fase | Regla |
|------|-------|
| S1-S4 Hipertrofia | +2.5 kg/sem en compuestos si RPE ≤ 8. Deload sem 4 (vol -40%, int -5%) |
| S5-S6 Fuerza Base | Topset + back-off. +2.5 kg topset si RPE ≤ 8. Deload cada 4ª sem |
| S8-S9 Específico | +2.5 kg cada 2 sem si RPE ≤ 8.5. Fallo → -2.5 kg y repetir |
| S10 Taper | Sin AMRAPs. Sin incrementos últimas 2 sem |

## Failure Handling

- **Técnica**: -2.5 kg + bloque correctivo (paused reps, tempo)
- **Fatiga**: Repetir carga, -1-2 reps. 2 fallos en 14d → deload week
- **Lesión**: Consulta profesional, sin cambios automáticos

## Licencia

Uso personal - Harry Powerlifting App
