import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import PropTypes from 'prop-types';
import { ToastProvider, useToast } from '../../src/contexts/ToastContext';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  CheckCircle: (props) => <svg data-testid="check-circle-icon" {...props} />,
  XCircle: (props) => <svg data-testid="x-circle-icon" {...props} />,
  Info: (props) => <svg data-testid="info-icon" {...props} />,
  X: (props) => <svg data-testid="close-icon" {...props} />,
}));

// Test component to access toast context
function TestConsumer(props) {
  const toast = useToast();
  if (props.onMount) {
    props.onMount(toast);
  }
  return (
    <div>
      <button onClick={() => toast.success('Success message')}>Show Success</button>
      <button onClick={() => toast.error('Error message')}>Show Error</button>
      <button onClick={() => toast.info('Info message')}>Show Info</button>
    </div>
  );
}

TestConsumer.propTypes = {
  onMount: PropTypes.func,
};

describe('ToastContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('ToastProvider', () => {
    describe('children rendering', () => {
      it('should render children', () => {
        render(
          <ToastProvider>
            <div data-testid="child">Child Content</div>
          </ToastProvider>
        );

        expect(screen.getByTestId('child')).toHaveTextContent('Child Content');
      });

      it('should render multiple children', () => {
        render(
          <ToastProvider>
            <div data-testid="child1">First</div>
            <div data-testid="child2">Second</div>
          </ToastProvider>
        );

        expect(screen.getByTestId('child1')).toBeInTheDocument();
        expect(screen.getByTestId('child2')).toBeInTheDocument();
      });
    });

    describe('toast container', () => {
      it('should render toast container', () => {
        const { container } = render(
          <ToastProvider>
            <div>Content</div>
          </ToastProvider>
        );

        const toastContainer = container.querySelector('.fixed');
        expect(toastContainer).toBeInTheDocument();
      });

      it('should have correct positioning classes', () => {
        const { container } = render(
          <ToastProvider>
            <div>Content</div>
          </ToastProvider>
        );

        const toastContainer = container.querySelector('.fixed');
        expect(toastContainer).toHaveClass('bottom-20');
        expect(toastContainer).toHaveClass('z-50');
      });
    });

    describe('success toast', () => {
      it('should display success toast', () => {
        render(
          <ToastProvider>
            <TestConsumer />
          </ToastProvider>
        );

        act(() => {
          screen.getByText('Show Success').click();
        });

        expect(screen.getByText('Success message')).toBeInTheDocument();
      });

      it('should show CheckCircle icon for success', () => {
        render(
          <ToastProvider>
            <TestConsumer />
          </ToastProvider>
        );

        act(() => {
          screen.getByText('Show Success').click();
        });

        expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
      });

      it('should have success class', () => {
        const { container } = render(
          <ToastProvider>
            <TestConsumer />
          </ToastProvider>
        );

        act(() => {
          screen.getByText('Show Success').click();
        });

        const toast = container.querySelector('.toast-success');
        expect(toast).toBeInTheDocument();
      });
    });

    describe('error toast', () => {
      it('should display error toast', () => {
        render(
          <ToastProvider>
            <TestConsumer />
          </ToastProvider>
        );

        act(() => {
          screen.getByText('Show Error').click();
        });

        expect(screen.getByText('Error message')).toBeInTheDocument();
      });

      it('should show XCircle icon for error', () => {
        render(
          <ToastProvider>
            <TestConsumer />
          </ToastProvider>
        );

        act(() => {
          screen.getByText('Show Error').click();
        });

        expect(screen.getByTestId('x-circle-icon')).toBeInTheDocument();
      });

      it('should have error class', () => {
        const { container } = render(
          <ToastProvider>
            <TestConsumer />
          </ToastProvider>
        );

        act(() => {
          screen.getByText('Show Error').click();
        });

        const toast = container.querySelector('.toast-error');
        expect(toast).toBeInTheDocument();
      });
    });

    describe('info toast', () => {
      it('should display info toast', () => {
        render(
          <ToastProvider>
            <TestConsumer />
          </ToastProvider>
        );

        act(() => {
          screen.getByText('Show Info').click();
        });

        expect(screen.getByText('Info message')).toBeInTheDocument();
      });

      it('should show Info icon for info', () => {
        render(
          <ToastProvider>
            <TestConsumer />
          </ToastProvider>
        );

        act(() => {
          screen.getByText('Show Info').click();
        });

        expect(screen.getByTestId('info-icon')).toBeInTheDocument();
      });

      it('should have info class', () => {
        const { container } = render(
          <ToastProvider>
            <TestConsumer />
          </ToastProvider>
        );

        act(() => {
          screen.getByText('Show Info').click();
        });

        const toast = container.querySelector('.toast-info');
        expect(toast).toBeInTheDocument();
      });
    });

    describe('auto-dismiss', () => {
      it('should auto-dismiss toast after default duration', () => {
        render(
          <ToastProvider>
            <TestConsumer />
          </ToastProvider>
        );

        act(() => {
          screen.getByText('Show Success').click();
        });

        expect(screen.getByText('Success message')).toBeInTheDocument();

        act(() => {
          vi.advanceTimersByTime(4001);
        });

        expect(screen.queryByText('Success message')).not.toBeInTheDocument();
      });

      it('should not dismiss before duration expires', () => {
        render(
          <ToastProvider>
            <TestConsumer />
          </ToastProvider>
        );

        act(() => {
          screen.getByText('Show Success').click();
        });

        act(() => {
          vi.advanceTimersByTime(3999);
        });

        expect(screen.getByText('Success message')).toBeInTheDocument();
      });
    });

    describe('manual dismiss', () => {
      it('should have close button', () => {
        render(
          <ToastProvider>
            <TestConsumer />
          </ToastProvider>
        );

        act(() => {
          screen.getByText('Show Success').click();
        });

        expect(screen.getByTestId('close-icon')).toBeInTheDocument();
      });

      it('should dismiss toast when close button clicked', () => {
        render(
          <ToastProvider>
            <TestConsumer />
          </ToastProvider>
        );

        act(() => {
          screen.getByText('Show Success').click();
        });

        expect(screen.getByText('Success message')).toBeInTheDocument();

        const closeButton = screen.getByTestId('close-icon').parentElement;
        act(() => {
          closeButton.click();
        });

        expect(screen.queryByText('Success message')).not.toBeInTheDocument();
      });
    });

    describe('multiple toasts', () => {
      it('should display multiple toasts', () => {
        render(
          <ToastProvider>
            <TestConsumer />
          </ToastProvider>
        );

        act(() => {
          screen.getByText('Show Success').click();
          screen.getByText('Show Error').click();
          screen.getByText('Show Info').click();
        });

        expect(screen.getByText('Success message')).toBeInTheDocument();
        expect(screen.getByText('Error message')).toBeInTheDocument();
        expect(screen.getByText('Info message')).toBeInTheDocument();
      });

      it('should dismiss toasts independently', () => {
        render(
          <ToastProvider>
            <TestConsumer />
          </ToastProvider>
        );

        act(() => {
          screen.getByText('Show Success').click();
        });

        // Wait a bit before showing second toast
        act(() => {
          vi.advanceTimersByTime(1000);
        });

        act(() => {
          screen.getByText('Show Error').click();
        });

        expect(screen.getByText('Success message')).toBeInTheDocument();
        expect(screen.getByText('Error message')).toBeInTheDocument();

        // First toast should dismiss at 4000ms (3000ms more)
        act(() => {
          vi.advanceTimersByTime(3001);
        });

        expect(screen.queryByText('Success message')).not.toBeInTheDocument();
        // Second toast should still be visible (only 3001ms elapsed for it)
        expect(screen.getByText('Error message')).toBeInTheDocument();
      });
    });

    describe('context value structure', () => {
      it('should provide success function', () => {
        let contextValue;
        render(
          <ToastProvider>
            <TestConsumer onMount={(ctx) => { contextValue = ctx; }} />
          </ToastProvider>
        );

        expect(typeof contextValue.success).toBe('function');
      });

      it('should provide error function', () => {
        let contextValue;
        render(
          <ToastProvider>
            <TestConsumer onMount={(ctx) => { contextValue = ctx; }} />
          </ToastProvider>
        );

        expect(typeof contextValue.error).toBe('function');
      });

      it('should provide info function', () => {
        let contextValue;
        render(
          <ToastProvider>
            <TestConsumer onMount={(ctx) => { contextValue = ctx; }} />
          </ToastProvider>
        );

        expect(typeof contextValue.info).toBe('function');
      });
    });

    describe('toast styling', () => {
      it('should have base toast class', () => {
        const { container } = render(
          <ToastProvider>
            <TestConsumer />
          </ToastProvider>
        );

        act(() => {
          screen.getByText('Show Success').click();
        });

        const toast = container.querySelector('.toast');
        expect(toast).toBeInTheDocument();
      });

      it('should have flex layout', () => {
        const { container } = render(
          <ToastProvider>
            <TestConsumer />
          </ToastProvider>
        );

        act(() => {
          screen.getByText('Show Success').click();
        });

        const toast = container.querySelector('.toast');
        expect(toast).toHaveClass('flex');
        expect(toast).toHaveClass('items-center');
        expect(toast).toHaveClass('gap-3');
      });
    });
  });

  describe('useToast hook', () => {
    it('should throw error when used outside ToastProvider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow('useToast must be used within a ToastProvider');

      consoleSpy.mockRestore();
    });

    it('should return context when used within ToastProvider', () => {
      let contextValue;
      render(
        <ToastProvider>
          <TestConsumer onMount={(ctx) => { contextValue = ctx; }} />
        </ToastProvider>
      );

      expect(contextValue).toBeDefined();
      expect(contextValue).toHaveProperty('success');
      expect(contextValue).toHaveProperty('error');
      expect(contextValue).toHaveProperty('info');
    });
  });

  describe('edge cases', () => {
    it('should handle empty message', () => {
      let contextValue;
      const { container } = render(
        <ToastProvider>
          <TestConsumer onMount={(ctx) => { contextValue = ctx; }} />
        </ToastProvider>
      );

      act(() => {
        contextValue.success('');
      });

      // Toast should be rendered but with empty content
      const toast = container.querySelector('.toast');
      expect(toast).toBeInTheDocument();
    });

    it('should handle special characters in message', () => {
      let contextValue;
      render(
        <ToastProvider>
          <TestConsumer onMount={(ctx) => { contextValue = ctx; }} />
        </ToastProvider>
      );

      act(() => {
        contextValue.success('<script>alert("xss")</script>');
      });

      // Should render as text, not as HTML
      expect(screen.getByText('<script>alert("xss")</script>')).toBeInTheDocument();
    });

    it('should handle Portuguese characters', () => {
      let contextValue;
      render(
        <ToastProvider>
          <TestConsumer onMount={(ctx) => { contextValue = ctx; }} />
        </ToastProvider>
      );

      act(() => {
        contextValue.success('Operação realizada com êxito!');
      });

      expect(screen.getByText('Operação realizada com êxito!')).toBeInTheDocument();
    });

    it('should handle long messages', () => {
      let contextValue;
      render(
        <ToastProvider>
          <TestConsumer onMount={(ctx) => { contextValue = ctx; }} />
        </ToastProvider>
      );

      const longMessage = 'A'.repeat(500);
      act(() => {
        contextValue.info(longMessage);
      });

      expect(screen.getByText(longMessage)).toBeInTheDocument();
    });

    it('should handle rapid toast creation', () => {
      let contextValue;
      render(
        <ToastProvider>
          <TestConsumer onMount={(ctx) => { contextValue = ctx; }} />
        </ToastProvider>
      );

      act(() => {
        for (let i = 0; i < 10; i++) {
          contextValue.success(`Toast ${i}`);
        }
      });

      // All 10 toasts should be visible
      for (let i = 0; i < 10; i++) {
        expect(screen.getByText(`Toast ${i}`)).toBeInTheDocument();
      }
    });
  });
});
