import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PushNotificationSettings from '../../src/components/PushNotificationSettings';

// Mock the hooks
const mockUsePushNotifications = vi.fn();
const mockUseToast = vi.fn();

vi.mock('../../src/hooks/usePushNotifications', () => ({
  default: () => mockUsePushNotifications(),
}));

vi.mock('../../src/contexts/ToastContext', () => ({
  useToast: () => mockUseToast(),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Bell: (props) => <svg data-testid="bell-icon" {...props} />,
  BellOff: (props) => <svg data-testid="bell-off-icon" {...props} />,
  AlertTriangle: (props) => <svg data-testid="alert-triangle-icon" {...props} />,
  CheckCircle: (props) => <svg data-testid="check-circle-icon" {...props} />,
  Loader2: (props) => <svg data-testid="loader-icon" {...props} />,
}));

describe('PushNotificationSettings', () => {
  const mockToast = {
    success: vi.fn(),
    error: vi.fn(),
  };

  const defaultHookState = {
    supported: true,
    permission: 'default',
    subscribed: false,
    loading: false,
    error: null,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    canSubscribe: true,
    isDenied: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseToast.mockReturnValue(mockToast);
    mockUsePushNotifications.mockReturnValue({ ...defaultHookState });
  });

  describe('unsupported state', () => {
    it('should render unsupported message when not supported', () => {
      mockUsePushNotifications.mockReturnValue({
        ...defaultHookState,
        supported: false,
      });

      render(<PushNotificationSettings />);

      expect(screen.getByText('Notificações não suportadas')).toBeInTheDocument();
      expect(screen.getByText('Seu navegador ou dispositivo não suporta notificações push.')).toBeInTheDocument();
    });

    it('should show BellOff icon when not supported', () => {
      mockUsePushNotifications.mockReturnValue({
        ...defaultHookState,
        supported: false,
      });

      render(<PushNotificationSettings />);

      expect(screen.getByTestId('bell-off-icon')).toBeInTheDocument();
    });

    it('should not render toggle button when not supported', () => {
      mockUsePushNotifications.mockReturnValue({
        ...defaultHookState,
        supported: false,
      });

      render(<PushNotificationSettings />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('denied state', () => {
    it('should render denied message when permission is denied', () => {
      mockUsePushNotifications.mockReturnValue({
        ...defaultHookState,
        isDenied: true,
      });

      render(<PushNotificationSettings />);

      expect(screen.getByText('Permissão bloqueada')).toBeInTheDocument();
      expect(screen.getByText(/As notificações foram bloqueadas/)).toBeInTheDocument();
    });

    it('should show AlertTriangle icon when denied', () => {
      mockUsePushNotifications.mockReturnValue({
        ...defaultHookState,
        isDenied: true,
      });

      render(<PushNotificationSettings />);

      expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();
    });

    it('should not render toggle button when denied', () => {
      mockUsePushNotifications.mockReturnValue({
        ...defaultHookState,
        isDenied: true,
      });

      render(<PushNotificationSettings />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should have amber colored styling for warning', () => {
      mockUsePushNotifications.mockReturnValue({
        ...defaultHookState,
        isDenied: true,
      });

      const { container } = render(<PushNotificationSettings />);

      const warningBox = container.querySelector('[class*="bg-amber"]');
      expect(warningBox).toBeInTheDocument();
    });
  });

  describe('unsubscribed state', () => {
    it('should render toggle button', () => {
      render(<PushNotificationSettings />);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should show "Notificações Push" title', () => {
      render(<PushNotificationSettings />);

      expect(screen.getByText('Notificações Push')).toBeInTheDocument();
    });

    it('should show unsubscribed message', () => {
      render(<PushNotificationSettings />);

      expect(screen.getByText('Ative para receber alertas importantes no seu dispositivo')).toBeInTheDocument();
    });

    it('should show BellOff icon when unsubscribed', () => {
      render(<PushNotificationSettings />);

      expect(screen.getByTestId('bell-off-icon')).toBeInTheDocument();
    });

    it('should have sr-only text for accessibility', () => {
      render(<PushNotificationSettings />);

      expect(screen.getByText('Ativar notificações')).toBeInTheDocument();
    });

    it('should not show "Notificações ativas" badge', () => {
      render(<PushNotificationSettings />);

      expect(screen.queryByText('Notificações ativas')).not.toBeInTheDocument();
    });
  });

  describe('subscribed state', () => {
    beforeEach(() => {
      mockUsePushNotifications.mockReturnValue({
        ...defaultHookState,
        subscribed: true,
      });
    });

    it('should show Bell icon when subscribed', () => {
      render(<PushNotificationSettings />);

      expect(screen.getByTestId('bell-icon')).toBeInTheDocument();
    });

    it('should show subscribed message', () => {
      render(<PushNotificationSettings />);

      expect(screen.getByText('Você receberá alertas de novas designações e devoluções')).toBeInTheDocument();
    });

    it('should show "Notificações ativas" badge', () => {
      render(<PushNotificationSettings />);

      expect(screen.getByText('Notificações ativas')).toBeInTheDocument();
    });

    it('should show CheckCircle icon in badge', () => {
      render(<PushNotificationSettings />);

      expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
    });

    it('should have sr-only text for deactivation', () => {
      render(<PushNotificationSettings />);

      expect(screen.getByText('Desativar notificações')).toBeInTheDocument();
    });

    it('should have emerald colored toggle', () => {
      const { container } = render(<PushNotificationSettings />);

      const toggle = container.querySelector('[class*="bg-emerald-500"]');
      expect(toggle).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should show loader icon when loading', () => {
      mockUsePushNotifications.mockReturnValue({
        ...defaultHookState,
        loading: true,
      });

      render(<PushNotificationSettings />);

      expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    });

    it('should disable toggle button when loading', () => {
      mockUsePushNotifications.mockReturnValue({
        ...defaultHookState,
        loading: true,
      });

      render(<PushNotificationSettings />);

      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('should have reduced opacity when loading', () => {
      mockUsePushNotifications.mockReturnValue({
        ...defaultHookState,
        loading: true,
      });

      const { container } = render(<PushNotificationSettings />);

      const toggle = container.querySelector('[class*="opacity-60"]');
      expect(toggle).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('should display error message', () => {
      mockUsePushNotifications.mockReturnValue({
        ...defaultHookState,
        error: 'Something went wrong',
      });

      render(<PushNotificationSettings />);

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should not display error when isDenied is true', () => {
      mockUsePushNotifications.mockReturnValue({
        ...defaultHookState,
        error: 'Permission denied',
        isDenied: true,
      });

      render(<PushNotificationSettings />);

      // Should show denied UI, not error
      expect(screen.getByText('Permissão bloqueada')).toBeInTheDocument();
      expect(screen.queryByText('Permission denied')).not.toBeInTheDocument();
    });

    it('should have red text for error', () => {
      mockUsePushNotifications.mockReturnValue({
        ...defaultHookState,
        error: 'Error message',
      });

      const { container } = render(<PushNotificationSettings />);

      const errorText = container.querySelector('[class*="text-red"]');
      expect(errorText).toBeInTheDocument();
    });
  });

  describe('subscribe functionality', () => {
    it('should call subscribe when clicking toggle while unsubscribed', async () => {
      const subscribe = vi.fn().mockResolvedValue({ success: true });
      mockUsePushNotifications.mockReturnValue({
        ...defaultHookState,
        subscribe,
      });

      render(<PushNotificationSettings />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(subscribe).toHaveBeenCalledTimes(1);
      });
    });

    it('should show success toast on successful subscription', async () => {
      const subscribe = vi.fn().mockResolvedValue({ success: true });
      mockUsePushNotifications.mockReturnValue({
        ...defaultHookState,
        subscribe,
      });

      render(<PushNotificationSettings />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Notificações ativadas! Você receberá alertas importantes.');
      });
    });

    it('should show error toast when permission is denied', async () => {
      const subscribe = vi.fn().mockResolvedValue({ 
        success: false, 
        error: 'Permission denied by user' 
      });
      mockUsePushNotifications.mockReturnValue({
        ...defaultHookState,
        subscribe,
      });

      render(<PushNotificationSettings />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Permissão negada. Ative nas configurações do navegador.');
      });
    });

    it('should show generic error toast on other errors', async () => {
      const subscribe = vi.fn().mockResolvedValue({ 
        success: false, 
        error: 'Network error' 
      });
      mockUsePushNotifications.mockReturnValue({
        ...defaultHookState,
        subscribe,
      });

      render(<PushNotificationSettings />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Network error');
      });
    });

    it('should show fallback error toast when no error message', async () => {
      const subscribe = vi.fn().mockResolvedValue({ success: false });
      mockUsePushNotifications.mockReturnValue({
        ...defaultHookState,
        subscribe,
      });

      render(<PushNotificationSettings />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Erro ao ativar notificações');
      });
    });
  });

  describe('unsubscribe functionality', () => {
    it('should call unsubscribe when clicking toggle while subscribed', async () => {
      const unsubscribe = vi.fn().mockResolvedValue({ success: true });
      mockUsePushNotifications.mockReturnValue({
        ...defaultHookState,
        subscribed: true,
        unsubscribe,
      });

      render(<PushNotificationSettings />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(unsubscribe).toHaveBeenCalledTimes(1);
      });
    });

    it('should show success toast on successful unsubscription', async () => {
      const unsubscribe = vi.fn().mockResolvedValue({ success: true });
      mockUsePushNotifications.mockReturnValue({
        ...defaultHookState,
        subscribed: true,
        unsubscribe,
      });

      render(<PushNotificationSettings />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Notificações desativadas');
      });
    });

    it('should show error toast on failed unsubscription', async () => {
      const unsubscribe = vi.fn().mockResolvedValue({ success: false });
      mockUsePushNotifications.mockReturnValue({
        ...defaultHookState,
        subscribed: true,
        unsubscribe,
      });

      render(<PushNotificationSettings />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Erro ao desativar notificações');
      });
    });
  });

  describe('styling', () => {
    it('should have rounded-xl container', () => {
      const { container } = render(<PushNotificationSettings />);

      const box = container.querySelector('.rounded-xl');
      expect(box).toBeInTheDocument();
    });

    it('should have border styling', () => {
      const { container } = render(<PushNotificationSettings />);

      const box = container.querySelector('[class*="border-slate"]');
      expect(box).toBeInTheDocument();
    });

    it('should have toggle with transition', () => {
      const { container } = render(<PushNotificationSettings />);

      const toggle = container.querySelector('[class*="transition-colors"]');
      expect(toggle).toBeInTheDocument();
    });
  });

  describe('dark mode support', () => {
    it('should have dark mode classes on unsupported state', () => {
      mockUsePushNotifications.mockReturnValue({
        ...defaultHookState,
        supported: false,
      });

      const { container } = render(<PushNotificationSettings />);

      const box = container.querySelector('[class*="dark:bg-slate-800"]');
      expect(box).toBeInTheDocument();
    });

    it('should have dark mode classes on denied state', () => {
      mockUsePushNotifications.mockReturnValue({
        ...defaultHookState,
        isDenied: true,
      });

      const { container } = render(<PushNotificationSettings />);

      const box = container.querySelector('[class*="dark:bg-amber"]');
      expect(box).toBeInTheDocument();
    });

    it('should have dark mode classes on normal state', () => {
      const { container } = render(<PushNotificationSettings />);

      const box = container.querySelector('[class*="dark:bg-slate-800"]');
      expect(box).toBeInTheDocument();
    });
  });

  describe('Portuguese labels', () => {
    it('should display Portuguese text for unsupported', () => {
      mockUsePushNotifications.mockReturnValue({
        ...defaultHookState,
        supported: false,
      });

      render(<PushNotificationSettings />);

      expect(screen.getByText('Notificações não suportadas')).toBeInTheDocument();
    });

    it('should display Portuguese text for denied', () => {
      mockUsePushNotifications.mockReturnValue({
        ...defaultHookState,
        isDenied: true,
      });

      render(<PushNotificationSettings />);

      expect(screen.getByText('Permissão bloqueada')).toBeInTheDocument();
    });

    it('should display Portuguese title', () => {
      render(<PushNotificationSettings />);

      expect(screen.getByText('Notificações Push')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have sr-only label for screen readers', () => {
      render(<PushNotificationSettings />);

      const srOnly = screen.getByText('Ativar notificações');
      expect(srOnly).toHaveClass('sr-only');
    });

    it('should have button role for toggle', () => {
      render(<PushNotificationSettings />);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should have focus ring classes for keyboard navigation', () => {
      const { container } = render(<PushNotificationSettings />);

      const toggle = container.querySelector('[class*="focus:ring-2"]');
      expect(toggle).toBeInTheDocument();
    });
  });

  describe('toggle visual states', () => {
    it('should have toggle knob at left when unsubscribed', () => {
      const { container } = render(<PushNotificationSettings />);

      const knob = container.querySelector('[class*="translate-x-0"]');
      expect(knob).toBeInTheDocument();
    });

    it('should have toggle knob at right when subscribed', () => {
      mockUsePushNotifications.mockReturnValue({
        ...defaultHookState,
        subscribed: true,
      });

      const { container } = render(<PushNotificationSettings />);

      const knob = container.querySelector('[class*="translate-x-5"]');
      expect(knob).toBeInTheDocument();
    });

    it('should have slate background when unsubscribed', () => {
      const { container } = render(<PushNotificationSettings />);

      const toggle = container.querySelector('[class*="bg-slate-200"]');
      expect(toggle).toBeInTheDocument();
    });
  });

  describe('icon containers', () => {
    it('should have emerald background for icon when subscribed', () => {
      mockUsePushNotifications.mockReturnValue({
        ...defaultHookState,
        subscribed: true,
      });

      const { container } = render(<PushNotificationSettings />);

      const iconContainer = container.querySelector('[class*="bg-emerald-100"]');
      expect(iconContainer).toBeInTheDocument();
    });

    it('should have slate background for icon when unsubscribed', () => {
      const { container } = render(<PushNotificationSettings />);

      const iconContainer = container.querySelector('[class*="bg-slate-100"]');
      expect(iconContainer).toBeInTheDocument();
    });
  });
});
