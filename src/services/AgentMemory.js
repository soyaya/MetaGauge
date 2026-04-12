async function db() { return import('../api/database/index.js'); }

export class AgentMemory {
  static async update(userId, { insight, preference, contractSummary }) {
    const { AgentMemoryStorage } = await db();
    const mem = await AgentMemoryStorage.read(userId);
    if (insight)         mem.insights     = [...(mem.insights||[]), insight].slice(-20);
    if (preference)      mem.preferences  = [...(mem.preferences||[]), preference].slice(-10);
    if (contractSummary) mem.contractSummary = contractSummary;
    await AgentMemoryStorage.write(userId, mem);
  }

  static async buildContext(userId) {
    const { AgentMemoryStorage } = await db();
    return AgentMemoryStorage.buildContext(userId);
  }

  static async saveInsight(userId, insight) {
    const { AgentMemoryStorage } = await db();
    const mem = await AgentMemoryStorage.read(userId);
    mem.insights = [...(mem.insights||[]), insight].slice(-20);
    await AgentMemoryStorage.write(userId, mem);
  }

  static async saveContractSummary(userId, summary) {
    const { AgentMemoryStorage } = await db();
    const mem = await AgentMemoryStorage.read(userId);
    mem.contractSummary = summary;
    await AgentMemoryStorage.write(userId, mem);
  }

  static async saveResolvedIssue(userId, issue) {
    const { AgentMemoryStorage } = await db();
    const mem = await AgentMemoryStorage.read(userId);
    mem.resolvedIssues = [...(mem.resolvedIssues||[]), issue].slice(-20);
    await AgentMemoryStorage.write(userId, mem);
  }
}
