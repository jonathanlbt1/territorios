import pool from '../db/config.js';
import { sendPushToUser } from '../services/pushNotification.js';

export const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
export const DEFAULT_INTERVAL_MS = 12 * 60 * 60 * 1000; // run twice a day

export async function notifyOverduePublisherAssignments() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT pa.id as publisher_assignment_id, pa.assignment_id, pa.publisher_id, pa.block_number,
             t.territory_code, u.name as publisher_name, a.dirigente_id
      FROM publisher_assignments pa
      JOIN assignments a ON a.id = pa.assignment_id
      JOIN territories t ON t.id = a.territory_id
      JOIN users u ON u.id = pa.publisher_id
      WHERE pa.status = 'in_progress'
        AND pa.due_date <= CURRENT_TIMESTAMP
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.user_id = pa.publisher_id
            AND n.type = 'pub_overdue_' || pa.id
        )
    `);

    for (const row of result.rows) {
      const { publisher_assignment_id, assignment_id, publisher_id, block_number, territory_code } = row;
      const pubNotifMessage = `Você está com a quadra ${block_number} do território ${territory_code} há mais de 24 horas. Por favor, devolva o cartão ao dirigente.`;
      
      // Notify publisher
      await client.query(`
        INSERT INTO notifications (user_id, type, title, message, assignment_id)
        VALUES ($1, $2, 'Quadra Atrasada', $3, $4)
      `, [
        publisher_id,
        `pub_overdue_${publisher_assignment_id}`,
        pubNotifMessage,
        assignment_id
      ]);

      // Send push notification to publisher
      sendPushToUser(publisher_id, {
        title: '⏰ Quadra Atrasada',
        body: pubNotifMessage,
        data: { assignmentId: assignment_id, url: '/publisher' }
      }).catch(err => console.error('Push notification error:', err));
    }
  } catch (error) {
    console.error('Overdue publisher assignments notifier error:', error);
  } finally {
    client.release();
  }
}

export async function notifyOverdueAssignments() {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT a.id, a.territory_id, a.dirigente_id, a.assigned_by, a.assigned_date,
             t.territory_code, t.locality, u.name as dirigente_name
      FROM assignments a
      JOIN territories t ON t.id = a.territory_id
      JOIN users u ON u.id = a.dirigente_id
      WHERE a.status IN ('pending', 'in_progress')
        AND a.assigned_date <= CURRENT_DATE - INTERVAL '60 days'
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.assignment_id = a.id AND n.type = 'assignment_overdue_10d'
        )
    `);

    for (const row of result.rows) {
      const { id, dirigente_id, assigned_by, territory_code, locality, dirigente_name } = row;

      const dirigenteNotifMessage = `Já se passaram 60 dias desde que você recebeu o território ${territory_code} (${locality}). Por favor, devolva ou conclua a visitação.`;
      
      // Notify dirigente
      await client.query(`
        INSERT INTO notifications (user_id, type, title, message, assignment_id)
        VALUES ($1, 'assignment_overdue_10d', 'Lembrete de Território', $2, $3)
      `, [
        dirigente_id,
        dirigenteNotifMessage,
        id
      ]);

      // Send push notification to dirigente
      sendPushToUser(dirigente_id, {
        title: '⏰ Lembrete de Território',
        body: dirigenteNotifMessage,
        data: { assignmentId: id, url: `/assignment/${id}` }
      }).catch(err => console.error('Push notification error:', err));

      // Notify admin who assigned (if any and not same user)
      if (assigned_by && assigned_by !== dirigente_id) {
        const adminNotifMessage = `${dirigente_name} está com o território ${territory_code} (${locality}) há mais de 60 dias.`;
        
        await client.query(`
          INSERT INTO notifications (user_id, type, title, message, assignment_id)
          VALUES ($1, 'assignment_overdue_10d', 'Alerta de Território em Aberto', $2, $3)
        `, [
          assigned_by,
          adminNotifMessage,
          id
        ]);

        // Send push notification to admin
        sendPushToUser(assigned_by, {
          title: '⚠️ Alerta de Território em Aberto',
          body: adminNotifMessage,
          data: { assignmentId: id, url: `/assignment/${id}` }
        }).catch(err => console.error('Push notification error:', err));
      }
    }

    // Call publisher overdue checks
    await notifyOverduePublisherAssignments();
  } catch (error) {
    console.error('Overdue notifier error:', error);
  } finally {
    client.release();
  }
}

export function startOverdueNotifier(intervalMs = DEFAULT_INTERVAL_MS) {
  // Kick off immediately, then schedule.
  notifyOverdueAssignments().catch((err) => console.error('Overdue notifier initial run error:', err));
  const intervalId = setInterval(() => {
    notifyOverdueAssignments().catch((err) => console.error('Overdue notifier interval error:', err));
  }, intervalMs);
  intervalId.unref();
}

export default startOverdueNotifier;
