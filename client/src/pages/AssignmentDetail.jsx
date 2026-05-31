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
  FileText
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

  useEffect(() => {
    fetchAssignment();
  }, [id]);

  const fetchAssignment = async () => {
    try {
      const response = await api.get(`/assignments/${id}`);
      console.log('Assignment loaded:', response.data);
      const data = response.data;
      setAssignment(data);
      setBlocksWorked(data.blocks_worked || []);
      setLockedBlocks(data.partial_blocks_worked || []);
      setObservations(data.return_observations || '');
    } catch (error) {
      console.error('Fetch assignment error:', error);
      toast.error(error.response?.data?.error || 'Erro ao carregar designação');
      navigate(-1);
    } finally {
      setLoading(false);
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
          <button
            onClick={() => setShowReturnModal(true)}
            className="btn btn-primary w-full py-4"
          >
            <Send className="w-5 h-5" />
            Devolver Território
          </button>
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
    </div>
  );
}

export default AssignmentDetail;

