import { jest } from '@jest/globals';

// Mock pool
const mockPool = {
  query: jest.fn(),
};

// Mock jwt
const mockJwt = {
  verify: jest.fn(),
};

// Mock modules before importing
jest.unstable_mockModule('../../src/db/config.js', () => ({
  default: mockPool,
}));

jest.unstable_mockModule('jsonwebtoken', () => ({
  default: mockJwt,
}));

// Import after mocking
const { authenticateToken, requireAdmin, requireDirigente } = await import(
  '../../src/middleware/auth.js'
);

describe('Auth Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh mock request object
    mockReq = {
      headers: {},
      user: null,
    };

    // Create mock response object with chainable methods
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Create mock next function
    mockNext = jest.fn();
  });

  describe('authenticateToken', () => {
    describe('token extraction', () => {
      it('should return 401 when no authorization header is present', async () => {
        mockReq.headers = {};

        await authenticateToken(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Token de autenticação não fornecido',
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should return 401 when authorization header is empty', async () => {
        mockReq.headers = { authorization: '' };

        await authenticateToken(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Token de autenticação não fornecido',
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should return 401 when authorization header has no token', async () => {
        mockReq.headers = { authorization: 'Bearer ' };

        await authenticateToken(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Token de autenticação não fornecido',
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should extract token from Bearer authorization header', async () => {
        const testToken = 'valid-jwt-token';
        mockReq.headers = { authorization: `Bearer ${testToken}` };
        mockJwt.verify.mockReturnValue({ userId: 1 });
        mockPool.query.mockResolvedValue({
          rows: [{ id: 1, name: 'Test User', username: 'test', role: 'admin' }],
        });

        await authenticateToken(mockReq, mockRes, mockNext);

        expect(mockJwt.verify).toHaveBeenCalledWith(
          testToken,
          expect.any(String)
        );
      });
    });

    describe('token verification', () => {
      beforeEach(() => {
        mockReq.headers = { authorization: 'Bearer valid-token' };
      });

      it('should return 403 when token is invalid', async () => {
        mockJwt.verify.mockImplementation(() => {
          throw new Error('Invalid token');
        });

        await authenticateToken(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Token inválido ou expirado',
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should return 403 when token is expired', async () => {
        mockJwt.verify.mockImplementation(() => {
          const error = new Error('Token expired');
          error.name = 'TokenExpiredError';
          throw error;
        });

        await authenticateToken(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Token inválido ou expirado',
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should return 403 when token has invalid signature', async () => {
        mockJwt.verify.mockImplementation(() => {
          const error = new Error('Invalid signature');
          error.name = 'JsonWebTokenError';
          throw error;
        });

        await authenticateToken(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Token inválido ou expirado',
        });
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('user lookup', () => {
      beforeEach(() => {
        mockReq.headers = { authorization: 'Bearer valid-token' };
        mockJwt.verify.mockReturnValue({ userId: 123 });
      });

      it('should query database with decoded userId', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 123, name: 'Test', username: 'test', role: 'admin' }],
        });

        await authenticateToken(mockReq, mockRes, mockNext);

        expect(mockPool.query).toHaveBeenCalledWith(
          'SELECT id, name, username, role FROM users WHERE id = $1',
          [123]
        );
      });

      it('should return 401 when user is not found in database', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await authenticateToken(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Usuário não encontrado',
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should return 403 when database query fails', async () => {
        mockPool.query.mockRejectedValue(new Error('Database error'));

        await authenticateToken(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Token inválido ou expirado',
        });
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('successful authentication', () => {
      const mockUser = {
        id: 1,
        name: 'João Silva',
        username: 'joao.silva',
        role: 'admin',
      };

      beforeEach(() => {
        mockReq.headers = { authorization: 'Bearer valid-token' };
        mockJwt.verify.mockReturnValue({ userId: 1 });
        mockPool.query.mockResolvedValue({ rows: [mockUser] });
      });

      it('should set req.user with user data from database', async () => {
        await authenticateToken(mockReq, mockRes, mockNext);

        expect(mockReq.user).toEqual(mockUser);
      });

      it('should call next() on successful authentication', async () => {
        await authenticateToken(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockNext).toHaveBeenCalledWith();
      });

      it('should not send any response on success', async () => {
        await authenticateToken(mockReq, mockRes, mockNext);

        expect(mockRes.status).not.toHaveBeenCalled();
        expect(mockRes.json).not.toHaveBeenCalled();
      });

      it('should work with dirigente role', async () => {
        const dirigenteUser = { ...mockUser, role: 'dirigente' };
        mockPool.query.mockResolvedValue({ rows: [dirigenteUser] });

        await authenticateToken(mockReq, mockRes, mockNext);

        expect(mockReq.user).toEqual(dirigenteUser);
        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('authorization header formats', () => {
      beforeEach(() => {
        mockJwt.verify.mockReturnValue({ userId: 1 });
        mockPool.query.mockResolvedValue({
          rows: [{ id: 1, name: 'Test', username: 'test', role: 'admin' }],
        });
      });

      it('should handle lowercase authorization header', async () => {
        mockReq.headers = { authorization: 'Bearer my-token' };

        await authenticateToken(mockReq, mockRes, mockNext);

        expect(mockJwt.verify).toHaveBeenCalledWith('my-token', expect.any(String));
      });

      it('should only take the second part after split', async () => {
        mockReq.headers = { authorization: 'Bearer token-with-spaces more-stuff' };

        await authenticateToken(mockReq, mockRes, mockNext);

        // Should only get 'token-with-spaces' (second element after split by space)
        expect(mockJwt.verify).toHaveBeenCalledWith(
          'token-with-spaces',
          expect.any(String)
        );
      });
    });
  });

  describe('requireAdmin', () => {
    describe('admin user', () => {
      it('should call next() when user is admin', () => {
        mockReq.user = { id: 1, role: 'admin' };

        requireAdmin(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockNext).toHaveBeenCalledWith();
      });

      it('should not send any response when user is admin', () => {
        mockReq.user = { id: 1, role: 'admin' };

        requireAdmin(mockReq, mockRes, mockNext);

        expect(mockRes.status).not.toHaveBeenCalled();
        expect(mockRes.json).not.toHaveBeenCalled();
      });
    });

    describe('non-admin user', () => {
      it('should return 403 when user is dirigente', () => {
        mockReq.user = { id: 1, role: 'dirigente' };

        requireAdmin(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Acesso restrito a administradores',
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should return 403 when user has unknown role', () => {
        mockReq.user = { id: 1, role: 'unknown' };

        requireAdmin(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Acesso restrito a administradores',
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should return 403 when user has no role', () => {
        mockReq.user = { id: 1 };

        requireAdmin(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Acesso restrito a administradores',
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should return 403 when user role is null', () => {
        mockReq.user = { id: 1, role: null };

        requireAdmin(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Acesso restrito a administradores',
        });
        expect(mockNext).not.toHaveBeenCalled();
      });
    });
  });

  describe('requireDirigente', () => {
    describe('authorized users', () => {
      it('should call next() when user is dirigente', () => {
        mockReq.user = { id: 1, role: 'dirigente' };

        requireDirigente(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockNext).toHaveBeenCalledWith();
      });

      it('should call next() when user is admin', () => {
        mockReq.user = { id: 1, role: 'admin' };

        requireDirigente(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockNext).toHaveBeenCalledWith();
      });

      it('should not send any response when authorized', () => {
        mockReq.user = { id: 1, role: 'dirigente' };

        requireDirigente(mockReq, mockRes, mockNext);

        expect(mockRes.status).not.toHaveBeenCalled();
        expect(mockRes.json).not.toHaveBeenCalled();
      });
    });

    describe('unauthorized users', () => {
      it('should return 403 when user has unknown role', () => {
        mockReq.user = { id: 1, role: 'visitor' };

        requireDirigente(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Acesso não autorizado',
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should return 403 when user has no role', () => {
        mockReq.user = { id: 1 };

        requireDirigente(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Acesso não autorizado',
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should return 403 when user role is null', () => {
        mockReq.user = { id: 1, role: null };

        requireDirigente(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Acesso não autorizado',
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should return 403 when user role is empty string', () => {
        mockReq.user = { id: 1, role: '' };

        requireDirigente(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Acesso não autorizado',
        });
        expect(mockNext).not.toHaveBeenCalled();
      });
    });
  });

  describe('middleware chaining', () => {
    it('should work with authenticateToken followed by requireAdmin', async () => {
      const adminUser = { id: 1, name: 'Admin', username: 'admin', role: 'admin' };
      mockReq.headers = { authorization: 'Bearer valid-token' };
      mockJwt.verify.mockReturnValue({ userId: 1 });
      mockPool.query.mockResolvedValue({ rows: [adminUser] });

      // First middleware
      await authenticateToken(mockReq, mockRes, mockNext);
      expect(mockReq.user).toEqual(adminUser);
      expect(mockNext).toHaveBeenCalled();

      // Reset next for second middleware
      mockNext.mockClear();

      // Second middleware
      requireAdmin(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should work with authenticateToken followed by requireDirigente', async () => {
      const dirigenteUser = {
        id: 2,
        name: 'Dirigente',
        username: 'dirigente',
        role: 'dirigente',
      };
      mockReq.headers = { authorization: 'Bearer valid-token' };
      mockJwt.verify.mockReturnValue({ userId: 2 });
      mockPool.query.mockResolvedValue({ rows: [dirigenteUser] });

      // First middleware
      await authenticateToken(mockReq, mockRes, mockNext);
      expect(mockReq.user).toEqual(dirigenteUser);
      expect(mockNext).toHaveBeenCalled();

      // Reset next for second middleware
      mockNext.mockClear();

      // Second middleware
      requireDirigente(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should block dirigente from admin routes', async () => {
      const dirigenteUser = {
        id: 2,
        name: 'Dirigente',
        username: 'dirigente',
        role: 'dirigente',
      };
      mockReq.headers = { authorization: 'Bearer valid-token' };
      mockJwt.verify.mockReturnValue({ userId: 2 });
      mockPool.query.mockResolvedValue({ rows: [dirigenteUser] });

      // First middleware - should pass
      await authenticateToken(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();

      // Reset for second middleware
      mockNext.mockClear();

      // Second middleware - should block
      requireAdmin(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('error message consistency', () => {
    it('should use Portuguese error messages', async () => {
      // No token
      mockReq.headers = {};
      await authenticateToken(mockReq, mockRes, mockNext);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringMatching(/Token|autenticação/),
        })
      );

      // Reset
      mockRes.json.mockClear();
      mockRes.status.mockClear();

      // Invalid token
      mockReq.headers = { authorization: 'Bearer invalid' };
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid');
      });
      await authenticateToken(mockReq, mockRes, mockNext);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringMatching(/Token|inválido|expirado/),
        })
      );

      // Reset
      mockRes.json.mockClear();
      mockRes.status.mockClear();

      // User not found
      mockJwt.verify.mockReturnValue({ userId: 999 });
      mockPool.query.mockResolvedValue({ rows: [] });
      await authenticateToken(mockReq, mockRes, mockNext);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringMatching(/Usuário|encontrado/),
        })
      );
    });

    it('should use consistent error format with error key', async () => {
      mockReq.headers = {};
      await authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
        })
      );
    });
  });

  describe('security considerations', () => {
    it('should not expose user password in req.user', async () => {
      const userWithPassword = {
        id: 1,
        name: 'Test',
        username: 'test',
        role: 'admin',
        password: 'hashed-password',
      };
      mockReq.headers = { authorization: 'Bearer valid-token' };
      mockJwt.verify.mockReturnValue({ userId: 1 });
      // Note: The actual query only selects id, name, username, role
      // This test verifies the SQL query doesn't include password
      mockPool.query.mockResolvedValue({ rows: [userWithPassword] });

      await authenticateToken(mockReq, mockRes, mockNext);

      // Verify the query doesn't select password
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, name, username, role FROM users'),
        expect.any(Array)
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.not.stringContaining('password'),
        expect.any(Array)
      );
    });

    it('should use parameterized queries to prevent SQL injection', async () => {
      mockReq.headers = { authorization: 'Bearer valid-token' };
      mockJwt.verify.mockReturnValue({ userId: "1; DROP TABLE users;--" });
      mockPool.query.mockResolvedValue({ rows: [] });

      await authenticateToken(mockReq, mockRes, mockNext);

      // Verify parameterized query is used
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('$1'),
        ["1; DROP TABLE users;--"]
      );
    });
  });
});
