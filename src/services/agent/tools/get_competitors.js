export const schema = {
  name: 'get_competitors',
  description: 'Get indexed competitor contracts and their metrics for the user.',
  parameters: { type: 'object', properties: {}, required: [] },
};

export async function execute(userId) {
  try {
    const { CompetitorDataStorage } = await import('../../../api/database/index.js');
    const competitors = await CompetitorDataStorage.findByUserId(userId);
    return competitors.map(c => ({
      id: c.id, name: c.name, address: c.address, chain: c.chain,
      metrics: c.metrics, lastUpdated: c.lastUpdated,
    }));
  } catch {
    return [];
  }
}
