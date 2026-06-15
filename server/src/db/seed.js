import pool from './config.js';

const seed = async () => {
  const client = await pool.connect();
  try {
    console.log('🌱 Starting database seeding...');
    
    // Check if territory 1 already exists
    const checkRes = await client.query('SELECT id FROM territories WHERE territory_number = 1');
    if (checkRes.rows.length > 0) {
      console.log('ℹ️ Territory 1 already exists, skipping seed');
      return;
    }
    
    await client.query('BEGIN');
    
    // Insert Territory
    const terrRes = await client.query(`
      INSERT INTO territories (territory_number, territory_code, locality, block_count, map_filename)
      VALUES (1, 'ter_01', 'Mogi Moderno', 6, 'ter_01.png')
      RETURNING id
    `);
    const territoryId = terrRes.rows[0].id;
    console.log(`✅ Territory 1 created with ID ${territoryId}`);
    
    // Data definition for blocks, streets and houses
    const seedData = [
      {
        block_number: 1,
        streets: [
          { name: 'Rua Professora Luisinha da Costa', houses: ['120', '128', '140', '142', '144', '152'] },
          { name: 'Rua Capitão Mariano', houses: ['996', '1024', '1048'] },
          { name: 'Rua Rafael Fernandes', houses: ['02', '04', '06', '08'] },
          { name: 'Rua Major Arouche', houses: ['111', '113'] }
        ]
      },
      {
        block_number: 2,
        streets: [
          { name: 'Rua Capitão Mariano', houses: ['155', '159', '163'] },
          { name: 'Rua Doutor Bezerra de Menezes', houses: ['81', '83'] },
          { name: 'Travessa São Sebastião', houses: ['03', '07', '09', '11'] },
          { name: 'Rua Doutor Deodato Wertheimer', houses: ['1126', '1128', '1130', '1130F'] }
        ]
      },
      {
        block_number: 3,
        streets: [
          { name: 'Rua Capitão Mariano', houses: ['449', '455', '470'] },
          { name: 'Rua Doutor Bezerra de Menezes', houses: ['101', '109', '121'] },
          { name: 'Rua Waldomiro Nogueira', houses: ['199', '201', '205', '207'] }
        ]
      },
      {
        block_number: 4,
        streets: [
          { name: 'Rua Capitão Mariano', houses: ['701', '703', '705', '705F', '700'] },
          { name: 'Rua Waldomiro Nogueira', houses: ['200', '202', '206', '208'] },
          { name: 'Rua Doutor Bezerra de Menezes', houses: ['100', '108'] },
          { name: 'Travessa São Sebastião', houses: ['02', '04', '06', '08', '10'] },
          { name: 'Rua Doutor Deodato Wertheimer', houses: ['1131', '1133', '1135', '1137'] },
          { name: 'Avenida Brasil', houses: ['2293', '2295', '2297'] },
          { name: 'Rua Mário Silveira', houses: ['302', '304', '306', '307'] },
          { name: 'Rua Rafael Fernandes', houses: ['1109', '1111', '1113', '1115'] }
        ]
      },
      {
        block_number: 5,
        streets: [
          { name: 'Rua Mário Silveira', houses: ['301', '303', '305', '307'] },
          { name: 'Avenida Brasil', houses: ['22301', '22303', '22305'] },
          { name: 'Rua Rafael Fernandes', houses: ['1009', '1043', '1051', '1071'] }
        ]
      },
      {
        block_number: 6,
        streets: [
          { name: 'Avenida Brasil', houses: ['22302', '22304', '22306', '22308', '22310'] },
          { name: 'Rua Doutor Wertheimer', houses: ['1138', '1140', '1142', '1144'] },
          { name: 'Rua José de Paiva Duque', houses: ['701', '703', '705', '707'] }
        ]
      }
    ];

    for (const block of seedData) {
      for (const street of block.streets) {
        // Insert Street
        const streetRes = await client.query(`
          INSERT INTO streets (territory_id, block_number, name)
          VALUES ($1, $2, $3)
          RETURNING id
        `, [territoryId, block.block_number, street.name]);
        const streetId = streetRes.rows[0].id;
        
        // Insert Houses
        for (const houseNumber of street.houses) {
          await client.query(`
            INSERT INTO houses (street_id, number)
            VALUES ($1, $2)
          `, [streetId, houseNumber]);
        }
      }
    }
    
    await client.query('COMMIT');
    console.log('🎉 Seeding completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding error:', error);
    throw error;
  } finally {
    client.release();
  }
};

export default seed;

// If run directly (npm run seed), execute seed and close the pool.
if (process.argv[1] && process.argv[1].endsWith('src/db/seed.js')) {
  seed()
    .catch((err) => {
      console.error('Seed failed:', err);
      return err;
    })
    .finally(() => {
      pool.end().catch(() => {});
    });
}
