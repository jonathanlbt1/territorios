import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import MapViewer from '../../components/MapViewer';
import { getMapUrl } from '../../utils/mapUrl';
import {
  ArrowLeft,
  MapPin,
  Clock,
  CheckSquare,
  Square,
  Send,
  AlertCircle
} from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function PublisherBlockDetail() {
  const { id } = useParams(); // publisher_assignment_id
  const navigate = useNavigate();
  const toast = useToast();

  const [assignment, setAssignment] = useState(null);
  const [houses, setHouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      // 1. Get publisher assignment details
      const assignRes = await api.get(`/assignments/publisher-assignments/${id}`);
      setAssignment(assignRes.data);

      // 2. Get houses and visit status in this block
      const housesRes = await api.get(`/assignments/publisher-assignments/${id}/houses`);
      setHouses(housesRes.data);
    } catch (error) {
      console.error('Error fetching block detail data:', error);
      toast.error('Erro ao carregar dados da quadra');
      navigate('/publisher');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleHouse = async (houseId, currentVisited) => {
    try {
      const targetVisited = !currentVisited;
      // Toggle in API (use parent assignment_id)
      await api.post(`/assignments/${assignment.assignment_id}/houses/${houseId}/toggle`, {
        visited: targetVisited
      });

      // Update local state
      setHouses(prev =>
        prev.map(h => (h.house_id === houseId ? { ...h, visited: targetVisited } : h))
      );
      toast.success(targetVisited ? 'Casa marcada como visitada' : 'Casa marcada como não visitada');
    } catch (error) {
      toast.error('Erro ao atualizar status da casa');
      console.error(error);
    }
  };

  const handleReturn = async () => {
    if (!confirm('Deseja realmente devolver este cartão ao dirigente?')) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post(`/assignments/publisher-assignments/${id}/return`);
      toast.success(`Cartão devolvido com sucesso! Cobertura final de ${res.data.percentage}%.`);
      navigate('/publisher');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao devolver cartão');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="spinner" />
      </div>
    );
  }

  if (!assignment) return null;

  const dueDate = parseISO(assignment.due_date);
  const isOverdue = isPast(dueDate);

  // Group houses by street
  const housesByStreet = {};
  for (const h of houses) {
    if (!housesByStreet[h.street_name]) {
      housesByStreet[h.street_name] = [];
    }
    housesByStreet[h.street_name].push(h);
  }

  // Calculate stats
  const totalHouses = houses.length;
  const visitedHouses = houses.filter(h => h.visited).length;
  const coveragePercentage = totalHouses > 0 ? Math.round((visitedHouses / totalHouses) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/publisher')}
          className="p-2 -ml-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
        </button>
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-800 dark:text-white">
            Território {assignment.territory_number} - Quadra {assignment.block_number}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{assignment.locality}</p>
        </div>
      </div>

      {/* Deadline Info */}
      <div className={`card p-4 border-l-4 ${isOverdue ? 'border-l-red-500 bg-red-50 dark:bg-red-950/20' : 'border-l-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/10'} flex items-center gap-3`}>
        <Clock className={`w-5 h-5 ${isOverdue ? 'text-red-500' : 'text-indigo-500'}`} />
        <div className="flex-1 text-sm">
          <p className={`font-semibold ${isOverdue ? 'text-red-800 dark:text-red-300' : 'text-indigo-800 dark:text-indigo-300'}`}>
            {isOverdue ? 'Prazo expirado!' : 'Atenção ao prazo'}
          </p>
          <p className={isOverdue ? 'text-red-600 dark:text-red-400' : 'text-indigo-600 dark:text-indigo-400'}>
            Prazo de 24h para devolução: {format(dueDate, "dd/MM 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
      </div>

      {/* Map Copy */}
      <div className="card overflow-hidden">
        <div className="card-header flex justify-between items-center">
          <h2 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Mapa do Território
          </h2>
          <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-3 py-1 rounded-full">
            Foque na Quadra {assignment.block_number}
          </span>
        </div>
        <MapViewer
          src={getMapUrl(assignment.map_filename)}
          alt={`Mapa do território ${assignment.territory_code}`}
          className="h-[350px]"
        />
      </div>

      {/* Progress Card */}
      <div className="card p-5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Progresso de Cobertura</span>
          <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{coveragePercentage}%</span>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
          <div
            className="bg-indigo-600 dark:bg-indigo-500 h-3 transition-all duration-500 rounded-full"
            style={{ width: `${coveragePercentage}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-2">
          <span>{visitedHouses} casas visitadas</span>
          <span>{totalHouses} casas no total</span>
        </div>
      </div>

      {/* Streets and Houses List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Lista de Ruas e Casas
        </h2>

        {Object.keys(housesByStreet).length === 0 ? (
          <div className="card p-6 text-center text-slate-500 dark:text-slate-400">
            Nenhuma rua ou casa cadastrada para esta quadra. Contate o administrador.
          </div>
        ) : (
          Object.entries(housesByStreet).map(([streetName, streetHouses]) => (
            <div key={streetName} className="card">
              <div className="card-header bg-slate-50/50 dark:bg-slate-800/30">
                <h3 className="font-semibold text-slate-800 dark:text-white">{streetName}</h3>
              </div>
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {streetHouses.map((house) => (
                  <button
                    key={house.house_id}
                    onClick={() => handleToggleHouse(house.house_id, house.visited)}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                      house.visited
                        ? 'bg-emerald-50/40 border-emerald-200 dark:bg-emerald-950/10 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300'
                        : 'bg-white border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700/50 text-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {house.visited ? (
                      <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    )}
                    <span className="font-semibold text-base">Nº {house.house_number}</span>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Return Action Button */}
      <div className="pt-4">
        <button
          onClick={handleReturn}
          disabled={submitting}
          className="btn btn-primary w-full py-4 text-base shadow-lg"
        >
          <Send className="w-5 h-5" />
          {submitting ? 'Enviando...' : 'Devolver Cartão ao Dirigente'}
        </button>
      </div>
    </div>
  );
}

export default PublisherBlockDetail;
