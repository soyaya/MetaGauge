/**
 * Migration: Add walletAddress field to user schema
 * Issue #36 - Missing Database Schema for Wallet Address
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const USERS_FILE = join(__dirname, '../data/users.json');

async function migrateUsers() {
  console.log('🔄 Starting user schema migration...');
  
  try {
    // Read existing users
    const usersData = readFileSync(USERS_FILE, 'utf8');
    const users = JSON.parse(usersData);
    
    console.log(`📊 Found ${users.length} users to migrate`);
    
    let migratedCount = 0;
    
    // Add walletAddress field if missing
    const updatedUsers = users.map(user => {
      if (!user.walletAddress) {
        migratedCount++;
        return {
          ...user,
          walletAddress: null, // Will be set when user connects wallet
          updatedAt: new Date().toISOString()
        };
      }
      return user;
    });
    
    // Write back to file
    writeFileSync(USERS_FILE, JSON.stringify(updatedUsers, null, 2), 'utf8');
    
    console.log(`✅ Migration complete!`);
    console.log(`   - Total users: ${users.length}`);
    console.log(`   - Migrated: ${migratedCount}`);
    console.log(`   - Already had walletAddress: ${users.length - migratedCount}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateUsers();
