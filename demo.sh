#!/bin/bash

echo "🎬 WSLog Demo - Showcasing Advanced Logging Features"
echo ""

# Check if server is running
if ! nc -z localhost 8085 2>/dev/null; then
    echo "❌ WSLog server is not running on port 8085"
    echo "   Please start the server first: pnpm dev:server"
    exit 1
fi

echo "✅ WSLog server detected on port 8085"
echo ""

echo "📝 Sending sample logs..."
sleep 1

# Basic logging examples
pnpm client info "Application startup initiated" --source "demo-app"
sleep 0.5

pnpm client info "Database connection established" --source "db-manager" --data '{"host": "localhost", "port": 5432}'
sleep 0.5

pnpm client warn "Memory usage at 75%" --source "system-monitor" --data '{"usage": "75%", "threshold": "80%"}'
sleep 0.5

echo "🔍 Sending trace examples..."
sleep 1

# Function tracing examples
pnpm client trace-entry "processUserLogin" '["user123", "password"]' --source "auth-service"
sleep 0.3

pnpm client info "Validating user credentials" --source "auth-service"
sleep 0.3

pnpm client trace-entry "validatePassword" '["user123"]' --source "auth-service"
sleep 0.3

pnpm client debug "Password hash comparison started" --source "auth-service"
sleep 0.3

pnpm client trace-exit "validatePassword" --return '{"valid": true}' --source "auth-service"
sleep 0.3

pnpm client trace-entry "generateSession" '["user123"]' --source "auth-service"
sleep 0.3

pnpm client info "Session token generated" --source "auth-service" --data '{"sessionId": "sess_abc123", "expiresIn": 3600}'
sleep 0.3

pnpm client trace-exit "generateSession" --return '{"sessionId": "sess_abc123"}' --source "auth-service"
sleep 0.3

pnpm client trace-exit "processUserLogin" --return '{"success": true, "sessionId": "sess_abc123"}' --source "auth-service"
sleep 0.5

echo "⚠️  Sending error scenario..."
sleep 1

# Error scenario
pnpm client trace-entry "processPayment" '["order_456", 99.99]' --source "payment-service"
sleep 0.3

pnpm client info "Contacting payment gateway" --source "payment-service"
sleep 0.3

pnpm client error "Payment gateway timeout" --source "payment-service" --data '{"gateway": "stripe", "timeout": 30000, "orderId": "order_456"}'
sleep 0.3

pnpm client trace-exit "processPayment" --error "Gateway timeout after 30 seconds" --source "payment-service"
sleep 0.5

echo "🚀 Sending high-frequency logs..."
sleep 1

# Simulate high-frequency logging
for i in {1..10}; do
    pnpm client debug "Processing request #$i" --source "api-gateway" --data "{\"requestId\": \"req_$i\", \"endpoint\": \"/api/users\"}" &
    sleep 0.1
done

wait

echo ""
echo "🎉 Demo complete!"
echo ""
echo "📊 Check the frontend at http://localhost:3000 to see:"
echo "   • Real-time log streaming"
echo "   • Hierarchical trace visualization"
echo "   • Interactive filtering and statistics"
echo "   • Thread tracking and nesting levels"
echo ""
echo "🔧 Try these commands for more exploration:"
echo "   pnpm client interactive     # Interactive logging session"
echo "   pnpm client monitor         # Monitor live logs in terminal"
echo "   pnpm client ping            # Test server connectivity"
echo ""
echo "🎯 Filter examples for the frontend:"
echo "   • Filter by source: 'auth-service', 'payment-service'"
echo "   • Filter by level: 'error', 'warn', 'info', 'debug'"
echo "   • Include pattern: '.*login.*', '.*payment.*'"
echo "   • Exclude pattern: '.*debug.*'"
