import express from 'express';
import pool from '../db/config.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { sendPushToUser } from '../services/pushNotification.js';

const router = express.Router();

// Get all assignments (admin sees all, dirigente sees their own)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query;
    let params = [];

    if (req.user.role === 'admin') {
      query = `
        SELECT a.*, 
          t.territory_number, t.territory_code, t.locality, t.block_count, t.map_filename,
          u.name as dirigente_name, u.username as dirigente_username,
          ab.name as assigned_by_name
        FROM assignments a
        JOIN territories t ON t.id = a.territory_id
        JOIN users u ON u.id = a.dirigente_id
        LEFT JOIN users ab ON ab.id = a.assigned_by
        ORDER BY a.created_at DESC
      `;
    } else {
      query = `
        SELECT a.*, 
          t.territory_number, t.territory_code, t.locality, t.block_count, t.map_filename,
          ab.name as assigned_by_name
        FROM assignments a
        JOIN territories t ON t.id = a.territory_id
        LEFT JOIN users ab ON ab.id = a.assigned_by
        WHERE a.dirigente_id = $1
        ORDER BY a.created_at DESC
      `;
      params = [req.user.id];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get assignments error:', error);
    res.status(500).json({ error: 'Erro ao buscar designações' });
  }
});

// Get active assignments (for dashboard)
router.get('/active', authenticateToken, async (req, res) => {
  try {
    let query;
    let params = [];

    if (req.user.role === 'admin') {
      query = `
        SELECT a.*, 
          t.territory_number, t.territory_code, t.locality, t.block_count, t.map_filename, t.observations,
          u.name as dirigente_name, u.username as dirigente_username
        FROM assignments a
        JOIN territories t ON t.id = a.territory_id
        JOIN users u ON u.id = a.dirigente_id
        WHERE a.status IN ('pending', 'in_progress', 'returned')
        ORDER BY 
          CASE WHEN a.status = 'returned' THEN 0 ELSE 1 END,
          a.assigned_date ASC
      `;
    } else {
      query = `
        SELECT a.*, 
          t.territory_number, t.territory_code, t.locality, t.block_count, t.map_filename, t.observations
        FROM assignments a
        JOIN territories t ON t.id = a.territory_id
        WHERE a.dirigente_id = $1 AND a.status IN ('pending', 'in_progress')
        ORDER BY a.assigned_date ASC
      `;
      params = [req.user.id];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get active assignments error:', error);
    res.status(500).json({ error: 'Erro ao buscar designações ativas' });
  }
});

// Get completed/history assignments
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0, start_date } = req.query;
    let query;
    let params;

    if (req.user.role === 'admin') {
      let dateFilter = '';
      if (start_date) {
        dateFilter = 'AND a.validated_at >= $3';
      }
      query = `
        SELECT a.*, 
          t.territory_number, t.territory_code, t.locality, t.block_count,
          u.name as dirigente_name,
          vb.name as validated_by_name
        FROM assignments a
        JOIN territories t ON t.id = a.territory_id
        JOIN users u ON u.id = a.dirigente_id
        LEFT JOIN users vb ON vb.id = a.validated_by
        WHERE a.status = 'completed' ${dateFilter}
        ORDER BY a.validated_at DESC
        LIMIT $1 OFFSET $2
      `;
      params = start_date ? [limit, offset, start_date] : [limit, offset];
    } else {
      let dateFilter = '';
      if (start_date) {
        dateFilter = 'AND a.validated_at >= $4';
      }
      query = `
        SELECT a.*, 
          t.territory_number, t.territory_code, t.locality, t.block_count
        FROM assignments a
        JOIN territories t ON t.id = a.territory_id
        WHERE a.dirigente_id = $1 AND a.status = 'completed' ${dateFilter}
        ORDER BY a.validated_at DESC
        LIMIT $2 OFFSET $3
      `;
      params = start_date ? [req.user.id, limit, offset, start_date] : [req.user.id, limit, offset];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get assignment history error:', error);
    res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
});

// Get single assignment
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, 
        t.territory_number, t.territory_code, t.locality, t.block_count, t.map_filename, t.observations as territory_observations,
        u.name as dirigente_name, u.username as dirigente_username,
        ab.name as assigned_by_name
      FROM assignments a
      JOIN territories t ON t.id = a.territory_id
      JOIN users u ON u.id = a.dirigente_id
      LEFT JOIN users ab ON ab.id = a.assigned_by
      WHERE a.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Designação não encontrada' });
    }

    // Check authorization
    const assignment = result.rows[0];
    if (req.user.role !== 'admin' && assignment.dirigente_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso não autorizado' });
    }

    const partialHistory = await pool.query(
      `SELECT blocks_worked
       FROM territory_history
       WHERE territory_id = $1 AND result = 'partial'
       ORDER BY worked_date DESC, id DESC
       LIMIT 1`,
      [assignment.territory_id]
    );

    assignment.partial_blocks_worked = partialHistory.rows[0]?.blocks_worked || [];

    res.json(assignment);
  } catch (error) {
    console.error('Get assignment error:', error);
    res.status(500).json({ error: 'Erro ao buscar designação' });
  }
});

// Create assignment (admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { territory_id, territory_ids, dirigente_id } = req.body;

    if ((!territory_id && !Array.isArray(territory_ids)) || !dirigente_id) {
      return res.status(400).json({ error: 'Dados obrigatórios não fornecidos' });
    }

    // Normalize to array of territory IDs
    const ids = Array.isArray(territory_ids) && territory_ids.length > 0
      ? territory_ids.map(Number)
      : [Number(territory_id)];

    await client.query('BEGIN');

    // Check if any territory in the list is already assigned
    const existing = await client.query(`
      SELECT a.territory_id, t.territory_code
      FROM assignments a
      JOIN territories t ON t.id = a.territory_id
      WHERE a.territory_id = ANY($1)
        AND a.status IN ('pending', 'in_progress', 'returned')
    `, [ids]);

    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      const blocked = existing.rows.map(r => r.territory_code);
      return res.status(400).json({ error: `Os territórios seguintes já estão designados: ${blocked.join(', ')}` });
    }

    // Sempre usar a data atual para nova designação (parâmetros do sistema: due_date, etc.).
    // No Form S-13 a "data da primeira designação" do ciclo vem do territory_history.worked_date.
    const assignedDate = new Date();

    // Fetch dirigente name once
    const dirigenteRes = await client.query('SELECT id, name FROM users WHERE id = $1', [dirigente_id]);
    if (dirigenteRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Dirigente não encontrado' });
    }
    const dirigenteName = dirigenteRes.rows[0].name;

    const createdAssignments = [];

    for (const tId of ids) {
      const dueDate = new Date(assignedDate);
      dueDate.setDate(dueDate.getDate() + 60);

      const insertRes = await client.query(`
        INSERT INTO assignments (territory_id, dirigente_id, assigned_by, assigned_date, due_date, status)
        VALUES ($1, $2, $3, $4, $5, 'pending')
        RETURNING *
      `, [tId, dirigente_id, req.user.id, assignedDate, dueDate]);

      const assignment = insertRes.rows[0];
      createdAssignments.push(assignment);

      // If there is a previous partial record, update it with the new dirigente but keep the original date
      const partialHistory = await client.query(
        `SELECT id FROM territory_history 
         WHERE territory_id = $1 AND result = 'partial'
         ORDER BY worked_date DESC, id DESC
         LIMIT 1`,
        [tId]
      );

      if (partialHistory.rows.length > 0) {
        await client.query(
          `UPDATE territory_history
           SET dirigente_id = $1,
               dirigente_name = $2,
               assignment_id = $3
           WHERE id = $4`,
          [dirigente_id, dirigenteName, assignment.id, partialHistory.rows[0].id]
        );
      }

      // Notification per assignment (unless self-assignment)
      if (req.user.id !== dirigente_id) {
        const territoryInfo = await client.query(
          'SELECT territory_code, locality FROM territories WHERE id = $1',
          [tId]
        );
        const notifMessage = `Você recebeu o território ${territoryInfo.rows[0].territory_code} (${territoryInfo.rows[0].locality}). Devolva quando finalizar a visitação.`;
        await client.query(`
          INSERT INTO notifications (user_id, type, title, message, assignment_id)
          VALUES ($1, 'new_assignment', 'Nova Designação de Território', $2, $3)
        `, [
          dirigente_id,
          notifMessage,
          assignment.id
        ]);

        // Send push notification
        sendPushToUser(dirigente_id, {
          title: '📋 Nova Designação de Território',
          body: notifMessage,
          data: { assignmentId: assignment.id, url: `/assignment/${assignment.id}` }
        }).catch(err => console.error('Push notification error:', err));
      }
    }

    await client.query('COMMIT');

    // Return full assignment data (array when multiple)
    const fullResult = await pool.query(`
      SELECT a.*, 
        t.territory_number, t.territory_code, t.locality, t.block_count, t.map_filename,
        u.name as dirigente_name, u.username as dirigente_username
      FROM assignments a
      JOIN territories t ON t.id = a.territory_id
      JOIN users u ON u.id = a.dirigente_id
      WHERE a.id = ANY($1)
    `, [createdAssignments.map(a => a.id)]);

    const payload = fullResult.rows.length === 1 ? fullResult.rows[0] : fullResult.rows;
    res.status(201).json(payload);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create assignment error:', error);
    res.status(500).json({ error: 'Erro ao criar designação' });
  } finally {
    client.release();
  }
});

// Return territory (dirigente action)
router.post('/:id/return', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { blocks_worked, observations, not_worked } = req.body;

    // Get assignment
    const assignmentResult = await client.query(
      'SELECT * FROM assignments WHERE id = $1',
      [req.params.id]
    );

    if (assignmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Designação não encontrada' });
    }

    const assignment = assignmentResult.rows[0];

    // Check authorization
    if (req.user.role !== 'admin' && assignment.dirigente_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso não autorizado' });
    }

    if (assignment.status !== 'pending' && assignment.status !== 'in_progress') {
      return res.status(400).json({ error: 'Esta designação não pode ser devolvida' });
    }

    await client.query('BEGIN');

    // Update assignment
    await client.query(`
      UPDATE assignments 
      SET status = 'returned',
          blocks_worked = $1,
          return_observations = $2,
          not_worked = $3,
          returned_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [not_worked ? [] : (blocks_worked || []), observations, not_worked || false, req.params.id]);

    // Get territory and create notification for admin
    const territoryInfo = await client.query(`
      SELECT t.territory_code, t.locality, u.name as dirigente_name
      FROM assignments a
      JOIN territories t ON t.id = a.territory_id
      JOIN users u ON u.id = a.dirigente_id
      WHERE a.id = $1
    `, [req.params.id]);

    // Notify the admin who made the assignment (but not if it's a self-assignment)
    if (assignment.assigned_by && assignment.assigned_by !== req.user.id) {
      const returnNotifMessage = `${territoryInfo.rows[0].dirigente_name} devolveu o território ${territoryInfo.rows[0].territory_code}. Aguardando validação.`;
      await client.query(`
        INSERT INTO notifications (user_id, type, title, message, assignment_id)
        VALUES ($1, 'territory_returned', 'Território Devolvido', $2, $3)
      `, [
        assignment.assigned_by,
        returnNotifMessage,
        req.params.id
      ]);

      // Send push notification to admin
      sendPushToUser(assignment.assigned_by, {
        title: '📬 Território Devolvido',
        body: returnNotifMessage,
        data: { assignmentId: req.params.id, url: `/assignment/${req.params.id}` }
      }).catch(err => console.error('Push notification error:', err));
    }

    await client.query('COMMIT');

    res.json({ message: 'Território devolvido com sucesso. Aguardando validação do administrador.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Return territory error:', error);
    res.status(500).json({ error: 'Erro ao devolver território' });
  } finally {
    client.release();
  }
});

// Validate returned territory (admin only)
router.post('/:id/validate', authenticateToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { blocks_worked, observations, discard_assignment } = req.body;

    // Get assignment
    const assignmentResult = await client.query(`
      SELECT a.*, t.id as t_id, t.block_count, u.name as dirigente_name
      FROM assignments a
      JOIN territories t ON t.id = a.territory_id
      JOIN users u ON u.id = a.dirigente_id
      WHERE a.id = $1
    `, [req.params.id]);

    if (assignmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Designação não encontrada' });
    }

    const assignment = assignmentResult.rows[0];

    if (assignment.status !== 'returned') {
      return res.status(400).json({ error: 'Esta designação não está aguardando validação' });
    }

    await client.query('BEGIN');

    // Se discard_assignment é true, apagar todos os registros e voltar território ao estoque
    if (discard_assignment) {
      // Apagar registros do territory_history relacionados a esta designação
      await client.query(
        'DELETE FROM territory_history WHERE assignment_id = $1',
        [req.params.id]
      );

      // Apagar notificações relacionadas a esta designação
      await client.query(
        'DELETE FROM notifications WHERE assignment_id = $1',
        [req.params.id]
      );

      // Apagar a designação
      await client.query(
        'DELETE FROM assignments WHERE id = $1',
        [req.params.id]
      );

      // Notificar dirigente que a designação foi descartada
      await client.query(`
        INSERT INTO notifications (user_id, type, title, message)
        VALUES ($1, 'assignment_discarded', 'Designação Descartada', $2)
      `, [
        assignment.dirigente_id,
        `Sua designação do território ${assignment.territory_code || assignment.territory_number} foi descartada pelo administrador. O território voltou ao estoque.`
      ]);

      // Send push notification to dirigente
      sendPushToUser(assignment.dirigente_id, {
        title: '📋 Designação Descartada',
        body: `Sua designação do território ${assignment.territory_code || assignment.territory_number} foi descartada. O território voltou ao estoque.`,
        data: { url: '/dirigente' }
      }).catch(err => console.error('Push notification error:', err));

      await client.query('COMMIT');
      return res.json({ message: 'Designação descartada com sucesso. O território voltou ao estoque.' });
    }

    // Validação normal - requer pelo menos uma quadra
    if (!blocks_worked || !Array.isArray(blocks_worked) || blocks_worked.length === 0) {
      return res.status(400).json({ error: 'Selecione pelo menos uma quadra validada ou marque para descartar a designação' });
    }

    // Auto-calculate validation_result based on blocks_worked
    let validation_result;
    if (blocks_worked.length === 0) {
      validation_result = 'not_done';
    } else if (blocks_worked.length < assignment.block_count) {
      validation_result = 'partial';
    } else {
      validation_result = 'complete';
    }

    // Build observation for partial returns to highlight remaining blocks
    const missingBlocks = Array.from({ length: assignment.block_count }, (_, idx) => idx + 1)
      .filter(block => !blocks_worked.includes(block));
    const partialObservation = validation_result === 'partial' && missingBlocks.length > 0
      ? `Atenção, as quadras ${missingBlocks.join(', ')} precisam ser feitas`
      : null;
    const combinedObservation = [observations?.trim(), partialObservation].filter(Boolean).join(' ') || null;
    const validatedAt = new Date(); // Always set validated_at when admin validates
    // Data de entrega/conclusão: gravar sempre (completo e parcial) para S-13 e last_worked_date
    const completionDate = validatedAt;

    // Update assignment with validated blocks and observations
    await client.query(`
      UPDATE assignments 
      SET status = 'completed',
          blocks_worked = $1,
          return_observations = $2,
          validation_result = $3,
          validated_by = $4,
          validated_at = $5,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
    `, [blocks_worked, combinedObservation, validation_result, req.user.id, validatedAt, req.params.id]);

    // Determine base worked date and history row (reuse partial when it exists)
    const latestHistory = await client.query(
      `SELECT * FROM territory_history
       WHERE territory_id = $1
       ORDER BY worked_date DESC, id DESC
       LIMIT 1`,
      [assignment.territory_id]
    );

    const reuseExisting = latestHistory.rows.length > 0 && latestHistory.rows[0].result === 'partial';
    const baseWorkedDate = reuseExisting
      ? latestHistory.rows[0].worked_date
      : (assignment.assigned_date || new Date());

    if (reuseExisting) {
      await client.query(
        `UPDATE territory_history
         SET assignment_id = $1,
             dirigente_id = $2,
             dirigente_name = $3,
             worked_date = $4,
             conclusion_date = $5,
             blocks_worked = $6,
             total_blocks = $7,
             result = $8,
             observations = $9,
             validated_by = $10
         WHERE id = $11`,
        [
          assignment.id,
          assignment.dirigente_id,
          assignment.dirigente_name,
          baseWorkedDate,
          completionDate,
          blocks_worked,
          assignment.block_count,
          validation_result,
          combinedObservation,
          req.user.id,
          latestHistory.rows[0].id
        ]
      );
    } else {
      await client.query(`
        INSERT INTO territory_history 
          (territory_id, assignment_id, dirigente_id, dirigente_name, worked_date, conclusion_date, blocks_worked, total_blocks, result, observations, validated_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        assignment.territory_id,
        assignment.id,
        assignment.dirigente_id,
        assignment.dirigente_name,
        baseWorkedDate,
        completionDate,
        blocks_worked,
        assignment.block_count,
        validation_result,
        combinedObservation,
        req.user.id
      ]);
    }

    // Update territory last worked date and observations
    const workDate = completionDate || baseWorkedDate;
    await client.query(`
      UPDATE territories 
      SET last_worked_date = $1,
          observations = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [workDate, combinedObservation, assignment.territory_id]);

    // Notify dirigente
    const resultText = {
      complete: 'Território trabalhado por completo',
      partial: 'Território parcialmente trabalhado',
      not_done: 'Território não feito'
    };
    const resultEmoji = {
      complete: '✅',
      partial: '⚠️',
      not_done: '❌'
    };

    const validationNotifMessage = `Sua devolução foi validada: ${resultText[validation_result]}`;
    await client.query(`
      INSERT INTO notifications (user_id, type, title, message, assignment_id)
      VALUES ($1, 'validation_complete', 'Devolução Validada', $2, $3)
    `, [
      assignment.dirigente_id,
      validationNotifMessage,
      req.params.id
    ]);

    // Send push notification to dirigente
    sendPushToUser(assignment.dirigente_id, {
      title: `${resultEmoji[validation_result]} Devolução Validada`,
      body: validationNotifMessage,
      data: { assignmentId: req.params.id, url: `/assignment/${req.params.id}` }
    }).catch(err => console.error('Push notification error:', err));

    await client.query('COMMIT');

    res.json({ message: 'Validação concluída com sucesso' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Validate assignment error:', error);
    res.status(500).json({ error: 'Erro ao validar devolução' });
  } finally {
    client.release();
  }
});

// Cancel assignment (admin only)
router.post('/:id/cancel', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE assignments 
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status IN ('pending', 'in_progress')
      RETURNING *
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Designação não encontrada ou não pode ser cancelada' });
    }

    res.json({ message: 'Designação cancelada com sucesso' });
  } catch (error) {
    console.error('Cancel assignment error:', error);
    res.status(500).json({ error: 'Erro ao cancelar designação' });
  }
});

// Refuse assignment (dirigente only)
router.post('/:id/refuse', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { reason } = req.body;

    if (!reason?.trim()) {
      return res.status(400).json({ error: 'Motivo da recusa é obrigatório' });
    }

    // Get assignment
    const assignmentResult = await client.query(
      'SELECT * FROM assignments WHERE id = $1 AND dirigente_id = $2 AND status = $3',
      [req.params.id, req.user.id, 'pending']
    );

    if (assignmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Designação não encontrada ou não pode ser recusada' });
    }

    const assignment = assignmentResult.rows[0];

    await client.query('BEGIN');

    // Update assignment status to cancelled
    await client.query(`
      UPDATE assignments 
      SET status = 'cancelled', return_observations = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [reason, req.params.id]);

    // Get territory and dirigente info for notification
    const infoResult = await pool.query(`
      SELECT t.territory_code, t.locality, u.name as dirigente_name
      FROM territories t, users u
      WHERE t.id = $1 AND u.id = $2
    `, [assignment.territory_id, req.user.id]);

    if (infoResult.rows.length > 0 && assignment.assigned_by && assignment.assigned_by !== req.user.id) {
      const { territory_code, locality, dirigente_name } = infoResult.rows[0];
      const refuseNotifMessage = `${dirigente_name} recusou a designação do território ${territory_code} (${locality}). Motivo: ${reason}`;
      
      // Create notification for admin who made the assignment (but not if it's a self-assignment)
      await pool.query(`
        INSERT INTO notifications (user_id, type, title, message, assignment_id)
        VALUES ($1, 'assignment_refused', 'Designação Recusada', $2, $3)
      `, [
        assignment.assigned_by,
        refuseNotifMessage,
        req.params.id
      ]);

      // Send push notification to admin
      sendPushToUser(assignment.assigned_by, {
        title: '❌ Designação Recusada',
        body: refuseNotifMessage,
        data: { assignmentId: req.params.id, url: `/assignment/${req.params.id}` }
      }).catch(err => console.error('Push notification error:', err));
    }

    await client.query('COMMIT');

    res.json({ message: 'Designação recusada com sucesso' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Refuse assignment error:', error);
    res.status(500).json({ error: 'Erro ao recusar designação' });
  } finally {
    client.release();
  }
});

// Start working on assignment (update status to in_progress)
router.post('/:id/start', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const result = await pool.query(`
      UPDATE assignments 
      SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND dirigente_id = $2 AND status = 'pending'
      RETURNING *
    `, [req.params.id, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Designação não encontrada ou não pode ser aceita' });
    }

    // Get assignment details for notification
    const assignment = result.rows[0];
    
    await client.query('BEGIN');

    // Get territory and dirigente info
    const infoResult = await pool.query(`
      SELECT t.territory_code, t.locality, u.name as dirigente_name
      FROM territories t, users u
      WHERE t.id = $1 AND u.id = $2
    `, [assignment.territory_id, req.user.id]);

    if (infoResult.rows.length > 0) {
      const { territory_code, locality, dirigente_name } = infoResult.rows[0];
      
      // Create notification for admin who made the assignment (but not if it's a self-assignment)
      if (assignment.assigned_by && assignment.assigned_by !== req.user.id) {
        const acceptNotifMessage = `${dirigente_name} aceitou a designação do território ${territory_code} (${locality})`;
        await pool.query(`
          INSERT INTO notifications (user_id, type, title, message, assignment_id)
          VALUES ($1, 'assignment_accepted', 'Designação Aceita', $2, $3)
        `, [
          assignment.assigned_by,
          acceptNotifMessage,
          assignment.id
        ]);

        // Send push notification to admin
        sendPushToUser(assignment.assigned_by, {
          title: '✅ Designação Aceita',
          body: acceptNotifMessage,
          data: { assignmentId: assignment.id, url: `/assignment/${assignment.id}` }
        }).catch(err => console.error('Push notification error:', err));
      }
    }

    await client.query('COMMIT');

    res.json({ message: 'Designação aceita com sucesso' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Accept assignment error:', error);
    res.status(500).json({ error: 'Erro ao aceitar designação' });
  } finally {
    client.release();
  }
});

export default router;

