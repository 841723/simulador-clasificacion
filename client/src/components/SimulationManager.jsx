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
      setSaveError('Escribe un nombre para la simulación');
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
    dispatch({ type: 'DELETE_SIMULATION', payload: { name } });
  }

  function handleReset() {
    if (window.confirm('¿Resetear todos los resultados simulados a los valores por defecto?')) {
      dispatch({ type: 'RESET_SIMULATION' });
    }
  }

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
        {/* Save */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={simName}
            onChange={(e) => {
              setSimName(e.target.value);
              setSaveError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="Nombre de la simulación..."
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 w-52"
          />
          <button
            onClick={handleSave}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            💾 Guardar
          </button>
          {saveError && <span className="text-xs text-red-500">{saveError}</span>}
        </div>

        {/* Load */}
        <div className="relative">
          <button
            onClick={() => setShowLoad((v) => !v)}
            disabled={savedNames.length === 0}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 font-medium transition-colors disabled:opacity-40 border border-gray-300"
          >
            📂 Cargar {savedNames.length > 0 ? `(${savedNames.length})` : ''}
          </button>
          {showLoad && savedNames.length > 0 && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[220px]">
              {savedNames.map((name) => (
                <div
                  key={name}
                  className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 border-b last:border-0"
                >
                  <button
                    onClick={() => handleLoad(name)}
                    className="text-sm text-gray-700 hover:text-blue-600 font-medium truncate flex-1 text-left"
                  >
                    {name}
                  </button>
                  <button
                    onClick={() => handleDelete(name)}
                    className="text-gray-400 hover:text-red-500 ml-2 text-xs"
                    title="Eliminar simulación"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reset all */}
        <button
          onClick={handleReset}
          className="px-3 py-1.5 bg-orange-100 text-orange-700 text-sm rounded-lg hover:bg-orange-200 border border-orange-300 font-medium transition-colors ml-auto"
        >
          ↺ Resetear todo
        </button>
      </div>
    </div>
  );
}
