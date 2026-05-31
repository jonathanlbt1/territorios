import { Check, Lock } from 'lucide-react';

function BlockSelector({ totalBlocks, selectedBlocks, onChange, disabled = false, lockedBlocks = [] }) {
  const blocks = Array.from({ length: totalBlocks }, (_, i) => i + 1);
  const lockedSet = new Set(lockedBlocks || []);

  const toggleBlock = (blockNum) => {
    if (disabled || lockedSet.has(blockNum)) return;
    
    if (selectedBlocks.includes(blockNum)) {
      onChange(selectedBlocks.filter(b => b !== blockNum));
    } else {
      onChange([...selectedBlocks, blockNum].sort((a, b) => a - b));
    }
  };

  const selectAll = () => {
    if (disabled) return;
    const pending = blocks.filter(b => !lockedSet.has(b));
    onChange(pending);
  };

  const clearAll = () => {
    if (disabled) return;
    onChange([]);
  };

  const allSelected = selectedBlocks.length === totalBlocks;
  const lockedCount = lockedSet.size;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="input-label">Quadras Trabalhadas</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectAll}
            disabled={disabled}
            className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium disabled:opacity-50"
          >
            Todas
          </button>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <button
            type="button"
            onClick={clearAll}
            disabled={disabled}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 font-medium disabled:opacity-50"
          >
            Limpar
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {blocks.map(blockNum => {
          const isSelected = selectedBlocks.includes(blockNum);
          const isLocked = lockedSet.has(blockNum);
          return (
            <button
              key={blockNum}
              type="button"
              onClick={() => toggleBlock(blockNum)}
              disabled={disabled || isLocked}
              className={`
                w-12 h-12 rounded-xl font-semibold text-lg transition-all duration-200
                flex items-center justify-center relative
                ${disabled || isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer active:scale-95'}
                ${isLocked
                  ? 'bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-300 line-through'
                  : isSelected 
                    ? 'bg-primary-600 dark:bg-primary-500 text-white shadow-lg shadow-primary-500/30' 
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }
              `}
            >
              {isLocked ? (
                <Lock className="w-5 h-5" />
              ) : isSelected ? (
                <Check className="w-6 h-6" />
              ) : (
                blockNum
              )}
            </button>
          );
        })}
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400">
        {selectedBlocks.length} de {totalBlocks} quadras selecionadas
        {lockedCount > 0 && (
          <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">{lockedCount} bloqueadas</span>
        )}
        {allSelected && lockedCount === 0 && <span className="text-emerald-600 dark:text-emerald-400 font-medium ml-2">✓ Todas</span>}
      </p>
    </div>
  );
}

export default BlockSelector;

