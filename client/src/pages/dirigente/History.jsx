import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import {
  History as HistoryIcon,
  Search,
  Calendar,
  MapPin,
  ChevronDown,
  ChevronUp,
  Filter
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function DirigentHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [startDateFilter, setStartDateFilter] = useState(
    format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd')
  );
  const toast = useToast();

  useEffect(() => {
    fetchHistory();
  }, [startDateFilter]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await api.get('/assignments/history', { 
        params: { limit: 100, start_date: startDateFilter } 
      });
      setHistory(response.data);
    } catch {
      toast.error('Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = history.filter(h =>
    h.territory_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    h.locality?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-slate-800 dark:text-white">Meu Histórico</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          {history.length} registros de territórios entregues
        </p>
      </div>

      {/* Date Filter */}
      <div className="card p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">Filtrar por data</span>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="dirigente-start-date" className="input-label text-xs">Data Inicial</label>
            <input
              id="dirigente-start-date"
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              max={format(new Date(), 'yyyy-MM-dd')}
              className="input text-sm"
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-5">
            Exibindo dados a partir de {format(parseISO(startDateFilter), 'dd/MM/yyyy', { locale: ptBR })}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar por código ou localidade..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input !pl-12"
        />
      </div>

      {/* History List */}
      {filteredHistory.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title="Nenhum histórico de entrega"
          description="Quando você entregar territórios designados, eles aparecerão aqui"
        />
      ) : (
        <div className="space-y-3">
          {filteredHistory.map(item => (
            <div key={item.id} className="card overflow-hidden">
              <button
                onClick={() => toggleExpand(item.id)}
                className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <div className="territory-number !w-10 !h-10 !text-sm">
                  {item.territory_number}
                </div>
                
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-800 dark:text-white">
                      Território: {item.territory_number}
                    </h3>
                    <StatusBadge status={item.validation_result} type="result" />
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{item.locality}</p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {item.block_count} quadras
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {format(parseISO(item.validated_at), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                </div>

                {expandedId === item.id ? (
                  <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                )}
              </button>

              {/* Expanded Details */}
              {expandedId === item.id && (
                <div className="px-4 pb-4 pt-2 border-t border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/30">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Quadras Trabalhadas</p>
                      <p className="font-medium text-slate-800 dark:text-white">
                        {item.blocks_worked?.length > 0 
                          ? `${item.blocks_worked.join(', ')} de ${item.block_count}`
                          : 'Não informado'
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Data de Validação</p>
                      <p className="font-medium text-slate-800 dark:text-white">
                        {format(parseISO(item.validated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    {item.return_observations && (
                      <div className="col-span-2">
                        <p className="text-slate-500 dark:text-slate-400">Observações</p>
                        <p className="font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 p-2 rounded-lg mt-1">
                          {item.return_observations}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DirigentHistory;
