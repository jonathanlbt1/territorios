import { jest } from '@jest/globals';

// Mock pool
const mockPool = {
  query: jest.fn(),
};

// Mock authenticateToken middleware
const mockAuthenticateToken = jest.fn((req, res, next) => next());

// Mock getVapidPublicKey
const mockGetVapidPublicKey = jest.fn();

// Mock modules before importing
jest.unstable_mockModule('../../src/db/config.js', () => ({
  default: mockPool,
}));

jest.unstable_mockModule('../../src/middleware/auth.js', () => ({
  authenticateToken: mockAuthenticateToken,
}));

jest.unstable_mockModule('../../src/services/pushNotification.js', () => ({
  getVapidPublicKey: mockGetVapidPublicKey,
}));

// Import express and create test app
const express = (await import('express')).default;
const { default: pushRouter } = await import('../../src/routes/push.js');

// Create test app
const app = express();
app.use(express.json());
app.use('/push', pushRouter);

// Import supertest for HTTP testing
const request = (await import('supertest')).default;

describe('Push Routes', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('GET /push/vapid-public-key', () => {
    it('should not require authentication', async () => {
      mockGetVapidPublicKey.mockReturnValue('test-public-key');

      const response = await request(app).get('/push/vapid-public-key');

      expect(response.status).toBe(200);
      expect(mockAuthenticateToken).not.toHaveBeenCalled();
    });

    it('should return public key when configured', async () => {
      mockGetVapidPublicKey.mockReturnValue('BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U');

      const response = await request(app).get('/push/vapid-public-key');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        publicKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
        configured: true,
      });
    });

    it('should return 503 when not configured (null)', async () => {
      mockGetVapidPublicKey.mockReturnValue(null);

      const response = await request(app).get('/push/vapid-public-key');

      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        error: 'Push notifications not configured',
        configured: false,
      });
    });

    it('should return 503 when not configured (undefined)', async () => {
      mockGetVapidPublicKey.mockReturnValue(undefined);

      const response = await request(app).get('/push/vapid-public-key');

      expect(response.status).toBe(503);
      expect(response.body.configured).toBe(false);
    });

    it('should return 503 when not configured (empty string)', async () => {
      mockGetVapidPublicKey.mockReturnValue('');

      const response = await request(app).get('/push/vapid-public-key');

      expect(response.status).toBe(503);
      expect(response.body.configured).toBe(false);
    });
  });

  describe('POST /push/subscribe', () => {
    const validSubscription = {
      subscription: {
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
        keys: {
          p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
          auth: 'tBHItJI5svbpez7KI4CCXg',
        },
      },
    };

    describe('authentication', () => {
      it('should require authentication', async () => {
        mockAuthenticateToken.mockImplementation((req, res, next) => {
          res.status(401).json({ error: 'Unauthorized' });
        });

        const response = await request(app)
          .post('/push/subscribe')
          .send(validSubscription);

        expect(response.status).toBe(401);
      });

      it('should pass when authenticated', async () => {
        mockAuthenticateToken.mockImplementation((req, res, next) => {
          req.user = { id: 1 };
          next();
        });
        mockPool.query.mockResolvedValue({ rows: [] });

        const response = await request(app)
          .post('/push/subscribe')
          .send(validSubscription);

        expect(response.status).toBe(200);
      });
    });

    describe('validation', () => {
      beforeEach(() => {
        mockAuthenticateToken.mockImplementation((req, res, next) => {
          req.user = { id: 1 };
          next();
        });
      });

      it('should return 400 when subscription is missing', async () => {
        const response = await request(app)
          .post('/push/subscribe')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid subscription data');
      });

      it('should return 400 when endpoint is missing', async () => {
        const response = await request(app)
          .post('/push/subscribe')
          .send({
            subscription: {
              keys: { p256dh: 'key', auth: 'auth' },
            },
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid subscription data');
      });

      it('should return 400 when keys are missing', async () => {
        const response = await request(app)
          .post('/push/subscribe')
          .send({
            subscription: {
              endpoint: 'https://example.com',
            },
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid subscription data');
      });

      it('should return 400 when p256dh key is missing', async () => {
        const response = await request(app)
          .post('/push/subscribe')
          .send({
            subscription: {
              endpoint: 'https://example.com',
              keys: { auth: 'auth-key' },
            },
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Missing subscription keys');
      });

      it('should return 400 when auth key is missing', async () => {
        const response = await request(app)
          .post('/push/subscribe')
          .send({
            subscription: {
              endpoint: 'https://example.com',
              keys: { p256dh: 'p256dh-key' },
            },
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Missing subscription keys');
      });
    });

    describe('successful subscription', () => {
      beforeEach(() => {
        mockAuthenticateToken.mockImplementation((req, res, next) => {
          req.user = { id: 5 };
          next();
        });
        mockPool.query.mockResolvedValue({ rows: [] });
      });

      it('should save subscription successfully', async () => {
        const response = await request(app)
          .post('/push/subscribe')
          .send(validSubscription);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          message: 'Subscription saved successfully',
        });
      });

      it('should upsert subscription with correct parameters', async () => {
        await request(app)
          .post('/push/subscribe')
          .send(validSubscription);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO push_subscriptions'),
          [
            5, // user_id
            validSubscription.subscription.endpoint,
            validSubscription.subscription.keys.p256dh,
            validSubscription.subscription.keys.auth,
          ]
        );
      });

      it('should use ON CONFLICT for upsert', async () => {
        await request(app)
          .post('/push/subscribe')
          .send(validSubscription);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('ON CONFLICT'),
          expect.any(Array)
        );
      });

      it('should handle different user IDs', async () => {
        mockAuthenticateToken.mockImplementation((req, res, next) => {
          req.user = { id: 42 };
          next();
        });

        await request(app)
          .post('/push/subscribe')
          .send(validSubscription);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining([42])
        );
      });
    });

    describe('error handling', () => {
      beforeEach(() => {
        mockAuthenticateToken.mockImplementation((req, res, next) => {
          req.user = { id: 1 };
          next();
        });
      });

      it('should return 500 on database error', async () => {
        mockPool.query.mockRejectedValue(new Error('DB error'));

        const response = await request(app)
          .post('/push/subscribe')
          .send(validSubscription);

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Failed to save subscription');
      });

      it('should log error on failure', async () => {
        const error = new Error('Connection failed');
        mockPool.query.mockRejectedValue(error);

        await request(app)
          .post('/push/subscribe')
          .send(validSubscription);

        expect(consoleErrorSpy).toHaveBeenCalledWith('Push subscribe error:', error);
      });
    });
  });

  describe('POST /push/unsubscribe', () => {
    describe('authentication', () => {
      it('should require authentication', async () => {
        mockAuthenticateToken.mockImplementation((req, res, next) => {
          res.status(401).json({ error: 'Unauthorized' });
        });

        const response = await request(app)
          .post('/push/unsubscribe')
          .send({});

        expect(response.status).toBe(401);
      });
    });

    describe('unsubscribe with endpoint', () => {
      beforeEach(() => {
        mockAuthenticateToken.mockImplementation((req, res, next) => {
          req.user = { id: 3 };
          next();
        });
        mockPool.query.mockResolvedValue({ rows: [] });
      });

      it('should remove specific subscription when endpoint provided', async () => {
        const endpoint = 'https://fcm.googleapis.com/fcm/send/abc123';

        const response = await request(app)
          .post('/push/unsubscribe')
          .send({ endpoint });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          message: 'Subscription removed',
        });
      });

      it('should delete by user_id and endpoint', async () => {
        const endpoint = 'https://example.com/push/xyz';

        await request(app)
          .post('/push/unsubscribe')
          .send({ endpoint });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2'),
          [3, endpoint]
        );
      });
    });

    describe('unsubscribe without endpoint', () => {
      beforeEach(() => {
        mockAuthenticateToken.mockImplementation((req, res, next) => {
          req.user = { id: 7 };
          next();
        });
        mockPool.query.mockResolvedValue({ rows: [] });
      });

      it('should remove all subscriptions when no endpoint provided', async () => {
        const response = await request(app)
          .post('/push/unsubscribe')
          .send({});

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should delete all user subscriptions', async () => {
        const response = await request(app)
          .post('/push/unsubscribe')
          .send({});

        expect(response.status).toBe(200);
        expect(mockPool.query).toHaveBeenCalledWith(
          'DELETE FROM push_subscriptions WHERE user_id = $1',
          [7]
        );
      });

      it('should handle empty body', async () => {
        const response = await request(app)
          .post('/push/unsubscribe')
          .send();

        expect(response.status).toBe(200);
      });

      it('should handle null endpoint', async () => {
        await request(app)
          .post('/push/unsubscribe')
          .send({ endpoint: null });

        expect(mockPool.query).toHaveBeenCalledWith(
          'DELETE FROM push_subscriptions WHERE user_id = $1',
          [7]
        );
      });

      it('should handle undefined endpoint', async () => {
        await request(app)
          .post('/push/unsubscribe')
          .send({ endpoint: undefined });

        expect(mockPool.query).toHaveBeenCalledWith(
          'DELETE FROM push_subscriptions WHERE user_id = $1',
          [7]
        );
      });
    });

    describe('error handling', () => {
      beforeEach(() => {
        mockAuthenticateToken.mockImplementation((req, res, next) => {
          req.user = { id: 1 };
          next();
        });
      });

      it('should return 500 on database error', async () => {
        mockPool.query.mockRejectedValue(new Error('DB error'));

        const response = await request(app)
          .post('/push/unsubscribe')
          .send({});

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Failed to remove subscription');
      });

      it('should log error on failure', async () => {
        const error = new Error('Delete failed');
        mockPool.query.mockRejectedValue(error);

        await request(app)
          .post('/push/unsubscribe')
          .send({});

        expect(consoleErrorSpy).toHaveBeenCalledWith('Push unsubscribe error:', error);
      });
    });
  });

  describe('GET /push/status', () => {
    describe('authentication', () => {
      it('should require authentication', async () => {
        mockAuthenticateToken.mockImplementation((req, res, next) => {
          res.status(401).json({ error: 'Unauthorized' });
        });

        const response = await request(app).get('/push/status');

        expect(response.status).toBe(401);
      });
    });

    describe('subscription status', () => {
      beforeEach(() => {
        mockAuthenticateToken.mockImplementation((req, res, next) => {
          req.user = { id: 10 };
          next();
        });
      });

      it('should return subscribed: true when user has subscriptions', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ count: '3' }] });
        mockGetVapidPublicKey.mockReturnValue('public-key');

        const response = await request(app).get('/push/status');

        expect(response.status).toBe(200);
        expect(response.body.subscribed).toBe(true);
        expect(response.body.subscriptionCount).toBe(3);
      });

      it('should return subscribed: false when user has no subscriptions', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ count: '0' }] });
        mockGetVapidPublicKey.mockReturnValue('public-key');

        const response = await request(app).get('/push/status');

        expect(response.status).toBe(200);
        expect(response.body.subscribed).toBe(false);
        expect(response.body.subscriptionCount).toBe(0);
      });

      it('should return configured: true when VAPID key exists', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ count: '0' }] });
        mockGetVapidPublicKey.mockReturnValue('BEl62iUYgUivxIkv69yViEuiBIa');

        const response = await request(app).get('/push/status');

        expect(response.body.configured).toBe(true);
      });

      it('should return configured: false when VAPID key is null', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ count: '0' }] });
        mockGetVapidPublicKey.mockReturnValue(null);

        const response = await request(app).get('/push/status');

        expect(response.body.configured).toBe(false);
      });

      it('should return configured: false when VAPID key is empty', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ count: '0' }] });
        mockGetVapidPublicKey.mockReturnValue('');

        const response = await request(app).get('/push/status');

        expect(response.body.configured).toBe(false);
      });

      it('should query with correct user ID', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ count: '0' }] });
        mockGetVapidPublicKey.mockReturnValue('key');

        await request(app).get('/push/status');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT COUNT(*)'),
          [10]
        );
      });

      it('should parse count as integer', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ count: '5' }] });
        mockGetVapidPublicKey.mockReturnValue('key');

        const response = await request(app).get('/push/status');

        expect(typeof response.body.subscriptionCount).toBe('number');
        expect(response.body.subscriptionCount).toBe(5);
      });
    });

    describe('error handling', () => {
      beforeEach(() => {
        mockAuthenticateToken.mockImplementation((req, res, next) => {
          req.user = { id: 1 };
          next();
        });
      });

      it('should return 500 on database error', async () => {
        mockPool.query.mockRejectedValue(new Error('DB error'));

        const response = await request(app).get('/push/status');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Failed to get subscription status');
      });

      it('should log error on failure', async () => {
        const error = new Error('Query failed');
        mockPool.query.mockRejectedValue(error);

        await request(app).get('/push/status');

        expect(consoleErrorSpy).toHaveBeenCalledWith('Push status error:', error);
      });
    });
  });

  describe('Security', () => {
    beforeEach(() => {
      mockAuthenticateToken.mockImplementation((req, res, next) => {
        req.user = { id: 1 };
        next();
      });
    });

    it('should use parameterized queries for subscribe', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await request(app)
        .post('/push/subscribe')
        .send({
          subscription: {
            endpoint: "https://example.com'; DROP TABLE users;--",
            keys: { p256dh: 'key', auth: 'auth' },
          },
        });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('$1'),
        expect.any(Array)
      );
    });

    it('should use parameterized queries for unsubscribe with endpoint', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await request(app)
        .post('/push/unsubscribe')
        .send({ endpoint: "'; DELETE FROM push_subscriptions;--" });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('$1'),
        expect.arrayContaining(["'; DELETE FROM push_subscriptions;--"])
      );
    });

    it('should use parameterized queries for status', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ count: '0' }] });
      mockGetVapidPublicKey.mockReturnValue('key');

      await request(app).get('/push/status');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('$1'),
        [1]
      );
    });

    it('should not expose VAPID private key', async () => {
      mockGetVapidPublicKey.mockReturnValue('public-key-only');

      const response = await request(app).get('/push/vapid-public-key');

      expect(response.body).not.toHaveProperty('privateKey');
      expect(response.body).not.toHaveProperty('secret');
    });
  });

  describe('Response format consistency', () => {
    beforeEach(() => {
      mockAuthenticateToken.mockImplementation((req, res, next) => {
        req.user = { id: 1 };
        next();
      });
    });

    it('should return success: true on successful subscribe', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/push/subscribe')
        .send({
          subscription: {
            endpoint: 'https://example.com',
            keys: { p256dh: 'key', auth: 'auth' },
          },
        });

      expect(response.body.success).toBe(true);
    });

    it('should return success: true on successful unsubscribe', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/push/unsubscribe')
        .send({});

      expect(response.body.success).toBe(true);
    });

    it('should return error field on failures', async () => {
      mockPool.query.mockRejectedValue(new Error('DB error'));

      const subscribeResponse = await request(app)
        .post('/push/subscribe')
        .send({
          subscription: {
            endpoint: 'https://example.com',
            keys: { p256dh: 'key', auth: 'auth' },
          },
        });

      const unsubscribeResponse = await request(app)
        .post('/push/unsubscribe')
        .send({});

      const statusResponse = await request(app).get('/push/status');

      expect(subscribeResponse.body).toHaveProperty('error');
      expect(unsubscribeResponse.body).toHaveProperty('error');
      expect(statusResponse.body).toHaveProperty('error');
    });
  });

  describe('Edge cases', () => {
    beforeEach(() => {
      mockAuthenticateToken.mockImplementation((req, res, next) => {
        req.user = { id: 1 };
        next();
      });
    });

    it('should handle very long endpoint URLs', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const longEndpoint = 'https://example.com/' + 'a'.repeat(2000);

      const response = await request(app)
        .post('/push/subscribe')
        .send({
          subscription: {
            endpoint: longEndpoint,
            keys: { p256dh: 'key', auth: 'auth' },
          },
        });

      expect(response.status).toBe(200);
    });

    it('should handle subscription with extra fields', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/push/subscribe')
        .send({
          subscription: {
            endpoint: 'https://example.com',
            keys: { p256dh: 'key', auth: 'auth' },
            expirationTime: null,
            extraField: 'ignored',
          },
        });

      expect(response.status).toBe(200);
    });

    it('should handle large subscription count', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ count: '999999' }] });
      mockGetVapidPublicKey.mockReturnValue('key');

      const response = await request(app).get('/push/status');

      expect(response.body.subscriptionCount).toBe(999999);
      expect(response.body.subscribed).toBe(true);
    });
  });
});
