import { useState } from 'react';
import { useSimulation } from '../context/SimulationContext';

export default function SimulationManager() {
  const { state, dispatch, saveSimulationToAPI, loadSimulationFromAPI, deleteSimulationFromAPI } = useSimulation();
  const [simName, setSimName] = useState('');
  const [showLoad, setShowLoad] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [busy, setBusy] = useState(false);

  const savedSims = Object.values(state.savedSimulations);

  async function handleSave() {
    const name = simName.trim();
    if (!name) {
      setSaveError('Escribe un nombre');
      return;
    }
    setSaveError('');
    setBusy(true);
    try {
      await saveSimulationToAPI(name);
      setSimName('');
    } catch (e) {
      setSaveError(e.message || 'Error al guardar');
    } finally {
      setBusy(false);
    }
  }

  async function handleLoad(uuid) {
    setBusy(true);
    try {
      await loadSimulationFromAPI(uuid);
    } catch (e) {
      console.error('Error loading simulation:', e);
    } finally {
      setBusy(false);
      setShowLoad(false);
    }
  }

  async function handleDelete(uuid, name) {
    if (window.confirm(`¿Eliminar la simulación "${name}"?`)) {
      setBusy(true);
      try {
        await deleteSimulationFromAPI(uuid);
      } catch (e) {
        console.error('Error deleting simulation:', e);
      } finally {
        setBusy(false);
      }
    }
  }

  function handleReset() {
    if (window.confirm('¿Resetear todos los resultados simulados a los valores por defecto?')) {
      dispatch({ type: 'RESET_SIMULATION' });
    }
  }

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="px-4 py-2 flex flex-wrap items-center gap-2">
        {/* Save */}
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={simName}
            onChange={(e) => {
              setSimName(e.target.value);
              setSaveError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="Nombre de simulación..."
            className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-400 w-44"
          />
          <button
            onClick={handleSave}
            disabled={busy}
            className="px-2.5 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 font-medium transition-colors whitespace-nowrap disabled:opacity-50"
          >
            Guardar
          </button>
          {saveError && <span className="text-xs text-rose-500">{saveError}</span>}
        </div>

        {/* Load */}
        <div className="relative">
          <button
            onClick={() => setShowLoad((v) => !v)}
            disabled={savedSims.length === 0}
            className="px-2.5 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200 font-medium transition-colors disabled:opacity-40 border border-gray-300 whitespace-nowrap"
          >
            Cargar {savedSims.length > 0 ? `(${savedSims.length})` : ''}
          </button>
          {showLoad && savedSims.length > 0 && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-50">
              {savedSims.map((sim) => (
                <div
                  key={sim.uuid}
                  className={`flex items-center justify-between px-3 py-2 hover:bg-gray-50 border-b last:border-0 ${
                    sim.uuid === state.activeSimulationUuid ? 'bg-blue-50' : ''
                  }`}
                >
                  <button
                    onClick={() => handleLoad(sim.uuid)}
                    className="text-xs text-gray-700 hover:text-blue-600 font-medium truncate flex-1 text-left flex items-center gap-1"
                  >
                    {sim.uuid === state.activeSimulationUuid && (
                      <span className="text-yellow-500">●</span>
                    )}
                    {sim.name}
                  </button>
                  <button
                    onClick={() => handleDelete(sim.uuid, sim.name)}
                    className="text-gray-400 hover:text-rose-500 ml-2 text-xs shrink-0"
                    title="Eliminar simulación"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active sim indicator */}
        {state.activeSimulationName && (
          <div className="hidden sm:flex items-center gap-1 text-xs text-gray-500">
            <span className="text-yellow-500">●</span>
            <span className="font-medium text-gray-700">{state.activeSimulationName}</span>
          </div>
        )}

        {/* Reset all */}
        <button
          onClick={handleReset}
          className="px-2.5 py-1.5 bg-orange-50 text-orange-700 text-xs rounded-lg hover:bg-orange-100 border border-orange-300 font-medium transition-colors ml-auto whitespace-nowrap"
        >
          ↺ Reset todo
        </button>
      </div>
    </div>
  );
}
