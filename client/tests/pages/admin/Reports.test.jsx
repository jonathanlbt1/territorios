import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Create mocks with vi.hoisted
const { mockApi, mockToast } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
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

// Mock jsPDF as a class
vi.mock('jspdf', () => {
  class MockJsPDF {
    constructor() {
      this.internal = { pageSize: { width: 297 } };
      this.lastAutoTable = { finalY: 100 };
    }
    setFontSize = vi.fn();
    setFont = vi.fn();
    text = vi.fn();
    save = vi.fn();
  }
  return {
    jsPDF: MockJsPDF,
  };
});

vi.mock('jspdf-autotable', () => ({
  default: vi.fn(),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  FileText: (props) => <svg data-testid="filetext-icon" {...props} />,
  TrendingUp: (props) => <svg data-testid="trendingup-icon" {...props} />,
  TrendingDown: (props) => <svg data-testid="trendingdown-icon" {...props} />,
  BarChart2: (props) => <svg data-testid="barchart-icon" {...props} />,
  MapPin: (props) => <svg data-testid="mappin-icon" {...props} />,
  Calendar: (props) => <svg data-testid="calendar-icon" {...props} />,
  AlertCircle: (props) => <svg data-testid="alertcircle-icon" {...props} />,
  Edit2: (props) => <svg data-testid="edit-icon" {...props} />,
  Trash2: (props) => <svg data-testid="trash-icon" {...props} />,
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

import AdminReports from '../../../src/pages/admin/Reports';

const mockCoverageData = [
  {
    id: 1,
    territory_number: '5',
    locality: 'Centro',
    times_worked: 10,
    times_complete: 7,
    times_partial: 2,
    times_not_done: 1,
    last_worked_date: '2024-06-15',
  },
  {
    id: 2,
    territory_number: '10',
    locality: 'Norte',
    times_worked: 5,
    times_complete: 3,
    times_partial: 2,
    times_not_done: 0,
    last_worked_date: null,
  },
];

const mockMostWorkedData = [
  { id: 1, territory_number: '5', locality: 'Centro', times_worked: 15 },
  { id: 2, territory_number: '3', locality: 'Sul', times_worked: 12 },
];

const mockLeastWorkedData = [
  { id: 3, territory_number: '20', locality: 'Oeste', times_worked: 0 },
  { id: 4, territory_number: '15', locality: 'Leste', times_worked: 1 },
];

const mockPartialFrequencyData = [
  {
    id: 1,
    territory_number: '8',
    locality: 'Centro',
    partial_count: 5,
    total_times: 10,
    partial_percentage: 50,
  },
];

const mockPeriodData = [
  {
    period: '2024-06',
    total_work: 20,
    complete: 15,
    partial: 3,
    not_done: 2,
  },
  {
    period: '2024-05',
    total_work: 18,
    complete: 12,
    partial: 4,
    not_done: 2,
  },
];

// Use current year dates so they pass the date filter
const currentYear = new Date().getFullYear();
const mockAssignmentsData = [
  {
    id: 1,
    territory_id: 1,
    territory_number: '5',
    dirigente_id: 1,
    dirigente_name: 'João Silva',
    assigned_date: `${currentYear}-01-15`,
    validated_at: `${currentYear}-02-20`,
    validation_result: 'complete',
    conclusion_date: `${currentYear}-02-20`,
  },
  {
    id: 2,
    territory_id: 1,
    territory_number: '5',
    dirigente_id: 2,
    dirigente_name: 'Maria Santos',
    assigned_date: `${currentYear}-03-01`,
    validated_at: `${currentYear}-04-10`,
    validation_result: 'partial',
  },
];

const mockDirigentesData = [
  { id: 1, name: 'João Silva', role: 'dirigente' },
  { id: 2, name: 'Maria Santos', role: 'dirigente' },
  { id: 3, name: 'Admin User', role: 'admin' },
];

const renderComponent = () => {
  return render(<AdminReports />);
};

describe('AdminReports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    mockApi.get.mockImplementation((url) => {
      if (url === '/reports/coverage') {
        return Promise.resolve({ data: mockCoverageData });
      }
      if (url === '/reports/territory-frequency') {
        return Promise.resolve({ data: mockMostWorkedData });
      }
      if (url === '/reports/partial-frequency') {
        return Promise.resolve({ data: mockPartialFrequencyData });
      }
      if (url === '/reports/work-by-period') {
        return Promise.resolve({ data: mockPeriodData });
      }
      if (url === '/reports/territory-history-s13') {
        return Promise.resolve({ data: mockAssignmentsData });
      }
      if (url === '/users') {
        return Promise.resolve({ data: mockDirigentesData });
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
    it('should fetch all report data on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledWith('/reports/coverage', expect.any(Object));
        expect(mockApi.get).toHaveBeenCalledWith('/reports/territory-frequency', expect.any(Object));
        expect(mockApi.get).toHaveBeenCalledWith('/reports/partial-frequency', expect.any(Object));
        expect(mockApi.get).toHaveBeenCalledWith('/reports/work-by-period', expect.any(Object));
        expect(mockApi.get).toHaveBeenCalledWith('/reports/territory-history-s13');
      });
    });

    it('should show error toast on fetch failure', async () => {
      mockApi.get.mockRejectedValue(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Erro ao carregar relatórios');
      });
    });
  });

  describe('header', () => {
    it('should render page title', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Relatórios')).toBeInTheDocument();
      });
    });

    it('should render description', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Análise de territórios e desempenho')).toBeInTheDocument();
      });
    });
  });

  describe('tabs', () => {
    it('should render all tabs', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Cobertura/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Frequência/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Parciais/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Por Período/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Formulário S-13/ })).toBeInTheDocument();
      });
    });

    it('should default to coverage tab', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Cobertura de Territórios')).toBeInTheDocument();
      });
    });

    it('should switch to frequency tab when clicked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Frequência/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Frequência/ }));

      expect(screen.getByText('Mais Trabalhados')).toBeInTheDocument();
      expect(screen.getByText('Menos Trabalhados')).toBeInTheDocument();
    });

    it('should switch to partial tab when clicked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Parciais/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Parciais/ }));

      expect(screen.getByText('Territórios com Trabalhos Parciais Frequentes')).toBeInTheDocument();
    });

    it('should switch to period tab when clicked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Por Período/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Por Período/ }));

      expect(screen.getByText('Trabalhos por Período')).toBeInTheDocument();
    });

    it('should switch to S-13 tab when clicked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Formulário S-13/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Formulário S-13/ }));

      expect(screen.getByText('Registro de Designação de Território')).toBeInTheDocument();
    });
  });

  describe('coverage tab', () => {
    it('should render coverage table headers', async () => {
      renderComponent();

      await waitFor(() => {
        const table = document.querySelector('table');
        expect(table).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: /Território/i })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: /Localidade/i })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: /Trabalhado/i })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: /Completos/i })).toBeInTheDocument();
      });
    });

    it('should render coverage data', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
        expect(screen.getByText('Centro')).toBeInTheDocument();
      });
    });

    it('should show "Nunca" for territories never worked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Nunca')).toBeInTheDocument();
      });
    });

    it('should display date filter for coverage tab', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Exibindo dados a partir de/)).toBeInTheDocument();
      });
    });
  });

  describe('frequency tab', () => {
    it('should render most worked territories', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Frequência/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Frequência/ }));

      await waitFor(() => {
        expect(screen.getByText('Mais Trabalhados')).toBeInTheDocument();
      });
      // Check that territory work count is displayed
      expect(screen.getAllByText(/15x/).length).toBeGreaterThan(0);
    });

    it('should render least worked territories', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Frequência/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Frequência/ }));

      await waitFor(() => {
        expect(screen.getByText('Menos Trabalhados')).toBeInTheDocument();
      });
    });

    it('should show "Sem dados" when no frequency data', async () => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/reports/coverage') {
          return Promise.resolve({ data: mockCoverageData });
        }
        if (url === '/reports/territory-frequency') {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Frequência/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Frequência/ }));

      await waitFor(() => {
        const emptyMessages = screen.getAllByText('Sem dados');
        expect(emptyMessages.length).toBeGreaterThan(0);
      });
    });
  });

  describe('partial tab', () => {
    it('should render partial frequency data', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Parciais/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Parciais/ }));

      await waitFor(() => {
        expect(screen.getByText(/Território: 8 - Centro/)).toBeInTheDocument();
      });
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('should show empty message when no partial data', async () => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/reports/partial-frequency') {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: mockCoverageData });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Parciais/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Parciais/ }));

      await waitFor(() => {
        expect(screen.getByText('Nenhum território com trabalhos parciais registrados')).toBeInTheDocument();
      });
    });
  });

  describe('period tab', () => {
    it('should render period date filters', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Por Período/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Por Período/ }));

      await waitFor(() => {
        // Should have Data Inicial and Data Final labels
        const labels = screen.getAllByText('Data Inicial');
        expect(labels.length).toBeGreaterThan(0);
        expect(screen.getByText('Data Final')).toBeInTheDocument();
      });
    });

    it('should render period data', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Por Período/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Por Período/ }));

      await waitFor(() => {
        expect(screen.getByText('2024-06')).toBeInTheDocument();
      });
      expect(screen.getByText('20 trabalhos')).toBeInTheDocument();
    });

    it('should show complete/partial/not_done breakdown', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Por Período/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Por Período/ }));

      await waitFor(() => {
        expect(screen.getByText('✓ 15 completos')).toBeInTheDocument();
      });
      expect(screen.getByText('◐ 3 parciais')).toBeInTheDocument();
      // Multiple periods may have the same "não feitos" count
      expect(screen.getAllByText('✗ 2 não feitos').length).toBeGreaterThan(0);
    });

    it('should show empty message when no period data', async () => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/reports/work-by-period') {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: mockCoverageData });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Por Período/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Por Período/ }));

      await waitFor(() => {
        expect(screen.getByText('Nenhum dado para o período selecionado')).toBeInTheDocument();
      });
    });
  });

  describe('S-13 tab', () => {
    it('should render S-13 form title', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Formulário S-13/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Formulário S-13/ }));

      await waitFor(() => {
        expect(screen.getByText('Registro de Designação de Território')).toBeInTheDocument();
      });
    });

    it('should render "Gerar PDF" button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Formulário S-13/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Formulário S-13/ }));

      await waitFor(() => {
        expect(screen.getByText('Gerar PDF')).toBeInTheDocument();
      });
    });

    it('should render territory data in table', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Formulário S-13/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Formulário S-13/ }));

      await waitFor(() => {
        expect(screen.getByText('Território 5')).toBeInTheDocument();
      });
      expect(screen.getByText('João Silva')).toBeInTheDocument();
    });

    it('should render status badges', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Formulário S-13/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Formulário S-13/ }));

      await waitFor(() => {
        expect(screen.getByText('completo')).toBeInTheDocument();
      });
      expect(screen.getByText('parcial')).toBeInTheDocument();
    });

    it('should show empty message when no S-13 data', async () => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/reports/territory-history-s13') {
          return Promise.resolve({ data: [] });
        }
        if (url === '/reports/coverage') {
          return Promise.resolve({ data: mockCoverageData });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Formulário S-13/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Formulário S-13/ }));

      await waitFor(() => {
        expect(screen.getByText('Nenhum dado para exibir')).toBeInTheDocument();
      });
    });
  });

  describe('S-13 edit functionality', () => {
    it('should open edit modal when clicking edit button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Formulário S-13/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Formulário S-13/ }));

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTestId('edit-icon');
      fireEvent.click(editButtons[0].closest('button'));

      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByText('Editar Registro')).toBeInTheDocument();
    });

    it('should close edit modal when clicking cancel', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Formulário S-13/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Formulário S-13/ }));

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTestId('edit-icon');
      fireEvent.click(editButtons[0].closest('button'));

      expect(screen.getByTestId('modal')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Cancelar'));

      await waitFor(() => {
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
      });
    });

    it('should submit edit form', async () => {
      mockApi.put.mockResolvedValue({ data: {} });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Formulário S-13/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Formulário S-13/ }));

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTestId('edit-icon');
      fireEvent.click(editButtons[0].closest('button'));

      fireEvent.click(screen.getByText('Salvar alterações'));

      await waitFor(() => {
        expect(mockApi.put).toHaveBeenCalled();
      });
    });
  });

  describe('S-13 delete functionality', () => {
    it('should call delete API when clicking delete', async () => {
      mockApi.delete.mockResolvedValue({ data: {} });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Formulário S-13/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Formulário S-13/ }));

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTestId('trash-icon');
      fireEvent.click(deleteButtons[0].closest('button'));

      await waitFor(() => {
        expect(mockApi.delete).toHaveBeenCalledWith('/reports/territory-history-s13/1');
      });
    });

    it('should show success toast after delete', async () => {
      mockApi.delete.mockResolvedValue({ data: {} });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Formulário S-13/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Formulário S-13/ }));

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTestId('trash-icon');
      fireEvent.click(deleteButtons[0].closest('button'));

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Registro excluído');
      });
    });
  });

  describe('S-13 create functionality', () => {
    it('should open create modal when clicking create button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Formulário S-13/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Formulário S-13/ }));

      await waitFor(() => {
        expect(screen.getByText('Território 5')).toBeInTheDocument();
      });

      // Find the create button (FileText icon in the territory row header)
      const createButton = screen.getByTitle('Lançar manualmente');
      
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Lançamento Manual')).toBeInTheDocument();
      });
    });
  });

  describe('date filter refetch', () => {
    it('should refetch data when coverage date filter changes', async () => {
      renderComponent();

      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalled();
      });

      const initialCallCount = mockApi.get.mock.calls.length;

      const dateInputs = document.querySelectorAll('input[type="date"]');
      if (dateInputs.length > 0) {
        fireEvent.change(dateInputs[0], { target: { value: '2024-01-01' } });

        await waitFor(() => {
          expect(mockApi.get.mock.calls.length).toBeGreaterThan(initialCallCount);
        });
      }
    });
  });

  describe('edge cases', () => {
    it('should handle null assignments data', async () => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/reports/territory-history-s13') {
          return Promise.resolve({ data: null });
        }
        return Promise.resolve({ data: mockCoverageData });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Formulário S-13/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Formulário S-13/ }));

      await waitFor(() => {
        expect(screen.getByText('Nenhum dado para exibir')).toBeInTheDocument();
      });
    });

    it('should handle empty coverage data', async () => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/reports/coverage') {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Cobertura de Territórios')).toBeInTheDocument();
      });

      // Table should be empty but not crash
      expect(document.querySelector('table')).toBeInTheDocument();
    });
  });

  describe('S-13 form error handling', () => {
    it('should show error toast when edit fails', async () => {
      mockApi.put.mockRejectedValue({
        response: { data: { error: 'Erro customizado' } },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Formulário S-13/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Formulário S-13/ }));

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTestId('edit-icon');
      fireEvent.click(editButtons[0].closest('button'));

      fireEvent.click(screen.getByText('Salvar alterações'));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Erro customizado');
      });
    });

    it('should show default error message when edit fails without response', async () => {
      mockApi.put.mockRejectedValue(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Formulário S-13/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Formulário S-13/ }));

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTestId('edit-icon');
      fireEvent.click(editButtons[0].closest('button'));

      fireEvent.click(screen.getByText('Salvar alterações'));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Erro ao salvar alterações');
      });
    });

    it('should show error toast when delete fails', async () => {
      mockApi.delete.mockRejectedValue({
        response: { data: { error: 'Erro ao excluir' } },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Formulário S-13/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Formulário S-13/ }));

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTestId('trash-icon');
      fireEvent.click(deleteButtons[0].closest('button'));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Erro ao excluir');
      });
    });

    it('should not delete when confirm is cancelled', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Formulário S-13/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Formulário S-13/ }));

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTestId('trash-icon');
      fireEvent.click(deleteButtons[0].closest('button'));

      expect(mockApi.delete).not.toHaveBeenCalled();
    });

    it('should show error toast when loading dirigentes fails', async () => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/users') {
          return Promise.reject(new Error('Failed to load'));
        }
        if (url === '/reports/coverage') {
          return Promise.resolve({ data: mockCoverageData });
        }
        if (url === '/reports/territory-history-s13') {
          return Promise.resolve({ data: mockAssignmentsData });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Formulário S-13/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Formulário S-13/ }));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Erro ao carregar dirigentes');
      });
    });
  });

  describe('S-13 PDF generation', () => {
    it('should generate PDF when button is clicked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Formulário S-13/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Formulário S-13/ }));

      await waitFor(() => {
        expect(screen.getByText('Gerar PDF')).toBeInTheDocument();
      });

      // Click should not throw an error - the PDF generation uses the mocked jsPDF
      fireEvent.click(screen.getByText('Gerar PDF'));

      // The component should still be rendered (no crash)
      expect(screen.getByText('Registro de Designação de Território')).toBeInTheDocument();
    });
  });

  describe('S-13 form interactions', () => {
    it('should change status in edit form', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Formulário S-13/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Formulário S-13/ }));

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTestId('edit-icon');
      fireEvent.click(editButtons[0].closest('button'));

      const statusSelect = screen.getAllByRole('combobox').find(
        (select) => select.querySelector('option[value="partial"]')
      );

      if (statusSelect) {
        fireEvent.change(statusSelect, { target: { value: 'partial' } });
        expect(statusSelect.value).toBe('partial');
      }
    });

    it('should close create modal on cancel', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Formulário S-13/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Formulário S-13/ }));

      await waitFor(() => {
        expect(screen.getByText('Território 5')).toBeInTheDocument();
      });

      const createButton = screen.getByTitle('Lançar manualmente');
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Lançamento Manual')).toBeInTheDocument();
      });

      // Find cancel button in the create modal
      const cancelButtons = screen.getAllByText('Cancelar');
      fireEvent.click(cancelButtons[cancelButtons.length - 1]);

      await waitFor(() => {
        expect(screen.queryByText('Lançamento Manual')).not.toBeInTheDocument();
      });
    });

    it('should submit create form successfully', async () => {
      mockApi.post.mockResolvedValue({ data: {} });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Formulário S-13/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Formulário S-13/ }));

      await waitFor(() => {
        expect(screen.getByText('Território 5')).toBeInTheDocument();
      });

      const createButton = screen.getByTitle('Lançar manualmente');
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Lançamento Manual')).toBeInTheDocument();
      });

      // Fill in the form - find all date inputs and use the ones in the modal
      const allDateInputs = document.querySelectorAll('input[type="date"]');
      // The create modal's date input should be the last one(s)
      if (allDateInputs.length >= 2) {
        fireEvent.change(allDateInputs[allDateInputs.length - 2], { 
          target: { value: `${currentYear}-06-01` } 
        });
      }

      fireEvent.click(screen.getByText('Salvar lançamento'));

      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalled();
      });
    });
  });

  describe('coverage data display', () => {
    it('should sort territories by number', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Cobertura de Territórios')).toBeInTheDocument();
      });

      const rows = document.querySelectorAll('tbody tr');
      expect(rows.length).toBeGreaterThan(0);

      // Territory 5 should appear before territory 10
      const firstRow = rows[0].textContent;
      expect(firstRow).toContain('Território: 5');
    });

    it('should display times worked correctly', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('10')).toBeInTheDocument(); // times_worked for territory 5
      });
    });

    it('should display complete/partial/not_done counts', async () => {
      renderComponent();

      await waitFor(() => {
        // times_complete for territory 5
        expect(screen.getByText('7')).toBeInTheDocument();
      });
    });

    it('should format last worked date correctly', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('15/06/2024')).toBeInTheDocument();
      });
    });
  });

  describe('frequency tab data display', () => {
    it('should display ranking badges', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Frequência/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Frequência/ }));

      await waitFor(() => {
        expect(screen.getByText('Mais Trabalhados')).toBeInTheDocument();
      });
      
      // Ranking numbers will appear multiple times (in both most and least worked sections)
      const rankingBadges = screen.getAllByText('1');
      expect(rankingBadges.length).toBeGreaterThan(0);
    });

    it('should display territory number and locality', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Frequência/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Frequência/ }));

      await waitFor(() => {
        expect(screen.getAllByText(/Território: 5/).length).toBeGreaterThan(0);
      });
    });
  });

  describe('S-13 status rendering', () => {
    it('should render not_done status', async () => {
      const assignmentWithNotDone = [
        ...mockAssignmentsData,
        {
          id: 3,
          territory_id: 1,
          territory_number: '5',
          dirigente_id: 1,
          dirigente_name: 'Pedro Costa',
          assigned_date: `${currentYear}-05-01`,
          validated_at: `${currentYear}-05-15`,
          validation_result: 'not_done',
        },
      ];

      mockApi.get.mockImplementation((url) => {
        if (url === '/reports/territory-history-s13') {
          return Promise.resolve({ data: assignmentWithNotDone });
        }
        if (url === '/reports/coverage') {
          return Promise.resolve({ data: mockCoverageData });
        }
        if (url === '/users') {
          return Promise.resolve({ data: mockDirigentesData });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Formulário S-13/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Formulário S-13/ }));

      await waitFor(() => {
        expect(screen.getByText('não feito')).toBeInTheDocument();
      });
    });

    it('should render returned status', async () => {
      const assignmentWithReturned = [
        {
          id: 1,
          territory_id: 1,
          territory_number: '5',
          dirigente_id: 1,
          dirigente_name: 'João Silva',
          assigned_date: `${currentYear}-01-15`,
          status: 'returned',
        },
      ];

      mockApi.get.mockImplementation((url) => {
        if (url === '/reports/territory-history-s13') {
          return Promise.resolve({ data: assignmentWithReturned });
        }
        if (url === '/reports/coverage') {
          return Promise.resolve({ data: mockCoverageData });
        }
        if (url === '/users') {
          return Promise.resolve({ data: mockDirigentesData });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Formulário S-13/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Formulário S-13/ }));

      await waitFor(() => {
        expect(screen.getByText('devolvido')).toBeInTheDocument();
      });
    });

    it('should render designated status for no validation result', async () => {
      const assignmentDesignated = [
        {
          id: 1,
          territory_id: 1,
          territory_number: '5',
          dirigente_id: 1,
          dirigente_name: 'João Silva',
          assigned_date: `${currentYear}-01-15`,
          status: 'active',
        },
      ];

      mockApi.get.mockImplementation((url) => {
        if (url === '/reports/territory-history-s13') {
          return Promise.resolve({ data: assignmentDesignated });
        }
        if (url === '/reports/coverage') {
          return Promise.resolve({ data: mockCoverageData });
        }
        if (url === '/users') {
          return Promise.resolve({ data: mockDirigentesData });
        }
        return Promise.resolve({ data: [] });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Formulário S-13/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Formulário S-13/ }));

      await waitFor(() => {
        expect(screen.getByText('designado')).toBeInTheDocument();
      });
    });
  });

  describe('S-13 date filter', () => {
    it('should filter data by date', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Formulário S-13/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Formulário S-13/ }));

      await waitFor(() => {
        expect(screen.getByText('Território 5')).toBeInTheDocument();
      });

      // The date filter input should be present
      const dateInputs = document.querySelectorAll('input[type="date"]');
      expect(dateInputs.length).toBeGreaterThan(0);
    });
  });

  describe('accessibility', () => {
    it('should have proper table structure', async () => {
      renderComponent();

      await waitFor(() => {
        const table = document.querySelector('table');
        expect(table).toBeInTheDocument();
        expect(document.querySelector('thead')).toBeInTheDocument();
        expect(document.querySelector('tbody')).toBeInTheDocument();
      });
    });

    it('should have interactive tab buttons', async () => {
      renderComponent();

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(4); // At least 5 tab buttons
      });
    });
  });
});
