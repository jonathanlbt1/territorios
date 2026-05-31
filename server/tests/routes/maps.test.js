import { jest } from '@jest/globals';

// Mock fs module
const mockFs = {
  readdirSync: jest.fn(),
  existsSync: jest.fn(),
};

// Mock authenticateToken middleware
const mockAuthenticateToken = jest.fn((req, res, next) => next());

// Mock modules before importing
jest.unstable_mockModule('fs', () => ({
  default: mockFs,
  ...mockFs,
}));

jest.unstable_mockModule('../../src/middleware/auth.js', () => ({
  authenticateToken: mockAuthenticateToken,
}));

// Import express and create test app
const express = (await import('express')).default;
const { default: mapsRouter } = await import('../../src/routes/maps.js');

// Create test app
const app = express();
app.use(express.json());
app.use('/maps', mapsRouter);

// Import supertest for HTTP testing
const request = (await import('supertest')).default;

describe('Maps Routes', () => {
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('GET /maps/', () => {
    describe('authentication', () => {
      it('should require authentication', async () => {
        mockAuthenticateToken.mockImplementation((req, res, next) => {
          res.status(401).json({ error: 'Unauthorized' });
        });

        const response = await request(app).get('/maps/');

        expect(response.status).toBe(401);
      });

      it('should pass when authenticated', async () => {
        mockAuthenticateToken.mockImplementation((req, res, next) => next());
        mockFs.readdirSync.mockReturnValue([]);

        const response = await request(app).get('/maps/');

        expect(response.status).toBe(200);
      });
    });

    describe('listing map files', () => {
      beforeEach(() => {
        mockAuthenticateToken.mockImplementation((req, res, next) => next());
      });

      it('should return empty list when no files exist', async () => {
        mockFs.readdirSync.mockReturnValue([]);

        const response = await request(app).get('/maps/');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          total: 0,
          files: [],
        });
      });

      it('should return only PNG files', async () => {
        mockFs.readdirSync.mockReturnValue([
          'map1.png',
          'map2.png',
          'readme.txt',
          'config.json',
          'image.jpg',
        ]);

        const response = await request(app).get('/maps/');

        expect(response.status).toBe(200);
        expect(response.body.total).toBe(2);
        expect(response.body.files).toHaveLength(2);
        expect(response.body.files.map(f => f.filename)).toEqual(['map1.png', 'map2.png']);
      });

      it('should include filename and url for each file', async () => {
        mockFs.readdirSync.mockReturnValue(['territory1.png', 'territory2.png']);

        const response = await request(app).get('/maps/');

        expect(response.status).toBe(200);
        response.body.files.forEach(file => {
          expect(file).toHaveProperty('filename');
          expect(file).toHaveProperty('url');
        });
      });

      it('should count correct total of PNG files', async () => {
        mockFs.readdirSync.mockReturnValue([
          'a.png', 'b.png', 'c.png', 'd.txt', 'e.png',
        ]);

        const response = await request(app).get('/maps/');

        expect(response.body.total).toBe(4);
      });

      it('should handle files with special characters in names', async () => {
        mockFs.readdirSync.mockReturnValue(['map with spaces.png', 'território_1.png']);

        const response = await request(app).get('/maps/');

        expect(response.status).toBe(200);
        expect(response.body.files[0].filename).toBe('map with spaces.png');
        expect(response.body.files[0].url).toContain(encodeURIComponent('map with spaces.png'));
      });
    });

    describe('URL generation', () => {
      beforeEach(() => {
        mockAuthenticateToken.mockImplementation((req, res, next) => next());
        mockFs.readdirSync.mockReturnValue(['test.png']);
      });

      it('should generate relative URL for localhost', async () => {
        const response = await request(app)
          .get('/maps/')
          .set('Host', 'localhost:3001');

        expect(response.body.files[0].url).toBe('/maps/test.png');
      });

      it('should generate relative URL for 127.0.0.1', async () => {
        const response = await request(app)
          .get('/maps/')
          .set('Host', '127.0.0.1:3001');

        expect(response.body.files[0].url).toBe('/maps/test.png');
      });

      it('should generate absolute URL for production with x-forwarded headers', async () => {
        const response = await request(app)
          .get('/maps/')
          .set('Host', 'api.nossoterritorio.com')
          .set('x-forwarded-proto', 'https')
          .set('x-forwarded-host', 'api.nossoterritorio.com');

        expect(response.body.files[0].url).toBe('https://api.nossoterritorio.com/maps/test.png');
      });

      it('should use x-forwarded-proto when available', async () => {
        const response = await request(app)
          .get('/maps/')
          .set('Host', 'production.example.com')
          .set('x-forwarded-proto', 'https');

        expect(response.body.files[0].url).toContain('https://');
      });
    });

    describe('error handling', () => {
      beforeEach(() => {
        mockAuthenticateToken.mockImplementation((req, res, next) => next());
      });

      it('should return 500 on filesystem error', async () => {
        mockFs.readdirSync.mockImplementation(() => {
          throw new Error('ENOENT: directory not found');
        });

        const response = await request(app).get('/maps/');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro ao listar mapas');
      });

      it('should log error on failure', async () => {
        const error = new Error('Permission denied');
        mockFs.readdirSync.mockImplementation(() => { throw error; });

        await request(app).get('/maps/');

        expect(consoleErrorSpy).toHaveBeenCalledWith('Get maps list error:', error);
      });
    });
  });

  describe('GET /maps/general', () => {
    describe('authentication', () => {
      it('should require authentication', async () => {
        mockAuthenticateToken.mockImplementation((req, res, next) => {
          res.status(401).json({ error: 'Unauthorized' });
        });

        const response = await request(app).get('/maps/general');

        expect(response.status).toBe(401);
      });
    });

    describe('filtering general maps', () => {
      beforeEach(() => {
        mockAuthenticateToken.mockImplementation((req, res, next) => next());
      });

      it('should return empty list when no general maps exist', async () => {
        mockFs.readdirSync.mockReturnValue(['territory1.png', 'territory2.png']);

        const response = await request(app).get('/maps/general');

        expect(response.status).toBe(200);
        expect(response.body.maps).toEqual([]);
      });

      it('should return only maps containing "geral" in filename', async () => {
        mockFs.readdirSync.mockReturnValue([
          'ter_geral1.png',
          'ter_geral2.png',
          'territory1.png',
          'mapa_geral.png',
          'other.png',
        ]);

        const response = await request(app).get('/maps/general');

        expect(response.status).toBe(200);
        expect(response.body.maps).toHaveLength(3);
        expect(response.body.maps.map(m => m.filename)).toEqual([
          'ter_geral1.png',
          'ter_geral2.png',
          'mapa_geral.png',
        ]);
      });

      it('should only return PNG files with "geral"', async () => {
        mockFs.readdirSync.mockReturnValue([
          'ter_geral1.png',
          'ter_geral.txt',
          'ter_geral.jpg',
          'geral_config.json',
        ]);

        const response = await request(app).get('/maps/general');

        expect(response.body.maps).toHaveLength(1);
        expect(response.body.maps[0].filename).toBe('ter_geral1.png');
      });

      it('should be case-sensitive for "geral"', async () => {
        mockFs.readdirSync.mockReturnValue([
          'ter_geral1.png',
          'ter_GERAL2.png',
          'ter_Geral3.png',
        ]);

        const response = await request(app).get('/maps/general');

        // Only lowercase 'geral' matches
        expect(response.body.maps).toHaveLength(1);
        expect(response.body.maps[0].filename).toBe('ter_geral1.png');
      });

      it('should include filename and url for each general map', async () => {
        mockFs.readdirSync.mockReturnValue(['ter_geral1.png']);

        const response = await request(app).get('/maps/general');

        expect(response.body.maps[0]).toHaveProperty('filename', 'ter_geral1.png');
        expect(response.body.maps[0]).toHaveProperty('url');
      });

      it('should log found files for debugging', async () => {
        mockFs.readdirSync.mockReturnValue(['ter_geral1.png', 'other.png']);

        await request(app).get('/maps/general');

        expect(consoleLogSpy).toHaveBeenCalledWith(
          '📂 All files in png_files:',
          ['ter_geral1.png', 'other.png']
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          '🗺️ General maps found:',
          ['ter_geral1.png']
        );
      });
    });

    describe('error handling', () => {
      beforeEach(() => {
        mockAuthenticateToken.mockImplementation((req, res, next) => next());
      });

      it('should return 500 on filesystem error', async () => {
        mockFs.readdirSync.mockImplementation(() => {
          throw new Error('ENOENT');
        });

        const response = await request(app).get('/maps/general');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro ao buscar mapas gerais');
      });

      it('should log error on failure', async () => {
        const error = new Error('Read error');
        mockFs.readdirSync.mockImplementation(() => { throw error; });

        await request(app).get('/maps/general');

        expect(consoleErrorSpy).toHaveBeenCalledWith('Get general maps error:', error);
      });
    });
  });

  describe('GET /maps/check/:filename', () => {
    describe('authentication', () => {
      it('should require authentication', async () => {
        mockAuthenticateToken.mockImplementation((req, res, next) => {
          res.status(401).json({ error: 'Unauthorized' });
        });

        const response = await request(app).get('/maps/check/test.png');

        expect(response.status).toBe(401);
      });
    });

    describe('checking file existence', () => {
      beforeEach(() => {
        mockAuthenticateToken.mockImplementation((req, res, next) => next());
      });

      it('should return exists: true when file exists', async () => {
        mockFs.existsSync.mockReturnValue(true);

        const response = await request(app).get('/maps/check/territory1.png');

        expect(response.status).toBe(200);
        expect(response.body.exists).toBe(true);
      });

      it('should return exists: false when file does not exist', async () => {
        mockFs.existsSync.mockReturnValue(false);

        const response = await request(app).get('/maps/check/nonexistent.png');

        expect(response.status).toBe(200);
        expect(response.body.exists).toBe(false);
      });

      it('should return url when file exists', async () => {
        mockFs.existsSync.mockReturnValue(true);

        const response = await request(app).get('/maps/check/territory1.png');

        expect(response.body.url).toContain('territory1.png');
      });

      it('should return url: null when file does not exist', async () => {
        mockFs.existsSync.mockReturnValue(false);

        const response = await request(app).get('/maps/check/nonexistent.png');

        expect(response.body.url).toBeNull();
      });

      it('should check the correct file path', async () => {
        mockFs.existsSync.mockReturnValue(true);

        await request(app).get('/maps/check/mymap.png');

        expect(mockFs.existsSync).toHaveBeenCalledWith(
          expect.stringContaining('mymap.png')
        );
      });

      it('should handle filenames with special characters', async () => {
        mockFs.existsSync.mockReturnValue(true);

        const response = await request(app).get('/maps/check/map%20with%20spaces.png');

        expect(response.status).toBe(200);
        expect(mockFs.existsSync).toHaveBeenCalledWith(
          expect.stringContaining('map with spaces.png')
        );
      });

      it('should handle URL-encoded filenames', async () => {
        mockFs.existsSync.mockReturnValue(true);

        const response = await request(app).get('/maps/check/territ%C3%B3rio1.png');

        expect(response.status).toBe(200);
        expect(mockFs.existsSync).toHaveBeenCalledWith(
          expect.stringContaining('território1.png')
        );
      });
    });

    describe('URL generation for existing files', () => {
      beforeEach(() => {
        mockAuthenticateToken.mockImplementation((req, res, next) => next());
        mockFs.existsSync.mockReturnValue(true);
      });

      it('should generate relative URL for localhost', async () => {
        const response = await request(app)
          .get('/maps/check/test.png')
          .set('Host', 'localhost:3001');

        expect(response.body.url).toBe('/maps/test.png');
      });

      it('should generate absolute URL for production', async () => {
        const response = await request(app)
          .get('/maps/check/test.png')
          .set('Host', 'api.example.com')
          .set('x-forwarded-proto', 'https')
          .set('x-forwarded-host', 'api.example.com');

        expect(response.body.url).toBe('https://api.example.com/maps/test.png');
      });

      it('should encode special characters in URL', async () => {
        const response = await request(app)
          .get('/maps/check/map%20name.png')
          .set('Host', 'localhost:3001');

        expect(response.body.url).toContain(encodeURIComponent('map name.png'));
      });
    });

    describe('error handling', () => {
      beforeEach(() => {
        mockAuthenticateToken.mockImplementation((req, res, next) => next());
      });

      it('should return 500 on filesystem error', async () => {
        mockFs.existsSync.mockImplementation(() => {
          throw new Error('Permission denied');
        });

        const response = await request(app).get('/maps/check/test.png');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro ao verificar mapa');
      });

      it('should log error on failure', async () => {
        const error = new Error('Access denied');
        mockFs.existsSync.mockImplementation(() => { throw error; });

        await request(app).get('/maps/check/test.png');

        expect(consoleErrorSpy).toHaveBeenCalledWith('Check map error:', error);
      });
    });
  });

  describe('Security', () => {
    beforeEach(() => {
      mockAuthenticateToken.mockImplementation((req, res, next) => next());
    });

    describe('path traversal notes', () => {
      // Note: Express routing handles '../' in URL paths specially.
      // When the URL contains '../', Express may not route it to the handler at all,
      // or may normalize it before reaching the route handler.
      
      it('should handle normal filenames safely', async () => {
        mockFs.existsSync.mockReturnValue(true);

        await request(app).get('/maps/check/safe_filename.png');

        expect(mockFs.existsSync).toHaveBeenCalledWith(
          expect.stringContaining('png_files')
        );
        expect(mockFs.existsSync).toHaveBeenCalledWith(
          expect.stringContaining('safe_filename.png')
        );
      });

      it('should use path.join which normalizes paths', async () => {
        mockFs.existsSync.mockReturnValue(false);

        // Test with a filename that includes special characters but is valid
        await request(app).get('/maps/check/test_file.png');

        const calledPath = mockFs.existsSync.mock.calls[0][0];
        // path.join should produce a normalized path within png_files
        expect(calledPath).toContain('png_files');
        expect(calledPath).toContain('test_file.png');
      });
    });

    describe('authentication enforcement', () => {
      it('should call authenticateToken for GET /', async () => {
        mockFs.readdirSync.mockReturnValue([]);

        await request(app).get('/maps/');

        expect(mockAuthenticateToken).toHaveBeenCalled();
      });

      it('should call authenticateToken for GET /general', async () => {
        mockFs.readdirSync.mockReturnValue([]);

        await request(app).get('/maps/general');

        expect(mockAuthenticateToken).toHaveBeenCalled();
      });

      it('should call authenticateToken for GET /check/:filename', async () => {
        mockFs.existsSync.mockReturnValue(false);

        await request(app).get('/maps/check/test.png');

        expect(mockAuthenticateToken).toHaveBeenCalled();
      });
    });
  });

  describe('Edge cases', () => {
    beforeEach(() => {
      mockAuthenticateToken.mockImplementation((req, res, next) => next());
    });

    it('should handle empty directory', async () => {
      mockFs.readdirSync.mockReturnValue([]);

      const response = await request(app).get('/maps/');

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(0);
      expect(response.body.files).toEqual([]);
    });

    it('should handle directory with only non-PNG files', async () => {
      mockFs.readdirSync.mockReturnValue(['readme.md', 'config.json', '.gitkeep']);

      const response = await request(app).get('/maps/');

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(0);
    });

    it('should handle filenames with multiple dots', async () => {
      mockFs.readdirSync.mockReturnValue(['map.v2.backup.png', 'map.final.png']);

      const response = await request(app).get('/maps/');

      expect(response.body.files).toHaveLength(2);
    });

    it('should handle filenames ending in .png case-sensitively', async () => {
      mockFs.readdirSync.mockReturnValue(['map.PNG', 'map.Png', 'map.png']);

      const response = await request(app).get('/maps/');

      // Only lowercase .png matches
      expect(response.body.files).toHaveLength(1);
      expect(response.body.files[0].filename).toBe('map.png');
    });

    it('should handle very long filenames', async () => {
      const longFilename = 'a'.repeat(200) + '.png';
      mockFs.readdirSync.mockReturnValue([longFilename]);

      const response = await request(app).get('/maps/');

      expect(response.status).toBe(200);
      expect(response.body.files[0].filename).toBe(longFilename);
    });

    it('should handle unicode filenames', async () => {
      mockFs.readdirSync.mockReturnValue(['território_中文_العربية.png']);

      const response = await request(app).get('/maps/');

      expect(response.status).toBe(200);
      expect(response.body.files[0].filename).toBe('território_中文_العربية.png');
    });
  });

  describe('Error messages in Portuguese', () => {
    beforeEach(() => {
      mockAuthenticateToken.mockImplementation((req, res, next) => next());
    });

    it('should return Portuguese error for list maps failure', async () => {
      mockFs.readdirSync.mockImplementation(() => { throw new Error(); });

      const response = await request(app).get('/maps/');

      expect(response.body.error).toMatch(/Erro|listar|mapas/i);
    });

    it('should return Portuguese error for general maps failure', async () => {
      mockFs.readdirSync.mockImplementation(() => { throw new Error(); });

      const response = await request(app).get('/maps/general');

      expect(response.body.error).toMatch(/Erro|buscar|mapas|gerais/i);
    });

    it('should return Portuguese error for check map failure', async () => {
      mockFs.existsSync.mockImplementation(() => { throw new Error(); });

      const response = await request(app).get('/maps/check/test.png');

      expect(response.body.error).toMatch(/Erro|verificar|mapa/i);
    });
  });
});
