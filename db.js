const mysql = require('mysql2/promise');
// require('dotenv').config(); // <<< LINIJA OBRISANA/UKLONJENA (imamo je samo u app.js)

// Dodano za debugiranje - ispisat će varijable u Railway logovima
console.log("--- Pokušavam koristiti ove DB varijable ---");
console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_USER:", process.env.DB_USER);
// Ne ispisuj lozinku u logove iz sigurnosnih razloga
// console.log("DB_PASSWORD:", process.env.DB_PASSWORD);
console.log("DB_NAME:", process.env.DB_NAME);
console.log("DB_PORT:", process.env.DB_PORT);
console.log("------------------------------------------");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT, // <<< PROVJERENO DA OVA LINIJA POSTOJI
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+00:00' // Postavi UTC vremensku zonu
});

// Definicija funkcije ostaje ista
async function testConnection() {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.ping();
    console.log('Uspješno povezan s MySQL bazom!');
  } catch (err) {
    // Greška će se ispisati, ali aplikacija se NEĆE srušiti odmah jer je poziv dolje zakomentiran
    console.error('Greška pri POKUŠAJU povezivanja s bazom (testConnection):', err);
    // process.exit(1); // <-- Ovo je ono što ruši aplikaciju, izbjegavamo ga sada
  } finally {
    if (connection) connection.release();
  }
}

// Testiraj vezu prilikom pokretanja
// testConnection(); // <<< POZIV FUNKCIJE ZAKOMENTIRAN za potrebe debugiranja

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