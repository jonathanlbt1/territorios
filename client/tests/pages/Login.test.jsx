import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Create mocks with vi.hoisted
const { mockLogin, mockToggleTheme, mockNavigate, mockToast } = vi.hoisted(() => ({
  mockLogin: vi.fn(),
  mockToggleTheme: vi.fn(),
  mockNavigate: vi.fn(),
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
  }),
}));

vi.mock('../../src/contexts/ThemeContext', () => ({
  useTheme: () => ({
    toggleTheme: mockToggleTheme,
    isDark: false,
  }),
}));

vi.mock('../../src/contexts/ToastContext', () => ({
  useToast: () => mockToast,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock package.json
vi.mock('../../../package.json', () => ({
  default: { version: '1.0.0' },
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Map: (props) => <svg data-testid="map-icon" {...props} />,
  User: (props) => <svg data-testid="user-icon" {...props} />,
  Lock: (props) => <svg data-testid="lock-icon" {...props} />,
  LogIn: (props) => <svg data-testid="login-icon" {...props} />,
  Eye: (props) => <svg data-testid="eye-icon" {...props} />,
  EyeOff: (props) => <svg data-testid="eye-off-icon" {...props} />,
  Sun: (props) => <svg data-testid="sun-icon" {...props} />,
  Moon: (props) => <svg data-testid="moon-icon" {...props} />,
}));

import Login from '../../src/pages/Login';

const renderComponent = () => {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
};

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the login form', () => {
      renderComponent();
      expect(screen.getByText('Entrar na sua conta')).toBeInTheDocument();
    });

    it('should render the app title', () => {
      renderComponent();
      expect(screen.getByText('Territórios')).toBeInTheDocument();
    });

    it('should render the app description', () => {
      renderComponent();
      expect(screen.getByText(/Sistema de Gestão de Territórios/)).toBeInTheDocument();
    });

    it('should render username input', () => {
      renderComponent();
      expect(screen.getByLabelText('Usuário')).toBeInTheDocument();
    });

    it('should render password input', () => {
      renderComponent();
      expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    });

    it('should render submit button', () => {
      renderComponent();
      expect(screen.getByRole('button', { name: /Entrar/i })).toBeInTheDocument();
    });

    it('should render theme toggle button', () => {
      renderComponent();
      expect(screen.getByTestId('moon-icon')).toBeInTheDocument();
    });

    it('should render map logo icon', () => {
      renderComponent();
      expect(screen.getByTestId('map-icon')).toBeInTheDocument();
    });

    it('should render version number', () => {
      renderComponent();
      expect(screen.getByText(/Versão v1.0.0/)).toBeInTheDocument();
    });

    it('should render copyright with current year', () => {
      renderComponent();
      const currentYear = new Date().getFullYear();
      expect(screen.getByText(`© ${currentYear} Territórios`)).toBeInTheDocument();
    });
  });

  describe('form inputs', () => {
    it('should update username value on input', () => {
      renderComponent();
      const usernameInput = screen.getByLabelText('Usuário');
      
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      
      expect(usernameInput).toHaveValue('testuser');
    });

    it('should update password value on input', () => {
      renderComponent();
      const passwordInput = screen.getByLabelText('Senha');
      
      fireEvent.change(passwordInput, { target: { value: 'testpass' } });
      
      expect(passwordInput).toHaveValue('testpass');
    });

    it('should have password input type as password by default', () => {
      renderComponent();
      const passwordInput = screen.getByLabelText('Senha');
      
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('should have correct placeholders', () => {
      renderComponent();
      
      expect(screen.getByPlaceholderText('insira seu usuário')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    });

    it('should have autocomplete attributes', () => {
      renderComponent();
      
      expect(screen.getByLabelText('Usuário')).toHaveAttribute('autocomplete', 'username');
      expect(screen.getByLabelText('Senha')).toHaveAttribute('autocomplete', 'current-password');
    });
  });

  describe('password visibility toggle', () => {
    it('should show eye icon when password is hidden', () => {
      renderComponent();
      expect(screen.getByTestId('eye-icon')).toBeInTheDocument();
    });

    it('should toggle password visibility when eye button is clicked', () => {
      renderComponent();
      const passwordInput = screen.getByLabelText('Senha');
      const toggleButton = screen.getByTestId('eye-icon').closest('button');
      
      expect(passwordInput).toHaveAttribute('type', 'password');
      
      fireEvent.click(toggleButton);
      
      expect(passwordInput).toHaveAttribute('type', 'text');
      expect(screen.getByTestId('eye-off-icon')).toBeInTheDocument();
    });

    it('should hide password again when toggled twice', () => {
      renderComponent();
      const passwordInput = screen.getByLabelText('Senha');
      const toggleButton = screen.getByTestId('eye-icon').closest('button');
      
      fireEvent.click(toggleButton);
      fireEvent.click(screen.getByTestId('eye-off-icon').closest('button'));
      
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(screen.getByTestId('eye-icon')).toBeInTheDocument();
    });
  });

  describe('theme toggle', () => {
    it('should call toggleTheme when theme button is clicked', () => {
      renderComponent();
      const themeButton = screen.getByTestId('moon-icon').closest('button');
      
      fireEvent.click(themeButton);
      
      expect(mockToggleTheme).toHaveBeenCalledTimes(1);
    });
  });

  describe('form validation', () => {
    it('should show error toast when submitting with empty username', async () => {
      renderComponent();
      const passwordInput = screen.getByLabelText('Senha');
      const submitButton = screen.getByRole('button', { name: /Entrar/i });
      
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Preencha todos os campos');
      });
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('should show error toast when submitting with empty password', async () => {
      renderComponent();
      const usernameInput = screen.getByLabelText('Usuário');
      const submitButton = screen.getByRole('button', { name: /Entrar/i });
      
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Preencha todos os campos');
      });
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('should show error toast when submitting with both fields empty', async () => {
      renderComponent();
      const submitButton = screen.getByRole('button', { name: /Entrar/i });
      
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Preencha todos os campos');
      });
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  describe('form submission', () => {
    it('should call login with username and password', async () => {
      mockLogin.mockResolvedValue({ name: 'Test User', role: 'dirigente' });
      renderComponent();
      
      const usernameInput = screen.getByLabelText('Usuário');
      const passwordInput = screen.getByLabelText('Senha');
      const submitButton = screen.getByRole('button', { name: /Entrar/i });
      
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('testuser', 'password123');
      });
    });

    it('should show success toast with user name on successful login', async () => {
      mockLogin.mockResolvedValue({ name: 'João Silva', role: 'dirigente' });
      renderComponent();
      
      const usernameInput = screen.getByLabelText('Usuário');
      const passwordInput = screen.getByLabelText('Senha');
      const submitButton = screen.getByRole('button', { name: /Entrar/i });
      
      fireEvent.change(usernameInput, { target: { value: 'joao' } });
      fireEvent.change(passwordInput, { target: { value: 'password' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Bem-vindo, João Silva!');
      });
    });

    it('should navigate to /dirigente for dirigente role', async () => {
      mockLogin.mockResolvedValue({ name: 'Test User', role: 'dirigente' });
      renderComponent();
      
      const usernameInput = screen.getByLabelText('Usuário');
      const passwordInput = screen.getByLabelText('Senha');
      const submitButton = screen.getByRole('button', { name: /Entrar/i });
      
      fireEvent.change(usernameInput, { target: { value: 'user' } });
      fireEvent.change(passwordInput, { target: { value: 'pass' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dirigente');
      });
    });

    it('should navigate to /admin for admin role', async () => {
      mockLogin.mockResolvedValue({ name: 'Admin User', role: 'admin' });
      renderComponent();
      
      const usernameInput = screen.getByLabelText('Usuário');
      const passwordInput = screen.getByLabelText('Senha');
      const submitButton = screen.getByRole('button', { name: /Entrar/i });
      
      fireEvent.change(usernameInput, { target: { value: 'admin' } });
      fireEvent.change(passwordInput, { target: { value: 'adminpass' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admin');
      });
    });
  });

  describe('error handling', () => {
    it('should show error toast with API error message on login failure', async () => {
      mockLogin.mockRejectedValue({ response: { data: { error: 'Credenciais inválidas' } } });
      renderComponent();
      
      const usernameInput = screen.getByLabelText('Usuário');
      const passwordInput = screen.getByLabelText('Senha');
      const submitButton = screen.getByRole('button', { name: /Entrar/i });
      
      fireEvent.change(usernameInput, { target: { value: 'wronguser' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Credenciais inválidas');
      });
    });

    it('should show default error message when no specific error', async () => {
      mockLogin.mockRejectedValue(new Error('Network error'));
      renderComponent();
      
      const usernameInput = screen.getByLabelText('Usuário');
      const passwordInput = screen.getByLabelText('Senha');
      const submitButton = screen.getByRole('button', { name: /Entrar/i });
      
      fireEvent.change(usernameInput, { target: { value: 'user' } });
      fireEvent.change(passwordInput, { target: { value: 'pass' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Erro ao fazer login');
      });
    });

    it('should not navigate on login failure', async () => {
      mockLogin.mockRejectedValue(new Error('Failed'));
      renderComponent();
      
      const usernameInput = screen.getByLabelText('Usuário');
      const passwordInput = screen.getByLabelText('Senha');
      const submitButton = screen.getByRole('button', { name: /Entrar/i });
      
      fireEvent.change(usernameInput, { target: { value: 'user' } });
      fireEvent.change(passwordInput, { target: { value: 'pass' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled();
      });
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('should disable submit button while loading', async () => {
      mockLogin.mockImplementation(() => new Promise(() => {})); // Never resolves
      renderComponent();
      
      const usernameInput = screen.getByLabelText('Usuário');
      const passwordInput = screen.getByLabelText('Senha');
      const submitButton = screen.getByRole('button', { name: /Entrar/i });
      
      fireEvent.change(usernameInput, { target: { value: 'user' } });
      fireEvent.change(passwordInput, { target: { value: 'pass' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });
    });

    it('should show spinner while loading', async () => {
      mockLogin.mockImplementation(() => new Promise(() => {})); // Never resolves
      renderComponent();
      
      const usernameInput = screen.getByLabelText('Usuário');
      const passwordInput = screen.getByLabelText('Senha');
      const submitButton = screen.getByRole('button', { name: /Entrar/i });
      
      fireEvent.change(usernameInput, { target: { value: 'user' } });
      fireEvent.change(passwordInput, { target: { value: 'pass' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(document.querySelector('.spinner')).toBeInTheDocument();
      });
    });

    it('should hide login icon while loading', async () => {
      mockLogin.mockImplementation(() => new Promise(() => {})); // Never resolves
      renderComponent();
      
      const usernameInput = screen.getByLabelText('Usuário');
      const passwordInput = screen.getByLabelText('Senha');
      const submitButton = screen.getByRole('button', { name: /Entrar/i });
      
      expect(screen.getByTestId('login-icon')).toBeInTheDocument();
      
      fireEvent.change(usernameInput, { target: { value: 'user' } });
      fireEvent.change(passwordInput, { target: { value: 'pass' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.queryByTestId('login-icon')).not.toBeInTheDocument();
      });
    });

    it('should re-enable button after login completes', async () => {
      mockLogin.mockResolvedValue({ name: 'User', role: 'dirigente' });
      renderComponent();
      
      const usernameInput = screen.getByLabelText('Usuário');
      const passwordInput = screen.getByLabelText('Senha');
      const submitButton = screen.getByRole('button', { name: /Entrar/i });
      
      fireEvent.change(usernameInput, { target: { value: 'user' } });
      fireEvent.change(passwordInput, { target: { value: 'pass' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });

    it('should re-enable button after login fails', async () => {
      mockLogin.mockRejectedValue(new Error('Failed'));
      renderComponent();
      
      const usernameInput = screen.getByLabelText('Usuário');
      const passwordInput = screen.getByLabelText('Senha');
      const submitButton = screen.getByRole('button', { name: /Entrar/i });
      
      fireEvent.change(usernameInput, { target: { value: 'user' } });
      fireEvent.change(passwordInput, { target: { value: 'pass' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });
  });

  describe('accessibility', () => {
    it('should have accessible username label', () => {
      renderComponent();
      const input = screen.getByLabelText('Usuário');
      expect(input).toHaveAttribute('id', 'login-username');
    });

    it('should have accessible password label', () => {
      renderComponent();
      const input = screen.getByLabelText('Senha');
      expect(input).toHaveAttribute('id', 'login-password');
    });

    it('should have form icons for visual indication', () => {
      renderComponent();
      expect(screen.getByTestId('user-icon')).toBeInTheDocument();
      expect(screen.getByTestId('lock-icon')).toBeInTheDocument();
    });
  });
});
