/**
 * MainAppClient
 * Fetches user data from the main MetaGauge backend using the user's JWT.
 * The agent never stores this data — it fetches fresh on each run.
 */

import config from '../config/env.js';

async function get(path, token) {
  const res = await fetch(`${config.mainAppUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Main app ${path} returned ${res.status}`);
  return res.json();
}

export const MainAppClient = {
  // Get user's onboarded contracts
  async getContracts(token) {
    const data = await get('/api/contracts', token);
    return data.contracts || data || [];
  },

  // Get latest completed analysis for a contract
  async getAnalysis(token) {
    const data = await get('/api/analysis/history', token);
    const analyses = data.analyses || data || [];
    return analyses.find(a => a.status === 'completed') || null;
  },

  // Get traction dashboard data (metrics, retention, gas, etc.)
  async getTraction(token) {
    return get('/api/traction/dashboard', token);
  },

  // Get user profile
  async getUser(token) {
    return get('/api/auth/me', token);
  },
};
