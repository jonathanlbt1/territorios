import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Layout from '../../src/components/Layout';

// Mock the contexts
const mockLogout = vi.fn();
const mockNavigate = vi.fn();
const mockToggleTheme = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Outlet: () => <div data-testid="outlet">Page Content</div>,
  };
});

vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../src/contexts/ThemeContext', () => ({
  useTheme: vi.fn(),
}));

vi.mock('../../src/services/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../src/components/NotificationsMenu', () => ({
  default: ({ open, notifications, onClose, placement }) => (
    open ? (
      <div data-testid={`notifications-menu-${placement}`}>
        <span data-testid="notifications-count">{notifications.length}</span>
        <button onClick={onClose} data-testid="close-notifications">Close</button>
      </div>
    ) : null
  ),
}));

// Import mocked modules
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import api from '../../src/services/api';

describe('Layout', () => {
  const adminUser = {
    id: 1,
    name: 'Admin User',
    role: 'admin',
  };

  const dirigenteUser = {
    id: 2,
    name: 'Dirigente User',
    role: 'dirigente',
  };

  const mockNotifications = [
    { id: 1, message: 'Notification 1', is_read: false },
    { id: 2, message: 'Notification 2', is_read: true },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mocks
    useAuth.mockReturnValue({
      user: adminUser,
      logout: mockLogout,
      isAdmin: true,
    });

    useTheme.mockReturnValue({
      theme: 'light',
      toggleTheme: mockToggleTheme,
      isDark: false,
    });

    api.get.mockResolvedValue({ data: mockNotifications });
    api.put.mockResolvedValue({});
    api.delete.mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  const renderLayout = async () => {
    let result;
    await act(async () => {
      result = render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );
    });
    return result;
  };

  describe('rendering', () => {
    it('should render the app title', async () => {
      await renderLayout();
      
      expect(screen.getAllByText('Territórios').length).toBeGreaterThan(0);
    });

    it('should render the outlet for page content', async () => {
      await renderLayout();
      
      expect(screen.getByTestId('outlet')).toBeInTheDocument();
    });

    it('should render user name', async () => {
      await renderLayout();
      
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });

    it('should render user role', async () => {
      await renderLayout();
      
      expect(screen.getByText('admin')).toBeInTheDocument();
    });

    it('should render user initial in avatar', async () => {
      await renderLayout();
      
      expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('should render subtitle "Gestão de Territórios"', async () => {
      await renderLayout();
      
      expect(screen.getByText('Gestão de Territórios')).toBeInTheDocument();
    });
  });

  describe('admin navigation', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({
        user: adminUser,
        logout: mockLogout,
        isAdmin: true,
      });
    });

    it('should render admin nav items', async () => {
      await renderLayout();
      
      expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Designações').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Territórios').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Usuários').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Relatórios').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Histórico').length).toBeGreaterThan(0);
    });

    it('should render "Mapas Gerais" link', async () => {
      await renderLayout();
      
      expect(screen.getAllByText('Mapas Gerais').length).toBeGreaterThan(0);
    });
  });

  describe('dirigente navigation', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({
        user: dirigenteUser,
        logout: mockLogout,
        isAdmin: false,
      });
    });

    it('should render dirigente nav items', async () => {
      await renderLayout();
      
      expect(screen.getAllByText('Meus Territórios').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Meu Histórico').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Meus Dados').length).toBeGreaterThan(0);
    });

    it('should render "Mapas Gerais" link for dirigente', async () => {
      await renderLayout();
      
      expect(screen.getAllByText('Mapas Gerais').length).toBeGreaterThan(0);
    });

    it('should not render admin-specific items', async () => {
      await renderLayout();
      
      expect(screen.queryByText('Usuários')).not.toBeInTheDocument();
      expect(screen.queryByText('Relatórios')).not.toBeInTheDocument();
    });
  });

  describe('logout functionality', () => {
    it('should render logout button', async () => {
      await renderLayout();
      
      expect(screen.getByText('Sair')).toBeInTheDocument();
    });

    it('should call logout and navigate on logout click', async () => {
      await renderLayout();
      
      fireEvent.click(screen.getByText('Sair'));
      
      expect(mockLogout).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  describe('theme toggle', () => {
    describe('light mode', () => {
      beforeEach(() => {
        useTheme.mockReturnValue({
          theme: 'light',
          toggleTheme: mockToggleTheme,
          isDark: false,
        });
      });

      it('should render "Modo Escuro" option', async () => {
        await renderLayout();
        
        expect(screen.getByText('Modo Escuro')).toBeInTheDocument();
      });

      it('should call toggleTheme when clicking theme button', async () => {
        await renderLayout();
        
        fireEvent.click(screen.getByText('Modo Escuro'));
        
        expect(mockToggleTheme).toHaveBeenCalled();
      });
    });

    describe('dark mode', () => {
      beforeEach(() => {
        useTheme.mockReturnValue({
          theme: 'dark',
          toggleTheme: mockToggleTheme,
          isDark: true,
        });
      });

      it('should render "Modo Claro" option', async () => {
        await renderLayout();
        
        expect(screen.getByText('Modo Claro')).toBeInTheDocument();
      });

      it('should call toggleTheme when clicking theme button', async () => {
        await renderLayout();
        
        fireEvent.click(screen.getByText('Modo Claro'));
        
        expect(mockToggleTheme).toHaveBeenCalled();
      });
    });
  });

  describe('mobile sidebar', () => {
    it('should render menu button', async () => {
      await renderLayout();
      
      // Menu button is visible on mobile
      const menuButtons = screen.getAllByRole('button');
      expect(menuButtons.length).toBeGreaterThan(0);
    });

    it('should open sidebar when clicking menu button', async () => {
      const { container } = await renderLayout();
      
      // Find the mobile menu button (first button in mobile header)
      const buttons = container.querySelectorAll('button');
      const menuButton = buttons[0]; // First button is the menu
      
      await act(async () => {
        fireEvent.click(menuButton);
      });
      
      // Sidebar should be visible (overlay appears)
      expect(container.querySelector('.bg-black\\/50')).toBeInTheDocument();
    });

    it('should close sidebar when clicking overlay', async () => {
      const { container } = await renderLayout();
      
      // Open sidebar first
      const buttons = container.querySelectorAll('button');
      await act(async () => {
        fireEvent.click(buttons[0]);
      });
      
      // Click overlay to close
      const overlay = container.querySelector('.bg-black\\/50');
      await act(async () => {
        fireEvent.click(overlay);
      });
      
      // Overlay should be gone
      expect(container.querySelector('.bg-black\\/50')).not.toBeInTheDocument();
    });

    it('should close sidebar when clicking X button', async () => {
      const { container } = await renderLayout();
      
      // Open sidebar first
      const buttons = container.querySelectorAll('button');
      await act(async () => {
        fireEvent.click(buttons[0]);
      });
      
      // Find and click X button (in sidebar header)
      const xButton = container.querySelector('aside button');
      if (xButton) {
        await act(async () => {
          fireEvent.click(xButton);
        });
      }
    });
  });

  describe('notifications', () => {
    it('should fetch notifications on mount', async () => {
      await renderLayout();
      
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/users/1/notifications');
      });
    });

    it('should display unread count badge', async () => {
      api.get.mockResolvedValue({
        data: [
          { id: 1, is_read: false },
          { id: 2, is_read: false },
          { id: 3, is_read: true },
        ],
      });
      
      await renderLayout();
      
      await waitFor(() => {
        expect(screen.getAllByText('2').length).toBeGreaterThan(0);
      });
    });

    it('should display 9+ when more than 9 unread', async () => {
      const manyUnread = Array.from({ length: 12 }, (_, i) => ({
        id: i + 1,
        is_read: false,
      }));
      api.get.mockResolvedValue({ data: manyUnread });
      
      await renderLayout();
      
      await waitFor(() => {
        expect(screen.getAllByText('9+').length).toBeGreaterThan(0);
      });
    });

    it('should not display badge when no unread notifications', async () => {
      api.get.mockResolvedValue({
        data: [{ id: 1, is_read: true }],
      });
      
      const { container } = await renderLayout();
      
      await waitFor(() => {
        // Badge element should not exist or have no content
        const badges = container.querySelectorAll('.bg-red-500');
        // Either no badges or badges without unread numbers
        expect(badges.length === 0 || 
          Array.from(badges).every(b => b.textContent === '')).toBe(true);
      });
    });

    it('should open notifications menu on bell click', async () => {
      await renderLayout();
      
      await waitFor(() => {
        expect(api.get).toHaveBeenCalled();
      });
      
      // Find notification button by aria-label
      const notifButtons = screen.getAllByLabelText('Abrir notificações');
      await act(async () => {
        fireEvent.click(notifButtons[0]);
      });
      
      // Notifications menu should be visible
      expect(screen.getByTestId('notifications-menu-mobile')).toBeInTheDocument();
    });

    it('should close notifications menu', async () => {
      await renderLayout();
      
      await waitFor(() => {
        expect(api.get).toHaveBeenCalled();
      });
      
      // Open notifications
      const notifButtons = screen.getAllByLabelText('Abrir notificações');
      await act(async () => {
        fireEvent.click(notifButtons[0]);
      });
      
      // Close notifications - get all close buttons and click the first one
      const closeButtons = screen.getAllByTestId('close-notifications');
      await act(async () => {
        fireEvent.click(closeButtons[0]);
      });
      
      // Menu should be closed
      expect(screen.queryByTestId('notifications-menu-mobile')).not.toBeInTheDocument();
    });

    it('should not fetch notifications if user not logged in', async () => {
      useAuth.mockReturnValue({
        user: null,
        logout: mockLogout,
        isAdmin: false,
      });
      
      await renderLayout();
      
      expect(api.get).not.toHaveBeenCalled();
    });
  });

  describe('user info display', () => {
    it('should display user with single character name initial', async () => {
      useAuth.mockReturnValue({
        user: { id: 1, name: 'Zara', role: 'admin' },
        logout: mockLogout,
        isAdmin: true,
      });
      
      await act(async () => {
        renderLayout();
      });
      
      // Look for the initial in the avatar area
      expect(screen.getByText('Z')).toBeInTheDocument();
      expect(screen.getByText('Zara')).toBeInTheDocument();
    });

    it('should handle user with lowercase name', async () => {
      useAuth.mockReturnValue({
        user: { id: 1, name: 'john doe', role: 'dirigente' },
        logout: mockLogout,
        isAdmin: false,
      });
      
      await act(async () => {
        renderLayout();
      });
      
      expect(screen.getByText('J')).toBeInTheDocument();
      expect(screen.getByText('john doe')).toBeInTheDocument();
    });
  });

  describe('API error handling', () => {
    it('should handle notification fetch error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      api.get.mockRejectedValue(new Error('Network error'));
      
      await renderLayout();
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Error fetching notifications:',
          expect.any(Error)
        );
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('mobile bottom navigation', () => {
    it('should render mobile bottom nav', async () => {
      const { container } = await renderLayout();
      
      expect(container.querySelector('.mobile-nav')).toBeInTheDocument();
    });

    it('should limit mobile nav to 5 items', async () => {
      const { container } = await renderLayout();
      
      const mobileNav = container.querySelector('.mobile-nav');
      const navItems = mobileNav.querySelectorAll('a');
      
      expect(navItems.length).toBeLessThanOrEqual(5);
    });
  });

  describe('nav link classes', () => {
    it('should apply nav-item class to navigation links', async () => {
      const { container } = await renderLayout();
      
      const navItems = container.querySelectorAll('.nav-item');
      expect(navItems.length).toBeGreaterThan(0);
    });
  });

  describe('responsive design', () => {
    it('should render sidebar with responsive classes', async () => {
      const { container } = await renderLayout();
      
      const sidebar = container.querySelector('aside');
      expect(sidebar).toHaveClass('fixed');
      expect(sidebar.className).toContain('md:sticky');
    });

    it('should render main content area', async () => {
      const { container } = await renderLayout();
      
      const main = container.querySelector('main');
      expect(main).toHaveClass('flex-1');
    });
  });
});
