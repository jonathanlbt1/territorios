import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Create mocks with vi.hoisted
const { mockApi, mockToast } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
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
  History: (props) => <svg data-testid="history-icon" {...props} />,
  Search: (props) => <svg data-testid="search-icon" {...props} />,
  Calendar: (props) => <svg data-testid="calendar-icon" {...props} />,
  User: (props) => <svg data-testid="user-icon" {...props} />,
  ChevronDown: (props) => <svg data-testid="chevron-down-icon" {...props} />,
  ChevronUp: (props) => <svg data-testid="chevron-up-icon" {...props} />,
  Filter: (props) => <svg data-testid="filter-icon" {...props} />,
}));

// Mock child components
vi.mock('../../../src/components/StatusBadge', () => ({
  default: ({ status, type }) => <span data-testid={`status-badge-${type}`}>{status}</span>,
}));

vi.mock('../../../src/components/EmptyState', () => ({
  default: ({ title, description }) => (
    <div data-testid="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  ),
}));

import AdminHistory from '../../../src/pages/admin/History';

const mockHistoryData = [
  {
    id: 1,
    territory_number: '5',
    territory_code: 'T-005',
    locality: 'Centro',
    dirigente_name: 'João Silva',
    validation_result: 'complete',
    validated_at: '2024-06-15T10:30:00Z',
    validated_by_name: 'Admin User',
    blocks_worked: ['A', 'B', 'C'],
    block_count: 5,
    return_observations: 'Território trabalhado completamente',
  },
  {
    id: 2,
    territory_number: '10',
    territory_code: 'T-010',
    locality: 'Norte',
    dirigente_name: 'Maria Santos',
    validation_result: 'partial',
    validated_at: '2024-05-20T14:00:00Z',
    validated_by_name: 'Admin User',
    blocks_worked: ['D'],
    block_count: 4,
  },
  {
    id: 3,
    territory_number: '15',
    territory_code: 'T-015',
    locality: 'Sul',
    dirigente_name: 'Pedro Costa',
    validation_result: 'complete',
    validated_at: null, // No validated date
    validated_by_name: null,
    blocks_worked: [],
    block_count: 3,
  },
];

const renderComponent = () => {
  return render(<AdminHistory />);
};

describe('AdminHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    
    mockApi.get.mockResolvedValue({ data: mockHistoryData });
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
    it('should fetch history on mount', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledWith('/assignments/history', expect.any(Object));
      });
    });

    it('should pass start_date parameter', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledWith(
          '/assignments/history',
          expect.objectContaining({
            params: expect.objectContaining({
              start_date: expect.any(String),
              limit: 100,
            }),
          })
        );
      });
    });

    it('should show error toast on fetch failure', async () => {
      mockApi.get.mockRejectedValue(new Error('Network error'));
      
      renderComponent();
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Erro ao carregar histórico');
      });
    });
  });

  describe('header', () => {
    it('should render page title', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Histórico')).toBeInTheDocument();
      });
    });

    it('should display record count', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('3 registros de trabalhos concluídos')).toBeInTheDocument();
      });
    });
  });

  describe('date filter', () => {
    it('should render date filter section', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Filtrar por data')).toBeInTheDocument();
      });
    });

    it('should render date input with label', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByLabelText('Data Inicial')).toBeInTheDocument();
      });
    });

    it('should have date input with correct id', async () => {
      renderComponent();
      
      await waitFor(() => {
        const input = screen.getByLabelText('Data Inicial');
        expect(input).toHaveAttribute('id', 'start-date-filter');
      });
    });

    it('should refetch history when date changes', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledTimes(1);
      });
      
      const dateInput = screen.getByLabelText('Data Inicial');
      fireEvent.change(dateInput, { target: { value: '2024-01-01' } });
      
      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledTimes(2);
      });
    });

    it('should display formatted date in info text', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/Exibindo dados a partir de/)).toBeInTheDocument();
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

    it('should filter by territory code', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
      });
      
      const searchInput = screen.getByPlaceholderText('Buscar por território, localidade ou dirigente...');
      fireEvent.change(searchInput, { target: { value: 'T-005' } });
      
      expect(screen.getByText('Território: 5')).toBeInTheDocument();
      expect(screen.queryByText('Território: 10')).not.toBeInTheDocument();
    });

    it('should filter by locality', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Centro')).toBeInTheDocument();
      });
      
      const searchInput = screen.getByPlaceholderText('Buscar por território, localidade ou dirigente...');
      fireEvent.change(searchInput, { target: { value: 'Norte' } });
      
      expect(screen.queryByText('Centro')).not.toBeInTheDocument();
      expect(screen.getByText('Norte')).toBeInTheDocument();
    });

    it('should filter by dirigente name', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });
      
      const searchInput = screen.getByPlaceholderText('Buscar por território, localidade ou dirigente...');
      fireEvent.change(searchInput, { target: { value: 'Maria' } });
      
      expect(screen.queryByText('João Silva')).not.toBeInTheDocument();
      expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    });

    it('should be case insensitive', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Centro')).toBeInTheDocument();
      });
      
      const searchInput = screen.getByPlaceholderText('Buscar por território, localidade ou dirigente...');
      fireEvent.change(searchInput, { target: { value: 'CENTRO' } });
      
      expect(screen.getByText('Centro')).toBeInTheDocument();
    });
  });

  describe('history list', () => {
    it('should render history items', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
        expect(screen.getByText('Território: 10')).toBeInTheDocument();
        expect(screen.getByText('Território: 15')).toBeInTheDocument();
      });
    });

    it('should render territory numbers', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('15').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should render localities', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Centro')).toBeInTheDocument();
        expect(screen.getByText('Norte')).toBeInTheDocument();
        expect(screen.getByText('Sul')).toBeInTheDocument();
      });
    });

    it('should render dirigente names', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
        expect(screen.getByText('Maria Santos')).toBeInTheDocument();
        expect(screen.getByText('Pedro Costa')).toBeInTheDocument();
      });
    });

    it('should render status badges', async () => {
      renderComponent();
      
      await waitFor(() => {
        const badges = screen.getAllByTestId('status-badge-result');
        expect(badges.length).toBe(3);
      });
    });

    it('should render validated dates', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('15/06/2024')).toBeInTheDocument();
        expect(screen.getByText('20/05/2024')).toBeInTheDocument();
      });
    });

    it('should show "Data indisponível" when validated_at is null', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Data indisponível')).toBeInTheDocument();
      });
    });
  });

  describe('expand/collapse functionality', () => {
    it('should show chevron down icon by default', async () => {
      renderComponent();
      
      await waitFor(() => {
        const chevronDownIcons = screen.getAllByTestId('chevron-down-icon');
        expect(chevronDownIcons.length).toBe(3);
      });
    });

    it('should expand item when clicked', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
      });
      
      const firstItem = screen.getByText('Território: 5').closest('button');
      fireEvent.click(firstItem);
      
      expect(screen.getByText('Quadras Trabalhadas')).toBeInTheDocument();
    });

    it('should show chevron up icon when expanded', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
      });
      
      const firstItem = screen.getByText('Território: 5').closest('button');
      fireEvent.click(firstItem);
      
      expect(screen.getByTestId('chevron-up-icon')).toBeInTheDocument();
    });

    it('should collapse item when clicked again', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
      });
      
      const firstItem = screen.getByText('Território: 5').closest('button');
      fireEvent.click(firstItem);
      expect(screen.getByText('Quadras Trabalhadas')).toBeInTheDocument();
      
      fireEvent.click(firstItem);
      expect(screen.queryByText('Quadras Trabalhadas')).not.toBeInTheDocument();
    });

    it('should collapse previous item when clicking another', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
      });
      
      const firstItem = screen.getByText('Território: 5').closest('button');
      fireEvent.click(firstItem);
      expect(screen.getByText('Quadras Trabalhadas')).toBeInTheDocument();
      
      const secondItem = screen.getByText('Território: 10').closest('button');
      fireEvent.click(secondItem);
      
      // Should show second item's details
      expect(screen.getByText('Quadras Trabalhadas')).toBeInTheDocument();
    });
  });

  describe('expanded details', () => {
    it('should show blocks worked', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
      });
      
      const firstItem = screen.getByText('Território: 5').closest('button');
      fireEvent.click(firstItem);
      
      expect(screen.getByText('A, B, C de 5')).toBeInTheDocument();
    });

    it('should show "Não informado" when no blocks worked', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Território: 15')).toBeInTheDocument();
      });
      
      const thirdItem = screen.getByText('Território: 15').closest('button');
      fireEvent.click(thirdItem);
      
      expect(screen.getByText('Não informado')).toBeInTheDocument();
    });

    it('should show validated by name', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
      });
      
      const firstItem = screen.getByText('Território: 5').closest('button');
      fireEvent.click(firstItem);
      
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });

    it('should show "N/A" when validated_by_name is null', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Território: 15')).toBeInTheDocument();
      });
      
      const thirdItem = screen.getByText('Território: 15').closest('button');
      fireEvent.click(thirdItem);
      
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });

    it('should show return observations when present', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
      });
      
      const firstItem = screen.getByText('Território: 5').closest('button');
      fireEvent.click(firstItem);
      
      expect(screen.getByText('Observações do Dirigente')).toBeInTheDocument();
      expect(screen.getByText('Território trabalhado completamente')).toBeInTheDocument();
    });

    it('should not show observations section when not present', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Território: 10')).toBeInTheDocument();
      });
      
      const secondItem = screen.getByText('Território: 10').closest('button');
      fireEvent.click(secondItem);
      
      expect(screen.queryByText('Observações do Dirigente')).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should show empty state when no history', async () => {
      mockApi.get.mockResolvedValue({ data: [] });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });
    });

    it('should show empty state title', async () => {
      mockApi.get.mockResolvedValue({ data: [] });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Nenhum registro encontrado')).toBeInTheDocument();
      });
    });

    it('should show empty state description', async () => {
      mockApi.get.mockResolvedValue({ data: [] });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('O histórico aparecerá aqui após validar devoluções')).toBeInTheDocument();
      });
    });

    it('should show empty state when search has no results', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
      });
      
      const searchInput = screen.getByPlaceholderText('Buscar por território, localidade ou dirigente...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
      
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
  });

  describe('record count', () => {
    it('should update count to 0 when empty', async () => {
      mockApi.get.mockResolvedValue({ data: [] });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('0 registros de trabalhos concluídos')).toBeInTheDocument();
      });
    });

    it('should show singular form for 1 record', async () => {
      mockApi.get.mockResolvedValue({ data: [mockHistoryData[0]] });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('1 registros de trabalhos concluídos')).toBeInTheDocument();
      });
    });
  });

  describe('edge cases', () => {
    it('should handle null territory_code in filter', async () => {
      mockApi.get.mockResolvedValue({ 
        data: [{ ...mockHistoryData[0], territory_code: null }] 
      });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
      });
      
      const searchInput = screen.getByPlaceholderText('Buscar por território, localidade ou dirigente...');
      fireEvent.change(searchInput, { target: { value: 'test' } });
      
      // Should not crash
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    it('should handle null locality in filter', async () => {
      mockApi.get.mockResolvedValue({ 
        data: [{ ...mockHistoryData[0], locality: null }] 
      });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
      });
      
      const searchInput = screen.getByPlaceholderText('Buscar por território, localidade ou dirigente...');
      fireEvent.change(searchInput, { target: { value: 'test' } });
      
      // Should not crash
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    it('should handle null dirigente_name in filter', async () => {
      mockApi.get.mockResolvedValue({ 
        data: [{ ...mockHistoryData[0], dirigente_name: null }] 
      });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
      });
      
      const searchInput = screen.getByPlaceholderText('Buscar por território, localidade ou dirigente...');
      fireEvent.change(searchInput, { target: { value: 'test' } });
      
      // Should not crash
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    it('should handle invalid validated_at date', async () => {
      mockApi.get.mockResolvedValue({ 
        data: [{ ...mockHistoryData[0], validated_at: 'invalid-date' }] 
      });
      
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Data indisponível')).toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('should have proper label association for date input', async () => {
      renderComponent();
      
      await waitFor(() => {
        const label = screen.getByText('Data Inicial');
        expect(label).toHaveAttribute('for', 'start-date-filter');
      });
    });

    it('should have clickable history items as buttons', async () => {
      renderComponent();
      
      await waitFor(() => {
        const buttons = document.querySelectorAll('button');
        expect(buttons.length).toBeGreaterThanOrEqual(3);
      });
    });
  });
});
