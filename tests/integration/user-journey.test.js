/**
 * Integration Test: Complete User Journey
 * Tests signup -> login -> onboarding -> analysis flow
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../src/api/server.js';

describe('User Journey Integration Tests', () => {
  let authToken;
  let userId;
  let contractId;
  
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    name: 'Test User'
  };

  test('1. User can register', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send(testUser)
      .expect(201);

    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('user');
    expect(response.body.user.email).toBe(testUser.email);
    
    authToken = response.body.token;
    userId = response.body.user.id;
  });

  test('2. User can login', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      })
      .expect(200);

    expect(response.body).toHaveProperty('token');
    authToken = response.body.token;
  });

  test('3. User can access profile', async () => {
    const response = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.email).toBe(testUser.email);
    expect(response.body.id).toBe(userId);
  });

  test('4. User can add contract', async () => {
    const response = await request(app)
      .post('/api/contracts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        address: '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
        chain: 'lisk',
        name: 'Test Contract'
      })
      .expect(201);

    expect(response.body).toHaveProperty('id');
    contractId = response.body.id;
  });

  test('5. User can list contracts', async () => {
    const response = await request(app)
      .get('/api/contracts')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
  });

  test('6. Unauthorized access is blocked', async () => {
    await request(app)
      .get('/api/users/profile')
      .expect(401);
  });

  test('7. Invalid token is rejected', async () => {
    await request(app)
      .get('/api/users/profile')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });
});
