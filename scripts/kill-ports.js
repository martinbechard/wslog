#!/usr/bin/env node

const { execSync } = require('child_process');

const ports = [3000, 8085];

console.log('🧹 WSLog Port Cleanup');
console.log('🔍 Checking ports:', ports.join(', '));

let foundProcesses = false;

ports.forEach(port => {
  try {
    // Use proper lsof syntax
    const command = `lsof -ti :${port}`;
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    const pids = output.trim().split('\n').filter(Boolean);
    
    if (pids.length > 0) {
      console.log(`🔍 Found processes on port ${port}: ${pids.join(', ')}`);
      foundProcesses = true;
      
      // Kill the processes
      pids.forEach(pid => {
        try {
          execSync(`kill -9 ${pid}`, { stdio: 'pipe' });
          console.log(`✅ Killed PID ${pid} on port ${port}`);
        } catch (killError) {
          console.log(`⚠️  Failed to kill PID ${pid}: ${killError.message}`);
        }
      });
    } else {
      console.log(`✅ Port ${port} already clear`);
    }
  } catch (error) {
    // No processes found on this port
    console.log(`✅ Port ${port} already clear`);
  }
});

if (foundProcesses) {
  console.log('\n🔄 Verifying cleanup...');
  
  // Wait a moment then verify
  setTimeout(() => {
    ports.forEach(port => {
      try {
        const command = `lsof -ti :${port}`;
        const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
        const remaining = output.trim().split('\n').filter(Boolean);
        
        if (remaining.length > 0) {
          console.log(`⚠️  Port ${port} still has processes: ${remaining.join(', ')}`);
        } else {
          console.log(`✅ Port ${port} verified clear`);
        }
      } catch (error) {
        console.log(`✅ Port ${port} verified clear`);
      }
    });
    
    console.log('\n🚀 All ports cleaned!');
    console.log('Ready to run: pnpm dev');
  }, 1000);
} else {
  console.log('\n✨ All ports were already clear!');
  console.log('🚀 Ready to run: pnpm dev');
}