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

// Mock authenticateToken middleware
const mockAuthenticateToken = jest.fn((req, res, next) => next());

// Mock requireAdmin middleware
const mockRequireAdmin = jest.fn((req, res, next) => next());

// Mock generateUsername utilities
const mockGenerateUsername = jest.fn((name) => name.toLowerCase().replace(/\s+/g, '.'));
const mockGenerateUniqueUsername = jest.fn((base, attempt) => `${base}${attempt}`);

// Mock modules before importing
jest.unstable_mockModule('../../src/db/config.js', () => ({
  default: mockPool,
}));

jest.unstable_mockModule('bcryptjs', () => ({
  default: mockBcrypt,
}));

jest.unstable_mockModule('../../src/middleware/auth.js', () => ({
  authenticateToken: mockAuthenticateToken,
  requireAdmin: mockRequireAdmin,
}));

jest.unstable_mockModule('../../src/utils/generateUsername.js', () => ({
  generateUsername: mockGenerateUsername,
  generateUniqueUsername: mockGenerateUniqueUsername,
}));

// Import express and create test app
const express = (await import('express')).default;
const { default: usersRouter } = await import('../../src/routes/users.js');

// Create test app
const app = express();
app.use(express.json());
app.use('/users', usersRouter);

// Import supertest for HTTP testing
const request = (await import('supertest')).default;

describe('Users Routes', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Default authenticated admin user
    mockAuthenticateToken.mockImplementation((req, res, next) => {
      req.user = { id: 1, role: 'admin' };
      next();
    });
    mockRequireAdmin.mockImplementation((req, res, next) => next());
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('GET /users', () => {
    describe('authentication and authorization', () => {
      it('should require authentication', async () => {
        mockAuthenticateToken.mockImplementation((req, res) => {
          res.status(401).json({ error: 'Unauthorized' });
        });

        const response = await request(app).get('/users');

        expect(response.status).toBe(401);
      });

      it('should require admin role', async () => {
        mockRequireAdmin.mockImplementation((req, res) => {
          res.status(403).json({ error: 'Forbidden' });
        });

        const response = await request(app).get('/users');

        expect(response.status).toBe(403);
      });
    });

    describe('listing users', () => {
      it('should return all users', async () => {
        const mockUsers = [
          { id: 1, name: 'Admin', username: 'admin', role: 'admin' },
          { id: 2, name: 'João', username: 'joao', role: 'dirigente' },
        ];
        mockPool.query.mockResolvedValue({ rows: mockUsers });

        const response = await request(app).get('/users');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockUsers);
      });

      it('should not return password in response', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/users');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.not.stringContaining('password')
        );
      });

      it('should order by role and name', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/users');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY role, name')
        );
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        mockPool.query.mockRejectedValue(new Error('DB error'));

        const response = await request(app).get('/users');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro ao buscar usuários');
      });
    });
  });

  describe('GET /users/dirigentes', () => {
    it('should return only dirigentes', async () => {
      const mockDirigentes = [
        { id: 2, name: 'João', username: 'joao' },
        { id: 3, name: 'Maria', username: 'maria' },
      ];
      mockPool.query.mockResolvedValue({ rows: mockDirigentes });

      const response = await request(app).get('/users/dirigentes');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockDirigentes);
    });

    it('should filter by dirigente role', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await request(app).get('/users/dirigentes');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("role = 'dirigente'")
      );
    });

    it('should order by name', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app).get('/users/dirigentes');

      expect(response.status).toBe(200);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY name')
      );
    }, 15000);

    it('should return 500 on database error', async () => {
      mockPool.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/users/dirigentes');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Erro ao buscar dirigentes');
    });
  });

  describe('GET /users/assignable', () => {
    it('should require admin role', async () => {
      mockRequireAdmin.mockImplementation((req, res) => {
        res.status(403).json({ error: 'Forbidden' });
      });

      const response = await request(app).get('/users/assignable');

      expect(response.status).toBe(403);
    });

    it('should return dirigentes and admins', async () => {
      const mockUsers = [
        { id: 1, name: 'Admin', role: 'admin' },
        { id: 2, name: 'João', role: 'dirigente' },
      ];
      mockPool.query.mockResolvedValue({ rows: mockUsers });

      const response = await request(app).get('/users/assignable');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUsers);
    });

    it('should filter by dirigente and admin roles', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await request(app).get('/users/assignable');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("role IN ('dirigente', 'admin')")
      );
    });

    it('should order admins first', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await request(app).get('/users/assignable');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("CASE WHEN role = 'admin' THEN 0 ELSE 1 END")
      );
    });
  });

  describe('PUT /users/change-password', () => {
    beforeEach(() => {
      mockAuthenticateToken.mockImplementation((req, res, next) => {
        req.user = { id: 5 };
        next();
      });
    });

    describe('validation', () => {
      it('should return 400 when currentPassword is missing', async () => {
        const response = await request(app)
          .put('/users/change-password')
          .send({ newPassword: 'newpass123' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Senha atual e nova senha são obrigatórias');
      });

      it('should return 400 when newPassword is missing', async () => {
        const response = await request(app)
          .put('/users/change-password')
          .send({ currentPassword: 'oldpass' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Senha atual e nova senha são obrigatórias');
      });

      it('should return 400 when newPassword is too short', async () => {
        const response = await request(app)
          .put('/users/change-password')
          .send({ currentPassword: 'oldpass', newPassword: '12345' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('A nova senha deve ter no mínimo 6 caracteres');
      });
    });

    describe('password verification', () => {
      it('should return 404 when user not found', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        const response = await request(app)
          .put('/users/change-password')
          .send({ currentPassword: 'oldpass', newPassword: 'newpass123' });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Usuário não encontrado');
      });

      it('should return 401 when current password is incorrect', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ password: 'hashedold' }] });
        mockBcrypt.compare.mockResolvedValue(false);

        const response = await request(app)
          .put('/users/change-password')
          .send({ currentPassword: 'wrongpass', newPassword: 'newpass123' });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Senha atual incorreta');
      });
    });

    describe('successful password change', () => {
      beforeEach(() => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ password: 'hashedold' }] })
          .mockResolvedValueOnce({ rows: [{ id: 5, name: 'User', username: 'user', role: 'dirigente' }] });
        mockBcrypt.compare.mockResolvedValue(true);
        mockBcrypt.hash.mockResolvedValue('hashednew');
      });

      it('should change password successfully', async () => {
        const response = await request(app)
          .put('/users/change-password')
          .send({ currentPassword: 'oldpass', newPassword: 'newpass123' });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Senha alterada com sucesso');
        expect(response.body.user).toBeDefined();
      });

      it('should hash new password with bcrypt', async () => {
        await request(app)
          .put('/users/change-password')
          .send({ currentPassword: 'oldpass', newPassword: 'newpass123' });

        expect(mockBcrypt.hash).toHaveBeenCalledWith('newpass123', 10);
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        mockPool.query.mockRejectedValue(new Error('DB error'));

        const response = await request(app)
          .put('/users/change-password')
          .send({ currentPassword: 'old', newPassword: 'newpass123' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro ao alterar senha');
      });
    });
  });

  describe('GET /users/:id', () => {
    it('should return user by id', async () => {
      const mockUser = { id: 2, name: 'João', username: 'joao', role: 'dirigente' };
      mockPool.query.mockResolvedValue({ rows: [mockUser] });

      const response = await request(app).get('/users/2');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUser);
    });

    it('should return 404 when user not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app).get('/users/999');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Usuário não encontrado');
    });

    it('should not return password', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });

      await request(app).get('/users/1');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.not.stringContaining('password'),
        expect.any(Array)
      );
    });

    it('should return 500 on database error', async () => {
      mockPool.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/users/1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Erro ao buscar usuário');
    });
  });

  describe('POST /users', () => {
    describe('validation', () => {
      it('should return 400 when name is missing', async () => {
        const response = await request(app)
          .post('/users')
          .send({ role: 'dirigente' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Nome e função são obrigatórios');
      });

      it('should return 400 when role is missing', async () => {
        const response = await request(app)
          .post('/users')
          .send({ name: 'João' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Nome e função são obrigatórios');
      });

      it('should return 400 for invalid role', async () => {
        const response = await request(app)
          .post('/users')
          .send({ name: 'João', role: 'superuser' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Role inválida');
      });
    });

    describe('username generation', () => {
      beforeEach(() => {
        mockGenerateUsername.mockReturnValue('joao.silva');
        mockBcrypt.hash.mockResolvedValue('hashedpassword');
      });

      it('should generate username from name', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [] }) // username check
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'João Silva', username: 'joao.silva', role: 'dirigente' }] });

        await request(app)
          .post('/users')
          .send({ name: 'João Silva', role: 'dirigente' });

        expect(mockGenerateUsername).toHaveBeenCalledWith('João Silva');
      });

      it('should generate unique username if already exists', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // first check - exists
          .mockResolvedValueOnce({ rows: [] }) // second check - doesn't exist
          .mockResolvedValueOnce({ rows: [{ id: 2 }] }); // insert

        mockGenerateUniqueUsername.mockReturnValue('joao.silva2');

        await request(app)
          .post('/users')
          .send({ name: 'João Silva', role: 'dirigente' });

        expect(mockGenerateUniqueUsername).toHaveBeenCalled();
      });
    });

    describe('successful creation', () => {
      beforeEach(() => {
        mockGenerateUsername.mockReturnValue('joao');
        mockBcrypt.hash.mockResolvedValue('hashedpassword');
        mockPool.query
          .mockResolvedValueOnce({ rows: [] }) // username check
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'João', username: 'joao', role: 'dirigente' }] });
      });

      it('should create user and return 201', async () => {
        const response = await request(app)
          .post('/users')
          .send({ name: 'João', role: 'dirigente' });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('username');
      });

      it('should use default password when not provided', async () => {
        await request(app)
          .post('/users')
          .send({ name: 'João', role: 'dirigente' });

        expect(mockBcrypt.hash).toHaveBeenCalledWith('@Senha123', 10);
      });

      it('should use provided password', async () => {
        await request(app)
          .post('/users')
          .send({ name: 'João', role: 'dirigente', password: 'custompass' });

        expect(mockBcrypt.hash).toHaveBeenCalledWith('custompass', 10);
      });

      it('should accept admin role', async () => {
        mockGenerateUsername.mockReturnValue('admin');
        mockPool.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Admin', username: 'admin', role: 'admin', created_at: new Date() }] });

        const response = await request(app)
          .post('/users')
          .send({ name: 'Admin', role: 'admin' });

        expect(response.status).toBe(201);
      });

      it('should accept dirigente role', async () => {
        const response = await request(app)
          .post('/users')
          .send({ name: 'Dirigente', role: 'dirigente' });

        expect(response.status).toBe(201);
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        mockPool.query.mockReset();
        mockPool.query.mockRejectedValue(new Error('DB error'));
        mockGenerateUsername.mockReturnValue('joao');

        const response = await request(app)
          .post('/users')
          .send({ name: 'João', role: 'dirigente' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro ao criar usuário');
      });
    });
  });

  describe('PUT /users/:id', () => {
    describe('successful update', () => {
      it('should update user without password', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 2, name: 'João Updated', username: 'joao', role: 'dirigente' }],
        });

        const response = await request(app)
          .put('/users/2')
          .send({ name: 'João Updated' });

        expect(response.status).toBe(200);
        expect(response.body.name).toBe('João Updated');
      });

      it('should update user with password', async () => {
        mockBcrypt.hash.mockResolvedValue('newhashed');
        mockPool.query.mockResolvedValue({
          rows: [{ id: 2, name: 'João', username: 'joao', role: 'dirigente' }],
        });

        const response = await request(app)
          .put('/users/2')
          .send({ name: 'João', password: 'newpass' });

        expect(response.status).toBe(200);
        expect(mockBcrypt.hash).toHaveBeenCalledWith('newpass', 10);
      });

      it('should use COALESCE to preserve existing values', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });

        await request(app)
          .put('/users/1')
          .send({ name: 'Updated' });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('COALESCE'),
          expect.any(Array)
        );
      });
    });

    describe('user not found', () => {
      it('should return 404 when user does not exist', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        const response = await request(app)
          .put('/users/999')
          .send({ name: 'Updated' });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Usuário não encontrado');
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        mockPool.query.mockRejectedValue(new Error('DB error'));

        const response = await request(app)
          .put('/users/1')
          .send({ name: 'Updated' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro ao atualizar usuário');
      });
    });
  });

  describe('DELETE /users/:id', () => {
    describe('self-deletion prevention', () => {
      it('should prevent deleting yourself', async () => {
        mockAuthenticateToken.mockImplementation((req, res, next) => {
          req.user = { id: 1, role: 'admin' };
          next();
        });

        const response = await request(app).delete('/users/1');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Você não pode excluir sua própria conta');
      });
    });

    describe('successful deletion', () => {
      beforeEach(() => {
        mockAuthenticateToken.mockImplementation((req, res, next) => {
          req.user = { id: 1, role: 'admin' };
          next();
        });
      });

      it('should delete user successfully', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ id: 2, name: 'João' }] });

        const response = await request(app).delete('/users/2');

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Usuário excluído com sucesso');
      });

      it('should return 404 when user not found', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        const response = await request(app).delete('/users/999');

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Usuário não encontrado');
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        mockPool.query.mockRejectedValue(new Error('DB error'));

        const response = await request(app).delete('/users/2');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro ao excluir usuário');
      });
    });
  });

  describe('GET /users/:id/notifications', () => {
    describe('authorization', () => {
      it('should allow user to see own notifications', async () => {
        mockAuthenticateToken.mockImplementation((req, res, next) => {
          req.user = { id: 5, role: 'dirigente' };
          next();
        });
        mockPool.query.mockResolvedValue({ rows: [] });

        const response = await request(app).get('/users/5/notifications');

        expect(response.status).toBe(200);
      });

      it('should deny non-admin user from seeing other notifications', async () => {
        mockAuthenticateToken.mockImplementation((req, res, next) => {
          req.user = { id: 5, role: 'dirigente' };
          next();
        });

        const response = await request(app).get('/users/10/notifications');

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Acesso não autorizado');
      });

      it('should allow admin to see any notifications', async () => {
        mockAuthenticateToken.mockImplementation((req, res, next) => {
          req.user = { id: 1, role: 'admin' };
          next();
        });
        mockPool.query.mockResolvedValue({ rows: [] });

        const response = await request(app).get('/users/5/notifications');

        expect(response.status).toBe(200);
      });
    });

    describe('listing notifications', () => {
      beforeEach(() => {
        mockAuthenticateToken.mockImplementation((req, res, next) => {
          req.user = { id: 5, role: 'dirigente' };
          next();
        });
      });

      it('should return notifications ordered by date desc', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/users/5/notifications');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY created_at DESC'),
          expect.any(Array)
        );
      });

      it('should limit to 50 notifications', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/users/5/notifications');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('LIMIT 50'),
          expect.any(Array)
        );
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        mockPool.query.mockRejectedValue(new Error('DB error'));

        const response = await request(app).get('/users/1/notifications');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro ao buscar notificações');
      });
    });
  });

  describe('PUT /users/notifications/:notificationId/read', () => {
    beforeEach(() => {
      mockAuthenticateToken.mockImplementation((req, res, next) => {
        req.user = { id: 5 };
        next();
      });
    });

    it('should mark notification as read', async () => {
      const mockNotification = { id: 10, user_id: 5, is_read: true };
      mockPool.query.mockResolvedValue({ rows: [mockNotification] });

      const response = await request(app).put('/users/notifications/10/read');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockNotification);
    });

    it('should only update own notifications', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await request(app).put('/users/notifications/10/read');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('user_id = $2'),
        expect.arrayContaining([5])
      );
    });

    it('should return 404 when notification not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app).put('/users/notifications/999/read');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Notificação não encontrada');
    });

    it('should return 500 on database error', async () => {
      mockPool.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).put('/users/notifications/10/read');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Erro ao marcar notificação como lida');
    });
  });

  describe('PUT /users/notifications/read-all', () => {
    beforeEach(() => {
      mockAuthenticateToken.mockImplementation((req, res, next) => {
        req.user = { id: 5 };
        next();
      });
    });

    it('should mark all notifications as read', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app).put('/users/notifications/read-all');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Todas as notificações foram marcadas como lidas');
    });

    it('should only update own unread notifications', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await request(app).put('/users/notifications/read-all');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('user_id = $1 AND is_read = false'),
        [5]
      );
    });

    it('should return 500 on database error', async () => {
      mockPool.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).put('/users/notifications/read-all');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Erro ao marcar notificações como lidas');
    });
  });

  describe('DELETE /users/notifications/:notificationId', () => {
    beforeEach(() => {
      mockAuthenticateToken.mockImplementation((req, res, next) => {
        req.user = { id: 5 };
        next();
      });
    });

    it('should delete notification successfully', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 10 }] });

      const response = await request(app).delete('/users/notifications/10');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Notificação excluída com sucesso');
    });

    it('should only delete own notifications', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 10 }] });

      await request(app).delete('/users/notifications/10');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('user_id = $2'),
        expect.arrayContaining([5])
      );
    });

    it('should return 404 when notification not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app).delete('/users/notifications/999');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Notificação não encontrada');
    });

    it('should return 500 on database error', async () => {
      mockPool.query.mockRejectedValue(new Error('DB error'));

      const response = await request(app).delete('/users/notifications/10');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Erro ao excluir notificação');
    });
  });

  describe('PUT /users/:id/reset-password', () => {
    describe('self-reset prevention', () => {
      it('should prevent admin from resetting own password', async () => {
        mockAuthenticateToken.mockImplementation((req, res, next) => {
          req.user = { id: 1, role: 'admin' };
          next();
        });

        const response = await request(app).put('/users/1/reset-password');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Use a opção "Alterar Senha" para trocar sua própria senha');
      });
    });

    describe('successful reset', () => {
      beforeEach(() => {
        mockAuthenticateToken.mockImplementation((req, res, next) => {
          req.user = { id: 1, role: 'admin' };
          next();
        });
        mockBcrypt.hash.mockResolvedValue('hasheddefault');
      });

      it('should reset password to default', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 2, name: 'João', username: 'joao', role: 'dirigente' }],
        });

        const response = await request(app).put('/users/2/reset-password');

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Senha resetada para a padrão com sucesso');
        expect(response.body.user).toBeDefined();
      });

      it('should use default password @Senha123', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ id: 2 }] });

        await request(app).put('/users/2/reset-password');

        expect(mockBcrypt.hash).toHaveBeenCalledWith('@Senha123', 10);
      });

      it('should return 404 when user not found', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        const response = await request(app).put('/users/999/reset-password');

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Usuário não encontrado');
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        mockPool.query.mockRejectedValue(new Error('DB error'));

        const response = await request(app).put('/users/2/reset-password');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro ao resetar senha');
      });
    });
  });

  describe('Security', () => {
    it('should use parameterized queries for get user', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });

      await request(app).get('/users/1');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('$1'),
        expect.any(Array)
      );
    });

    it('should use parameterized queries for delete', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 2 }] });

      await request(app).delete('/users/2');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('$1'),
        expect.any(Array)
      );
    });

    it('should hash passwords before storing', async () => {
      mockGenerateUsername.mockReturnValue('joao');
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });
      mockBcrypt.hash.mockResolvedValue('hashed');

      await request(app)
        .post('/users')
        .send({ name: 'João', role: 'dirigente', password: 'plaintext' });

      expect(mockBcrypt.hash).toHaveBeenCalledWith('plaintext', 10);
    });
  });

  describe('Error messages in Portuguese', () => {
    beforeEach(() => {
      mockPool.query.mockRejectedValue(new Error('DB error'));
    });

    it('should return Portuguese error for get users', async () => {
      const response = await request(app).get('/users');
      expect(response.body.error).toMatch(/Erro|buscar|usuários/i);
    });

    it('should return Portuguese error for get dirigentes', async () => {
      const response = await request(app).get('/users/dirigentes');
      expect(response.body.error).toMatch(/Erro|buscar|dirigentes/i);
    });

    it('should return Portuguese error for get user', async () => {
      const response = await request(app).get('/users/1');
      expect(response.body.error).toMatch(/Erro|buscar|usuário/i);
    });

    it('should return Portuguese error for create', async () => {
      mockPool.query.mockReset();
      mockPool.query.mockRejectedValue(new Error('DB error'));
      mockGenerateUsername.mockReturnValue('test');

      const response = await request(app)
        .post('/users')
        .send({ name: 'Test', role: 'dirigente' });
      expect(response.body.error).toMatch(/Erro|criar|usuário/i);
    });

    it('should return Portuguese error for update', async () => {
      const response = await request(app)
        .put('/users/1')
        .send({ name: 'Updated' });
      expect(response.body.error).toMatch(/Erro|atualizar|usuário/i);
    });

    it('should return Portuguese error for delete', async () => {
      const response = await request(app).delete('/users/2');
      expect(response.body.error).toMatch(/Erro|excluir|usuário/i);
    });
  });
});
