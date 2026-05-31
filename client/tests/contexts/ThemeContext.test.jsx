import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import PropTypes from 'prop-types';
import { ThemeProvider, useTheme } from '../../src/contexts/ThemeContext';

// Mock localStorage
const localStorageMock = {
  store: {},
  getItem: vi.fn((key) => localStorageMock.store[key] || null),
  setItem: vi.fn((key, value) => {
    localStorageMock.store[key] = value;
  }),
  removeItem: vi.fn((key) => {
    delete localStorageMock.store[key];
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {};
  }),
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
});

// Mock matchMedia
let mockMatchMediaMatches = false;
let mockMediaQueryListeners = [];

const mockMatchMedia = vi.fn((query) => ({
  matches: mockMatchMediaMatches,
  media: query,
  addEventListener: vi.fn((event, callback) => {
    mockMediaQueryListeners.push(callback);
  }),
  removeEventListener: vi.fn((event, callback) => {
    mockMediaQueryListeners = mockMediaQueryListeners.filter(cb => cb !== callback);
  }),
}));

Object.defineProperty(globalThis, 'matchMedia', {
  value: mockMatchMedia,
  writable: true,
});

// Test component to access theme context
function TestConsumer(props) {
  const themeContext = useTheme();
  if (props.onMount) {
    props.onMount(themeContext);
  }
  return (
    <div>
      <span data-testid="theme">{themeContext.theme}</span>
      <span data-testid="isDark">{themeContext.isDark.toString()}</span>
      <button onClick={themeContext.toggleTheme}>Toggle</button>
      <button onClick={() => themeContext.setTheme('dark')}>Set Dark</button>
      <button onClick={() => themeContext.setTheme('light')}>Set Light</button>
    </div>
  );
}

TestConsumer.propTypes = {
  onMount: PropTypes.func,
};

describe('ThemeContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.store = {};
    mockMatchMediaMatches = false;
    mockMediaQueryListeners = [];
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('ThemeProvider', () => {
    describe('initial theme from localStorage', () => {
      it('should use theme from localStorage if saved', () => {
        localStorageMock.store = { theme: 'dark' };

        render(
          <ThemeProvider>
            <TestConsumer />
          </ThemeProvider>
        );

        expect(screen.getByTestId('theme')).toHaveTextContent('dark');
      });

      it('should use light theme from localStorage', () => {
        localStorageMock.store = { theme: 'light' };

        render(
          <ThemeProvider>
            <TestConsumer />
          </ThemeProvider>
        );

        expect(screen.getByTestId('theme')).toHaveTextContent('light');
      });
    });

    describe('initial theme from system preference', () => {
      it('should use dark theme if system prefers dark and no localStorage', () => {
        mockMatchMediaMatches = true;

        render(
          <ThemeProvider>
            <TestConsumer />
          </ThemeProvider>
        );

        expect(screen.getByTestId('theme')).toHaveTextContent('dark');
      });

      it('should use light theme if system prefers light and no localStorage', () => {
        mockMatchMediaMatches = false;

        render(
          <ThemeProvider>
            <TestConsumer />
          </ThemeProvider>
        );

        expect(screen.getByTestId('theme')).toHaveTextContent('light');
      });

      it('should call matchMedia with correct query', () => {
        render(
          <ThemeProvider>
            <TestConsumer />
          </ThemeProvider>
        );

        expect(mockMatchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
      });
    });

    describe('localStorage precedence', () => {
      it('should prefer localStorage over system preference', () => {
        localStorageMock.store = { theme: 'light' };
        mockMatchMediaMatches = true; // System prefers dark

        render(
          <ThemeProvider>
            <TestConsumer />
          </ThemeProvider>
        );

        expect(screen.getByTestId('theme')).toHaveTextContent('light');
      });
    });

    describe('document class management', () => {
      it('should add dark class when theme is dark', () => {
        localStorageMock.store = { theme: 'dark' };

        render(
          <ThemeProvider>
            <TestConsumer />
          </ThemeProvider>
        );

        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });

      it('should not have dark class when theme is light', () => {
        localStorageMock.store = { theme: 'light' };

        render(
          <ThemeProvider>
            <TestConsumer />
          </ThemeProvider>
        );

        expect(document.documentElement.classList.contains('dark')).toBe(false);
      });

      it('should remove dark class when switching to light', () => {
        localStorageMock.store = { theme: 'dark' };

        render(
          <ThemeProvider>
            <TestConsumer />
          </ThemeProvider>
        );

        expect(document.documentElement.classList.contains('dark')).toBe(true);

        act(() => {
          screen.getByText('Set Light').click();
        });

        expect(document.documentElement.classList.contains('dark')).toBe(false);
      });

      it('should add dark class when switching to dark', () => {
        localStorageMock.store = { theme: 'light' };

        render(
          <ThemeProvider>
            <TestConsumer />
          </ThemeProvider>
        );

        expect(document.documentElement.classList.contains('dark')).toBe(false);

        act(() => {
          screen.getByText('Set Dark').click();
        });

        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });
    });

    describe('localStorage persistence', () => {
      it('should save theme to localStorage on change', () => {
        render(
          <ThemeProvider>
            <TestConsumer />
          </ThemeProvider>
        );

        act(() => {
          screen.getByText('Set Dark').click();
        });

        expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'dark');
      });

      it('should save theme on initial render', () => {
        mockMatchMediaMatches = false;

        render(
          <ThemeProvider>
            <TestConsumer />
          </ThemeProvider>
        );

        expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'light');
      });
    });

    describe('toggleTheme function', () => {
      it('should toggle from light to dark', () => {
        localStorageMock.store = { theme: 'light' };

        render(
          <ThemeProvider>
            <TestConsumer />
          </ThemeProvider>
        );

        expect(screen.getByTestId('theme')).toHaveTextContent('light');

        act(() => {
          screen.getByText('Toggle').click();
        });

        expect(screen.getByTestId('theme')).toHaveTextContent('dark');
      });

      it('should toggle from dark to light', () => {
        localStorageMock.store = { theme: 'dark' };

        render(
          <ThemeProvider>
            <TestConsumer />
          </ThemeProvider>
        );

        expect(screen.getByTestId('theme')).toHaveTextContent('dark');

        act(() => {
          screen.getByText('Toggle').click();
        });

        expect(screen.getByTestId('theme')).toHaveTextContent('light');
      });

      it('should toggle multiple times', () => {
        localStorageMock.store = { theme: 'light' };

        render(
          <ThemeProvider>
            <TestConsumer />
          </ThemeProvider>
        );

        act(() => {
          screen.getByText('Toggle').click();
        });
        expect(screen.getByTestId('theme')).toHaveTextContent('dark');

        act(() => {
          screen.getByText('Toggle').click();
        });
        expect(screen.getByTestId('theme')).toHaveTextContent('light');

        act(() => {
          screen.getByText('Toggle').click();
        });
        expect(screen.getByTestId('theme')).toHaveTextContent('dark');
      });
    });

    describe('setTheme function', () => {
      it('should set theme to dark', () => {
        localStorageMock.store = { theme: 'light' };

        render(
          <ThemeProvider>
            <TestConsumer />
          </ThemeProvider>
        );

        act(() => {
          screen.getByText('Set Dark').click();
        });

        expect(screen.getByTestId('theme')).toHaveTextContent('dark');
      });

      it('should set theme to light', () => {
        localStorageMock.store = { theme: 'dark' };

        render(
          <ThemeProvider>
            <TestConsumer />
          </ThemeProvider>
        );

        act(() => {
          screen.getByText('Set Light').click();
        });

        expect(screen.getByTestId('theme')).toHaveTextContent('light');
      });
    });

    describe('isDark computed property', () => {
      it('should be true when theme is dark', () => {
        localStorageMock.store = { theme: 'dark' };

        render(
          <ThemeProvider>
            <TestConsumer />
          </ThemeProvider>
        );

        expect(screen.getByTestId('isDark')).toHaveTextContent('true');
      });

      it('should be false when theme is light', () => {
        localStorageMock.store = { theme: 'light' };

        render(
          <ThemeProvider>
            <TestConsumer />
          </ThemeProvider>
        );

        expect(screen.getByTestId('isDark')).toHaveTextContent('false');
      });

      it('should update when theme changes', () => {
        localStorageMock.store = { theme: 'light' };

        render(
          <ThemeProvider>
            <TestConsumer />
          </ThemeProvider>
        );

        expect(screen.getByTestId('isDark')).toHaveTextContent('false');

        act(() => {
          screen.getByText('Toggle').click();
        });

        expect(screen.getByTestId('isDark')).toHaveTextContent('true');
      });
    });

    describe('system theme change listener', () => {
      it('should register event listener on mount', () => {
        render(
          <ThemeProvider>
            <TestConsumer />
          </ThemeProvider>
        );

        expect(mockMediaQueryListeners.length).toBe(1);
      });

      it('should update theme when system preference changes and no localStorage saved', () => {
        // Start with no saved theme
        localStorageMock.store = {};
        mockMatchMediaMatches = false;

        render(
          <ThemeProvider>
            <TestConsumer />
          </ThemeProvider>
        );

        expect(screen.getByTestId('theme')).toHaveTextContent('light');

        // Clear the localStorage that was set on initial render
        localStorageMock.store = {};

        // Simulate system theme change to dark
        act(() => {
          mockMediaQueryListeners.forEach(listener => {
            listener({ matches: true });
          });
        });

        expect(screen.getByTestId('theme')).toHaveTextContent('dark');
      });

      it('should not update theme when localStorage has saved theme', () => {
        localStorageMock.store = { theme: 'light' };

        render(
          <ThemeProvider>
            <TestConsumer />
          </ThemeProvider>
        );

        expect(screen.getByTestId('theme')).toHaveTextContent('light');

        // Simulate system theme change to dark
        act(() => {
          mockMediaQueryListeners.forEach(listener => {
            listener({ matches: true });
          });
        });

        // Should remain light because localStorage has preference
        expect(screen.getByTestId('theme')).toHaveTextContent('light');
      });
    });

    describe('children rendering', () => {
      it('should render children', () => {
        render(
          <ThemeProvider>
            <div data-testid="child">Child Content</div>
          </ThemeProvider>
        );

        expect(screen.getByTestId('child')).toHaveTextContent('Child Content');
      });

      it('should render multiple children', () => {
        render(
          <ThemeProvider>
            <div data-testid="child1">First</div>
            <div data-testid="child2">Second</div>
          </ThemeProvider>
        );

        expect(screen.getByTestId('child1')).toBeInTheDocument();
        expect(screen.getByTestId('child2')).toBeInTheDocument();
      });
    });

    describe('context value structure', () => {
      it('should provide all expected values', () => {
        let contextValue;
        render(
          <ThemeProvider>
            <TestConsumer onMount={(ctx) => { contextValue = ctx; }} />
          </ThemeProvider>
        );

        expect(contextValue).toHaveProperty('theme');
        expect(contextValue).toHaveProperty('setTheme');
        expect(contextValue).toHaveProperty('toggleTheme');
        expect(contextValue).toHaveProperty('isDark');
      });

      it('should have setTheme as a function', () => {
        let contextValue;
        render(
          <ThemeProvider>
            <TestConsumer onMount={(ctx) => { contextValue = ctx; }} />
          </ThemeProvider>
        );

        expect(typeof contextValue.setTheme).toBe('function');
      });

      it('should have toggleTheme as a function', () => {
        let contextValue;
        render(
          <ThemeProvider>
            <TestConsumer onMount={(ctx) => { contextValue = ctx; }} />
          </ThemeProvider>
        );

        expect(typeof contextValue.toggleTheme).toBe('function');
      });
    });
  });

  describe('useTheme hook', () => {
    it('should throw error when used outside ThemeProvider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow('useTheme must be used within a ThemeProvider');

      consoleSpy.mockRestore();
    });

    it('should return context when used within ThemeProvider', () => {
      let contextValue;
      render(
        <ThemeProvider>
          <TestConsumer onMount={(ctx) => { contextValue = ctx; }} />
        </ThemeProvider>
      );

      expect(contextValue).toBeDefined();
      expect(contextValue.theme).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle custom theme values', () => {
      localStorageMock.store = { theme: 'custom' };

      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme')).toHaveTextContent('custom');
      expect(screen.getByTestId('isDark')).toHaveTextContent('false');
    });

    it('should handle empty localStorage value', () => {
      localStorageMock.store = { theme: '' };
      mockMatchMediaMatches = true;

      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );

      // Empty string is falsy, so should use system preference
      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    });
  });
});
