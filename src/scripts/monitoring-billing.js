/**
 * Continuous monitoring scheduler.
 * Each user syncs at their registration time (UTC hour:minute), every 24h.
 * Charges $0.10/day. If balance runs out, sync stops.
 * Sequential within the same minute to avoid RPC overload.
 */
import { UserStorage, ContractStorage } from '../api/database/index.js';
import subscriptionService from '../services/SubscriptionService.js';
import { PRICING } from '../config/pricing.js';

async function syncUserContracts(user) {
  try {
    const contract = user.onboarding?.defaultContract;
    if (!contract?.address) return;

    // Charge for today's monitoring
    const charge = await subscriptionService.charge(user.id, 'contract_monitoring');
    if (!charge.allowed) {
      // Stop sync — balance exhausted
      await UserStorage.update(user.id, {
        onboarding: {
          ...user.onboarding,
          defaultContract: { ...contract, continuousSync: false }
        }
      });
      console.log(`[Sync] Stopped sync for ${user.email} — insufficient balance ($${charge.balance})`);
      return;
    }

    console.log(`[Sync] Starting sync for ${user.email} — contract ${contract.address} on ${contract.chain}`);

    // Trigger indexing for main contract
    const { triggerDefaultContractIndexing } = await import('../api/routes/trigger-indexing.js');
    const mockReq = { user: { id: user.id }, body: {}, params: {} };
    const mockRes = { json: () => {}, status: () => mockRes };
    await triggerDefaultContractIndexing(mockReq, mockRes);

    // Sync competitor contracts
    const userContracts = await ContractStorage.findByUserId(user.id);
    for (const c of userContracts) {
      const competitors = c.competitors || [];
      for (const comp of competitors) {
        try {
          const { indexCompetitor } = await import('../api/routes/competitor-indexing.js');
          await indexCompetitor(user.id, comp.address, comp.chain || contract.chain, c.id);
          console.log(`[Sync]   Competitor ${comp.address} synced`);
        } catch (e) {
          console.warn(`[Sync]   Competitor ${comp.address} failed:`, e.message);
        }
      }
    }

    console.log(`[Sync] Done for ${user.email} — charged $${charge.charged}`);
  } catch (err) {
    console.error(`[Sync] Error for ${user.email}:`, err.message);
  }
}

async function runScheduledSyncs() {
  const now = new Date();
  const currentHour   = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();

  const users = await UserStorage.findAll();
  const due = users.filter(u =>
    u.onboarding?.defaultContract?.continuousSync &&
    u.syncHour   === currentHour &&
    u.syncMinute === currentMinute
  );

  if (due.length === 0) return;

  console.log(`[Sync] ${due.length} user(s) due at ${currentHour}:${String(currentMinute).padStart(2,'0')} UTC`);

  // Run sequentially to avoid hammering RPC
  for (const user of due) {
    await syncUserContracts(user);
  }
}

export function startMonitoringBillingScheduler() {
  // Check every minute for users whose sync time has come
  setInterval(() => runScheduledSyncs().catch(console.error), 60 * 1000);
  console.log('✅ Continuous monitoring scheduler started (checks every minute)');
}
