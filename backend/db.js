const Database = require('better-sqlite3');
const db = new Database('wattwise.db');

// Create readings table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS readings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    room        TEXT NOT NULL,
    occupied    INTEGER DEFAULT 0,
    current_a   REAL DEFAULT 0,
    power_w     REAL DEFAULT 0,
    ldr         INTEGER DEFAULT 0,
    anomaly     REAL DEFAULT 0,
    relay       INTEGER DEFAULT 0,
    ts          DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create alerts table
db.exec(`
  CREATE TABLE IF NOT EXISTS alerts (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    room      TEXT NOT NULL,
    type      TEXT NOT NULL,
    message   TEXT,
    resolved  INTEGER DEFAULT 0,
    ts        DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

console.log('Database initialized: wattwise.db');

module.exports = db;
