/**
 * Metrics Context Service
 * Provides metric definitions and context for AI responses
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MetricsContextService {
  constructor() {
    this.glossary = {};
    this.loadGlossary();
  }

  loadGlossary() {
    try {
      const glossaryPath = path.join(process.cwd(), 'docs', 'METRICS_GLOSSARY.md');
      const content = fs.readFileSync(glossaryPath, 'utf-8');
      this.glossary = this.parseGlossary(content);
      console.log(`✅ Loaded ${Object.keys(this.glossary).length} metric definitions`);
    } catch (error) {
      console.warn('⚠️  Could not load metrics glossary:', error.message);
    }
  }

  parseGlossary(content) {
    const metrics = {};
    const sections = content.split('###').slice(1);
    
    sections.forEach(section => {
      const lines = section.trim().split('\n');
      const name = lines[0].trim();
      
      const metric = {
        name,
        definition: '',
        formula: '',
        goodRange: '',
        badRange: '',
        interpretation: ''
      };
      
      lines.forEach(line => {
        if (line.includes('**Definition:**')) {
          metric.definition = line.split('**Definition:**')[1].trim();
        } else if (line.includes('**Formula:**')) {
          metric.formula = line.split('**Formula:**')[1].trim();
        } else if (line.includes('**Good Range:**')) {
          metric.goodRange = line.split('**Good Range:**')[1].trim();
        } else if (line.includes('**Bad Range:**')) {
          metric.badRange = line.split('**Bad Range:**')[1].trim();
        } else if (line.includes('**Interpretation:**')) {
          metric.interpretation = line.split('**Interpretation:**')[1].trim();
        }
      });
      
      // Store by lowercase key for easy lookup
      const key = name.toLowerCase().replace(/[()]/g, '').trim();
      metrics[key] = metric;
    });
    
    return metrics;
  }

  getMetricDefinition(metricName) {
    const key = metricName.toLowerCase().replace(/[()]/g, '').trim();
    return this.glossary[key] || null;
  }

  getContextForAI(metrics) {
    if (!metrics || Object.keys(metrics).length === 0) {
      return '';
    }

    let context = '\n\n## Metrics Context\n\n';
    context += 'When discussing these metrics, use the following definitions:\n\n';
    
    Object.keys(metrics).forEach(key => {
      const definition = this.getMetricDefinition(key);
      if (definition) {
        context += `**${definition.name}**: ${definition.definition}\n`;
        context += `- Good: ${definition.goodRange}\n`;
        context += `- Bad: ${definition.badRange}\n`;
        context += `- Meaning: ${definition.interpretation}\n\n`;
      }
    });
    
    return context;
  }

  getAllDefinitions() {
    return this.glossary;
  }

  searchMetrics(query) {
    const results = [];
    const searchTerm = query.toLowerCase();
    
    Object.values(this.glossary).forEach(metric => {
      if (
        metric.name.toLowerCase().includes(searchTerm) ||
        metric.definition.toLowerCase().includes(searchTerm) ||
        metric.interpretation.toLowerCase().includes(searchTerm)
      ) {
        results.push(metric);
      }
    });
    
    return results;
  }
}

// Export singleton instance
export default new MetricsContextService();
