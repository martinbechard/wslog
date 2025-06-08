# WSLog Port Management Scripts

This directory contains utility scripts to manage ports used by the WSLog system.

## Ports Used

- **3000**: Frontend development server (Vite)
- **8085**: WebSocket logging server (WSLog Server)

## Available Scripts

### Quick Cleanup (Cross-platform)
```bash
# Kill processes on WSLog ports (works on macOS/Linux/Windows with Node.js)
pnpm clean
# or
pnpm kill-ports
```

### Platform-Specific Scripts

#### macOS/Linux
```bash
# Run the detailed cleanup script
pnpm cleanup
# or directly:
chmod +x scripts/cleanup-ports.sh
./scripts/cleanup-ports.sh
```

#### Windows
```bash
# Run the Windows batch script
pnpm cleanup-win
# or directly:
scripts\cleanup-ports.bat
```

### Check Port Status
```bash
# See what's running on WSLog ports
pnpm check-ports
```

### Fresh Start
```bash
# Clean ports and immediately start development servers
pnpm fresh-start
```

## Manual Port Cleanup

If you prefer to handle this manually:

### macOS/Linux
```bash
# Find processes on ports
lsof -i :3000
lsof -i :8085

# Kill specific processes
kill -9 <PID>

# Kill all processes on a port
lsof -ti :8085 | xargs kill -9
```

### Windows
```cmd
# Find processes on ports
netstat -ano | findstr :3000
netstat -ano | findstr :8085

# Kill specific process
taskkill /PID <PID> /F
```

## Troubleshooting

If you see the error from your original lsof output:
```
COMMAND     PID          USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node       6441 martinbechard   23u  IPv6 0x79b9e3d5248f3c4c      0t0  TCP localhost:8085->localhost:60058 (ESTABLISHED)
```

This means Node.js processes are still holding the port. The cleanup scripts will automatically handle this by:

1. Finding all PIDs using the ports
2. Attempting graceful termination (SIGTERM)
3. Force killing if necessary (SIGKILL)
4. Verifying the ports are clear

## Fresh Development Workflow

```bash
# 1. Clean any stuck processes
pnpm clean

# 2. Start development (or use fresh-start to do both)
pnpm dev

# 3. Access the application:
#    - Frontend: http://localhost:3000
#    - Server: WebSocket on localhost:8085
```