#!/usr/bin/env node

const TICK_INTERVAL = 60000; // 1 minute
const API_URL = 'http://localhost:3000/api/jobs/tick';

console.log('🤖 Local Cron Simulator Started');
console.log(`⏰ Running every ${TICK_INTERVAL / 1000} seconds`);
console.log('Press Ctrl+C to stop\n');

async function tick() {
  try {
    console.log(`[${new Date().toLocaleTimeString('pt-BR')}] Processing queue...`);
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Processed: ${result.processed || 0} items`);
      if (result.results && result.results.length > 0) {
        result.results.forEach(r => {
          const icon = r.success ? '✓' : '✗';
          console.log(`  ${icon} Item ${r.itemId}: ${r.action}${r.mock ? ' (mock)' : ''}`);
        });
      }
    } else {
      console.log(`❌ Error: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.log(`❌ Failed to call API: ${error.message}`);
  }
}

// Run immediately
tick();

// Then run every minute
setInterval(tick, TICK_INTERVAL);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Local Cron Simulator Stopped');
  process.exit(0);
});