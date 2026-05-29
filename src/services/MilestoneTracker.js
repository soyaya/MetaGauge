/**
 * MilestoneTracker
 * Detects newly crossed milestones after each analysis,
 * sends a congratulatory email with AI-generated next steps,
 * and stores which milestones have already been celebrated.
 */

import { MilestoneStorage, UserStorage } from '../api/database/index.js';
import { EmailAutomation } from './EmailAutomation.js';
import { EmailService } from './EmailService.js';

const emailService = new EmailService();

const MILESTONE_META = {
  '10_users':         { label: '10 Users',          next: 'Focus on activation — get each user to complete their first key action.' },
  '50_users':         { label: '50 Users',           next: 'Start tracking retention cohorts. Identify your best users and learn from them.' },
  '100_users':        { label: '100 Users',          next: 'Run a user quality audit — separate organic users from bots.' },
  '500_users':        { label: '500 Users',          next: 'Introduce referral mechanics. Your growth is ready to compound.' },
  '1000_users':       { label: '1,000 Users',        next: 'Segment your users by behavior. Build targeted re-engagement flows.' },
  '5000_users':       { label: '5,000 Users',        next: 'Consider competitive analysis — you\'re large enough to benchmark.' },
  '10000_users':      { label: '10,000 Users',       next: 'Scale infrastructure and explore institutional partnerships.' },
  'retention_40pct':  { label: '40% Retention',      next: 'You have product-market fit signals. Double down on what\'s working.' },
  'retention_60pct':  { label: '60% Retention',      next: 'Exceptional retention. Focus on monetisation and LTV expansion.' },
  'volume_1k_usd':    { label: '$1,000 Volume',      next: 'First revenue milestone. Analyse which features drive the most value.' },
  'volume_10k_usd':   { label: '$10,000 Volume',     next: 'Meaningful traction. Build a growth model and set a 90-day target.' },
};

export class MilestoneTracker {
  /**
   * Call after PatternProfileService.update().
   * Compares current milestones against already-celebrated ones,
   * fires emails for new ones.
   */
  static async check(userId, currentMilestones = []) {
    try {
      const already = await MilestoneStorage.getReached(userId);
      const newOnes = currentMilestones.filter(m => !already.includes(m));
      if (!newOnes.length) return;

      const user = await UserStorage.findById(userId);
      if (!user?.email) return;

      for (const milestone of newOnes) {
        await MilestoneStorage.markReached(userId, milestone);
        const meta = MILESTONE_META[milestone];
        if (!meta) continue;

        await emailService.sendAlert(user.email, {
          severity: 'low',
          title: `🎉 Milestone reached: ${meta.label}`,
          message: `Congratulations! Your contract just hit ${meta.label}.\n\n**Next step:** ${meta.next}`,
          contractId: user.onboarding?.defaultContract?.address || '',
          createdAt: new Date().toISOString(),
        });

        console.log(`🏆 Milestone email sent to ${user.email}: ${milestone}`);
      }
    } catch (err) {
      console.warn('[MilestoneTracker] check failed:', err.message);
    }
  }
}
