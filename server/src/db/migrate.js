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
        role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'dirigente', 'publisher')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Users table created');

    // Alter users check constraint to allow 'publisher' if it already exists with old roles
    await client.query(`
      DO $$
      DECLARE
          constraint_name_var text;
      BEGIN
          SELECT con.conname INTO constraint_name_var
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          WHERE rel.relname = 'users' AND con.contype = 'c' AND con.conname LIKE '%role%';
          
          IF constraint_name_var IS NOT NULL THEN
              EXECUTE 'ALTER TABLE users DROP CONSTRAINT ' || constraint_name_var;
          END IF;
      END $$;
      ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'dirigente', 'publisher'));
    `);
    console.log('✅ Users role constraint updated');

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

    // Create streets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS streets (
        id SERIAL PRIMARY KEY,
        territory_id INTEGER NOT NULL REFERENCES territories(id) ON DELETE CASCADE,
        block_number INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        observations TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Streets table created');

    // Create houses table
    await client.query(`
      CREATE TABLE IF NOT EXISTS houses (
        id SERIAL PRIMARY KEY,
        street_id INTEGER NOT NULL REFERENCES streets(id) ON DELETE CASCADE,
        number VARCHAR(100) NOT NULL,
        dont_visit BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Houses table created');

    // Create publisher_assignments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS publisher_assignments (
        id SERIAL PRIMARY KEY,
        assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
        publisher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        block_number INTEGER NOT NULL,
        street_ids INTEGER[],
        status VARCHAR(50) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'returned')),
        assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        due_date TIMESTAMP NOT NULL,
        returned_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Publisher assignments table created');

    // Create house_status table
    await client.query(`
      CREATE TABLE IF NOT EXISTS house_status (
        id SERIAL PRIMARY KEY,
        assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
        house_id INTEGER NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
        visited BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (assignment_id, house_id)
      );
    `);
    console.log('✅ House status table created');

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
      CREATE INDEX IF NOT EXISTS idx_streets_territory_block ON streets(territory_id, block_number);
      CREATE INDEX IF NOT EXISTS idx_houses_street ON houses(street_id);
      CREATE INDEX IF NOT EXISTS idx_publisher_assignments_assignment ON publisher_assignments(assignment_id);
      CREATE INDEX IF NOT EXISTS idx_publisher_assignments_publisher ON publisher_assignments(publisher_id);
      CREATE INDEX IF NOT EXISTS idx_house_status_assignment ON house_status(assignment_id);
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

    // Add street_ids column to publisher_assignments if not exists
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'publisher_assignments' AND column_name = 'street_ids'
        ) THEN
          ALTER TABLE publisher_assignments ADD COLUMN street_ids INTEGER[];
        END IF;
      END $$;
    `);
    console.log('✅ Publisher assignments street_ids column checked/created');

    // Add dont_visit column to houses if not exists
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'houses' AND column_name = 'dont_visit'
        ) THEN
          ALTER TABLE houses ADD COLUMN dont_visit BOOLEAN DEFAULT FALSE;
        END IF;
      END $$;
    `);
    console.log('✅ Houses dont_visit column checked/created');

    // Add observations column to streets if not exists
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'streets' AND column_name = 'observations'
        ) THEN
          ALTER TABLE streets ADD COLUMN observations TEXT;
        END IF;
      END $$;
    `);
    console.log('✅ Streets observations column checked/created');

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
if (process.argv[1]?.endsWith('src/db/migrate.js')) {
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

