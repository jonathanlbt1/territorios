import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Create mocks with vi.hoisted
const { mockApi, mockToast, mockUseAuth } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  mockUseAuth: vi.fn(),
}));

vi.mock('../../../src/services/api', () => ({
  default: mockApi,
}));

vi.mock('../../../src/contexts/ToastContext', () => ({
  useToast: () => mockToast,
}));

vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Plus: (props) => <svg data-testid="plus-icon" {...props} />,
  Edit2: (props) => <svg data-testid="edit-icon" {...props} />,
  Trash2: (props) => <svg data-testid="trash-icon" {...props} />,
  Search: (props) => <svg data-testid="search-icon" {...props} />,
  Shield: (props) => <svg data-testid="shield-icon" {...props} />,
  User: (props) => <svg data-testid="user-icon" {...props} />,
  RotateCcw: (props) => <svg data-testid="reset-icon" {...props} />,
  Lock: (props) => <svg data-testid="lock-icon" {...props} />,
  Bell: (props) => <svg data-testid="bell-icon" {...props} />,
  ChevronDown: (props) => <svg data-testid="chevron-down-icon" {...props} />,
  ChevronUp: (props) => <svg data-testid="chevron-up-icon" {...props} />,
}));

// Mock Modal component
vi.mock('../../../src/components/Modal', () => ({
  default: ({ isOpen, onClose, title, children }) =>
    isOpen ? (
      <div data-testid="modal">
        <h2>{title}</h2>
        <button data-testid="modal-close" onClick={onClose}>Close</button>
        {children}
      </div>
    ) : null,
}));

// Mock PushNotificationSettings component
vi.mock('../../../src/components/PushNotificationSettings', () => ({
  default: () => <div data-testid="push-notification-settings">Push Settings</div>,
}));

import AdminUsers from '../../../src/pages/admin/Users';

const mockAuthUser = {
  id: 1,
  name: 'Admin User',
  username: 'admin.user',
  role: 'admin',
};

const mockUsers = [
  {
    id: 1,
    name: 'Admin User',
    username: 'admin.user',
    role: 'admin',
  },
  {
    id: 2,
    name: 'João Silva',
    username: 'joao.silva',
    role: 'admin',
  },
  {
    id: 3,
    name: 'Maria Santos',
    username: 'maria.santos',
    role: 'dirigente',
  },
  {
    id: 4,
    name: 'Pedro Costa',
    username: 'pedro.costa',
    role: 'dirigente',
  },
];

const renderComponent = () => {
  return render(<AdminUsers />);
};

describe('AdminUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);

    mockUseAuth.mockReturnValue({ user: mockAuthUser });

    mockApi.get.mockImplementation((url) => {
      if (url === '/users') {
        return Promise.resolve({ data: mockUsers });
      }
      return Promise.resolve({ data: [] });
    });
  });

  describe('loading state', () => {
    it('should show loading spinner initially', () => {
      mockApi.get.mockImplementation(() => new Promise(() => {}));

      renderComponent();

      expect(document.querySelector('.spinner')).toBeInTheDocument();
    });

    it('should hide loading spinner after data loads', async () => {
      renderComponent();

      await waitFor(() => {
        expect(document.querySelector('.spinner')).not.toBeInTheDocument();
      });
    });
  });

  describe('data fetching', () => {
    it('should fetch users on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledWith('/users');
      });
    });

    it('should show error toast on fetch failure', async () => {
      mockApi.get.mockRejectedValue(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Erro ao carregar usuários');
      });
    });
  });

  describe('header', () => {
    it('should render page title', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Usuários')).toBeInTheDocument();
      });
    });

    it('should show user count', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('4 usuários cadastrados')).toBeInTheDocument();
      });
    });

    it('should render "Novo Usuário" button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Novo Usuário')).toBeInTheDocument();
      });
    });
  });

  describe('my profile section', () => {
    it('should render "Meu Perfil" section', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Meu Perfil')).toBeInTheDocument();
      });
    });

    it('should show auth user name', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('(Admin User)')).toBeInTheDocument();
      });
    });

    it('should toggle profile section when clicked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Meu Perfil')).toBeInTheDocument();
      });

      // Click to expand
      fireEvent.click(screen.getByText('Meu Perfil'));

      await waitFor(() => {
        expect(screen.getByText('Alterar Minha Senha')).toBeInTheDocument();
      });
    });

    it('should show PushNotificationSettings when expanded', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Meu Perfil'));
      });

      expect(screen.getByTestId('push-notification-settings')).toBeInTheDocument();
    });
  });

  describe('search functionality', () => {
    it('should render search input', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Buscar por nome ou usuário...')).toBeInTheDocument();
      });
    });

    it('should filter users by name', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Buscar por nome ou usuário...');
      fireEvent.change(searchInput, { target: { value: 'maria' } });

      expect(screen.queryByText('João Silva')).not.toBeInTheDocument();
      expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    });

    it('should filter users by username', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Buscar por nome ou usuário...');
      fireEvent.change(searchInput, { target: { value: 'pedro.costa' } });

      expect(screen.queryByText('João Silva')).not.toBeInTheDocument();
      expect(screen.getByText('Pedro Costa')).toBeInTheDocument();
    });

    it('should show empty state when no results', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Buscar por nome ou usuário...');
      fireEvent.change(searchInput, { target: { value: 'xyz' } });

      expect(screen.getByText('Nenhum administrador encontrado')).toBeInTheDocument();
      expect(screen.getByText('Nenhum dirigente encontrado')).toBeInTheDocument();
    });
  });

  describe('user lists', () => {
    it('should render admins section', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Administradores')).toBeInTheDocument();
      });
    });

    it('should render dirigentes section', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Dirigentes')).toBeInTheDocument();
      });
    });

    it('should show admin count', async () => {
      renderComponent();

      await waitFor(() => {
        // 2 admins in mock data
        const adminSection = screen.getByText('Administradores').closest('.card');
        expect(adminSection).toHaveTextContent('2');
      });
    });

    it('should show dirigente count', async () => {
      renderComponent();

      await waitFor(() => {
        // 2 dirigentes in mock data
        const dirigenteSection = screen.getByText('Dirigentes').closest('.card');
        expect(dirigenteSection).toHaveTextContent('2');
      });
    });

    it('should display user names', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
        expect(screen.getByText('Maria Santos')).toBeInTheDocument();
        expect(screen.getByText('Pedro Costa')).toBeInTheDocument();
      });
    });

    it('should display usernames with @ prefix', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('@joao.silva')).toBeInTheDocument();
        expect(screen.getByText('@maria.santos')).toBeInTheDocument();
      });
    });
  });

  describe('create user modal', () => {
    it('should open create modal when clicking "Novo Usuário"', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Novo Usuário')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo Usuário'));

      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    it('should show form fields in create modal', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo Usuário'));
      });

      expect(screen.getByText('Nome Completo')).toBeInTheDocument();
      expect(screen.getByText('Tipo de Acesso')).toBeInTheDocument();
    });

    it('should show password info for new users', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo Usuário'));
      });

      expect(screen.getByText(/A senha padrão do sistema será usada/)).toBeInTheDocument();
    });

    it('should generate username from name', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo Usuário'));
      });

      const nameInput = screen.getByPlaceholderText('Fulano de Tal');
      fireEvent.change(nameInput, { target: { value: 'Carlos Silva' } });

      expect(screen.getByDisplayValue('carlos.silva')).toBeInTheDocument();
    });

    it('should create user successfully', async () => {
      mockApi.post.mockResolvedValue({ data: {} });

      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo Usuário'));
      });

      const nameInput = screen.getByPlaceholderText('Fulano de Tal');
      fireEvent.change(nameInput, { target: { value: 'Novo Usuario' } });

      fireEvent.click(screen.getByText('Criar'));

      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith('/users', expect.objectContaining({
          name: 'Novo Usuario',
          role: 'dirigente',
        }));
        expect(mockToast.success).toHaveBeenCalledWith('Usuário criado com sucesso! A senha padrão do sistema foi definida.');
      });
    });

    it('should show error toast on create failure', async () => {
      mockApi.post.mockRejectedValue({
        response: { data: { error: 'Usuário já existe' } },
      });

      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo Usuário'));
      });

      const nameInput = screen.getByPlaceholderText('Fulano de Tal');
      fireEvent.change(nameInput, { target: { value: 'Novo Usuario' } });

      fireEvent.click(screen.getByText('Criar'));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Usuário já existe');
      });
    });

    it('should close create modal on cancel', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo Usuário'));
      });

      expect(screen.getByTestId('modal')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Cancelar'));

      await waitFor(() => {
        expect(screen.queryByText('Nome Completo')).not.toBeInTheDocument();
      });
    });
  });

  describe('edit user modal', () => {
    it('should open edit modal when clicking edit button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTestId('edit-icon');
      fireEvent.click(editButtons[0].closest('button'));

      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByText('Editar Usuário')).toBeInTheDocument();
    });

    it('should populate form with user data', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTestId('edit-icon');
      fireEvent.click(editButtons[1].closest('button')); // Click second edit (João Silva)

      expect(screen.getByDisplayValue('João Silva')).toBeInTheDocument();
    });

    it('should update user successfully', async () => {
      mockApi.put.mockResolvedValue({ data: {} });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTestId('edit-icon');
      fireEvent.click(editButtons[1].closest('button'));

      const nameInput = screen.getByDisplayValue('João Silva');
      fireEvent.change(nameInput, { target: { value: 'João Silva Atualizado' } });

      fireEvent.click(screen.getByText('Salvar'));

      await waitFor(() => {
        expect(mockApi.put).toHaveBeenCalledWith('/users/2', expect.objectContaining({
          name: 'João Silva Atualizado',
        }));
        expect(mockToast.success).toHaveBeenCalledWith('Usuário atualizado com sucesso!');
      });
    });
  });

  describe('delete user', () => {
    it('should call delete API when confirmed', async () => {
      mockApi.delete.mockResolvedValue({ data: {} });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Maria Santos')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTestId('trash-icon');
      fireEvent.click(deleteButtons[2].closest('button')); // Maria Santos

      await waitFor(() => {
        expect(mockApi.delete).toHaveBeenCalledWith('/users/3');
        expect(mockToast.success).toHaveBeenCalledWith('Usuário excluído com sucesso!');
      });
    });

    it('should not delete when confirm is cancelled', async () => {
      vi.spyOn(globalThis, 'confirm').mockReturnValue(false);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Maria Santos')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTestId('trash-icon');
      fireEvent.click(deleteButtons[2].closest('button'));

      expect(mockApi.delete).not.toHaveBeenCalled();
    });

    it('should show error toast on delete failure', async () => {
      mockApi.delete.mockRejectedValue({
        response: { data: { error: 'Não é possível excluir' } },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Maria Santos')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTestId('trash-icon');
      fireEvent.click(deleteButtons[2].closest('button'));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Não é possível excluir');
      });
    });
  });

  describe('reset password modal', () => {
    it('should open reset password modal', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      const resetButtons = screen.getAllByTestId('reset-icon');
      fireEvent.click(resetButtons[0].closest('button'));

      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByText('Resetar Senha')).toBeInTheDocument();
    });

    it('should show user name in reset modal', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      const resetButtons = screen.getAllByTestId('reset-icon');
      fireEvent.click(resetButtons[1].closest('button')); // João Silva

      // User name appears in both the list and in the modal confirmation text
      const joaoSilvaElements = screen.getAllByText(/João Silva/);
      expect(joaoSilvaElements.length).toBeGreaterThan(1);
    });

    it('should reset password successfully', async () => {
      mockApi.put.mockResolvedValue({ data: {} });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      const resetButtons = screen.getAllByTestId('reset-icon');
      fireEvent.click(resetButtons[1].closest('button'));

      fireEvent.click(screen.getByText('Confirmar'));

      await waitFor(() => {
        expect(mockApi.put).toHaveBeenCalledWith('/users/2/reset-password');
        expect(mockToast.success).toHaveBeenCalledWith('Senha de João Silva resetada para a padrão do sistema.');
      });
    });

    it('should close reset modal on cancel', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      const resetButtons = screen.getAllByTestId('reset-icon');
      fireEvent.click(resetButtons[0].closest('button'));

      expect(screen.getByText('Resetar Senha')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Cancelar'));

      await waitFor(() => {
        expect(screen.queryByText('Resetar Senha')).not.toBeInTheDocument();
      });
    });
  });

  describe('change password modal', () => {
    it('should open change password modal from profile section', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Meu Perfil'));
      });

      fireEvent.click(screen.getByRole('button', { name: /Alterar Minha Senha/ }));

      expect(screen.getByTestId('modal')).toBeInTheDocument();
      // Both the button and modal title have "Alterar Minha Senha"
      expect(screen.getAllByText('Alterar Minha Senha').length).toBeGreaterThanOrEqual(2);
    });

    it('should render password form fields', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Meu Perfil'));
      });

      fireEvent.click(screen.getByText('Alterar Minha Senha'));

      expect(screen.getByPlaceholderText('Digite sua senha atual')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Digite a nova senha')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Confirme a nova senha')).toBeInTheDocument();
    });

    it('should show error when current password is empty', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Meu Perfil'));
      });

      fireEvent.click(screen.getByText('Alterar Minha Senha'));

      // Submit with form to bypass HTML validation
      const form = screen.getByTestId('modal').querySelector('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Digite sua senha atual');
      });
    });

    it('should show error when new password is empty', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Meu Perfil'));
      });

      fireEvent.click(screen.getByText('Alterar Minha Senha'));

      const currentPasswordInput = screen.getByPlaceholderText('Digite sua senha atual');
      fireEvent.change(currentPasswordInput, { target: { value: 'oldpass' } });

      const form = screen.getByTestId('modal').querySelector('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Digite a nova senha');
      });
    });

    it('should show error when new password is too short', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Meu Perfil'));
      });

      fireEvent.click(screen.getByText('Alterar Minha Senha'));

      const currentPasswordInput = screen.getByPlaceholderText('Digite sua senha atual');
      fireEvent.change(currentPasswordInput, { target: { value: 'oldpass' } });

      const newPasswordInput = screen.getByPlaceholderText('Digite a nova senha');
      fireEvent.change(newPasswordInput, { target: { value: '12345' } });

      const form = screen.getByTestId('modal').querySelector('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('A nova senha deve ter no mínimo 6 caracteres');
      });
    });

    it('should show error when passwords do not match', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Meu Perfil'));
      });

      fireEvent.click(screen.getByText('Alterar Minha Senha'));

      const currentPasswordInput = screen.getByPlaceholderText('Digite sua senha atual');
      fireEvent.change(currentPasswordInput, { target: { value: 'oldpass' } });

      const newPasswordInput = screen.getByPlaceholderText('Digite a nova senha');
      fireEvent.change(newPasswordInput, { target: { value: 'newpass123' } });

      const confirmPasswordInput = screen.getByPlaceholderText('Confirme a nova senha');
      fireEvent.change(confirmPasswordInput, { target: { value: 'different' } });

      const form = screen.getByTestId('modal').querySelector('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('As senhas não conferem');
      });
    });

    it('should change password successfully', async () => {
      mockApi.put.mockResolvedValue({ data: {} });

      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Meu Perfil'));
      });

      fireEvent.click(screen.getByText('Alterar Minha Senha'));

      const currentPasswordInput = screen.getByPlaceholderText('Digite sua senha atual');
      fireEvent.change(currentPasswordInput, { target: { value: 'oldpass' } });

      const newPasswordInput = screen.getByPlaceholderText('Digite a nova senha');
      fireEvent.change(newPasswordInput, { target: { value: 'newpass123' } });

      const confirmPasswordInput = screen.getByPlaceholderText('Confirme a nova senha');
      fireEvent.change(confirmPasswordInput, { target: { value: 'newpass123' } });

      fireEvent.click(screen.getByText('Alterar Senha'));

      await waitFor(() => {
        expect(mockApi.put).toHaveBeenCalledWith('/users/change-password', {
          currentPassword: 'oldpass',
          newPassword: 'newpass123',
        });
        expect(mockToast.success).toHaveBeenCalledWith('Senha alterada com sucesso!');
      });
    });

    it('should show error when current password is incorrect', async () => {
      mockApi.put.mockRejectedValue({ response: { status: 401 } });

      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Meu Perfil'));
      });

      fireEvent.click(screen.getByText('Alterar Minha Senha'));

      const currentPasswordInput = screen.getByPlaceholderText('Digite sua senha atual');
      fireEvent.change(currentPasswordInput, { target: { value: 'wrongpass' } });

      const newPasswordInput = screen.getByPlaceholderText('Digite a nova senha');
      fireEvent.change(newPasswordInput, { target: { value: 'newpass123' } });

      const confirmPasswordInput = screen.getByPlaceholderText('Confirme a nova senha');
      fireEvent.change(confirmPasswordInput, { target: { value: 'newpass123' } });

      fireEvent.click(screen.getByText('Alterar Senha'));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Senha atual incorreta');
      });
    });
  });

  describe('username generation', () => {
    it('should generate username from single name', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo Usuário'));
      });

      const nameInput = screen.getByPlaceholderText('Fulano de Tal');
      fireEvent.change(nameInput, { target: { value: 'Carlos' } });

      expect(screen.getByDisplayValue('carlos')).toBeInTheDocument();
    });

    it('should generate username from first and last name', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo Usuário'));
      });

      const nameInput = screen.getByPlaceholderText('Fulano de Tal');
      fireEvent.change(nameInput, { target: { value: 'Carlos Eduardo Silva' } });

      expect(screen.getByDisplayValue('carlos.silva')).toBeInTheDocument();
    });

    it('should normalize accented characters', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo Usuário'));
      });

      const nameInput = screen.getByPlaceholderText('Fulano de Tal');
      fireEvent.change(nameInput, { target: { value: 'José Antônio' } });

      expect(screen.getByDisplayValue('jose.antonio')).toBeInTheDocument();
    });

    it('should handle empty name', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo Usuário'));
      });

      const nameInput = screen.getByPlaceholderText('Fulano de Tal');
      fireEvent.change(nameInput, { target: { value: '' } });

      // No username generated
      expect(screen.queryByText('Usuário (gerado automaticamente)')).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle empty users list', async () => {
      mockApi.get.mockResolvedValue({ data: [] });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('0 usuários cadastrados')).toBeInTheDocument();
        expect(screen.getByText('Nenhum administrador encontrado')).toBeInTheDocument();
        expect(screen.getByText('Nenhum dirigente encontrado')).toBeInTheDocument();
      });
    });

    it('should show lock button for current user in user list', async () => {
      renderComponent();

      await waitFor(() => {
        // Admin User (id: 1) is the auth user
        const lockButtons = screen.getAllByTestId('lock-icon');
        expect(lockButtons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('accessibility', () => {
    it('should have accessible search input', async () => {
      renderComponent();

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Buscar por nome ou usuário...');
        expect(searchInput).toHaveAttribute('type', 'text');
      });
    });

    it('should have accessible form labels', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo Usuário'));
      });

      expect(screen.getByLabelText('Nome Completo')).toBeInTheDocument();
      expect(screen.getByLabelText('Tipo de Acesso')).toBeInTheDocument();
    });
  });
});
