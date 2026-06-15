import { jest } from '@jest/globals';

// Mock pool
const mockPool = {
  query: jest.fn(),
};

// Mock fs module
const mockFs = {
  readdirSync: jest.fn(),
  existsSync: jest.fn(),
  unlinkSync: jest.fn(),
};

// Mock authenticateToken middleware
const mockAuthenticateToken = jest.fn((req, res, next) => next());

// Mock requireAdmin middleware
const mockRequireAdmin = jest.fn((req, res, next) => next());

// Mock multer
const mockMulter = jest.fn(() => ({
  single: jest.fn(() => (req, res, next) => {
    // Simulate file upload based on request
    if (req.headers['x-mock-file']) {
      req.file = {
        filename: req.headers['x-mock-filename'] || 'uploaded.png',
        originalname: 'test.png',
        mimetype: 'image/png',
      };
    }
    next();
  }),
}));
mockMulter.diskStorage = jest.fn(() => ({}));

// Mock modules before importing
jest.unstable_mockModule('../../src/db/config.js', () => ({
  default: mockPool,
}));

jest.unstable_mockModule('fs', () => ({
  default: mockFs,
  ...mockFs,
}));

jest.unstable_mockModule('../../src/middleware/auth.js', () => ({
  authenticateToken: mockAuthenticateToken,
  requireAdmin: mockRequireAdmin,
}));

jest.unstable_mockModule('multer', () => ({
  default: mockMulter,
}));

// Import express and create test app
const express = (await import('express')).default;
const { default: territoriesRouter } = await import('../../src/routes/territories.js');

// Create test app
const app = express();
app.use(express.json());
app.use('/territories', territoriesRouter);

// Import supertest for HTTP testing
const request = (await import('supertest')).default;

describe('Territories Routes', () => {
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

  describe('GET /territories', () => {
    describe('authentication', () => {
      it('should require authentication', async () => {
        mockAuthenticateToken.mockImplementation((req, res, next) => {
          res.status(401).json({ error: 'Unauthorized' });
        });

        const response = await request(app).get('/territories');

        expect(response.status).toBe(401);
      });
    });

    describe('listing territories', () => {
      it('should return all territories', async () => {
        const mockTerritories = [
          { id: 1, territory_number: 1, locality: 'Centro', is_assigned: false },
          { id: 2, territory_number: 2, locality: 'Norte', is_assigned: true },
        ];
        mockPool.query.mockResolvedValue({ rows: mockTerritories });

        const response = await request(app).get('/territories');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockTerritories);
      });

      it('should order by territory_number ASC', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/territories');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY t.territory_number ASC')
        );
      });

      it('should include is_assigned status', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/territories');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('is_assigned')
        );
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        mockPool.query.mockRejectedValue(new Error('DB error'));

        const response = await request(app).get('/territories');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro ao buscar territórios');
      });

      it('should log error on failure', async () => {
        const error = new Error('Query failed');
        mockPool.query.mockRejectedValue(error);

        await request(app).get('/territories');

        expect(consoleErrorSpy).toHaveBeenCalledWith('Get territories error:', error);
      });
    });
  });

  describe('GET /territories/png-files', () => {
    describe('authentication and authorization', () => {
      it('should require authentication', async () => {
        mockAuthenticateToken.mockImplementation((req, res, next) => {
          res.status(401).json({ error: 'Unauthorized' });
        });

        const response = await request(app).get('/territories/png-files');

        expect(response.status).toBe(401);
      });

      it('should require admin role', async () => {
        mockRequireAdmin.mockImplementation((req, res, next) => {
          res.status(403).json({ error: 'Forbidden' });
        });

        const response = await request(app).get('/territories/png-files');

        expect(response.status).toBe(403);
      });
    });

    describe('listing PNG files', () => {
      it('should return only PNG files', async () => {
        mockFs.readdirSync.mockReturnValue([
          'ter_1.png',
          'ter_2.png',
          'readme.txt',
          'config.json',
        ]);

        const response = await request(app).get('/territories/png-files');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(['ter_1.png', 'ter_2.png']);
      });

      it('should sort files by number', async () => {
        mockFs.readdirSync.mockReturnValue([
          'ter_10.png',
          'ter_2.png',
          'ter_1.png',
        ]);

        const response = await request(app).get('/territories/png-files');

        expect(response.body).toEqual(['ter_1.png', 'ter_2.png', 'ter_10.png']);
      });

      it('should handle files without numbers', async () => {
        mockFs.readdirSync.mockReturnValue([
          'ter_geral.png',
          'ter_1.png',
        ]);

        const response = await request(app).get('/territories/png-files');

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(2);
      });

      it('should return empty array when no PNG files', async () => {
        mockFs.readdirSync.mockReturnValue(['readme.txt']);

        const response = await request(app).get('/territories/png-files');

        expect(response.body).toEqual([]);
      });
    });

    describe('error handling', () => {
      it('should return 500 on filesystem error', async () => {
        mockFs.readdirSync.mockImplementation(() => {
          throw new Error('ENOENT');
        });

        const response = await request(app).get('/territories/png-files');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro ao listar arquivos PNG');
      });
    });
  });

  describe('POST /territories/upload-png', () => {
    describe('authentication and authorization', () => {
      it('should require admin role', async () => {
        mockRequireAdmin.mockImplementation((req, res, next) => {
          res.status(403).json({ error: 'Forbidden' });
        });

        const response = await request(app).post('/territories/upload-png');

        expect(response.status).toBe(403);
      });
    });

    describe('file upload', () => {
      it('should return 400 when no file uploaded', async () => {
        const response = await request(app).post('/territories/upload-png');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Nenhum arquivo enviado');
      });

      it('should return success when file uploaded', async () => {
        const response = await request(app)
          .post('/territories/upload-png')
          .set('x-mock-file', 'true')
          .set('x-mock-filename', 'ter_new.png');

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Arquivo enviado com sucesso');
        expect(response.body.filename).toBe('ter_new.png');
      });
    });
  });

  describe('DELETE /territories/png-files/:filename', () => {
    describe('authentication and authorization', () => {
      it('should require admin role', async () => {
        mockRequireAdmin.mockImplementation((req, res, next) => {
          res.status(403).json({ error: 'Forbidden' });
        });

        const response = await request(app).delete('/territories/png-files/test.png');

        expect(response.status).toBe(403);
      });
    });

    describe('file deletion', () => {
      it('should return 400 if file is in use by territory', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });

        const response = await request(app).delete('/territories/png-files/ter_1.png');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Este arquivo está em uso por um território e não pode ser excluído');
      });

      it('should return 404 if file does not exist', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });
        mockFs.existsSync.mockReturnValue(false);

        const response = await request(app).delete('/territories/png-files/nonexistent.png');

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Arquivo não encontrado');
      });

      it('should delete file successfully', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });
        mockFs.existsSync.mockReturnValue(true);
        mockFs.unlinkSync.mockReturnValue(undefined);

        const response = await request(app).delete('/territories/png-files/unused.png');

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Arquivo excluído com sucesso');
        expect(mockFs.unlinkSync).toHaveBeenCalled();
      });

      it('should check file usage in database', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });
        mockFs.existsSync.mockReturnValue(true);
        mockFs.unlinkSync.mockReturnValue(undefined);

        await request(app).delete('/territories/png-files/test.png');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT id FROM territories WHERE map_filename = $1'),
          ['test.png']
        );
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        mockPool.query.mockRejectedValue(new Error('DB error'));

        const response = await request(app).delete('/territories/png-files/test.png');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro ao excluir arquivo');
      });
    });
  });

  describe('GET /territories/available', () => {
    describe('listing available territories', () => {
      it('should return territories not assigned', async () => {
        const mockTerritories = [
          { id: 3, territory_number: 3, locality: 'Sul' },
          { id: 5, territory_number: 5, locality: 'Leste' },
        ];
        mockPool.query.mockResolvedValue({ rows: mockTerritories });

        const response = await request(app).get('/territories/available');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockTerritories);
      });

      it('should exclude territories with pending/in_progress/returned assignments', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/territories/available');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining("('pending', 'in_progress', 'returned')")
        );
      });

      it('should order by last_worked_date NULLS FIRST then territory_number', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/territories/available');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY t.last_worked_date ASC NULLS FIRST, t.territory_number ASC')
        );
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        mockPool.query.mockRejectedValue(new Error('DB error'));

        const response = await request(app).get('/territories/available');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro ao buscar territórios disponíveis');
      });
    });
  });

  describe('GET /territories/:id', () => {
    describe('getting single territory', () => {
      it('should return territory by id', async () => {
        const mockTerritory = { id: 1, territory_number: 1, locality: 'Centro' };
        mockPool.query.mockResolvedValue({ rows: [mockTerritory] });

        const response = await request(app).get('/territories/1');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockTerritory);
      });

      it('should return 404 when territory not found', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        const response = await request(app).get('/territories/999');

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Território não encontrado');
      });

      it('should query with correct id parameter', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ id: 5 }] });

        await request(app).get('/territories/5');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('WHERE id = $1'),
          ['5']
        );
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        mockPool.query.mockRejectedValue(new Error('DB error'));

        const response = await request(app).get('/territories/1');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro ao buscar território');
      });
    });
  });

  describe('POST /territories', () => {
    describe('authentication and authorization', () => {
      it('should require admin role', async () => {
        mockRequireAdmin.mockImplementation((req, res, next) => {
          res.status(403).json({ error: 'Forbidden' });
        });

        const response = await request(app)
          .post('/territories')
          .send({ territory_number: 1, locality: 'Centro', block_count: 5 });

        expect(response.status).toBe(403);
      });
    });

    describe('validation', () => {
      it('should return 400 when territory_number is missing', async () => {
        const response = await request(app)
          .post('/territories')
          .send({ locality: 'Centro', block_count: 5 });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Dados obrigatórios não fornecidos');
      });

      it('should return 400 when locality is missing', async () => {
        const response = await request(app)
          .post('/territories')
          .send({ territory_number: 1, block_count: 5 });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Dados obrigatórios não fornecidos');
      });

      it('should return 400 when block_count is missing', async () => {
        const response = await request(app)
          .post('/territories')
          .send({ territory_number: 1, locality: 'Centro' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Dados obrigatórios não fornecidos');
      });
    });

    describe('successful creation', () => {
      it('should create territory and return 201', async () => {
        const newTerritory = {
          id: 1,
          territory_number: 1,
          territory_code: 'ter_1',
          locality: 'Centro',
          block_count: 5,
        };
        mockPool.query.mockResolvedValue({ rows: [newTerritory] });

        const response = await request(app)
          .post('/territories')
          .send({ territory_number: 1, locality: 'Centro', block_count: 5 });

        expect(response.status).toBe(201);
        expect(response.body).toEqual(newTerritory);
      });

      it('should generate territory_code from number', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });

        await request(app)
          .post('/territories')
          .send({ territory_number: 42, locality: 'Norte', block_count: 3 });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining(['ter_42'])
        );
      });

      it('should use default map_filename if not provided', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });

        await request(app)
          .post('/territories')
          .send({ territory_number: 5, locality: 'Sul', block_count: 2 });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining(['ter_5.png'])
        );
      });

      it('should use provided map_filename', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });

        await request(app)
          .post('/territories')
          .send({
            territory_number: 5,
            locality: 'Sul',
            block_count: 2,
            map_filename: 'custom_map.png',
          });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining(['custom_map.png'])
        );
      });
    });

    describe('duplicate territory', () => {
      it('should return 400 for duplicate territory', async () => {
        const error = new Error('Duplicate');
        error.code = '23505';
        mockPool.query.mockRejectedValue(error);

        const response = await request(app)
          .post('/territories')
          .send({ territory_number: 1, locality: 'Centro', block_count: 5 });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Território já existe');
      });
    });

    describe('error handling', () => {
      it('should return 500 on other database errors', async () => {
        mockPool.query.mockRejectedValue(new Error('DB error'));

        const response = await request(app)
          .post('/territories')
          .send({ territory_number: 1, locality: 'Centro', block_count: 5 });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro ao criar território');
      });
    });
  });

  describe('PUT /territories/:id', () => {
    describe('authentication and authorization', () => {
      it('should require admin role', async () => {
        mockRequireAdmin.mockImplementation((req, res, next) => {
          res.status(403).json({ error: 'Forbidden' });
        });

        const response = await request(app)
          .put('/territories/1')
          .send({ locality: 'Updated' });

        expect(response.status).toBe(403);
      });
    });

    describe('successful update', () => {
      it('should update territory', async () => {
        const updatedTerritory = { id: 1, locality: 'Updated Centro', block_count: 10 };
        mockPool.query.mockResolvedValue({ rows: [updatedTerritory] });

        const response = await request(app)
          .put('/territories/1')
          .send({ locality: 'Updated Centro', block_count: 10 });

        expect(response.status).toBe(200);
        expect(response.body).toEqual(updatedTerritory);
      });

      it('should use COALESCE to preserve existing values', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });

        await request(app)
          .put('/territories/1')
          .send({ locality: 'New Locality' });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('COALESCE'),
          expect.any(Array)
        );
      });

      it('should update timestamp', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });

        await request(app)
          .put('/territories/1')
          .send({ locality: 'Updated' });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('updated_at = CURRENT_TIMESTAMP'),
          expect.any(Array)
        );
      });
    });

    describe('territory not found', () => {
      it('should return 404 when territory does not exist', async () => {
        mockPool.query.mockReset();
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .put('/territories/999')
          .send({ locality: 'Updated' });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Território não encontrado');
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        mockPool.query.mockRejectedValue(new Error('DB error'));

        const response = await request(app)
          .put('/territories/1')
          .send({ locality: 'Updated' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro ao atualizar território');
      });
    });
  });

  describe('DELETE /territories/:id', () => {
    describe('authentication and authorization', () => {
      it('should require admin role', async () => {
        mockRequireAdmin.mockImplementation((req, res, next) => {
          res.status(403).json({ error: 'Forbidden' });
        });

        const response = await request(app).delete('/territories/1');

        expect(response.status).toBe(403);
      });
    });

    describe('active assignments check', () => {
      it('should return 400 if territory has active assignments', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [{ id: 5 }] }); // active assignment found

        const response = await request(app).delete('/territories/1');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Não é possível excluir um território com designações ativas');
      });

      it('should check for pending, in_progress, and returned assignments', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [] }) // no active assignments
          .mockResolvedValueOnce({ rows: [] }) // delete history
          .mockResolvedValueOnce({ rows: [] }) // delete assignments
          .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // delete territory

        await request(app).delete('/territories/1');

        expect(mockPool.query).toHaveBeenNthCalledWith(
          1,
          expect.stringContaining("('pending', 'in_progress', 'returned')"),
          expect.any(Array)
        );
      });
    });

    describe('successful deletion', () => {
      it('should delete territory and related records', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [] }) // no active assignments
          .mockResolvedValueOnce({ rows: [] }) // delete history
          .mockResolvedValueOnce({ rows: [] }) // delete assignments
          .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // delete territory

        const response = await request(app).delete('/territories/1');

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Território excluído com sucesso');
      });

      it('should delete territory_history first', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ id: 1 }] });

        await request(app).delete('/territories/1');

        expect(mockPool.query).toHaveBeenNthCalledWith(
          2,
          expect.stringContaining('DELETE FROM territory_history'),
          ['1']
        );
      });

      it('should delete assignments before territory', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ id: 1 }] });

        await request(app).delete('/territories/1');

        expect(mockPool.query).toHaveBeenNthCalledWith(
          3,
          expect.stringContaining('DELETE FROM assignments'),
          ['1']
        );
      });
    });

    describe('territory not found', () => {
      it('should return 404 when territory does not exist', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [] }) // no active assignments
          .mockResolvedValueOnce({ rows: [] }) // delete history
          .mockResolvedValueOnce({ rows: [] }) // delete assignments
          .mockResolvedValueOnce({ rows: [] }); // territory not found

        const response = await request(app).delete('/territories/999');

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Território não encontrado');
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        mockPool.query.mockRejectedValue(new Error('DB error'));

        const response = await request(app).delete('/territories/1');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro ao excluir território');
      });
    });
  });

  describe('GET /territories/:id/history', () => {
    describe('getting territory history', () => {
      it('should return territory history', async () => {
        const mockHistory = [
          { id: 1, territory_id: 1, worked_date: '2024-01-01', territory_code: 'ter_1' },
          { id: 2, territory_id: 1, worked_date: '2024-02-01', territory_code: 'ter_1' },
        ];
        mockPool.query.mockResolvedValue({ rows: mockHistory });

        const response = await request(app).get('/territories/1/history');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockHistory);
      });

      it('should query with correct territory_id', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/territories/5/history');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('WHERE th.territory_id = $1'),
          ['5']
        );
      });

      it('should order by worked_date DESC', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/territories/1/history');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY th.worked_date DESC'),
          expect.any(Array)
        );
      });

      it('should join with territories table', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/territories/1/history');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('JOIN territories t ON t.id = th.territory_id'),
          expect.any(Array)
        );
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        mockPool.query.mockRejectedValue(new Error('DB error'));

        const response = await request(app).get('/territories/1/history');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro ao buscar histórico do território');
      });
    });
  });

  describe('Security', () => {
    it('should use parameterized queries for get single territory', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });

      await request(app).get('/territories/1');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('$1'),
        expect.any(Array)
      );
    });

    it('should use parameterized queries for delete PNG file check', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      mockFs.existsSync.mockReturnValue(false);

      await request(app).delete('/territories/png-files/test.png');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('$1'),
        ['test.png']
      );
    });

    it('should use parameterized queries for create territory', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });

      await request(app)
        .post('/territories')
        .send({
          territory_number: "1'; DROP TABLE territories;--",
          locality: 'Test',
          block_count: 5,
        });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('$1'),
        expect.arrayContaining(["1'; DROP TABLE territories;--"])
      );
    });

    it('should use parameterized queries for delete territory', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await request(app).delete('/territories/1');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('$1'),
        expect.any(Array)
      );
    });
  });

  describe('Error messages in Portuguese', () => {
    beforeEach(() => {
      mockPool.query.mockRejectedValue(new Error('DB error'));
    });

    it('should return Portuguese error for get territories', async () => {
      const response = await request(app).get('/territories');
      expect(response.body.error).toMatch(/Erro|buscar|territórios/i);
    });

    it('should return Portuguese error for get available', async () => {
      const response = await request(app).get('/territories/available');
      expect(response.body.error).toMatch(/Erro|buscar|territórios|disponíveis/i);
    });

    it('should return Portuguese error for get single', async () => {
      const response = await request(app).get('/territories/1');
      expect(response.body.error).toMatch(/Erro|buscar|território/i);
    });

    it('should return Portuguese error for create', async () => {
      const response = await request(app)
        .post('/territories')
        .send({ territory_number: 1, locality: 'Test', block_count: 5 });
      expect(response.body.error).toMatch(/Erro|criar|território/i);
    });

    it('should return Portuguese error for update', async () => {
      const response = await request(app)
        .put('/territories/1')
        .send({ locality: 'Updated' });
      expect(response.body.error).toMatch(/Erro|atualizar|território/i);
    });

    it('should return Portuguese error for delete', async () => {
      const response = await request(app).delete('/territories/1');
      expect(response.body.error).toMatch(/Erro|excluir|território/i);
    });

    it('should return Portuguese error for history', async () => {
      const response = await request(app).get('/territories/1/history');
      expect(response.body.error).toMatch(/Erro|buscar|histórico|território/i);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty territories list', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app).get('/territories');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should handle territory with no history', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app).get('/territories/1/history');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should handle creating territory with observations', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });

      await request(app)
        .post('/territories')
        .send({
          territory_number: 1,
          locality: 'Centro',
          block_count: 5,
          observations: 'Special notes here',
        });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['Special notes here'])
      );
    });

    it('should handle updating last_worked_date', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });

      const response = await request(app)
        .put('/territories/1')
        .send({ last_worked_date: '2024-06-15' });

      expect(response.status).toBe(200);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['2024-06-15'])
      );
    }, 15000);
  });

  describe('House Configuration Endpoints', () => {
    describe('POST /territories/streets/:streetId/houses', () => {
      it('should add a house successfully', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [] }) // duplicate check
          .mockResolvedValueOnce({ rows: [{ id: 10, street_id: 5, number: '120', dont_visit: false }] }); // insert

        const response = await request(app)
          .post('/territories/streets/5/houses')
          .send({ number: '120', dont_visit: false });

        expect(response.status).toBe(201);
        expect(response.body.number).toBe('120');
      });

      it('should fail if house number already exists (case-insensitive)', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [{ id: 10 }] }); // duplicate check returns existing row

        const response = await request(app)
          .post('/territories/streets/5/houses')
          .send({ number: ' 120 ' });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('já está cadastrado nesta rua');
      });
    });

    describe('PUT /territories/streets/:streetId', () => {
      it('should update street details successfully', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [{ id: 5, name: 'Rua Nova', block_number: 2, observations: 'Novas Obs' }] }); // update

        const response = await request(app)
          .put('/territories/streets/5')
          .send({ name: 'Rua Nova', block_number: 2, observations: 'Novas Obs' });

        expect(response.status).toBe(200);
        expect(response.body.name).toBe('Rua Nova');
        expect(response.body.block_number).toBe(2);
      });

      it('should return 404 if street not found', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] }); // update returns nothing

        const response = await request(app)
          .put('/territories/streets/999')
          .send({ name: 'Rua Nova' });

        expect(response.status).toBe(404);
        expect(response.body.error).toContain('Rua não encontrada');
      });
    });

    describe('PUT /territories/streets/houses/:houseId', () => {
      it('should update house successfully', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ street_id: 5 }] }) // select street_id
          .mockResolvedValueOnce({ rows: [] }) // check duplicate
          .mockResolvedValueOnce({ rows: [{ id: 10, number: '120F', dont_visit: true }] }); // update

        const response = await request(app)
          .put('/territories/streets/houses/10')
          .send({ number: '120F', dont_visit: true });

        expect(response.status).toBe(200);
        expect(response.body.dont_visit).toBe(true);
        expect(response.body.number).toBe('120F');
      });

      it('should fail if house number already exists on update', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ street_id: 5 }] }) // select street_id
          .mockResolvedValueOnce({ rows: [{ id: 11 }] }); // check duplicate returns existing row

        const response = await request(app)
          .put('/territories/streets/houses/10')
          .send({ number: '120F' });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('já está cadastrado nesta rua');
      });

      it('should return 404 if house not found on update number', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] }); // select street_id returns nothing

        const response = await request(app)
          .put('/territories/streets/houses/999')
          .send({ number: '120F' });

        expect(response.status).toBe(404);
        expect(response.body.error).toContain('Casa não encontrada');
      });
    });
  });
});
