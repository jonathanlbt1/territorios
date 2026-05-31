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
  MapPin: (props) => <svg data-testid="mappin-icon" {...props} />,
  ChevronDown: (props) => <svg data-testid="chevron-down-icon" {...props} />,
  ChevronUp: (props) => <svg data-testid="chevron-up-icon" {...props} />,
  Filter: (props) => <svg data-testid="filter-icon" {...props} />,
}));

// Mock StatusBadge component
vi.mock('../../../src/components/StatusBadge', () => ({
  default: ({ status, type }) => <span data-testid="status-badge" data-status={status} data-type={type}>{status}</span>,
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

import DirigentHistory from '../../../src/pages/dirigente/History';

const mockHistoryData = [
  {
    id: 1,
    territory_number: '5',
    territory_code: 'T-005',
    locality: 'Centro',
    block_count: 4,
    blocks_worked: [1, 2, 3],
    validation_result: 'completed',
    validated_at: '2024-06-15T10:30:00Z',
    return_observations: 'Área bem trabalhada',
  },
  {
    id: 2,
    territory_number: '10',
    territory_code: 'T-010',
    locality: 'Norte',
    block_count: 6,
    blocks_worked: [1, 2],
    validation_result: 'partial',
    validated_at: '2024-05-20T14:00:00Z',
    return_observations: null,
  },
  {
    id: 3,
    territory_number: '15',
    territory_code: 'T-015',
    locality: 'Sul',
    block_count: 3,
    blocks_worked: [],
    validation_result: 'completed',
    validated_at: '2024-04-10T09:00:00Z',
    return_observations: 'Sem observações',
  },
];

const renderComponent = () => {
  return render(<DirigentHistory />);
};

describe('DirigentHistory', () => {
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
        expect(mockApi.get).toHaveBeenCalledWith('/assignments/history', {
          params: expect.objectContaining({
            limit: 100,
            start_date: expect.any(String),
          }),
        });
      });
    });

    it('should show error toast on fetch failure', async () => {
      mockApi.get.mockRejectedValue(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Erro ao carregar histórico');
      });
    });

    it('should refetch when date filter changes', async () => {
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
  });

  describe('header', () => {
    it('should render page title', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Meu Histórico')).toBeInTheDocument();
      });
    });

    it('should display record count', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('3 registros de territórios entregues')).toBeInTheDocument();
      });
    });

    it('should show zero records when history is empty', async () => {
      mockApi.get.mockResolvedValue({ data: [] });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('0 registros de territórios entregues')).toBeInTheDocument();
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

    it('should default to start of current year', async () => {
      renderComponent();

      await waitFor(() => {
        const dateInput = screen.getByLabelText('Data Inicial');
        const currentYear = new Date().getFullYear();
        expect(dateInput.value).toBe(`${currentYear}-01-01`);
      });
    });

    it('should display formatted date message', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Exibindo dados a partir de/)).toBeInTheDocument();
      });
    });

    it('should update filter when date changes', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText('Data Inicial')).toBeInTheDocument();
      });

      const dateInput = screen.getByLabelText('Data Inicial');
      fireEvent.change(dateInput, { target: { value: '2024-06-01' } });

      expect(dateInput.value).toBe('2024-06-01');
    });
  });

  describe('search functionality', () => {
    it('should render search input', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Buscar por código ou localidade...')).toBeInTheDocument();
      });
    });

    it('should filter by territory code', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Buscar por código ou localidade...');
      fireEvent.change(searchInput, { target: { value: 'T-005' } });

      expect(screen.getByText('Território: 5')).toBeInTheDocument();
      expect(screen.queryByText('Território: 10')).not.toBeInTheDocument();
    });

    it('should filter by locality', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Centro')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Buscar por código ou localidade...');
      fireEvent.change(searchInput, { target: { value: 'Norte' } });

      expect(screen.getByText('Norte')).toBeInTheDocument();
      expect(screen.queryByText('Centro')).not.toBeInTheDocument();
    });

    it('should be case insensitive', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Centro')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Buscar por código ou localidade...');
      fireEvent.change(searchInput, { target: { value: 'centro' } });

      expect(screen.getByText('Centro')).toBeInTheDocument();
    });

    it('should show empty state when no results match', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Buscar por código ou localidade...');
      fireEvent.change(searchInput, { target: { value: 'xyz123' } });

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
  });

  describe('history list', () => {
    it('should render all history items', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
        expect(screen.getByText('Território: 10')).toBeInTheDocument();
        expect(screen.getByText('Território: 15')).toBeInTheDocument();
      });
    });

    it('should display territory numbers', async () => {
      renderComponent();

      await waitFor(() => {
        const territoryNumbers = screen.getAllByText('5');
        expect(territoryNumbers.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should display localities', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Centro')).toBeInTheDocument();
        expect(screen.getByText('Norte')).toBeInTheDocument();
        expect(screen.getByText('Sul')).toBeInTheDocument();
      });
    });

    it('should display block counts', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('4 quadras')).toBeInTheDocument();
        expect(screen.getByText('6 quadras')).toBeInTheDocument();
        expect(screen.getByText('3 quadras')).toBeInTheDocument();
      });
    });

    it('should render status badges', async () => {
      renderComponent();

      await waitFor(() => {
        const badges = screen.getAllByTestId('status-badge');
        expect(badges.length).toBe(3);
      });
    });

    it('should pass correct props to status badges', async () => {
      renderComponent();

      await waitFor(() => {
        const badges = screen.getAllByTestId('status-badge');
        expect(badges[0]).toHaveAttribute('data-type', 'result');
      });
    });

    it('should display validation dates', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('15/06/2024')).toBeInTheDocument();
      });
    });
  });

  describe('expandable details', () => {
    it('should show chevron down icon initially', async () => {
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
      
      // Expand
      fireEvent.click(firstItem);
      expect(screen.getByText('Quadras Trabalhadas')).toBeInTheDocument();
      
      // Collapse
      fireEvent.click(firstItem);
      expect(screen.queryByText('Quadras Trabalhadas')).not.toBeInTheDocument();
    });

    it('should display blocks worked when expanded', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
      });

      const firstItem = screen.getByText('Território: 5').closest('button');
      fireEvent.click(firstItem);

      expect(screen.getByText('1, 2, 3 de 4')).toBeInTheDocument();
    });

    it('should show "Não informado" when blocks_worked is empty', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Território: 15')).toBeInTheDocument();
      });

      const thirdItem = screen.getByText('Território: 15').closest('button');
      fireEvent.click(thirdItem);

      expect(screen.getByText('Não informado')).toBeInTheDocument();
    });

    it('should display validation date with time when expanded', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
      });

      const firstItem = screen.getByText('Território: 5').closest('button');
      fireEvent.click(firstItem);

      expect(screen.getByText('Data de Validação')).toBeInTheDocument();
      // Time may vary based on timezone, so use regex to match date and any time
      expect(screen.getByText(/15\/06\/2024 \d{2}:\d{2}/)).toBeInTheDocument();
    });

    it('should display observations when present', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
      });

      const firstItem = screen.getByText('Território: 5').closest('button');
      fireEvent.click(firstItem);

      expect(screen.getByText('Observações')).toBeInTheDocument();
      expect(screen.getByText('Área bem trabalhada')).toBeInTheDocument();
    });

    it('should not display observations section when null', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Território: 10')).toBeInTheDocument();
      });

      const secondItem = screen.getByText('Território: 10').closest('button');
      fireEvent.click(secondItem);

      expect(screen.getByText('Quadras Trabalhadas')).toBeInTheDocument();
      // Should not show observations section for item without observations
      const observationsLabels = screen.queryAllByText('Observações');
      expect(observationsLabels.length).toBe(0);
    });

    it('should only expand one item at a time', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
      });

      // Expand first item
      const firstItem = screen.getByText('Território: 5').closest('button');
      fireEvent.click(firstItem);
      expect(screen.getByText('Área bem trabalhada')).toBeInTheDocument();

      // Expand second item - should collapse first
      const secondItem = screen.getByText('Território: 10').closest('button');
      fireEvent.click(secondItem);

      // First item's details should be gone
      expect(screen.queryByText('Área bem trabalhada')).not.toBeInTheDocument();
      // Second item's details should be visible
      expect(screen.getByText('1, 2 de 6')).toBeInTheDocument();
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

    it('should show correct empty state message', async () => {
      mockApi.get.mockResolvedValue({ data: [] });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Nenhum histórico de entrega')).toBeInTheDocument();
        expect(screen.getByText('Quando você entregar territórios designados, eles aparecerão aqui')).toBeInTheDocument();
      });
    });
  });

  describe('edge cases', () => {
    it('should handle null territory_code gracefully', async () => {
      const dataWithNullCode = [{
        ...mockHistoryData[0],
        territory_code: null,
      }];
      mockApi.get.mockResolvedValue({ data: dataWithNullCode });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
      });

      // Search should still work
      const searchInput = screen.getByPlaceholderText('Buscar por código ou localidade...');
      fireEvent.change(searchInput, { target: { value: 'xyz' } });

      // Should show empty state since null code doesn't match
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    it('should handle null locality gracefully', async () => {
      const dataWithNullLocality = [{
        ...mockHistoryData[0],
        locality: null,
      }];
      mockApi.get.mockResolvedValue({ data: dataWithNullLocality });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
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

    it('should have accessible date input with label', async () => {
      renderComponent();

      await waitFor(() => {
        const dateInput = screen.getByLabelText('Data Inicial');
        expect(dateInput).toHaveAttribute('type', 'date');
      });
    });

    it('should have clickable buttons for expand/collapse', async () => {
      renderComponent();

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBe(3);
      });
    });
  });

  describe('icons', () => {
    it('should render filter icon', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('filter-icon')).toBeInTheDocument();
      });
    });

    it('should render search icon', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('search-icon')).toBeInTheDocument();
      });
    });

    it('should render mappin icons for block counts', async () => {
      renderComponent();

      await waitFor(() => {
        const mappinIcons = screen.getAllByTestId('mappin-icon');
        expect(mappinIcons.length).toBe(3);
      });
    });

    it('should render calendar icons for dates', async () => {
      renderComponent();

      await waitFor(() => {
        const calendarIcons = screen.getAllByTestId('calendar-icon');
        expect(calendarIcons.length).toBe(3);
      });
    });
  });
});
