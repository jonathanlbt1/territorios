import pool from '../db/config.js';
import { sendPushToUser, sendPushToAdmins } from './pushNotification.js';

/**
 * Create a notification and send push notification
 * @param {object} options - Notification options
 * @param {number} options.userId - User ID to notify
 * @param {string} options.type - Notification type
 * @param {string} options.title - Notification title
 * @param {string} options.message - Notification message
 * @param {number} options.assignmentId - Related assignment ID (optional)
 * @param {boolean} options.sendPush - Whether to send push notification (default: true)
 */
export async function createNotification(options) {
  const { userId, type, title, message, assignmentId = null, sendPush = true } = options;

  try {
    // Insert notification into database
    const result = await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, assignment_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, type, title, message, assignmentId]
    );

    const notification = result.rows[0];

    // Send push notification
    if (sendPush) {
      await sendPushToUser(userId, {
        title,
        body: message,
        tag: `notification-${notification.id}`,
        data: {
          notificationId: notification.id,
          type,
          assignmentId,
          url: assignmentId ? `/assignment/${assignmentId}` : '/'
        }
      });
    }

    return notification;
  } catch (error) {
    console.error('Create notification error:', error);
    throw error;
  }
}

/**
 * Create notifications for multiple users
 * @param {number[]} userIds - Array of user IDs
 * @param {object} options - Notification options (same as createNotification, without userId)
 */
export async function createNotificationsForUsers(userIds, options) {
  const results = [];
  
  for (const userId of userIds) {
    try {
      const notification = await createNotification({ ...options, userId });
      results.push({ userId, success: true, notification });
    } catch (error) {
      results.push({ userId, success: false, error: error.message });
    }
  }
  
  return results;
}

/**
 * Create notification for all admins
 * @param {object} options - Notification options (same as createNotification, without userId)
 */
export async function notifyAdmins(options) {
  try {
    const result = await pool.query(
      "SELECT id FROM users WHERE role = 'admin'"
    );
    
    const adminIds = result.rows.map(r => r.id);
    return createNotificationsForUsers(adminIds, options);
  } catch (error) {
    console.error('Notify admins error:', error);
    throw error;
  }
}

/**
 * Send push notification only (without creating database notification)
 * Useful for real-time alerts
 */
export async function sendPushOnly(userId, payload) {
  return sendPushToUser(userId, payload);
}

/**
 * Send push notification to all admins (without creating database notification)
 */
export async function sendPushToAllAdmins(payload) {
  return sendPushToAdmins(payload);
}

export default {
  createNotification,
  createNotificationsForUsers,
  notifyAdmins,
  sendPushOnly,
  sendPushToAllAdmins
};

