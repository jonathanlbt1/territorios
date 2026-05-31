import { jest } from '@jest/globals';

// Mock pool
const mockPool = {
  query: jest.fn(),
};

// Mock authenticateToken middleware
const mockAuthenticateToken = jest.fn((req, res, next) => next());

// Mock requireAdmin middleware
const mockRequireAdmin = jest.fn((req, res, next) => next());

// Mock modules before importing
jest.unstable_mockModule('../../src/db/config.js', () => ({
  default: mockPool,
}));

jest.unstable_mockModule('../../src/middleware/auth.js', () => ({
  authenticateToken: mockAuthenticateToken,
  requireAdmin: mockRequireAdmin,
}));

// Import express and create test app
const express = (await import('express')).default;
const { default: reportsRouter } = await import('../../src/routes/reports.js');

// Create test app
const app = express();
app.use(express.json());
app.use('/reports', reportsRouter);

// Import supertest for HTTP testing
const request = (await import('supertest')).default;

describe('Reports Routes', () => {
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

  describe('GET /reports/coverage', () => {
    describe('authentication and authorization', () => {
      it('should require authentication', async () => {
        mockAuthenticateToken.mockImplementation((req, res, next) => {
          res.status(401).json({ error: 'Unauthorized' });
        });

        const response = await request(app).get('/reports/coverage');

        expect(response.status).toBe(401);
      });

      it('should require admin role', async () => {
        mockRequireAdmin.mockImplementation((req, res, next) => {
          res.status(403).json({ error: 'Forbidden' });
        });

        const response = await request(app).get('/reports/coverage');

        expect(response.status).toBe(403);
      });
    });

    describe('coverage report', () => {
      it('should return coverage data', async () => {
        const mockData = [
          { id: 1, territory_number: 1, times_worked: '5', times_complete: '3' },
          { id: 2, territory_number: 2, times_worked: '0', times_complete: '0' },
        ];
        mockPool.query.mockResolvedValue({ rows: mockData });

        const response = await request(app).get('/reports/coverage');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockData);
      });

      it('should filter by start_date when provided', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/reports/coverage?start_date=2024-01-01');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('worked_date >= $1'),
          ['2024-01-01']
        );
      });

      it('should not filter by date when start_date not provided', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/reports/coverage');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.any(String),
          []
        );
      });

      it('should order by last_worked_date with nulls first', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/reports/coverage');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY t.last_worked_date ASC NULLS FIRST'),
          expect.any(Array)
        );
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        mockPool.query.mockRejectedValue(new Error('DB error'));

        const response = await request(app).get('/reports/coverage');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro ao gerar relatório de cobertura');
      });

      it('should log error on failure', async () => {
        const error = new Error('Query failed');
        mockPool.query.mockRejectedValue(error);

        await request(app).get('/reports/coverage');

        expect(consoleErrorSpy).toHaveBeenCalledWith('Get coverage report error:', error);
      });
    });
  });

  describe('GET /reports/territory-frequency', () => {
    describe('authentication and authorization', () => {
      it('should require admin role', async () => {
        mockRequireAdmin.mockImplementation((req, res, next) => {
          res.status(403).json({ error: 'Forbidden' });
        });

        const response = await request(app).get('/reports/territory-frequency');

        expect(response.status).toBe(403);
      });
    });

    describe('frequency report', () => {
      it('should return frequency data', async () => {
        const mockData = [
          { id: 1, territory_number: 1, times_worked: '10' },
          { id: 2, territory_number: 2, times_worked: '5' },
        ];
        mockPool.query.mockResolvedValue({ rows: mockData });

        const response = await request(app).get('/reports/territory-frequency');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockData);
      });

      it('should use default order DESC', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/reports/territory-frequency');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY times_worked DESC'),
          expect.any(Array)
        );
      });

      it('should allow order ASC', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/reports/territory-frequency?order=asc');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY times_worked ASC'),
          expect.any(Array)
        );
      });

      it('should use default limit of 20', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/reports/territory-frequency');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('LIMIT $1'),
          [20]
        );
      });

      it('should allow custom limit', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/reports/territory-frequency?limit=50');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.any(String),
          ['50']
        );
      });

      it('should filter by start_date when provided', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/reports/territory-frequency?start_date=2024-01-01');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('th.worked_date >= $2'),
          expect.arrayContaining(['2024-01-01'])
        );
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        mockPool.query.mockRejectedValue(new Error('DB error'));

        const response = await request(app).get('/reports/territory-frequency');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro ao gerar relatório de frequência');
      });
    });
  });

  describe('GET /reports/partial-frequency', () => {
    describe('partial frequency report', () => {
      it('should return partial frequency data', async () => {
        const mockData = [
          { id: 1, territory_number: 5, partial_count: '8', partial_percentage: '40.0' },
        ];
        mockPool.query.mockResolvedValue({ rows: mockData });

        const response = await request(app).get('/reports/partial-frequency');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockData);
      });

      it('should only return territories with partial work', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/reports/partial-frequency');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining("HAVING COUNT(CASE WHEN th.result = 'partial'"),
          expect.any(Array)
        );
      });

      it('should filter by start_date when provided', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/reports/partial-frequency?start_date=2024-06-01');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('th.worked_date >= $1'),
          ['2024-06-01']
        );
      });

      it('should order by partial_count and partial_percentage DESC', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/reports/partial-frequency');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY partial_count DESC, partial_percentage DESC'),
          expect.any(Array)
        );
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        mockPool.query.mockRejectedValue(new Error('DB error'));

        const response = await request(app).get('/reports/partial-frequency');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro ao gerar relatório de trabalhos parciais');
      });
    });
  });

  describe('GET /reports/dirigente-performance', () => {
    describe('performance report', () => {
      it('should return dirigente performance data', async () => {
        const mockData = [
          { id: 1, name: 'João', total_assignments: '15', completion_rate: '80.0' },
          { id: 2, name: 'Maria', total_assignments: '10', completion_rate: '90.0' },
        ];
        mockPool.query.mockResolvedValue({ rows: mockData });

        const response = await request(app).get('/reports/dirigente-performance');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockData);
      });

      it('should only query dirigente users', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/reports/dirigente-performance');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining("WHERE u.role = 'dirigente'")
        );
      });

      it('should order by total_assignments DESC', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/reports/dirigente-performance');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY total_assignments DESC')
        );
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        mockPool.query.mockRejectedValue(new Error('DB error'));

        const response = await request(app).get('/reports/dirigente-performance');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro ao gerar relatório de desempenho');
      });
    });
  });

  describe('GET /reports/work-by-period', () => {
    describe('period grouping', () => {
      it('should default to month grouping', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/reports/work-by-period');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining("TO_CHAR(worked_date, 'YYYY-MM')"),
          []
        );
      });

      it('should support day grouping', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/reports/work-by-period?groupBy=day');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining("TO_CHAR(worked_date, 'YYYY-MM-DD')"),
          []
        );
      });

      it('should support week grouping', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/reports/work-by-period?groupBy=week');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining("TO_CHAR(worked_date, 'IYYY-IW')"),
          []
        );
      });

      it('should support year grouping', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/reports/work-by-period?groupBy=year');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining("TO_CHAR(worked_date, 'YYYY')"),
          []
        );
      });
    });

    describe('date filtering', () => {
      it('should filter by start_date', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/reports/work-by-period?start_date=2024-01-01');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('worked_date >= $1'),
          ['2024-01-01']
        );
      });

      it('should filter by end_date', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/reports/work-by-period?end_date=2024-12-31');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('worked_date <= $1'),
          ['2024-12-31']
        );
      });

      it('should filter by both dates', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/reports/work-by-period?start_date=2024-01-01&end_date=2024-12-31');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('worked_date >= $1'),
          expect.arrayContaining(['2024-01-01', '2024-12-31'])
        );
        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('worked_date <= $2'),
          expect.any(Array)
        );
      });
    });

    describe('response data', () => {
      it('should return period work data', async () => {
        const mockData = [
          { period: '2024-01', total_work: '10', complete: '8', partial: '2', not_done: '0' },
          { period: '2024-02', total_work: '15', complete: '12', partial: '3', not_done: '0' },
        ];
        mockPool.query.mockResolvedValue({ rows: mockData });

        const response = await request(app).get('/reports/work-by-period');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockData);
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        mockPool.query.mockRejectedValue(new Error('DB error'));

        const response = await request(app).get('/reports/work-by-period');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro ao gerar relatório por período');
      });
    });
  });

  describe('GET /reports/dashboard-stats', () => {
    describe('admin stats', () => {
      beforeEach(() => {
        mockAuthenticateToken.mockImplementation((req, res, next) => {
          req.user = { id: 1, role: 'admin' };
          next();
        });
      });

      it('should return admin dashboard stats', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ count: '50' }] }) // territories
          .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // active assignments
          .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // pending validations
          .mockResolvedValueOnce({ rows: [{ count: '8' }] }) // dirigentes
          .mockResolvedValueOnce({ rows: [{ count: '3' }] }) // never worked
          .mockResolvedValueOnce({ rows: [{ count: '20' }] }) // this month
          .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // overdue
          .mockResolvedValueOnce({ rows: [{ count: '0' }] }); // notifications

        const response = await request(app).get('/reports/dashboard-stats');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          totalTerritories: 50,
          activeAssignments: 10,
          pendingValidations: 5,
          totalDirigentes: 8,
          neverWorkedTerritories: 3,
          thisMonthCompletions: 20,
          overdueAssignments: 2,
          unreadNotifications: 0,
        });
      });

      it('should query for overdue assignments over 60 days', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ count: '0' }] });

        await request(app).get('/reports/dashboard-stats');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining("INTERVAL '60 days'")
        );
      });
    });

    describe('dirigente stats', () => {
      beforeEach(() => {
        mockAuthenticateToken.mockImplementation((req, res, next) => {
          req.user = { id: 5, role: 'dirigente' };
          next();
        });
      });

      it('should return dirigente dashboard stats', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ count: '3' }] }) // my assignments
          .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // completed this month
          .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // unread notifications (dirigente query)
          .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // unread notifications (common query)

        const response = await request(app).get('/reports/dashboard-stats');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          myActiveAssignments: 3,
          myCompletedThisMonth: 2,
          unreadNotifications: 1,
        });
      });

      it('should query with user id', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ count: '0' }] });

        await request(app).get('/reports/dashboard-stats');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('dirigente_id = $1'),
          [5]
        );
      });
    });

    describe('authentication', () => {
      it('should require authentication but not admin', async () => {
        // Dashboard stats is accessible to both admin and dirigente
        mockRequireAdmin.mockImplementation((req, res, next) => next());
        mockPool.query.mockResolvedValue({ rows: [{ count: '0' }] });

        const response = await request(app).get('/reports/dashboard-stats');

        expect(response.status).toBe(200);
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        mockPool.query.mockRejectedValue(new Error('DB error'));

        const response = await request(app).get('/reports/dashboard-stats');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro ao buscar estatísticas');
      });
    });
  });

  describe('GET /reports/territory-history-s13', () => {
    describe('S-13 history data', () => {
      it('should return territory history', async () => {
        const mockData = [
          {
            id: 1,
            territory_id: 1,
            territory_number: 1,
            dirigente_name: 'João Silva',
            validation_result: 'complete',
          },
        ];
        mockPool.query.mockResolvedValue({ rows: mockData });

        const response = await request(app).get('/reports/territory-history-s13');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockData);
      });

      it('should order by territory_number and worked_date', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await request(app).get('/reports/territory-history-s13');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY t.territory_number ASC, th.worked_date DESC')
        );
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        mockPool.query.mockRejectedValue(new Error('DB error'));

        const response = await request(app).get('/reports/territory-history-s13');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro ao buscar histórico de territórios');
      });
    });
  });

  describe('PUT /reports/territory-history-s13/:id', () => {
    describe('validation', () => {
      it('should return 400 when assigned_date is missing', async () => {
        const response = await request(app)
          .put('/reports/territory-history-s13/1')
          .send({ dirigente_id: 1 });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Data de designação é obrigatória');
      });

      it('should return 400 for invalid status', async () => {
        const response = await request(app)
          .put('/reports/territory-history-s13/1')
          .send({ assigned_date: '2024-01-01', status: 'invalid_status' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Status inválido');
      });

      it('should accept valid status values', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ territory_id: 1 }] }) // history lookup
          .mockResolvedValueOnce({ rows: [] }) // update
          .mockResolvedValueOnce({ rows: [{ last_date: null }] }) // refresh query
          .mockResolvedValueOnce({ rows: [] }); // refresh update

        const response = await request(app)
          .put('/reports/territory-history-s13/1')
          .send({ assigned_date: '2024-01-01', status: 'complete' });

        expect(response.status).toBe(200);
      });

      it('should allow partial status', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ territory_id: 1 }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ last_date: null }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .put('/reports/territory-history-s13/1')
          .send({ assigned_date: '2024-01-01', status: 'partial' });

        expect(response.status).toBe(200);
      });

      it('should allow not_done status', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ territory_id: 1 }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ last_date: null }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .put('/reports/territory-history-s13/1')
          .send({ assigned_date: '2024-01-01', status: 'not_done' });

        expect(response.status).toBe(200);
      });
    });

    describe('dirigente lookup', () => {
      it('should return 404 when dirigente not found', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] }); // user lookup returns empty

        const response = await request(app)
          .put('/reports/territory-history-s13/1')
          .send({ assigned_date: '2024-01-01', dirigente_id: 999 });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Dirigente não encontrado');
      });

      it('should use dirigente name from database', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ id: 5, name: 'Maria Silva' }] }) // user lookup
          .mockResolvedValueOnce({ rows: [{ territory_id: 1 }] }) // history lookup
          .mockResolvedValueOnce({ rows: [] }) // update
          .mockResolvedValueOnce({ rows: [{ last_date: null }] })
          .mockResolvedValueOnce({ rows: [] });

        await request(app)
          .put('/reports/territory-history-s13/1')
          .send({ assigned_date: '2024-01-01', dirigente_id: 5 });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE territory_history'),
          expect.arrayContaining([5, 'Maria Silva'])
        );
      });
    });

    describe('record lookup', () => {
      it('should return 404 when record not found', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] }); // history lookup returns empty

        const response = await request(app)
          .put('/reports/territory-history-s13/999')
          .send({ assigned_date: '2024-01-01' });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Registro não encontrado');
      });
    });

    describe('successful update', () => {
      it('should update record and refresh last worked date', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ territory_id: 10 }] }) // history lookup
          .mockResolvedValueOnce({ rows: [] }) // update
          .mockResolvedValueOnce({ rows: [{ last_date: '2024-01-15' }] }) // refresh query
          .mockResolvedValueOnce({ rows: [] }); // refresh update

        const response = await request(app)
          .put('/reports/territory-history-s13/1')
          .send({
            assigned_date: '2024-01-01',
            conclusion_date: '2024-01-15',
            status: 'complete',
          });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Registro atualizado com sucesso');
      });

      it('should set conclusion_date to null for non-complete status', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ territory_id: 1 }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ last_date: null }] })
          .mockResolvedValueOnce({ rows: [] });

        await request(app)
          .put('/reports/territory-history-s13/1')
          .send({ assigned_date: '2024-01-01', status: 'partial' });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE territory_history'),
          expect.arrayContaining([null]) // conclusion_date should be null
        );
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        mockPool.query.mockReset();
        mockPool.query.mockRejectedValue(new Error('DB error'));

        const response = await request(app)
          .put('/reports/territory-history-s13/1')
          .send({ assigned_date: '2024-01-01' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro ao atualizar registro');
      }, 15000);
    });
  });

  describe('POST /reports/territory-history-s13', () => {
    describe('validation', () => {
      it('should return 400 when territory_id is missing', async () => {
        const response = await request(app)
          .post('/reports/territory-history-s13')
          .send({ assigned_date: '2024-01-01' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Território é obrigatório');
      });

      it('should return 400 when assigned_date is missing', async () => {
        const response = await request(app)
          .post('/reports/territory-history-s13')
          .send({ territory_id: 1 });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Data de designação é obrigatória');
      });

      it('should return 400 for invalid status', async () => {
        const response = await request(app)
          .post('/reports/territory-history-s13')
          .send({ territory_id: 1, assigned_date: '2024-01-01', status: 'bad_status' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Status inválido');
      });
    });

    describe('lookups', () => {
      it('should return 404 when dirigente not found', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] }); // user lookup

        const response = await request(app)
          .post('/reports/territory-history-s13')
          .send({ territory_id: 1, assigned_date: '2024-01-01', dirigente_id: 999 });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Dirigente não encontrado');
      });

      it('should return 404 when territory not found', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] }); // territory lookup

        const response = await request(app)
          .post('/reports/territory-history-s13')
          .send({ territory_id: 999, assigned_date: '2024-01-01' });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Território não encontrado');
      });
    });

    describe('successful creation', () => {
      it('should create record and return 201', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ id: 1, block_count: 5 }] }) // territory lookup
          .mockResolvedValueOnce({ rows: [] }) // insert
          .mockResolvedValueOnce({ rows: [{ last_date: '2024-01-01' }] }) // refresh query
          .mockResolvedValueOnce({ rows: [] }); // refresh update

        const response = await request(app)
          .post('/reports/territory-history-s13')
          .send({ territory_id: 1, assigned_date: '2024-01-01' });

        expect(response.status).toBe(201);
        expect(response.body.message).toBe('Registro criado com sucesso');
      });

      it('should create record with dirigente', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ id: 5, name: 'João' }] }) // user lookup
          .mockResolvedValueOnce({ rows: [{ id: 1, block_count: 3 }] }) // territory lookup
          .mockResolvedValueOnce({ rows: [] }) // insert
          .mockResolvedValueOnce({ rows: [{ last_date: '2024-01-01' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .post('/reports/territory-history-s13')
          .send({ territory_id: 1, assigned_date: '2024-01-01', dirigente_id: 5 });

        expect(response.status).toBe(201);
      });

      it('should default status to complete', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ id: 1, block_count: 3 }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ last_date: null }] })
          .mockResolvedValueOnce({ rows: [] });

        await request(app)
          .post('/reports/territory-history-s13')
          .send({ territory_id: 1, assigned_date: '2024-01-01' });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO territory_history'),
          expect.arrayContaining(['complete'])
        );
      });

      it('should use assigned_date as conclusion_date when complete and no conclusion_date', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ id: 1, block_count: 3 }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ last_date: null }] })
          .mockResolvedValueOnce({ rows: [] });

        await request(app)
          .post('/reports/territory-history-s13')
          .send({ territory_id: 1, assigned_date: '2024-01-01', status: 'complete' });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO territory_history'),
          expect.arrayContaining(['2024-01-01']) // conclusion_date = assigned_date
        );
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        mockPool.query.mockRejectedValue(new Error('DB error'));

        const response = await request(app)
          .post('/reports/territory-history-s13')
          .send({ territory_id: 1, assigned_date: '2024-01-01' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro ao criar registro');
      });
    });
  });

  describe('DELETE /reports/territory-history-s13/:id', () => {
    describe('successful deletion', () => {
      it('should delete record and refresh last worked date', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ territory_id: 5 }] }) // delete returning
          .mockResolvedValueOnce({ rows: [{ last_date: '2024-01-01' }] }) // refresh query
          .mockResolvedValueOnce({ rows: [] }); // refresh update

        const response = await request(app).delete('/reports/territory-history-s13/1');

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Registro removido com sucesso');
      });

      it('should call refreshTerritoryLastWorked with correct territory_id', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ territory_id: 42 }] })
          .mockResolvedValueOnce({ rows: [{ last_date: null }] })
          .mockResolvedValueOnce({ rows: [] });

        await request(app).delete('/reports/territory-history-s13/1');

        // Second call should be the refresh query with territory_id
        expect(mockPool.query).toHaveBeenNthCalledWith(
          2,
          expect.any(String),
          [42]
        );
      });
    });

    describe('record not found', () => {
      it('should return 404 when record does not exist', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app).delete('/reports/territory-history-s13/999');

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Registro não encontrado');
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        mockPool.query.mockRejectedValue(new Error('DB error'));

        const response = await request(app).delete('/reports/territory-history-s13/1');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro ao excluir registro');
      });
    });
  });

  describe('Security', () => {
    it('should use parameterized queries for coverage', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await request(app).get('/reports/coverage?start_date=2024-01-01');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('$1'),
        expect.any(Array)
      );
    });

    it('should use parameterized queries for history update', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ territory_id: 1 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ last_date: null }] })
        .mockResolvedValueOnce({ rows: [] });

      await request(app)
        .put('/reports/territory-history-s13/1')
        .send({ assigned_date: "'; DROP TABLE territory_history;--" });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('$'),
        expect.arrayContaining(["'; DROP TABLE territory_history;--"])
      );
    });

    it('should use parameterized queries for history delete', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await request(app).delete('/reports/territory-history-s13/1');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('$1'),
        ['1']
      );
    });
  });

  describe('Error messages in Portuguese', () => {
    beforeEach(() => {
      mockPool.query.mockRejectedValue(new Error('DB error'));
    });

    it('should return Portuguese error for coverage report', async () => {
      const response = await request(app).get('/reports/coverage');
      expect(response.body.error).toMatch(/Erro|relatório|cobertura/i);
    });

    it('should return Portuguese error for frequency report', async () => {
      const response = await request(app).get('/reports/territory-frequency');
      expect(response.body.error).toMatch(/Erro|relatório|frequência/i);
    });

    it('should return Portuguese error for partial report', async () => {
      const response = await request(app).get('/reports/partial-frequency');
      expect(response.body.error).toMatch(/Erro|relatório|parciais/i);
    });

    it('should return Portuguese error for performance report', async () => {
      const response = await request(app).get('/reports/dirigente-performance');
      expect(response.body.error).toMatch(/Erro|relatório|desempenho/i);
    });

    it('should return Portuguese error for period report', async () => {
      const response = await request(app).get('/reports/work-by-period');
      expect(response.body.error).toMatch(/Erro|relatório|período/i);
    });

    it('should return Portuguese error for dashboard stats', async () => {
      const response = await request(app).get('/reports/dashboard-stats');
      expect(response.body.error).toMatch(/Erro|estatísticas/i);
    });

    it('should return Portuguese error for S-13 history', async () => {
      mockPool.query.mockReset();
      mockPool.query.mockRejectedValueOnce(new Error('DB error'));
      
      const response = await request(app).get('/reports/territory-history-s13');
      expect(response.body.error).toMatch(/Erro|histórico|territórios/i);
    });
  });
});
