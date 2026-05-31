import express from 'express';
import pool from '../db/config.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PNG_DIR = path.join(__dirname, '../../png_files');

// Multer config for PNG upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PNG_DIR);
  },
  filename: (req, file, cb) => {
    // Use the original filename or generate based on territory number
    const filename = req.body.filename || file.originalname;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos PNG são permitidos'), false);
    }
  }
});

const router = express.Router();

// Get all territories
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, 
        (SELECT COUNT(*) FROM assignments a WHERE a.territory_id = t.id AND a.status IN ('pending', 'in_progress')) > 0 as is_assigned
      FROM territories t
      ORDER BY t.territory_number ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Get territories error:', error);
    res.status(500).json({ error: 'Erro ao buscar territórios' });
  }
});

// List available PNG files in the png_files folder
router.get('/png-files', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const files = fs.readdirSync(PNG_DIR)
      .filter(file => file.endsWith('.png'))
      .sort((a, b) => {
        // Sort by number if possible
        const numA = Number.parseInt(a.match(/\d+/)?.[0] || '0');
        const numB = Number.parseInt(b.match(/\d+/)?.[0] || '0');
        return numA - numB;
      });
    
    res.json(files);
  } catch (error) {
    console.error('List PNG files error:', error);
    res.status(500).json({ error: 'Erro ao listar arquivos PNG' });
  }
});

// Upload PNG file
router.post('/upload-png', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }
    
    res.json({ 
      message: 'Arquivo enviado com sucesso',
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Upload PNG error:', error);
    res.status(500).json({ error: 'Erro ao enviar arquivo' });
  }
});

// Delete PNG file (only if not in use)
router.delete('/png-files/:filename', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Check if file is in use by any territory
    const inUse = await pool.query(
      'SELECT id FROM territories WHERE map_filename = $1',
      [filename]
    );
    
    if (inUse.rows.length > 0) {
      return res.status(400).json({ 
        error: 'Este arquivo está em uso por um território e não pode ser excluído' 
      });
    }
    
    const filePath = path.join(PNG_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }
    
    fs.unlinkSync(filePath);
    res.json({ message: 'Arquivo excluído com sucesso' });
  } catch (error) {
    console.error('Delete PNG error:', error);
    res.status(500).json({ error: 'Erro ao excluir arquivo' });
  }
});

// Get available territories (not currently assigned)
router.get('/available', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*
      FROM territories t
      WHERE NOT EXISTS (
        SELECT 1 FROM assignments a 
        WHERE a.territory_id = t.id 
        AND a.status IN ('pending', 'in_progress', 'returned')
      )
      ORDER BY t.last_worked_date ASC NULLS FIRST, t.territory_number ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Get available territories error:', error);
    res.status(500).json({ error: 'Erro ao buscar territórios disponíveis' });
  }
});

// Get single territory
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM territories WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Território não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get territory error:', error);
    res.status(500).json({ error: 'Erro ao buscar território' });
  }
});

// Create territory (admin only) - with optional file upload
router.post('/', authenticateToken, requireAdmin, upload.single('map_file'), async (req, res) => {
  try {
    const { territory_number, locality, block_count, map_filename, observations } = req.body;

    if (!territory_number || !locality || !block_count) {
      return res.status(400).json({ error: 'Dados obrigatórios não fornecidos' });
    }

    const territory_code = `ter_${territory_number}`;
    
    // Use uploaded file, provided filename, or default
    let finalFilename = map_filename || `ter_${territory_number}.png`;
    if (req.file) {
      finalFilename = req.file.filename;
    }

    const result = await pool.query(`
      INSERT INTO territories (territory_number, territory_code, locality, block_count, map_filename, observations)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [territory_number, territory_code, locality, block_count, finalFilename, observations]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create territory error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Território já existe' });
    }
    res.status(500).json({ error: 'Erro ao criar território' });
  }
});

// Update territory (admin only) - with optional file upload
router.put('/:id', authenticateToken, requireAdmin, upload.single('map_file'), async (req, res) => {
  try {
    const { locality, block_count, map_filename, observations, last_worked_date } = req.body;
    
    // Use uploaded file or provided filename
    let finalFilename = map_filename;
    if (req.file) {
      finalFilename = req.file.filename;
    }

    const result = await pool.query(`
      UPDATE territories 
      SET locality = COALESCE($1, locality),
          block_count = COALESCE($2, block_count),
          map_filename = COALESCE($3, map_filename),
          observations = COALESCE($4, observations),
          last_worked_date = COALESCE($5, last_worked_date),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `, [locality, block_count, finalFilename, observations, last_worked_date, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Território não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update territory error:', error);
    res.status(500).json({ error: 'Erro ao atualizar território' });
  }
});

// Delete territory (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Check if territory has active assignments
    const activeAssignments = await pool.query(
      "SELECT id FROM assignments WHERE territory_id = $1 AND status IN ('pending', 'in_progress', 'returned')",
      [req.params.id]
    );
    
    if (activeAssignments.rows.length > 0) {
      return res.status(400).json({ 
        error: 'Não é possível excluir um território com designações ativas' 
      });
    }
    
    // Delete related records first
    await pool.query('DELETE FROM territory_history WHERE territory_id = $1', [req.params.id]);
    await pool.query('DELETE FROM assignments WHERE territory_id = $1', [req.params.id]);
    
    const result = await pool.query(
      'DELETE FROM territories WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Território não encontrado' });
    }

    res.json({ message: 'Território excluído com sucesso' });
  } catch (error) {
    console.error('Delete territory error:', error);
    res.status(500).json({ error: 'Erro ao excluir território' });
  }
});

// Get territory history
router.get('/:id/history', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT th.*, t.territory_code, t.locality
      FROM territory_history th
      JOIN territories t ON t.id = th.territory_id
      WHERE th.territory_id = $1
      ORDER BY th.worked_date DESC
    `, [req.params.id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get territory history error:', error);
    res.status(500).json({ error: 'Erro ao buscar histórico do território' });
  }
});

export default router;

