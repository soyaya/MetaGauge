import { glob } from 'glob';
import { readFileSync } from 'fs';

console.log('🔍 Checking for real responsive issues...\n');

const pages = await glob('frontend/app/**/page.tsx', { ignore: ['**/node_modules/**', '**/.next/**'] });

const issues = [];

for (const page of pages) {
  const content = readFileSync(page, 'utf-8');
  const pageName = page.replace('frontend/app/', '').replace('/page.tsx', '') || 'home';
  
  const pageIssues = [];
  
  // Check for fixed widths without responsive variants
  const fixedWidths = content.match(/className="[^"]*w-\[\d+px\][^"]*"/g);
  if (fixedWidths) {
    fixedWidths.forEach(match => {
      if (!match.includes('sm:') && !match.includes('md:') && !match.includes('lg:')) {
        pageIssues.push('Fixed width without breakpoints');
      }
    });
  }
  
  // Check for large text without responsive scaling
  const largeText = content.match(/text-(4xl|5xl|6xl)/g);
  if (largeText && !content.includes('sm:text-') && !content.includes('md:text-')) {
    pageIssues.push('Large text without responsive scaling');
  }
  
  // Check if page uses container
  const hasContainer = content.includes('container') || content.includes('max-w-');
  if (!hasContainer) {
    pageIssues.push('No container or max-width');
  }
  
  // Check for horizontal overflow risks
  const hasMinWidth = content.includes('min-w-[');
  if (hasMinWidth) {
    pageIssues.push('Has min-width that could cause overflow');
  }
  
  if (pageIssues.length > 0) {
    issues.push({ page: pageName, issues: [...new Set(pageIssues)] });
  }
}

if (issues.length === 0) {
  console.log('✅ No major responsive issues found!\n');
} else {
  console.log('⚠️  Pages with potential issues:\n');
  issues.forEach(({ page, issues }) => {
    console.log(`📄 ${page}`);
    issues.forEach(issue => console.log(`   - ${issue}`));
    console.log('');
  });
}

console.log(`\n📊 Summary: ${pages.length - issues.length}/${pages.length} pages look good`);
