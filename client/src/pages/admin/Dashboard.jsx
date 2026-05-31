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
  Users,
  ClipboardList,
  AlertTriangle,
  Clock,
  CheckCircle,
  TrendingUp,
  Calendar,
  ChevronRight,
  LayoutGrid
} from 'lucide-react';
import { format, formatDistanceToNow, isPast, parseISO, addDays, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [activeAssignments, setActiveAssignments] = useState([]);
  const [myAssignments, setMyAssignments] = useState([]);
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
      const [statsRes, assignmentsRes] = await Promise.all([
        api.get('/reports/dashboard-stats'),
        api.get('/assignments/active')
      ]);
      setStats(statsRes.data);
      setActiveAssignments(assignmentsRes.data);
      
      // Filter assignments where current user is the dirigente (own assignments)
      const userAssignments = assignmentsRes.data.filter(a => a.dirigente_id === user?.id);
      setMyAssignments(userAssignments);
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

  const statCards = [
    {
      label: 'Territórios',
      value: stats?.totalTerritories || 0,
      icon: MapPin,
      color: 'bg-primary-500',
      link: '/admin/territories'
    },
    {
      label: 'Designações Ativas',
      value: stats?.activeAssignments || 0,
      icon: ClipboardList,
      color: 'bg-emerald-500',
      link: '/admin/assignments'
    },
    {
      label: 'Aguardando Validação',
      value: stats?.pendingValidations || 0,
      icon: Clock,
      color: 'bg-amber-500',
      link: '/admin/assignments'
    },
    {
      label: 'Dirigentes',
      value: stats?.totalDirigentes || 0,
      icon: Users,
      color: 'bg-violet-500',
      link: '/admin/users'
    },
  ];

  const pendingValidations = activeAssignments.filter(a => a.status === 'returned');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-800 dark:text-white">Meu Painel</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Visão geral do sistema</p>
        </div>
        <Link to="/admin/general-maps" className="btn btn-secondary">
          <LayoutGrid className="w-5 h-5" />
          Mapas Gerais
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <Link
            key={stat.label}
            to={stat.link}
            className="card p-4 hover:shadow-xl transition-all duration-300 group"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform`}>
              <stat.icon className="w-6 h-6 text-white" />
            </div>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{stat.value}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{stat.label}</p>
          </Link>
        ))}
      </div>

      {/* Alerts */}
      {(stats?.overdueAssignments > 0 || stats?.neverWorkedTerritories > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          {stats?.overdueAssignments > 0 && (
            <div className="card p-4 border-l-4 border-l-red-500">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-white">Designações Atrasadas</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {stats.overdueAssignments} designação(ões) passou(aram) da data de devolução
                  </p>
                </div>
              </div>
            </div>
          )}

          {stats?.neverWorkedTerritories > 0 && (
            <div className="card p-4 border-l-4 border-l-amber-500">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-white">Territórios Nunca Trabalhados</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {stats.neverWorkedTerritories} território(s) ainda não foi(ram) trabalhado(s)
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pending Validations */}
      {pendingValidations.length > 0 && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              Aguardando Validação
            </h2>
            <span className="w-6 h-6 bg-amber-500 text-white text-sm rounded-full flex items-center justify-center">
              {pendingValidations.length}
            </span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {pendingValidations.map(assignment => (
              <Link
                key={assignment.id}
                to={`/assignment/${assignment.id}`}
                className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="territory-number !w-10 !h-10 !text-sm">
                    {assignment.territory_number}
                  </div>
                  <div>
                    <p className="font-medium text-slate-800 dark:text-white">{assignment.locality}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Devolvido por {assignment.dirigente_name}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Active Assignments */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 dark:text-white">Designações Ativas</h2>
          <Link to="/admin/assignments" className="text-primary-600 dark:text-primary-400 text-sm font-medium hover:text-primary-700 dark:hover:text-primary-300">
            Ver todas
          </Link>
        </div>

        {activeAssignments.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Nenhuma designação ativa"
            description="Crie uma nova designação para começar"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Território
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Dirigente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Devolução
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {activeAssignments.filter(a => a.status !== 'returned').slice(0, 10).map(assignment => {
                  const dueDate = getDueDate(assignment);
                  const isOverdue = dueDate ? isPast(dueDate) : false;
                  return (
                    <tr key={assignment.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="territory-number !w-8 !h-8 !text-xs">
                            {assignment.territory_number}
                          </div>
                          <span className="font-medium text-slate-800 dark:text-white">{assignment.locality}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{assignment.dirigente_name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-slate-600 dark:text-slate-300'}`}>
                          {dueDate ? format(dueDate, "dd/MM/yyyy", { locale: ptBR }) : 'Sem prazo definido'}
                          {dueDate && isOverdue && ' (Atrasado)'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={assignment.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/assignment/${assignment.id}`}
                          className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium text-sm"
                        >
                          Detalhes
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* My Territories (Admin's own assignments) */}
      {myAssignments.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-slate-800 dark:text-white">Meus Territórios</h2>
          
          {myAssignments.map(assignment => {
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
                    Devolver até {getDueDate(assignment) ? format(getDueDate(assignment), "dd/MM/yyyy", { locale: ptBR }) : 'Sem prazo definido'}
                  </div>
                  <span className="text-primary-600 dark:text-primary-400 font-medium text-sm">Ver detalhes →</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Concluídos este mês</p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">{stats?.thisMonthCompletions || 0}</p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Notificações não lidas</p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">{stats?.unreadNotifications || 0}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;

