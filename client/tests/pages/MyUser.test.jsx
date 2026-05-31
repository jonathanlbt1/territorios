import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Create mocks with vi.hoisted
const { mockApi, mockToast, mockUseAuth } = vi.hoisted(() => ({
  mockApi: {
    put: vi.fn(),
  },
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  mockUseAuth: vi.fn(),
}));

vi.mock('../../src/services/api', () => ({
  default: mockApi,
}));

vi.mock('../../src/contexts/ToastContext', () => ({
  useToast: () => mockToast,
}));

vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  User: (props) => <svg data-testid="user-icon" {...props} />,
  Lock: (props) => <svg data-testid="lock-icon" {...props} />,
  Bell: (props) => <svg data-testid="bell-icon" {...props} />,
}));

// Mock Modal component
vi.mock('../../src/components/Modal', () => ({
  default: ({ isOpen, onClose, title, children }) => isOpen ? (
    <div data-testid="modal" data-title={title}>
      <button data-testid="modal-close" onClick={onClose}>Close</button>
      {children}
    </div>
  ) : null,
}));

// Mock PushNotificationSettings component
vi.mock('../../src/components/PushNotificationSettings', () => ({
  default: () => <div data-testid="push-notification-settings">PushNotificationSettings</div>,
}));

import MyUser from '../../src/pages/MyUser';

const mockDirigenteUser = {
  id: 1,
  name: 'João Silva',
  username: 'joaosilva',
  role: 'dirigente',
};

const mockAdminUser = {
  id: 2,
  name: 'Admin User',
  username: 'adminuser',
  role: 'admin',
};

describe('MyUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: mockDirigenteUser });
    mockApi.put.mockResolvedValue({ data: { success: true } });
  });

  describe('rendering', () => {
    it('should render page title', () => {
      render(<MyUser />);
      expect(screen.getByText('Meus Dados')).toBeInTheDocument();
    });

    it('should render page description', () => {
      render(<MyUser />);
      expect(screen.getByText('Gerenciar seu perfil e segurança')).toBeInTheDocument();
    });

    it('should render profile section header', () => {
      render(<MyUser />);
      expect(screen.getByText('Informações do Perfil')).toBeInTheDocument();
    });

    it('should render notifications section header', () => {
      render(<MyUser />);
      expect(screen.getByText('Notificações')).toBeInTheDocument();
    });

    it('should render security tips section', () => {
      render(<MyUser />);
      expect(screen.getByText('🔒 Dicas de Segurança')).toBeInTheDocument();
    });

    it('should render change password button', () => {
      render(<MyUser />);
      expect(screen.getByText('Alterar Senha')).toBeInTheDocument();
    });

    it('should render icons', () => {
      render(<MyUser />);
      expect(screen.getByTestId('user-icon')).toBeInTheDocument();
      expect(screen.getByTestId('lock-icon')).toBeInTheDocument();
      expect(screen.getByTestId('bell-icon')).toBeInTheDocument();
    });
  });

  describe('user profile display', () => {
    it('should display user name', () => {
      render(<MyUser />);
      expect(screen.getByText('João Silva')).toBeInTheDocument();
    });

    it('should display username with @ prefix', () => {
      render(<MyUser />);
      expect(screen.getByText('@joaosilva')).toBeInTheDocument();
    });

    it('should display user initial in avatar', () => {
      render(<MyUser />);
      expect(screen.getByText('J')).toBeInTheDocument();
    });

    it('should display dirigente role correctly', () => {
      render(<MyUser />);
      expect(screen.getByText('Dirigente')).toBeInTheDocument();
    });

    it('should display admin role correctly', () => {
      mockUseAuth.mockReturnValue({ user: mockAdminUser });
      render(<MyUser />);
      expect(screen.getByText('Administrador')).toBeInTheDocument();
    });

    it('should display user initial for admin', () => {
      mockUseAuth.mockReturnValue({ user: mockAdminUser });
      render(<MyUser />);
      expect(screen.getByText('A')).toBeInTheDocument();
    });
  });

  describe('push notification settings', () => {
    it('should render PushNotificationSettings component', () => {
      render(<MyUser />);
      expect(screen.getByTestId('push-notification-settings')).toBeInTheDocument();
    });
  });

  describe('security tips', () => {
    it('should display password length tip', () => {
      render(<MyUser />);
      expect(screen.getByText(/Use uma senha forte com pelo menos 6 caracteres/)).toBeInTheDocument();
    });

    it('should display character combination tip', () => {
      render(<MyUser />);
      expect(screen.getByText(/Combine letras maiúsculas, minúsculas, números/)).toBeInTheDocument();
    });

    it('should display password sharing tip', () => {
      render(<MyUser />);
      expect(screen.getByText(/Não compartilhe sua senha com ninguém/)).toBeInTheDocument();
    });

    it('should display password change tip', () => {
      render(<MyUser />);
      expect(screen.getByText(/Altere sua senha regularmente/)).toBeInTheDocument();
    });
  });

  describe('change password modal', () => {
    it('should not show modal initially', () => {
      render(<MyUser />);
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('should open modal when clicking change password button', () => {
      render(<MyUser />);
      fireEvent.click(screen.getByText('Alterar Senha'));
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByTestId('modal')).toHaveAttribute('data-title', 'Alterar Senha');
    });

    it('should render all password fields in modal', () => {
      render(<MyUser />);
      fireEvent.click(screen.getByText('Alterar Senha'));
      
      expect(screen.getByLabelText('Senha Atual')).toBeInTheDocument();
      expect(screen.getByLabelText('Nova Senha')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirmar Nova Senha')).toBeInTheDocument();
    });

    it('should close modal and reset form when clicking cancel', () => {
      render(<MyUser />);
      fireEvent.click(screen.getByText('Alterar Senha'));
      
      const currentPasswordInput = screen.getByLabelText('Senha Atual');
      fireEvent.change(currentPasswordInput, { target: { value: 'somepassword' } });
      
      fireEvent.click(screen.getByText('Cancelar'));
      
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('should close modal when clicking modal close button', () => {
      render(<MyUser />);
      fireEvent.click(screen.getByText('Alterar Senha'));
      
      fireEvent.click(screen.getByTestId('modal-close'));
      
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });
  });

  describe('password form validation', () => {
    beforeEach(() => {
      render(<MyUser />);
      fireEvent.click(screen.getByText('Alterar Senha'));
    });

    it('should show error when current password is empty', async () => {
      const newPasswordInput = screen.getByLabelText('Nova Senha');
      const confirmPasswordInput = screen.getByLabelText('Confirmar Nova Senha');
      
      fireEvent.change(newPasswordInput, { target: { value: 'newpass123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'newpass123' } });
      
      const form = screen.getByLabelText('Senha Atual').closest('form');
      fireEvent.submit(form);
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Digite sua senha atual');
      });
      expect(mockApi.put).not.toHaveBeenCalled();
    });

    it('should show error when new password is empty', async () => {
      const currentPasswordInput = screen.getByLabelText('Senha Atual');
      const confirmPasswordInput = screen.getByLabelText('Confirmar Nova Senha');
      
      fireEvent.change(currentPasswordInput, { target: { value: 'currentpass' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'newpass123' } });
      
      const form = currentPasswordInput.closest('form');
      fireEvent.submit(form);
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Digite a nova senha');
      });
      expect(mockApi.put).not.toHaveBeenCalled();
    });

    it('should show error when new password is less than 6 characters', async () => {
      const currentPasswordInput = screen.getByLabelText('Senha Atual');
      const newPasswordInput = screen.getByLabelText('Nova Senha');
      const confirmPasswordInput = screen.getByLabelText('Confirmar Nova Senha');
      
      fireEvent.change(currentPasswordInput, { target: { value: 'currentpass' } });
      fireEvent.change(newPasswordInput, { target: { value: '12345' } });
      fireEvent.change(confirmPasswordInput, { target: { value: '12345' } });
      
      const form = currentPasswordInput.closest('form');
      fireEvent.submit(form);
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('A nova senha deve ter no mínimo 6 caracteres');
      });
      expect(mockApi.put).not.toHaveBeenCalled();
    });

    it('should show error when passwords do not match', async () => {
      const currentPasswordInput = screen.getByLabelText('Senha Atual');
      const newPasswordInput = screen.getByLabelText('Nova Senha');
      const confirmPasswordInput = screen.getByLabelText('Confirmar Nova Senha');
      
      fireEvent.change(currentPasswordInput, { target: { value: 'currentpass' } });
      fireEvent.change(newPasswordInput, { target: { value: 'newpass123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'differentpass' } });
      
      const form = currentPasswordInput.closest('form');
      fireEvent.submit(form);
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('As senhas não conferem');
      });
      expect(mockApi.put).not.toHaveBeenCalled();
    });
  });

  describe('password change submission', () => {
    beforeEach(() => {
      render(<MyUser />);
      fireEvent.click(screen.getByText('Alterar Senha'));
    });

    const fillValidForm = () => {
      const currentPasswordInput = screen.getByLabelText('Senha Atual');
      const newPasswordInput = screen.getByLabelText('Nova Senha');
      const confirmPasswordInput = screen.getByLabelText('Confirmar Nova Senha');
      
      fireEvent.change(currentPasswordInput, { target: { value: 'currentpass' } });
      fireEvent.change(newPasswordInput, { target: { value: 'newpass123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'newpass123' } });
      
      return currentPasswordInput.closest('form');
    };

    it('should call API with correct data on valid submission', async () => {
      const form = fillValidForm();
      fireEvent.submit(form);
      
      await waitFor(() => {
        expect(mockApi.put).toHaveBeenCalledWith('/users/change-password', {
          currentPassword: 'currentpass',
          newPassword: 'newpass123',
        });
      });
    });

    it('should show success toast on successful password change', async () => {
      const form = fillValidForm();
      fireEvent.submit(form);
      
      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Senha alterada com sucesso!');
      });
    });

    it('should close modal on successful password change', async () => {
      const form = fillValidForm();
      fireEvent.submit(form);
      
      await waitFor(() => {
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
      });
    });

    it('should show error for incorrect current password (401)', async () => {
      mockApi.put.mockRejectedValue({ response: { status: 401 } });
      
      const form = fillValidForm();
      fireEvent.submit(form);
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Senha atual incorreta');
      });
    });

    it('should show API error message on other errors', async () => {
      mockApi.put.mockRejectedValue({ 
        response: { status: 500, data: { error: 'Erro no servidor' } } 
      });
      
      const form = fillValidForm();
      fireEvent.submit(form);
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Erro no servidor');
      });
    });

    it('should show default error message when no specific error', async () => {
      mockApi.put.mockRejectedValue(new Error('Network error'));
      
      const form = fillValidForm();
      fireEvent.submit(form);
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Erro ao alterar senha');
      });
    });
  });

  describe('loading state', () => {
    it('should disable submit button while changing password', async () => {
      mockApi.put.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      render(<MyUser />);
      fireEvent.click(screen.getByText('Alterar Senha'));
      
      const currentPasswordInput = screen.getByLabelText('Senha Atual');
      const newPasswordInput = screen.getByLabelText('Nova Senha');
      const confirmPasswordInput = screen.getByLabelText('Confirmar Nova Senha');
      
      fireEvent.change(currentPasswordInput, { target: { value: 'currentpass' } });
      fireEvent.change(newPasswordInput, { target: { value: 'newpass123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'newpass123' } });
      
      const form = currentPasswordInput.closest('form');
      fireEvent.submit(form);
      
      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: '' }); // Button with spinner
        expect(submitButton).toBeDisabled();
      });
    });

    it('should show spinner while changing password', async () => {
      mockApi.put.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      render(<MyUser />);
      fireEvent.click(screen.getByText('Alterar Senha'));
      
      const currentPasswordInput = screen.getByLabelText('Senha Atual');
      const newPasswordInput = screen.getByLabelText('Nova Senha');
      const confirmPasswordInput = screen.getByLabelText('Confirmar Nova Senha');
      
      fireEvent.change(currentPasswordInput, { target: { value: 'currentpass' } });
      fireEvent.change(newPasswordInput, { target: { value: 'newpass123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'newpass123' } });
      
      const form = currentPasswordInput.closest('form');
      fireEvent.submit(form);
      
      await waitFor(() => {
        expect(document.querySelector('.spinner')).toBeInTheDocument();
      });
    });
  });

  describe('form input handling', () => {
    beforeEach(() => {
      render(<MyUser />);
      fireEvent.click(screen.getByText('Alterar Senha'));
    });

    it('should update current password input value', () => {
      const input = screen.getByLabelText('Senha Atual');
      fireEvent.change(input, { target: { value: 'mypassword' } });
      expect(input).toHaveValue('mypassword');
    });

    it('should update new password input value', () => {
      const input = screen.getByLabelText('Nova Senha');
      fireEvent.change(input, { target: { value: 'newpassword' } });
      expect(input).toHaveValue('newpassword');
    });

    it('should update confirm password input value', () => {
      const input = screen.getByLabelText('Confirmar Nova Senha');
      fireEvent.change(input, { target: { value: 'confirmpassword' } });
      expect(input).toHaveValue('confirmpassword');
    });

    it('should have password type for all inputs', () => {
      expect(screen.getByLabelText('Senha Atual')).toHaveAttribute('type', 'password');
      expect(screen.getByLabelText('Nova Senha')).toHaveAttribute('type', 'password');
      expect(screen.getByLabelText('Confirmar Nova Senha')).toHaveAttribute('type', 'password');
    });

    it('should have correct placeholders', () => {
      expect(screen.getByPlaceholderText('Digite sua senha atual')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Digite a nova senha')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Confirme a nova senha')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have accessible labels for password fields', () => {
      render(<MyUser />);
      fireEvent.click(screen.getByText('Alterar Senha'));
      
      expect(screen.getByLabelText('Senha Atual')).toHaveAttribute('id', 'current-password');
      expect(screen.getByLabelText('Nova Senha')).toHaveAttribute('id', 'new-password');
      expect(screen.getByLabelText('Confirmar Nova Senha')).toHaveAttribute('id', 'confirm-password');
    });
  });

  describe('edge cases', () => {
    it('should handle user with no name gracefully', () => {
      mockUseAuth.mockReturnValue({ user: { ...mockDirigenteUser, name: undefined } });
      render(<MyUser />);
      // Should not crash
      expect(screen.getByText('Meus Dados')).toBeInTheDocument();
    });

    it('should handle exactly 6 character password', async () => {
      render(<MyUser />);
      fireEvent.click(screen.getByText('Alterar Senha'));
      
      const currentPasswordInput = screen.getByLabelText('Senha Atual');
      const newPasswordInput = screen.getByLabelText('Nova Senha');
      const confirmPasswordInput = screen.getByLabelText('Confirmar Nova Senha');
      
      fireEvent.change(currentPasswordInput, { target: { value: 'currentpass' } });
      fireEvent.change(newPasswordInput, { target: { value: '123456' } }); // Exactly 6 chars
      fireEvent.change(confirmPasswordInput, { target: { value: '123456' } });
      
      const form = currentPasswordInput.closest('form');
      fireEvent.submit(form);
      
      await waitFor(() => {
        expect(mockApi.put).toHaveBeenCalled();
      });
    });
  });
});
