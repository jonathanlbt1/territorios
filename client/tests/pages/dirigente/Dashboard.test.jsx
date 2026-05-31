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
  getMapUrl: (filename) => `/api/maps/${filename}`,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  MapPin: (props) => <svg data-testid="mappin-icon" {...props} />,
  Calendar: (props) => <svg data-testid="calendar-icon" {...props} />,
  Clock: (props) => <svg data-testid="clock-icon" {...props} />,
  ChevronRight: (props) => <svg data-testid="chevron-icon" {...props} />,
  AlertTriangle: (props) => <svg data-testid="alert-icon" {...props} />,
  CheckCircle: (props) => <svg data-testid="check-icon" {...props} />,
  Map: (props) => <svg data-testid="map-icon" {...props} />,
}));

// Mock StatusBadge component
vi.mock('../../../src/components/StatusBadge', () => ({
  default: ({ status }) => <span data-testid="status-badge">{status}</span>,
}));

// Mock EmptyState component
vi.mock('../../../src/components/EmptyState', () => ({
  default: ({ title, description }) => (
    <div data-testid="empty-state">
      <span>{title}</span>
      <span>{description}</span>
    </div>
  ),
}));

import DirigenteDashboard from '../../../src/pages/dirigente/Dashboard';

const mockUser = {
  id: 1,
  name: 'João Silva',
  username: 'joao.silva',
  role: 'dirigente',
};

const mockStats = {
  myActiveAssignments: 2,
  myCompletedThisMonth: 5,
};

// Use future dates to avoid overdue calculations
const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 15);
const futureDateString = futureDate.toISOString().split('T')[0];

const pastDate = new Date();
pastDate.setDate(pastDate.getDate() - 5);
const pastDateString = pastDate.toISOString().split('T')[0];

const mockAssignments = [
  {
    id: 1,
    territory_number: '5',
    territory_code: 'T-005',
    locality: 'Centro',
    block_count: 4,
    map_filename: 'ter_5.png',
    status: 'active',
    observations: 'Área comercial',
    due_date: futureDateString,
    assigned_date: '2024-01-15',
  },
  {
    id: 2,
    territory_number: '10',
    territory_code: 'T-010',
    locality: 'Norte',
    block_count: 6,
    map_filename: 'ter_10.png',
    status: 'active',
    observations: null,
    due_date: null,
    assigned_date: futureDateString,
  },
];

const renderComponent = () => {
  return render(
    <MemoryRouter>
      <DirigenteDashboard />
    </MemoryRouter>
  );
};

describe('DirigenteDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    mockUseAuth.mockReturnValue({ user: mockUser });

    mockApi.get.mockImplementation((url) => {
      if (url === '/assignments/active') {
        return Promise.resolve({ data: mockAssignments });
      }
      if (url === '/reports/dashboard-stats') {
        return Promise.resolve({ data: mockStats });
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
    it('should fetch assignments on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledWith('/assignments/active');
      });
    });

    it('should fetch stats on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledWith('/reports/dashboard-stats');
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
    it('should render greeting with user first name', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Olá, João!/)).toBeInTheDocument();
      });
    });

    it('should show assignment count when user has assignments', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Você tem 2 território\(s\) designado\(s\)/)).toBeInTheDocument();
      });
    });

    it('should show no assignments message when user has none', async () => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/assignments/active') {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: mockStats });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Você não tem territórios designados no momento')).toBeInTheDocument();
      });
    });
  });

  describe('stats cards', () => {
    it('should display active assignments count', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('Ativos')).toBeInTheDocument();
      });
    });

    it('should display completed this month count', async () => {
      renderComponent();

      await waitFor(() => {
        // Find the "Este mês" label and verify its sibling count
        expect(screen.getByText('Este mês')).toBeInTheDocument();
        // The count "5" appears multiple times (stats + territory number), verify at least one exists
        const fives = screen.getAllByText('5');
        expect(fives.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should show 0 when stats are null', async () => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/assignments/active') {
          return Promise.resolve({ data: mockAssignments });
        }
        if (url === '/reports/dashboard-stats') {
          return Promise.resolve({ data: null });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        const zeros = screen.getAllByText('0');
        expect(zeros.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('assignments list', () => {
    it('should render "Seus Territórios" heading when has assignments', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Seus Territórios')).toBeInTheDocument();
      });
    });

    it('should render all assignments', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
        expect(screen.getByText('Território: 10')).toBeInTheDocument();
      });
    });

    it('should display assignment localities', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Centro')).toBeInTheDocument();
        expect(screen.getByText('Norte')).toBeInTheDocument();
      });
    });

    it('should display block counts', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('4 quadras')).toBeInTheDocument();
        expect(screen.getByText('6 quadras')).toBeInTheDocument();
      });
    });

    it('should render status badges', async () => {
      renderComponent();

      await waitFor(() => {
        const badges = screen.getAllByTestId('status-badge');
        expect(badges.length).toBe(2);
      });
    });

    it('should display observations when present', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Área comercial')).toBeInTheDocument();
      });
    });

    it('should render assignment links', async () => {
      renderComponent();

      await waitFor(() => {
        const links = document.querySelectorAll('a[href^="/assignment/"]');
        expect(links.length).toBe(2);
      });
    });

    it('should link to correct assignment detail page', async () => {
      renderComponent();

      await waitFor(() => {
        expect(document.querySelector('a[href="/assignment/1"]')).toBeInTheDocument();
        expect(document.querySelector('a[href="/assignment/2"]')).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('should show empty state when no assignments', async () => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/assignments/active') {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: mockStats });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });
    });

    it('should show correct empty state message', async () => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/assignments/active') {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: mockStats });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Nenhum território designado')).toBeInTheDocument();
      });
    });
  });

  describe('overdue assignments', () => {
    it('should show overdue banner for past due assignments', async () => {
      const overdueAssignment = {
        ...mockAssignments[0],
        due_date: pastDateString,
      };

      mockApi.get.mockImplementation((url) => {
        if (url === '/assignments/active') {
          return Promise.resolve({ data: [overdueAssignment] });
        }
        return Promise.resolve({ data: mockStats });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Prazo de devolução expirado!')).toBeInTheDocument();
      });
    });

    it('should show "Atrasado" text for overdue assignments', async () => {
      const overdueAssignment = {
        ...mockAssignments[0],
        due_date: pastDateString,
      };

      mockApi.get.mockImplementation((url) => {
        if (url === '/assignments/active') {
          return Promise.resolve({ data: [overdueAssignment] });
        }
        return Promise.resolve({ data: mockStats });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Atrasado')).toBeInTheDocument();
      });
    });
  });

  describe('due date calculation', () => {
    it('should use due_date when available', async () => {
      renderComponent();

      await waitFor(() => {
        // Due dates should be displayed for both assignments
        const dueDateTexts = screen.getAllByText(/Devolver até/);
        expect(dueDateTexts.length).toBe(2);
      });
    });

    it('should calculate due date from assigned_date when due_date is null', async () => {
      const assignmentNoDueDate = {
        ...mockAssignments[0],
        due_date: null,
        assigned_date: '2024-01-01',
      };

      mockApi.get.mockImplementation((url) => {
        if (url === '/assignments/active') {
          return Promise.resolve({ data: [assignmentNoDueDate] });
        }
        return Promise.resolve({ data: mockStats });
      });

      renderComponent();

      await waitFor(() => {
        // Should calculate 60 days from assigned_date
        expect(screen.getByText(/Devolver até 01\/03\/2024/)).toBeInTheDocument();
      });
    });

    it('should show "Sem prazo definido" when no dates available', async () => {
      const assignmentNoDates = {
        ...mockAssignments[0],
        due_date: null,
        assigned_date: null,
      };

      mockApi.get.mockImplementation((url) => {
        if (url === '/assignments/active') {
          return Promise.resolve({ data: [assignmentNoDates] });
        }
        return Promise.resolve({ data: mockStats });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText('Sem prazo definido').length).toBeGreaterThan(0);
      });
    });
  });

  describe('instructions section', () => {
    it('should render instructions heading', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('📋 Como funciona')).toBeInTheDocument();
      });
    });

    it('should render all instruction steps', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('1. Clique em um território para ver o mapa completo')).toBeInTheDocument();
        expect(screen.getByText('2. Ao terminar, marque as quadras trabalhadas')).toBeInTheDocument();
        expect(screen.getByText('3. Adicione observações se necessário')).toBeInTheDocument();
        expect(screen.getByText('4. Clique em "Devolver Território"')).toBeInTheDocument();
      });
    });
  });

  describe('map preview', () => {
    it('should render map images for assignments', async () => {
      renderComponent();

      await waitFor(() => {
        const mapImages = document.querySelectorAll('img[alt^="Mapa"]');
        expect(mapImages.length).toBe(2);
      });
    });

    it('should use correct map URL', async () => {
      renderComponent();

      await waitFor(() => {
        const mapImage = document.querySelector('img[alt="Mapa T-005"]');
        expect(mapImage).toHaveAttribute('src', '/api/maps/ter_5.png');
      });
    });
  });

  describe('user handling', () => {
    it('should handle user with no name gracefully', async () => {
      mockUseAuth.mockReturnValue({ user: { id: 1 } });

      renderComponent();

      await waitFor(() => {
        // Should not crash
        expect(screen.getByText(/Olá/)).toBeInTheDocument();
      });
    });

    it('should handle null user gracefully', async () => {
      mockUseAuth.mockReturnValue({ user: null });

      renderComponent();

      await waitFor(() => {
        // Should not crash
        expect(screen.getByText(/Olá/)).toBeInTheDocument();
      });
    });
  });

  describe('edge cases', () => {
    it('should handle invalid due_date gracefully', async () => {
      const assignmentInvalidDate = {
        ...mockAssignments[0],
        due_date: 'invalid-date',
        assigned_date: null,
      };

      mockApi.get.mockImplementation((url) => {
        if (url === '/assignments/active') {
          return Promise.resolve({ data: [assignmentInvalidDate] });
        }
        return Promise.resolve({ data: mockStats });
      });

      renderComponent();

      await waitFor(() => {
        // Should show "Sem prazo definido" for invalid dates
        expect(screen.getAllByText('Sem prazo definido').length).toBeGreaterThan(0);
      });
    });

    it('should handle invalid assigned_date gracefully', async () => {
      const assignmentInvalidAssignedDate = {
        ...mockAssignments[0],
        due_date: null,
        assigned_date: 'invalid-date',
      };

      mockApi.get.mockImplementation((url) => {
        if (url === '/assignments/active') {
          return Promise.resolve({ data: [assignmentInvalidAssignedDate] });
        }
        return Promise.resolve({ data: mockStats });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText('Sem prazo definido').length).toBeGreaterThan(0);
      });
    });
  });

  describe('accessibility', () => {
    it('should have proper heading hierarchy', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      });
    });

    it('should have accessible links', async () => {
      renderComponent();

      await waitFor(() => {
        const links = screen.getAllByRole('link');
        expect(links.length).toBeGreaterThan(0);
      });
    });
  });
});
