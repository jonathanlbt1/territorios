import { jest } from '@jest/globals';

// Mock client with query tracking
const mockClient = {
  query: jest.fn().mockResolvedValue({ rows: [] }),
  release: jest.fn(),
};

// Mock pool
const mockPool = {
  connect: jest.fn().mockResolvedValue(mockClient),
  end: jest.fn().mockResolvedValue(),
};

// Mock the config module before importing migrate
jest.unstable_mockModule('../../src/db/config.js', () => ({
  default: mockPool,
}));

// Import after mocking
const { default: migrate } = await import('../../src/db/migrate.js');

describe('Database Migration', () => {
  let consoleSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('migrate function', () => {
    it('should connect to the database pool', async () => {
      await migrate();

      expect(mockPool.connect).toHaveBeenCalledTimes(1);
    });

    it('should release the client after migration', async () => {
      await migrate();

      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('should release the client even if migration fails', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(migrate()).rejects.toThrow('Database error');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('should log start message', async () => {
      await migrate();

      expect(consoleSpy).toHaveBeenCalledWith('🔄 Starting database migration...');
    });

    it('should log completion message on success', async () => {
      await migrate();

      expect(consoleSpy).toHaveBeenCalledWith('🎉 Migration completed successfully!');
    });

    it('should log error on failure', async () => {
      const error = new Error('Migration failed');
      mockClient.query.mockRejectedValueOnce(error);

      await expect(migrate()).rejects.toThrow('Migration failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Migration error:', error);
    });
  });

  describe('table creation', () => {
    it('should create users table', async () => {
      await migrate();

      const usersTableQuery = mockClient.query.mock.calls.find(
        (call) => call[0].includes('CREATE TABLE IF NOT EXISTS users')
      );
      expect(usersTableQuery).toBeDefined();
      expect(usersTableQuery[0]).toContain('id SERIAL PRIMARY KEY');
      expect(usersTableQuery[0]).toContain('name VARCHAR(255) NOT NULL');
      expect(usersTableQuery[0]).toContain('username VARCHAR(100) UNIQUE NOT NULL');
      expect(usersTableQuery[0]).toContain('password VARCHAR(255) NOT NULL');
      expect(usersTableQuery[0]).toContain("role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'dirigente', 'publisher'))");
    });

    it('should create territories table', async () => {
      await migrate();

      const territoriesQuery = mockClient.query.mock.calls.find(
        (call) => call[0].includes('CREATE TABLE IF NOT EXISTS territories')
      );
      expect(territoriesQuery).toBeDefined();
      expect(territoriesQuery[0]).toContain('territory_number INTEGER UNIQUE NOT NULL');
      expect(territoriesQuery[0]).toContain('territory_code VARCHAR(20) UNIQUE NOT NULL');
      expect(territoriesQuery[0]).toContain('locality VARCHAR(255) NOT NULL');
      expect(territoriesQuery[0]).toContain('block_count INTEGER NOT NULL');
      expect(territoriesQuery[0]).toContain('map_filename VARCHAR(255) NOT NULL');
    });

    it('should create assignments table with foreign keys', async () => {
      await migrate();

      const assignmentsQuery = mockClient.query.mock.calls.find(
        (call) => call[0].includes('CREATE TABLE IF NOT EXISTS assignments')
      );
      expect(assignmentsQuery).toBeDefined();
      expect(assignmentsQuery[0]).toContain('territory_id INTEGER REFERENCES territories(id)');
      expect(assignmentsQuery[0]).toContain('dirigente_id INTEGER REFERENCES users(id)');
      expect(assignmentsQuery[0]).toContain('assigned_by INTEGER REFERENCES users(id)');
      expect(assignmentsQuery[0]).toContain("status VARCHAR(50) DEFAULT 'pending'");
      expect(assignmentsQuery[0]).toContain("CHECK (status IN ('pending', 'in_progress', 'returned', 'completed', 'cancelled'))");
    });

    it('should create notifications table', async () => {
      await migrate();

      const notificationsQuery = mockClient.query.mock.calls.find(
        (call) => call[0].includes('CREATE TABLE IF NOT EXISTS notifications')
      );
      expect(notificationsQuery).toBeDefined();
      expect(notificationsQuery[0]).toContain('user_id INTEGER REFERENCES users(id)');
      expect(notificationsQuery[0]).toContain('type VARCHAR(50) NOT NULL');
      expect(notificationsQuery[0]).toContain('title VARCHAR(255) NOT NULL');
      expect(notificationsQuery[0]).toContain('assignment_id INTEGER REFERENCES assignments(id)');
      expect(notificationsQuery[0]).toContain('is_read BOOLEAN DEFAULT FALSE');
    });

    it('should create territory_history table', async () => {
      await migrate();

      const historyQuery = mockClient.query.mock.calls.find(
        (call) => call[0].includes('CREATE TABLE IF NOT EXISTS territory_history')
      );
      expect(historyQuery).toBeDefined();
      expect(historyQuery[0]).toContain('territory_id INTEGER REFERENCES territories(id)');
      expect(historyQuery[0]).toContain('assignment_id INTEGER REFERENCES assignments(id)');
      expect(historyQuery[0]).toContain('dirigente_id INTEGER REFERENCES users(id)');
      expect(historyQuery[0]).toContain('worked_date DATE NOT NULL');
      expect(historyQuery[0]).toContain("result VARCHAR(50) NOT NULL CHECK (result IN ('complete', 'partial', 'not_done'))");
    });

    it('should create push_subscriptions table', async () => {
      await migrate();

      const pushQuery = mockClient.query.mock.calls.find(
        (call) => call[0].includes('CREATE TABLE IF NOT EXISTS push_subscriptions')
      );
      expect(pushQuery).toBeDefined();
      expect(pushQuery[0]).toContain('user_id INTEGER REFERENCES users(id)');
      expect(pushQuery[0]).toContain('endpoint TEXT NOT NULL');
      expect(pushQuery[0]).toContain('p256dh TEXT NOT NULL');
      expect(pushQuery[0]).toContain('auth TEXT NOT NULL');
      expect(pushQuery[0]).toContain('UNIQUE(user_id, endpoint)');
    });

    it('should log success message for each table', async () => {
      await migrate();

      expect(consoleSpy).toHaveBeenCalledWith('✅ Users table created');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Territories table created');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Assignments table created');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Notifications table created');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Territory history table created');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Push subscriptions table created');
    });
  });

  describe('index creation', () => {
    it('should create all performance indexes', async () => {
      await migrate();

      const indexQuery = mockClient.query.mock.calls.find(
        (call) => call[0].includes('CREATE INDEX IF NOT EXISTS idx_assignments_status')
      );
      expect(indexQuery).toBeDefined();
      expect(indexQuery[0]).toContain('idx_assignments_status ON assignments(status)');
      expect(indexQuery[0]).toContain('idx_assignments_dirigente ON assignments(dirigente_id)');
      expect(indexQuery[0]).toContain('idx_assignments_due_date ON assignments(due_date)');
      expect(indexQuery[0]).toContain('idx_notifications_user ON notifications(user_id)');
      expect(indexQuery[0]).toContain('idx_notifications_read ON notifications(is_read)');
      expect(indexQuery[0]).toContain('idx_territory_history_territory ON territory_history(territory_id)');
      expect(indexQuery[0]).toContain('idx_territory_history_date ON territory_history(worked_date)');
      expect(indexQuery[0]).toContain('idx_push_subscriptions_user ON push_subscriptions(user_id)');
    });

    it('should log success message for indexes', async () => {
      await migrate();

      expect(consoleSpy).toHaveBeenCalledWith('✅ Indexes created');
    });
  });

  describe('column additions', () => {
    it('should add not_worked column to assignments if not exists', async () => {
      await migrate();

      const notWorkedQuery = mockClient.query.mock.calls.find(
        (call) => call[0].includes("column_name = 'not_worked'")
      );
      expect(notWorkedQuery).toBeDefined();
      expect(notWorkedQuery[0]).toContain('ALTER TABLE assignments ADD COLUMN not_worked BOOLEAN DEFAULT FALSE');
    });

    it('should add conclusion_date column to territory_history if not exists', async () => {
      await migrate();

      const conclusionDateQuery = mockClient.query.mock.calls.find(
        (call) => call[0].includes("column_name = 'conclusion_date'")
      );
      expect(conclusionDateQuery).toBeDefined();
      expect(conclusionDateQuery[0]).toContain('ALTER TABLE territory_history ADD COLUMN conclusion_date DATE');
    });

    it('should add street_ids column to publisher_assignments if not exists', async () => {
      await migrate();

      const streetIdsQuery = mockClient.query.mock.calls.find(
        (call) => call[0].includes("column_name = 'street_ids'")
      );
      expect(streetIdsQuery).toBeDefined();
      expect(streetIdsQuery[0]).toContain('ALTER TABLE publisher_assignments ADD COLUMN street_ids INTEGER[]');
    });

    it('should add dont_visit column to houses if not exists', async () => {
      await migrate();

      const dontVisitQuery = mockClient.query.mock.calls.find(
        (call) => call[0].includes("column_name = 'dont_visit'")
      );
      expect(dontVisitQuery).toBeDefined();
      expect(dontVisitQuery[0]).toContain('ALTER TABLE houses ADD COLUMN dont_visit BOOLEAN DEFAULT FALSE');
    });

    it('should add observations column to streets if not exists', async () => {
      await migrate();

      const observationsQuery = mockClient.query.mock.calls.find(
        (call) => call[0].includes("column_name = 'observations'")
      );
      expect(observationsQuery).toBeDefined();
      expect(observationsQuery[0]).toContain('ALTER TABLE streets ADD COLUMN observations TEXT');
    });

    it('should log success message for column additions', async () => {
      await migrate();

      expect(consoleSpy).toHaveBeenCalledWith('✅ Assignments not_worked column checked/created');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Territory history conclusion_date column checked/created');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Publisher assignments street_ids column checked/created');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Houses dont_visit column checked/created');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Streets observations column checked/created');
    });
  });

  describe('query execution order', () => {
    it('should execute all queries in correct order', async () => {
      await migrate();

      // Total expected queries: 6 tables + 4 new tables/constraint updates + 1 indexes + 1 admin lookup + 1 admin seed + 5 column additions + others
      expect(mockClient.query).toHaveBeenCalledTimes(19);

      const calls = mockClient.query.mock.calls;
      const adminLookupIndex = calls.findIndex((call) =>
        call[0].includes("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
      );
      const adminInsertIndex = calls.findIndex((call) =>
        call[0].includes('INSERT INTO users (name, username, password, role)')
      );
      const notWorkedIndex = calls.findIndex((call) =>
        call[0].includes("column_name = 'not_worked'")
      );

      expect(adminLookupIndex).toBeGreaterThan(-1);
      expect(adminInsertIndex).toBeGreaterThan(-1);
      expect(adminLookupIndex).toBeLessThan(adminInsertIndex);
      expect(adminInsertIndex).toBeLessThan(notWorkedIndex);
    });

    it('should create tables before indexes', async () => {
      await migrate();

      const calls = mockClient.query.mock.calls;
      const usersIndex = calls.findIndex((call) =>
        call[0].includes('CREATE TABLE IF NOT EXISTS users')
      );
      const indexesIndex = calls.findIndex((call) =>
        call[0].includes('CREATE INDEX IF NOT EXISTS idx_assignments_status')
      );

      expect(usersIndex).toBeLessThan(indexesIndex);
    });
  });

  describe('error handling', () => {
    it('should throw error when table creation fails', async () => {
      const error = new Error('Table creation failed');
      mockClient.query.mockRejectedValueOnce(error);

      await expect(migrate()).rejects.toThrow('Table creation failed');
    });

    it('should throw error when index creation fails', async () => {
      // First 6 queries succeed (table creations)
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // users
        .mockResolvedValueOnce({ rows: [] }) // territories
        .mockResolvedValueOnce({ rows: [] }) // assignments
        .mockResolvedValueOnce({ rows: [] }) // notifications
        .mockResolvedValueOnce({ rows: [] }) // territory_history
        .mockResolvedValueOnce({ rows: [] }) // push_subscriptions
        .mockRejectedValueOnce(new Error('Index creation failed')); // indexes

      await expect(migrate()).rejects.toThrow('Index creation failed');
    });

    it('should not call subsequent queries after failure', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('First query failed'));

      await expect(migrate()).rejects.toThrow('First query failed');

      // Only the first query should have been called
      expect(mockClient.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('table constraints', () => {
    it('should have proper constraints on users table', async () => {
      await migrate();

      const usersQuery = mockClient.query.mock.calls.find(
        (call) => call[0].includes('CREATE TABLE IF NOT EXISTS users')
      );
      // Check role constraint
      expect(usersQuery[0]).toContain("CHECK (role IN ('admin', 'dirigente', 'publisher'))");
    });

    it('should have proper constraints on territories table', async () => {
      await migrate();

      const territoriesQuery = mockClient.query.mock.calls.find(
        (call) => call[0].includes('CREATE TABLE IF NOT EXISTS territories')
      );
      // Check territory_number constraint
      expect(territoriesQuery[0]).toContain('CHECK (territory_number >= 1 AND territory_number <= 100)');
      // Check block_count constraint
      expect(territoriesQuery[0]).toContain('CHECK (block_count >= 1 AND block_count <= 10)');
    });

    it('should have proper constraints on assignments table', async () => {
      await migrate();

      const assignmentsQuery = mockClient.query.mock.calls.find(
        (call) => call[0].includes('CREATE TABLE IF NOT EXISTS assignments')
      );
      // Check status constraint
      expect(assignmentsQuery[0]).toContain("CHECK (status IN ('pending', 'in_progress', 'returned', 'completed', 'cancelled'))");
      // Check validation_result constraint
      expect(assignmentsQuery[0]).toContain("CHECK (validation_result IN ('complete', 'partial', 'not_done'))");
    });

    it('should have ON DELETE CASCADE for dependent tables', async () => {
      await migrate();

      const assignmentsQuery = mockClient.query.mock.calls.find(
        (call) => call[0].includes('CREATE TABLE IF NOT EXISTS assignments')
      );
      expect(assignmentsQuery[0]).toContain('ON DELETE CASCADE');

      const notificationsQuery = mockClient.query.mock.calls.find(
        (call) => call[0].includes('CREATE TABLE IF NOT EXISTS notifications')
      );
      expect(notificationsQuery[0]).toContain('ON DELETE CASCADE');
    });
  });

  describe('default values', () => {
    it('should have default timestamps on all tables', async () => {
      await migrate();

      const usersQuery = mockClient.query.mock.calls.find(
        (call) => call[0].includes('CREATE TABLE IF NOT EXISTS users')
      );
      expect(usersQuery[0]).toContain('created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
      expect(usersQuery[0]).toContain('updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    });

    it('should have default status on assignments', async () => {
      await migrate();

      const assignmentsQuery = mockClient.query.mock.calls.find(
        (call) => call[0].includes('CREATE TABLE IF NOT EXISTS assignments')
      );
      expect(assignmentsQuery[0]).toContain("status VARCHAR(50) DEFAULT 'pending'");
      expect(assignmentsQuery[0]).toContain("blocks_worked INTEGER[] DEFAULT '{}'");
    });

    it('should have default is_read on notifications', async () => {
      await migrate();

      const notificationsQuery = mockClient.query.mock.calls.find(
        (call) => call[0].includes('CREATE TABLE IF NOT EXISTS notifications')
      );
      expect(notificationsQuery[0]).toContain('is_read BOOLEAN DEFAULT FALSE');
    });
  });
});
