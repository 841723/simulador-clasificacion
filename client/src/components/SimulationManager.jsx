import { useState } from 'react';
import { useSimulation } from '../context/SimulationContext';

export default function SimulationManager() {
  const { state, dispatch } = useSimulation();
  const [simName, setSimName] = useState('');
  const [showLoad, setShowLoad] = useState(false);
  const [saveError, setSaveError] = useState('');

  const savedNames = Object.keys(state.savedSimulations);

  function handleSave() {
    const name = simName.trim();
    if (!name) {
      setSaveError('Escribe un nombre');
      return;
    }
    setSaveError('');
    dispatch({ type: 'SAVE_SIMULATION', payload: { name } });
    setSimName('');
  }

  function handleLoad(name) {
    dispatch({ type: 'LOAD_SIMULATION', payload: { name } });
    setShowLoad(false);
  }

  function handleDelete(name) {
    if (window.confirm(`¿Eliminar la simulación "${name}"?`)) {
      dispatch({ type: 'DELETE_SIMULATION', payload: { name } });
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
            className="px-2.5 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 font-medium transition-colors whitespace-nowrap"
          >
            💾 Guardar
          </button>
          {saveError && <span className="text-xs text-rose-500">{saveError}</span>}
        </div>

        {/* Load */}
        <div className="relative">
          <button
            onClick={() => setShowLoad((v) => !v)}
            disabled={savedNames.length === 0}
            className="px-2.5 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200 font-medium transition-colors disabled:opacity-40 border border-gray-300 whitespace-nowrap"
          >
            📂 Cargar {savedNames.length > 0 ? `(${savedNames.length})` : ''}
          </button>
          {showLoad && savedNames.length > 0 && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[200px]">
              {savedNames.map((name) => (
                <div
                  key={name}
                  className={`flex items-center justify-between px-3 py-2 hover:bg-gray-50 border-b last:border-0 ${
                    name === state.activeSimulationName ? 'bg-blue-50' : ''
                  }`}
                >
                  <button
                    onClick={() => handleLoad(name)}
                    className="text-xs text-gray-700 hover:text-blue-600 font-medium truncate flex-1 text-left flex items-center gap-1"
                  >
                    {name === state.activeSimulationName && (
                      <span className="text-yellow-500">●</span>
                    )}
                    {name}
                  </button>
                  <button
                    onClick={() => handleDelete(name)}
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
