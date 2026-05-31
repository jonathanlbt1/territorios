import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Create mocks with vi.hoisted
const { mockApi, mockToast } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
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

vi.mock('../../../src/utils/mapUrl', () => ({
  getMapUrl: (filename) => `/api/maps/${filename}`,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  MapPin: (props) => <svg data-testid="mappin-icon" {...props} />,
  Search: (props) => <svg data-testid="search-icon" {...props} />,
  Eye: (props) => <svg data-testid="eye-icon" {...props} />,
  Edit2: (props) => <svg data-testid="edit-icon" {...props} />,
  Calendar: (props) => <svg data-testid="calendar-icon" {...props} />,
  Grid: (props) => <svg data-testid="grid-icon" {...props} />,
  Plus: (props) => <svg data-testid="plus-icon" {...props} />,
  Trash2: (props) => <svg data-testid="trash-icon" {...props} />,
  Upload: (props) => <svg data-testid="upload-icon" {...props} />,
  Image: (props) => <svg data-testid="image-icon" {...props} />,
  FileImage: (props) => <svg data-testid="fileimage-icon" {...props} />,
  AlertTriangle: (props) => <svg data-testid="alert-icon" {...props} />,
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

// Mock MapViewer component
vi.mock('../../../src/components/MapViewer', () => ({
  default: ({ src, alt }) => (
    <div data-testid="map-viewer" data-src={src}>{alt}</div>
  ),
}));

// Mock EmptyState component
vi.mock('../../../src/components/EmptyState', () => ({
  default: ({ icon, title, description }) => (
    <div data-testid="empty-state">
      <span>{title}</span>
      <span>{description}</span>
    </div>
  ),
}));

import AdminTerritories from '../../../src/pages/admin/Territories';

const mockTerritories = [
  {
    id: 1,
    territory_number: '5',
    territory_code: 'T-005',
    locality: 'Centro',
    block_count: 4,
    map_filename: 'ter_5.png',
    observations: 'Território central',
    last_worked_date: '2024-06-15',
    is_assigned: false,
  },
  {
    id: 2,
    territory_number: '10',
    territory_code: 'T-010',
    locality: 'Norte',
    block_count: 6,
    map_filename: 'ter_10.png',
    observations: null,
    last_worked_date: null,
    is_assigned: true,
  },
  {
    id: 3,
    territory_number: '15',
    territory_code: 'T-015',
    locality: 'Sul',
    block_count: 3,
    map_filename: 'ter_15.png',
    observations: 'Área residencial',
    last_worked_date: '2024-01-20',
    is_assigned: false,
  },
];

const mockPngFiles = [
  'ter_5.png',
  'ter_10.png',
  'ter_15.png',
  'ter_20.png',
  'ter_25.png',
];

const renderComponent = () => {
  return render(<AdminTerritories />);
};

describe('AdminTerritories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    mockApi.get.mockImplementation((url) => {
      if (url === '/territories') {
        return Promise.resolve({ data: mockTerritories });
      }
      if (url === '/territories/png-files') {
        return Promise.resolve({ data: mockPngFiles });
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
    it('should fetch territories on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledWith('/territories');
      });
    });

    it('should fetch PNG files on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledWith('/territories/png-files');
      });
    });

    it('should show error toast on territories fetch failure', async () => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/territories') {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ data: mockPngFiles });
      });

      renderComponent();

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Erro ao carregar territórios');
      });
    });

    it('should handle PNG files fetch failure gracefully', async () => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/territories/png-files') {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ data: mockTerritories });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Territórios')).toBeInTheDocument();
      });

      // Should log error but not crash
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('header', () => {
    it('should render page title', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Territórios')).toBeInTheDocument();
      });
    });

    it('should show territory count', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('3 territórios cadastrados')).toBeInTheDocument();
      });
    });

    it('should render "Novo Território" button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Novo Território')).toBeInTheDocument();
      });
    });
  });

  describe('search functionality', () => {
    it('should render search input', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Buscar por número, código ou localidade...')).toBeInTheDocument();
      });
    });

    it('should filter territories by number', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Buscar por número, código ou localidade...');
      fireEvent.change(searchInput, { target: { value: '10' } });

      expect(screen.queryByText('Território: 5')).not.toBeInTheDocument();
      expect(screen.getByText('Território: 10')).toBeInTheDocument();
    });

    it('should filter territories by locality', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Centro')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Buscar por número, código ou localidade...');
      fireEvent.change(searchInput, { target: { value: 'norte' } });

      expect(screen.queryByText('Centro')).not.toBeInTheDocument();
      expect(screen.getByText('Norte')).toBeInTheDocument();
    });

    it('should filter territories by code', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Buscar por número, código ou localidade...');
      fireEvent.change(searchInput, { target: { value: 'T-015' } });

      expect(screen.queryByText('Território: 5')).not.toBeInTheDocument();
      expect(screen.getByText('Território: 15')).toBeInTheDocument();
    });

    it('should show empty state when no results', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Buscar por número, código ou localidade...');
      fireEvent.change(searchInput, { target: { value: 'xyz' } });

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('Nenhum território encontrado')).toBeInTheDocument();
    });
  });

  describe('territories grid', () => {
    it('should render all territories', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
        expect(screen.getByText('Território: 10')).toBeInTheDocument();
        expect(screen.getByText('Território: 15')).toBeInTheDocument();
      });
    });

    it('should display territory locality', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Centro')).toBeInTheDocument();
        expect(screen.getByText('Norte')).toBeInTheDocument();
        expect(screen.getByText('Sul')).toBeInTheDocument();
      });
    });

    it('should display block count', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('4 quadras')).toBeInTheDocument();
        expect(screen.getByText('6 quadras')).toBeInTheDocument();
        expect(screen.getByText('3 quadras')).toBeInTheDocument();
      });
    });

    it('should show "Designado" badge for assigned territories', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Designado')).toBeInTheDocument();
      });
    });

    it('should show "Nunca trabalhado" for territories without last_worked_date', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Nunca trabalhado')).toBeInTheDocument();
      });
    });

    it('should display observations when present', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Território central')).toBeInTheDocument();
        expect(screen.getByText('Área residencial')).toBeInTheDocument();
      });
    });

    it('should render action buttons for each territory', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText('Ver').length).toBe(3);
        expect(screen.getAllByText('Editar').length).toBe(3);
      });
    });

    it('should disable delete button for assigned territories', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Território: 10')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTestId('trash-icon');
      const assignedTerritoryDeleteBtn = deleteButtons[1].closest('button');
      expect(assignedTerritoryDeleteBtn).toBeDisabled();
    });
  });

  describe('view modal', () => {
    it('should open view modal when clicking "Ver" button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText('Ver').length).toBe(3);
      });

      fireEvent.click(screen.getAllByText('Ver')[0]);

      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByText('Território 5')).toBeInTheDocument();
    });

    it('should display MapViewer in view modal', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getAllByText('Ver')[0]);
      });

      expect(screen.getByTestId('map-viewer')).toBeInTheDocument();
    });

    it('should display territory details in view modal', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getAllByText('Ver')[0]);
      });

      expect(screen.getByText('Localidade')).toBeInTheDocument();
      expect(screen.getByText('Quadras')).toBeInTheDocument();
      expect(screen.getByText('Último Trabalho')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    it('should close view modal', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getAllByText('Ver')[0]);
      });

      expect(screen.getByTestId('modal')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('modal-close'));

      await waitFor(() => {
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
      });
    });
  });

  describe('create modal', () => {
    it('should open create modal when clicking "Novo Território" button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Novo Território/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Novo Território/ }));

      expect(screen.getByTestId('modal')).toBeInTheDocument();
      // Modal title appears as h2
      expect(screen.getAllByText('Novo Território').length).toBeGreaterThan(1);
    });

    it('should render all create form fields', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo Território'));
      });

      expect(screen.getByText('Número do Território *')).toBeInTheDocument();
      expect(screen.getByText('Quantidade de Quadras *')).toBeInTheDocument();
      expect(screen.getByText('Localidade *')).toBeInTheDocument();
      expect(screen.getByText('Mapa do Território *')).toBeInTheDocument();
      expect(screen.getByText('Observações')).toBeInTheDocument();
    });

    it('should show available PNG files in select', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo Território'));
      });

      // Should show files not in use
      const select = screen.getAllByRole('combobox')[0];
      expect(select).toBeInTheDocument();
    });

    it('should show error when submitting without required fields', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Novo Território/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Novo Território/ }));

      // Submit form directly to bypass HTML5 validation
      const form = screen.getByTestId('modal').querySelector('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Preencha todos os campos obrigatórios');
      });
    });

    it('should show error when submitting without map', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo Território'));
      });

      // Fill required fields
      const numberInput = screen.getByPlaceholderText('Ex: 42');
      fireEvent.change(numberInput, { target: { value: '42' } });

      const localityInput = screen.getByPlaceholderText('Ex: Centro, Vila Nova, etc.');
      fireEvent.change(localityInput, { target: { value: 'Nova Localidade' } });

      fireEvent.click(screen.getByText('Criar Território'));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Selecione um arquivo de mapa existente ou faça upload de um novo');
      });
    });

    it('should create territory successfully with existing file', async () => {
      mockApi.post.mockResolvedValue({ data: {} });

      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo Território'));
      });

      // Fill required fields
      const numberInput = screen.getByPlaceholderText('Ex: 42');
      fireEvent.change(numberInput, { target: { value: '42' } });

      const localityInput = screen.getByPlaceholderText('Ex: Centro, Vila Nova, etc.');
      fireEvent.change(localityInput, { target: { value: 'Nova Localidade' } });

      // Select existing file
      const select = screen.getAllByRole('combobox')[0];
      fireEvent.change(select, { target: { value: 'ter_20.png' } });

      fireEvent.click(screen.getByText('Criar Território'));

      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalled();
        expect(mockToast.success).toHaveBeenCalledWith('Território criado com sucesso!');
      });
    });

    it('should close create modal on cancel', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo Território'));
      });

      expect(screen.getByTestId('modal')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Cancelar'));

      await waitFor(() => {
        expect(screen.queryByText('Número do Território *')).not.toBeInTheDocument();
      });
    });
  });

  describe('edit modal', () => {
    it('should open edit modal when clicking "Editar" button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText('Editar').length).toBe(3);
      });

      fireEvent.click(screen.getAllByText('Editar')[0]);

      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByText('Editar Território 5')).toBeInTheDocument();
    });

    it('should populate form with territory data', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getAllByText('Editar')[0]);
      });

      const localityInput = screen.getByDisplayValue('Centro');
      expect(localityInput).toBeInTheDocument();

      const blockCountInput = screen.getByDisplayValue('4');
      expect(blockCountInput).toBeInTheDocument();
    });

    it('should update territory successfully', async () => {
      mockApi.put.mockResolvedValue({ data: {} });

      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getAllByText('Editar')[0]);
      });

      const localityInput = screen.getByDisplayValue('Centro');
      fireEvent.change(localityInput, { target: { value: 'Centro Atualizado' } });

      fireEvent.click(screen.getByText('Salvar'));

      await waitFor(() => {
        expect(mockApi.put).toHaveBeenCalledWith(
          '/territories/1',
          expect.any(FormData),
          expect.any(Object)
        );
        expect(mockToast.success).toHaveBeenCalledWith('Território atualizado com sucesso!');
      });
    });

    it('should show error toast on update failure', async () => {
      mockApi.put.mockRejectedValue(new Error('Update failed'));

      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getAllByText('Editar')[0]);
      });

      fireEvent.click(screen.getByText('Salvar'));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Erro ao atualizar território');
      });
    });

    it('should close edit modal on cancel', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getAllByText('Editar')[0]);
      });

      expect(screen.getByTestId('modal')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Cancelar'));

      await waitFor(() => {
        expect(screen.queryByText('Editar Território 5')).not.toBeInTheDocument();
      });
    });
  });

  describe('delete modal', () => {
    it('should open delete modal when clicking delete button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Território: 5')).toBeInTheDocument();
      });

      // Click delete button for first territory (not assigned)
      const deleteButtons = screen.getAllByTestId('trash-icon');
      fireEvent.click(deleteButtons[0].closest('button'));

      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByText('Excluir Território')).toBeInTheDocument();
    });

    it('should show warning message in delete modal', async () => {
      renderComponent();

      await waitFor(() => {
        const deleteButtons = screen.getAllByTestId('trash-icon');
        fireEvent.click(deleteButtons[0].closest('button'));
      });

      expect(screen.getByText('Tem certeza que deseja excluir?')).toBeInTheDocument();
    });

    it('should delete territory successfully', async () => {
      mockApi.delete.mockResolvedValue({ data: {} });

      renderComponent();

      await waitFor(() => {
        const deleteButtons = screen.getAllByTestId('trash-icon');
        fireEvent.click(deleteButtons[0].closest('button'));
      });

      fireEvent.click(screen.getByText('Excluir'));

      await waitFor(() => {
        expect(mockApi.delete).toHaveBeenCalledWith('/territories/1');
        expect(mockToast.success).toHaveBeenCalledWith('Território excluído com sucesso!');
      });
    });

    it('should show error toast on delete failure', async () => {
      mockApi.delete.mockRejectedValue({
        response: { data: { error: 'Cannot delete' } },
      });

      renderComponent();

      await waitFor(() => {
        const deleteButtons = screen.getAllByTestId('trash-icon');
        fireEvent.click(deleteButtons[0].closest('button'));
      });

      fireEvent.click(screen.getByText('Excluir'));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Cannot delete');
      });
    });

    it('should close delete modal on cancel', async () => {
      renderComponent();

      await waitFor(() => {
        const deleteButtons = screen.getAllByTestId('trash-icon');
        fireEvent.click(deleteButtons[0].closest('button'));
      });

      expect(screen.getByTestId('modal')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Cancelar'));

      await waitFor(() => {
        expect(screen.queryByText('Excluir Território')).not.toBeInTheDocument();
      });
    });
  });

  describe('file upload', () => {
    it('should handle file selection in create modal', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo Território'));
      });

      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const fileInput = document.querySelector('input[type="file"]');
      
      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(screen.getByText('test.png')).toBeInTheDocument();
    });

    it('should show remove file button after selection', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo Território'));
      });

      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const fileInput = document.querySelector('input[type="file"]');
      
      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(screen.getByText('Remover arquivo')).toBeInTheDocument();
    });

    it('should remove file when clicking remove button', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo Território'));
      });

      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const fileInput = document.querySelector('input[type="file"]');
      
      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(screen.getByText('test.png')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Remover arquivo'));

      expect(screen.queryByText('test.png')).not.toBeInTheDocument();
    });

    it('should create territory with uploaded file', async () => {
      mockApi.post.mockResolvedValue({ data: {} });

      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo Território'));
      });

      // Fill required fields
      const numberInput = screen.getByPlaceholderText('Ex: 42');
      fireEvent.change(numberInput, { target: { value: '42' } });

      const localityInput = screen.getByPlaceholderText('Ex: Centro, Vila Nova, etc.');
      fireEvent.change(localityInput, { target: { value: 'Nova Localidade' } });

      // Upload file
      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const fileInput = document.querySelector('input[type="file"]');
      fireEvent.change(fileInput, { target: { files: [file] } });

      fireEvent.click(screen.getByText('Criar Território'));

      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalled();
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty territories list', async () => {
      mockApi.get.mockImplementation((url) => {
        if (url === '/territories') {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: mockPngFiles });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('0 territórios cadastrados')).toBeInTheDocument();
      });
    });

    it('should handle territory without observations', async () => {
      renderComponent();

      await waitFor(() => {
        // Territory 10 has no observations
        expect(screen.getByText('Território: 10')).toBeInTheDocument();
      });

      // Should not crash - "Observações:" appears for territories that have observations
      const observationsLabels = screen.getAllByText('Observações:');
      // Only 2 territories have observations (territory 5 and 15)
      expect(observationsLabels.length).toBe(2);
    });

    it('should handle create error with custom message', async () => {
      mockApi.post.mockRejectedValue({
        response: { data: { error: 'Número já existe' } },
      });

      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo Território'));
      });

      // Fill form
      const numberInput = screen.getByPlaceholderText('Ex: 42');
      fireEvent.change(numberInput, { target: { value: '5' } });

      const localityInput = screen.getByPlaceholderText('Ex: Centro, Vila Nova, etc.');
      fireEvent.change(localityInput, { target: { value: 'Teste' } });

      const select = screen.getAllByRole('combobox')[0];
      fireEvent.change(select, { target: { value: 'ter_20.png' } });

      fireEvent.click(screen.getByText('Criar Território'));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Número já existe');
      });
    });
  });

  describe('available PNG files filtering', () => {
    it('should only show unused PNG files in create modal', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo Território'));
      });

      const select = screen.getAllByRole('combobox')[0];
      const options = select.querySelectorAll('option');
      
      // Should have "-- Selecione um arquivo --" + unused files (ter_20.png, ter_25.png)
      // Files in use: ter_5.png, ter_10.png, ter_15.png
      expect(options.length).toBe(3); // empty option + 2 available files
    });

    it('should include current file in edit modal options', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getAllByText('Editar')[0]);
      });

      // The current territory's file should be available
      const select = screen.getAllByRole('combobox')[0];
      const options = Array.from(select.querySelectorAll('option'));
      const fileOptions = options.map(opt => opt.value).filter(Boolean);
      
      // ter_5.png is the current file for territory 5, should be available
      expect(fileOptions).toContain('ter_5.png');
    });
  });

  describe('accessibility', () => {
    it('should have accessible search input', async () => {
      renderComponent();

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Buscar por número, código ou localidade...');
        expect(searchInput).toHaveAttribute('type', 'text');
      });
    });

    it('should have accessible form labels', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo Território'));
      });

      expect(screen.getByText('Número do Território *')).toBeInTheDocument();
      expect(screen.getByText('Localidade *')).toBeInTheDocument();
    });
  });
});
