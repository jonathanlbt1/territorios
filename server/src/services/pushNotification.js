import webpush from 'web-push';
import pool from '../db/config.js';

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
// VAPID_SUBJECT identifies who is sending - can be mailto: or https:// URL
// Using a default that works for most cases
const vapidSubject = process.env.VAPID_SUBJECT || 'https://territorios.app';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  console.log('✅ Web Push configured successfully');
} else {
  console.warn('⚠️  VAPID keys not configured. Push notifications disabled.');
  console.warn('   Run: npm run generate-vapid to generate keys');
}

/**
 * Send push notification to a specific user
 * @param {number} userId - User ID to send notification to
 * @param {object} payload - Notification payload { title, body, icon, badge, data }
 */
export async function sendPushToUser(userId, payload) {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.log('Push notifications not configured, skipping...');
    return { success: false, reason: 'not_configured' };
  }

  try {
    // Get all subscriptions for this user
    const result = await pool.query(
      'SELECT * FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return { success: false, reason: 'no_subscriptions' };
    }

    const notificationPayload = JSON.stringify({
      title: payload.title || 'Territórios',
      body: payload.body || '',
      icon: payload.icon || '/icon-192.png',
      badge: payload.badge || '/icon-badge.png',
      data: payload.data || {},
      tag: payload.tag || `notification-${Date.now()}`,
      requireInteraction: payload.requireInteraction || false
    });

    const results = [];
    
    for (const subscription of result.rows) {
      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth
        }
      };

      try {
        await webpush.sendNotification(pushSubscription, notificationPayload);
        results.push({ endpoint: subscription.endpoint, success: true });
      } catch (error) {
        console.error('Push notification error:', error.message);
        
        // If subscription is invalid (410 Gone or 404), remove it
        if (error.statusCode === 410 || error.statusCode === 404) {
          await pool.query(
            'DELETE FROM push_subscriptions WHERE id = $1',
            [subscription.id]
          );
          console.log(`Removed invalid subscription ${subscription.id}`);
        }
        
        results.push({ endpoint: subscription.endpoint, success: false, error: error.message });
      }
    }

    return { success: true, results };
  } catch (error) {
    console.error('Send push to user error:', error);
    return { success: false, reason: 'error', error: error.message };
  }
}

/**
 * Send push notification to multiple users
 * @param {number[]} userIds - Array of user IDs
 * @param {object} payload - Notification payload
 */
export async function sendPushToUsers(userIds, payload) {
  const results = [];
  
  for (const userId of userIds) {
    const result = await sendPushToUser(userId, payload);
    results.push({ userId, ...result });
  }
  
  return results;
}

/**
 * Send push notification to all admins
 * @param {object} payload - Notification payload
 */
export async function sendPushToAdmins(payload) {
  try {
    const result = await pool.query(
      "SELECT id FROM users WHERE role = 'admin'"
    );
    
    const adminIds = result.rows.map(r => r.id);
    return sendPushToUsers(adminIds, payload);
  } catch (error) {
    console.error('Send push to admins error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get the public VAPID key for client subscription
 */
export function getVapidPublicKey() {
  return vapidPublicKey || null;
}

export default {
  sendPushToUser,
  sendPushToUsers,
  sendPushToAdmins,
  getVapidPublicKey
};

