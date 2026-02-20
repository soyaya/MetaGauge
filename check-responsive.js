import { glob } from 'glob';
import { readFileSync } from 'fs';

console.log('🔍 Checking responsive design patterns...\n');

const files = await glob('frontend/**/*.{tsx,jsx}', { ignore: ['**/node_modules/**', '**/.next/**'] });

const issues = [];

for (const file of files) {
  const content = readFileSync(file, 'utf-8');
  
  // Check for responsive patterns
  const hasResponsive = 
    content.includes('sm:') || 
    content.includes('md:') || 
    content.includes('lg:') || 
    content.includes('xl:');
  
  const hasFixedWidth = content.match(/w-\[\d+px\]/g);
  const hasFixedHeight = content.match(/h-\[\d+px\]/g);
  const hasMinWidth = content.includes('min-w-');
  
  if (!hasResponsive && (hasFixedWidth || hasFixedHeight)) {
    issues.push({
      file: file.replace('frontend/', ''),
      reason: 'Fixed dimensions without responsive breakpoints'
    });
  }
}

if (issues.length > 0) {
  console.log('⚠️  Files needing responsive improvements:\n');
  issues.forEach(issue => {
    console.log(`   ${issue.file}`);
    console.log(`      → ${issue.reason}\n`);
  });
} else {
  console.log('✅ All files use responsive patterns');
}

console.log(`\n📊 Scanned ${files.length} files`);
