#!/usr/bin/env python3
"""analyze_backup.py - Analyze Harry Powerlifting backup JSON files.
Usage: python analyze_backup.py <backup_file.json> [--output-dir ./output]
"""
import json
import sys
import os
from datetime import datetime

def load_backup(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def analyze_1rms(data):
    """Analyze 1RM progression."""
    rms = data.get('one_rms', [])
    by_lift = {}
    for rm in rms:
        lift = rm['lift']
        if lift not in by_lift:
            by_lift[lift] = []
        by_lift[lift].append({
            'date': rm.get('date', ''),
            'value': rm.get('value_kg', 0),
            'reason': rm.get('reason', '')
        })
    for lift in by_lift:
        by_lift[lift].sort(key=lambda x: x['date'])
    return by_lift

def analyze_sessions(data):
    """Analyze logged sessions."""
    logged = data.get('logged_sessions', [])
    planned = data.get('planned_sessions', [])
    return {
        'total_logged': len(logged),
        'total_planned': len(planned),
        'completed_planned': len([p for p in planned if p.get('completed')]),
        'logged_dates': sorted(set(s.get('date', '') for s in logged))
    }

def analyze_volume(data):
    """Analyze volume per muscle from logged sessions."""
    exercise_muscles = {
        'Squat': ['quads', 'glutes'], 'Bench Press': ['chest', 'triceps'],
        'Deadlift': ['hamstrings', 'glutes', 'lower_back'],
        'Barbell Row': ['lats', 'upper_back', 'biceps'],
        'Overhead Press': ['front_delts', 'triceps'],
        'Lat Pulldown': ['lats', 'biceps'], 'Leg Curl': ['hamstrings'],
        'Leg Press': ['quads', 'glutes'], 'Face Pull': ['rear_delts'],
        'Lateral Raise': ['side_delts'], 'Barbell Curl': ['biceps'],
        'Triceps Pushdown': ['triceps'], 'Hip Thrust': ['glutes'],
        'Calf Raise': ['calves'], 'Plank': ['core'], 'Ab Wheel': ['core'],
    }
    volume = {}
    for session in data.get('logged_sessions', []):
        for ex in session.get('exercises', []):
            name = ex.get('exercise', '')
            sets = ex.get('sets_completed', 0)
            for muscle in exercise_muscles.get(name, []):
                volume[muscle] = volume.get(muscle, 0) + sets
    return volume

def generate_csv(data, output_dir):
    """Generate CSV reports."""
    os.makedirs(output_dir, exist_ok=True)

    # 1RM CSV
    rms = analyze_1rms(data)
    with open(os.path.join(output_dir, 'one_rm_history.csv'), 'w') as f:
        f.write('lift,date,value_kg,reason\n')
        for lift, entries in rms.items():
            for e in entries:
                f.write(f"{lift},{e['date']},{e['value']},{e['reason']}\n")

    # Sessions CSV
    sessions = data.get('logged_sessions', [])
    with open(os.path.join(output_dir, 'logged_sessions.csv'), 'w') as f:
        f.write('date,exercise,sets_completed,rpe,weight_kg\n')
        for s in sessions:
            for ex in s.get('exercises', []):
                f.write(f"{s.get('date','')},{ex.get('exercise','')},{ex.get('sets_completed',0)},{ex.get('rpe_actual','')},{ex.get('planned_weight','')}\n")

    # Volume CSV
    vol = analyze_volume(data)
    with open(os.path.join(output_dir, 'volume_by_muscle.csv'), 'w') as f:
        f.write('muscle,total_sets\n')
        for muscle, sets in sorted(vol.items(), key=lambda x: -x[1]):
            f.write(f"{muscle},{sets}\n")

    print(f"CSVs saved to {output_dir}/")

def generate_plots(data, output_dir):
    """Generate PNG plots (requires matplotlib)."""
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
    except ImportError:
        print("matplotlib not installed. Skipping plots. Install with: pip install matplotlib")
        return

    os.makedirs(output_dir, exist_ok=True)
    rms = analyze_1rms(data)

    # 1RM progression plot
    fig, ax = plt.subplots(figsize=(10, 5))
    colors = {'bench': '#3b82f6', 'squat': '#f59e0b', 'deadlift': '#ef4444'}
    for lift, entries in rms.items():
        if len(entries) > 0:
            dates = [e['date'][:10] for e in entries]
            values = [e['value'] for e in entries]
            ax.plot(dates, values, 'o-', label=lift.title(), color=colors.get(lift, '#888'))
    ax.set_title('1RM Progression')
    ax.set_xlabel('Date')
    ax.set_ylabel('Weight (kg)')
    ax.legend()
    ax.grid(True, alpha=0.3)
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, 'rm_progression.png'), dpi=150)
    print(f"Plot saved: {output_dir}/rm_progression.png")

    # Volume by muscle bar chart
    vol = analyze_volume(data)
    if vol:
        fig2, ax2 = plt.subplots(figsize=(10, 5))
        muscles = list(vol.keys())
        sets_vals = list(vol.values())
        ax2.barh(muscles, sets_vals, color='#6366f1')
        ax2.set_title('Total Volume by Muscle (logged sets)')
        ax2.set_xlabel('Total Sets')
        plt.tight_layout()
        plt.savefig(os.path.join(output_dir, 'volume_by_muscle.png'), dpi=150)
        print(f"Plot saved: {output_dir}/volume_by_muscle.png")

    plt.close('all')

def main():
    if len(sys.argv) < 2:
        print("Usage: python analyze_backup.py <backup_file.json> [--output-dir ./output]")
        sys.exit(1)

    filepath = sys.argv[1]
    output_dir = './output'
    if '--output-dir' in sys.argv:
        idx = sys.argv.index('--output-dir')
        if idx + 1 < len(sys.argv):
            output_dir = sys.argv[idx + 1]

    data = load_backup(filepath)
    print(f"Backup loaded: {data.get('meta', {}).get('exported_at', 'unknown')}")
    print(f"User: {data.get('user', {}).get('name', 'unknown')}")

    # Summary
    sessions = analyze_sessions(data)
    print(f"\nSessions: {sessions['total_logged']} logged, {sessions['total_planned']} planned, {sessions['completed_planned']} completed")

    rms = analyze_1rms(data)
    for lift, entries in rms.items():
        if entries:
            print(f"  {lift}: {entries[0]['value']}kg → {entries[-1]['value']}kg ({len(entries)} entries)")

    # Generate outputs
    generate_csv(data, output_dir)
    generate_plots(data, output_dir)
    print("\nDone!")

if __name__ == '__main__':
    main()
