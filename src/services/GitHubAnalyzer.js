/**
 * GitHubAnalyzer
 * Analyzes a GitHub repository for developer activity signals.
 * Uses GitHub REST API v3 — only requires a token for higher rate limits.
 *
 * Produces:
 * - commitFrequency (last 30 / 90 days)
 * - contributorCount
 * - issueResolutionSpeed (avg days to close)
 * - openIssues / closedIssues
 * - lastCommitDaysAgo
 * - isAbandoned (no commits in 30 days)
 * - devHealthScore (0–100)
 */

import config from '../config/env.js';

const BASE = 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

async function ghFetch(path) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (GITHUB_TOKEN) headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
  const res = await fetch(`${BASE}${path}`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API ${path} → ${res.status}`);
  return res.json();
}

/**
 * Parse owner/repo from various GitHub URL formats.
 * e.g. https://github.com/uniswap/v3-core → { owner: 'uniswap', repo: 'v3-core' }
 */
function parseRepo(githubUrl) {
  if (!githubUrl) return null;
  const match = githubUrl.match(/github\.com\/([^/]+)\/([^/\s?#]+)/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

export class GitHubAnalyzer {
  /**
   * @param {string} githubUrl — e.g. https://github.com/owner/repo
   * @returns {object} GitHub metrics + devHealthScore
   */
  static async analyze(githubUrl) {
    const parsed = parseRepo(githubUrl);
    if (!parsed) {
      return { error: 'Invalid or missing GitHub URL', devHealthScore: 0 };
    }

    const { owner, repo } = parsed;

    // Fetch in parallel — repo info, commits (last 90 days), contributors, issues
    const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [repoData, commits90, contributors, issues] = await Promise.allSettled([
      ghFetch(`/repos/${owner}/${repo}`),
      ghFetch(`/repos/${owner}/${repo}/commits?since=${since90}&per_page=100`),
      ghFetch(`/repos/${owner}/${repo}/contributors?per_page=50`),
      ghFetch(`/repos/${owner}/${repo}/issues?state=closed&per_page=50&sort=updated`),
    ]);

    const r    = repoData.status     === 'fulfilled' ? repoData.value     : null;
    const c90  = commits90.status    === 'fulfilled' ? commits90.value    : [];
    const cont = contributors.status === 'fulfilled' ? contributors.value : [];
    const iss  = issues.status       === 'fulfilled' ? issues.value       : [];

    if (!r) return { error: `Repository ${owner}/${repo} not found`, devHealthScore: 0 };

    // Commits in last 30 days
    const commits30 = Array.isArray(c90)
      ? c90.filter(c => new Date(c.commit?.author?.date) >= new Date(since30))
      : [];

    // Last commit age
    const lastCommitDate = Array.isArray(c90) && c90.length > 0
      ? new Date(c90[0].commit?.author?.date)
      : null;
    const lastCommitDaysAgo = lastCommitDate
      ? Math.floor((Date.now() - lastCommitDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Issue resolution speed (avg days to close)
    let avgDaysToClose = null;
    if (Array.isArray(iss) && iss.length > 0) {
      const times = iss
        .filter(i => i.created_at && i.closed_at)
        .map(i => (new Date(i.closed_at) - new Date(i.created_at)) / (1000 * 60 * 60 * 24));
      if (times.length > 0) {
        avgDaysToClose = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      }
    }

    const metrics = {
      owner,
      repo,
      stars:              r.stargazers_count || 0,
      forks:              r.forks_count || 0,
      openIssues:         r.open_issues_count || 0,
      commits30d:         commits30.length,
      commits90d:         Array.isArray(c90) ? c90.length : 0,
      contributorCount:   Array.isArray(cont) ? cont.length : 0,
      lastCommitDaysAgo,
      avgDaysToClose,
      isAbandoned:        lastCommitDaysAgo !== null && lastCommitDaysAgo > 30,
      language:           r.language,
      createdAt:          r.created_at,
      updatedAt:          r.updated_at,
    };

    metrics.devHealthScore = computeDevHealthScore(metrics);

    return metrics;
  }
}

function computeDevHealthScore(m) {
  // Abandoned = 0
  if (m.isAbandoned) return 5;

  let score = 0;

  // Commit frequency (40 pts) — 10+ commits/30d = full marks
  score += Math.min(40, (m.commits30d / 10) * 40);

  // Contributor diversity (20 pts) — 5+ contributors = full marks
  score += Math.min(20, (m.contributorCount / 5) * 20);

  // Issue resolution speed (20 pts) — ≤7 days = full marks
  if (m.avgDaysToClose !== null) {
    score += m.avgDaysToClose <= 7  ? 20
           : m.avgDaysToClose <= 30 ? 10
           : 0;
  } else {
    score += 10; // no closed issues yet — neutral
  }

  // Recency (20 pts) — committed in last 7 days = full marks
  if (m.lastCommitDaysAgo !== null) {
    score += m.lastCommitDaysAgo <= 7  ? 20
           : m.lastCommitDaysAgo <= 14 ? 10
           : m.lastCommitDaysAgo <= 30 ? 5
           : 0;
  }

  return Math.round(Math.min(100, score));
}
