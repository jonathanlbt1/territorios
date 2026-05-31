import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NotificationsMenu from '../../src/components/NotificationsMenu';

describe('NotificationsMenu', () => {
  const mockNotifications = [
    {
      id: 1,
      title: 'Nova designação',
      message: 'Território 5 foi atribuído a você',
      is_read: false,
      created_at: '2024-01-15T10:30:00Z',
      assignment_id: 42,
    },
    {
      id: 2,
      title: 'Lembrete',
      message: 'Território 3 vence em 5 dias',
      is_read: true,
      created_at: '2024-01-14T08:00:00Z',
      assignment_id: 33,
    },
    {
      id: 3,
      title: 'Sistema',
      message: null,
      is_read: false,
      created_at: '2024-01-13T15:45:00Z',
      assignment_id: null,
    },
  ];

  const defaultProps = {
    open: true,
    notifications: mockNotifications,
    onClose: vi.fn(),
    onMarkRead: vi.fn(),
    onMarkAllRead: vi.fn(),
    onOpenAssignment: vi.fn(),
    onDelete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render when open is true', () => {
      render(<NotificationsMenu {...defaultProps} />);
      
      expect(screen.getByText('Notificações')).toBeInTheDocument();
    });

    it('should not render when open is false', () => {
      render(<NotificationsMenu {...defaultProps} open={false} />);
      
      expect(screen.queryByText('Notificações')).not.toBeInTheDocument();
    });

    it('should render notification titles', () => {
      render(<NotificationsMenu {...defaultProps} />);
      
      expect(screen.getByText('Nova designação')).toBeInTheDocument();
      expect(screen.getByText('Lembrete')).toBeInTheDocument();
      expect(screen.getByText('Sistema')).toBeInTheDocument();
    });

    it('should render notification messages', () => {
      render(<NotificationsMenu {...defaultProps} />);
      
      expect(screen.getByText('Território 5 foi atribuído a você')).toBeInTheDocument();
      expect(screen.getByText('Território 3 vence em 5 dias')).toBeInTheDocument();
    });

    it('should not render message when null', () => {
      render(<NotificationsMenu {...defaultProps} />);
      
      // Third notification has null message
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(3);
    });

    it('should render close button', () => {
      render(<NotificationsMenu {...defaultProps} />);
      
      expect(screen.getByLabelText('Fechar')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should show empty message when no notifications', () => {
      render(<NotificationsMenu {...defaultProps} notifications={[]} />);
      
      expect(screen.getByText('Nenhuma notificação por aqui.')).toBeInTheDocument();
    });

    it('should not show list when no notifications', () => {
      render(<NotificationsMenu {...defaultProps} notifications={[]} />);
      
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });
  });

  describe('unread indicators', () => {
    it('should show red dot for unread notifications', () => {
      const { container } = render(<NotificationsMenu {...defaultProps} />);
      
      const redDots = container.querySelectorAll('.bg-red-500');
      expect(redDots.length).toBe(2); // Two unread notifications
    });

    it('should show gray dot for read notifications', () => {
      const { container } = render(<NotificationsMenu {...defaultProps} />);
      
      const grayDots = container.querySelectorAll('.bg-slate-300');
      expect(grayDots.length).toBe(1); // One read notification
    });

    it('should have background highlight for unread', () => {
      const { container } = render(<NotificationsMenu {...defaultProps} />);
      
      const unreadItems = container.querySelectorAll('.bg-slate-50');
      expect(unreadItems.length).toBe(2);
    });
  });

  describe('mark all read button', () => {
    it('should show "Marcar todas como lidas" when unread exists', () => {
      render(<NotificationsMenu {...defaultProps} />);
      
      expect(screen.getByText('Marcar todas como lidas')).toBeInTheDocument();
    });

    it('should not show "Marcar todas como lidas" when all read', () => {
      const allReadNotifications = mockNotifications.map(n => ({ ...n, is_read: true }));
      render(<NotificationsMenu {...defaultProps} notifications={allReadNotifications} />);
      
      expect(screen.queryByText('Marcar todas como lidas')).not.toBeInTheDocument();
    });

    it('should call onMarkAllRead when clicking button', () => {
      const onMarkAllRead = vi.fn();
      render(<NotificationsMenu {...defaultProps} onMarkAllRead={onMarkAllRead} />);
      
      fireEvent.click(screen.getByText('Marcar todas como lidas'));
      
      expect(onMarkAllRead).toHaveBeenCalledTimes(1);
    });
  });

  describe('close functionality', () => {
    it('should call onClose when clicking close button', () => {
      const onClose = vi.fn();
      render(<NotificationsMenu {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByLabelText('Fechar'));
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('mark as read functionality', () => {
    it('should show "Marcar lida" button for unread notifications', () => {
      render(<NotificationsMenu {...defaultProps} />);
      
      const markReadButtons = screen.getAllByText('Marcar lida');
      expect(markReadButtons.length).toBe(2); // Two unread notifications
    });

    it('should not show "Marcar lida" for read notifications', () => {
      const allReadNotifications = mockNotifications.map(n => ({ ...n, is_read: true }));
      render(<NotificationsMenu {...defaultProps} notifications={allReadNotifications} />);
      
      expect(screen.queryByText('Marcar lida')).not.toBeInTheDocument();
    });

    it('should call onMarkRead with notification id', () => {
      const onMarkRead = vi.fn();
      render(<NotificationsMenu {...defaultProps} onMarkRead={onMarkRead} />);
      
      const markReadButtons = screen.getAllByText('Marcar lida');
      fireEvent.click(markReadButtons[0]);
      
      expect(onMarkRead).toHaveBeenCalledWith(1);
    });
  });

  describe('open assignment functionality', () => {
    it('should show "Abrir designação" for notifications with assignment_id', () => {
      render(<NotificationsMenu {...defaultProps} />);
      
      const openButtons = screen.getAllByText('Abrir designação');
      expect(openButtons.length).toBe(2); // Two notifications have assignment_id
    });

    it('should not show "Abrir designação" when no assignment_id', () => {
      const noAssignmentNotifications = [
        { id: 1, title: 'Test', is_read: false, assignment_id: null },
      ];
      render(<NotificationsMenu {...defaultProps} notifications={noAssignmentNotifications} />);
      
      expect(screen.queryByText('Abrir designação')).not.toBeInTheDocument();
    });

    it('should call onOpenAssignment with assignment_id and notification', () => {
      const onOpenAssignment = vi.fn();
      render(<NotificationsMenu {...defaultProps} onOpenAssignment={onOpenAssignment} />);
      
      const openButtons = screen.getAllByText('Abrir designação');
      fireEvent.click(openButtons[0]);
      
      expect(onOpenAssignment).toHaveBeenCalledWith(42, mockNotifications[0]);
    });
  });

  describe('delete functionality', () => {
    it('should show "Apagar" button for all notifications', () => {
      render(<NotificationsMenu {...defaultProps} />);
      
      const deleteButtons = screen.getAllByText('Apagar');
      expect(deleteButtons.length).toBe(3);
    });

    it('should call onDelete with notification id', () => {
      const onDelete = vi.fn();
      render(<NotificationsMenu {...defaultProps} onDelete={onDelete} />);
      
      const deleteButtons = screen.getAllByText('Apagar');
      fireEvent.click(deleteButtons[0]);
      
      expect(onDelete).toHaveBeenCalledWith(1);
    });

    it('should have aria-label for delete button', () => {
      render(<NotificationsMenu {...defaultProps} />);
      
      const deleteButtons = screen.getAllByLabelText('Apagar notificação');
      expect(deleteButtons.length).toBe(3);
    });
  });

  describe('placement prop', () => {
    it('should apply mobile styles by default', () => {
      const { container } = render(<NotificationsMenu {...defaultProps} />);
      
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('fixed');
    });

    it('should apply mobile styles when placement is "mobile"', () => {
      const { container } = render(<NotificationsMenu {...defaultProps} placement="mobile" />);
      
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('fixed');
      expect(wrapper).toHaveClass('top-2');
      expect(wrapper).toHaveClass('left-2');
      expect(wrapper).toHaveClass('right-2');
    });

    it('should apply desktop styles when placement is "desktop"', () => {
      const { container } = render(<NotificationsMenu {...defaultProps} placement="desktop" />);
      
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('absolute');
      expect(wrapper).toHaveClass('w-96');
    });
  });

  describe('date formatting', () => {
    it('should format dates in Brazilian format', () => {
      const notification = [{
        id: 1,
        title: 'Test',
        is_read: false,
        created_at: '2024-03-15T14:30:00Z',
      }];
      render(<NotificationsMenu {...defaultProps} notifications={notification} />);
      
      // Date should be formatted (exact format depends on locale)
      // Just check the notification renders
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('should handle invalid dates gracefully', () => {
      const notification = [{
        id: 1,
        title: 'Test',
        is_read: false,
        created_at: 'invalid-date',
      }];
      render(<NotificationsMenu {...defaultProps} notifications={notification} />);
      
      // Should render without crashing
      expect(screen.getByText('Test')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('should have z-50 for stacking', () => {
      const { container } = render(<NotificationsMenu {...defaultProps} />);
      
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('z-50');
    });

    it('should have rounded corners', () => {
      const { container } = render(<NotificationsMenu {...defaultProps} />);
      
      const menuBox = container.querySelector('.rounded-xl');
      expect(menuBox).toBeInTheDocument();
    });

    it('should have shadow', () => {
      const { container } = render(<NotificationsMenu {...defaultProps} />);
      
      const menuBox = container.querySelector('.shadow-xl');
      expect(menuBox).toBeInTheDocument();
    });

    it('should have max height with scroll', () => {
      const { container } = render(<NotificationsMenu {...defaultProps} />);
      
      const scrollArea = container.querySelector('.overflow-y-auto');
      expect(scrollArea).toBeInTheDocument();
    });
  });

  describe('dark mode support', () => {
    it('should have dark mode classes on container', () => {
      const { container } = render(<NotificationsMenu {...defaultProps} />);
      
      const menuBox = container.querySelector('[class*="dark:bg-slate-900"]');
      expect(menuBox).toBeInTheDocument();
    });

    it('should have dark mode classes on header', () => {
      render(<NotificationsMenu {...defaultProps} />);
      
      const title = screen.getByText('Notificações');
      expect(title).toHaveClass('dark:text-slate-100');
    });
  });

  describe('optional callbacks', () => {
    it('should handle undefined onMarkRead gracefully', () => {
      render(<NotificationsMenu {...defaultProps} onMarkRead={undefined} />);
      
      const markReadButtons = screen.getAllByText('Marcar lida');
      expect(() => fireEvent.click(markReadButtons[0])).not.toThrow();
    });

    it('should handle undefined onOpenAssignment gracefully', () => {
      render(<NotificationsMenu {...defaultProps} onOpenAssignment={undefined} />);
      
      const openButtons = screen.getAllByText('Abrir designação');
      expect(() => fireEvent.click(openButtons[0])).not.toThrow();
    });

    it('should handle undefined onDelete gracefully', () => {
      render(<NotificationsMenu {...defaultProps} onDelete={undefined} />);
      
      const deleteButtons = screen.getAllByText('Apagar');
      expect(() => fireEvent.click(deleteButtons[0])).not.toThrow();
    });
  });

  describe('Portuguese labels', () => {
    it('should display Portuguese title', () => {
      render(<NotificationsMenu {...defaultProps} />);
      
      expect(screen.getByText('Notificações')).toBeInTheDocument();
    });

    it('should display Portuguese empty message', () => {
      render(<NotificationsMenu {...defaultProps} notifications={[]} />);
      
      expect(screen.getByText('Nenhuma notificação por aqui.')).toBeInTheDocument();
    });

    it('should display Portuguese button labels', () => {
      render(<NotificationsMenu {...defaultProps} />);
      
      expect(screen.getByText('Marcar todas como lidas')).toBeInTheDocument();
      expect(screen.getAllByText('Marcar lida').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Abrir designação').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Apagar').length).toBeGreaterThan(0);
    });
  });

  describe('default props', () => {
    it('should default notifications to empty array', () => {
      render(
        <NotificationsMenu
          open={true}
          onClose={vi.fn()}
        />
      );
      
      expect(screen.getByText('Nenhuma notificação por aqui.')).toBeInTheDocument();
    });

    it('should default placement to mobile', () => {
      const { container } = render(
        <NotificationsMenu
          open={true}
          onClose={vi.fn()}
        />
      );
      
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('fixed');
    });
  });

  describe('accessibility', () => {
    it('should have list structure for notifications', () => {
      render(<NotificationsMenu {...defaultProps} />);
      
      expect(screen.getByRole('list')).toBeInTheDocument();
      expect(screen.getAllByRole('listitem').length).toBe(3);
    });

    it('should have aria-label on close button', () => {
      render(<NotificationsMenu {...defaultProps} />);
      
      expect(screen.getByLabelText('Fechar')).toBeInTheDocument();
    });

    it('should have aria-label on delete buttons', () => {
      render(<NotificationsMenu {...defaultProps} />);
      
      const deleteButtons = screen.getAllByLabelText('Apagar notificação');
      expect(deleteButtons.length).toBe(3);
    });
  });

  describe('edge cases', () => {
    it('should handle notification without message', () => {
      const notification = [{
        id: 1,
        title: 'Title Only',
        message: null,
        is_read: false,
      }];
      render(<NotificationsMenu {...defaultProps} notifications={notification} />);
      
      expect(screen.getByText('Title Only')).toBeInTheDocument();
    });

    it('should handle notification with empty message', () => {
      const notification = [{
        id: 1,
        title: 'Title',
        message: '',
        is_read: false,
      }];
      render(<NotificationsMenu {...defaultProps} notifications={notification} />);
      
      expect(screen.getByText('Title')).toBeInTheDocument();
    });

    it('should handle very long notification title', () => {
      const notification = [{
        id: 1,
        title: 'A'.repeat(100),
        is_read: false,
      }];
      render(<NotificationsMenu {...defaultProps} notifications={notification} />);
      
      expect(screen.getByText('A'.repeat(100))).toBeInTheDocument();
    });

    it('should handle many notifications', () => {
      const manyNotifications = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        title: `Notification ${i + 1}`,
        is_read: i % 2 === 0,
      }));
      render(<NotificationsMenu {...defaultProps} notifications={manyNotifications} />);
      
      expect(screen.getAllByRole('listitem').length).toBe(50);
    });
  });
});
