const { execSync } = require('child_process');

try {
  console.log('Running tests in client directory...');
  process.chdir(__dirname);
  execSync('npx jest', { stdio: 'inherit' });
} catch (error) {
  console.error('Test execution failed:', error.message);
  process.exit(1);
}
