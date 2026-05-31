import { jest } from '@jest/globals';

// Mock pool
const mockPool = {
  query: jest.fn(),
};

// Mock bcrypt
const mockBcrypt = {
  compare: jest.fn(),
  hash: jest.fn(),
};

// Mock jwt
const mockJwt = {
  sign: jest.fn(),
};

// Mock authenticateToken middleware
const mockAuthenticateToken = jest.fn((req, res, next) => next());

// Mock modules before importing
jest.unstable_mockModule('../../src/db/config.js', () => ({
  default: mockPool,
}));

jest.unstable_mockModule('bcryptjs', () => ({
  default: mockBcrypt,
}));

jest.unstable_mockModule('jsonwebtoken', () => ({
  default: mockJwt,
}));

jest.unstable_mockModule('../../src/middleware/auth.js', () => ({
  authenticateToken: mockAuthenticateToken,
}));

// Import express and create test app
const express = (await import('express')).default;
const { default: authRouter } = await import('../../src/routes/auth.js');

// Create test app
const app = express();
app.use(express.json());
app.use('/auth', authRouter);

// Import supertest for HTTP testing
const request = (await import('supertest')).default;

describe('Auth Routes', () => {
  let consoleSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('POST /auth/login', () => {
    describe('validation', () => {
      it('should return 400 when username is missing', async () => {
        const response = await request(app)
          .post('/auth/login')
          .send({ password: 'secret' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Usuário e senha são obrigatórios');
      });

      it('should return 400 when password is missing', async () => {
        const response = await request(app)
          .post('/auth/login')
          .send({ username: 'admin' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Usuário e senha são obrigatórios');
      });

      it('should return 400 when both username and password are missing', async () => {
        const response = await request(app)
          .post('/auth/login')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Usuário e senha são obrigatórios');
      });
    });

    describe('authentication', () => {
      it('should return 401 when user not found', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        const response = await request(app)
          .post('/auth/login')
          .send({ username: 'nonexistent', password: 'secret' });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Credenciais inválidas');
      });

      it('should return 401 when password is incorrect', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 1, username: 'admin', password: 'hashed', role: 'admin' }],
        });
        mockBcrypt.compare.mockResolvedValue(false);

        const response = await request(app)
          .post('/auth/login')
          .send({ username: 'admin', password: 'wrong' });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Credenciais inválidas');
      });

      it('should convert username to lowercase', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app)
          .post('/auth/login')
          .send({ username: 'ADMIN', password: 'secret' });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.any(String),
          ['admin']
        );
      });
    });

    describe('successful login', () => {
      const mockUser = {
        id: 1,
        name: 'Admin User',
        username: 'admin',
        password: 'hashedpassword',
        role: 'admin',
      };

      beforeEach(() => {
        mockPool.query.mockResolvedValue({ rows: [mockUser] });
        mockBcrypt.compare.mockResolvedValue(true);
        mockJwt.sign.mockReturnValue('mock-jwt-token');
      });

      it('should return token and user data on successful login', async () => {
        const response = await request(app)
          .post('/auth/login')
          .send({ username: 'admin', password: 'correct' });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('token', 'mock-jwt-token');
        expect(response.body).toHaveProperty('user');
        expect(response.body.user).toEqual({
          id: 1,
          name: 'Admin User',
          username: 'admin',
          role: 'admin',
        });
      });

      it('should not include password in response', async () => {
        const response = await request(app)
          .post('/auth/login')
          .send({ username: 'admin', password: 'correct' });

        expect(response.body.user).not.toHaveProperty('password');
      });

      it('should sign JWT with correct payload', async () => {
        await request(app)
          .post('/auth/login')
          .send({ username: 'admin', password: 'correct' });

        expect(mockJwt.sign).toHaveBeenCalledWith(
          { userId: 1, role: 'admin' },
          expect.any(String),
          { expiresIn: expect.any(String) }
        );
      });

      it('should compare password with bcrypt', async () => {
        await request(app)
          .post('/auth/login')
          .send({ username: 'admin', password: 'mypassword' });

        expect(mockBcrypt.compare).toHaveBeenCalledWith('mypassword', 'hashedpassword');
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        mockPool.query.mockRejectedValue(new Error('DB error'));

        const response = await request(app)
          .post('/auth/login')
          .send({ username: 'admin', password: 'secret' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro interno do servidor');
      });

      it('should log error on database failure', async () => {
        const error = new Error('DB error');
        mockPool.query.mockRejectedValue(error);

        await request(app)
          .post('/auth/login')
          .send({ username: 'admin', password: 'secret' });

        expect(consoleSpy).toHaveBeenCalledWith('Login error:', error);
      });
    });
  });

  describe('GET /auth/me', () => {
    beforeEach(() => {
      mockAuthenticateToken.mockImplementation((req, res, next) => {
        req.user = { id: 1 };
        next();
      });
    });

    it('should return current user data', async () => {
      const mockUser = {
        id: 1,
        name: 'João Silva',
        username: 'joao',
        role: 'dirigente',
        created_at: '2024-01-01',
      };
      mockPool.query.mockResolvedValue({ rows: [mockUser] });

      const response = await request(app).get('/auth/me');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUser);
    });

    it('should query with authenticated user id', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });

      await request(app).get('/auth/me');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, name, username, role, created_at'),
        [1]
      );
    });

    it('should not return password', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });

      await request(app).get('/auth/me');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.not.stringContaining('password'),
        expect.any(Array)
      );
    });

    it('should return 404 when user not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app).get('/auth/me');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Usuário não encontrado');
    });

    it('should return 500 on database error', async () => {
      mockPool.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/auth/me');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Erro interno do servidor');
    });

    it('should require authentication', async () => {
      mockAuthenticateToken.mockImplementation((req, res, next) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app).get('/auth/me');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /auth/change-password', () => {
    beforeEach(() => {
      mockAuthenticateToken.mockImplementation((req, res, next) => {
        req.user = { id: 1 };
        next();
      });
    });

    describe('validation', () => {
      it('should return 400 when currentPassword is missing', async () => {
        const response = await request(app)
          .put('/auth/change-password')
          .send({ newPassword: 'newpass' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Senhas atual e nova são obrigatórias');
      });

      it('should return 400 when newPassword is missing', async () => {
        const response = await request(app)
          .put('/auth/change-password')
          .send({ currentPassword: 'oldpass' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Senhas atual e nova são obrigatórias');
      });

      it('should return 400 when both passwords are missing', async () => {
        const response = await request(app)
          .put('/auth/change-password')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Senhas atual e nova são obrigatórias');
      });
    });

    describe('password verification', () => {
      it('should return 401 when current password is incorrect', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ password: 'hashedold' }] });
        mockBcrypt.compare.mockResolvedValue(false);

        const response = await request(app)
          .put('/auth/change-password')
          .send({ currentPassword: 'wrong', newPassword: 'newpass' });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Senha atual incorreta');
      });

      it('should verify current password with bcrypt', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ password: 'hashedold' }] });
        mockBcrypt.compare.mockResolvedValue(false);

        await request(app)
          .put('/auth/change-password')
          .send({ currentPassword: 'oldpass', newPassword: 'newpass' });

        expect(mockBcrypt.compare).toHaveBeenCalledWith('oldpass', 'hashedold');
      });
    });

    describe('successful password change', () => {
      beforeEach(() => {
        mockPool.query.mockResolvedValue({ rows: [{ password: 'hashedold' }] });
        mockBcrypt.compare.mockResolvedValue(true);
        mockBcrypt.hash.mockResolvedValue('hashednew');
      });

      it('should change password successfully', async () => {
        const response = await request(app)
          .put('/auth/change-password')
          .send({ currentPassword: 'oldpass', newPassword: 'newpass' });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Senha alterada com sucesso');
      });

      it('should hash new password with bcrypt', async () => {
        await request(app)
          .put('/auth/change-password')
          .send({ currentPassword: 'oldpass', newPassword: 'newpass' });

        expect(mockBcrypt.hash).toHaveBeenCalledWith('newpass', 10);
      });

      it('should update password in database', async () => {
        await request(app)
          .put('/auth/change-password')
          .send({ currentPassword: 'oldpass', newPassword: 'newpass' });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE users SET password'),
          ['hashednew', 1]
        );
      });

      it('should update timestamp when changing password', async () => {
        await request(app)
          .put('/auth/change-password')
          .send({ currentPassword: 'oldpass', newPassword: 'newpass' });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('updated_at = CURRENT_TIMESTAMP'),
          expect.any(Array)
        );
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        mockPool.query.mockRejectedValue(new Error('DB error'));

        const response = await request(app)
          .put('/auth/change-password')
          .send({ currentPassword: 'old', newPassword: 'new' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro interno do servidor');
      });

      it('should log error on failure', async () => {
        const error = new Error('DB error');
        mockPool.query.mockRejectedValue(error);

        await request(app)
          .put('/auth/change-password')
          .send({ currentPassword: 'old', newPassword: 'new' });

        expect(consoleSpy).toHaveBeenCalledWith('Change password error:', error);
      });
    });

    it('should require authentication', async () => {
      mockAuthenticateToken.mockImplementation((req, res, next) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app)
        .put('/auth/change-password')
        .send({ currentPassword: 'old', newPassword: 'new' });

      expect(response.status).toBe(401);
    });
  });

  describe('Security', () => {
    it('should use parameterized queries for login', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await request(app)
        .post('/auth/login')
        .send({ username: "admin'; DROP TABLE users;--", password: 'test' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('$1'),
        ["admin'; drop table users;--"]
      );
    });

    it('should use parameterized queries for me endpoint', async () => {
      mockAuthenticateToken.mockImplementation((req, res, next) => {
        req.user = { id: 1 };
        next();
      });
      mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });

      await request(app).get('/auth/me');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('$1'),
        [1]
      );
    });

    it('should use parameterized queries for password change', async () => {
      mockAuthenticateToken.mockImplementation((req, res, next) => {
        req.user = { id: 1 };
        next();
      });
      mockPool.query.mockResolvedValue({ rows: [{ password: 'hash' }] });
      mockBcrypt.compare.mockResolvedValue(true);
      mockBcrypt.hash.mockResolvedValue('newhash');

      await request(app)
        .put('/auth/change-password')
        .send({ currentPassword: 'old', newPassword: 'new' });

      // Both SELECT and UPDATE should use parameterized queries
      expect(mockPool.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('$1'),
        [1]
      );
      expect(mockPool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('$1'),
        expect.any(Array)
      );
    });
  });

  describe('Error messages in Portuguese', () => {
    it('should return Portuguese error for missing credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({});

      expect(response.body.error).toMatch(/Usuário|senha|obrigatórios/i);
    });

    it('should return Portuguese error for invalid credentials', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/auth/login')
        .send({ username: 'test', password: 'test' });

      expect(response.body.error).toMatch(/Credenciais|inválidas/i);
    });

    it('should return Portuguese error for user not found', async () => {
      mockAuthenticateToken.mockImplementation((req, res, next) => {
        req.user = { id: 999 };
        next();
      });
      mockPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app).get('/auth/me');

      expect(response.body.error).toMatch(/Usuário|encontrado/i);
    });

    it('should return Portuguese error for wrong current password', async () => {
      mockAuthenticateToken.mockImplementation((req, res, next) => {
        req.user = { id: 1 };
        next();
      });
      mockPool.query.mockResolvedValue({ rows: [{ password: 'hash' }] });
      mockBcrypt.compare.mockResolvedValue(false);

      const response = await request(app)
        .put('/auth/change-password')
        .send({ currentPassword: 'wrong', newPassword: 'new' });

      expect(response.body.error).toMatch(/Senha|atual|incorreta/i);
    });

    it('should return Portuguese success message for password change', async () => {
      mockAuthenticateToken.mockImplementation((req, res, next) => {
        req.user = { id: 1 };
        next();
      });
      mockPool.query.mockResolvedValue({ rows: [{ password: 'hash' }] });
      mockBcrypt.compare.mockResolvedValue(true);
      mockBcrypt.hash.mockResolvedValue('newhash');

      const response = await request(app)
        .put('/auth/change-password')
        .send({ currentPassword: 'old', newPassword: 'new' });

      expect(response.body.message).toMatch(/Senha|alterada|sucesso/i);
    });
  });
});
