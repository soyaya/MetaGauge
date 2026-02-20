# CRITICAL: Resolve RPC provider monitoring route failures

## Description
The monitoring routes for RPC providers are failing intermittently, causing the system to lose visibility into blockchain node health and potentially routing requests through unhealthy providers.

## Stack Context
- **RPC Providers:** Ethereum, Lisk, Starknet nodes
- **Multi-chain Abstraction:** EthereumRpcClient, LiskRpcClient, StarknetRpcClient
- **Monitoring:** Health check endpoints needed
- **Backend:** Express.js

## Current Issues
1. Health check endpoints return stale data
2. No timeout handling for slow providers
3. Circuit breaker not implemented
4. Provider failover not working correctly

## Requirements
1. Implement provider health check endpoint
2. Add timeout (e.g., 5 seconds) for health checks
3. Implement circuit breaker pattern
4. Add provider status caching (30-60 second TTL)
5. Route requests through healthy providers only
6. Log provider failures for debugging

## Implementation Details
- Create HealthCheckService with multi-chain support
- Implement CircuitBreaker class with threshold/timeout configuration
- Add provider status tracking and failover logic
- Create monitoring dashboard integration points
- Add metrics for provider uptime/latency

## Testing
- Unit tests for health check logic
- Integration tests for provider failover
- Supertest for health check endpoints
- Mock provider failures

## Acceptance Criteria
- [ ] Health check endpoints functional
- [ ] Circuit breaker prevents cascading failures
- [ ] Automatic failover working
- [ ] Provider status visible in monitoring
- [ ] All tests pass

## Labels
Critical, Backend, Infrastructure, Monitoring