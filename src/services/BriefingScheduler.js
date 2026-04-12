/**
 * BriefingScheduler - Daily, weekly, monthly briefings using real data + AgentService
 */

export class BriefingScheduler {
  async _generate(userId, type, prompt) {
    try {
      const { default: AgentService } = await import('./AgentService.js');
      const { UserStorage, BriefingsStorage } = await import('../api/database/index.js');
      const user = await UserStorage.findById(userId);
      const contract = user?.onboarding?.defaultContract;
      const result = await AgentService.run(userId, prompt, { contractAddress: contract?.address||'', chain: contract?.chain||'ethereum', source: 'briefing' });
      const briefing = {
        id: `${type}-${Date.now()}`,
        userId, type,
        title: type==='daily' ? `Daily Brief — ${new Date().toDateString()}` : type==='weekly' ? `Weekly Strategy — ${new Date().toDateString()}` : `Monthly Summary — ${new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'})}`,
        content: result.content,
        createdAt: new Date().toISOString(),
      };
      await BriefingsStorage.append(briefing);
      return briefing;
    } catch (err) {
      console.error(`[BriefingScheduler] ${type} failed:`, err.message);
      return null;
    }
  }

  async generateDailyBrief(userId) {
    const metrics = await this._getMetrics(userId);
    const competitors = await this._getCompetitors(userId);
    return this._generate(userId, 'daily',
      `Generate a concise daily brief for ${new Date().toDateString()}. Use get_metrics and get_business_intelligence tools. Include: 1) Key metric summary with real numbers, 2) One urgent action item, 3) Any competitor movements. Metrics context: ${JSON.stringify(metrics).slice(0, 300)}`
    );
  }

  async generateWeeklyStrategy(userId) {
    const history = await this._getHistory(userId);
    return this._generate(userId, 'weekly',
      `Generate a weekly strategy brief. Use get_metrics, get_history, and get_business_intelligence tools. Include: 1) Week-over-week performance, 2) Top 3 growth opportunities, 3) Recommended focus for next week. History context: ${JSON.stringify(history).slice(0, 300)}`
    );
  }

  async generateMonthlyBoardSummary(userId) {
    return this._generate(userId, 'monthly',
      `Generate an investor-ready monthly board summary. Use get_metrics, get_competitors, and get_market_context tools. Include: 1) Key metrics vs last month, 2) Market position, 3) Risks and opportunities, 4) 90-day outlook.`
    );
  }

  async _getMetrics(userId) {
    try {
      const { AnalysisStorage } = await import('../api/database/index.js');
      const a = await AnalysisStorage.findByUserId(userId);
      const latest = a.find(x => x.status === 'completed');
      return latest?.results?.target?.metrics || {};
    } catch { return {}; }
  }

  async _getCompetitors(userId) {
    try {
      const { readdir, readFile } = await import('fs/promises');
      const { resolve, join } = await import('path');
      const dir = resolve(`./data/users/${userId}/competitors`);
      const files = await readdir(dir).catch(() => []);
      return (await Promise.all(files.filter(f => f.endsWith('.json')).map(async f => {
        try { return JSON.parse(await readFile(join(dir, f), 'utf8')); } catch { return null; }
      }))).filter(Boolean);
    } catch { return []; }
  }

  async _getHistory(userId) {
    try {
      const { MetricsHistoryStorage } = await import('../api/database/index.js');
      return await MetricsHistoryStorage.get(userId).catch(() => []);
    } catch { return []; }
  }
}
