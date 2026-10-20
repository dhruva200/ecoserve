// Simple IoT Cold-Storage Simulator Script (35 lines)
// Run in terminal: npm run iot-sim

const API_URL = 'http://127.0.0.1:4000/api/iot';
const isSpike = process.argv.includes('--spike');

async function sendTemp(temp) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sensor_id: 'FREEZER-01', temperature: temp }),
    });
    const data = await res.json();
    console.log(
      `[IoT Sensor FREEZER-01] Temp: ${data.temperature}°C | Status: ${data.alert_status}`
    );
  } catch (err) {
    console.log('Make sure server is running first (npm run dev)');
  }
}

if (isSpike) {
  console.log('🔥 Sending High Temperature Spike (10.5°C)...');
  sendTemp(10.5);
} else {
  console.log('🌡️ Starting IoT Temperature Simulator (every 4 seconds)...');
  let step = 0;
  setInterval(() => {
    step++;
    // Every 4th reading sends a 10.2°C spike to test the alert!
    const temp = step % 4 === 0 ? 10.2 : Number((3.8 + Math.random()).toFixed(1));
    sendTemp(temp);
  }, 4000);
}
