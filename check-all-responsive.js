import { glob } from 'glob';
import { readFileSync } from 'fs';

console.log('🔍 Checking responsive design across all pages...\n');

const pages = await glob('frontend/app/**/page.tsx', { ignore: ['**/node_modules/**', '**/.next/**'] });

const results = [];

for (const page of pages) {
  const content = readFileSync(page, 'utf-8');
  const pageName = page.replace('frontend/app/', '').replace('/page.tsx', '') || 'home';
  
  const checks = {
    hasResponsiveGrid: /grid-cols-\d+\s+(sm|md|lg|xl):grid-cols-\d+/.test(content),
    hasResponsiveText: /(text-\w+\s+(sm|md|lg|xl):text-\w+)/.test(content),
    hasResponsiveFlex: /(flex-col\s+(sm|md|lg|xl):flex-row|flex-row\s+(sm|md|lg|xl):flex-col)/.test(content),
    hasContainer: /container/.test(content),
    hasResponsivePadding: /(px-\d+\s+(sm|md|lg|xl):px-\d+|py-\d+\s+(sm|md|lg|xl):py-\d+)/.test(content),
    hasHiddenBreakpoints: /(hidden\s+(sm|md|lg|xl):(block|flex|inline))/.test(content),
    hasFixedWidth: /w-\[\d+px\]/.test(content) && !/sm:|md:|lg:|xl:/.test(content),
  };
  
  const score = Object.values(checks).filter(v => v === true).length - (checks.hasFixedWidth ? 1 : 0);
  const maxScore = 6;
  const percentage = Math.round((score / maxScore) * 100);
  
  results.push({
    page: pageName,
    score,
    percentage,
    checks,
    status: percentage >= 70 ? '✅' : percentage >= 40 ? '⚠️' : '❌'
  });
}

// Sort by score
results.sort((a, b) => b.score - a.score);

console.log('📊 Responsive Design Report\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

results.forEach(r => {
  console.log(`${r.status} ${r.page.padEnd(30)} ${r.percentage}%`);
  if (r.percentage < 70) {
    console.log(`   Missing:`);
    if (!r.checks.hasResponsiveGrid) console.log(`   - Responsive grid`);
    if (!r.checks.hasResponsiveText) console.log(`   - Responsive text`);
    if (!r.checks.hasResponsiveFlex) console.log(`   - Responsive flex`);
    if (!r.checks.hasContainer) console.log(`   - Container`);
    if (!r.checks.hasResponsivePadding) console.log(`   - Responsive padding`);
    if (!r.checks.hasHiddenBreakpoints) console.log(`   - Hidden breakpoints`);
    if (r.checks.hasFixedWidth) console.log(`   - Has fixed widths`);
  }
});

const avgScore = Math.round(results.reduce((sum, r) => sum + r.percentage, 0) / results.length);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`\n📈 Overall Score: ${avgScore}%`);
console.log(`✅ Fully Responsive: ${results.filter(r => r.percentage >= 70).length}/${results.length}`);
console.log(`⚠️  Needs Work: ${results.filter(r => r.percentage < 70 && r.percentage >= 40).length}/${results.length}`);
console.log(`❌ Not Responsive: ${results.filter(r => r.percentage < 40).length}/${results.length}`);
