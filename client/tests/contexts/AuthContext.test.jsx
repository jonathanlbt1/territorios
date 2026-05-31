import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';

// Use vi.hoisted to create mock functions that can be referenced in vi.mock
const { mockGet, mockPost, mockHeaders } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockHeaders: { common: {} },
}));

vi.mock('../../src/services/api', () => ({
  default: {
    get: mockGet,
    post: mockPost,
    defaults: {
      headers: mockHeaders,
    },
  },
}));

import { AuthProvider, useAuth } from '../../src/contexts/AuthContext';

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

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Test component to access auth context
function TestConsumer({ onMount }) {
  const auth = useAuth();
  if (onMount) {
    onMount(auth);
  }
  return (
    <div>
      <span data-testid="loading">{auth.loading.toString()}</span>
      <span data-testid="user">{auth.user ? JSON.stringify(auth.user) : 'null'}</span>
      <span data-testid="isAdmin">{auth.isAdmin.toString()}</span>
      <span data-testid="isDirigente">{auth.isDirigente.toString()}</span>
      <button onClick={() => auth.login('testuser', 'password')}>Login</button>
      <button onClick={auth.logout}>Logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.store = {};
    // Reset the headers object
    Object.keys(mockHeaders.common).forEach(key => delete mockHeaders.common[key]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('AuthProvider', () => {
    describe('initial state without stored credentials', () => {
      it('should have null user initially', async () => {
        render(
          <AuthProvider>
            <TestConsumer />
          </AuthProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });

        expect(screen.getByTestId('user')).toHaveTextContent('null');
      });

      it('should set loading to false when no stored credentials', async () => {
        render(
          <AuthProvider>
            <TestConsumer />
          </AuthProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });
      });

      it('should have isAdmin as false', async () => {
        render(
          <AuthProvider>
            <TestConsumer />
          </AuthProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });

        expect(screen.getByTestId('isAdmin')).toHaveTextContent('false');
      });

      it('should have isDirigente as false', async () => {
        render(
          <AuthProvider>
            <TestConsumer />
          </AuthProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });

        expect(screen.getByTestId('isDirigente')).toHaveTextContent('false');
      });
    });

    describe('initial state with stored credentials', () => {
      const storedUser = { id: 1, name: 'Test User', role: 'admin' };
      const storedToken = 'stored-token-123';

      beforeEach(() => {
        localStorageMock.store = {
          token: storedToken,
          user: JSON.stringify(storedUser),
        };
      });

      it('should restore user from localStorage', async () => {
        mockGet.mockResolvedValueOnce({ data: storedUser });

        render(
          <AuthProvider>
            <TestConsumer />
          </AuthProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });

        expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(storedUser));
      });

      it('should set Authorization header from stored token', async () => {
        mockGet.mockResolvedValueOnce({ data: storedUser });

        render(
          <AuthProvider>
            <TestConsumer />
          </AuthProvider>
        );

        await waitFor(() => {
          expect(mockHeaders.common['Authorization']).toBe(`Bearer ${storedToken}`);
        });
      });

      it('should verify token by calling /auth/me', async () => {
        mockGet.mockResolvedValueOnce({ data: storedUser });

        render(
          <AuthProvider>
            <TestConsumer />
          </AuthProvider>
        );

        await waitFor(() => {
          expect(mockGet).toHaveBeenCalledWith('/auth/me');
        });
      });

      it('should update user from /auth/me response', async () => {
        const updatedUser = { id: 1, name: 'Updated Name', role: 'admin' };
        mockGet.mockResolvedValueOnce({ data: updatedUser });

        render(
          <AuthProvider>
            <TestConsumer />
          </AuthProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });

        expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(updatedUser));
      });

      it('should update localStorage with fresh user data', async () => {
        const updatedUser = { id: 1, name: 'Updated Name', role: 'admin' };
        mockGet.mockResolvedValueOnce({ data: updatedUser });

        render(
          <AuthProvider>
            <TestConsumer />
          </AuthProvider>
        );

        await waitFor(() => {
          expect(localStorageMock.setItem).toHaveBeenCalledWith('user', JSON.stringify(updatedUser));
        });
      });

      it('should logout if token verification fails', async () => {
        mockGet.mockRejectedValueOnce(new Error('Unauthorized'));

        render(
          <AuthProvider>
            <TestConsumer />
          </AuthProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });

        expect(screen.getByTestId('user')).toHaveTextContent('null');
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('user');
      });

      it('should set loading to false after verification completes', async () => {
        mockGet.mockResolvedValueOnce({ data: storedUser });

        render(
          <AuthProvider>
            <TestConsumer />
          </AuthProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });
      });
    });

    describe('login function', () => {
      it('should call api.post with credentials', async () => {
        const userData = { id: 1, name: 'User', role: 'dirigente' };
        mockPost.mockResolvedValueOnce({
          data: { token: 'new-token', user: userData },
        });

        let authRef;
        render(
          <AuthProvider>
            <TestConsumer onMount={(auth) => { authRef = auth; }} />
          </AuthProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });

        await act(async () => {
          await authRef.login('testuser', 'testpass');
        });

        expect(mockPost).toHaveBeenCalledWith('/auth/login', {
          username: 'testuser',
          password: 'testpass',
        });
      });

      it('should store token in localStorage', async () => {
        const userData = { id: 1, name: 'User', role: 'dirigente' };
        mockPost.mockResolvedValueOnce({
          data: { token: 'new-token-123', user: userData },
        });

        let authRef;
        render(
          <AuthProvider>
            <TestConsumer onMount={(auth) => { authRef = auth; }} />
          </AuthProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });

        await act(async () => {
          await authRef.login('user', 'pass');
        });

        expect(localStorageMock.setItem).toHaveBeenCalledWith('token', 'new-token-123');
      });

      it('should store user in localStorage', async () => {
        const userData = { id: 1, name: 'User', role: 'dirigente' };
        mockPost.mockResolvedValueOnce({
          data: { token: 'token', user: userData },
        });

        let authRef;
        render(
          <AuthProvider>
            <TestConsumer onMount={(auth) => { authRef = auth; }} />
          </AuthProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });

        await act(async () => {
          await authRef.login('user', 'pass');
        });

        expect(localStorageMock.setItem).toHaveBeenCalledWith('user', JSON.stringify(userData));
      });

      it('should set Authorization header', async () => {
        const userData = { id: 1, name: 'User', role: 'dirigente' };
        mockPost.mockResolvedValueOnce({
          data: { token: 'bearer-token', user: userData },
        });

        let authRef;
        render(
          <AuthProvider>
            <TestConsumer onMount={(auth) => { authRef = auth; }} />
          </AuthProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });

        await act(async () => {
          await authRef.login('user', 'pass');
        });

        expect(mockHeaders.common['Authorization']).toBe('Bearer bearer-token');
      });

      it('should update user state', async () => {
        const userData = { id: 1, name: 'New User', role: 'admin' };
        mockPost.mockResolvedValueOnce({
          data: { token: 'token', user: userData },
        });

        let authRef;
        render(
          <AuthProvider>
            <TestConsumer onMount={(auth) => { authRef = auth; }} />
          </AuthProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });

        await act(async () => {
          await authRef.login('user', 'pass');
        });

        expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(userData));
      });

      it('should return user data', async () => {
        const userData = { id: 1, name: 'User', role: 'dirigente' };
        mockPost.mockResolvedValueOnce({
          data: { token: 'token', user: userData },
        });

        let authRef;
        render(
          <AuthProvider>
            <TestConsumer onMount={(auth) => { authRef = auth; }} />
          </AuthProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });

        let result;
        await act(async () => {
          result = await authRef.login('user', 'pass');
        });

        expect(result).toEqual(userData);
      });

      it('should propagate errors', async () => {
        mockPost.mockRejectedValueOnce(new Error('Invalid credentials'));

        let authRef;
        render(
          <AuthProvider>
            <TestConsumer onMount={(auth) => { authRef = auth; }} />
          </AuthProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });

        await expect(
          act(async () => {
            await authRef.login('bad', 'credentials');
          })
        ).rejects.toThrow('Invalid credentials');
      });
    });

    describe('logout function', () => {
      it('should remove token from localStorage', async () => {
        localStorageMock.store = {
          token: 'existing-token',
          user: JSON.stringify({ id: 1, name: 'User', role: 'admin' }),
        };
        mockGet.mockResolvedValueOnce({ data: { id: 1, name: 'User', role: 'admin' } });

        let authRef;
        render(
          <AuthProvider>
            <TestConsumer onMount={(auth) => { authRef = auth; }} />
          </AuthProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });

        act(() => {
          authRef.logout();
        });

        expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
      });

      it('should remove user from localStorage', async () => {
        localStorageMock.store = {
          token: 'existing-token',
          user: JSON.stringify({ id: 1, name: 'User', role: 'admin' }),
        };
        mockGet.mockResolvedValueOnce({ data: { id: 1, name: 'User', role: 'admin' } });

        let authRef;
        render(
          <AuthProvider>
            <TestConsumer onMount={(auth) => { authRef = auth; }} />
          </AuthProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });

        act(() => {
          authRef.logout();
        });

        expect(localStorageMock.removeItem).toHaveBeenCalledWith('user');
      });

      it('should delete Authorization header', async () => {
        mockHeaders.common['Authorization'] = 'Bearer token';

        render(
          <AuthProvider>
            <TestConsumer />
          </AuthProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });

        const logoutButton = screen.getByText('Logout');
        act(() => {
          logoutButton.click();
        });

        expect(mockHeaders.common['Authorization']).toBeUndefined();
      });

      it('should set user to null', async () => {
        localStorageMock.store = {
          token: 'token',
          user: JSON.stringify({ id: 1, name: 'User', role: 'admin' }),
        };
        mockGet.mockResolvedValueOnce({ data: { id: 1, name: 'User', role: 'admin' } });

        let authRef;
        render(
          <AuthProvider>
            <TestConsumer onMount={(auth) => { authRef = auth; }} />
          </AuthProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('user')).not.toHaveTextContent('null');
        });

        act(() => {
          authRef.logout();
        });

        expect(screen.getByTestId('user')).toHaveTextContent('null');
      });
    });

    describe('isAdmin computed property', () => {
      it('should be true when user role is admin', async () => {
        const adminUser = { id: 1, name: 'Admin', role: 'admin' };
        mockPost.mockResolvedValueOnce({
          data: { token: 'token', user: adminUser },
        });

        let authRef;
        render(
          <AuthProvider>
            <TestConsumer onMount={(auth) => { authRef = auth; }} />
          </AuthProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });

        await act(async () => {
          await authRef.login('admin', 'pass');
        });

        expect(screen.getByTestId('isAdmin')).toHaveTextContent('true');
      });

      it('should be false when user role is dirigente', async () => {
        const dirigenteUser = { id: 1, name: 'Dirigente', role: 'dirigente' };
        mockPost.mockResolvedValueOnce({
          data: { token: 'token', user: dirigenteUser },
        });

        let authRef;
        render(
          <AuthProvider>
            <TestConsumer onMount={(auth) => { authRef = auth; }} />
          </AuthProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });

        await act(async () => {
          await authRef.login('dirigente', 'pass');
        });

        expect(screen.getByTestId('isAdmin')).toHaveTextContent('false');
      });
    });

    describe('isDirigente computed property', () => {
      it('should be true when user role is dirigente', async () => {
        const dirigenteUser = { id: 1, name: 'Dirigente', role: 'dirigente' };
        mockPost.mockResolvedValueOnce({
          data: { token: 'token', user: dirigenteUser },
        });

        let authRef;
        render(
          <AuthProvider>
            <TestConsumer onMount={(auth) => { authRef = auth; }} />
          </AuthProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });

        await act(async () => {
          await authRef.login('dirigente', 'pass');
        });

        expect(screen.getByTestId('isDirigente')).toHaveTextContent('true');
      });

      it('should be false when user role is admin', async () => {
        const adminUser = { id: 1, name: 'Admin', role: 'admin' };
        mockPost.mockResolvedValueOnce({
          data: { token: 'token', user: adminUser },
        });

        let authRef;
        render(
          <AuthProvider>
            <TestConsumer onMount={(auth) => { authRef = auth; }} />
          </AuthProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });

        await act(async () => {
          await authRef.login('admin', 'pass');
        });

        expect(screen.getByTestId('isDirigente')).toHaveTextContent('false');
      });
    });

    describe('children rendering', () => {
      it('should render children', async () => {
        render(
          <AuthProvider>
            <div data-testid="child">Child Content</div>
          </AuthProvider>
        );

        expect(screen.getByTestId('child')).toHaveTextContent('Child Content');
      });

      it('should render multiple children', async () => {
        render(
          <AuthProvider>
            <div data-testid="child1">First</div>
            <div data-testid="child2">Second</div>
          </AuthProvider>
        );

        expect(screen.getByTestId('child1')).toBeInTheDocument();
        expect(screen.getByTestId('child2')).toBeInTheDocument();
      });
    });
  });

  describe('useAuth hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleSpy.mockRestore();
    });

    it('should return auth context when used within AuthProvider', async () => {
      let authRef;
      render(
        <AuthProvider>
          <TestConsumer onMount={(auth) => { authRef = auth; }} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(authRef).toBeDefined();
        expect(authRef.user).toBeDefined();
        expect(authRef.login).toBeDefined();
        expect(authRef.logout).toBeDefined();
        expect(authRef.loading).toBeDefined();
        expect(authRef.isAdmin).toBeDefined();
        expect(authRef.isDirigente).toBeDefined();
      });
    });
  });

  describe('edge cases', () => {
    it('should handle missing token with valid user in localStorage', async () => {
      localStorageMock.store = {
        user: JSON.stringify({ id: 1, name: 'User', role: 'admin' }),
      };

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      // Should not set user without token
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('should handle missing user with valid token in localStorage', async () => {
      localStorageMock.store = {
        token: 'valid-token',
      };

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      // Should not verify without user
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('should handle malformed user JSON in localStorage gracefully', async () => {
      localStorageMock.store = {
        token: 'token',
        user: 'not-valid-json',
      };

      // Suppress console.error for JSON parse error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(
          <AuthProvider>
            <TestConsumer />
          </AuthProvider>
        );
      }).toThrow();

      consoleSpy.mockRestore();
    });
  });
});
