import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Create mocks with vi.hoisted
const { mockApi, mockToast } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
  },
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../../../src/services/api', () => ({
  default: mockApi,
}));

vi.mock('../../../src/contexts/ToastContext', () => ({
  useToast: () => mockToast,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Plus: (props) => <svg data-testid="plus-icon" {...props} />,
  ClipboardList: (props) => <svg data-testid="clipboard-icon" {...props} />,
  Calendar: (props) => <svg data-testid="calendar-icon" {...props} />,
  User: (props) => <svg data-testid="user-icon" {...props} />,
  ChevronRight: (props) => <svg data-testid="chevron-icon" {...props} />,
  Search: (props) => <svg data-testid="search-icon" {...props} />,
  X: (props) => <svg data-testid="x-icon" {...props} />,
}));

// Mock child components
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

vi.mock('../../../src/components/StatusBadge', () => ({
  default: ({ status, type }) => <span data-testid={`status-badge-${type || 'status'}`}>{status}</span>,
}));

vi.mock('../../../src/components/EmptyState', () => ({
  default: ({ title, description }) => (
    <div data-testid="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  ),
}));

import AdminAssignments from '../../../src/pages/admin/Assignments';

const mockAssignments = [
  {
    id: 1,
    territory_number: '5',
    territory_code: 'T-005',
    locality: 'Centro',
    dirigente_name: 'João Silva',
    status: 'in_progress',
    assigned_date: '2024-01-01',
    due_date: '2024-02-01',
  },
  {
    id: 2,
    territory_number: '10',
    territory_code: 'T-010',
    locality: 'Norte',
    dirigente_name: 'Maria Santos',
    status: 'returned',
    assigned_date: '2024-01-15',
    validation_result: 'complete',
  },
  {
    id: 3,
    territory_number: '15',
    territory_code: 'T-015',
    locality: 'Sul',
    dirigente_name: 'Pedro Costa',
    status: 'completed',
    assigned_date: '2023-12-01',
  },
];

const mockTerritories = [
  { id: 1, territory_number: '20', locality: 'Leste', block_count: 5 },
  { id: 2, territory_number: '25', locality: 'Oeste', block_count: 3 },
];

const mockDirigentes = [
  { id: 1, name: 'João Silva' },
  { id: 2, name: 'Maria Santos' },
];

const renderComponent = () => {
  return render(
    <MemoryRouter>
      <AdminAssignments />
    </MemoryRouter>
  );
};

describe('AdminAssignments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.log and console.error for cleaner test output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    
    mockApi.get.mockImplementation((url) => {
      if (url === '/assignments') {
        return Promise.resolve({ data: mockAssignments });
      }
      if (url === '/territories/available') {
        return Promise.resolve({ data: mockTerritories });
      }
      if (url === '/users/assignable') {
        return Promise.resolve({ data: mockDirigentes });
      }
      return Promise.resolve({ data: [] });
    });
  });

  describe('loading state', () => {
    it('should show loading spinner initially', () => {
      mockApi.get.mockImplementation(() => new Promise(() => {})); // Never resolves
      
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
        expect(mockApi.get).toHaveBeenCalledWith('/assignments');
      });
    });

    it('should fetch available territories on mount', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledWith('/territories/available');
      });
    });

    it('should fetch assignable users on mount', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledWith('/users/assignable');
      });
    });

    it('should show error toast on fetch failure', async () => {
      mockApi.get.mockRejectedValue({ response: { data: { error: 'Server error' } } });
      
      renderComponent();
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Server error');
      });
    });
  });

  describe('header', () => {
    it('should render page title', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Designações')).toBeInTheDocument();
      });
    });

    it('should render description', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Gerencie as designações de territórios')).toBeInTheDocument();
      });
    });

    it('should render "Nova Designação" button', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Nova Designação')).toBeInTheDocument();
      });
    });
  });

  describe('filter buttons', () => {
    it('should render filter buttons', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Ativas')).toBeInTheDocument();
        expect(screen.getByText('Devolvidas')).toBeInTheDocument();
        expect(screen.getByText('Concluídas')).toBeInTheDocument();
      });
    });

    it('should filter by active status', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
      });
      
      // Active filter is default, should show in_progress
      expect(screen.getByText('Território: 5')).toBeInTheDocument();
    });

    it('should filter by returned status', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Devolvidas')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Devolvidas'));
      
      await waitFor(() => {
        expect(screen.getByText('Território: 10')).toBeInTheDocument();
      });
    });

    it('should filter by completed status', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Concluídas')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Concluídas'));
      
      await waitFor(() => {
        expect(screen.getByText('Território: 15')).toBeInTheDocument();
      });
    });
  });

  describe('search functionality', () => {
    it('should render search input', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Buscar por território, localidade ou dirigente...')).toBeInTheDocument();
      });
    });

    it('should filter assignments by search term', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
      });
      
      const searchInput = screen.getByPlaceholderText('Buscar por território, localidade ou dirigente...');
      fireEvent.change(searchInput, { target: { value: 'Centro' } });
      
      expect(screen.getByText('Território: 5')).toBeInTheDocument();
    });

    it('should search by dirigente name', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
      });
      
      const searchInput = screen.getByPlaceholderText('Buscar por território, localidade ou dirigente...');
      fireEvent.change(searchInput, { target: { value: 'João' } });
      
      expect(screen.getByText('Território: 5')).toBeInTheDocument();
    });
  });

  describe('assignments list', () => {
    it('should render assignment cards', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
      });
    });

    it('should render locality', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Centro')).toBeInTheDocument();
      });
    });

    it('should render dirigente name', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });
    });

    it('should render status badge', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getAllByTestId('status-badge-status').length).toBeGreaterThan(0);
      });
    });

    it('should link to assignment detail page', async () => {
      renderComponent();
      
      await waitFor(() => {
        const link = document.querySelector('a[href="/assignment/1"]');
        expect(link).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('should show empty state when no assignments match filter', async () => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/assignments') {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });
    });

    it('should show appropriate message for active filter', async () => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/assignments') {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Crie uma nova designação para começar')).toBeInTheDocument();
      });
    });
  });

  describe('create assignment modal', () => {
    it('should open modal when clicking "Nova Designação"', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Nova Designação')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Nova Designação'));
      
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    it('should close modal when clicking close button', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Nova Designação')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Nova Designação'));
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      
      fireEvent.click(screen.getByTestId('modal-close'));
      
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('should render territory search in modal', async () => {
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Nova Designação'));
      });
      
      expect(screen.getByPlaceholderText('Buscar por número ou localidade')).toBeInTheDocument();
    });

    it('should render territory list in modal', async () => {
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Nova Designação'));
      });
      
      expect(screen.getByText('Território: 20')).toBeInTheDocument();
      expect(screen.getByText('Território: 25')).toBeInTheDocument();
    });

    it('should render dirigente select', async () => {
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Nova Designação'));
      });
      
      expect(screen.getByText('Selecione um dirigente')).toBeInTheDocument();
    });

    it('should render dirigente options', async () => {
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Nova Designação'));
      });
      
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('should show selected count', async () => {
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Nova Designação'));
      });
      
      expect(screen.getByText('0 selecionado(s)')).toBeInTheDocument();
    });

    it('should update selected count when territory is checked', async () => {
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Nova Designação'));
      });
      
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      
      expect(screen.getByText('1 selecionado(s)')).toBeInTheDocument();
    });

    it('should clear selection when clicking "Limpar seleção"', async () => {
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Nova Designação'));
      });
      
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      
      expect(screen.getByText('1 selecionado(s)')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Limpar seleção'));
      
      expect(screen.getByText('0 selecionado(s)')).toBeInTheDocument();
    });
  });

  describe('create assignment submission', () => {
    it('should show error when submitting with territory but no dirigente', async () => {
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Nova Designação'));
      });
      
      // Select a territory
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      
      // Submit form directly (bypassing native required validation)
      const form = screen.getByTestId('modal').querySelector('form');
      fireEvent.submit(form);
      
      expect(mockToast.error).toHaveBeenCalledWith('Preencha todos os campos');
    });

    it('should disable submit button when no territories selected', async () => {
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Nova Designação'));
      });
      
      const submitButton = screen.getByText('Criar Designação');
      expect(submitButton).toBeDisabled();
    });

    it('should call API on valid submission', async () => {
      mockApi.post.mockResolvedValue({ data: {} });
      
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Nova Designação'));
      });
      
      // Select a territory
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      
      // Select a dirigente
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '1' } });
      
      // Submit
      fireEvent.click(screen.getByText('Criar Designação'));
      
      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith('/assignments', {
          territory_ids: [1],
          dirigente_id: 1,
        });
      });
    });

    it('should show success toast on successful creation', async () => {
      mockApi.post.mockResolvedValue({ data: {} });
      
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Nova Designação'));
      });
      
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '1' } });
      
      fireEvent.click(screen.getByText('Criar Designação'));
      
      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Designação criada com sucesso!');
      });
    });

    it('should close modal on successful creation', async () => {
      mockApi.post.mockResolvedValue({ data: {} });
      
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Nova Designação'));
      });
      
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '1' } });
      
      fireEvent.click(screen.getByText('Criar Designação'));
      
      await waitFor(() => {
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
      });
    });

    it('should show error toast on creation failure', async () => {
      mockApi.post.mockRejectedValue({ response: { data: { error: 'Creation failed' } } });
      
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Nova Designação'));
      });
      
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '1' } });
      
      fireEvent.click(screen.getByText('Criar Designação'));
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Creation failed');
      });
    });
  });

  describe('territory search in modal', () => {
    it('should filter territories by search', async () => {
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Nova Designação'));
      });
      
      const searchInput = screen.getByPlaceholderText('Buscar por número ou localidade');
      fireEvent.change(searchInput, { target: { value: 'Leste' } });
      
      expect(screen.getByText('Território: 20')).toBeInTheDocument();
      expect(screen.queryByText('Território: 25')).not.toBeInTheDocument();
    });

    it('should filter by territory number', async () => {
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Nova Designação'));
      });
      
      const searchInput = screen.getByPlaceholderText('Buscar por número ou localidade');
      fireEvent.change(searchInput, { target: { value: '25' } });
      
      expect(screen.queryByText('Território: 20')).not.toBeInTheDocument();
      expect(screen.getByText('Território: 25')).toBeInTheDocument();
    });
  });

  describe('no territories available', () => {
    it('should show message when no territories available', async () => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/assignments') {
          return Promise.resolve({ data: mockAssignments });
        }
        if (url === '/territories/available') {
          return Promise.resolve({ data: [] });
        }
        if (url === '/users/assignable') {
          return Promise.resolve({ data: mockDirigentes });
        }
        return Promise.resolve({ data: [] });
      });
      
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Nova Designação'));
      });
      
      expect(screen.getByText('Nenhum território disponível no momento')).toBeInTheDocument();
    });

    it('should disable submit button when no territories available', async () => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/assignments') {
          return Promise.resolve({ data: mockAssignments });
        }
        if (url === '/territories/available') {
          return Promise.resolve({ data: [] });
        }
        if (url === '/users/assignable') {
          return Promise.resolve({ data: mockDirigentes });
        }
        return Promise.resolve({ data: [] });
      });
      
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Nova Designação'));
      });
      
      expect(screen.getByText('Criar Designação')).toBeDisabled();
    });
  });

  describe('overdue assignments', () => {
    it('should display overdue indicator for past due assignments', async () => {
      const overdueAssignment = {
        id: 1,
        territory_number: '5',
        territory_code: 'T-005',
        locality: 'Centro',
        dirigente_name: 'João Silva',
        status: 'in_progress',
        assigned_date: '2020-01-01',
        due_date: '2020-02-01',
      };
      
      mockApi.get.mockImplementation((url) => {
        if (url === '/assignments') {
          return Promise.resolve({ data: [overdueAssignment] });
        }
        return Promise.resolve({ data: [] });
      });
      
      renderComponent();
      
      await waitFor(() => {
        // Check for overdue text (with leading space as rendered)
        expect(screen.getByText(/\(Atrasado\)/)).toBeInTheDocument();
      });
    });

    it('should not show overdue for returned assignments', async () => {
      const returnedAssignment = {
        id: 1,
        territory_number: '5',
        territory_code: 'T-005',
        locality: 'Centro',
        dirigente_name: 'João Silva',
        status: 'returned',
        assigned_date: '2020-01-01',
        due_date: '2020-02-01',
      };
      
      mockApi.get.mockImplementation((url) => {
        if (url === '/assignments') {
          return Promise.resolve({ data: [returnedAssignment] });
        }
        return Promise.resolve({ data: [] });
      });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Devolvidas')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Devolvidas'));
      
      await waitFor(() => {
        expect(screen.queryByText('(Atrasado)')).not.toBeInTheDocument();
      });
    });

    it('should not show overdue for completed assignments', async () => {
      const completedAssignment = {
        id: 1,
        territory_number: '5',
        territory_code: 'T-005',
        locality: 'Centro',
        dirigente_name: 'João Silva',
        status: 'completed',
        assigned_date: '2020-01-01',
        due_date: '2020-02-01',
      };
      
      mockApi.get.mockImplementation((url) => {
        if (url === '/assignments') {
          return Promise.resolve({ data: [completedAssignment] });
        }
        return Promise.resolve({ data: [] });
      });
      
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Concluídas'));
      });
      
      await waitFor(() => {
        expect(screen.queryByText('(Atrasado)')).not.toBeInTheDocument();
      });
    });
  });

  describe('validation result badge', () => {
    it('should display validation result badge when present', async () => {
      const assignmentWithResult = {
        id: 1,
        territory_number: '5',
        territory_code: 'T-005',
        locality: 'Centro',
        dirigente_name: 'João Silva',
        status: 'returned',
        validation_result: 'partial',
        assigned_date: '2024-01-01',
      };
      
      mockApi.get.mockImplementation((url) => {
        if (url === '/assignments') {
          return Promise.resolve({ data: [assignmentWithResult] });
        }
        return Promise.resolve({ data: [] });
      });
      
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Devolvidas'));
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('status-badge-result')).toBeInTheDocument();
      });
    });
  });

  describe('due date calculation', () => {
    it('should calculate due date from assigned_date when due_date is missing', async () => {
      const assignmentNoDueDate = {
        id: 1,
        territory_number: '5',
        territory_code: 'T-005',
        locality: 'Centro',
        dirigente_name: 'João Silva',
        status: 'in_progress',
        assigned_date: '2024-12-01',
      };
      
      mockApi.get.mockImplementation((url) => {
        if (url === '/assignments') {
          return Promise.resolve({ data: [assignmentNoDueDate] });
        }
        return Promise.resolve({ data: [] });
      });
      
      renderComponent();
      
      await waitFor(() => {
        // 60 days after 2024-12-01 is 2025-01-30
        expect(screen.getByText(/30\/01\/2025/)).toBeInTheDocument();
      });
    });

    it('should show "Sem prazo definido" when no dates available', async () => {
      const assignmentNoDates = {
        id: 1,
        territory_number: '5',
        territory_code: 'T-005',
        locality: 'Centro',
        dirigente_name: 'João Silva',
        status: 'in_progress',
      };
      
      mockApi.get.mockImplementation((url) => {
        if (url === '/assignments') {
          return Promise.resolve({ data: [assignmentNoDates] });
        }
        return Promise.resolve({ data: [] });
      });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Sem prazo definido')).toBeInTheDocument();
      });
    });
  });

  describe('multiple territory selection', () => {
    it('should allow selecting multiple territories', async () => {
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Nova Designação'));
      });
      
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);
      
      expect(screen.getByText('2 selecionado(s)')).toBeInTheDocument();
    });

    it('should deselect a territory when clicking again', async () => {
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Nova Designação'));
      });
      
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      expect(screen.getByText('1 selecionado(s)')).toBeInTheDocument();
      
      fireEvent.click(checkboxes[0]);
      expect(screen.getByText('0 selecionado(s)')).toBeInTheDocument();
    });

    it('should submit multiple territories', async () => {
      mockApi.post.mockResolvedValue({ data: {} });
      
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Nova Designação'));
      });
      
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);
      
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '1' } });
      
      fireEvent.click(screen.getByText('Criar Designação'));
      
      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith('/assignments', {
          territory_ids: [1, 2],
          dirigente_id: 1,
        });
      });
    });
  });

  describe('cancel button', () => {
    it('should close modal when clicking Cancelar', async () => {
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Nova Designação'));
      });
      
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Cancelar'));
      
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });
  });

  describe('data refetching', () => {
    it('should refetch data after successful assignment creation', async () => {
      mockApi.post.mockResolvedValue({ data: {} });
      
      renderComponent();
      
      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledTimes(3);
      });
      
      fireEvent.click(screen.getByText('Nova Designação'));
      
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '1' } });
      
      fireEvent.click(screen.getByText('Criar Designação'));
      
      await waitFor(() => {
        // Initial 3 calls + 3 refetch calls = 6 total
        expect(mockApi.get).toHaveBeenCalledTimes(6);
      });
    });
  });

  describe('error handling', () => {
    it('should show generic error message when no error response', async () => {
      mockApi.get.mockRejectedValue(new Error('Network error'));
      
      renderComponent();
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Erro ao carregar dados');
      });
    });

    it('should show generic error on creation failure without response', async () => {
      mockApi.post.mockRejectedValue(new Error('Network error'));
      
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Nova Designação'));
      });
      
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '1' } });
      
      fireEvent.click(screen.getByText('Criar Designação'));
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Erro ao criar designação');
      });
    });
  });

  describe('form state reset', () => {
    it('should reset form when reopening modal', async () => {
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Nova Designação'));
      });
      
      // Select a territory
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      expect(screen.getByText('1 selecionado(s)')).toBeInTheDocument();
      
      // Close modal
      fireEvent.click(screen.getByText('Cancelar'));
      
      // Reopen modal
      fireEvent.click(screen.getByText('Nova Designação'));
      
      // Selections should be reset
      expect(screen.getByText('0 selecionado(s)')).toBeInTheDocument();
    });
  });

  describe('territory sorting', () => {
    it('should sort territories by number', async () => {
      const unsortedTerritories = [
        { id: 1, territory_number: '100', locality: 'A', block_count: 1 },
        { id: 2, territory_number: '5', locality: 'B', block_count: 2 },
        { id: 3, territory_number: '50', locality: 'C', block_count: 3 },
      ];
      
      mockApi.get.mockImplementation((url) => {
        if (url === '/assignments') {
          return Promise.resolve({ data: [] });
        }
        if (url === '/territories/available') {
          return Promise.resolve({ data: unsortedTerritories });
        }
        if (url === '/users/assignable') {
          return Promise.resolve({ data: mockDirigentes });
        }
        return Promise.resolve({ data: [] });
      });
      
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Nova Designação'));
      });
      
      const listItems = screen.getAllByRole('listitem');
      
      // Should be sorted: 5, 50, 100
      expect(listItems[0]).toHaveTextContent('Território: 5');
      expect(listItems[1]).toHaveTextContent('Território: 50');
      expect(listItems[2]).toHaveTextContent('Território: 100');
    });
  });

  describe('empty dirigentes', () => {
    it('should handle null assignable users response', async () => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/assignments') {
          return Promise.resolve({ data: mockAssignments });
        }
        if (url === '/territories/available') {
          return Promise.resolve({ data: mockTerritories });
        }
        if (url === '/users/assignable') {
          return Promise.resolve({ data: null });
        }
        return Promise.resolve({ data: [] });
      });
      
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Nova Designação'));
      });
      
      // Should not crash and show empty select
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  describe('territory block count', () => {
    it('should display block count for each territory', async () => {
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Nova Designação'));
      });
      
      expect(screen.getByText('Leste • 5 quadras')).toBeInTheDocument();
      expect(screen.getByText('Oeste • 3 quadras')).toBeInTheDocument();
    });
  });

  describe('pending status', () => {
    it('should include pending assignments in active filter', async () => {
      const pendingAssignment = {
        id: 1,
        territory_number: '5',
        territory_code: 'T-005',
        locality: 'Centro',
        dirigente_name: 'João Silva',
        status: 'pending',
        assigned_date: '2024-01-01',
      };
      
      mockApi.get.mockImplementation((url) => {
        if (url === '/assignments') {
          return Promise.resolve({ data: [pendingAssignment] });
        }
        return Promise.resolve({ data: [] });
      });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
      });
    });
  });

  describe('cancelled status', () => {
    it('should include cancelled assignments in returned filter', async () => {
      const cancelledAssignment = {
        id: 1,
        territory_number: '5',
        territory_code: 'T-005',
        locality: 'Centro',
        dirigente_name: 'João Silva',
        status: 'cancelled',
        assigned_date: '2024-01-01',
      };
      
      mockApi.get.mockImplementation((url) => {
        if (url === '/assignments') {
          return Promise.resolve({ data: [cancelledAssignment] });
        }
        return Promise.resolve({ data: [] });
      });
      
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Devolvidas'));
      });
      
      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('should have territory search input with proper label association', async () => {
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Nova Designação'));
      });
      
      const input = screen.getByLabelText('Territórios');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('id', 'territory-search');
    });

    it('should have dirigente select with proper label association', async () => {
      renderComponent();
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Nova Designação'));
      });
      
      const select = screen.getByLabelText('Dirigente');
      expect(select).toBeInTheDocument();
      expect(select).toHaveAttribute('id', 'dirigente-select');
    });
  });
});
