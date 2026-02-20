#!/usr/bin/env node

/**
 * PostgreSQL Database Setup Script
 * Creates database, user, and grants permissions
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

const DB_NAME = process.env.POSTGRES_DB || 'metagauge';
const DB_USER = process.env.POSTGRES_USER || 'metagauge_user';
const DB_PASSWORD = process.env.POSTGRES_PASSWORD || 'metagauge_secure_password_2026';
const DB_HOST = process.env.POSTGRES_HOST || 'localhost';
const DB_PORT = parseInt(process.env.POSTGRES_PORT) || 5432;

async function setupDatabase() {
  console.log('🗄️  PostgreSQL Database Setup\n');
  console.log('═'.repeat(50));
  
  // Connect to postgres database (default)
  const client = new Client({
    host: DB_HOST,
    port: DB_PORT,
    database: 'postgres',
    user: 'postgres',
    password: process.env.POSTGRES_ADMIN_PASSWORD || 'postgres'
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL server\n');

    // Check if database exists
    const dbCheck = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [DB_NAME]
    );

    if (dbCheck.rows.length === 0) {
      // Create database
      console.log(`📦 Creating database: ${DB_NAME}`);
      await client.query(`CREATE DATABASE ${DB_NAME}`);
      console.log('✅ Database created\n');
    } else {
      console.log(`✅ Database already exists: ${DB_NAME}\n`);
    }

    // Check if user exists
    const userCheck = await client.query(
      `SELECT 1 FROM pg_roles WHERE rolname = $1`,
      [DB_USER]
    );

    if (userCheck.rows.length === 0) {
      // Create user
      console.log(`👤 Creating user: ${DB_USER}`);
      await client.query(
        `CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}'`
      );
      console.log('✅ User created\n');
    } else {
      console.log(`✅ User already exists: ${DB_USER}\n`);
    }

    // Grant privileges
    console.log('🔐 Granting privileges...');
    await client.query(`GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER}`);
    console.log('✅ Privileges granted\n');

    console.log('═'.repeat(50));
    console.log('✅ Database setup complete!\n');
    console.log('Connection details:');
    console.log(`   Host:     ${DB_HOST}`);
    console.log(`   Port:     ${DB_PORT}`);
    console.log(`   Database: ${DB_NAME}`);
    console.log(`   User:     ${DB_USER}`);
    console.log('\n📝 Next step: Run schema creation script');
    console.log('   node scripts/create-schema.js\n');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Make sure PostgreSQL is installed and running');
    console.error('   2. Check POSTGRES_ADMIN_PASSWORD in .env');
    console.error('   3. Verify postgres user has CREATE DATABASE permission');
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupDatabase();
