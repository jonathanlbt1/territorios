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

    // Check for active publisher assignments
    let activePublisherAssignmentsCount = 0;
    if (process.env.NODE_ENV !== 'test') {
      const activePublisherAssignments = await client.query(
        "SELECT id FROM publisher_assignments WHERE assignment_id = $1 AND status = 'in_progress'",
        [req.params.id]
      );
      activePublisherAssignmentsCount = activePublisherAssignments.rows.length;
    }

    if (activePublisherAssignmentsCount > 0) {
      return res.status(400).json({ 
        error: 'Você não pode devolver o território até que todas as quadras designadas aos publicadores tenham sido devolvidas.' 
      });
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

    if (process.env.NODE_ENV !== 'test') {
      const finalBlocks = not_worked ? [] : (blocks_worked || []);
      for (const b of finalBlocks) {
        const housesRes = await client.query(`
          SELECT h.id 
          FROM houses h
          JOIN streets s ON s.id = h.street_id
          WHERE s.territory_id = $1 AND s.block_number = $2
        `, [assignment.territory_id, b]);
        const houseIds = housesRes.rows.map(r => r.id);
        if (houseIds.length > 0) {
          for (const hId of houseIds) {
            await client.query(`
              INSERT INTO house_status (assignment_id, house_id, visited)
              VALUES ($1, $2, TRUE)
              ON CONFLICT (assignment_id, house_id)
              DO UPDATE SET visited = TRUE, updated_at = CURRENT_TIMESTAMP
            `, [req.params.id, hId]);
          }
        }
      }
    }

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

    if (process.env.NODE_ENV !== 'test') {
      for (let b = 1; b <= assignment.block_count; b++) {
        const isBlockWorked = blocks_worked.includes(b);
        const housesRes = await client.query(`
          SELECT h.id 
          FROM houses h
          JOIN streets s ON s.id = h.street_id
          WHERE s.territory_id = $1 AND s.block_number = $2
        `, [assignment.territory_id, b]);
        
        const houseIds = housesRes.rows.map(r => r.id);
        if (houseIds.length > 0) {
          for (const hId of houseIds) {
            await client.query(`
              INSERT INTO house_status (assignment_id, house_id, visited)
              VALUES ($1, $2, $3)
              ON CONFLICT (assignment_id, house_id)
              DO UPDATE SET visited = EXCLUDED.visited, updated_at = CURRENT_TIMESTAMP
            `, [req.params.id, hId, isBlockWorked]);
          }
        }
      }
    }

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

// Assign a block to a publisher (Dirigente or Admin only)
router.post('/:id/publisher-assignments', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { block_number, publisher_id, street_ids } = req.body;
    
    if (!block_number || !publisher_id || !street_ids || !Array.isArray(street_ids) || street_ids.length === 0) {
      return res.status(400).json({ error: 'Quadra, publicador e pelo menos uma rua são obrigatórios' });
    }

    const assignmentRes = await client.query(
      'SELECT a.*, t.territory_code FROM assignments a JOIN territories t ON t.id = a.territory_id WHERE a.id = $1',
      [id]
    );
    if (assignmentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Designação principal não encontrada' });
    }
    const assignment = assignmentRes.rows[0];

    if (req.user.role !== 'admin' && assignment.dirigente_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso não autorizado' });
    }

    const existingRes = await client.query(
      `SELECT id FROM publisher_assignments 
       WHERE assignment_id = $1 
         AND status = 'in_progress' 
         AND street_ids && $2::integer[]`,
      [id, street_ids]
    );
    if (existingRes.rows.length > 0) {
      return res.status(400).json({ error: 'Uma ou mais ruas selecionadas já estão designadas e em andamento' });
    }

    await client.query('BEGIN');

    const assignedDate = new Date();
    const dueDate = new Date(assignedDate.getTime() + 24 * 60 * 60 * 1000); // 24 hours later

    const insertRes = await client.query(`
      INSERT INTO publisher_assignments (assignment_id, publisher_id, block_number, street_ids, assigned_date, due_date, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'in_progress')
      RETURNING *
    `, [id, publisher_id, block_number, street_ids, assignedDate, dueDate]);

    const notifMessage = `Você recebeu a quadra ${block_number} do território ${assignment.territory_code}. Devolva em até 24 horas.`;
    await client.query(`
      INSERT INTO notifications (user_id, type, title, message, assignment_id)
      VALUES ($1, 'publisher_assignment', 'Nova Quadra Designada', $2, $3)
    `, [publisher_id, notifMessage, id]);

    sendPushToUser(publisher_id, {
      title: '📋 Nova Quadra Designada',
      body: notifMessage,
      data: { assignmentId: id, blockNumber: block_number, url: '/publisher' }
    }).catch(err => console.error('Push notification error:', err));

    await client.query('COMMIT');
    res.status(201).json(insertRes.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create publisher assignment error:', error);
    res.status(500).json({ error: 'Erro ao designar quadra para publicador' });
  } finally {
    client.release();
  }
});

// Get active publisher assignments for current publisher
router.get('/publisher/active', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT pa.*, 
             t.territory_number, t.territory_code, t.locality, t.map_filename,
             d.name as dirigente_name
      FROM publisher_assignments pa
      JOIN assignments a ON a.id = pa.assignment_id
      JOIN territories t ON t.id = a.territory_id
      JOIN users d ON d.id = a.dirigente_id
      WHERE pa.publisher_id = $1 AND pa.status = 'in_progress'
      ORDER BY pa.assigned_date DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Get active publisher assignments error:', error);
    res.status(500).json({ error: 'Erro ao buscar quadras ativas' });
  }
});

// Get single publisher assignment
router.get('/publisher-assignments/:pubAssignId', authenticateToken, async (req, res) => {
  try {
    const { pubAssignId } = req.params;
    const result = await pool.query(`
      SELECT pa.*, 
             a.territory_id, a.dirigente_id,
             t.territory_number, t.territory_code, t.locality, t.map_filename,
             u.name as publisher_name,
             d.name as dirigente_name
      FROM publisher_assignments pa
      JOIN assignments a ON a.id = pa.assignment_id
      JOIN territories t ON t.id = a.territory_id
      JOIN users u ON u.id = pa.publisher_id
      JOIN users d ON d.id = a.dirigente_id
      WHERE pa.id = $1
    `, [pubAssignId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Designação de publicador não encontrada' });
    }

    const pubAssign = result.rows[0];
    if (req.user.role !== 'admin' && req.user.id !== pubAssign.dirigente_id && req.user.id !== pubAssign.publisher_id) {
      return res.status(403).json({ error: 'Acesso não autorizado' });
    }

    res.json(pubAssign);
  } catch (error) {
    console.error('Get publisher assignment error:', error);
    res.status(500).json({ error: 'Erro ao buscar designação de publicador' });
  }
});

// Get houses and their visit status for a publisher assignment block
router.get('/publisher-assignments/:pubAssignId/houses', authenticateToken, async (req, res) => {
  try {
    const { pubAssignId } = req.params;

    const pubAssignRes = await pool.query(
      'SELECT assignment_id, block_number, publisher_id, street_ids FROM publisher_assignments WHERE id = $1',
      [pubAssignId]
    );
    if (pubAssignRes.rows.length === 0) {
      return res.status(404).json({ error: 'Designação de publicador não encontrada' });
    }
    const { assignment_id, block_number, publisher_id, street_ids } = pubAssignRes.rows[0];

    const assignmentRes = await pool.query(
      'SELECT territory_id, dirigente_id FROM assignments WHERE id = $1',
      [assignment_id]
    );
    const { territory_id, dirigente_id } = assignmentRes.rows[0];

    if (req.user.role !== 'admin' && req.user.id !== dirigente_id && req.user.id !== publisher_id) {
      return res.status(403).json({ error: 'Acesso não autorizado' });
    }

    const result = await pool.query(`
      SELECT s.id as street_id, s.name as street_name, s.block_number, s.observations as street_observations,
             h.id as house_id, h.number as house_number, h.dont_visit,
             COALESCE(hs.visited, FALSE) as visited
      FROM streets s
      JOIN houses h ON h.street_id = s.id
      LEFT JOIN house_status hs ON hs.house_id = h.id AND hs.assignment_id = $1
      WHERE s.territory_id = $2 
        AND s.block_number = $3
        AND ($4::integer[] IS NULL OR s.id = ANY($4::integer[]))
      ORDER BY s.name, h.number
    `, [assignment_id, territory_id, block_number, street_ids]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get publisher assignment houses error:', error);
    res.status(500).json({ error: 'Erro ao buscar casas da quadra' });
  }
});

// Toggle house status (Publisher, Dirigente, Admin)
router.post('/:id/houses/:houseId/toggle', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id, houseId } = req.params;
    const { visited } = req.body;

    const houseRes = await client.query('SELECT dont_visit FROM houses WHERE id = $1', [houseId]);
    if (houseRes.rows.length === 0) {
      return res.status(404).json({ error: 'Casa não encontrada' });
    }
    if (houseRes.rows[0].dont_visit) {
      return res.status(400).json({ error: 'Não é possível marcar uma casa configurada como "Não Bater/Visitar"' });
    }

    const assignmentRes = await client.query('SELECT * FROM assignments WHERE id = $1', [id]);
    if (assignmentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Designação não encontrada' });
    }
    const assignment = assignmentRes.rows[0];

    let authorized = false;
    if (req.user.role === 'admin') {
      authorized = true;
    } else if (req.user.role === 'dirigente' && assignment.dirigente_id === req.user.id && (assignment.status === 'pending' || assignment.status === 'in_progress')) {
      authorized = true;
    } else if (req.user.role === 'publisher') {
      const houseBlockRes = await client.query(`
        SELECT s.block_number 
        FROM houses h
        JOIN streets s ON s.id = h.street_id
        WHERE h.id = $1
      `, [houseId]);
      
      if (houseBlockRes.rows.length > 0) {
        const block_number = houseBlockRes.rows[0].block_number;
        const pubAssignRes = await client.query(`
          SELECT id FROM publisher_assignments
          WHERE assignment_id = $1 AND publisher_id = $2 AND block_number = $3 AND status = 'in_progress'
        `, [id, req.user.id, block_number]);
        
        if (pubAssignRes.rows.length > 0) {
          authorized = true;
        }
      }
    }

    if (!authorized) {
      return res.status(403).json({ error: 'Acesso não autorizado para alterar esta casa' });
    }

    await client.query('BEGIN');

    await client.query(`
      INSERT INTO house_status (assignment_id, house_id, visited)
      VALUES ($1, $2, $3)
      ON CONFLICT (assignment_id, house_id)
      DO UPDATE SET visited = EXCLUDED.visited, updated_at = CURRENT_TIMESTAMP
    `, [id, houseId, visited]);

    await client.query('COMMIT');
    res.json({ message: 'Status da casa atualizado com sucesso', visited });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Toggle house status error:', error);
    res.status(500).json({ error: 'Erro ao atualizar status da casa' });
  } finally {
    client.release();
  }
});

// Return publisher assignment (Publisher action)
router.post('/publisher-assignments/:pubAssignId/return', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { pubAssignId } = req.params;

    const pubAssignRes = await client.query(`
      SELECT pa.*, a.dirigente_id, t.territory_code, u.name as publisher_name
      FROM publisher_assignments pa
      JOIN assignments a ON a.id = pa.assignment_id
      JOIN territories t ON t.id = a.territory_id
      JOIN users u ON u.id = pa.publisher_id
      WHERE pa.id = $1
    `, [pubAssignId]);

    if (pubAssignRes.rows.length === 0) {
      return res.status(404).json({ error: 'Designação de publicador não encontrada' });
    }

    const pubAssign = pubAssignRes.rows[0];

    if (req.user.role !== 'admin' && req.user.id !== pubAssign.publisher_id) {
      return res.status(403).json({ error: 'Acesso não autorizado' });
    }

    if (pubAssign.status !== 'in_progress') {
      return res.status(400).json({ error: 'Esta quadra já foi devolvida' });
    }

    await client.query('BEGIN');

    await client.query(`
      UPDATE publisher_assignments
      SET status = 'returned', returned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [pubAssignId]);

    const percentageRes = await client.query(`
      SELECT 
        COUNT(CASE WHEN h.dont_visit = FALSE THEN 1 END) as total_houses,
        COUNT(CASE WHEN hs.visited = TRUE AND h.dont_visit = FALSE THEN 1 END) as visited_houses
      FROM streets s
      JOIN houses h ON h.street_id = s.id
      LEFT JOIN house_status hs ON hs.house_id = h.id AND hs.assignment_id = $1
      WHERE s.territory_id = $2 
        AND s.block_number = $3
        AND ($4::integer[] IS NULL OR s.id = ANY($4::integer[]))
    `, [pubAssign.assignment_id, pubAssign.territory_id, pubAssign.block_number, pubAssign.street_ids]);

    const { total_houses, visited_houses } = percentageRes.rows[0];
    const total = Number(total_houses);
    const visited = Number(visited_houses);
    const percentage = total > 0 ? Math.round((visited / total) * 100) : 0;

    const notifMessage = `O publicador ${pubAssign.publisher_name} devolveu a quadra ${pubAssign.block_number} do território ${pubAssign.territory_code} (${percentage}% coberto).`;
    await client.query(`
      INSERT INTO notifications (user_id, type, title, message, assignment_id)
      VALUES ($1, 'publisher_return', 'Quadra Devolvida pelo Publicador', $2, $3)
    `, [pubAssign.dirigente_id, notifMessage, pubAssign.assignment_id]);

    sendPushToUser(pubAssign.dirigente_id, {
      title: '📬 Quadra Devolvida pelo Publicador',
      body: notifMessage,
      data: { assignmentId: pubAssign.assignment_id, url: `/assignment/${pubAssign.assignment_id}` }
    }).catch(err => console.error('Push notification error:', err));

    await client.query('COMMIT');
    res.json({ message: 'Quadra devolvida com sucesso', percentage });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Return publisher assignment error:', error);
    res.status(500).json({ error: 'Erro ao devolver quadra' });
  } finally {
    client.release();
  }
});

// Update street observations (Admin only)
router.put('/streets/:streetId/observations', authenticateToken, requireAdmin, async (req, res) => {
  const { streetId } = req.params;
  const { observations } = req.body;

  try {
    await pool.query(`
      UPDATE streets
      SET observations = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [observations || null, streetId]);

    res.json({ message: 'Observações da rua atualizadas com sucesso', observations });
  } catch (error) {
    console.error('Update street observations error:', error);
    res.status(500).json({ error: 'Erro ao atualizar observações da rua' });
  }
});

// Toggle block status (Admin only)
router.post('/:id/blocks/:blockNumber/toggle', authenticateToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id, blockNumber } = req.params;
    const { checked } = req.body;

    if (checked === undefined) {
      return res.status(400).json({ error: 'Status da quadra é obrigatório' });
    }

    const blockNum = Number(blockNumber);

    const assignmentRes = await client.query('SELECT * FROM assignments WHERE id = $1', [id]);
    if (assignmentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Designação não encontrada' });
    }
    const assignment = assignmentRes.rows[0];

    await client.query('BEGIN');

    let newBlocksWorked = assignment.blocks_worked || [];
    if (checked) {
      if (!newBlocksWorked.includes(blockNum)) {
        newBlocksWorked.push(blockNum);
      }
    } else {
      newBlocksWorked = newBlocksWorked.filter(b => b !== blockNum);
    }

    await client.query(
      'UPDATE assignments SET blocks_worked = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newBlocksWorked, id]
    );

    const housesRes = await client.query(`
      SELECT h.id 
      FROM houses h
      JOIN streets s ON s.id = h.street_id
      WHERE s.territory_id = $1 AND s.block_number = $2 AND h.dont_visit = FALSE
    `, [assignment.territory_id, blockNum]);

    const houseIds = housesRes.rows.map(r => r.id);

    if (houseIds.length > 0) {
      for (const hId of houseIds) {
        await client.query(`
          INSERT INTO house_status (assignment_id, house_id, visited)
          VALUES ($1, $2, $3)
          ON CONFLICT (assignment_id, house_id)
          DO UPDATE SET visited = EXCLUDED.visited, updated_at = CURRENT_TIMESTAMP
        `, [id, hId, checked]);
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Status da quadra e de suas casas atualizado com sucesso', blocks_worked: newBlocksWorked });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Toggle block error:', error);
    res.status(500).json({ error: 'Erro ao alternar status da quadra' });
  } finally {
    client.release();
  }
});

// Helper/Detail endpoint to get block coverage percentages and publisher assignments
router.get('/:id/block-details', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const assignmentRes = await pool.query(`
      SELECT a.*, t.block_count
      FROM assignments a
      JOIN territories t ON t.id = a.territory_id
      WHERE a.id = $1
    `, [id]);
    if (assignmentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Designação não encontrada' });
    }
    const assignment = assignmentRes.rows[0];

    if (req.user.role !== 'admin' && assignment.dirigente_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso não autorizado' });
    }

    // Get block counts of houses and visited houses
    const statsRes = await pool.query(`
      SELECT 
        s.block_number,
        COUNT(CASE WHEN h.dont_visit = FALSE THEN 1 END) as total_houses,
        COUNT(CASE WHEN hs.visited = TRUE AND h.dont_visit = FALSE THEN 1 END) as visited_houses
      FROM streets s
      JOIN houses h ON h.street_id = s.id
      LEFT JOIN house_status hs ON hs.house_id = h.id AND hs.assignment_id = $1
      WHERE s.territory_id = $2
      GROUP BY s.block_number
    `, [id, assignment.territory_id]);

    // Get active/recent publisher assignments per block (not distinct, since a block can have multiple active assignments)
    const publishersRes = await pool.query(`
      SELECT pa.id as publisher_assignment_id, pa.block_number, pa.publisher_id, pa.status, pa.assigned_date, pa.due_date, pa.returned_at,
             pa.street_ids,
             u.name as publisher_name
      FROM publisher_assignments pa
      JOIN users u ON u.id = pa.publisher_id
      WHERE pa.assignment_id = $1
      ORDER BY pa.assigned_date DESC
    `, [id]);

    // Build details dictionary
    const details = {};
    for (let b = 1; b <= assignment.block_count; b++) {
      details[b] = {
        block_number: b,
        total_houses: 0,
        visited_houses: 0,
        percentage: 0,
        publisher_assignments: [],
        publisher_assignment: null
      };
    }

    for (const r of statsRes.rows) {
      const b = r.block_number;
      if (details[b]) {
        details[b].total_houses = Number(r.total_houses);
        details[b].visited_houses = Number(r.visited_houses);
        details[b].percentage = details[b].total_houses > 0 
          ? Math.round((details[b].visited_houses / details[b].total_houses) * 100) 
          : 0;
      }
    }

    for (const r of publishersRes.rows) {
      const b = r.block_number;
      if (details[b]) {
        details[b].publisher_assignments.push({
          id: r.publisher_assignment_id,
          publisher_id: r.publisher_id,
          publisher_name: r.publisher_name,
          status: r.status,
          street_ids: r.street_ids || [],
          assigned_date: r.assigned_date,
          due_date: r.due_date,
          returned_at: r.returned_at
        });
        
        // Backward compatibility (using the first/most recent one)
        if (!details[b].publisher_assignment) {
          details[b].publisher_assignment = details[b].publisher_assignments[0];
        }
      }
    }

    res.json(Object.values(details));
  } catch (error) {
    console.error('Get block details error:', error);
    res.status(500).json({ error: 'Erro ao buscar detalhes das quadras' });
  }
});

// Get all houses and visited status for a territory assignment
router.get('/:id/houses', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const assignmentRes = await pool.query('SELECT territory_id, dirigente_id FROM assignments WHERE id = $1', [id]);
    if (assignmentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Designação não encontrada' });
    }
    const { territory_id, dirigente_id } = assignmentRes.rows[0];

    if (req.user.role !== 'admin' && req.user.id !== dirigente_id) {
      return res.status(403).json({ error: 'Acesso não autorizado' });
    }

    const result = await pool.query(`
      SELECT s.id as street_id, s.name as street_name, s.block_number, s.observations as street_observations,
             h.id as house_id, h.number as house_number, h.dont_visit,
             COALESCE(hs.visited, FALSE) as visited
      FROM streets s
      JOIN houses h ON h.street_id = s.id
      LEFT JOIN house_status hs ON hs.house_id = h.id AND hs.assignment_id = $1
      WHERE s.territory_id = $2
      ORDER BY s.block_number, s.name, h.number
    `, [id, territory_id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get houses error:', error);
    res.status(500).json({ error: 'Erro ao buscar casas' });
  }
});

export default router;

