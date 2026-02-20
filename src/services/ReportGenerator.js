import fs from 'fs';
import path from 'path';

/**
 * Report Generator
 * 
 * Generates comprehensive analytics reports in multiple formats:
 * - JSON export with full data structure
 * - CSV export with flattened metrics
 * - Markdown export with formatted tables and summaries
 * - Report metadata (timestamp, contract info, time range)
 */
export class ReportGenerator {
  constructor() {
    this.reportVersion = '1.0.0';
  }

  /**
   * Generate full report from all analytics results
   * @param {Object} analyticsResults - Aggregated results from all analyzers
   * @param {Object} metadata - Report metadata
   * @returns {Object} Complete report structure
   */
  generateFullReport(analyticsResults, metadata = {}) {
    const report = {
      metadata: this._generateMetadata(metadata),
      summary: this._generateSummary(analyticsResults),
      analytics: analyticsResults
    };

    return report;
  }

  /**
   * Export report to JSON format
   * @param {Object} report - Complete report structure
   * @param {string} outputPath - Output file path (optional, will auto-generate if not provided)
   * @param {Object} contractInfo - Contract information for organized folder structure
   */
  exportToJson(report, outputPath = null, contractInfo = {}) {
    try {
      const finalPath = outputPath || this._generateOrganizedPath(contractInfo, 'json');
      const jsonContent = JSON.stringify(report, null, 2);
      this._ensureDirectoryExists(finalPath);
      fs.writeFileSync(finalPath, jsonContent, 'utf8');
      return { success: true, path: finalPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Export report to CSV format
   * @param {Object} report - Complete report structure
   * @param {string} outputPath - Output file path (optional, will auto-generate if not provided)
   * @param {Object} contractInfo - Contract information for organized folder structure
   */
  exportToCsv(report, outputPath = null, contractInfo = {}) {
    try {
      const finalPath = outputPath || this._generateOrganizedPath(contractInfo, 'csv');
      const flattenedData = this._flattenReportData(report);
      const csvContent = this._convertToCSV(flattenedData);
      
      this._ensureDirectoryExists(finalPath);
      fs.writeFileSync(finalPath, csvContent, 'utf8');
      return { success: true, path: finalPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Export report to Markdown format
   * @param {Object} report - Complete report structure
   * @param {string} outputPath - Output file path (optional, will auto-generate if not provided)
   * @param {Object} contractInfo - Contract information for organized folder structure
   */
  exportToMarkdown(report, outputPath = null, contractInfo = {}) {
    try {
      const finalPath = outputPath || this._generateOrganizedPath(contractInfo, 'md');
      const markdownContent = this._generateMarkdown(report);
      
      this._ensureDirectoryExists(finalPath);
      fs.writeFileSync(finalPath, markdownContent, 'utf8');
      return { success: true, path: finalPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate report metadata
   * @private
   */
  _generateMetadata(metadata) {
    return {
      reportVersion: this.reportVersion,
      generatedAt: new Date().toISOString(),
      contractAddress: metadata.contractAddress || 'unknown',
      contractChain: metadata.contractChain || 'unknown',
      timeRange: {
        from: metadata.timeRangeFrom || null,
        to: metadata.timeRangeTo || null
      },
      analysisParameters: metadata.analysisParameters || {}
    };
  }

  /**
   * Generate executive summary
   * @private
   */
  _generateSummary(analyticsResults) {
    const summary = {
      overview: {},
      keyMetrics: {},
      highlights: [],
      concerns: []
    };

    // Extract key metrics from each analyzer
    if (analyticsResults.userJourney) {
      summary.keyMetrics.totalUsers = analyticsResults.userJourney.totalUsers;
      summary.keyMetrics.averageJourneyLength = analyticsResults.userJourney.averageJourneyLength;
    }

    if (analyticsResults.retention) {
      summary.keyMetrics.retention30d = analyticsResults.retention.averageRetention?.day30 || 0;
    }

    if (analyticsResults.financial) {
      summary.keyMetrics.totalVolume = analyticsResults.financial.totalVolume;
    }

    if (analyticsResults.ux) {
      summary.keyMetrics.uxGrade = analyticsResults.ux.overallGrade;
    }

    // Identify highlights and concerns
    if (analyticsResults.swot) {
      summary.highlights = analyticsResults.swot.strengths?.slice(0, 3) || [];
      summary.concerns = analyticsResults.swot.weaknesses?.slice(0, 3) || [];
    }

    return summary;
  }

  /**
   * Flatten report data for CSV export
   * @private
   */
  _flattenReportData(report) {
    const flattened = [];

    // Add metadata row
    flattened.push({
      category: 'Metadata',
      metric: 'Report Version',
      value: report.metadata.reportVersion,
      timestamp: report.metadata.generatedAt
    });

    flattened.push({
      category: 'Metadata',
      metric: 'Contract Address',
      value: report.metadata.contractAddress,
      timestamp: report.metadata.generatedAt
    });

    // Add summary metrics
    for (const [key, value] of Object.entries(report.summary.keyMetrics || {})) {
      flattened.push({
        category: 'Summary',
        metric: key,
        value: typeof value === 'object' ? JSON.stringify(value) : value,
        timestamp: report.metadata.generatedAt
      });
    }

    // Add analytics data (simplified)
    if (report.analytics) {
      this._flattenObject(report.analytics, flattened, 'Analytics', report.metadata.generatedAt);
    }

    return flattened;
  }

  /**
   * Recursively flatten nested objects
   * @private
   */
  _flattenObject(obj, result, category, timestamp, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (value === null || value === undefined) {
        continue;
      }
      
      if (typeof value === 'object' && !Array.isArray(value)) {
        // Recursively flatten nested objects (limit depth)
        if (prefix.split('.').length < 2) {
          this._flattenObject(value, result, category, timestamp, fullKey);
        }
      } else if (Array.isArray(value)) {
        // For arrays, just store the length
        result.push({
          category,
          metric: fullKey,
          value: `Array(${value.length})`,
          timestamp
        });
      } else {
        result.push({
          category,
          metric: fullKey,
          value: value,
          timestamp
        });
      }
    }
  }

  /**
   * Convert flattened data to CSV format
   * @private
   */
  _convertToCSV(data) {
    if (data.length === 0) return '';

    // Get headers
    const headers = Object.keys(data[0]);
    const csvRows = [];

    // Add header row
    csvRows.push(headers.join(','));

    // Add data rows
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        // Escape commas and quotes
        const escaped = String(value).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * Generate Markdown report
   * @private
   */
  _generateMarkdown(report) {
    const sections = [];

    // Title and metadata
    sections.push('# Smart Contract Analytics Report\n');
    sections.push(`**Generated:** ${new Date(report.metadata.generatedAt).toLocaleString()}\n`);
    sections.push(`**Contract:** ${report.metadata.contractAddress}`);
    sections.push(`**Chain:** ${report.metadata.contractChain}\n`);

    // Executive Summary
    sections.push('## Executive Summary\n');
    sections.push('### Key Metrics\n');
    
    if (report.summary.keyMetrics) {
      for (const [key, value] of Object.entries(report.summary.keyMetrics)) {
        sections.push(`- **${this._formatLabel(key)}:** ${this._formatValue(value)}`);
      }
    }
    sections.push('');

    // Highlights
    if (report.summary.highlights && report.summary.highlights.length > 0) {
      sections.push('### Strengths\n');
      report.summary.highlights.forEach(highlight => {
        sections.push(`- ${highlight}`);
      });
      sections.push('');
    }

    // Concerns
    if (report.summary.concerns && report.summary.concerns.length > 0) {
      sections.push('### Areas for Improvement\n');
      report.summary.concerns.forEach(concern => {
        sections.push(`- ${concern}`);
      });
      sections.push('');
    }

    // Detailed Analytics
    sections.push('## Detailed Analytics\n');

    // User Journey
    if (report.analytics.userJourney) {
      sections.push('### User Journey Analysis\n');
      sections.push(`- Total Users: ${report.analytics.userJourney.totalUsers || 0}`);
      sections.push(`- Average Journey Length: ${report.analytics.userJourney.averageJourneyLength || 0}`);
      sections.push('');
    }

    // Retention
    if (report.analytics.retention) {
      sections.push('### Retention Metrics\n');
      if (report.analytics.retention.averageRetention) {
        sections.push(`- 7-Day Retention: ${(report.analytics.retention.averageRetention.day7 * 100).toFixed(1)}%`);
        sections.push(`- 30-Day Retention: ${(report.analytics.retention.averageRetention.day30 * 100).toFixed(1)}%`);
        sections.push(`- 90-Day Retention: ${(report.analytics.retention.averageRetention.day90 * 100).toFixed(1)}%`);
      }
      sections.push('');
    }

    // Financial
    if (report.analytics.financial) {
      sections.push('### Financial Metrics\n');
      sections.push(`- Total Volume: ${this._formatValue(report.analytics.financial.totalVolume)} ETH`);
      sections.push('');
    }

    // UX Grade
    if (report.analytics.ux) {
      sections.push('### UX Quality\n');
      sections.push(`- Overall Grade: **${report.analytics.ux.overallGrade || 'N/A'}**`);
      sections.push('');
    }

    // Footer
    sections.push('---');
    sections.push(`*Report generated by Startup Intelligence Analytics Engine v${report.metadata.reportVersion}*`);

    return sections.join('\n');
  }

  /**
   * Format label for display
   * @private
   */
  _formatLabel(key) {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Format value for display
   * @private
   */
  _formatValue(value) {
    if (typeof value === 'number') {
      if (value < 1 && value > 0) {
        return (value * 100).toFixed(2) + '%';
      }
      return value.toLocaleString();
    }
    return String(value);
  }

  /**
   * Generate organized folder path based on contract information
   * @private
   */
  _generateOrganizedPath(contractInfo, format) {
    const baseDir = './reports';
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const timeWithHour = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5); // YYYY-MM-DDTHH-MM-SS
    
    // Extract contract information
    const contractAddress = contractInfo.contractAddress || contractInfo.address || 'unknown';
    const contractName = contractInfo.contractName || contractInfo.name || this._extractContractName(contractAddress);
    const chain = contractInfo.contractChain || contractInfo.chain || 'unknown';
    
    // Create organized folder structure: reports/[contract-name]/[chain]/
    const contractFolder = this._sanitizeFolderName(contractName);
    const chainFolder = this._sanitizeFolderName(chain);
    
    const folderPath = path.join(baseDir, contractFolder, chainFolder);
    const fileName = `analysis_${timestamp}_${timeWithHour}.${format}`;
    
    return path.join(folderPath, fileName);
  }

  /**
   * Extract contract name from address (shortened version)
   * @private
   */
  _extractContractName(address) {
    if (!address || address === 'unknown') return 'unknown-contract';
    
    // Use first 8 and last 4 characters of address for readability
    if (address.length >= 12) {
      return `${address.slice(0, 8)}...${address.slice(-4)}`;
    }
    
    return address;
  }

  /**
   * Sanitize folder name to be filesystem-safe
   * @private
   */
  _sanitizeFolderName(name) {
    if (!name) return 'unknown';
    
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\-_.]/g, '-') // Replace invalid chars with dash
      .replace(/-+/g, '-')           // Replace multiple dashes with single
      .replace(/^-|-$/g, '');        // Remove leading/trailing dashes
  }

  /**
   * Export all report formats to organized folders
   * @param {Object} report - Complete report structure
   * @param {Object} contractInfo - Contract information for organized folder structure
   * @returns {Object} Results of all exports
   */
  exportAllFormats(report, contractInfo = {}) {
    const results = {
      json: this.exportToJson(report, null, contractInfo),
      csv: this.exportToCsv(report, null, contractInfo),
      markdown: this.exportToMarkdown(report, null, contractInfo)
    };

    // Create a summary file in the contract folder
    if (results.json.success) {
      this._createContractSummary(contractInfo, results);
    }

    return results;
  }

  /**
   * Create a summary file for the contract with links to all reports
   * @private
   */
  _createContractSummary(contractInfo, exportResults) {
    try {
      const contractAddress = contractInfo.contractAddress || contractInfo.address || 'unknown';
      let contractName = contractInfo.contractName || contractInfo.name || contractAddress || 'Unknown Contract';
      let chain = contractInfo.contractChain || contractInfo.chain || 'unknown';
      
      // Ensure all path components are valid strings
      if (!contractName || typeof contractName !== 'string') {
        console.warn('Invalid contract name for summary creation, using address');
        contractName = contractAddress || 'unknown-contract';
      }
      
      if (!chain || typeof chain !== 'string') {
        console.warn('Invalid chain for summary creation, using default');
        chain = 'unknown';
      }
      
      const contractFolder = this._sanitizeFolderName(contractName);
      const chainFolder = this._sanitizeFolderName(chain);
      
      // Validate that folder names are not empty
      if (!contractFolder || !chainFolder) {
        console.warn('Invalid folder names generated, skipping summary creation');
        console.warn(`Contract folder: "${contractFolder}", Chain folder: "${chainFolder}"`);
        return;
      }
      
      const summaryPath = path.join('./reports', contractFolder, chainFolder, 'README.md');
      
      console.log(`📝 Creating contract summary at: ${summaryPath}`);
      console.log(`   Contract: ${contractName}`);
      console.log(`   Chain: ${chain}`);
      console.log(`   Address: ${contractAddress}`);
      
      // Check if summary already exists and read it
      let existingContent = '';
      if (fs.existsSync(summaryPath)) {
        existingContent = fs.readFileSync(summaryPath, 'utf8');
      }

      const timestamp = new Date().toISOString();
      
      // Validate export results paths
      const jsonPath = exportResults?.json?.path ? path.basename(exportResults.json.path) : 'analysis.json';
      const csvPath = exportResults?.csv?.path ? path.basename(exportResults.csv.path) : 'analysis.csv';
      const markdownPath = exportResults?.markdown?.path ? path.basename(exportResults.markdown.path) : 'analysis.md';
      
      const newEntry = `
## Analysis Report - ${new Date().toLocaleDateString()}

**Generated:** ${timestamp}
**Files:**
- JSON: [${jsonPath}](./${jsonPath})
- CSV: [${csvPath}](./${csvPath})
- Markdown: [${markdownPath}](./${markdownPath})

---
`;

      let summaryContent;
      if (existingContent) {
        // Append to existing summary
        summaryContent = existingContent + newEntry;
      } else {
        // Create new summary
        summaryContent = `# ${contractName} Analysis Reports

**Contract Address:** \`${contractAddress}\`
**Blockchain:** ${chain.charAt(0).toUpperCase() + chain.slice(1)}

This folder contains all analysis reports for this smart contract, organized by date.

---
${newEntry}`;
      }

      this._ensureDirectoryExists(summaryPath);
      fs.writeFileSync(summaryPath, summaryContent, 'utf8');
      
      console.log(`📁 Contract summary updated: ${summaryPath}`);
    } catch (error) {
      console.warn(`Failed to create contract summary: ${error.message}`);
      console.warn(`Contract info:`, JSON.stringify(contractInfo, null, 2));
      console.warn(`Export results paths:`, {
        json: exportResults?.json?.path,
        csv: exportResults?.csv?.path,
        markdown: exportResults?.markdown?.path
      });
    }
  }

  /**
   * Get all reports for a specific contract
   * @param {string} contractName - Contract name or address
   * @param {string} chain - Blockchain network
   * @returns {Array} List of report files
   */
  getContractReports(contractName, chain = null) {
    const baseDir = './reports';
    const contractFolder = this._sanitizeFolderName(contractName);
    
    try {
      if (chain) {
        // Get reports for specific chain
        const chainFolder = this._sanitizeFolderName(chain);
        const contractChainPath = path.join(baseDir, contractFolder, chainFolder);
        
        if (fs.existsSync(contractChainPath)) {
          const files = fs.readdirSync(contractChainPath);
          return files
            .filter(file => file.startsWith('analysis_') && !file.endsWith('README.md'))
            .map(file => ({
              file,
              path: path.join(contractChainPath, file),
              chain,
              contract: contractName,
              timestamp: this._extractTimestampFromFilename(file)
            }));
        }
      } else {
        // Get reports for all chains
        const contractPath = path.join(baseDir, contractFolder);
        
        if (fs.existsSync(contractPath)) {
          const chains = fs.readdirSync(contractPath);
          const allReports = [];
          
          for (const chainDir of chains) {
            const chainPath = path.join(contractPath, chainDir);
            if (fs.statSync(chainPath).isDirectory()) {
              const files = fs.readdirSync(chainPath);
              const chainReports = files
                .filter(file => file.startsWith('analysis_') && !file.endsWith('README.md'))
                .map(file => ({
                  file,
                  path: path.join(chainPath, file),
                  chain: chainDir,
                  contract: contractName,
                  timestamp: this._extractTimestampFromFilename(file)
                }));
              allReports.push(...chainReports);
            }
          }
          
          return allReports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        }
      }
      
      return [];
    } catch (error) {
      console.error(`Error getting contract reports: ${error.message}`);
      return [];
    }
  }

  /**
   * Extract timestamp from filename
   * @private
   */
  _extractTimestampFromFilename(filename) {
    const match = filename.match(/analysis_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
    if (match) {
      return match[2].replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3') + 'Z';
    }
    return new Date().toISOString();
  }

  /**
   * List all analyzed contracts
   * @returns {Array} List of contracts with their report counts
   */
  listAllContracts() {
    const baseDir = './reports';
    
    try {
      if (!fs.existsSync(baseDir)) {
        return [];
      }
      
      const contracts = fs.readdirSync(baseDir);
      const contractList = [];
      
      for (const contractFolder of contracts) {
        const contractPath = path.join(baseDir, contractFolder);
        if (fs.statSync(contractPath).isDirectory()) {
          const chains = fs.readdirSync(contractPath);
          let totalReports = 0;
          const chainData = [];
          
          for (const chainFolder of chains) {
            const chainPath = path.join(contractPath, chainFolder);
            if (fs.statSync(chainPath).isDirectory()) {
              const files = fs.readdirSync(chainPath);
              const reportCount = files.filter(file => 
                file.startsWith('analysis_') && !file.endsWith('README.md')
              ).length;
              
              totalReports += reportCount;
              chainData.push({
                chain: chainFolder,
                reportCount
              });
            }
          }
          
          contractList.push({
            contract: contractFolder,
            totalReports,
            chains: chainData
          });
        }
      }
      
      return contractList.sort((a, b) => b.totalReports - a.totalReports);
    } catch (error) {
      console.error(`Error listing contracts: ${error.message}`);
      return [];
    }
  }

  /**
   * Ensure directory exists for output file
   * @private
   */
  _ensureDirectoryExists(filePath) {
    const directory = path.dirname(filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
  }
}

export default ReportGenerator;
