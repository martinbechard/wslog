const { spawn } = require('child_process');

// Run only the browser test
const jest = spawn('npx', ['jest', 'WSLogClient.browser.test.ts'], {
  cwd: process.cwd(),
  stdio: 'inherit'
});

jest.on('close', (code) => {
  console.log(`Browser test completed with code ${code}`);
  process.exit(code);
});
