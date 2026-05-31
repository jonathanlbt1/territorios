import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import { getMapUrl } from '../../utils/mapUrl';
import {
  MapPin,
  Calendar,
  Clock,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Map
} from 'lucide-react';
import { format, parseISO, isPast, formatDistanceToNow, addDays, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function DirigenteDashboard() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const getDueDate = (assignment) => {
    if (!assignment) return null;
    if (assignment.due_date) {
      const parsed = parseISO(assignment.due_date);
      return isValid(parsed) ? parsed : null;
    }
    if (assignment.assigned_date) {
      const parsed = parseISO(assignment.assigned_date);
      return isValid(parsed) ? addDays(parsed, 60) : null;
    }
    return null;
  };

  const fetchData = async () => {
    try {
      const [assignmentsRes, statsRes] = await Promise.all([
        api.get('/assignments/active'),
        api.get('/reports/dashboard-stats')
      ]);
      setAssignments(assignmentsRes.data);
      setStats(statsRes.data);
    } catch {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="spinner" />
      </div>
    );
  }

  const hasAssignments = assignments.length > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-slate-800 dark:text-white">
          Olá, {user?.name?.split(' ')[0]}! 👋
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          {hasAssignments 
            ? `Você tem ${assignments.length} território(s) designado(s)`
            : 'Você não tem territórios designados no momento'
          }
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats?.myActiveAssignments || 0}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Ativos</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats?.myCompletedThisMonth || 0}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Este mês</p>
            </div>
          </div>
        </div>
      </div>

      {/* Assignments */}
      {hasAssignments ? (
        <div className="space-y-4">
          <h2 className="font-semibold text-slate-800 dark:text-white">Seus Territórios</h2>
          
          {assignments.map(assignment => {
            const dueDate = getDueDate(assignment);
            const isOverdue = dueDate ? isPast(dueDate) : false;
            const daysLeft = dueDate
              ? formatDistanceToNow(dueDate, { addSuffix: true, locale: ptBR })
              : 'Sem prazo definido';

            return (
              <Link
                key={assignment.id}
                to={`/assignment/${assignment.id}`}
                className="card block overflow-hidden hover:shadow-xl transition-all duration-300"
              >
                {/* Alert Banner */}
                {isOverdue && (
                  <div className="bg-red-500 text-white px-4 py-2 flex items-center gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    Prazo de devolução expirado!
                  </div>
                )}

                <div className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="territory-number">
                      {assignment.territory_number}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-800 dark:text-white">
                          Território: {assignment.territory_number}
                        </h3>
                        <StatusBadge status={assignment.status} />
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{assignment.locality}</p>
                      
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {assignment.block_count} quadras
                        </span>
                        <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 font-medium' : ''}`}>
                          <Clock className="w-3.5 h-3.5" />
                          {isOverdue ? 'Atrasado' : daysLeft}
                        </span>
                      </div>
                    </div>

                    <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0 self-center" />
                  </div>
                </div>

                {/* Observations */}
                {assignment.observations && (
                  <div className="px-4 pb-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Observações:</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">
                      {assignment.observations}
                    </p>
                  </div>
                )}

                {/* Map Preview */}
                <div className="h-48 bg-slate-100 dark:bg-slate-800">
                  <img 
                    src={getMapUrl(assignment.map_filename)}
                    alt={`Mapa ${assignment.territory_code}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.parentElement.innerHTML = '<div class="flex items-center justify-center h-full text-slate-400">Mapa não disponível</div>';
                    }}
                  />
                </div>

                {/* Footer */}
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/50 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <Calendar className="w-4 h-4" />
                    Devolver até {dueDate ? format(dueDate, "dd/MM/yyyy", { locale: ptBR }) : 'Sem prazo definido'}
                  </div>
                  <span className="text-primary-600 dark:text-primary-400 font-medium text-sm">Ver detalhes →</span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Map}
          title="Nenhum território designado"
          description="Quando o administrador designar um território para você, ele aparecerá aqui"
        />
      )}

      {/* Instructions */}
      <div className="card p-5 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
        <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-2">📋 Como funciona</h3>
        <ul className="text-sm text-amber-700 dark:text-amber-400 space-y-1">
          <li>1. Clique em um território para ver o mapa completo</li>
          <li>2. Ao terminar, marque as quadras trabalhadas</li>
          <li>3. Adicione observações se necessário</li>
          <li>4. Clique em "Devolver Território"</li>
        </ul>
      </div>
    </div>
  );
}

export default DirigenteDashboard;

