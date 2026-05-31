import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../../components/Modal';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import {
  Plus,
  ClipboardList,
  Calendar,
  User,
  ChevronRight,
  Search
} from 'lucide-react';
import { format, parseISO, isPast, addDays, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function AdminAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [territories, setTerritories] = useState([]);
  const [dirigentes, setDirigentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const toast = useToast();

  // Form state
  const [selectedTerritories, setSelectedTerritories] = useState([]);
  const [territorySearch, setTerritorySearch] = useState('');
  const [selectedDirigente, setSelectedDirigente] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      const [assignmentsRes, territoriesRes, usersRes] = await Promise.all([
        api.get('/assignments'),
        api.get('/territories/available'),
        api.get('/users/assignable')
      ]);
      setAssignments(assignmentsRes.data);
      setTerritories(territoriesRes.data);
      setDirigentes(usersRes.data || []);
      console.log('Assignable users:', usersRes.data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error(error.response?.data?.error || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    
    if (selectedTerritories.length === 0 || !selectedDirigente) {
      toast.error('Preencha todos os campos');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/assignments', {
        territory_ids: selectedTerritories.map(id => Number.parseInt(id, 10)),
        dirigente_id: Number.parseInt(selectedDirigente, 10)
      });
      toast.success('Designação criada com sucesso!');
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao criar designação');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTerritoryToggle = (idStr, isChecked) => {
    if (isChecked) {
      setSelectedTerritories(prev => [...prev, idStr]);
    } else {
      setSelectedTerritories(prev => prev.filter(x => x !== idStr));
    }
  };

  const resetForm = () => {
    setSelectedTerritories([]);
    setTerritorySearch('');
    setSelectedDirigente('');
  };

  const openModal = () => {
    resetForm();
    setShowModal(true);
  };

  const filteredAssignments = assignments.filter(a => {
    const matchesSearch = 
      a.territory_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.locality?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.dirigente_name?.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterStatus === 'active') {
      return matchesSearch && ['pending', 'in_progress', 'returned'].includes(a.status);
    } else if (filterStatus === 'completed') {
      return matchesSearch && a.status === 'completed';
    } else if (filterStatus === 'returned') {
      return matchesSearch && ['returned', 'cancelled'].includes(a.status);
    }
    return matchesSearch;
  });

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-800">Designações</h1>
          <p className="text-slate-500 text-sm mt-1">Gerencie as designações de territórios</p>
        </div>
        <button onClick={openModal} className="btn btn-primary">
          <Plus className="w-5 h-5" />
          Nova Designação
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por território, localidade ou dirigente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input !pl-12"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus('active')}
              className={`btn ${filterStatus === 'active' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Ativas
            </button>
            <button
              onClick={() => setFilterStatus('returned')}
              className={`btn ${filterStatus === 'returned' ? 'btn-warning' : 'btn-secondary'}`}
            >
              Devolvidas
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`btn ${filterStatus === 'completed' ? 'btn-success' : 'btn-secondary'}`}
            >
              Concluídas
            </button>
          </div>
        </div>
      </div>

      {/* Assignments List */}
      {filteredAssignments.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhuma designação encontrada"
          description={filterStatus === 'active' 
            ? 'Crie uma nova designação para começar'
            : 'Nenhuma designação com este filtro'
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredAssignments.map(assignment => {
            const dueDate = getDueDate(assignment);
            const isOverdue = assignment.status !== 'returned' && 
                              assignment.status !== 'completed' && 
                              (dueDate ? isPast(dueDate) : false);
            return (
              <Link
                key={assignment.id}
                to={`/assignment/${assignment.id}`}
                className="card p-4 block hover:shadow-xl transition-all duration-300"
              >
                <div className="flex items-center gap-4">
                  <div className="territory-number">
                    {assignment.territory_number}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-800 truncate">
                        Território: {assignment.territory_number}
                      </h3>
                      <StatusBadge status={assignment.status} />
                      {assignment.validation_result && (
                        <StatusBadge status={assignment.validation_result} type="result" />
                      )}
                    </div>
                    <p className="text-sm text-slate-500 truncate">{assignment.locality}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {assignment.dirigente_name}
                      </span>
                      <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500' : ''}`}>
                        <Calendar className="w-3.5 h-3.5" />
                        {dueDate ? format(dueDate, "dd/MM/yyyy", { locale: ptBR }) : 'Sem prazo definido'}
                        {dueDate && isOverdue && ' (Atrasado)'}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Assignment Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Nova Designação"
        size="md"
      >
        <form onSubmit={handleCreateAssignment} className="space-y-5">
          <div>
            <label htmlFor="territory-search" className="input-label">Territórios</label>
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                <input
                  id="territory-search"
                  type="text"
                  placeholder="Buscar por número ou localidade"
                  value={territorySearch}
                  onChange={(e) => setTerritorySearch(e.target.value)}
                  className="input !pl-12"
                />
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  className="btn btn-secondary !px-3 !py-1"
                  onClick={() => setSelectedTerritories([])}
                >
                  Limpar seleção
                </button>
                <span className="text-slate-500">{selectedTerritories.length} selecionado(s)</span>
              </div>
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl max-h-64 overflow-y-auto">
                {territories.length === 0 ? (
                  <div className="p-4 text-sm text-amber-600">Nenhum território disponível no momento</div>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                    {territories
                      .filter(t => `${t.territory_number} ${t.locality}`.toLowerCase().includes(territorySearch.toLowerCase()))
                      .sort((a, b) => Number.parseInt(a.territory_number, 10) - Number.parseInt(b.territory_number, 10))
                      .map(t => {
                        const idStr = String(t.id);
                        const checked = selectedTerritories.includes(idStr);
                        return (
                          <li key={t.id} className="flex items-center justify-between p-3">
                            <label className="flex items-center gap-3 flex-1">
                              <input
                                type="checkbox"
                                className="checkbox"
                                checked={checked}
                                onChange={(e) => handleTerritoryToggle(idStr, e.target.checked)}
                              />
                              <span className="font-medium text-slate-800 dark:text-slate-100">Território: {t.territory_number}</span>
                            </label>
                            <span className="text-xs text-slate-500 dark:text-slate-400">{t.locality} • {t.block_count} quadras</span>
                          </li>
                        );
                      })}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="dirigente-select" className="input-label">Dirigente</label>
            <select
              id="dirigente-select"
              value={selectedDirigente}
              onChange={(e) => setSelectedDirigente(e.target.value)}
              className="input"
              required
            >
              <option value="">Selecione um dirigente</option>
              {dirigentes.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="btn btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || territories.length === 0 || selectedTerritories.length === 0}
              className="btn btn-primary flex-1"
            >
              {submitting ? <div className="spinner" /> : 'Criar Designação'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default AdminAssignments;

