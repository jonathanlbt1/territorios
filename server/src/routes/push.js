import express from 'express';
import pool from '../db/config.js';
import { authenticateToken } from '../middleware/auth.js';
import { getVapidPublicKey } from '../services/pushNotification.js';

const router = express.Router();

// Get VAPID public key for client subscription
router.get('/vapid-public-key', (req, res) => {
  const publicKey = getVapidPublicKey();
  
  if (!publicKey) {
    return res.status(503).json({ 
      error: 'Push notifications not configured',
      configured: false 
    });
  }
  
  res.json({ publicKey, configured: true });
});

// Subscribe to push notifications
router.post('/subscribe', authenticateToken, async (req, res) => {
  try {
    const { subscription } = req.body;
    
    if (!subscription?.endpoint || !subscription?.keys) {
      return res.status(400).json({ error: 'Invalid subscription data' });
    }

    const { endpoint, keys } = subscription;
    const { p256dh, auth } = keys;

    if (!p256dh || !auth) {
      return res.status(400).json({ error: 'Missing subscription keys' });
    }

    // Upsert subscription (update if exists, insert if not)
    await pool.query(`
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, endpoint) 
      DO UPDATE SET p256dh = $3, auth = $4, created_at = CURRENT_TIMESTAMP
    `, [req.user.id, endpoint, p256dh, auth]);

    res.json({ success: true, message: 'Subscription saved successfully' });
  } catch (error) {
    console.error('Push subscribe error:', error);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// Unsubscribe from push notifications
router.post('/unsubscribe', authenticateToken, async (req, res) => {
  try {
    const { endpoint } = req.body;

    if (endpoint) {
      // Remove specific subscription
      await pool.query(
        'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
        [req.user.id, endpoint]
      );
    } else {
      // Remove all subscriptions for user
      await pool.query(
        'DELETE FROM push_subscriptions WHERE user_id = $1',
        [req.user.id]
      );
    }

    res.json({ success: true, message: 'Subscription removed' });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
});

// Get user's subscription status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM push_subscriptions WHERE user_id = $1',
      [req.user.id]
    );

    const subscribed = Number.parseInt(result.rows[0].count) > 0;
    const publicKey = getVapidPublicKey();

    res.json({ 
      subscribed, 
      configured: !!publicKey,
      subscriptionCount: Number.parseInt(result.rows[0].count)
    });
  } catch (error) {
    console.error('Push status error:', error);
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

export default router;

