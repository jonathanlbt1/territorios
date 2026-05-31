import { jest } from '@jest/globals';

// Mock pg module before importing config
const mockPool = {
  on: jest.fn(),
  query: jest.fn(),
  connect: jest.fn(),
  end: jest.fn(),
};

jest.unstable_mockModule('pg', () => ({
  default: {
    Pool: jest.fn(() => mockPool),
  },
}));

// Import after mocking - path relative to tests/db/
const { shouldUseSsl, buildConfig, createPool } = await import('../../src/db/config.js');

describe('Database Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('shouldUseSsl', () => {
    it('should return false when no SSL env vars are set', () => {
      const env = {};
      expect(shouldUseSsl(env)).toBe(false);
    });

    it('should return true when DB_SSL is "true"', () => {
      const env = { DB_SSL: 'true' };
      expect(shouldUseSsl(env)).toBe(true);
    });

    it('should return false when DB_SSL is "false"', () => {
      const env = { DB_SSL: 'false' };
      expect(shouldUseSsl(env)).toBe(false);
    });

    it('should return true when PGSSLMODE is "require"', () => {
      const env = { PGSSLMODE: 'require' };
      expect(shouldUseSsl(env)).toBe(true);
    });

    it('should return false when PGSSLMODE is not "require"', () => {
      const env = { PGSSLMODE: 'prefer' };
      expect(shouldUseSsl(env)).toBe(false);
    });

    it('should return true when SSLMODE is "require"', () => {
      const env = { SSLMODE: 'require' };
      expect(shouldUseSsl(env)).toBe(true);
    });

    it('should return true when any SSL env var is set correctly', () => {
      const env = { DB_SSL: 'false', PGSSLMODE: 'require' };
      expect(shouldUseSsl(env)).toBe(true);
    });
  });

  describe('buildConfig', () => {
    describe('with DATABASE_URL', () => {
      it('should use connectionString when DATABASE_URL is provided', () => {
        const env = { DATABASE_URL: 'postgresql://user:pass@host:5432/db' };
        const config = buildConfig(env);

        expect(config).toEqual({
          connectionString: 'postgresql://user:pass@host:5432/db',
          ssl: undefined,
        });
      });

      it('should include SSL config when DATABASE_URL and SSL env var are set', () => {
        const env = {
          DATABASE_URL: 'postgresql://user:pass@host:5432/db',
          DB_SSL: 'true',
        };
        const config = buildConfig(env);

        expect(config).toEqual({
          connectionString: 'postgresql://user:pass@host:5432/db',
          ssl: { rejectUnauthorized: false },
        });
      });
    });

    describe('with discrete environment variables', () => {
      it('should use default values when no env vars are set', () => {
        const env = {};
        const config = buildConfig(env);

        expect(config).toEqual({
          host: 'localhost',
          port: 5432,
          database: 'territorios_db',
          user: 'postgres',
          password: 'postgres',
          ssl: undefined,
        });
      });

      it('should use custom host when DB_HOST is set', () => {
        const env = { DB_HOST: 'custom-host.example.com' };
        const config = buildConfig(env);

        expect(config.host).toBe('custom-host.example.com');
      });

      it('should use custom port when DB_PORT is set', () => {
        const env = { DB_PORT: '5433' };
        const config = buildConfig(env);

        expect(config.port).toBe(5433);
      });

      it('should use custom database when DB_NAME is set', () => {
        const env = { DB_NAME: 'my_custom_db' };
        const config = buildConfig(env);

        expect(config.database).toBe('my_custom_db');
      });

      it('should use custom user when DB_USER is set', () => {
        const env = { DB_USER: 'custom_user' };
        const config = buildConfig(env);

        expect(config.user).toBe('custom_user');
      });

      it('should use custom password when DB_PASSWORD is set', () => {
        const env = { DB_PASSWORD: 'secret_password' };
        const config = buildConfig(env);

        expect(config.password).toBe('secret_password');
      });

      it('should include SSL config when SSL env var is set', () => {
        const env = { DB_SSL: 'true' };
        const config = buildConfig(env);

        expect(config.ssl).toEqual({ rejectUnauthorized: false });
      });

      it('should build complete custom config', () => {
        const env = {
          DB_HOST: 'db.example.com',
          DB_PORT: '5433',
          DB_NAME: 'production_db',
          DB_USER: 'app_user',
          DB_PASSWORD: 'secure_pass',
          DB_SSL: 'true',
        };
        const config = buildConfig(env);

        expect(config).toEqual({
          host: 'db.example.com',
          port: 5433,
          database: 'production_db',
          user: 'app_user',
          password: 'secure_pass',
          ssl: { rejectUnauthorized: false },
        });
      });
    });

    describe('DATABASE_URL takes precedence', () => {
      it('should ignore discrete vars when DATABASE_URL is provided', () => {
        const env = {
          DATABASE_URL: 'postgresql://url-user:url-pass@url-host:5432/url-db',
          DB_HOST: 'discrete-host',
          DB_USER: 'discrete-user',
          DB_PASSWORD: 'discrete-pass',
          DB_NAME: 'discrete-db',
        };
        const config = buildConfig(env);

        expect(config).toEqual({
          connectionString: 'postgresql://url-user:url-pass@url-host:5432/url-db',
          ssl: undefined,
        });
        expect(config.host).toBeUndefined();
        expect(config.user).toBeUndefined();
      });
    });
  });

  describe('createPool', () => {
    it('should create a pool with the given configuration', async () => {
      const pg = await import('pg');
      const config = { host: 'test-host', port: 5432 };

      createPool(config);

      expect(pg.default.Pool).toHaveBeenCalledWith(config);
    });

    it('should register connect event handler', () => {
      createPool({ host: 'test' });

      expect(mockPool.on).toHaveBeenCalledWith('connect', expect.any(Function));
    });

    it('should register error event handler', () => {
      createPool({ host: 'test' });

      expect(mockPool.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should log message on connect event', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      createPool({ host: 'test' });

      // Get the connect callback and call it
      const connectCall = mockPool.on.mock.calls.find(
        (call) => call[0] === 'connect'
      );
      const connectCallback = connectCall[1];
      connectCallback();

      expect(consoleSpy).toHaveBeenCalledWith(
        '📦 Connected to PostgreSQL database'
      );

      consoleSpy.mockRestore();
    });

    it('should log error message on error event', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      createPool({ host: 'test' });

      // Get the error callback and call it
      const errorCall = mockPool.on.mock.calls.find(
        (call) => call[0] === 'error'
      );
      const errorCallback = errorCall[1];
      const testError = new Error('Connection failed');
      errorCallback(testError);

      expect(consoleSpy).toHaveBeenCalledWith(
        '⚠️  Database connection error:',
        'Connection failed'
      );

      consoleSpy.mockRestore();
    });

    it('should return the pool instance', () => {
      const pool = createPool({ host: 'test' });

      expect(pool).toBe(mockPool);
    });
  });

  describe('Port conversion', () => {
    it('should convert string port to number', () => {
      const env = { DB_PORT: '5433' };
      const config = buildConfig(env);

      expect(config.port).toBe(5433);
      expect(typeof config.port).toBe('number');
    });

    it('should use default port when DB_PORT is invalid', () => {
      const env = { DB_PORT: 'invalid' };
      const config = buildConfig(env);

      // Number('invalid') returns NaN, which is falsy, so default 5432 is used
      expect(config.port).toBe(5432);
    });

    it('should use default port when DB_PORT is empty string', () => {
      const env = { DB_PORT: '' };
      const config = buildConfig(env);

      // Empty string converts to 0 with Number(), which is falsy, so default is used
      expect(config.port).toBe(5432);
    });
  });
});
