import express from 'express';
import pool from '../db/config.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const ALLOWED_RESULTS = new Set(['complete', 'partial', 'not_done']);

async function refreshTerritoryLastWorked(territoryId) {
  const latest = await pool.query(
    `SELECT 
        MAX(COALESCE(conclusion_date, worked_date)) as last_date
     FROM territory_history
     WHERE territory_id = $1
       AND result IN ('complete', 'partial')`,
    [territoryId]
  );

  const lastDate = latest.rows[0]?.last_date || null;
  await pool.query(
    'UPDATE territories SET last_worked_date = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [lastDate, territoryId]
  );
}

const router = express.Router();

// Get territory coverage summary
router.get('/coverage', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { start_date } = req.query;
    
    const params = [];
    
    if (start_date) {
      params.push(start_date);
    }

    const result = await pool.query(`
      SELECT 
        t.id,
        t.territory_number,
        t.territory_code,
        t.locality,
        t.block_count,
        t.last_worked_date,
        COUNT(th.id) FILTER (WHERE th.worked_date IS NOT NULL ${start_date ? `AND th.worked_date >= $1` : ''}) as times_worked,
        COUNT(CASE WHEN th.result = 'complete' ${start_date ? `AND th.worked_date >= $1` : ''} THEN 1 END) as times_complete,
        COUNT(CASE WHEN th.result = 'partial' ${start_date ? `AND th.worked_date >= $1` : ''} THEN 1 END) as times_partial,
        COUNT(CASE WHEN th.result = 'not_done' ${start_date ? `AND th.worked_date >= $1` : ''} THEN 1 END) as times_not_done
      FROM territories t
      LEFT JOIN territory_history th ON th.territory_id = t.id
      GROUP BY t.id
      ORDER BY t.last_worked_date ASC NULLS FIRST
    `, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Get coverage report error:', error);
    res.status(500).json({ error: 'Erro ao gerar relatório de cobertura' });
  }
});

// Get most/least worked territories
router.get('/territory-frequency', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { order = 'desc', limit = 20, start_date } = req.query;
    
    const params = [limit];
    
    if (start_date) {
      params.push(start_date);
    }

    const result = await pool.query(`
      SELECT 
        t.id,
        t.territory_number,
        t.territory_code,
        t.locality,
        t.last_worked_date,
        COUNT(th.id) FILTER (WHERE th.worked_date IS NOT NULL ${start_date ? `AND th.worked_date >= $2` : ''}) as times_worked,
        MAX(th.worked_date) FILTER (WHERE th.worked_date IS NOT NULL ${start_date ? `AND th.worked_date >= $2` : ''}) as last_work_date
      FROM territories t
      LEFT JOIN territory_history th ON th.territory_id = t.id
      GROUP BY t.id
      ORDER BY times_worked ${order === 'asc' ? 'ASC' : 'DESC'}, t.territory_number ASC
      LIMIT $1
    `, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Get territory frequency report error:', error);
    res.status(500).json({ error: 'Erro ao gerar relatório de frequência' });
  }
});

// Get territories with frequent partial work
router.get('/partial-frequency', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { start_date } = req.query;
    
    const params = [];
    let dateFilter = '';
    
    if (start_date) {
      params.push(start_date);
      dateFilter = `AND th.worked_date >= $1`;
    }

    const result = await pool.query(`
      SELECT 
        t.id,
        t.territory_number,
        t.territory_code,
        t.locality,
        t.block_count,
        COUNT(CASE WHEN th.result = 'partial' ${dateFilter} THEN 1 END) as partial_count,
        COUNT(th.id) FILTER (WHERE th.worked_date IS NOT NULL ${start_date ? `AND th.worked_date >= $1` : ''}) as total_times,
        ROUND(
          COUNT(CASE WHEN th.result = 'partial' ${dateFilter} THEN 1 END)::numeric / 
          NULLIF(COUNT(th.id) FILTER (WHERE th.worked_date IS NOT NULL ${start_date ? `AND th.worked_date >= $1` : ''}), 0) * 100, 
          1
        ) as partial_percentage
      FROM territories t
      LEFT JOIN territory_history th ON th.territory_id = t.id
      GROUP BY t.id
      HAVING COUNT(CASE WHEN th.result = 'partial' ${dateFilter} THEN 1 END) > 0
      ORDER BY partial_count DESC, partial_percentage DESC
    `, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Get partial frequency report error:', error);
    res.status(500).json({ error: 'Erro ao gerar relatório de trabalhos parciais' });
  }
});

// Get dirigente performance report
router.get('/dirigente-performance', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.username,
        COUNT(a.id) as total_assignments,
        COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) as cancelled,
        COUNT(CASE WHEN a.validation_result = 'complete' THEN 1 END) as complete_work,
        COUNT(CASE WHEN a.validation_result = 'partial' THEN 1 END) as partial_work,
        COUNT(CASE WHEN a.validation_result = 'not_done' THEN 1 END) as not_done_work,
        ROUND(
          COUNT(CASE WHEN a.validation_result = 'complete' THEN 1 END)::numeric / 
          NULLIF(COUNT(CASE WHEN a.status = 'completed' THEN 1 END), 0) * 100,
          1
        ) as completion_rate
      FROM users u
      LEFT JOIN assignments a ON a.dirigente_id = u.id
      WHERE u.role = 'dirigente'
      GROUP BY u.id
      ORDER BY total_assignments DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get dirigente performance report error:', error);
    res.status(500).json({ error: 'Erro ao gerar relatório de desempenho' });
  }
});

// Get work by period
router.get('/work-by-period', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { start_date, end_date, groupBy = 'month' } = req.query;

    let dateFormat;
    switch (groupBy) {
      case 'day':
        dateFormat = 'YYYY-MM-DD';
        break;
      case 'week':
        dateFormat = 'IYYY-IW';
        break;
      case 'year':
        dateFormat = 'YYYY';
        break;
      default:
        dateFormat = 'YYYY-MM';
    }

    let query = `
      SELECT 
        TO_CHAR(worked_date, '${dateFormat}') as period,
        COUNT(*) as total_work,
        COUNT(CASE WHEN result = 'complete' THEN 1 END) as complete,
        COUNT(CASE WHEN result = 'partial' THEN 1 END) as partial,
        COUNT(CASE WHEN result = 'not_done' THEN 1 END) as not_done
      FROM territory_history
    `;

    const params = [];
    const conditions = [];

    if (start_date) {
      params.push(start_date);
      conditions.push(`worked_date >= $${params.length}`);
    }

    if (end_date) {
      params.push(end_date);
      conditions.push(`worked_date <= $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ` GROUP BY TO_CHAR(worked_date, '${dateFormat}') ORDER BY period`;

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Get work by period report error:', error);
    res.status(500).json({ error: 'Erro ao gerar relatório por período' });
  }
});

// Get dashboard stats
router.get('/dashboard-stats', authenticateToken, async (req, res) => {
  try {
    const stats = {};

    if (req.user.role === 'admin') {
      // Total territories
      const territoriesCount = await pool.query('SELECT COUNT(*) FROM territories');
      stats.totalTerritories = Number.parseInt(territoriesCount.rows[0].count);

      // Active assignments
      const activeAssignments = await pool.query(
        "SELECT COUNT(*) FROM assignments WHERE status IN ('pending', 'in_progress')"
      );
      stats.activeAssignments = Number.parseInt(activeAssignments.rows[0].count);

      // Pending validations
      const pendingValidations = await pool.query(
        "SELECT COUNT(*) FROM assignments WHERE status = 'returned'"
      );
      stats.pendingValidations = Number.parseInt(pendingValidations.rows[0].count);

      // Total dirigentes
      const dirigentesCount = await pool.query(
        "SELECT COUNT(*) FROM users WHERE role = 'dirigente'"
      );
      stats.totalDirigentes = Number.parseInt(dirigentesCount.rows[0].count);

      // Never worked territories
      const neverWorked = await pool.query(
        'SELECT COUNT(*) FROM territories WHERE last_worked_date IS NULL'
      );
      stats.neverWorkedTerritories = Number.parseInt(neverWorked.rows[0].count);

      // This month completions
      const thisMonthCompletions = await pool.query(`
        SELECT COUNT(*) FROM territory_history 
        WHERE worked_date >= DATE_TRUNC('month', CURRENT_DATE)
      `);
      stats.thisMonthCompletions = Number.parseInt(thisMonthCompletions.rows[0].count);

      // Overdue assignments
      const overdueAssignments = await pool.query(`
        SELECT COUNT(*) FROM assignments 
        WHERE status IN ('pending', 'in_progress')
          AND assigned_date <= CURRENT_DATE - INTERVAL '60 days'
      `);
      stats.overdueAssignments = Number.parseInt(overdueAssignments.rows[0].count);

    } else {
      // Dirigente stats
      const myAssignments = await pool.query(
        "SELECT COUNT(*) FROM assignments WHERE dirigente_id = $1 AND status IN ('pending', 'in_progress')",
        [req.user.id]
      );
      stats.myActiveAssignments = Number.parseInt(myAssignments.rows[0].count);

      const myCompletedThisMonth = await pool.query(`
        SELECT COUNT(*) FROM assignments 
        WHERE dirigente_id = $1 
        AND status IN ('completed', 'returned')
        AND COALESCE(returned_at, validated_at) >= DATE_TRUNC('month', CURRENT_DATE)
      `, [req.user.id]);
      stats.myCompletedThisMonth = Number.parseInt(myCompletedThisMonth.rows[0].count);

      const myUnreadNotifications = await pool.query(
        'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
        [req.user.id]
      );
      stats.unreadNotifications = Number.parseInt(myUnreadNotifications.rows[0].count);
    }

    // Unread notifications for both
    const unreadNotifications = await pool.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );
    stats.unreadNotifications = Number.parseInt(unreadNotifications.rows[0].count);

    res.json(stats);
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

// Get territory history for S-13 form
router.get('/territory-history-s13', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        th.id,
        th.territory_id,
        th.worked_date as assigned_date,
        th.conclusion_date,
        CASE WHEN th.result = 'complete' THEN COALESCE(th.conclusion_date, th.worked_date) ELSE NULL END as validated_at,
        t.territory_number,
        t.territory_code,
        t.locality,
        t.block_count,
        th.dirigente_id,
        th.dirigente_name,
        th.result as validation_result,
        th.observations,
        th.blocks_worked
      FROM territory_history th
      JOIN territories t ON t.id = th.territory_id
      ORDER BY t.territory_number ASC, th.worked_date DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get territory history for S-13 error:', error);
    res.status(500).json({ error: 'Erro ao buscar histórico de territórios' });
  }
});

// Update a territory history record (admin manual edit)
router.put('/territory-history-s13/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { dirigente_id, dirigente_name, assigned_date, conclusion_date, status } = req.body;

    if (!assigned_date) {
      return res.status(400).json({ error: 'Data de designação é obrigatória' });
    }

    if (status && !ALLOWED_RESULTS.has(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    let finalDirigenteName = dirigente_name || null;
    let finalDirigenteId = dirigente_id || null;

    if (dirigente_id) {
      const user = await pool.query('SELECT id, name FROM users WHERE id = $1', [dirigente_id]);
      if (user.rows.length === 0) {
        return res.status(404).json({ error: 'Dirigente não encontrado' });
      }
      finalDirigenteName = user.rows[0].name;
      finalDirigenteId = user.rows[0].id;
    }

    const target = await pool.query('SELECT territory_id FROM territory_history WHERE id = $1', [req.params.id]);
    if (target.rows.length === 0) {
      return res.status(404).json({ error: 'Registro não encontrado' });
    }

    const isComplete = status === 'complete';
    const normalizedConclusion = isComplete ? (conclusion_date || assigned_date) : null;

    await pool.query(
      `UPDATE territory_history
       SET dirigente_id = $1,
           dirigente_name = $2,
           worked_date = $3,
           conclusion_date = $4,
           result = COALESCE($5, result)
       WHERE id = $6`,
      [finalDirigenteId, finalDirigenteName, assigned_date, normalizedConclusion, status || null, req.params.id]
    );

    await refreshTerritoryLastWorked(target.rows[0].territory_id);

    res.json({ message: 'Registro atualizado com sucesso' });
  } catch (error) {
    console.error('Update territory history error:', error);
    res.status(500).json({ error: 'Erro ao atualizar registro' });
  }
});

// Create a manual territory history record (admin)
router.post('/territory-history-s13', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { territory_id, dirigente_id, assigned_date, conclusion_date, status } = req.body;

    if (!territory_id) return res.status(400).json({ error: 'Território é obrigatório' });
    if (!assigned_date) return res.status(400).json({ error: 'Data de designação é obrigatória' });
    if (status && !ALLOWED_RESULTS.has(status)) return res.status(400).json({ error: 'Status inválido' });

    let finalDirigenteId = dirigente_id || null;
    let finalDirigenteName = null;

    if (dirigente_id) {
      const user = await pool.query('SELECT id, name FROM users WHERE id = $1', [dirigente_id]);
      if (user.rows.length === 0) return res.status(404).json({ error: 'Dirigente não encontrado' });
      finalDirigenteId = user.rows[0].id;
      finalDirigenteName = user.rows[0].name;
    }

    const territory = await pool.query('SELECT id, block_count FROM territories WHERE id = $1', [territory_id]);
    if (territory.rows.length === 0) return res.status(404).json({ error: 'Território não encontrado' });

    const isComplete = status === 'complete';
    const normalizedConclusion = isComplete ? (conclusion_date || assigned_date) : null;

    await pool.query(
      `INSERT INTO territory_history
        (territory_id, assignment_id, dirigente_id, dirigente_name, worked_date, conclusion_date, blocks_worked, total_blocks, result, observations, validated_by)
       VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, NULL)`
      , [
        territory_id,
        finalDirigenteId,
        finalDirigenteName,
        assigned_date,
        normalizedConclusion,
        [],
        territory.rows[0].block_count,
        status || 'complete',
        null
      ]
    );

    await refreshTerritoryLastWorked(territory_id);

    res.status(201).json({ message: 'Registro criado com sucesso' });
  } catch (error) {
    console.error('Create territory history error:', error);
    res.status(500).json({ error: 'Erro ao criar registro' });
  }
});

// Delete a territory history record (admin manual edit)
router.delete('/territory-history-s13/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const deleted = await pool.query(
      'DELETE FROM territory_history WHERE id = $1 RETURNING territory_id',
      [req.params.id]
    );

    if (deleted.rows.length === 0) {
      return res.status(404).json({ error: 'Registro não encontrado' });
    }

    await refreshTerritoryLastWorked(deleted.rows[0].territory_id);

    res.json({ message: 'Registro removido com sucesso' });
  } catch (error) {
    console.error('Delete territory history error:', error);
    res.status(500).json({ error: 'Erro ao excluir registro' });
  }
});

export default router;

