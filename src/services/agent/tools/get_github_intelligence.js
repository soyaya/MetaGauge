import { GitHubAnalyzer } from '../../GitHubAnalyzer.js';

export const schema = {
  name: 'get_github_intelligence',
  description: 'Analyze a GitHub repository for developer activity: commit frequency, contributor count, issue resolution speed, dev health score, abandonment detection. Call this when asked about developer activity, team health, or project development status.',
  parameters: {
    type: 'object',
    properties: {
      githubUrl: { type: 'string', description: 'GitHub repository URL e.g. https://github.com/owner/repo' },
    },
    required: ['githubUrl'],
  },
};

export async function execute(userId, args = {}) {
  if (!args.githubUrl) return { error: 'githubUrl is required' };
  return GitHubAnalyzer.analyze(args.githubUrl);
}
