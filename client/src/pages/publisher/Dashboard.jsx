import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import PushNotificationSettings from '../../components/PushNotificationSettings';
import {
  Clock,
  MapPin,
  Calendar,
  ArrowRight,
  AlertCircle,
  Map,
  User,
  Bell,
  Lock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Modal from '../../components/Modal';

function PublisherDashboard() {
  const { user: authUser } = useAuth();
  const [activeBlocks, setActiveBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMyProfile, setShowMyProfile] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchActiveBlocks();
  }, []);

  const fetchActiveBlocks = async () => {
    try {
      const response = await api.get('/assignments/publisher/active');
      setActiveBlocks(response.data);
    } catch (error) {
      console.error('Error fetching active blocks:', error);
      toast.error('Erro ao carregar quadras designadas');
    } finally {
      setLoading(false);
    }
  };

  const openChangePasswordModal = () => {
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setShowPasswordModal(true);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('A nova senha e a confirmação não coincidem');
      return;
    }

    setChangingPassword(true);
    try {
      await api.put('/users/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      toast.success('Senha alterada com sucesso!');
      setShowPasswordModal(false);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao alterar senha');
    } finally {
      setChangingPassword(false);
    }
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
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-slate-800 dark:text-white">
          Olá, {authUser?.name}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Você tem {activeBlocks.length} quadra(s) sob sua responsabilidade no momento.
        </p>
      </div>

      {/* Profile/Settings Dropdown */}
      <div className="card">
        <button
          onClick={() => setShowMyProfile(!showMyProfile)}
          className="w-full card-header flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-t-2xl"
        >
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="font-semibold text-slate-800 dark:text-white">Minha Conta</h2>
          </div>
          {showMyProfile ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>
        
        {showMyProfile && (
          <div className="p-6 space-y-6 border-t border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg shadow-md">
                {authUser?.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-slate-800 dark:text-white">{authUser?.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">@{authUser?.username} • Publicador</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={openChangePasswordModal}
                className="btn btn-secondary"
              >
                <Lock className="w-4 h-4" />
                Alterar Minha Senha
              </button>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Bell className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Notificações Push</span>
              </div>
              <PushNotificationSettings />
            </div>
          </div>
        )}
      </div>

      {/* Active Assignments List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Map className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Quadras Designadas
        </h2>

        {activeBlocks.length === 0 ? (
          <div className="card p-8 text-center text-slate-500 dark:text-slate-400">
            Você não possui nenhuma quadra designada no momento.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {activeBlocks.map((block) => {
              const dueDate = parseISO(block.due_date);
              const isOverdue = isPast(dueDate);

              return (
                <div key={block.id} className="card hover:shadow-md transition-shadow">
                  <div className="p-5 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                          Território {block.territory_number} - Quadra {block.block_number}
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm flex items-center gap-1 mt-1">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          {block.locality}
                        </p>
                      </div>
                      {isOverdue && (
                        <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-semibold rounded-lg flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Atrasada
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm border-t border-slate-100 dark:border-slate-700 pt-4">
                      <div>
                        <p className="text-slate-400 dark:text-slate-500 text-xs">Designado por</p>
                        <p className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">{block.dirigente_name}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 dark:text-slate-500 text-xs">Prazo de 24h</p>
                        <p className={`font-semibold mt-0.5 flex items-center gap-1 ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          <Clock className="w-4 h-4" />
                          {format(dueDate, "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => navigate(`/publisher/assignment/${block.id}`)}
                      className="btn btn-primary w-full py-3 mt-2"
                    >
                      Trabalhar na Quadra
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Change Password Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="Alterar Minha Senha"
        size="md"
      >
        <form onSubmit={handleChangePassword} className="space-y-5">
          <div>
            <label htmlFor="current-pass" className="input-label">Senha Atual</label>
            <input
              id="current-pass"
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              className="input"
              required
            />
          </div>

          <div>
            <label htmlFor="new-pass" className="input-label">Nova Senha</label>
            <input
              id="new-pass"
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              className="input"
              required
              minLength={6}
            />
          </div>

          <div>
            <label htmlFor="confirm-pass" className="input-label">Confirmar Nova Senha</label>
            <input
              id="confirm-pass"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              className="input"
              required
              minLength={6}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowPasswordModal(false)}
              className="btn btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={changingPassword}
              className="btn btn-primary flex-1"
            >
              {changingPassword ? <div className="spinner" /> : 'Alterar Senha'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default PublisherDashboard;
