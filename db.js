const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+00:00' // Postavi UTC vremensku zonu
});

// Poboljšana funkcija za testiranje veze
async function testConnection() {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.ping();
    console.log('Uspješno povezan s MySQL bazom!');
  } catch (err) {
    console.error('Greška pri povezivanju s bazom:', err);
    process.exit(1);
  } finally {
    if (connection) connection.release();
  }
}

// Testiraj vezu prilikom pokretanja
testConnection();

// Pravilno zatvaranje veza prilikom zaustavljanja aplikacije
process.on('SIGINT', async () => {
  try {
    await pool.end();
    console.log('MySQL veze zatvorene');
    process.exit(0);
  } catch (err) {
    console.error('Greška pri zatvaranju veza:', err);
    process.exit(1);
  }
});

module.exports = pool;