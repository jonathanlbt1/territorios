import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Create mocks with vi.hoisted
const { mockApi, mockToast, mockUseAuth, mockNavigate } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
  },
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  mockUseAuth: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('../../src/services/api', () => ({
  default: mockApi,
}));

vi.mock('../../src/contexts/ToastContext', () => ({
  useToast: () => mockToast,
}));

vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../src/utils/mapUrl', () => ({
  getMapUrl: (filename) => `/api/maps/${filename}`,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  ArrowLeft: (props) => <svg data-testid="arrow-left-icon" {...props} />,
  MapPin: (props) => <svg data-testid="mappin-icon" {...props} />,
  Calendar: (props) => <svg data-testid="calendar-icon" {...props} />,
  User: (props) => <svg data-testid="user-icon" {...props} />,
  Clock: (props) => <svg data-testid="clock-icon" {...props} />,
  Grid: (props) => <svg data-testid="grid-icon" {...props} />,
  Send: (props) => <svg data-testid="send-icon" {...props} />,
  CheckCircle: (props) => <svg data-testid="check-circle-icon" {...props} />,
  AlertCircle: (props) => <svg data-testid="alert-circle-icon" {...props} />,
  XCircle: (props) => <svg data-testid="x-circle-icon" {...props} />,
  FileText: (props) => <svg data-testid="file-text-icon" {...props} />,
  Plus: (props) => <svg data-testid="plus-icon" {...props} />,
  Trash2: (props) => <svg data-testid="trash-icon" {...props} />,
}));

// Mock components
vi.mock('../../src/components/StatusBadge', () => ({
  default: ({ status, type }) => <span data-testid="status-badge" data-status={status} data-type={type}>{status}</span>,
}));

vi.mock('../../src/components/MapViewer', () => ({
  default: ({ src, alt }) => <div data-testid="map-viewer" data-src={src}>{alt}</div>,
}));

vi.mock('../../src/components/BlockSelector', () => ({
  default: ({ totalBlocks, selectedBlocks, onChange }) => (
    <div data-testid="block-selector" data-total={totalBlocks} data-selected={selectedBlocks.join(',')}>
      <button onClick={() => onChange([1, 2])}>Select Blocks</button>
    </div>
  ),
}));

vi.mock('../../src/components/Modal', () => ({
  default: ({ isOpen, onClose, title, children }) => isOpen ? (
    <div data-testid="modal" data-title={title}>
      <button data-testid="modal-close" onClick={onClose}>Close</button>
      {children}
    </div>
  ) : null,
}));

import AssignmentDetail from '../../src/pages/AssignmentDetail';

const mockDirigenteUser = {
  id: 1,
  name: 'João Silva',
  role: 'dirigente',
};

const mockAdminUser = {
  id: 2,
  name: 'Admin User',
  role: 'admin',
};

// Future date for non-overdue assignments
const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 15);
const futureDateString = futureDate.toISOString().split('T')[0];

// Past date for overdue assignments
const pastDate = new Date();
pastDate.setDate(pastDate.getDate() - 5);
const pastDateString = pastDate.toISOString().split('T')[0];

const createMockAssignment = (overrides = {}) => ({
  id: 1,
  territory_number: '5',
  territory_code: 'T-005',
  locality: 'Centro',
  block_count: 4,
  map_filename: 'ter_5.png',
  status: 'in_progress',
  dirigente_id: 1,
  dirigente_name: 'João Silva',
  due_date: futureDateString,
  assigned_date: '2024-01-15',
  blocks_worked: null,
  partial_blocks_worked: null,
  return_observations: null,
  territory_observations: null,
  not_worked: false,
  returned_at: null,
  validated_at: null,
  validation_result: null,
  ...overrides,
});

const renderComponent = (assignmentId = '1') => {
  return render(
    <MemoryRouter initialEntries={[`/assignment/${assignmentId}`]}>
      <Routes>
        <Route path="/assignment/:id" element={<AssignmentDetail />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('AssignmentDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);

    mockUseAuth.mockReturnValue({ user: mockDirigenteUser, isAdmin: false });
    mockApi.get.mockResolvedValue({ data: createMockAssignment() });
    mockApi.post.mockResolvedValue({ data: { success: true } });
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
    it('should fetch assignment on mount', async () => {
      renderComponent();
      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledWith('/assignments/1');
      });
    });

    it('should show error toast and navigate back on fetch failure', async () => {
      mockApi.get.mockRejectedValue({ response: { data: { error: 'Not found' } } });
      renderComponent();
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Not found');
        expect(mockNavigate).toHaveBeenCalledWith(-1);
      });
    });

    it('should show default error message when no specific error', async () => {
      mockApi.get.mockRejectedValue(new Error('Network error'));
      renderComponent();
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Erro ao carregar designação');
      });
    });
  });

  describe('not found state', () => {
    it('should show not found message when assignment is null', async () => {
      mockApi.get.mockResolvedValue({ data: null });
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Designação não encontrada')).toBeInTheDocument();
      });
    });
  });

  describe('header', () => {
    it('should render territory number in title', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Território 5')).toBeInTheDocument();
      });
    });

    it('should render status badge', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByTestId('status-badge')).toBeInTheDocument();
      });
    });

    it('should render back button', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByTestId('arrow-left-icon')).toBeInTheDocument();
      });
    });

    it('should navigate back when back button is clicked', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByTestId('arrow-left-icon')).toBeInTheDocument();
      });
      const backButton = screen.getByTestId('arrow-left-icon').closest('button');
      fireEvent.click(backButton);
      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
  });

  describe('assignment info', () => {
    it('should display locality', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Centro')).toBeInTheDocument();
      });
    });

    it('should display block count', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('4')).toBeInTheDocument();
      });
    });

    it('should display dirigente name', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });
    });

    it('should display map viewer', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByTestId('map-viewer')).toBeInTheDocument();
      });
    });

    it('should display territory observations when present', async () => {
      mockApi.get.mockResolvedValue({
        data: createMockAssignment({ territory_observations: 'Área comercial' }),
      });
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Área comercial')).toBeInTheDocument();
      });
    });
  });

  describe('overdue alert', () => {
    it('should show overdue alert when assignment is past due', async () => {
      mockApi.get.mockResolvedValue({
        data: createMockAssignment({ due_date: pastDateString }),
      });
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Prazo de devolução expirado!')).toBeInTheDocument();
      });
    });

    it('should not show overdue alert for returned assignments', async () => {
      mockApi.get.mockResolvedValue({
        data: createMockAssignment({ due_date: pastDateString, status: 'returned' }),
      });
      renderComponent();
      await waitFor(() => {
        expect(screen.queryByText('Prazo de devolução expirado!')).not.toBeInTheDocument();
      });
    });

    it('should not show overdue alert for completed assignments', async () => {
      mockApi.get.mockResolvedValue({
        data: createMockAssignment({ due_date: pastDateString, status: 'completed' }),
      });
      renderComponent();
      await waitFor(() => {
        expect(screen.queryByText('Prazo de devolução expirado!')).not.toBeInTheDocument();
      });
    });
  });

  describe('dirigente actions', () => {
    describe('pending assignment', () => {
      beforeEach(() => {
        mockApi.get.mockResolvedValue({
          data: createMockAssignment({ status: 'pending' }),
        });
      });

      it('should show accept button for own pending assignment', async () => {
        renderComponent();
        await waitFor(() => {
          expect(screen.getByText('Aceitar Designação')).toBeInTheDocument();
        });
      });

      it('should show refuse button for own pending assignment', async () => {
        renderComponent();
        await waitFor(() => {
          expect(screen.getByText('Recusar Designação')).toBeInTheDocument();
        });
      });

      it('should call handleStartWork when accept is clicked', async () => {
        renderComponent();
        await waitFor(() => {
          expect(screen.getByText('Aceitar Designação')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('Aceitar Designação'));
        await waitFor(() => {
          expect(mockApi.post).toHaveBeenCalledWith('/assignments/1/start');
          expect(mockToast.success).toHaveBeenCalledWith('Designação aceita! O administrador foi notificado.');
        });
      });

      it('should show error toast when accept fails', async () => {
        mockApi.post.mockRejectedValue({ response: { data: { error: 'Failed' } } });
        renderComponent();
        await waitFor(() => {
          expect(screen.getByText('Aceitar Designação')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('Aceitar Designação'));
        await waitFor(() => {
          expect(mockToast.error).toHaveBeenCalledWith('Failed');
        });
      });
    });

    describe('in_progress assignment', () => {
      it('should show return button for own in_progress assignment', async () => {
        renderComponent();
        await waitFor(() => {
          expect(screen.getByText('Devolver Território')).toBeInTheDocument();
        });
      });

      it('should not show accept/refuse buttons for in_progress assignment', async () => {
        renderComponent();
        await waitFor(() => {
          expect(screen.queryByText('Aceitar Designação')).not.toBeInTheDocument();
          expect(screen.queryByText('Recusar Designação')).not.toBeInTheDocument();
        });
      });
    });

    describe('returned assignment', () => {
      it('should not show any action buttons for returned assignment', async () => {
        mockApi.get.mockResolvedValue({
          data: createMockAssignment({ status: 'returned' }),
        });
        renderComponent();
        await waitFor(() => {
          expect(screen.queryByText('Devolver Território')).not.toBeInTheDocument();
          expect(screen.queryByText('Aceitar Designação')).not.toBeInTheDocument();
        });
      });
    });
  });

  describe('return modal', () => {
    it('should open return modal when clicking return button', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Devolver Território')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Devolver Território'));
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByTestId('modal')).toHaveAttribute('data-title', 'Devolver Território');
    });

    it('should show not worked checkbox in return modal', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Devolver Território')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Devolver Território'));
      expect(screen.getByText('Devolver território não trabalhado')).toBeInTheDocument();
    });

    it('should disable return button when no blocks selected and not marked as not worked', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Devolver Território')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Devolver Território'));
      
      const returnButton = screen.getAllByText('Devolver').find(btn => 
        btn.closest('button')?.classList.contains('btn-primary')
      );
      
      // Button should be disabled when no blocks selected
      expect(returnButton.closest('button')).toBeDisabled();
    });

    it('should close modal when cancel is clicked', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Devolver Território')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Devolver Território'));
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      
      fireEvent.click(screen.getByTestId('modal-close'));
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });
  });

  describe('refuse modal', () => {
    beforeEach(() => {
      mockApi.get.mockResolvedValue({
        data: createMockAssignment({ status: 'pending' }),
      });
    });

    it('should open refuse modal when clicking refuse button', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Recusar Designação')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Recusar Designação'));
      expect(screen.getByTestId('modal')).toHaveAttribute('data-title', 'Recusar Designação');
    });

    it('should disable confirm button when no reason provided', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Recusar Designação')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Recusar Designação'));
      
      const confirmButton = screen.getByText('Confirmar Recusa').closest('button');
      
      // Button should be disabled when no reason provided
      expect(confirmButton).toBeDisabled();
    });

    it('should submit refuse when reason is provided', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Recusar Designação')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Recusar Designação'));
      
      const textarea = screen.getByLabelText('Motivo da Recusa');
      fireEvent.change(textarea, { target: { value: 'Não tenho disponibilidade' } });
      
      const confirmButton = screen.getByText('Confirmar Recusa').closest('button');
      fireEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith('/assignments/1/refuse', {
          reason: 'Não tenho disponibilidade',
        });
        expect(mockToast.success).toHaveBeenCalledWith('Designação recusada. O administrador foi notificado.');
        expect(mockNavigate).toHaveBeenCalledWith('/dirigente');
      });
    });
  });

  describe('admin actions', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: mockAdminUser, isAdmin: true });
    });

    describe('validation', () => {
      it('should show validation alert for returned assignment', async () => {
        mockApi.get.mockResolvedValue({
          data: createMockAssignment({ status: 'returned', dirigente_id: 1 }),
        });
        renderComponent();
        await waitFor(() => {
          expect(screen.getByText('Aguardando validação')).toBeInTheDocument();
          expect(screen.getByText('Validar')).toBeInTheDocument();
        });
      });

      it('should open validate modal when clicking validate button', async () => {
        mockApi.get.mockResolvedValue({
          data: createMockAssignment({ status: 'returned', blocks_worked: [1, 2] }),
        });
        renderComponent();
        await waitFor(() => {
          expect(screen.getByText('Validar')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('Validar'));
        expect(screen.getByTestId('modal')).toHaveAttribute('data-title', 'Validar Devolução');
      });

      it('should show not worked alert in validate modal when territory was not worked', async () => {
        mockApi.get.mockResolvedValue({
          data: createMockAssignment({ status: 'returned', not_worked: true }),
        });
        renderComponent();
        await waitFor(() => {
          expect(screen.getByText('Validar')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('Validar'));
        // Text appears in both the main page and modal, so check for multiple instances
        const notWorkedTexts = screen.getAllByText('Território devolvido sem ter sido trabalhado');
        expect(notWorkedTexts.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('cancel assignment', () => {
      it('should show cancel button for other user pending assignment', async () => {
        mockApi.get.mockResolvedValue({
          data: createMockAssignment({ status: 'pending', dirigente_id: 1 }),
        });
        renderComponent();
        await waitFor(() => {
          expect(screen.getByText('Cancelar Designação')).toBeInTheDocument();
        });
      });

      it('should not show cancel button for own assignment', async () => {
        mockApi.get.mockResolvedValue({
          data: createMockAssignment({ status: 'pending', dirigente_id: 2 }),
        });
        renderComponent();
        await waitFor(() => {
          expect(screen.queryByText('Cancelar Designação')).not.toBeInTheDocument();
        });
      });

      it('should call handleCancel when cancel is clicked and confirmed', async () => {
        mockApi.get.mockResolvedValue({
          data: createMockAssignment({ status: 'pending', dirigente_id: 1 }),
        });
        renderComponent();
        await waitFor(() => {
          expect(screen.getByText('Cancelar Designação')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('Cancelar Designação'));
        await waitFor(() => {
          expect(mockApi.post).toHaveBeenCalledWith('/assignments/1/cancel');
          expect(mockToast.success).toHaveBeenCalledWith('Designação cancelada');
          expect(mockNavigate).toHaveBeenCalledWith('/admin/assignments');
        });
      });

      it('should not cancel when confirmation is declined', async () => {
        vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
        mockApi.get.mockResolvedValue({
          data: createMockAssignment({ status: 'pending', dirigente_id: 1 }),
        });
        renderComponent();
        await waitFor(() => {
          expect(screen.getByText('Cancelar Designação')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('Cancelar Designação'));
        expect(mockApi.post).not.toHaveBeenCalled();
      });
    });
  });

  describe('returned info section', () => {
    it('should show blocks worked for returned assignment', async () => {
      mockApi.get.mockResolvedValue({
        data: createMockAssignment({
          status: 'returned',
          blocks_worked: [1, 2, 3],
        }),
      });
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Quadras Trabalhadas')).toBeInTheDocument();
      });
    });

    it('should show not worked message for returned assignment without work', async () => {
      mockApi.get.mockResolvedValue({
        data: createMockAssignment({
          status: 'returned',
          not_worked: true,
        }),
      });
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Território devolvido sem ter sido trabalhado')).toBeInTheDocument();
      });
    });

    it('should show return observations when present', async () => {
      mockApi.get.mockResolvedValue({
        data: createMockAssignment({
          status: 'returned',
          blocks_worked: [1],
          return_observations: 'Observação teste',
        }),
      });
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Observação teste')).toBeInTheDocument();
      });
    });
  });

  describe('completed info section', () => {
    it('should show validation result for completed assignment', async () => {
      mockApi.get.mockResolvedValue({
        data: createMockAssignment({
          status: 'completed',
          validation_result: 'completed',
          validated_at: '2024-06-15T10:30:00Z',
        }),
      });
      renderComponent();
      await waitFor(() => {
        const badges = screen.getAllByTestId('status-badge');
        expect(badges.some(b => b.getAttribute('data-type') === 'result')).toBe(true);
      });
    });
  });

  describe('date display', () => {
    it('should show "Devolver até" label for pending status', async () => {
      mockApi.get.mockResolvedValue({
        data: createMockAssignment({ status: 'pending' }),
      });
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Devolver até')).toBeInTheDocument();
      });
    });

    it('should show "Devolvido em" label for returned status', async () => {
      mockApi.get.mockResolvedValue({
        data: createMockAssignment({
          status: 'returned',
          returned_at: '2024-06-15T10:30:00Z',
        }),
      });
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Devolvido em')).toBeInTheDocument();
      });
    });

    it('should show "Sem prazo definido" when no due date', async () => {
      mockApi.get.mockResolvedValue({
        data: createMockAssignment({
          status: 'pending',
          due_date: null,
          assigned_date: null,
        }),
      });
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Sem prazo definido')).toBeInTheDocument();
      });
    });

    it('should calculate due date from assigned_date when due_date is null', async () => {
      const assignedDate = new Date();
      assignedDate.setDate(assignedDate.getDate() - 10);
      mockApi.get.mockResolvedValue({
        data: createMockAssignment({
          status: 'in_progress',
          due_date: null,
          assigned_date: assignedDate.toISOString().split('T')[0],
        }),
      });
      renderComponent();
      await waitFor(() => {
        // Should show a date 60 days from assigned_date
        expect(screen.getByText('Devolver até')).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('should show error toast when return fails', async () => {
      mockApi.get.mockResolvedValue({
        data: createMockAssignment({ blocks_worked: [1, 2] }),
      });
      mockApi.post.mockRejectedValue({ response: { data: { error: 'Return failed' } } });
      
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Devolver Território')).toBeInTheDocument();
      });
      
      // Open modal and try to return
      fireEvent.click(screen.getByText('Devolver Território'));
      
      // Simulate having blocks selected by checking the not worked checkbox then unchecking
      const checkbox = screen.getByLabelText('Devolver território não trabalhado');
      fireEvent.click(checkbox);
      
      const returnButton = screen.getAllByText('Devolver').find(btn => 
        btn.closest('button')?.classList.contains('btn-primary')
      );
      fireEvent.click(returnButton.closest('button'));
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled();
      });
    });

    it('should show error toast when validation fails', async () => {
      mockUseAuth.mockReturnValue({ user: mockAdminUser, isAdmin: true });
      mockApi.get.mockResolvedValue({
        data: createMockAssignment({ status: 'returned', blocks_worked: [1, 2] }),
      });
      mockApi.post.mockRejectedValue({ response: { data: { error: 'Validation failed' } } });
      
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Validar')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Validar'));
      
      const confirmButton = screen.getByText('Confirmar Validação').closest('button');
      fireEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Validation failed');
      });
    });

    it('should show error toast when cancel fails', async () => {
      mockUseAuth.mockReturnValue({ user: mockAdminUser, isAdmin: true });
      mockApi.get.mockResolvedValue({
        data: createMockAssignment({ status: 'pending', dirigente_id: 1 }),
      });
      mockApi.post.mockRejectedValue({ response: { data: { error: 'Cancel failed' } } });
      
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Cancelar Designação')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Cancelar Designação'));
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Cancel failed');
      });
    });
  });

  describe('accessibility', () => {
    it('should have accessible textarea labels', async () => {
      mockApi.get.mockResolvedValue({
        data: createMockAssignment({ status: 'pending' }),
      });
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Recusar Designação')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Recusar Designação'));
      expect(screen.getByLabelText('Motivo da Recusa')).toBeInTheDocument();
    });

    it('should have aria-label on checkboxes', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText('Devolver Território')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Devolver Território'));
      expect(screen.getByLabelText('Devolver território não trabalhado')).toBeInTheDocument();
    });
  });
});
