import bcrypt from 'bcryptjs';
import pool from './config.js';

const migrate = async () => {
  const client = await pool.connect();
  const adminName = process.env.DEFAULT_ADMIN_NAME || 'Administrador';
  const adminUsername = (process.env.DEFAULT_ADMIN_USERNAME || 'admin').toLowerCase();
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
  
  try {
    console.log('🔄 Starting database migration...');

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'dirigente')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Users table created');

    // Create territories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS territories (
        id SERIAL PRIMARY KEY,
        territory_number INTEGER UNIQUE NOT NULL CHECK (territory_number >= 1 AND territory_number <= 100),
        territory_code VARCHAR(20) UNIQUE NOT NULL,
        locality VARCHAR(255) NOT NULL,
        block_count INTEGER NOT NULL CHECK (block_count >= 1 AND block_count <= 10),
        map_filename VARCHAR(255) NOT NULL,
        observations TEXT,
        last_worked_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Territories table created');

    // Create assignments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS assignments (
        id SERIAL PRIMARY KEY,
        territory_id INTEGER REFERENCES territories(id) ON DELETE CASCADE,
        dirigente_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        due_date DATE NOT NULL,
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'returned', 'completed', 'cancelled')),
        blocks_worked INTEGER[] DEFAULT '{}',
        return_observations TEXT,
        returned_at TIMESTAMP,
        validated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        validation_result VARCHAR(50) CHECK (validation_result IN ('complete', 'partial', 'not_done')),
        validated_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Assignments table created');

    // Create notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        assignment_id INTEGER REFERENCES assignments(id) ON DELETE CASCADE,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Notifications table created');

    // Create territory_history table for tracking all territory work
    await client.query(`
      CREATE TABLE IF NOT EXISTS territory_history (
        id SERIAL PRIMARY KEY,
        territory_id INTEGER REFERENCES territories(id) ON DELETE CASCADE,
        assignment_id INTEGER REFERENCES assignments(id) ON DELETE SET NULL,
        dirigente_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        dirigente_name VARCHAR(255),
        worked_date DATE NOT NULL,
        blocks_worked INTEGER[] DEFAULT '{}',
        total_blocks INTEGER NOT NULL,
        result VARCHAR(50) NOT NULL CHECK (result IN ('complete', 'partial', 'not_done')),
        observations TEXT,
        validated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Territory history table created');

    // Create push_subscriptions table for Web Push notifications
    await client.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, endpoint)
      );
    `);
    console.log('✅ Push subscriptions table created');

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
      CREATE INDEX IF NOT EXISTS idx_assignments_dirigente ON assignments(dirigente_id);
      CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments(due_date);
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
      CREATE INDEX IF NOT EXISTS idx_territory_history_territory ON territory_history(territory_id);
      CREATE INDEX IF NOT EXISTS idx_territory_history_date ON territory_history(worked_date);
      CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
    `);
    console.log('✅ Indexes created');

    const adminResult = await client.query(
      "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
    );

    if (adminResult.rows.length === 0) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);

      await client.query(
        `
          INSERT INTO users (name, username, password, role)
          VALUES ($1, $2, $3, 'admin')
        `,
        [adminName, adminUsername, hashedPassword]
      );

      console.log(`✅ Default admin user created (${adminUsername})`);
    } else {
      console.log('ℹ️ Admin user already exists, skipping seed');
    }

    // Add not_worked column to assignments if not exists
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'assignments' AND column_name = 'not_worked'
        ) THEN
          ALTER TABLE assignments ADD COLUMN not_worked BOOLEAN DEFAULT FALSE;
        END IF;
      END $$;
    `);
    console.log('✅ Assignments not_worked column checked/created');

    // Add conclusion_date column to territory_history if not exists
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'territory_history' AND column_name = 'conclusion_date'
        ) THEN
          ALTER TABLE territory_history ADD COLUMN conclusion_date DATE;
        END IF;
      END $$;
    `);
    console.log('✅ Territory history conclusion_date column checked/created');

    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    client.release();
  }
};

export default migrate;

// If run directly (npm run migrate), execute migrations and close the pool.
if (process.argv[1] && process.argv[1].endsWith('src/db/migrate.js')) {
  migrate()
    .catch((err) => {
      console.error('Migration failed:', err);
      return err;
    })
    .finally(() => {
      // Close pool when script executed directly
      pool.end().catch(() => {});
    });
}

