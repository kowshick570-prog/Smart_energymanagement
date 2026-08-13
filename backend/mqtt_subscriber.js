const mqtt = require('mqtt');
const db   = require('./db');

const BROKER = process.env.MQTT_BROKER || 'mqtt://broker.hivemq.com';
const TOPIC  = 'kit/sensors/#';   // wildcard — all rooms

const client = mqtt.connect(BROKER);

client.on('connect', () => {
  console.log(`MQTT connected → ${BROKER}`);
  client.subscribe(TOPIC, (err) => {
    if (err) console.error('Subscribe error:', err);
    else console.log(`Subscribed to: ${TOPIC}`);
  });
});

client.on('message', (topic, message) => {
  try {
    const data = JSON.parse(message.toString());

    // Save reading to DB
    db.prepare(`
      INSERT INTO readings (room, occupied, current_a, power_w, ldr, anomaly, relay)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.room,
      data.occupied ? 1 : 0,
      data.current_A   || 0,
      data.power_W     || 0,
      data.ldr         || 0,
      data.anomaly_score || 0,
      data.relay       || 0
    );

    console.log(`[${new Date().toLocaleTimeString()}] Saved → ${data.room} | ${data.power_W}W | anomaly: ${data.anomaly_score}`);

    // Auto-alert if anomaly score > 0.5
    if (data.anomaly_score > 0.5) {
      db.prepare(`
        INSERT INTO alerts (room, type, message)
        VALUES (?, ?, ?)
      `).run(
        data.room,
        'ANOMALY',
        `Abnormal consumption detected — score: ${data.anomaly_score}`
      );
      console.warn(`⚠ ALERT saved for ${data.room}`);
    }

    // Auto-alert if unoccupied but high power
    if (!data.occupied && data.power_W > 500) {
      db.prepare(`
        INSERT INTO alerts (room, type, message)
        VALUES (?, ?, ?)
      `).run(
        data.room,
        'IDLE_WASTE',
        `Room unoccupied but drawing ${data.power_W}W`
      );
      console.warn(`⚠ IDLE WASTE alert for ${data.room}`);
    }

  } catch (err) {
    console.error('Failed to parse MQTT message:', err.message);
  }
});

client.on('error', (err) => {
  console.error('MQTT error:', err.message);
});

client.on('disconnect', () => {
  console.log('MQTT disconnected');
});

module.exports = client;
