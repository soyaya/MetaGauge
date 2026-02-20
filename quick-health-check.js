#!/usr/bin/env node

import axios from 'axios';

console.log('Quick health check...');

axios.get('http://localhost:5000/health', { timeout: 5000 })
  .then(res => {
    console.log('✅ Backend responding:', res.data);
    process.exit(0);
  })
  .catch(err => {
    console.log('❌ Backend not responding:', err.code || err.message);
    process.exit(1);
  });
