import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pngDir = path.join(__dirname, '../../png_files');

// Helper to generate map URL (absolute in production, relative in dev)
const getMapUrl = (filename, req) => {
  // Always return absolute URL for better compatibility
  // Use x-forwarded-* headers (set by Render reverse proxy)
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
  const host = req.get('x-forwarded-host') || req.get('host');
  
  // In local development without proper headers, fall back to relative URL
  if (!host || host.includes('localhost') || host.includes('127.0.0.1')) {
    return `/maps/${encodeURIComponent(filename)}`;
  }
  
  // Return absolute URL for production
  return `${protocol}://${host}/maps/${encodeURIComponent(filename)}`;
};

// Get list of all map files
router.get('/', authenticateToken, async (req, res) => {
  try {
    const files = fs.readdirSync(pngDir);
    const mapFiles = files.filter(f => f.endsWith('.png'));
    
    res.json({
      total: mapFiles.length,
      files: mapFiles.map(file => ({
        filename: file,
        url: getMapUrl(file, req)
      }))
    });
  } catch (error) {
    console.error('Get maps list error:', error);
    res.status(500).json({ error: 'Erro ao listar mapas' });
  }
});

// Get general maps
router.get('/general', authenticateToken, async (req, res) => {
  try {
    const files = fs.readdirSync(pngDir);
    console.log('📂 All files in png_files:', files);
    const generalMaps = files.filter(f => f.includes('geral') && f.endsWith('.png'));
    console.log('🗺️ General maps found:', generalMaps);
    
    res.json({
      maps: generalMaps.map(file => ({
        filename: file,
        url: getMapUrl(file, req)
      }))
    });
  } catch (error) {
    console.error('Get general maps error:', error);
    res.status(500).json({ error: 'Erro ao buscar mapas gerais' });
  }
});

// Check if a map file exists
router.get('/check/:filename', authenticateToken, async (req, res) => {
  try {
    const filePath = path.join(pngDir, req.params.filename);
    const exists = fs.existsSync(filePath);
    
    res.json({ 
      exists,
      url: exists ? getMapUrl(req.params.filename, req) : null
    });
  } catch (error) {
    console.error('Check map error:', error);
    res.status(500).json({ error: 'Erro ao verificar mapa' });
  }
});

export default router;

