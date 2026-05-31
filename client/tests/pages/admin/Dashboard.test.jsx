import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Create mocks with vi.hoisted
const { mockApi, mockToast, mockUseAuth } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
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

vi.mock('../../../src/utils/mapUrl', () => ({
  getMapUrl: (filename) => `/maps/${filename}`,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  MapPin: (props) => <svg data-testid="mappin-icon" {...props} />,
  Users: (props) => <svg data-testid="users-icon" {...props} />,
  ClipboardList: (props) => <svg data-testid="clipboard-icon" {...props} />,
  AlertTriangle: (props) => <svg data-testid="alert-icon" {...props} />,
  Clock: (props) => <svg data-testid="clock-icon" {...props} />,
  CheckCircle: (props) => <svg data-testid="check-icon" {...props} />,
  TrendingUp: (props) => <svg data-testid="trending-icon" {...props} />,
  Calendar: (props) => <svg data-testid="calendar-icon" {...props} />,
  ChevronRight: (props) => <svg data-testid="chevron-icon" {...props} />,
  LayoutGrid: (props) => <svg data-testid="grid-icon" {...props} />,
}));

// Mock child components
vi.mock('../../../src/components/StatusBadge', () => ({
  default: ({ status }) => <span data-testid="status-badge">{status}</span>,
}));

vi.mock('../../../src/components/EmptyState', () => ({
  default: ({ title, description }) => (
    <div data-testid="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  ),
}));

import AdminDashboard from '../../../src/pages/admin/Dashboard';

const mockStats = {
  totalTerritories: 50,
  activeAssignments: 12,
  pendingValidations: 3,
  totalDirigentes: 8,
  overdueAssignments: 2,
  neverWorkedTerritories: 5,
  thisMonthCompletions: 10,
  unreadNotifications: 4,
};

const mockActiveAssignments = [
  {
    id: 1,
    territory_number: '5',
    territory_code: 'T-005',
    locality: 'Centro',
    dirigente_id: 2,
    dirigente_name: 'João Silva',
    status: 'in_progress',
    assigned_date: '2024-01-01',
    due_date: '2024-02-01',
    block_count: 8,
  },
  {
    id: 2,
    territory_number: '10',
    territory_code: 'T-010',
    locality: 'Norte',
    dirigente_id: 3,
    dirigente_name: 'Maria Santos',
    status: 'returned',
    assigned_date: '2024-01-15',
    block_count: 6,
  },
  {
    id: 3,
    territory_number: '15',
    territory_code: 'T-015',
    locality: 'Sul',
    dirigente_id: 1, // Same as mockUser.id - admin's own assignment
    dirigente_name: 'Admin User',
    status: 'in_progress',
    assigned_date: '2024-12-01',
    block_count: 10,
    observations: 'Some observations about this territory',
    map_filename: 'ter_15.png',
  },
];

const renderComponent = () => {
  return render(
    <MemoryRouter>
      <AdminDashboard />
    </MemoryRouter>
  );
};

const mockUser = { id: 1, name: 'Admin User', role: 'admin' };

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Set up the auth mock to return user with id 1
    mockUseAuth.mockReturnValue({ user: mockUser });
    
    mockApi.get.mockImplementation((url) => {
      if (url === '/reports/dashboard-stats') {
        return Promise.resolve({ data: mockStats });
      }
      if (url === '/assignments/active') {
        return Promise.resolve({ data: mockActiveAssignments });
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
    it('should fetch dashboard stats on mount', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledWith('/reports/dashboard-stats');
      });
    });

    it('should fetch active assignments on mount', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledWith('/assignments/active');
      });
    });

    it('should show error toast on fetch failure', async () => {
      mockApi.get.mockRejectedValue(new Error('Network error'));
      
      renderComponent();
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Erro ao carregar dados');
      });
    });
  });

  describe('header', () => {
    it('should render page title', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Meu Painel')).toBeInTheDocument();
      });
    });

    it('should render description', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Visão geral do sistema')).toBeInTheDocument();
      });
    });

    it('should render "Mapas Gerais" button', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Mapas Gerais')).toBeInTheDocument();
      });
    });

    it('should link to general maps page', async () => {
      renderComponent();
      
      await waitFor(() => {
        const link = document.querySelector('a[href="/admin/general-maps"]');
        expect(link).toBeInTheDocument();
      });
    });
  });

  describe('stat cards', () => {
    it('should render all stat cards', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Territórios')).toBeInTheDocument();
        // "Designações Ativas" appears in both stat card and section header
        expect(screen.getAllByText('Designações Ativas').length).toBeGreaterThanOrEqual(1);
        // "Aguardando Validação" may appear in stat card and pending section
        expect(screen.getAllByText(/Aguardando Validação/).length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Dirigentes')).toBeInTheDocument();
      });
    });

    it('should display correct stat values', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('50')).toBeInTheDocument(); // totalTerritories
        expect(screen.getByText('12')).toBeInTheDocument(); // activeAssignments
        expect(screen.getByText('3')).toBeInTheDocument(); // pendingValidations
        expect(screen.getByText('8')).toBeInTheDocument(); // totalDirigentes
      });
    });

    it('should link to territories page', async () => {
      renderComponent();
      
      await waitFor(() => {
        const link = document.querySelector('a[href="/admin/territories"]');
        expect(link).toBeInTheDocument();
      });
    });

    it('should link to assignments page', async () => {
      renderComponent();
      
      await waitFor(() => {
        const links = document.querySelectorAll('a[href="/admin/assignments"]');
        expect(links.length).toBeGreaterThan(0);
      });
    });

    it('should link to users page', async () => {
      renderComponent();
      
      await waitFor(() => {
        const link = document.querySelector('a[href="/admin/users"]');
        expect(link).toBeInTheDocument();
      });
    });

    it('should display zero values when stats are null', async () => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/reports/dashboard-stats') {
          return Promise.resolve({ data: null });
        }
        return Promise.resolve({ data: [] });
      });
      
      renderComponent();
      
      await waitFor(() => {
        const zeros = screen.getAllByText('0');
        expect(zeros.length).toBeGreaterThan(0);
      });
    });
  });

  describe('alerts', () => {
    it('should show overdue assignments alert', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Designações Atrasadas')).toBeInTheDocument();
        expect(screen.getByText(/2 designação\(ões\) passou\(aram\) da data de devolução/)).toBeInTheDocument();
      });
    });

    it('should show never worked territories alert', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Territórios Nunca Trabalhados')).toBeInTheDocument();
        expect(screen.getByText(/5 território\(s\) ainda não foi\(ram\) trabalhado\(s\)/)).toBeInTheDocument();
      });
    });

    it('should not show alerts when there are no issues', async () => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/reports/dashboard-stats') {
          return Promise.resolve({ 
            data: { 
              ...mockStats, 
              overdueAssignments: 0, 
              neverWorkedTerritories: 0 
            } 
          });
        }
        return Promise.resolve({ data: [] });
      });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Meu Painel')).toBeInTheDocument();
      });
      
      expect(screen.queryByText('Designações Atrasadas')).not.toBeInTheDocument();
      expect(screen.queryByText('Territórios Nunca Trabalhados')).not.toBeInTheDocument();
    });
  });

  describe('pending validations', () => {
    it('should show pending validations section', async () => {
      renderComponent();
      
      await waitFor(() => {
        // Check header - use getByRole to be more specific
        const headers = screen.getAllByText(/Aguardando Validação/);
        expect(headers.length).toBeGreaterThan(0);
      });
    });

    it('should show count badge for pending validations', async () => {
      renderComponent();
      
      await waitFor(() => {
        // One assignment has 'returned' status
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });

    it('should render pending validation items', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Devolvido por Maria Santos')).toBeInTheDocument();
      });
    });

    it('should link to assignment details', async () => {
      renderComponent();
      
      await waitFor(() => {
        const link = document.querySelector('a[href="/assignment/2"]');
        expect(link).toBeInTheDocument();
      });
    });

    it('should not show pending validations when none exist', async () => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/reports/dashboard-stats') {
          return Promise.resolve({ data: mockStats });
        }
        if (url === '/assignments/active') {
          return Promise.resolve({ 
            data: mockActiveAssignments.filter(a => a.status !== 'returned') 
          });
        }
        return Promise.resolve({ data: [] });
      });
      
      renderComponent();
      
      await waitFor(() => {
        // Wait for page to load
        expect(screen.getByText('Meu Painel')).toBeInTheDocument();
      });
      
      expect(screen.queryByText('Devolvido por')).not.toBeInTheDocument();
    });
  });

  describe('active assignments table', () => {
    it('should render table headers', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Território')).toBeInTheDocument();
        expect(screen.getByText('Dirigente')).toBeInTheDocument();
        expect(screen.getByText('Devolução')).toBeInTheDocument();
        expect(screen.getByText('Status')).toBeInTheDocument();
      });
    });

    it('should render assignment rows (excluding returned)', async () => {
      renderComponent();
      
      await waitFor(() => {
        // Should show assignment 1 and 3 (not returned)
        expect(screen.getByText('João Silva')).toBeInTheDocument();
        expect(screen.getByText('Centro')).toBeInTheDocument();
      });
    });

    it('should show "Ver todas" link', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Ver todas')).toBeInTheDocument();
      });
    });

    it('should link each row to assignment details', async () => {
      renderComponent();
      
      await waitFor(() => {
        const detailsLinks = screen.getAllByText('Detalhes');
        expect(detailsLinks.length).toBeGreaterThan(0);
      });
    });

    it('should render status badges', async () => {
      renderComponent();
      
      await waitFor(() => {
        const badges = screen.getAllByTestId('status-badge');
        expect(badges.length).toBeGreaterThan(0);
      });
    });

    it('should show empty state when no active assignments', async () => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/reports/dashboard-stats') {
          return Promise.resolve({ data: mockStats });
        }
        if (url === '/assignments/active') {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
        expect(screen.getByText('Nenhuma designação ativa')).toBeInTheDocument();
      });
    });
  });

  describe('my territories section', () => {
    it('should show "Meus Territórios" section when user has assignments', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Meus Territórios')).toBeInTheDocument();
      });
    });

    it('should display admin\'s own assignment', async () => {
      renderComponent();
      
      await waitFor(() => {
        // Assignment 3 belongs to admin (dirigente_id === user.id)
        expect(screen.getByText('Território: 15')).toBeInTheDocument();
      });
    });

    it('should display observations when present', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Some observations about this territory')).toBeInTheDocument();
      });
    });

    it('should display block count', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('10 quadras')).toBeInTheDocument();
      });
    });

    it('should not show "Meus Territórios" when admin has no assignments', async () => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/reports/dashboard-stats') {
          return Promise.resolve({ data: mockStats });
        }
        if (url === '/assignments/active') {
          // Return only assignments that don't belong to admin
          return Promise.resolve({ 
            data: mockActiveAssignments.filter(a => a.dirigente_id !== 1) 
          });
        }
        return Promise.resolve({ data: [] });
      });
      
      renderComponent();
      
      await waitFor(() => {
        // Wait for page to load
        expect(screen.getByText('Meu Painel')).toBeInTheDocument();
      });
      
      expect(screen.queryByText('Meus Territórios')).not.toBeInTheDocument();
    });
  });

  describe('quick stats', () => {
    it('should show completions this month', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Concluídos este mês')).toBeInTheDocument();
      });
      
      // Verify the stat value appears (may have duplicates from territory numbers)
      const completionStats = screen.getAllByText('10');
      expect(completionStats.length).toBeGreaterThanOrEqual(1);
    });

    it('should show unread notifications', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Notificações não lidas')).toBeInTheDocument();
        expect(screen.getByText('4')).toBeInTheDocument();
      });
    });
  });

  describe('due date calculation', () => {
    it('should use due_date when available', async () => {
      renderComponent();
      
      await waitFor(() => {
        // Assignment 1 has due_date: '2024-02-01' => 01/02/2024
        expect(screen.getByText(/01\/02\/2024/)).toBeInTheDocument();
      });
    });

    it('should calculate due date from assigned_date when due_date missing', async () => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/reports/dashboard-stats') {
          return Promise.resolve({ data: { ...mockStats, overdueAssignments: 0, neverWorkedTerritories: 0 } });
        }
        if (url === '/assignments/active') {
          return Promise.resolve({
            data: [{
              id: 1,
              territory_number: '5',
              territory_code: 'T-005',
              locality: 'Centro',
              dirigente_id: 2,
              dirigente_name: 'João Silva',
              status: 'in_progress',
              assigned_date: '2024-12-01', // 60 days = 2025-01-30
            }]
          });
        }
        return Promise.resolve({ data: [] });
      });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/30\/01\/2025/)).toBeInTheDocument();
      });
    });

    it('should show "Sem prazo definido" when no dates available', async () => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/reports/dashboard-stats') {
          return Promise.resolve({ data: { ...mockStats, overdueAssignments: 0, neverWorkedTerritories: 0 } });
        }
        if (url === '/assignments/active') {
          return Promise.resolve({
            data: [{
              id: 1,
              territory_number: '5',
              territory_code: 'T-005',
              locality: 'Centro',
              dirigente_id: 2,
              dirigente_name: 'João Silva',
              status: 'in_progress',
              // No dates
            }]
          });
        }
        return Promise.resolve({ data: [] });
      });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Sem prazo definido')).toBeInTheDocument();
      });
    });
  });

  describe('overdue indicators', () => {
    it('should show overdue banner in my territories section', async () => {
      // Mock assignment with past due date
      mockApi.get.mockImplementation((url) => {
        if (url === '/reports/dashboard-stats') {
          return Promise.resolve({ data: mockStats });
        }
        if (url === '/assignments/active') {
          return Promise.resolve({
            data: [{
              id: 1,
              territory_number: '5',
              territory_code: 'T-005',
              locality: 'Centro',
              dirigente_id: 1, // Admin's assignment
              dirigente_name: 'Admin User',
              status: 'in_progress',
              due_date: '2020-01-01', // Past date
              block_count: 5,
            }]
          });
        }
        return Promise.resolve({ data: [] });
      });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Prazo de devolução expirado!')).toBeInTheDocument();
      });
    });

    it('should show "(Atrasado)" indicator in assignments table', async () => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/reports/dashboard-stats') {
          return Promise.resolve({ data: { ...mockStats, overdueAssignments: 0, neverWorkedTerritories: 0 } });
        }
        if (url === '/assignments/active') {
          return Promise.resolve({
            data: [{
              id: 1,
              territory_number: '5',
              territory_code: 'T-005',
              locality: 'Centro',
              dirigente_id: 2,
              dirigente_name: 'João Silva',
              status: 'in_progress',
              due_date: '2020-01-01', // Past date
            }]
          });
        }
        return Promise.resolve({ data: [] });
      });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/\(Atrasado\)/)).toBeInTheDocument();
      });
    });
  });

  describe('map preview', () => {
    it('should render map image for my territories', async () => {
      renderComponent();
      
      await waitFor(() => {
        const mapImage = document.querySelector('img[src="/maps/ter_15.png"]');
        expect(mapImage).toBeInTheDocument();
      });
    });

    it('should have alt text for map image', async () => {
      renderComponent();
      
      await waitFor(() => {
        const mapImage = document.querySelector('img[alt="Mapa T-015"]');
        expect(mapImage).toBeInTheDocument();
      });
    });
  });

  describe('footer in my territories', () => {
    it('should show due date in footer', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/Devolver até/)).toBeInTheDocument();
      });
    });

    it('should show "Ver detalhes" link', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/Ver detalhes/)).toBeInTheDocument();
      });
    });
  });

  describe('edge cases', () => {
    it('should handle null stats gracefully', async () => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/reports/dashboard-stats') {
          return Promise.resolve({ data: null });
        }
        if (url === '/assignments/active') {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Meu Painel')).toBeInTheDocument();
      });
    });

    it('should handle empty assignments array', async () => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/reports/dashboard-stats') {
          return Promise.resolve({ data: mockStats });
        }
        if (url === '/assignments/active') {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });
    });

    it('should limit displayed assignments to 10', async () => {
      const manyAssignments = Array.from({ length: 15 }, (_, i) => ({
        id: i + 1,
        territory_number: String(i + 1),
        territory_code: `T-${String(i + 1).padStart(3, '0')}`,
        locality: `Locality ${i + 1}`,
        dirigente_id: 2,
        dirigente_name: 'João Silva',
        status: 'in_progress',
        assigned_date: '2024-01-01',
      }));
      
      mockApi.get.mockImplementation((url) => {
        if (url === '/reports/dashboard-stats') {
          return Promise.resolve({ data: { ...mockStats, overdueAssignments: 0, neverWorkedTerritories: 0 } });
        }
        if (url === '/assignments/active') {
          return Promise.resolve({ data: manyAssignments });
        }
        return Promise.resolve({ data: [] });
      });
      
      renderComponent();
      
      await waitFor(() => {
        // Should show exactly 10 "Detalhes" links in the table
        const detailsLinks = screen.getAllByText('Detalhes');
        expect(detailsLinks.length).toBe(10);
      });
    });

    it('should handle user with no id', async () => {
      // Mock useAuth to return user without id
      mockUseAuth.mockReturnValue({ user: { name: 'Admin', role: 'admin' } });
      
      // This test verifies the component doesn't crash
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Meu Painel')).toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('should have semantic table structure', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(document.querySelector('table')).toBeInTheDocument();
        expect(document.querySelector('thead')).toBeInTheDocument();
        expect(document.querySelector('tbody')).toBeInTheDocument();
      });
    });

    it('should have proper heading hierarchy', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Meu Painel');
      });
    });
  });
});
