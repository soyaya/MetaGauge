# CRITICAL: Implement graceful shutdown handler

## Description
Currently, the application lacks proper graceful shutdown handling. The server needs to close connections cleanly when receiving SIGTERM/SIGINT signals.

## Stack Context
- **Backend:** Node.js + Express.js
- **Database:** JSON file storage (transitioning to PostgreSQL per #44)
- **WebSocket:** Real-time updates connections

## Requirements
1. Implement SIGTERM and SIGINT signal handlers
2. Close WebSocket connections gracefully
3. Flush pending write operations to database
4. Wait for in-flight API requests to complete
5. Set a timeout (e.g., 30 seconds) to force shutdown
6. Log shutdown events for monitoring

## Implementation Details
- Add signal handlers in main server file
- Close all RPC client connections
- Ensure file-based storage (data/*.json) writes complete before exit
- Prepare for PostgreSQL migration (#44) - ensure connection pooling cleanup

## Testing
- Unit tests for signal handlers
- Integration tests for graceful shutdown with active connections

## Acceptance Criteria
- [ ] SIGTERM and SIGINT handlers implemented
- [ ] All connections closed within 30 seconds
- [ ] No data corruption on shutdown
- [ ] Shutdown events logged
- [ ] Tests pass (Jest)

## Labels
Critical, Backend, Stability