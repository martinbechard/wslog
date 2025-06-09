#!/bin/bash

# WSLog Port Cleanup Script
# Kills processes on ports used by WSLog system

PORTS=(3000 8085)
FOUND_PROCESSES=false

echo "🧹 WSLog Port Cleanup"
echo "====================="

for PORT in "${PORTS[@]}"; do
    echo -n "Checking port $PORT... "
    
    # Find processes on this port
    PIDS=$(lsof -ti :$PORT 2>/dev/null)
    
    if [ -z "$PIDS" ]; then
        echo "✅ Clear"
    else
        echo "🔍 Found processes: $PIDS"
        FOUND_PROCESSES=true
        
        # Show process details before killing
        echo "   Process details:"
        lsof -i :$PORT | head -10
        
        # Kill the processes
        echo "   💀 Killing processes..."
        for PID in $PIDS; do
            kill -TERM $PID 2>/dev/null
            sleep 1
            # Force kill if still running
            if kill -0 $PID 2>/dev/null; then
                kill -KILL $PID 2>/dev/null
                echo "   ⚡ Force killed PID $PID"
            else
                echo "   ✅ Gracefully killed PID $PID"
            fi
        done
    fi
done

if [ "$FOUND_PROCESSES" = true ]; then
    echo ""
    echo "🔄 Verifying cleanup..."
    sleep 2
    
    for PORT in "${PORTS[@]}"; do
        REMAINING=$(lsof -ti :$PORT 2>/dev/null)
        if [ -z "$REMAINING" ]; then
            echo "✅ Port $PORT is now clear"
        else
            echo "⚠️  Port $PORT still has processes: $REMAINING"
        fi
    done
else
    echo ""
    echo "✨ All ports were already clear!"
fi

echo ""
echo "🚀 Ready to start WSLog!"
echo "   Run: pnpm dev"
echo "   Or:  pnpm fresh-start"