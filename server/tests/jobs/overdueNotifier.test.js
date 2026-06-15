import { jest } from '@jest/globals';

// Mock client
const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

// Mock pool
const mockPool = {
  connect: jest.fn().mockResolvedValue(mockClient),
};

// Mock push notification function
const mockSendPushToUser = jest.fn().mockResolvedValue();

// Mock modules before importing
jest.unstable_mockModule('../../src/db/config.js', () => ({
  default: mockPool,
}));

jest.unstable_mockModule('../../src/services/pushNotification.js', () => ({
  sendPushToUser: mockSendPushToUser,
}));

// Import after mocking
const {
  startOverdueNotifier,
  notifyOverdueAssignments,
  DEFAULT_INTERVAL_MS,
  TEN_DAYS_MS,
  default: defaultExport,
} = await import('../../src/jobs/overdueNotifier.js');

describe('Overdue Notifier', () => {
  let consoleSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ legacyFakeTimers: false });
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Default: no overdue assignments
    mockClient.query.mockResolvedValue({ rows: [] });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('notifyOverdueAssignments', () => {
    it('should connect to the database', async () => {
      await notifyOverdueAssignments();

      expect(mockPool.connect).toHaveBeenCalled();
    });

    it('should release the client after processing', async () => {
      await notifyOverdueAssignments();

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should release the client even if query fails', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('DB error'));

      await notifyOverdueAssignments();

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should query for overdue assignments older than 60 days', async () => {
      await notifyOverdueAssignments();

      const queryCall = mockClient.query.mock.calls[0];
      expect(queryCall[0]).toContain("status IN ('pending', 'in_progress')");
      expect(queryCall[0]).toContain("INTERVAL '60 days'");
      expect(queryCall[0]).toContain("type = 'assignment_overdue_10d'");
    });

    it('should exclude assignments that already have overdue notifications', async () => {
      await notifyOverdueAssignments();

      const queryCall = mockClient.query.mock.calls[0];
      expect(queryCall[0]).toContain('NOT EXISTS');
      expect(queryCall[0]).toContain("n.type = 'assignment_overdue_10d'");
    });
  });

  describe('dirigente notifications', () => {
    const mockOverdueAssignment = {
      id: 1,
      territory_id: 10,
      dirigente_id: 100,
      assigned_by: 200,
      assigned_date: '2024-01-01',
      territory_code: 'T-01',
      locality: 'Centro',
      dirigente_name: 'João Silva',
    };

    beforeEach(() => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [mockOverdueAssignment] }) // SELECT query
        .mockResolvedValue({ rows: [] }); // INSERT queries
    });

    it('should create notification for dirigente', async () => {
      await notifyOverdueAssignments();

      const insertCall = mockClient.query.mock.calls.find(
        (call) =>
          call[0].includes('INSERT INTO notifications') &&
          call[1] &&
          call[1][0] === 100
      );

      expect(insertCall).toBeDefined();
      expect(insertCall[1][0]).toBe(100); // dirigente_id
      expect(insertCall[1][1]).toContain('T-01');
      expect(insertCall[1][1]).toContain('Centro');
      expect(insertCall[1][1]).toContain('60 dias');
      expect(insertCall[1][2]).toBe(1); // assignment_id
    });

    it('should send push notification to dirigente', async () => {
      await notifyOverdueAssignments();

      expect(mockSendPushToUser).toHaveBeenCalledWith(
        100,
        expect.objectContaining({
          title: '⏰ Lembrete de Território',
          body: expect.stringContaining('T-01'),
          data: expect.objectContaining({
            assignmentId: 1,
            url: '/assignment/1',
          }),
        })
      );
    });

    it('should include territory code and locality in dirigente message', async () => {
      await notifyOverdueAssignments();

      const pushCall = mockSendPushToUser.mock.calls.find(
        (call) => call[0] === 100
      );
      expect(pushCall[1].body).toContain('T-01');
      expect(pushCall[1].body).toContain('Centro');
    });
  });

  describe('admin notifications', () => {
    const mockOverdueAssignment = {
      id: 1,
      territory_id: 10,
      dirigente_id: 100,
      assigned_by: 200,
      assigned_date: '2024-01-01',
      territory_code: 'T-01',
      locality: 'Centro',
      dirigente_name: 'João Silva',
    };

    beforeEach(() => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [mockOverdueAssignment] })
        .mockResolvedValue({ rows: [] });
    });

    it('should create notification for admin who assigned', async () => {
      await notifyOverdueAssignments();

      const insertCall = mockClient.query.mock.calls.find(
        (call) =>
          call[0].includes('INSERT INTO notifications') &&
          call[1] &&
          call[1][0] === 200
      );

      expect(insertCall).toBeDefined();
      expect(insertCall[1][0]).toBe(200); // assigned_by (admin)
      expect(insertCall[1][1]).toContain('João Silva');
      expect(insertCall[1][1]).toContain('T-01');
      expect(insertCall[1][1]).toContain('60 dias');
    });

    it('should send push notification to admin', async () => {
      await notifyOverdueAssignments();

      expect(mockSendPushToUser).toHaveBeenCalledWith(
        200,
        expect.objectContaining({
          title: '⚠️ Alerta de Território em Aberto',
          body: expect.stringContaining('João Silva'),
          data: expect.objectContaining({
            assignmentId: 1,
            url: '/assignment/1',
          }),
        })
      );
    });

    it('should NOT notify admin if assigned_by is null', async () => {
      const assignmentWithoutAdmin = { ...mockOverdueAssignment, assigned_by: null };
      mockClient.query
        .mockReset()
        .mockResolvedValueOnce({ rows: [assignmentWithoutAdmin] })
        .mockResolvedValue({ rows: [] });

      await notifyOverdueAssignments();

      // Should only have SELECT query + 1 INSERT for dirigente
      const insertCalls = mockClient.query.mock.calls.filter((call) =>
        call[0].includes('INSERT INTO notifications')
      );
      expect(insertCalls.length).toBe(1);
      expect(insertCalls[0][1][0]).toBe(100); // Only dirigente notification
    });

    it('should NOT notify admin if admin is same as dirigente', async () => {
      const selfAssignment = { ...mockOverdueAssignment, assigned_by: 100 };
      mockClient.query
        .mockReset()
        .mockResolvedValueOnce({ rows: [selfAssignment] })
        .mockResolvedValue({ rows: [] });

      await notifyOverdueAssignments();

      // Should only have SELECT query + 1 INSERT for dirigente
      const insertCalls = mockClient.query.mock.calls.filter((call) =>
        call[0].includes('INSERT INTO notifications')
      );
      expect(insertCalls.length).toBe(1);

      // Push should only be sent to dirigente
      expect(mockSendPushToUser).toHaveBeenCalledTimes(1);
      expect(mockSendPushToUser).toHaveBeenCalledWith(100, expect.any(Object));
    });
  });

  describe('multiple overdue assignments', () => {
    const mockAssignments = [
      {
        id: 1,
        territory_id: 10,
        dirigente_id: 100,
        assigned_by: 200,
        territory_code: 'T-01',
        locality: 'Centro',
        dirigente_name: 'João',
      },
      {
        id: 2,
        territory_id: 20,
        dirigente_id: 101,
        assigned_by: 200,
        territory_code: 'T-02',
        locality: 'Norte',
        dirigente_name: 'Maria',
      },
      {
        id: 3,
        territory_id: 30,
        dirigente_id: 102,
        assigned_by: null,
        territory_code: 'T-03',
        locality: 'Sul',
        dirigente_name: 'Pedro',
      },
    ];

    beforeEach(() => {
      mockClient.query
        .mockResolvedValueOnce({ rows: mockAssignments })
        .mockResolvedValue({ rows: [] });
    });

    it('should process all overdue assignments', async () => {
      await notifyOverdueAssignments();

      // 3 dirigente notifications + 2 admin notifications (one has no admin)
      const insertCalls = mockClient.query.mock.calls.filter((call) =>
        call[0].includes('INSERT INTO notifications')
      );
      expect(insertCalls.length).toBe(5);
    });

    it('should send push notifications to all affected users', async () => {
      await notifyOverdueAssignments();

      // 3 dirigentes + 2 admins = 5 push notifications
      expect(mockSendPushToUser).toHaveBeenCalledTimes(5);

      // Check dirigente notifications
      expect(mockSendPushToUser).toHaveBeenCalledWith(100, expect.any(Object));
      expect(mockSendPushToUser).toHaveBeenCalledWith(101, expect.any(Object));
      expect(mockSendPushToUser).toHaveBeenCalledWith(102, expect.any(Object));

      // Check admin notifications (user 200 receives 2)
      const adminCalls = mockSendPushToUser.mock.calls.filter(
        (call) => call[0] === 200
      );
      expect(adminCalls.length).toBe(2);
    });
  });

  describe('no overdue assignments', () => {
    it('should not create any notifications when no assignments are overdue', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await notifyOverdueAssignments();

      // Both the territory overdue SELECT and publisher overdue SELECT queries should be called
      expect(mockClient.query).toHaveBeenCalledTimes(2);
      expect(mockSendPushToUser).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should log error when database query fails', async () => {
      const error = new Error('Database connection failed');
      mockClient.query.mockRejectedValueOnce(error);

      await notifyOverdueAssignments();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Overdue notifier error:', error);
    });

    it('should continue processing if push notification fails', async () => {
      const mockAssignment = {
        id: 1,
        territory_id: 10,
        dirigente_id: 100,
        assigned_by: 200,
        territory_code: 'T-01',
        locality: 'Centro',
        dirigente_name: 'João',
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [mockAssignment] })
        .mockResolvedValue({ rows: [] });

      const pushError = new Error('Push failed');
      mockSendPushToUser.mockRejectedValue(pushError);

      await notifyOverdueAssignments();

      // Should still create database notifications even if push fails
      const insertCalls = mockClient.query.mock.calls.filter((call) =>
        call[0].includes('INSERT INTO notifications')
      );
      expect(insertCalls.length).toBe(2); // dirigente + admin
    });

    it('should log error when push notification fails', async () => {
      jest.useRealTimers(); // Need real timers for this test
      
      const mockAssignment = {
        id: 1,
        territory_id: 10,
        dirigente_id: 100,
        assigned_by: null,
        territory_code: 'T-01',
        locality: 'Centro',
        dirigente_name: 'João',
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [mockAssignment] })
        .mockResolvedValue({ rows: [] });

      const pushError = new Error('Push service unavailable');
      mockSendPushToUser.mockRejectedValue(pushError);

      await notifyOverdueAssignments();

      // Wait for the catch block to execute
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Push notification error:',
        pushError
      );
    });
  });

  describe('startOverdueNotifier function', () => {
    it('should run immediately on start', () => {
      startOverdueNotifier();

      // Should connect immediately (async, so just check it was called)
      expect(mockPool.connect).toHaveBeenCalledTimes(1);
    });

    it('should be a function', () => {
      expect(typeof startOverdueNotifier).toBe('function');
    });

    it('should accept an interval parameter', () => {
      // Just verify it doesn't throw with a custom interval
      expect(() => startOverdueNotifier(1000)).not.toThrow();
    });

    it('should log error if initial run fails', async () => {
      jest.useRealTimers(); // Use real timers for this test
      
      mockPool.connect.mockRejectedValueOnce(new Error('Initial connection failed'));

      startOverdueNotifier(999999999); // Large interval to avoid triggering

      // Wait for the promise to reject
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Overdue notifier initial run error:',
        expect.any(Error)
      );
    });
  });

  describe('notification content', () => {
    const mockAssignment = {
      id: 42,
      territory_id: 10,
      dirigente_id: 100,
      assigned_by: 200,
      territory_code: 'T-15',
      locality: 'Vila Nova',
      dirigente_name: 'Carlos Santos',
    };

    beforeEach(() => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [mockAssignment] })
        .mockResolvedValue({ rows: [] });
    });

    it('should use correct notification type', async () => {
      await notifyOverdueAssignments();

      const insertCalls = mockClient.query.mock.calls.filter((call) =>
        call[0].includes('INSERT INTO notifications')
      );

      insertCalls.forEach((call) => {
        expect(call[0]).toContain("'assignment_overdue_10d'");
      });
    });

    it('should use correct title for dirigente notification', async () => {
      await notifyOverdueAssignments();

      const dirigenteInsert = mockClient.query.mock.calls.find(
        (call) =>
          call[0].includes('INSERT INTO notifications') &&
          call[1] &&
          call[1][0] === 100
      );

      expect(dirigenteInsert[0]).toContain("'Lembrete de Território'");
    });

    it('should use correct title for admin notification', async () => {
      await notifyOverdueAssignments();

      const adminInsert = mockClient.query.mock.calls.find(
        (call) =>
          call[0].includes('INSERT INTO notifications') &&
          call[1] &&
          call[1][0] === 200
      );

      expect(adminInsert[0]).toContain("'Alerta de Território em Aberto'");
    });

    it('should include dirigente name in admin notification message', async () => {
      await notifyOverdueAssignments();

      const adminInsert = mockClient.query.mock.calls.find(
        (call) =>
          call[0].includes('INSERT INTO notifications') &&
          call[1] &&
          call[1][0] === 200
      );

      expect(adminInsert[1][1]).toContain('Carlos Santos');
    });

    it('should include assignment_id in all notifications', async () => {
      await notifyOverdueAssignments();

      const insertCalls = mockClient.query.mock.calls.filter((call) =>
        call[0].includes('INSERT INTO notifications')
      );

      insertCalls.forEach((call) => {
        expect(call[1][2]).toBe(42); // assignment_id
      });
    });

    it('should include correct URL in push notification data', async () => {
      await notifyOverdueAssignments();

      mockSendPushToUser.mock.calls.forEach((call) => {
        expect(call[1].data.url).toBe('/assignment/42');
        expect(call[1].data.assignmentId).toBe(42);
      });
    });
  });

  describe('SQL query structure', () => {
    it('should join with territories table', async () => {
      await notifyOverdueAssignments();

      const selectQuery = mockClient.query.mock.calls[0][0];
      expect(selectQuery).toContain('JOIN territories t ON t.id = a.territory_id');
    });

    it('should join with users table for dirigente name', async () => {
      await notifyOverdueAssignments();

      const selectQuery = mockClient.query.mock.calls[0][0];
      expect(selectQuery).toContain('JOIN users u ON u.id = a.dirigente_id');
    });

    it('should select all required fields', async () => {
      await notifyOverdueAssignments();

      const selectQuery = mockClient.query.mock.calls[0][0];
      expect(selectQuery).toContain('a.id');
      expect(selectQuery).toContain('a.territory_id');
      expect(selectQuery).toContain('a.dirigente_id');
      expect(selectQuery).toContain('a.assigned_by');
      expect(selectQuery).toContain('a.assigned_date');
      expect(selectQuery).toContain('t.territory_code');
      expect(selectQuery).toContain('t.locality');
      expect(selectQuery).toContain('u.name as dirigente_name');
    });
  });

  describe('exported constants', () => {
    it('should export TEN_DAYS_MS as 10 days in milliseconds', () => {
      expect(TEN_DAYS_MS).toBe(10 * 24 * 60 * 60 * 1000);
    });

    it('should export DEFAULT_INTERVAL_MS as 12 hours in milliseconds', () => {
      expect(DEFAULT_INTERVAL_MS).toBe(12 * 60 * 60 * 1000);
    });
  });

  describe('default export', () => {
    it('should export startOverdueNotifier as default', () => {
      expect(defaultExport).toBe(startOverdueNotifier);
    });
  });
});
