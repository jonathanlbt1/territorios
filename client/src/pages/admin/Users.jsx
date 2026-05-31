import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../../components/Modal';
import PushNotificationSettings from '../../components/PushNotificationSettings';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  Shield,
  User,
  RotateCcw,
  Lock,
  Bell,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

function AdminUsers() {
  const { user: authUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const toast = useToast();

  // Form state
  const [form, setForm] = useState({
    name: '',
    role: 'dirigente'
  });
  const [generatedUsername, setGeneratedUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [userToReset, setUserToReset] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showMyProfile, setShowMyProfile] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch {
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setForm({ name: '', role: 'dirigente' });
    setGeneratedUsername('');
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      role: user.role
    });
    setGeneratedUsername(user.username);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingUser) {
        const updateData = {
          name: form.name,
          role: form.role
        };
        await api.put(`/users/${editingUser.id}`, updateData);
        toast.success('Usuário atualizado com sucesso!');
      } else {
        await api.post('/users', {
          name: form.name,
          role: form.role
        });
        toast.success('Usuário criado com sucesso! A senha padrão do sistema foi definida.');
      }
      setShowModal(false);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao salvar usuário');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user) => {
    if (!confirm(`Deseja realmente excluir o usuário "${user.name}"?`)) {
      return;
    }

    try {
      await api.delete(`/users/${user.id}`);
      toast.success('Usuário excluído com sucesso!');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao excluir usuário');
    }
  };

  const generateUsernameFromName = (fullName) => {
    if (!fullName) return '';
    
    const words = fullName
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0);

    if (words.length === 0) return '';
    if (words.length === 1) {
      return normalizeWord(words[0]);
    }

    const firstName = normalizeWord(words[0]);
    const lastName = normalizeWord(words[words.length - 1]);
    return `${firstName}.${lastName}`;
  };

  const normalizeWord = (word) => {
    return word
      .toLowerCase()
      .normalize('NFD')
      .replaceAll(/[\u0300-\u036f]/g, '')
      .replaceAll(/[^a-z0-9]/g, '');
  };

  const handleNameChange = (e) => {
    const newName = e.target.value;
    setForm({ ...form, name: newName });
    
    // Gerar username automaticamente se for novo usuário
    if (!editingUser) {
      const username = generateUsernameFromName(newName);
      setGeneratedUsername(username);
    }
  };

  const openResetPasswordModal = (user) => {
    setUserToReset(user);
    setShowResetModal(true);
  };

  const handleResetPassword = async () => {
    if (!userToReset) return;
    
    setResetting(true);
    try {
      await api.put(`/users/${userToReset.id}/reset-password`);
      toast.success(`Senha de ${userToReset.name} resetada para a padrão do sistema.`);
      setShowResetModal(false);
      setUserToReset(null);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao resetar senha');
    } finally {
      setResetting(false);
    }
  };

  const openChangePasswordModal = () => {
    setShowPasswordModal(true);
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setChangingPassword(true);

    if (!passwordForm.currentPassword) {
      toast.error('Digite sua senha atual');
      setChangingPassword(false);
      return;
    }

    if (!passwordForm.newPassword) {
      toast.error('Digite a nova senha');
      setChangingPassword(false);
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('A nova senha deve ter no mínimo 6 caracteres');
      setChangingPassword(false);
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('As senhas não conferem');
      setChangingPassword(false);
      return;
    }

    try {
      await api.put('/users/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });

      toast.success('Senha alterada com sucesso!');
      setShowPasswordModal(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      if (error.response?.status === 401) {
        toast.error('Senha atual incorreta');
      } else {
        toast.error(error.response?.data?.error || 'Erro ao alterar senha');
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const admins = filteredUsers.filter(u => u.role === 'admin');
  const dirigentes = filteredUsers.filter(u => u.role === 'dirigente');

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
          <h1 className="text-2xl font-display font-bold text-slate-800 dark:text-white">Usuários</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {users.length} usuários cadastrados
          </p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary">
          <Plus className="w-5 h-5" />
          Novo Usuário
        </button>
      </div>

      {/* My Profile Section */}
      <div className="card">
        <button
          onClick={() => setShowMyProfile(!showMyProfile)}
          className="w-full card-header flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-t-2xl"
        >
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h2 className="font-semibold text-slate-800 dark:text-white">Meu Perfil</h2>
            <span className="text-sm text-slate-500 dark:text-slate-400">({authUser?.name})</span>
          </div>
          {showMyProfile ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>
        
        {showMyProfile && (
          <div className="p-6 space-y-6 border-t border-slate-100 dark:border-slate-700">
            {/* Profile Info */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center shadow-md">
                <span className="text-xl text-slate-600 dark:text-slate-200 font-semibold">
                  {authUser?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-semibold text-slate-800 dark:text-white">{authUser?.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">@{authUser?.username} • Administrador</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={openChangePasswordModal}
                className="btn btn-secondary"
              >
                <Lock className="w-4 h-4" />
                Alterar Minha Senha
              </button>
            </div>

            {/* Push Notifications */}
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar por nome ou usuário..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input !pl-12"
        />
      </div>

      {/* Admins */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <h2 className="font-semibold text-slate-800 dark:text-white">Administradores</h2>
          <span className="ml-auto text-sm text-slate-500 dark:text-slate-400">{admins.length}</span>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {admins.length === 0 ? (
            <div className="p-6 text-center text-slate-500 dark:text-slate-400">
              Nenhum administrador encontrado
            </div>
          ) : (
            admins.map(user => (
              <UserRow
                key={user.id}
                user={user}
                onEdit={() => openEditModal(user)}
                onDelete={() => handleDelete(user)}
                onResetPassword={() => openResetPasswordModal(user)}
                canChangePassword={authUser?.id === user.id}
                onChangePassword={openChangePasswordModal}
              />
            ))
          )}
        </div>
      </div>

      {/* Dirigentes */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <User className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h2 className="font-semibold text-slate-800 dark:text-white">Dirigentes</h2>
          <span className="ml-auto text-sm text-slate-500 dark:text-slate-400">{dirigentes.length}</span>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {dirigentes.length === 0 ? (
            <div className="p-6 text-center text-slate-500 dark:text-slate-400">
              Nenhum dirigente encontrado
            </div>
          ) : (
            dirigentes.map(user => (
              <UserRow
                key={user.id}
                user={user}
                onEdit={() => openEditModal(user)}
                onDelete={() => handleDelete(user)}
                onResetPassword={() => openResetPasswordModal(user)}
                canChangePassword={authUser?.id === user.id}
                onChangePassword={openChangePasswordModal}
              />
            ))
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingUser ? 'Editar Usuário' : 'Novo Usuário'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="user-name" className="input-label">Nome Completo</label>
            <input
              id="user-name"
              type="text"
              value={form.name}
              onChange={handleNameChange}
              className="input"
              required
              placeholder='Fulano de Tal'
            />
          </div>

          {generatedUsername && (
            <div>
              <label htmlFor="user-username" className="input-label">Usuário (gerado automaticamente)</label>
              <input
                id="user-username"
                type="text"
                value={generatedUsername}
                disabled
                className="input bg-slate-50 text-slate-600 cursor-not-allowed"
              />
            </div>
          )}

          {!editingUser && (
            <div>
              <p className="input-label">Senha</p>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-600">
                A senha padrão do sistema será usada. O usuário poderá alterá-la após o primeiro login.
              </div>
            </div>
          )}

          <div>
            <label htmlFor="user-role" className="input-label">Tipo de Acesso</label>
            <select
              id="user-role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="input"
              required
            >
              <option value="dirigente">Dirigente</option>
              <option value="admin">Administrador</option>
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
              disabled={saving}
              className="btn btn-primary flex-1"
            >
              {saving ? <div className="spinner" /> : null}
              {!saving && (editingUser ? 'Salvar' : 'Criar')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => {
          setShowResetModal(false);
          setUserToReset(null);
        }}
        title="Resetar Senha"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-slate-700">
            Deseja realmente resetar a senha de <span className="font-semibold">{userToReset?.name}</span>?
          </p>
          <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
            A nova senha será a padrão do sistema (configurada no servidor).
          </p>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowResetModal(false);
                setUserToReset(null);
              }}
              className="btn btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleResetPassword}
              disabled={resetting}
              className="btn btn-primary flex-1"
            >
              {resetting ? <div className="spinner" /> : 'Confirmar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Change Own Password Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        }}
        title="Alterar Minha Senha"
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
                setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
              }}
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

function UserRow({ user, onEdit, onDelete, onResetPassword, canChangePassword, onChangePassword }) {
  return (
    <div className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center">
          <span className="text-slate-600 dark:text-slate-200 font-semibold">
            {user.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div>
          <p className="font-medium text-slate-800 dark:text-white">{user.name}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">@{user.username}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {canChangePassword && (
          <button
            onClick={onChangePassword}
            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-xl transition-colors"
            title="Alterar minha senha"
          >
            <Lock className="w-5 h-5" />
          </button>
        )}
        <button
          onClick={onResetPassword}
          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-xl transition-colors"
          title="Resetar senha"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
        <button
          onClick={onEdit}
          className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-xl transition-colors"
        >
          <Edit2 className="w-5 h-5" />
        </button>
        <button
          onClick={onDelete}
          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

UserRow.propTypes = {
  user: PropTypes.shape({
    name: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
  }).isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onResetPassword: PropTypes.func.isRequired,
  canChangePassword: PropTypes.bool,
  onChangePassword: PropTypes.func,
};

export default AdminUsers;

