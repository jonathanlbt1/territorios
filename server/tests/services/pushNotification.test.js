import { jest } from '@jest/globals';

// Mock pool
const mockPool = {
  query: jest.fn(),
};

// Mock webpush
const mockWebpush = {
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
};

// Store original env
const originalEnv = { ...process.env };

// Set VAPID env vars before mocking and importing
process.env.VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
process.env.VAPID_PRIVATE_KEY = 'UUxI4O8-FbRouAf7-LqxJNasGRYV9hN7NAM8lIFQPrY';
process.env.VAPID_SUBJECT = 'https://test.example.com';

// Mock modules before importing
jest.unstable_mockModule('../../src/db/config.js', () => ({
  default: mockPool,
}));

jest.unstable_mockModule('web-push', () => ({
  default: mockWebpush,
}));

// Import module once after mocks are set
const { sendPushToUser, sendPushToUsers, sendPushToAdmins, getVapidPublicKey } = 
  await import('../../src/services/pushNotification.js');

describe('Push Notification Service', () => {
  let consoleLogSpy;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockReset();
    mockWebpush.sendNotification.mockReset();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  afterAll(() => {
    // Restore env
    process.env = { ...originalEnv };
  });

  describe('sendPushToUser', () => {
    const userId = 5;
    const payload = {
      title: 'Test Notification',
      body: 'This is a test',
    };

    describe('successful push', () => {
      beforeEach(() => {
        mockPool.query.mockResolvedValue({
          rows: [{
            id: 1,
            user_id: 5,
            endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
            p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
            auth: 'tBHItJI5svbpez7KI4CCXg',
          }],
        });
        mockWebpush.sendNotification.mockResolvedValue({ statusCode: 201 });
      });

      it('should query user subscriptions', async () => {
        await sendPushToUser(userId, payload);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('FROM push_subscriptions WHERE user_id'),
          [5]
        );
      });

      it('should send notification via webpush', async () => {
        await sendPushToUser(userId, payload);

        expect(mockWebpush.sendNotification).toHaveBeenCalled();
      });

      it('should return success with results', async () => {
        const result = await sendPushToUser(userId, payload);

        expect(result.success).toBe(true);
        expect(result.results).toHaveLength(1);
        expect(result.results[0].success).toBe(true);
      });

      it('should format subscription correctly', async () => {
        await sendPushToUser(userId, payload);

        expect(mockWebpush.sendNotification).toHaveBeenCalledWith(
          {
            endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
            keys: {
              p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
              auth: 'tBHItJI5svbpez7KI4CCXg',
            },
          },
          expect.any(String)
        );
      });

      it('should include title and body in payload', async () => {
        await sendPushToUser(userId, payload);

        const payloadArg = mockWebpush.sendNotification.mock.calls[0][1];
        const parsed = JSON.parse(payloadArg);

        expect(parsed.title).toBe('Test Notification');
        expect(parsed.body).toBe('This is a test');
      });

      it('should use default values for missing payload fields', async () => {
        await sendPushToUser(userId, {});

        const payloadArg = mockWebpush.sendNotification.mock.calls[0][1];
        const parsed = JSON.parse(payloadArg);

        expect(parsed.title).toBe('Territórios');
        expect(parsed.body).toBe('');
        expect(parsed.icon).toBe('/icon-192.png');
        expect(parsed.badge).toBe('/icon-badge.png');
        expect(parsed.requireInteraction).toBe(false);
      });

      it('should include custom data in payload', async () => {
        await sendPushToUser(userId, {
          ...payload,
          data: { assignmentId: 42 },
        });

        const payloadArg = mockWebpush.sendNotification.mock.calls[0][1];
        const parsed = JSON.parse(payloadArg);

        expect(parsed.data.assignmentId).toBe(42);
      });

      it('should include custom tag', async () => {
        await sendPushToUser(userId, {
          ...payload,
          tag: 'custom-tag-123',
        });

        const payloadArg = mockWebpush.sendNotification.mock.calls[0][1];
        const parsed = JSON.parse(payloadArg);

        expect(parsed.tag).toBe('custom-tag-123');
      });

      it('should generate default tag with timestamp', async () => {
        await sendPushToUser(userId, payload);

        const payloadArg = mockWebpush.sendNotification.mock.calls[0][1];
        const parsed = JSON.parse(payloadArg);

        expect(parsed.tag).toMatch(/^notification-\d+$/);
      });
    });

    describe('no subscriptions', () => {
      it('should return no_subscriptions when user has none', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        const result = await sendPushToUser(userId, payload);

        expect(result.success).toBe(false);
        expect(result.reason).toBe('no_subscriptions');
      });
    });

    describe('multiple subscriptions', () => {
      beforeEach(() => {
        mockPool.query.mockResolvedValue({
          rows: [
            { id: 1, endpoint: 'https://endpoint1.com', p256dh: 'key1', auth: 'auth1' },
            { id: 2, endpoint: 'https://endpoint2.com', p256dh: 'key2', auth: 'auth2' },
            { id: 3, endpoint: 'https://endpoint3.com', p256dh: 'key3', auth: 'auth3' },
          ],
        });
        mockWebpush.sendNotification.mockResolvedValue({ statusCode: 201 });
      });

      it('should send to all subscriptions', async () => {
        await sendPushToUser(userId, payload);

        expect(mockWebpush.sendNotification).toHaveBeenCalledTimes(3);
      });

      it('should return results for each subscription', async () => {
        const result = await sendPushToUser(userId, payload);

        expect(result.results).toHaveLength(3);
      });

      it('should include endpoint in each result', async () => {
        const result = await sendPushToUser(userId, payload);

        expect(result.results[0].endpoint).toBe('https://endpoint1.com');
        expect(result.results[1].endpoint).toBe('https://endpoint2.com');
        expect(result.results[2].endpoint).toBe('https://endpoint3.com');
      });
    });

    describe('invalid subscription handling', () => {
      it('should remove subscription on 410 Gone', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{ id: 99, endpoint: 'https://expired.com', p256dh: 'key', auth: 'auth' }],
        });
        mockPool.query.mockResolvedValueOnce({ rowCount: 1 }); // DELETE
        
        const error = new Error('Subscription expired');
        error.statusCode = 410;
        mockWebpush.sendNotification.mockRejectedValue(error);

        await sendPushToUser(userId, payload);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM push_subscriptions'),
          [99]
        );
      });

      it('should remove subscription on 404 Not Found', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{ id: 88, endpoint: 'https://notfound.com', p256dh: 'key', auth: 'auth' }],
        });
        mockPool.query.mockResolvedValueOnce({ rowCount: 1 }); // DELETE
        
        const error = new Error('Not found');
        error.statusCode = 404;
        mockWebpush.sendNotification.mockRejectedValue(error);

        await sendPushToUser(userId, payload);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM push_subscriptions'),
          [88]
        );
      });

      it('should not remove subscription on other errors', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 77, endpoint: 'https://error.com', p256dh: 'key', auth: 'auth' }],
        });
        
        const error = new Error('Server error');
        error.statusCode = 500;
        mockWebpush.sendNotification.mockRejectedValue(error);

        await sendPushToUser(userId, payload);

        // Only the initial SELECT query should be called
        expect(mockPool.query).toHaveBeenCalledTimes(1);
      });

      it('should log error on push failure', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 1, endpoint: 'https://error.com', p256dh: 'key', auth: 'auth' }],
        });
        mockWebpush.sendNotification.mockRejectedValue(new Error('Push failed'));

        await sendPushToUser(userId, payload);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Push notification error:',
          'Push failed'
        );
      });

      it('should include error in results', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 1, endpoint: 'https://error.com', p256dh: 'key', auth: 'auth' }],
        });
        mockWebpush.sendNotification.mockRejectedValue(new Error('Network error'));

        const result = await sendPushToUser(userId, payload);

        expect(result.results[0].success).toBe(false);
        expect(result.results[0].error).toBe('Network error');
      });

      it('should log removed subscription id', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{ id: 123, endpoint: 'https://expired.com', p256dh: 'key', auth: 'auth' }],
        });
        mockPool.query.mockResolvedValueOnce({ rowCount: 1 }); // DELETE
        
        const error = new Error('Gone');
        error.statusCode = 410;
        mockWebpush.sendNotification.mockRejectedValue(error);

        await sendPushToUser(userId, payload);

        expect(consoleLogSpy).toHaveBeenCalledWith(
          'Removed invalid subscription 123'
        );
      });
    });

    describe('mixed results', () => {
      it('should handle partial success', async () => {
        mockPool.query.mockResolvedValue({
          rows: [
            { id: 1, endpoint: 'https://success.com', p256dh: 'key1', auth: 'auth1' },
            { id: 2, endpoint: 'https://fail.com', p256dh: 'key2', auth: 'auth2' },
          ],
        });
        
        mockWebpush.sendNotification
          .mockResolvedValueOnce({ statusCode: 201 })
          .mockRejectedValueOnce(new Error('Failed'));

        const result = await sendPushToUser(userId, payload);

        expect(result.success).toBe(true);
        expect(result.results[0].success).toBe(true);
        expect(result.results[1].success).toBe(false);
      });
    });

    describe('error handling', () => {
      it('should return error result on database failure', async () => {
        mockPool.query.mockRejectedValue(new Error('DB connection failed'));

        const result = await sendPushToUser(userId, payload);

        expect(result.success).toBe(false);
        expect(result.reason).toBe('error');
        expect(result.error).toBe('DB connection failed');
      });

      it('should log error on database failure', async () => {
        mockPool.query.mockRejectedValue(new Error('DB error'));

        await sendPushToUser(userId, payload);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Send push to user error:',
          expect.any(Error)
        );
      });
    });
  });

  describe('sendPushToUsers', () => {
    const payload = { title: 'Test', body: 'Test message' };

    beforeEach(() => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 1, endpoint: 'https://test.com', p256dh: 'key', auth: 'auth' }],
      });
      mockWebpush.sendNotification.mockResolvedValue({ statusCode: 201 });
    });

    it('should send to all users', async () => {
      const results = await sendPushToUsers([1, 2, 3], payload);

      expect(results).toHaveLength(3);
      expect(mockPool.query).toHaveBeenCalledTimes(3);
    });

    it('should include userId in each result', async () => {
      const results = await sendPushToUsers([5, 10, 15], payload);

      expect(results[0].userId).toBe(5);
      expect(results[1].userId).toBe(10);
      expect(results[2].userId).toBe(15);
    });

    it('should handle empty user list', async () => {
      const results = await sendPushToUsers([], payload);

      expect(results).toEqual([]);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should continue on individual failures', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, endpoint: 'e1', p256dh: 'k1', auth: 'a1' }] })
        .mockRejectedValueOnce(new Error('User 2 failed'))
        .mockResolvedValueOnce({ rows: [{ id: 3, endpoint: 'e3', p256dh: 'k3', auth: 'a3' }] });

      const results = await sendPushToUsers([1, 2, 3], payload);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });

    it('should process users sequentially', async () => {
      const callOrder = [];
      mockPool.query.mockImplementation(async (query, params) => {
        if (params?.[0]) {
          callOrder.push(params[0]);
        }
        return { rows: [{ id: 1, endpoint: 'e', p256dh: 'k', auth: 'a' }] };
      });

      await sendPushToUsers([5, 10, 15], payload);

      expect(callOrder).toEqual([5, 10, 15]);
    });
  });

  describe('sendPushToAdmins', () => {
    const payload = { title: 'Admin Alert', body: 'Important' };

    describe('successful admin push', () => {
      beforeEach(() => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] }) // admin query
          .mockResolvedValue({ rows: [{ id: 1, endpoint: 'e', p256dh: 'k', auth: 'a' }] });
        mockWebpush.sendNotification.mockResolvedValue({ statusCode: 201 });
      });

      it('should query for admin users', async () => {
        await sendPushToAdmins(payload);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining("role = 'admin'")
        );
      });

      it('should send to all admins', async () => {
        const results = await sendPushToAdmins(payload);

        expect(results).toHaveLength(2);
      });

      it('should query SELECT id FROM users', async () => {
        await sendPushToAdmins(payload);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT id FROM users')
        );
      });
    });

    describe('no admins', () => {
      it('should return empty array when no admins exist', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        const results = await sendPushToAdmins(payload);

        expect(results).toEqual([]);
      });
    });

    describe('error handling', () => {
      it('should return error on admin query failure', async () => {
        mockPool.query.mockRejectedValue(new Error('Query failed'));

        const result = await sendPushToAdmins(payload);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Query failed');
      });

      it('should log error on failure', async () => {
        mockPool.query.mockRejectedValue(new Error('Admin query error'));

        await sendPushToAdmins(payload);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Send push to admins error:',
          expect.any(Error)
        );
      });
    });
  });

  describe('getVapidPublicKey', () => {
    it('should return the public key', () => {
      const key = getVapidPublicKey();

      expect(key).toBe('BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U');
    });

    it('should be a string', () => {
      const key = getVapidPublicKey();

      expect(typeof key).toBe('string');
    });
  });

  describe('Security', () => {
    it('should use parameterized queries for subscription lookup', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await sendPushToUser(1, { title: 'Test' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('$1'),
        expect.any(Array)
      );
    });

    it('should use parameterized queries for subscription deletion', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 1, endpoint: 'e', p256dh: 'k', auth: 'a' }],
      });
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 }); // DELETE result
      
      const error = new Error('Gone');
      error.statusCode = 410;
      mockWebpush.sendNotification.mockRejectedValue(error);

      await sendPushToUser(1, { title: 'Test' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE'),
        expect.any(Array)
      );
    });
  });

  describe('Default export', () => {
    it('should export sendPushToUser', async () => {
      const module = await import('../../src/services/pushNotification.js');
      expect(module.default).toHaveProperty('sendPushToUser');
    });

    it('should export sendPushToUsers', async () => {
      const module = await import('../../src/services/pushNotification.js');
      expect(module.default).toHaveProperty('sendPushToUsers');
    });

    it('should export sendPushToAdmins', async () => {
      const module = await import('../../src/services/pushNotification.js');
      expect(module.default).toHaveProperty('sendPushToAdmins');
    });

    it('should export getVapidPublicKey', async () => {
      const module = await import('../../src/services/pushNotification.js');
      expect(module.default).toHaveProperty('getVapidPublicKey');
    });
  });

  describe('Edge cases', () => {
    it('should handle very long notification body', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 1, endpoint: 'e', p256dh: 'k', auth: 'a' }],
      });
      mockWebpush.sendNotification.mockResolvedValue({ statusCode: 201 });

      const longBody = 'A'.repeat(5000);
      await sendPushToUser(1, { title: 'Test', body: longBody });

      expect(mockWebpush.sendNotification).toHaveBeenCalled();
    });

    it('should handle unicode in payload', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 1, endpoint: 'e', p256dh: 'k', auth: 'a' }],
      });
      mockWebpush.sendNotification.mockResolvedValue({ statusCode: 201 });

      await sendPushToUser(1, {
        title: '通知 🔔',
        body: 'Mensagem com emojis 🎉 e acentos ção',
      });

      const payloadArg = mockWebpush.sendNotification.mock.calls[0][1];
      const parsed = JSON.parse(payloadArg);

      expect(parsed.title).toBe('通知 🔔');
      expect(parsed.body).toContain('🎉');
    });

    it('should handle special characters in payload', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 1, endpoint: 'e', p256dh: 'k', auth: 'a' }],
      });
      mockWebpush.sendNotification.mockResolvedValue({ statusCode: 201 });

      await sendPushToUser(1, {
        title: 'Test "quotes" & <html>',
        body: "Single 'quotes' and backslashes \\",
      });

      // Should not throw
      expect(mockWebpush.sendNotification).toHaveBeenCalled();
    });

    it('should handle requireInteraction option', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 1, endpoint: 'e', p256dh: 'k', auth: 'a' }],
      });
      mockWebpush.sendNotification.mockResolvedValue({ statusCode: 201 });

      await sendPushToUser(1, {
        title: 'Important',
        body: 'Requires interaction',
        requireInteraction: true,
      });

      const payloadArg = mockWebpush.sendNotification.mock.calls[0][1];
      const parsed = JSON.parse(payloadArg);

      expect(parsed.requireInteraction).toBe(true);
    });

    it('should handle custom icon and badge', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 1, endpoint: 'e', p256dh: 'k', auth: 'a' }],
      });
      mockWebpush.sendNotification.mockResolvedValue({ statusCode: 201 });

      await sendPushToUser(1, {
        title: 'Test',
        body: 'Body',
        icon: '/custom-icon.png',
        badge: '/custom-badge.png',
      });

      const payloadArg = mockWebpush.sendNotification.mock.calls[0][1];
      const parsed = JSON.parse(payloadArg);

      expect(parsed.icon).toBe('/custom-icon.png');
      expect(parsed.badge).toBe('/custom-badge.png');
    });

    it('should handle empty data object', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 1, endpoint: 'e', p256dh: 'k', auth: 'a' }],
      });
      mockWebpush.sendNotification.mockResolvedValue({ statusCode: 201 });

      await sendPushToUser(1, {
        title: 'Test',
        body: 'Body',
        data: {},
      });

      const payloadArg = mockWebpush.sendNotification.mock.calls[0][1];
      const parsed = JSON.parse(payloadArg);

      expect(parsed.data).toEqual({});
    });

    it('should handle complex data object', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 1, endpoint: 'e', p256dh: 'k', auth: 'a' }],
      });
      mockWebpush.sendNotification.mockResolvedValue({ statusCode: 201 });

      const complexData = {
        assignmentId: 42,
        url: '/assignments/42',
        nested: { a: 1, b: 2 },
        array: [1, 2, 3],
      };

      await sendPushToUser(1, {
        title: 'Test',
        body: 'Body',
        data: complexData,
      });

      const payloadArg = mockWebpush.sendNotification.mock.calls[0][1];
      const parsed = JSON.parse(payloadArg);

      expect(parsed.data).toEqual(complexData);
    });
  });

  describe('Payload structure', () => {
    beforeEach(() => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 1, endpoint: 'e', p256dh: 'k', auth: 'a' }],
      });
      mockWebpush.sendNotification.mockResolvedValue({ statusCode: 201 });
    });

    it('should create valid JSON payload', async () => {
      await sendPushToUser(1, { title: 'Test', body: 'Body' });

      const payloadArg = mockWebpush.sendNotification.mock.calls[0][1];
      
      // Should not throw
      expect(() => JSON.parse(payloadArg)).not.toThrow();
    });

    it('should include all required fields', async () => {
      await sendPushToUser(1, { title: 'T', body: 'B' });

      const payloadArg = mockWebpush.sendNotification.mock.calls[0][1];
      const parsed = JSON.parse(payloadArg);

      expect(parsed).toHaveProperty('title');
      expect(parsed).toHaveProperty('body');
      expect(parsed).toHaveProperty('icon');
      expect(parsed).toHaveProperty('badge');
      expect(parsed).toHaveProperty('data');
      expect(parsed).toHaveProperty('tag');
      expect(parsed).toHaveProperty('requireInteraction');
    });
  });
});
