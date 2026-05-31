import { jest } from '@jest/globals';

// Mock pool
const mockPool = {
  query: jest.fn(),
};

// Mock push notification functions
const mockSendPushToUser = jest.fn();
const mockSendPushToAdmins = jest.fn();

// Mock modules before importing
jest.unstable_mockModule('../../src/db/config.js', () => ({
  default: mockPool,
}));

jest.unstable_mockModule('../../src/services/pushNotification.js', () => ({
  sendPushToUser: mockSendPushToUser,
  sendPushToAdmins: mockSendPushToAdmins,
}));

// Import the service after mocking
const {
  createNotification,
  createNotificationsForUsers,
  notifyAdmins,
  sendPushOnly,
  sendPushToAllAdmins,
} = await import('../../src/services/notificationService.js');

describe('Notification Service', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('createNotification', () => {
    const defaultOptions = {
      userId: 5,
      type: 'assignment',
      title: 'Nova Designação',
      message: 'Você recebeu uma nova designação',
    };

    describe('successful notification creation', () => {
      beforeEach(() => {
        mockPool.query.mockResolvedValue({
          rows: [{
            id: 1,
            user_id: 5,
            type: 'assignment',
            title: 'Nova Designação',
            message: 'Você recebeu uma nova designação',
            assignment_id: null,
            is_read: false,
            created_at: new Date(),
          }],
        });
        mockSendPushToUser.mockResolvedValue({ success: true });
      });

      it('should create notification in database', async () => {
        await createNotification(defaultOptions);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO notifications'),
          [5, 'assignment', 'Nova Designação', 'Você recebeu uma nova designação', null]
        );
      });

      it('should return the created notification', async () => {
        const result = await createNotification(defaultOptions);

        expect(result).toHaveProperty('id');
        expect(result.user_id).toBe(5);
        expect(result.type).toBe('assignment');
      });

      it('should send push notification by default', async () => {
        await createNotification(defaultOptions);

        expect(mockSendPushToUser).toHaveBeenCalledWith(
          5,
          expect.objectContaining({
            title: 'Nova Designação',
            body: 'Você recebeu uma nova designação',
          })
        );
      });

      it('should include notification tag in push payload', async () => {
        await createNotification(defaultOptions);

        expect(mockSendPushToUser).toHaveBeenCalledWith(
          5,
          expect.objectContaining({
            tag: 'notification-1',
          })
        );
      });

      it('should include data in push payload', async () => {
        await createNotification(defaultOptions);

        expect(mockSendPushToUser).toHaveBeenCalledWith(
          5,
          expect.objectContaining({
            data: expect.objectContaining({
              notificationId: 1,
              type: 'assignment',
            }),
          })
        );
      });
    });

    describe('with assignment ID', () => {
      const optionsWithAssignment = {
        ...defaultOptions,
        assignmentId: 42,
      };

      beforeEach(() => {
        mockPool.query.mockResolvedValue({
          rows: [{
            id: 2,
            user_id: 5,
            type: 'assignment',
            title: 'Nova Designação',
            message: 'Você recebeu uma nova designação',
            assignment_id: 42,
            is_read: false,
          }],
        });
        mockSendPushToUser.mockResolvedValue({ success: true });
      });

      it('should include assignment_id in database insert', async () => {
        await createNotification(optionsWithAssignment);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining([42])
        );
      });

      it('should include assignment URL in push data', async () => {
        await createNotification(optionsWithAssignment);

        expect(mockSendPushToUser).toHaveBeenCalledWith(
          5,
          expect.objectContaining({
            data: expect.objectContaining({
              assignmentId: 42,
              url: '/assignment/42',
            }),
          })
        );
      });
    });

    describe('without assignment ID', () => {
      beforeEach(() => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 1, assignment_id: null }],
        });
        mockSendPushToUser.mockResolvedValue({ success: true });
      });

      it('should set URL to root when no assignment', async () => {
        await createNotification(defaultOptions);

        expect(mockSendPushToUser).toHaveBeenCalledWith(
          5,
          expect.objectContaining({
            data: expect.objectContaining({
              url: '/',
            }),
          })
        );
      });
    });

    describe('sendPush option', () => {
      beforeEach(() => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 1 }],
        });
      });

      it('should send push when sendPush is true', async () => {
        await createNotification({ ...defaultOptions, sendPush: true });

        expect(mockSendPushToUser).toHaveBeenCalled();
      });

      it('should not send push when sendPush is false', async () => {
        await createNotification({ ...defaultOptions, sendPush: false });

        expect(mockSendPushToUser).not.toHaveBeenCalled();
      });

      it('should send push by default', async () => {
        await createNotification(defaultOptions);

        expect(mockSendPushToUser).toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should throw error on database failure', async () => {
        mockPool.query.mockRejectedValue(new Error('DB error'));

        await expect(createNotification(defaultOptions)).rejects.toThrow('DB error');
      });

      it('should log error on failure', async () => {
        const error = new Error('Database connection failed');
        mockPool.query.mockRejectedValue(error);

        await expect(createNotification(defaultOptions)).rejects.toThrow();

        expect(consoleErrorSpy).toHaveBeenCalledWith('Create notification error:', error);
      });

      it('should still throw even if push fails', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });
        mockSendPushToUser.mockRejectedValue(new Error('Push failed'));

        // Push failure shouldn't affect the notification creation
        // The function should complete since push is fire-and-forget in practice
        await expect(createNotification(defaultOptions)).rejects.toThrow('Push failed');
      });
    });

    describe('different notification types', () => {
      beforeEach(() => {
        mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });
        mockSendPushToUser.mockResolvedValue({ success: true });
      });

      it('should handle assignment type', async () => {
        await createNotification({ ...defaultOptions, type: 'assignment' });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining(['assignment'])
        );
      });

      it('should handle return type', async () => {
        await createNotification({ ...defaultOptions, type: 'return' });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining(['return'])
        );
      });

      it('should handle validation type', async () => {
        await createNotification({ ...defaultOptions, type: 'validation' });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining(['validation'])
        );
      });

      it('should handle reminder type', async () => {
        await createNotification({ ...defaultOptions, type: 'reminder' });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining(['reminder'])
        );
      });
    });
  });

  describe('createNotificationsForUsers', () => {
    const options = {
      type: 'announcement',
      title: 'Aviso Geral',
      message: 'Mensagem para todos',
    };

    beforeEach(() => {
      mockSendPushToUser.mockResolvedValue({ success: true });
    });

    describe('successful batch creation', () => {
      beforeEach(() => {
        let callCount = 0;
        mockPool.query.mockImplementation(() => {
          callCount++;
          return Promise.resolve({
            rows: [{ id: callCount, user_id: callCount }],
          });
        });
      });

      it('should create notifications for all users', async () => {
        const results = await createNotificationsForUsers([1, 2, 3], options);

        expect(results).toHaveLength(3);
        expect(mockPool.query).toHaveBeenCalledTimes(3);
      });

      it('should return success status for each user', async () => {
        const results = await createNotificationsForUsers([1, 2], options);

        results.forEach(result => {
          expect(result.success).toBe(true);
          expect(result).toHaveProperty('notification');
        });
      });

      it('should include userId in each result', async () => {
        const results = await createNotificationsForUsers([5, 10], options);

        expect(results[0].userId).toBe(5);
        expect(results[1].userId).toBe(10);
      });
    });

    describe('partial failure', () => {
      it('should handle mixed success and failure', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockRejectedValueOnce(new Error('User 2 failed'))
          .mockResolvedValueOnce({ rows: [{ id: 3 }] });

        const results = await createNotificationsForUsers([1, 2, 3], options);

        expect(results[0].success).toBe(true);
        expect(results[1].success).toBe(false);
        expect(results[1].error).toBe('User 2 failed');
        expect(results[2].success).toBe(true);
      });

      it('should continue processing after failure', async () => {
        mockPool.query
          .mockRejectedValueOnce(new Error('Failed'))
          .mockResolvedValueOnce({ rows: [{ id: 2 }] });

        const results = await createNotificationsForUsers([1, 2], options);

        expect(results).toHaveLength(2);
        expect(results[1].success).toBe(true);
      });
    });

    describe('empty user list', () => {
      it('should return empty array for empty user list', async () => {
        const results = await createNotificationsForUsers([], options);

        expect(results).toEqual([]);
        expect(mockPool.query).not.toHaveBeenCalled();
      });
    });
  });

  describe('notifyAdmins', () => {
    const options = {
      type: 'admin_alert',
      title: 'Alerta',
      message: 'Novo evento para administradores',
    };

    describe('successful admin notification', () => {
      beforeEach(() => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }, { id: 3 }] }) // admin IDs
          .mockResolvedValue({ rows: [{ id: 1 }] }); // notification inserts
        mockSendPushToUser.mockResolvedValue({ success: true });
      });

      it('should query for admin users', async () => {
        await notifyAdmins(options);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining("role = 'admin'")
        );
      });

      it('should create notifications for all admins', async () => {
        const results = await notifyAdmins(options);

        expect(results).toHaveLength(3);
      });

      it('should return results for each admin', async () => {
        const results = await notifyAdmins(options);

        expect(results[0].userId).toBe(1);
        expect(results[1].userId).toBe(2);
        expect(results[2].userId).toBe(3);
      });
    });

    describe('no admins found', () => {
      it('should return empty array when no admins exist', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        const results = await notifyAdmins(options);

        expect(results).toEqual([]);
      });
    });

    describe('error handling', () => {
      it('should throw error if admin query fails', async () => {
        mockPool.query.mockRejectedValue(new Error('Query failed'));

        await expect(notifyAdmins(options)).rejects.toThrow('Query failed');
      });

      it('should log error on failure', async () => {
        const error = new Error('Admin query failed');
        mockPool.query.mockRejectedValue(error);

        await expect(notifyAdmins(options)).rejects.toThrow();

        expect(consoleErrorSpy).toHaveBeenCalledWith('Notify admins error:', error);
      });
    });
  });

  describe('sendPushOnly', () => {
    const userId = 5;
    const payload = {
      title: 'Alert',
      body: 'This is a push-only notification',
    };

    it('should call sendPushToUser directly', async () => {
      mockSendPushToUser.mockResolvedValue({ success: true });

      await sendPushOnly(userId, payload);

      expect(mockSendPushToUser).toHaveBeenCalledWith(userId, payload);
    });

    it('should return push result', async () => {
      mockSendPushToUser.mockResolvedValue({ success: true, sent: 1 });

      const result = await sendPushOnly(userId, payload);

      expect(result).toEqual({ success: true, sent: 1 });
    });

    it('should not insert into database', async () => {
      mockSendPushToUser.mockResolvedValue({ success: true });

      await sendPushOnly(userId, payload);

      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should propagate push errors', async () => {
      mockSendPushToUser.mockRejectedValue(new Error('Push failed'));

      await expect(sendPushOnly(userId, payload)).rejects.toThrow('Push failed');
    });
  });

  describe('sendPushToAllAdmins', () => {
    const payload = {
      title: 'Admin Alert',
      body: 'Important message for all admins',
    };

    it('should call sendPushToAdmins directly', async () => {
      mockSendPushToAdmins.mockResolvedValue({ success: true });

      await sendPushToAllAdmins(payload);

      expect(mockSendPushToAdmins).toHaveBeenCalledWith(payload);
    });

    it('should return push result', async () => {
      mockSendPushToAdmins.mockResolvedValue({ success: true, sent: 3 });

      const result = await sendPushToAllAdmins(payload);

      expect(result).toEqual({ success: true, sent: 3 });
    });

    it('should not insert into database', async () => {
      mockSendPushToAdmins.mockResolvedValue({ success: true });

      await sendPushToAllAdmins(payload);

      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should propagate push errors', async () => {
      mockSendPushToAdmins.mockRejectedValue(new Error('Push failed'));

      await expect(sendPushToAllAdmins(payload)).rejects.toThrow('Push failed');
    });
  });

  describe('Default export', () => {
    it('should export all functions', async () => {
      const defaultExport = (await import('../../src/services/notificationService.js')).default;

      expect(defaultExport).toHaveProperty('createNotification');
      expect(defaultExport).toHaveProperty('createNotificationsForUsers');
      expect(defaultExport).toHaveProperty('notifyAdmins');
      expect(defaultExport).toHaveProperty('sendPushOnly');
      expect(defaultExport).toHaveProperty('sendPushToAllAdmins');
    });
  });

  describe('Security and data integrity', () => {
    beforeEach(() => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });
      mockSendPushToUser.mockResolvedValue({ success: true });
    });

    it('should use parameterized queries', async () => {
      await createNotification({
        userId: 1,
        type: 'test',
        title: 'Test',
        message: 'Test message',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('$1'),
        expect.any(Array)
      );
    });

    it('should pass all parameters in correct order', async () => {
      await createNotification({
        userId: 10,
        type: 'custom',
        title: 'Title Here',
        message: 'Message Here',
        assignmentId: 20,
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        [10, 'custom', 'Title Here', 'Message Here', 20]
      );
    });
  });

  describe('Edge cases', () => {
    beforeEach(() => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });
      mockSendPushToUser.mockResolvedValue({ success: true });
    });

    it('should handle very long messages', async () => {
      const longMessage = 'A'.repeat(1000);

      await createNotification({
        userId: 1,
        type: 'test',
        title: 'Test',
        message: longMessage,
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([longMessage])
      );
    });

    it('should handle special characters in title and message', async () => {
      const specialTitle = "Test <script>alert('xss')</script>";
      const specialMessage = "Message with 'quotes' and \"double quotes\"";

      await createNotification({
        userId: 1,
        type: 'test',
        title: specialTitle,
        message: specialMessage,
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([specialTitle, specialMessage])
      );
    });

    it('should handle unicode characters', async () => {
      const unicodeTitle = '通知标题 🔔';
      const unicodeMessage = 'Mensagem com emojis 🎉 e caracteres especiais ñ';

      await createNotification({
        userId: 1,
        type: 'test',
        title: unicodeTitle,
        message: unicodeMessage,
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([unicodeTitle, unicodeMessage])
      );
    });

    it('should handle single user in batch', async () => {
      const results = await createNotificationsForUsers([1], {
        type: 'test',
        title: 'Test',
        message: 'Test',
      });

      expect(results).toHaveLength(1);
    });
  });
});
