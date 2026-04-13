#!/usr/bin/env node

/**
 * Quick fix for traction routes - add fallback data
 */

import fs from 'fs';

console.log('🔧 Adding fallback data to traction routes...');

// Read the traction routes file
const tractionFile = '/mnt/c/pr0/meta/mvp-workspace/src/api/routes/traction.js';
let content = fs.readFileSync(tractionFile, 'utf8');

// Add fallback for metrics route
const metricsFixBefore = `router.get('/metrics', async (req, res) => {
  try {
    const built = await buildFR(req.user.id);
    if (!built) return res.status(404).json({ error: 'No analysis found' });`;

const metricsFixAfter = `router.get('/metrics', async (req, res) => {
  try {
    const built = await buildFR(req.user.id);
    if (!built) {
      // Return empty metrics instead of 404
      return res.json({
        retention: { rate: 0, cohorts: [] },
        activation: { rate: 0, funnel: [] },
        gas: { efficiency: 0, trends: [] },
        quality: { score: 0, segments: [] }
      });
    }`;

// Add fallback for tasks route  
const tasksFixBefore = `router.get('/tasks', async (req, res) => {
  try {
    const built = await buildFR(req.user.id);
    if (!built) return res.status(404).json({ error: 'No analysis found' });`;

const tasksFixAfter = `router.get('/tasks', async (req, res) => {
  try {
    const built = await buildFR(req.user.id);
    if (!built) {
      // Return empty tasks instead of 404
      return res.json([]);
    }`;

// Apply fixes
if (content.includes(metricsFixBefore)) {
  content = content.replace(metricsFixBefore, metricsFixAfter);
  console.log('✅ Fixed metrics route');
}

if (content.includes(tasksFixBefore)) {
  content = content.replace(tasksFixBefore, tasksFixAfter);
  console.log('✅ Fixed tasks route');
}

// Write back
fs.writeFileSync(tractionFile, content);
console.log('✅ Traction routes fixed - restart server to apply changes');
