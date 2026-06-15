import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db/config.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { generateUsername, generateUniqueUsername } from '../utils/generateUsername.js';

const router = express.Router();

// Get all users (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, username, role, created_at
      FROM users
      ORDER BY role, name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

// Get all dirigentes
router.get('/dirigentes', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, username, created_at
      FROM users
      WHERE role = 'dirigente'
      ORDER BY name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Get dirigentes error:', error);
    res.status(500).json({ error: 'Erro ao buscar dirigentes' });
  }
});

// Get all publishers
router.get('/publishers', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, username, created_at
      FROM users
      WHERE role = 'publisher'
      ORDER BY name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Get publishers error:', error);
    res.status(500).json({ error: 'Erro ao buscar publicadores' });
  }
});

// Get all assignable users (dirigentes + admins) for assignment creation
router.get('/assignable', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, username, role, created_at
      FROM users
      WHERE role IN ('dirigente', 'admin')
      ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Get assignable users error:', error);
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

// Change user's own password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres' });
    }

    // Get user from database
    const userResult = await pool.query(
      'SELECT password FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, userResult.rows[0].password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    const updateResult = await pool.query(
      `UPDATE users 
       SET password = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, name, username, role`,
      [hashedPassword, req.user.id]
    );

    res.json({
      message: 'Senha alterada com sucesso',
      user: updateResult.rows[0]
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Erro ao alterar senha' });
  }
});

// Get single user
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, username, role, created_at FROM users WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});

// Create user (admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, role, password } = req.body;
    const defaultPassword = process.env.DEFAULT_RESET_PASSWORD ?? '@Senha123';

    if (!name || !role) {
      return res.status(400).json({ error: 'Nome e função são obrigatórios' });
    }

    if (!['admin', 'dirigente', 'publisher'].includes(role)) {
      return res.status(400).json({ error: 'Role inválida' });
    }

    // Use provided password or default (default comes from env in production)
    const passwordToUse = password || defaultPassword;

    // Gerar username a partir do nome
    let username = generateUsername(name);
    let attempts = 1;

    // Verificar se username já existe e gerar alternativa se necessário
    while (true) {
      const checkResult = await pool.query(
        'SELECT id FROM users WHERE username = $1',
        [username]
      );
      if (checkResult.rows.length === 0) break;
      
      attempts++;
      username = generateUniqueUsername(generateUsername(name), attempts);
    }

    const hashedPassword = await bcrypt.hash(passwordToUse, 10);

    const result = await pool.query(`
      INSERT INTO users (name, username, password, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, username, role, created_at
    `, [name, username, hashedPassword, role]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

// Update user (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, role, password } = req.body;

    let query;
    let params;

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query = `
        UPDATE users 
        SET name = COALESCE($1, name),
            role = COALESCE($2, role),
            password = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING id, name, username, role, created_at
      `;
      params = [name, role, hashedPassword, req.params.id];
    } else {
      query = `
        UPDATE users 
        SET name = COALESCE($1, name),
            role = COALESCE($2, role),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING id, name, username, role, created_at
      `;
      params = [name, role, req.params.id];
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

// Delete user (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Prevent deleting yourself
    if (Number.parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Você não pode excluir sua própria conta' });
    }

    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({ message: 'Usuário excluído com sucesso' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Erro ao excluir usuário' });
  }
});

// Get user notifications
router.get('/:id/notifications', authenticateToken, async (req, res) => {
  try {
    // Users can only see their own notifications, admins can see any
    if (req.user.role !== 'admin' && req.user.id !== Number.parseInt(req.params.id)) {
      return res.status(403).json({ error: 'Acesso não autorizado' });
    }

    const result = await pool.query(`
      SELECT * FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [req.params.id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Erro ao buscar notificações' });
  }
});

// Mark notification as read
router.put('/notifications/:notificationId/read', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE notifications 
      SET is_read = true
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [req.params.notificationId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notificação não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Erro ao marcar notificação como lida' });
  }
});

// Mark all notifications as read
router.put('/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    await pool.query(`
      UPDATE notifications 
      SET is_read = true
      WHERE user_id = $1 AND is_read = false
    `, [req.user.id]);

    res.json({ message: 'Todas as notificações foram marcadas como lidas' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Erro ao marcar notificações como lidas' });
  }
});

// Delete notification
router.delete('/notifications/:notificationId', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      DELETE FROM notifications 
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `, [req.params.notificationId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notificação não encontrada' });
    }

    res.json({ message: 'Notificação excluída com sucesso' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Erro ao excluir notificação' });
  }
});

// Reset user password to default (admin only). Default password from env DEFAULT_RESET_PASSWORD (e.g. in GCP).
router.put('/:id/reset-password', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const defaultPassword = process.env.DEFAULT_RESET_PASSWORD ?? '@Senha123';

    // Prevent admin resetting their own password through this endpoint
    if (Number.parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Use a opção "Alterar Senha" para trocar sua própria senha' });
    }

    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const result = await pool.query(
      `UPDATE users 
       SET password = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, name, username, role`,
      [hashedPassword, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({
      message: 'Senha resetada para a padrão com sucesso',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Erro ao resetar senha' });
  }
});

export default router;

