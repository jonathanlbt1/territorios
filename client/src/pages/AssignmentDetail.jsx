import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import MapViewer from '../components/MapViewer';
import { getMapUrl } from '../utils/mapUrl';
import BlockSelector from '../components/BlockSelector';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  User,
  Clock,
  Grid,
  Send,
  CheckCircle,
  AlertCircle,
  XCircle,
  FileText,
  Plus,
  Trash2
} from 'lucide-react';
import { format, parseISO, isPast, addDays, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Helper function to calculate due date
function calculateDueDate(assignment) {
  if (assignment.due_date) {
    const parsed = parseISO(assignment.due_date);
    return isValid(parsed) ? parsed : null;
  }
  if (assignment.assigned_date) {
    const parsed = parseISO(assignment.assigned_date);
    return isValid(parsed) ? addDays(parsed, 60) : null;
  }
  return null;
}

// Helper function to get display date based on status
function getDisplayDate(assignment, dueDate) {
  const { status, returned_at, validated_at } = assignment;
  
  if (['pending', 'in_progress'].includes(status)) {
    return dueDate ? format(dueDate, "dd/MM/yyyy", { locale: ptBR }) : 'Sem prazo definido';
  }
  if (status === 'returned' && returned_at) {
    return format(parseISO(returned_at), "dd/MM/yyyy", { locale: ptBR });
  }
  if (status === 'completed' && validated_at) {
    return format(parseISO(validated_at), "dd/MM/yyyy", { locale: ptBR });
  }
  return 'Data não disponível';
}

// Helper function to get date label
function getDateLabel(status) {
  if (['pending', 'in_progress'].includes(status)) return 'Devolver até';
  if (status === 'returned') return 'Devolvido em';
  return 'Data';
}

// Sub-component: Overdue Alert
function OverdueAlert({ show }) {
  if (!show) return null;
  return (
    <div className="card p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 flex items-center gap-3">
      <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" />
      <div>
        <p className="font-semibold text-red-800 dark:text-red-300">Prazo de devolução expirado!</p>
        <p className="text-sm text-red-600 dark:text-red-400">Por favor, devolva o território o mais rápido possível.</p>
      </div>
    </div>
  );
}

OverdueAlert.propTypes = {
  show: PropTypes.bool.isRequired,
};

// Sub-component: Validation Alert for Admin
function ValidationAlert({ show, onValidate }) {
  if (!show) return null;
  return (
    <div className="card p-4 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <div>
          <p className="font-semibold text-amber-800 dark:text-amber-300">Aguardando validação</p>
          <p className="text-sm text-amber-600 dark:text-amber-400">Revise as informações e valide a devolução.</p>
        </div>
      </div>
      <button onClick={onValidate} className="btn btn-warning">
        Validar
      </button>
    </div>
  );
}

ValidationAlert.propTypes = {
  show: PropTypes.bool.isRequired,
  onValidate: PropTypes.func.isRequired,
};

// Sub-component: Validation Result Preview
function ValidationResultPreview({ validationBlocks, totalBlocks, discardAssignment }) {
  if (discardAssignment) {
    return (
      <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Resultado:</p>
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <XCircle className="w-5 h-5" />
          <span className="font-medium">Designação será descartada e removida do histórico</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Resultado automático:</p>
      {validationBlocks.length === 0 && (
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <XCircle className="w-5 h-5" />
          <span className="font-medium">Território não feito</span>
        </div>
      )}
      {validationBlocks.length > 0 && validationBlocks.length < totalBlocks && (
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">Território parcialmente trabalhado</span>
        </div>
      )}
      {validationBlocks.length === totalBlocks && (
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">Território trabalhado por completo</span>
        </div>
      )}
    </div>
  );
}

ValidationResultPreview.propTypes = {
  validationBlocks: PropTypes.array.isRequired,
  totalBlocks: PropTypes.number.isRequired,
  discardAssignment: PropTypes.bool.isRequired,
};

// Sub-component: Returned Info Section
function ReturnedInfoSection({ assignment }) {
  if (assignment.status !== 'returned') return null;
  
  return (
    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
      {assignment.not_worked ? (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-xl">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Território devolvido sem ter sido trabalhado</span>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Quadras Trabalhadas</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {assignment.blocks_worked?.length > 0 ? (
              assignment.blocks_worked.map(block => (
                <span key={block} className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg flex items-center justify-center font-semibold text-sm">
                  {block}
                </span>
              ))
            ) : (
              <span className="text-sm text-slate-500 dark:text-slate-400">Nenhuma quadra informada</span>
            )}
          </div>
        </div>
      )}
      {assignment.return_observations && (
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Observações do Dirigente</p>
          <p className="text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl text-sm mt-1">
            {assignment.return_observations}
          </p>
        </div>
      )}
    </div>
  );
}

ReturnedInfoSection.propTypes = {
  assignment: PropTypes.object.isRequired,
};

// Sub-component: Completed Info Section
function CompletedInfoSection({ assignment }) {
  if (assignment.status !== 'completed') return null;
  
  const validatedAt = assignment.validated_at && isValid(parseISO(assignment.validated_at))
    ? `Validado em ${format(parseISO(assignment.validated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
    : 'Validação concluída';

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
      <div className="flex items-center gap-2 mb-3">
        <StatusBadge status={assignment.validation_result} type="result" />
        <span className="text-sm text-slate-500 dark:text-slate-400">{validatedAt}</span>
      </div>
    </div>
  );
}

CompletedInfoSection.propTypes = {
  assignment: PropTypes.object.isRequired,
};

function AssignmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  // Return form state
  const [blocksWorked, setBlocksWorked] = useState([]);
  const [lockedBlocks, setLockedBlocks] = useState([]);
  const [observations, setObservations] = useState('');
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showValidateModal, setShowValidateModal] = useState(false);
  const [showRefuseModal, setShowRefuseModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Refuse form state
  const [refuseReason, setRefuseReason] = useState('');

  // Validation form state
  const [validationBlocks, setValidationBlocks] = useState([]);
  const [validationObservations, setValidationObservations] = useState('');

  // Not worked state
  const [notWorked, setNotWorked] = useState(false);
  const [discardAssignment, setDiscardAssignment] = useState(false);

  // New states for publisher assignment and street/house management
  const [blockDetails, rawSetBlockDetails] = useState([]);
  const [streets, rawSetStreets] = useState([]);
  const [publishers, rawSetPublishers] = useState([]);

  const setBlockDetails = (val) => rawSetBlockDetails(Array.isArray(val) ? val : []);
  const setStreets = (val) => rawSetStreets(Array.isArray(val) ? val : []);
  const setPublishers = (val) => rawSetPublishers(Array.isArray(val) ? val : []);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedBlockForAssign, setSelectedBlockForAssign] = useState(null);
  const [selectedPublisherId, setSelectedPublisherId] = useState('');
  const [showManageStreetsModal, setShowManageStreetsModal] = useState(false);
  const [newStreetName, setNewStreetName] = useState('');
  const [newStreetBlock, setNewStreetBlock] = useState(1);
  const [newHouseNumber, setNewHouseNumber] = useState('');
  const [selectedStreetForHouse, setSelectedStreetForHouse] = useState('');

  useEffect(() => {
    fetchAssignment();
  }, [id]);

  const fetchAssignment = async () => {
    try {
      const response = await api.get(`/assignments/${id}`);
      const data = response.data;
      setAssignment(data);
      setBlocksWorked(data.blocks_worked || []);
      setLockedBlocks(data.partial_blocks_worked || []);
      setObservations(data.return_observations || '');

      // Load block details
      const blockDetailsRes = await api.get(`/assignments/${id}/block-details`);
      setBlockDetails(blockDetailsRes.data);

      // Load streets/houses
      const housesRes = await api.get(`/assignments/${id}/houses`);
      setStreets(housesRes.data);
    } catch (error) {
      console.error('Fetch assignment error:', error);
      toast.error(error.response?.data?.error || 'Erro ao carregar designação');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleHouse = async (houseId, currentVisited) => {
    try {
      const targetVisited = !currentVisited;
      await api.post(`/assignments/${id}/houses/${houseId}/toggle`, {
        visited: targetVisited
      });
      toast.success(targetVisited ? 'Casa marcada como visitada' : 'Casa marcada como não visitada');
      
      // Refresh details
      const blockDetailsRes = await api.get(`/assignments/${id}/block-details`);
      setBlockDetails(blockDetailsRes.data);
      const housesRes = await api.get(`/assignments/${id}/houses`);
      setStreets(housesRes.data);
    } catch {
      toast.error('Erro ao alternar status da casa');
    }
  };

  const handleToggleBlock = async (blockNum, currentChecked) => {
    try {
      const targetChecked = !currentChecked;
      const res = await api.post(`/assignments/${id}/blocks/${blockNum}/toggle`, {
        checked: targetChecked
      });
      toast.success(targetChecked ? `Quadra ${blockNum} e suas casas marcadas` : `Quadra ${blockNum} e suas casas desmarcadas`);
      
      setBlocksWorked(res.data.blocks_worked || []);

      // Refresh details
      const blockDetailsRes = await api.get(`/assignments/${id}/block-details`);
      setBlockDetails(blockDetailsRes.data);
      const housesRes = await api.get(`/assignments/${id}/houses`);
      setStreets(housesRes.data);
    } catch {
      toast.error('Erro ao alternar status da quadra');
    }
  };

  const openAssignModal = async (blockNum) => {
    setSelectedBlockForAssign(blockNum);
    setSelectedPublisherId('');
    setShowAssignModal(true);
    try {
      const res = await api.get('/users/publishers');
      setPublishers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssignPublisher = async (e) => {
    e.preventDefault();
    if (!selectedPublisherId) {
      toast.error('Selecione um publicador');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/assignments/${id}/publisher-assignments`, {
        block_number: selectedBlockForAssign,
        publisher_id: selectedPublisherId
      });
      toast.success(`Quadra ${selectedBlockForAssign} designada com sucesso!`);
      setShowAssignModal(false);
      
      // Refresh details
      const blockDetailsRes = await api.get(`/assignments/${id}/block-details`);
      setBlockDetails(blockDetailsRes.data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao designar quadra');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddStreet = async (e) => {
    e.preventDefault();
    if (!newStreetName.trim() || !newStreetBlock) return;
    try {
      await api.post(`/territories/${assignment.territory_id}/streets`, {
        name: newStreetName,
        block_number: newStreetBlock
      });
      toast.success('Rua adicionada com sucesso!');
      setNewStreetName('');
      
      // Refresh streets and block details
      const housesRes = await api.get(`/assignments/${id}/houses`);
      setStreets(housesRes.data);
      const blockDetailsRes = await api.get(`/assignments/${id}/block-details`);
      setBlockDetails(blockDetailsRes.data);
    } catch {
      toast.error('Erro ao adicionar rua');
    }
  };

  const handleDeleteStreet = async (streetId) => {
    if (!confirm('Deseja realmente excluir esta rua? Todas as casas associadas também serão excluídas.')) return;
    try {
      await api.delete(`/territories/streets/${streetId}`);
      toast.success('Rua excluída com sucesso!');
      
      // Refresh streets and block details
      const housesRes = await api.get(`/assignments/${id}/houses`);
      setStreets(housesRes.data);
      const blockDetailsRes = await api.get(`/assignments/${id}/block-details`);
      setBlockDetails(blockDetailsRes.data);
    } catch {
      toast.error('Erro ao excluir rua');
    }
  };

  const handleAddHouse = async (e) => {
    e.preventDefault();
    if (!newHouseNumber.trim() || !selectedStreetForHouse) return;
    try {
      await api.post(`/territories/streets/${selectedStreetForHouse}/houses`, {
        number: newHouseNumber
      });
      toast.success('Casa adicionada com sucesso!');
      setNewHouseNumber('');
      
      // Refresh streets and block details
      const housesRes = await api.get(`/assignments/${id}/houses`);
      setStreets(housesRes.data);
      const blockDetailsRes = await api.get(`/assignments/${id}/block-details`);
      setBlockDetails(blockDetailsRes.data);
    } catch {
      toast.error('Erro ao adicionar casa');
    }
  };

  const handleDeleteHouse = async (houseId) => {
    if (!confirm('Deseja realmente excluir esta casa?')) return;
    try {
      await api.delete(`/territories/streets/houses/${houseId}`);
      toast.success('Casa excluída com sucesso!');
      
      // Refresh streets and block details
      const housesRes = await api.get(`/assignments/${id}/houses`);
      setStreets(housesRes.data);
      const blockDetailsRes = await api.get(`/assignments/${id}/block-details`);
      setBlockDetails(blockDetailsRes.data);
    } catch {
      toast.error('Erro ao excluir casa');
    }
  };

  const calculateAllBlocks = () => {
    if (notWorked) return [];
    return Array.from(new Set([...(lockedBlocks || []), ...blocksWorked])).sort((a, b) => a - b);
  };

  const handleReturn = async () => {
    const allBlocks = calculateAllBlocks();

    if (!notWorked && allBlocks.length === 0) {
      toast.error('Selecione pelo menos uma quadra trabalhada ou marque "Devolver território não trabalhado"');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/assignments/${id}/return`, {
        blocks_worked: allBlocks,
        observations,
        not_worked: notWorked
      });
      toast.success('Território devolvido com sucesso! Aguardando validação do administrador.');
      setShowReturnModal(false);
      setNotWorked(false);
      fetchAssignment();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao devolver território');
    } finally {
      setSubmitting(false);
    }
  };

  const openValidateModal = () => {
    setValidationBlocks(assignment.blocks_worked || []);
    setValidationObservations(assignment.return_observations || '');
    setDiscardAssignment(assignment.not_worked || false);
    setShowValidateModal(true);
  };

  const handleValidate = async () => {
    if (!discardAssignment && validationBlocks.length === 0) {
      toast.error('Selecione pelo menos uma quadra validada ou marque para descartar a designação');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/assignments/${id}/validate`, {
        blocks_worked: discardAssignment ? [] : validationBlocks,
        observations: validationObservations,
        discard_assignment: discardAssignment
      });
      
      const message = discardAssignment 
        ? 'Designação descartada! O território voltou ao estoque.'
        : 'Validação concluída com sucesso!';
      toast.success(message);
      setShowValidateModal(false);
      navigate('/admin/assignments');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao validar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartWork = async () => {
    try {
      await api.post(`/assignments/${id}/start`);
      toast.success('Designação aceita! O administrador foi notificado.');
      fetchAssignment();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao aceitar designação');
    }
  };

  const handleRefuse = async () => {
    if (!refuseReason.trim()) {
      toast.error('Por favor, informe um motivo para a recusa');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/assignments/${id}/refuse`, { reason: refuseReason });
      toast.success('Designação recusada. O administrador foi notificado.');
      setShowRefuseModal(false);
      navigate('/dirigente');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao recusar designação');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!globalThis.confirm('Deseja realmente cancelar esta designação?')) return;
    
    try {
      await api.post(`/assignments/${id}/cancel`);
      toast.success('Designação cancelada');
      navigate('/admin/assignments');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao cancelar');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="spinner" />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Designação não encontrada</p>
      </div>
    );
  }

  const dueDate = calculateDueDate(assignment);
  const isMyAssignment = assignment.dirigente_id === user.id;
  const isOverdue = dueDate ? isPast(dueDate) : false;
  const canReturn = isMyAssignment && assignment.status === 'in_progress';
  const canRespondToPending = isMyAssignment && assignment.status === 'pending';
  const canValidate = isAdmin && assignment.status === 'returned';
  const canCancel = isAdmin && !isMyAssignment && ['pending', 'in_progress'].includes(assignment.status);
  const showOverdueAlert = isOverdue && assignment.status !== 'returned' && assignment.status !== 'completed';
  const hasActivePublisherAssignments = Array.isArray(blockDetails) && blockDetails.some(
    block => block.publisher_assignment && block.publisher_assignment.status === 'in_progress'
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-display font-bold text-slate-800 dark:text-white">
              Território {assignment.territory_number}
            </h1>
            <StatusBadge status={assignment.status} />
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Território: {assignment.territory_number} - {assignment.locality}</p>
        </div>
      </div>

      {/* Alerts */}
      <OverdueAlert show={showOverdueAlert} />
      <ValidationAlert show={canValidate} onValidate={openValidateModal} />

      {/* Map */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <h2 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            Mapa do Território
          </h2>
        </div>
        <MapViewer
          src={getMapUrl(assignment.map_filename)}
          alt={`Mapa do território ${assignment.territory_code}`}
          className="h-[400px]"
        />
      </div>

      {/* Quadras e Casas */}
      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h2 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <Grid className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            Quadras e Casas
          </h2>
          {isAdmin && (
            <button
              onClick={() => {
                setNewStreetBlock(1);
                setSelectedStreetForHouse('');
                setShowManageStreetsModal(true);
              }}
              className="btn btn-secondary py-1.5 px-3 text-xs"
            >
              Gerenciar Ruas/Casas
            </button>
          )}
        </div>
        <div className="p-6 space-y-6">
          {blockDetails.map((block) => {
            const isBlockWorked = blocksWorked.includes(block.block_number);
            const pubAssign = block.publisher_assignment;
            
            // Get streets and houses in this block
            const blockHouses = streets.filter(h => h.block_number === block.block_number);
            
            // Group houses by street name
            const groupedHouses = {};
            for (const h of blockHouses) {
              if (h.house_id) {
                if (!groupedHouses[h.street_name]) {
                  groupedHouses[h.street_name] = [];
                }
                groupedHouses[h.street_name].push(h);
              }
            }

            return (
              <div key={block.block_number} className="border border-slate-100 dark:border-slate-700/60 rounded-2xl p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/50">
                  <div className="flex items-center gap-3">
                    {isAdmin ? (
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isBlockWorked}
                          onChange={() => handleToggleBlock(block.block_number, isBlockWorked)}
                          aria-label={`Marcar quadra ${block.block_number}`}
                          className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="font-bold text-lg text-slate-800 dark:text-white">
                          Quadra {block.block_number}
                        </span>
                      </label>
                    ) : (
                      <span className="font-bold text-lg text-slate-800 dark:text-white">
                        Quadra {block.block_number}
                      </span>
                    )}

                    <span className="bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                      {block.percentage}% coberto
                    </span>
                  </div>

                  {/* Publisher Assignment Info */}
                  <div className="flex items-center gap-2">
                    {pubAssign ? (
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded text-xs font-semibold ${
                          pubAssign.status === 'in_progress'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                        }`}>
                          {pubAssign.status === 'in_progress' ? 'Em andamento' : 'Devolvido'} • {pubAssign.publisher_name}
                        </span>
                        {(isAdmin || isMyAssignment) && pubAssign.status === 'in_progress' && (
                          <button
                            onClick={() => openAssignModal(block.block_number)}
                            className="text-xs text-slate-500 hover:text-primary-600 underline"
                          >
                            Reatribuir
                          </button>
                        )}
                      </div>
                    ) : (
                      (isAdmin || isMyAssignment) && (assignment.status === 'pending' || assignment.status === 'in_progress') && (
                        <button
                          onClick={() => openAssignModal(block.block_number)}
                          className="btn btn-secondary py-1 px-2.5 text-xs font-medium"
                        >
                          Designar Publicador
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 dark:bg-slate-700/60 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 dark:bg-indigo-500 h-1.5 transition-all duration-300"
                    style={{ width: `${block.percentage}%` }}
                  />
                </div>

                {/* Streets and Houses in this block */}
                <div className="space-y-3 pt-2">
                  {Object.keys(groupedHouses).length === 0 ? (
                    <p className="text-xs text-slate-400">Nenhuma rua ou casa cadastrada para esta quadra.</p>
                  ) : (
                    Object.entries(groupedHouses).map(([streetName, streetHouses]) => (
                      <div key={streetName} className="space-y-1.5">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{streetName}</span>
                        <div className="flex flex-wrap gap-2">
                          {streetHouses.map((house) => (
                            <button
                              key={house.house_id}
                              onClick={() => (isAdmin || isMyAssignment) && (assignment.status === 'pending' || assignment.status === 'in_progress') && handleToggleHouse(house.house_id, house.visited)}
                              disabled={!(isAdmin || isMyAssignment) || !(assignment.status === 'pending' || assignment.status === 'in_progress')}
                              className={`flex items-center gap-1.5 py-1 px-2.5 rounded-lg border text-xs font-semibold transition-all ${
                                house.visited
                                  ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                                  : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${house.visited ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                              Nº {house.house_number}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Details */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-slate-800 dark:text-white">Informações</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <MapPin className="w-4 h-4" /> Localidade
              </p>
              <p className="font-medium text-slate-800 dark:text-white">{assignment.locality}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Grid className="w-4 h-4" /> Quadras
              </p>
              <p className="font-medium text-slate-800 dark:text-white">{assignment.block_count}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <User className="w-4 h-4" /> Dirigente
              </p>
              <p className="font-medium text-slate-800 dark:text-white">{assignment.dirigente_name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Calendar className="w-4 h-4" /> {getDateLabel(assignment.status)}
              </p>
              <p className={`font-medium ${isOverdue && ['pending', 'in_progress'].includes(assignment.status) ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-white'}`}>
                {getDisplayDate(assignment, dueDate)}
              </p>
            </div>
          </div>

          {assignment.territory_observations && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
              <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1">
                <FileText className="w-4 h-4" /> Observações do Território
              </p>
              <p className="text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl text-sm">
                {assignment.territory_observations}
              </p>
            </div>
          )}

          <ReturnedInfoSection assignment={assignment} />
          <CompletedInfoSection assignment={assignment} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        {/* Accept Button */}
        {canRespondToPending && (
          <button
            onClick={handleStartWork}
            className="btn bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white w-full py-4"
          >
            <Clock className="w-5 h-5" />
            Aceitar Designação
          </button>
        )}

        {/* Return Button */}
        {isMyAssignment && canReturn && (
          <div className="w-full space-y-2">
            {hasActivePublisherAssignments && (
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200 dark:border-amber-900/30 flex items-start gap-2">
                <span className="text-base select-none">⚠️</span>
                <span>Existem quadras pendentes com publicadores. Você só poderá devolver este território ao administrador depois que todos os publicadores devolverem as quadras designadas.</span>
              </p>
            )}
            <button
              onClick={() => {
                if (hasActivePublisherAssignments) {
                  toast.error('Você não pode devolver o território até que todas as quadras designadas aos publicadores tenham sido devolvidas.');
                } else {
                  setShowReturnModal(true);
                }
              }}
              className="btn btn-primary w-full py-4"
              disabled={hasActivePublisherAssignments}
            >
              <Send className="w-5 h-5" />
              Devolver Território
            </button>
          </div>
        )}

        {/* Refuse Button */}
        {canRespondToPending && (
          <button
            onClick={() => setShowRefuseModal(true)}
            className="btn bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 text-white w-full py-4"
          >
            <XCircle className="w-5 h-5" />
            Recusar Designação
          </button>
        )}

        {/* Cancel Button (Admin) */}
        {canCancel && (
          <button
            onClick={handleCancel}
            className="btn btn-danger w-full py-4"
          >
            <XCircle className="w-5 h-5" />
            Cancelar Designação
          </button>
        )}
      </div>

      {/* Return Modal */}
      <Modal
        isOpen={showReturnModal}
        onClose={() => { setShowReturnModal(false); setNotWorked(false); }}
        title="Devolver Território"
        size="lg"
      >
        <div className="space-y-6">
          {/* Checkbox para território não trabalhado */}
          <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notWorked}
                onChange={(e) => {
                  setNotWorked(e.target.checked);
                  if (e.target.checked) {
                    setBlocksWorked([]);
                  }
                }}
                aria-label="Devolver território não trabalhado"
                className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
              />
              <div>
                <span className="font-medium text-slate-800 dark:text-white">Devolver território não trabalhado</span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Marque esta opção se você não conseguiu trabalhar nenhuma quadra deste território
                </p>
              </div>
            </label>
          </div>

          {!notWorked && (
            <BlockSelector
              totalBlocks={assignment.block_count}
              selectedBlocks={blocksWorked}
              onChange={setBlocksWorked}
              lockedBlocks={lockedBlocks}
            />
          )}

          {notWorked && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-xl">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <strong>Atenção:</strong> Ao devolver o território sem ter trabalhado, o administrador poderá 
                optar por descartar esta designação, fazendo com que o território volte ao estoque como se 
                nunca tivesse sido designado.
              </p>
            </div>
          )}

          <div>
            <label className="input-label">Observações {notWorked ? '(opcional - explique o motivo)' : '(opcional)'}</label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="input min-h-[100px] resize-none"
              placeholder={notWorked 
                ? "Explique por que não conseguiu trabalhar o território..." 
                : "Adicione observações sobre o trabalho realizado..."
              }
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setShowReturnModal(false); setNotWorked(false); }}
              className="btn btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              onClick={handleReturn}
              disabled={submitting || (!notWorked && lockedBlocks.length === 0 && blocksWorked.length === 0)}
              className="btn btn-primary flex-1"
            >
              {submitting && <div className="spinner" />}
              {!submitting && <><Send className="w-5 h-5" />Devolver</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* Validate Modal */}
      <Modal
        isOpen={showValidateModal}
        onClose={() => { setShowValidateModal(false); setDiscardAssignment(false); }}
        title="Validar Devolução"
        size="lg"
      >
        <div className="space-y-6">
          {/* Alert if territory was returned as not worked */}
          {assignment.not_worked && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-300">
                    Território devolvido sem ter sido trabalhado
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                    O dirigente informou que não conseguiu trabalhar nenhuma quadra deste território.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Discard option */}
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={discardAssignment}
                onChange={(e) => {
                  setDiscardAssignment(e.target.checked);
                  if (e.target.checked) setValidationBlocks([]);
                }}
                aria-label="Descartar designação (território não trabalhado)"
                className="w-5 h-5 mt-0.5 rounded border-red-300 dark:border-red-600 text-red-600 focus:ring-red-500"
              />
              <div>
                <span className="font-medium text-red-800 dark:text-red-300">Descartar designação (território não trabalhado)</span>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  Ao marcar esta opção, a designação será completamente removida do histórico e do Formulário S-13. 
                  O território voltará ao estoque como se nunca tivesse sido designado.
                </p>
              </div>
            </label>
          </div>

          {/* Validation form (hidden when discarding) */}
          {!discardAssignment && (
            <>
              <div className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 p-4 rounded-xl">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  <strong>Dica:</strong> Você pode ajustar as quadras trabalhadas e as observações. 
                  O sistema determinará automaticamente se o território foi trabalhado por completo, parcialmente ou não foi feito.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="input-label">Quadras Validadas</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {validationBlocks.length} de {assignment.block_count} quadras
                  </span>
                </div>
                <BlockSelector
                  totalBlocks={assignment.block_count}
                  selectedBlocks={validationBlocks}
                  onChange={setValidationBlocks}
                />
              </div>

              <div>
                <label htmlFor="validation-observations" className="input-label">Observações</label>
                <textarea
                  id="validation-observations"
                  value={validationObservations}
                  onChange={(e) => setValidationObservations(e.target.value)}
                  className="input min-h-[100px] resize-none"
                  placeholder="Observações sobre a validação (serão salvas no território)..."
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Estas observações serão salvas no cartão do território e ficarão visíveis para todos.
                </p>
              </div>
            </>
          )}

          <ValidationResultPreview 
            validationBlocks={validationBlocks} 
            totalBlocks={assignment.block_count} 
            discardAssignment={discardAssignment} 
          />

          <div className="flex gap-3">
            <button
              onClick={() => { setShowValidateModal(false); setDiscardAssignment(false); }}
              className="btn btn-secondary flex-1"
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              onClick={handleValidate}
              disabled={submitting || (!discardAssignment && validationBlocks.length === 0)}
              className={`flex-1 ${discardAssignment ? 'btn bg-red-600 hover:bg-red-700 text-white' : 'btn btn-primary'}`}
            >
              {submitting && <div className="spinner" />}
              {!submitting && discardAssignment && <><XCircle className="w-5 h-5" />Descartar Designação</>}
              {!submitting && !discardAssignment && <><CheckCircle className="w-5 h-5" />Confirmar Validação</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* Refuse Modal */}
      <Modal
        isOpen={showRefuseModal}
        onClose={() => setShowRefuseModal(false)}
        title="Recusar Designação"
        size="md"
      >
        <div className="space-y-6">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl">
            <p className="text-sm text-red-800 dark:text-red-300">
              Você está prestes a recusar a designação do território <strong>{assignment.territory_code}</strong>. 
              O administrador será notificado do motivo da sua recusa.
            </p>
          </div>

          <div>
            <label htmlFor="refuse-reason" className="input-label">Motivo da Recusa</label>
            <textarea
              id="refuse-reason"
              value={refuseReason}
              onChange={(e) => setRefuseReason(e.target.value)}
              className="input min-h-[120px] resize-none"
              placeholder="Explique o motivo da recusa..."
              disabled={submitting}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowRefuseModal(false)}
              className="btn btn-secondary flex-1"
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              onClick={handleRefuse}
              disabled={submitting || !refuseReason.trim()}
              className="btn bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 text-white flex-1"
            >
              {submitting && <div className="spinner" />}
              {!submitting && <><XCircle className="w-5 h-5" />Confirmar Recusa</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* Assign Block to Publisher Modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title={`Designar Quadra ${selectedBlockForAssign} para Publicador`}
        size="md"
      >
        <form onSubmit={handleAssignPublisher} className="space-y-5">
          <div>
            <label htmlFor="select-publisher" className="input-label">Selecionar Publicador</label>
            <select
              id="select-publisher"
              value={selectedPublisherId}
              onChange={(e) => setSelectedPublisherId(e.target.value)}
              className="input"
              required
            >
              <option value="">Selecione um publicador...</option>
              {publishers.map(pub => (
                <option key={pub.id} value={pub.id}>{pub.name} (@{pub.username})</option>
              ))}
            </select>
          </div>

          <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl text-xs text-slate-500">
            <p><strong>Nota:</strong> O publicador terá um prazo de 24 horas para trabalhar nesta quadra e devolver o cartão. O sistema enviará notificações push para alertá-lo.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAssignModal(false)}
              className="btn btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary flex-1"
            >
              {submitting ? <div className="spinner" /> : 'Designar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Manage Streets and Houses Modal (Admin only) */}
      <Modal
        isOpen={showManageStreetsModal}
        onClose={() => setShowManageStreetsModal(false)}
        title="Gerenciar Ruas e Casas"
        size="lg"
      >
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
          {/* Add Street Form */}
          <form onSubmit={handleAddStreet} className="card p-4 space-y-4">
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">Adicionar Nova Rua</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  value={newStreetName}
                  onChange={(e) => setNewStreetName(e.target.value)}
                  placeholder="Nome da Rua (Ex: Rua das Flores)"
                  className="input"
                  required
                />
              </div>
              <div>
                <select
                  value={newStreetBlock}
                  onChange={(e) => setNewStreetBlock(Number(e.target.value))}
                  className="input"
                  required
                >
                  {assignment && Array.from({ length: assignment.block_count }, (_, i) => i + 1).map(b => (
                    <option key={b} value={b}>Quadra {b}</option>
                  ))}
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary w-full py-2.5 text-xs font-semibold">
              <Plus className="w-4 h-4 mr-1" /> Adicionar Rua
            </button>
          </form>

          {/* Add House Form */}
          {(() => {
            const uniqueStreets = [];
            const seen = new Set();
            for (const s of streets) {
              if (s.street_id && !seen.has(s.street_id)) {
                seen.add(s.street_id);
                uniqueStreets.push({ id: s.street_id, name: s.street_name, block: s.block_number });
              }
            }

            return uniqueStreets.length > 0 ? (
              <form onSubmit={handleAddHouse} className="card p-4 space-y-4">
                <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">Adicionar Número de Casa</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <select
                      value={selectedStreetForHouse}
                      onChange={(e) => setSelectedStreetForHouse(e.target.value)}
                      className="input"
                      required
                    >
                      <option value="">Selecione a rua...</option>
                      {uniqueStreets.sort((a,b) => a.block - b.block || a.name.localeCompare(b.name)).map(s => (
                        <option key={s.id} value={s.id}>Q{s.block} - {s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <input
                      type="text"
                      value={newHouseNumber}
                      onChange={(e) => setNewHouseNumber(e.target.value)}
                      placeholder="Nº (Ex: 123A)"
                      className="input"
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary w-full py-2.5 text-xs font-semibold">
                  <Plus className="w-4 h-4 mr-1" /> Adicionar Casa
                </button>
              </form>
            ) : null;
          })()}

          {/* Current Streets & Houses List */}
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300 border-b pb-2">Ruas e Casas Cadastradas</h3>
            {(() => {
              const groupedStreets = {};
              for (const s of streets) {
                if (s.street_id) {
                  if (!groupedStreets[s.street_id]) {
                    groupedStreets[s.street_id] = {
                      id: s.street_id,
                      name: s.street_name,
                      block: s.block_number,
                      houses: []
                    };
                  }
                  if (s.house_id) {
                    groupedStreets[s.street_id].houses.push({ id: s.house_id, number: s.house_number });
                  }
                }
              }

              const streetList = Object.values(groupedStreets).sort((a, b) => a.block - b.block || a.name.localeCompare(b.name));

              if (streetList.length === 0) {
                return <p className="text-xs text-slate-400 text-center py-4">Nenhuma rua cadastrada ainda.</p>;
              }

              return (
                <div className="space-y-3">
                  {streetList.map(street => (
                    <div key={street.id} className="border border-slate-100 dark:border-slate-700/60 rounded-xl p-3 space-y-2">
                      <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/20 p-2 rounded-lg">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Quadra {street.block} - {street.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteStreet(street.id)}
                          className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 px-1">
                        {street.houses.length === 0 ? (
                          <span className="text-xs text-slate-400">Nenhuma casa adicionada.</span>
                        ) : (
                          street.houses.map(house => (
                            <span
                              key={house.id}
                              className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold py-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700"
                            >
                              Nº {house.number}
                              <button
                                type="button"
                                onClick={() => handleDeleteHouse(house.id)}
                                className="text-red-500 hover:text-red-700 ml-1 font-bold text-sm"
                              >
                                &times;
                              </button>
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
        <div className="pt-4 border-t">
          <button
            onClick={() => setShowManageStreetsModal(false)}
            className="btn btn-secondary w-full"
          >
            Fechar
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default AssignmentDetail;

