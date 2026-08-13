require('dotenv').config();
const express = require('express');
const cors    = require('cors');

// Start MQTT listener
require('./mqtt_subscriber');

const app = express();
app.use(cors());
app.use(express.json());

const db = require('./db');

// ─── ROUTES ───────────────────────────────────────────────

// GET /api/rooms — latest reading per room
app.get('/api/rooms', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT room, occupied, current_a, power_w, ldr, anomaly, relay, ts
      FROM readings
      WHERE ts = (
        SELECT MAX(ts) FROM readings r2 WHERE r2.room = readings.room
      )
      GROUP BY room
      ORDER BY room ASC
    `).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/history/:room — last 50 readings for a room
app.get('/api/history/:room', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT power_w, current_a, anomaly, occupied, ts
      FROM readings
      WHERE room = ?
      ORDER BY ts DESC
      LIMIT 50
    `).all(req.params.room);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/summary — today's totals
app.get('/api/summary', (req, res) => {
  try {
    const result = db.prepare(`
      SELECT
        ROUND(SUM(power_w) / 1000.0, 2)              AS total_kwh,
        COUNT(DISTINCT room)                           AS active_rooms,
        SUM(CASE WHEN occupied = 1 THEN 1 ELSE 0 END) AS occupied_rooms,
        SUM(CASE WHEN anomaly > 0.5 THEN 1 ELSE 0 END) AS anomaly_count
      FROM readings
      WHERE DATE(ts) = DATE('now')
    `).get();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/alerts — unresolved alerts
app.get('/api/alerts', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT * FROM alerts
      WHERE resolved = 0
      ORDER BY ts DESC
      LIMIT 20
    `).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/alerts/:id/resolve — mark alert as resolved
app.patch('/api/alerts/:id/resolve', (req, res) => {
  try {
    db.prepare(`UPDATE alerts SET resolved = 1 WHERE id = ?`).run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/block-summary — energy per block (EB / CB / WB)
app.get('/api/block-summary', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT
        SUBSTR(room, 1, 2)                   AS block,
        ROUND(SUM(power_w) / 1000.0, 2)     AS total_kwh,
        COUNT(DISTINCT room)                  AS room_count,
        SUM(CASE WHEN occupied=1 THEN 1 ELSE 0 END) AS occupied_count
      FROM readings
      WHERE DATE(ts) = DATE('now')
      GROUP BY SUBSTR(room, 1, 2)
    `).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── START SERVER ─────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`WattWise backend running on http://localhost:${PORT}`);
});
