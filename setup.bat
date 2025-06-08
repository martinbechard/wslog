@echo off
echo 🚀 Setting up WSLog - Advanced WebSocket Logging System...
echo.

where pnpm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ pnpm is not installed. Please install pnpm first:
    echo    npm install -g pnpm
    exit /b 1
)

echo 📦 Installing dependencies...
echo.

echo Installing root workspace dependencies...
pnpm install -w

echo Installing shared package dependencies...
cd shared && pnpm install && cd ..

echo Installing server dependencies...
cd server && pnpm install && cd ..

echo Installing client dependencies...
cd client && pnpm install && cd ..

echo Installing frontend dependencies...
cd frontend && pnpm install && cd ..

echo.
echo 🏗️  Building all packages...
pnpm build

echo.
echo ✅ WSLog setup complete!
echo.
echo 🎯 Quick start commands:
echo    Start server:     pnpm dev:server
echo    Start frontend:   pnpm dev:frontend
echo    Start both:       pnpm dev
echo    Send test log:    pnpm client info "Hello WSLog!"
echo    Interactive CLI:  pnpm client interactive
echo    Monitor logs:     pnpm client monitor
echo.
echo 🌐 URLs:
echo    Frontend:         http://localhost:3000
echo    WebSocket Server: ws://localhost:8085
echo.
echo 📖 See README.md for detailed usage instructions.
echo.
echo 🧪 Test the system:
echo    1. Run: pnpm dev:server
echo    2. In another terminal: pnpm client info "Test message"
echo    3. In a browser: http://localhost:3000
pause
