/**
 * Backup Scheduler
 * Runs automated backups on schedule
 */

import BackupService from './BackupService.js';

class BackupScheduler {
  constructor() {
    this.intervals = {};
  }

  start() {
    console.log('🕐 Starting backup scheduler...');

    // Hourly backups
    this.intervals.hourly = setInterval(() => {
      BackupService.createBackup('hourly');
    }, 60 * 60 * 1000); // Every hour

    // Daily backups (at 2 AM)
    this.scheduleDailyBackup();

    // Weekly backups (Sunday at 3 AM)
    this.scheduleWeeklyBackup();

    // Monthly backups (1st of month at 4 AM)
    this.scheduleMonthlyBackup();

    // Cleanup old backups daily
    this.intervals.cleanup = setInterval(() => {
      BackupService.cleanupOldBackups();
    }, 24 * 60 * 60 * 1000); // Every 24 hours

    console.log('✅ Backup scheduler started');
    console.log('   - Hourly: Every hour');
    console.log('   - Daily: 2:00 AM');
    console.log('   - Weekly: Sunday 3:00 AM');
    console.log('   - Monthly: 1st of month 4:00 AM');
  }

  scheduleDailyBackup() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(2, 0, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    const delay = next - now;
    setTimeout(() => {
      BackupService.createBackup('daily');
      this.intervals.daily = setInterval(() => {
        BackupService.createBackup('daily');
      }, 24 * 60 * 60 * 1000);
    }, delay);
  }

  scheduleWeeklyBackup() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(3, 0, 0, 0);
    
    // Set to next Sunday
    const daysUntilSunday = (7 - now.getDay()) % 7;
    next.setDate(next.getDate() + daysUntilSunday);
    
    if (next <= now) {
      next.setDate(next.getDate() + 7);
    }

    const delay = next - now;
    setTimeout(() => {
      BackupService.createBackup('weekly');
      this.intervals.weekly = setInterval(() => {
        BackupService.createBackup('weekly');
      }, 7 * 24 * 60 * 60 * 1000);
    }, delay);
  }

  scheduleMonthlyBackup() {
    const now = new Date();
    const next = new Date(now);
    next.setDate(1);
    next.setHours(4, 0, 0, 0);
    
    if (next <= now) {
      next.setMonth(next.getMonth() + 1);
    }

    const delay = next - now;
    setTimeout(() => {
      BackupService.createBackup('monthly');
      this.scheduleMonthlyBackup(); // Reschedule for next month
    }, delay);
  }

  stop() {
    console.log('🛑 Stopping backup scheduler...');
    Object.values(this.intervals).forEach(interval => clearInterval(interval));
    this.intervals = {};
    console.log('✅ Backup scheduler stopped');
  }
}

export default new BackupScheduler();
