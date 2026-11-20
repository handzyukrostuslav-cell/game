const STORAGE_KEY = 'city_architect_slot1_v2';

export class SaveSystem {
  static saveLocal(mapSystem, simulation) {
    const payload = {
      savedAt: new Date().toISOString(),
      map: mapSystem.serialize(),
      simulation: simulation.serialize()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  }

  static loadLocal(mapSystem, simulation) {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const payload = JSON.parse(raw);
    mapSystem.deserialize(payload.map);
    simulation.deserialize(payload.simulation);
    return true;
  }

  static exportJSON(mapSystem, simulation) {
    const payload = {
      game: 'City Architect',
      exportedAt: new Date().toISOString(),
      map: mapSystem.serialize(),
      simulation: simulation.serialize()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${simulation.cityName.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  static importJSON(file, mapSystem, simulation, onSuccess) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const payload = JSON.parse(e.target.result);
        if (payload.map && payload.simulation) {
          mapSystem.deserialize(payload.map);
          simulation.deserialize(payload.simulation);
          onSuccess();
        }
      } catch {
        alert('Помилка читання файлу збереження JSON.');
      }
    };
    reader.readAsText(file);
  }
}