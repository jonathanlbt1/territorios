import { useState } from 'react';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';
import PushNotificationSettings from '../components/PushNotificationSettings';
import { User, Lock, Bell } from 'lucide-react';

function MyUser() {
  const { user } = useAuth();
  const toast = useToast();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [changing, setChanging] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setChanging(true);

    // Validações
    if (!passwordForm.currentPassword) {
      toast.error('Digite sua senha atual');
      setChanging(false);
      return;
    }

    if (!passwordForm.newPassword) {
      toast.error('Digite a nova senha');
      setChanging(false);
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('A nova senha deve ter no mínimo 6 caracteres');
      setChanging(false);
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('As senhas não conferem');
      setChanging(false);
      return;
    }

    try {
      await api.put('/users/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      toast.success('Senha alterada com sucesso!');
      setShowPasswordModal(false);
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      if (error.response?.status === 401) {
        toast.error('Senha atual incorreta');
      } else {
        toast.error(error.response?.data?.error || 'Erro ao alterar senha');
      }
    } finally {
      setChanging(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-slate-800 dark:text-white">Meus Dados</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Gerenciar seu perfil e segurança
        </p>
      </div>

      {/* Profile Card */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <User className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <h2 className="font-semibold text-slate-800 dark:text-white">Informações do Perfil</h2>
        </div>
        
        <div className="p-6 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center shadow-md">
              <span className="text-2xl text-slate-600 dark:text-slate-200 font-semibold">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Nome</p>
              <p className="font-semibold text-slate-800 dark:text-white">{user?.name}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Usuário</p>
              <p className="font-medium text-slate-700 dark:text-slate-300">@{user?.username}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Tipo de Acesso</p>
              <p className="font-medium text-slate-700 dark:text-slate-300 capitalize">{user?.role === 'dirigente' ? 'Dirigente' : 'Administrador'}</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <button
            onClick={() => setShowPasswordModal(true)}
            className="btn btn-primary"
          >
            <Lock className="w-5 h-5" />
            Alterar Senha
          </button>
        </div>
      </div>

      {/* Push Notifications */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <h2 className="font-semibold text-slate-800 dark:text-white">Notificações</h2>
        </div>
        <div className="p-6">
          <PushNotificationSettings />
        </div>
      </div>

      {/* Security Tips */}
      <div className="card p-5 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
        <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-2">🔒 Dicas de Segurança</h3>
        <ul className="text-sm text-amber-700 dark:text-amber-400 space-y-2">
          <li>• Use uma senha forte com pelo menos 6 caracteres</li>
          <li>• Combine letras maiúsculas, minúsculas, números e caracteres especiais</li>
          <li>• Não compartilhe sua senha com ninguém</li>
          <li>• Altere sua senha regularmente</li>
        </ul>
      </div>

      {/* Change Password Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setPasswordForm({
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
          });
        }}
        title="Alterar Senha"
        size="md"
      >
        <form onSubmit={handleChangePassword} className="space-y-5">
          <div>
            <label htmlFor="current-password" className="input-label">Senha Atual</label>
            <input
              id="current-password"
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              className="input"
              placeholder="Digite sua senha atual"
              required
            />
          </div>

          <div>
            <label htmlFor="new-password" className="input-label">Nova Senha</label>
            <input
              id="new-password"
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              className="input"
              placeholder="Digite a nova senha"
              required
              minLength={6}
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className="input-label">Confirmar Nova Senha</label>
            <input
              id="confirm-password"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              className="input"
              placeholder="Confirme a nova senha"
              required
              minLength={6}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowPasswordModal(false);
                setPasswordForm({
                  currentPassword: '',
                  newPassword: '',
                  confirmPassword: ''
                });
              }}
              className="btn btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={changing}
              className="btn btn-primary flex-1"
            >
              {changing ? <div className="spinner" /> : 'Alterar Senha'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default MyUser;
