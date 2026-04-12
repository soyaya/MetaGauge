import AgentService from './AgentService.js';

const PROMPTS = {
  investor_summary: 'Generate an investor-ready traction summary. Use real metrics with benchmarks vs category averages. Be specific with numbers.',
  twitter_thread: 'Write a Twitter thread (5-7 tweets) about this contract milestone using real numbers. Return as a JSON array of tweet strings.',
  pitch_slide: 'Generate pitch deck slide data as JSON: { headline: string, bullets: string[], chart_data: { label, value }[] }. Use real metrics.',
};

export class TractionNarrator {
  static async generate(userId, type, { contractAddress, chain } = {}) {
    const prompt = PROMPTS[type];
    if (!prompt) throw new Error(`Unknown content type: ${type}`);

    const result = await AgentService.run(userId, prompt, {
      contractAddress,
      chain,
      source: 'marketing',
    });

    return {
      content: result.content,
      type,
      toolsUsed: result.toolsUsed,
      generatedAt: new Date().toISOString(),
    };
  }
}
