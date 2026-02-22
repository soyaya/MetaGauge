/**
 * Automated Backup Service
 * Handles scheduled backups of file-based storage with retention policy
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '../../data');
const BACKUP_DIR = join(__dirname, '../../backups');

// Retention policy (days)
const RETENTION = {
  hourly: 1,    // Keep hourly backups for 1 day
  daily: 7,     // Keep daily backups for 7 days
  weekly: 30,   // Keep weekly backups for 30 days
  monthly: 365  // Keep monthly backups for 1 year
};

class BackupService {
  constructor() {
    this.ensureBackupDir();
  }

  ensureBackupDir() {
    if (!existsSync(BACKUP_DIR)) {
      mkdirSync(BACKUP_DIR, { recursive: true });
    }
    ['hourly', 'daily', 'weekly', 'monthly'].forEach(type => {
      const dir = join(BACKUP_DIR, type);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });
  }

  async createBackup(type = 'manual') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup-${timestamp}`;
    const backupPath = join(BACKUP_DIR, type, backupName);

    console.log(`📦 Creating ${type} backup: ${backupName}`);

    try {
      // Create backup directory
      mkdirSync(backupPath, { recursive: true });

      // Backup all JSON files
      const files = ['users.json', 'contracts.json', 'analyses.json', 'chat_sessions.json', 'chat_messages.json'];
      
      for (const file of files) {
        const sourcePath = join(DATA_DIR, file);
        if (existsSync(sourcePath)) {
          const destPath = join(backupPath, file);
          const gzipPath = `${destPath}.gz`;

          // Copy and compress
          await pipeline(
            createReadStream(sourcePath),
            createGzip(),
            createWriteStream(gzipPath)
          );

          console.log(`   ✓ Backed up ${file}`);
        }
      }

      // Create metadata
      const metadata = {
        timestamp: new Date().toISOString(),
        type,
        files: files.filter(f => existsSync(join(DATA_DIR, f))),
        size: this.getDirectorySize(backupPath)
      };

      writeFileSync(
        join(backupPath, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
      );

      console.log(`✅ Backup complete: ${backupPath}`);
      return { success: true, path: backupPath, metadata };

    } catch (error) {
      console.error(`❌ Backup failed:`, error);
      return { success: false, error: error.message };
    }
  }

  async cleanupOldBackups() {
    console.log('🧹 Cleaning up old backups...');

    for (const [type, days] of Object.entries(RETENTION)) {
      const dir = join(BACKUP_DIR, type);
      if (!existsSync(dir)) continue;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const backups = readdirSync(dir);
      let removed = 0;

      for (const backup of backups) {
        const backupPath = join(dir, backup);
        const stats = statSync(backupPath);

        if (stats.isDirectory() && stats.mtime < cutoffDate) {
          this.removeDirectory(backupPath);
          removed++;
        }
      }

      if (removed > 0) {
        console.log(`   ✓ Removed ${removed} old ${type} backups`);
      }
    }

    console.log('✅ Cleanup complete');
  }

  removeDirectory(dir) {
    if (existsSync(dir)) {
      readdirSync(dir).forEach(file => {
        const filePath = join(dir, file);
        if (statSync(filePath).isDirectory()) {
          this.removeDirectory(filePath);
        } else {
          unlinkSync(filePath);
        }
      });
      unlinkSync(dir);
    }
  }

  getDirectorySize(dir) {
    let size = 0;
    if (existsSync(dir)) {
      readdirSync(dir).forEach(file => {
        const filePath = join(dir, file);
        const stats = statSync(filePath);
        if (stats.isFile()) {
          size += stats.size;
        } else if (stats.isDirectory()) {
          size += this.getDirectorySize(filePath);
        }
      });
    }
    return size;
  }

  async listBackups() {
    const backups = {};

    for (const type of ['hourly', 'daily', 'weekly', 'monthly', 'manual']) {
      const dir = join(BACKUP_DIR, type);
      if (!existsSync(dir)) continue;

      backups[type] = readdirSync(dir)
        .filter(name => name.startsWith('backup-'))
        .map(name => {
          const backupPath = join(dir, name);
          const metadataPath = join(backupPath, 'metadata.json');
          
          let metadata = null;
          if (existsSync(metadataPath)) {
            metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
          }

          return {
            name,
            path: backupPath,
            created: statSync(backupPath).mtime,
            size: this.getDirectorySize(backupPath),
            metadata
          };
        })
        .sort((a, b) => b.created - a.created);
    }

    return backups;
  }

  async restore(backupPath) {
    console.log(`🔄 Restoring from backup: ${backupPath}`);

    if (!existsSync(backupPath)) {
      throw new Error('Backup not found');
    }

    try {
      const files = readdirSync(backupPath).filter(f => f.endsWith('.json.gz'));

      for (const file of files) {
        const sourcePath = join(backupPath, file);
        const destFile = file.replace('.gz', '');
        const destPath = join(DATA_DIR, destFile);

        // Decompress and restore
        await pipeline(
          createReadStream(sourcePath),
          createGzip({ level: 9 }),
          createWriteStream(destPath)
        );

        console.log(`   ✓ Restored ${destFile}`);
      }

      console.log('✅ Restore complete');
      return { success: true };

    } catch (error) {
      console.error('❌ Restore failed:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new BackupService();
