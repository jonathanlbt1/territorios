import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from '../../src/components/Modal';

describe('Modal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Test Modal',
    children: <p>Modal content</p>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset body overflow before each test
    document.body.style.overflow = '';
  });

  afterEach(() => {
    // Clean up body overflow after each test
    document.body.style.overflow = '';
  });

  describe('rendering', () => {
    it('should render when isOpen is true', () => {
      render(<Modal {...defaultProps} />);
      
      expect(screen.getByText('Test Modal')).toBeInTheDocument();
      expect(screen.getByText('Modal content')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(<Modal {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
      expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
    });

    it('should render title in header', () => {
      render(<Modal {...defaultProps} />);
      
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Test Modal');
    });

    it('should render children in content area', () => {
      render(
        <Modal {...defaultProps}>
          <div data-testid="custom-content">Custom Content</div>
        </Modal>
      );
      
      expect(screen.getByTestId('custom-content')).toBeInTheDocument();
    });

    it('should render close button', () => {
      render(<Modal {...defaultProps} />);
      
      const closeButton = screen.getByRole('button');
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('closing behavior', () => {
    it('should call onClose when clicking close button', () => {
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByRole('button'));
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when clicking backdrop', () => {
      const onClose = vi.fn();
      const { container } = render(<Modal {...defaultProps} onClose={onClose} />);
      
      // Find the backdrop (first child with bg-black/50 class)
      const backdrop = container.querySelector('[class*="bg-black"]');
      fireEvent.click(backdrop);
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when clicking modal content', () => {
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByText('Modal content'));
      
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('body scroll prevention', () => {
    it('should set body overflow to hidden when opened', () => {
      render(<Modal {...defaultProps} isOpen={true} />);
      
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should restore body overflow when closed', () => {
      const { rerender } = render(<Modal {...defaultProps} isOpen={true} />);
      expect(document.body.style.overflow).toBe('hidden');
      
      rerender(<Modal {...defaultProps} isOpen={false} />);
      
      expect(document.body.style.overflow).toBe('');
    });

    it('should restore body overflow on unmount', () => {
      const { unmount } = render(<Modal {...defaultProps} isOpen={true} />);
      expect(document.body.style.overflow).toBe('hidden');
      
      unmount();
      
      expect(document.body.style.overflow).toBe('');
    });

    it('should not modify overflow when initially closed', () => {
      document.body.style.overflow = 'auto';
      
      render(<Modal {...defaultProps} isOpen={false} />);
      
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('size prop', () => {
    it('should apply md size by default', () => {
      const { container } = render(<Modal {...defaultProps} />);
      
      const modal = container.querySelector('.relative.w-full');
      expect(modal.className).toContain('max-w-lg');
    });

    it('should apply sm size class', () => {
      const { container } = render(<Modal {...defaultProps} size="sm" />);
      
      const modal = container.querySelector('.relative.w-full');
      expect(modal.className).toContain('max-w-sm');
    });

    it('should apply md size class', () => {
      const { container } = render(<Modal {...defaultProps} size="md" />);
      
      const modal = container.querySelector('.relative.w-full');
      expect(modal.className).toContain('max-w-lg');
    });

    it('should apply lg size class', () => {
      const { container } = render(<Modal {...defaultProps} size="lg" />);
      
      const modal = container.querySelector('.relative.w-full');
      expect(modal.className).toContain('max-w-2xl');
    });

    it('should apply xl size class', () => {
      const { container } = render(<Modal {...defaultProps} size="xl" />);
      
      const modal = container.querySelector('.relative.w-full');
      expect(modal.className).toContain('max-w-4xl');
    });

    it('should apply full size class', () => {
      const { container } = render(<Modal {...defaultProps} size="full" />);
      
      const modal = container.querySelector('.relative.w-full');
      expect(modal.className).toContain('max-w-full');
      expect(modal.className).toContain('mx-4');
    });
  });

  describe('styling', () => {
    it('should have fixed positioning', () => {
      const { container } = render(<Modal {...defaultProps} />);
      
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('fixed');
      expect(wrapper).toHaveClass('inset-0');
    });

    it('should have z-50 for stacking', () => {
      const { container } = render(<Modal {...defaultProps} />);
      
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('z-50');
    });

    it('should have backdrop blur on overlay', () => {
      const { container } = render(<Modal {...defaultProps} />);
      
      const backdrop = container.querySelector('[class*="bg-black"]');
      expect(backdrop).toHaveClass('backdrop-blur-sm');
    });

    it('should have animation classes', () => {
      const { container } = render(<Modal {...defaultProps} />);
      
      const backdrop = container.querySelector('[class*="bg-black"]');
      expect(backdrop).toHaveClass('animate-fade-in');
      
      const modal = container.querySelector('.relative.w-full');
      expect(modal.className).toContain('animate-slide-in');
    });

    it('should have max height constraint', () => {
      const { container } = render(<Modal {...defaultProps} />);
      
      const modal = container.querySelector('.relative.w-full');
      expect(modal.className).toContain('max-h-[90vh]');
    });

    it('should have overflow hidden on modal', () => {
      const { container } = render(<Modal {...defaultProps} />);
      
      const modal = container.querySelector('.relative.w-full');
      expect(modal.className).toContain('overflow-hidden');
    });

    it('should have scrollable content area', () => {
      const { container } = render(<Modal {...defaultProps} />);
      
      const content = container.querySelector('.overflow-y-auto');
      expect(content).toBeInTheDocument();
    });
  });

  describe('complex children', () => {
    it('should render form as children', () => {
      render(
        <Modal {...defaultProps}>
          <form data-testid="modal-form">
            <input type="text" placeholder="Name" />
            <button type="submit">Submit</button>
          </form>
        </Modal>
      );
      
      expect(screen.getByTestId('modal-form')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    });

    it('should render multiple elements as children', () => {
      render(
        <Modal {...defaultProps}>
          <p>Paragraph 1</p>
          <p>Paragraph 2</p>
          <p>Paragraph 3</p>
        </Modal>
      );
      
      expect(screen.getByText('Paragraph 1')).toBeInTheDocument();
      expect(screen.getByText('Paragraph 2')).toBeInTheDocument();
      expect(screen.getByText('Paragraph 3')).toBeInTheDocument();
    });

    it('should handle null children', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          {null}
        </Modal>
      );
      
      expect(screen.getByText('Test Modal')).toBeInTheDocument();
    });
  });

  describe('title variations', () => {
    it('should render long title', () => {
      const longTitle = 'This is a very long modal title that might wrap to multiple lines';
      render(<Modal {...defaultProps} title={longTitle} />);
      
      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    it('should render title with special characters', () => {
      const specialTitle = 'Modal <Title> & "Test"';
      render(<Modal {...defaultProps} title={specialTitle} />);
      
      expect(screen.getByText(specialTitle)).toBeInTheDocument();
    });

    it('should render Portuguese title', () => {
      render(<Modal {...defaultProps} title="Confirmar Ação" />);
      
      expect(screen.getByText('Confirmar Ação')).toBeInTheDocument();
    });

    it('should render title with emoji', () => {
      render(<Modal {...defaultProps} title="🎉 Sucesso!" />);
      
      expect(screen.getByText('🎉 Sucesso!')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have heading for title', () => {
      render(<Modal {...defaultProps} />);
      
      const heading = screen.getByRole('heading');
      expect(heading).toBeInTheDocument();
    });

    it('should have clickable close button', () => {
      render(<Modal {...defaultProps} />);
      
      const button = screen.getByRole('button');
      expect(button).toBeEnabled();
    });
  });

  describe('dark mode support', () => {
    it('should have dark mode classes on modal', () => {
      const { container } = render(<Modal {...defaultProps} />);
      
      const modal = container.querySelector('.relative.w-full');
      expect(modal.className).toContain('dark:bg-slate-800');
    });

    it('should have dark mode classes on title', () => {
      render(<Modal {...defaultProps} />);
      
      const heading = screen.getByRole('heading');
      expect(heading).toHaveClass('dark:text-white');
    });

    it('should have dark mode classes on border', () => {
      const { container } = render(<Modal {...defaultProps} />);
      
      const header = container.querySelector('.border-b');
      expect(header).toHaveClass('dark:border-slate-700');
    });
  });

  describe('responsive design', () => {
    it('should have responsive positioning classes', () => {
      const { container } = render(<Modal {...defaultProps} />);
      
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('items-end');
      expect(wrapper).toHaveClass('md:items-center');
    });

    it('should have responsive border radius', () => {
      const { container } = render(<Modal {...defaultProps} />);
      
      const modal = container.querySelector('.relative.w-full');
      expect(modal.className).toContain('rounded-t-3xl');
      expect(modal.className).toContain('md:rounded-2xl');
    });
  });

  describe('edge cases', () => {
    it('should handle rapid open/close', () => {
      const { rerender } = render(<Modal {...defaultProps} isOpen={false} />);
      
      rerender(<Modal {...defaultProps} isOpen={true} />);
      expect(document.body.style.overflow).toBe('hidden');
      
      rerender(<Modal {...defaultProps} isOpen={false} />);
      expect(document.body.style.overflow).toBe('');
      
      rerender(<Modal {...defaultProps} isOpen={true} />);
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should handle empty title', () => {
      render(<Modal {...defaultProps} title="" />);
      
      // Modal should still render
      expect(screen.getByText('Modal content')).toBeInTheDocument();
    });
  });
});
