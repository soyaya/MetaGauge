/**
 * TractionPDFGenerator
 * Generates a well-formatted investor-ready PDF using pdfkit
 */
import PDFDocument from 'pdfkit';

const BLUE   = '#2563EB';
const DARK   = '#111827';
const MUTED  = '#6B7280';
const GREEN  = '#16A34A';
const RED    = '#DC2626';
const YELLOW = '#D97706';
const LIGHT  = '#F9FAFB';
const BORDER = '#E5E7EB';

function statusColor(status) {
  if (status === 'green' || status === 'Good') return GREEN;
  if (status === 'red'   || status === 'High' || status === 'Has failures') return RED;
  return YELLOW;
}

function opsColor(grade) {
  return grade === 'green' ? GREEN : grade === 'yellow' ? YELLOW : RED;
}

export async function generateTractionPDF({ user, contract, ops, tasks, growth, retentionMetrics: ret, activationMetrics: act, gasAnalysis: gas, userQuality: qual, defiMetrics: dm, summary: sum, featureInsights, labels, sections, users = [] }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 100; // usable width
    const date = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });

    // ── Cover / Header ──────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 120).fill(BLUE);
    doc.fillColor('white').fontSize(22).font('Helvetica-Bold')
      .text('MetaGauge', 50, 30);
    doc.fontSize(11).font('Helvetica')
      .text('Traction & Insights Report', 50, 58);
    doc.fontSize(9).fillColor('rgba(255,255,255,0.8)')
      .text(`Generated ${date}`, 50, 78);

    // Contract + user info box
    doc.fillColor(DARK).rect(50, 130, W, 70).stroke(BORDER);
    doc.fontSize(14).font('Helvetica-Bold').fillColor(DARK)
      .text(contract.name, 65, 142);
    doc.fontSize(9).font('Helvetica').fillColor(MUTED)
      .text(`Contract: ${contract.address}`, 65, 160)
      .text(`Chain: ${contract.chain}   ·   Owner: ${user.name}   ·   ${user.email}`, 65, 174);

    // Investor labels
    if (labels?.length) {
      let lx = 65;
      doc.y = 215;
      labels.forEach(l => {
        const lw = doc.widthOfString(l.label) + 16;
        doc.roundedRect(lx, 215, lw, 16, 4).fill(BLUE);
        doc.fillColor('white').fontSize(8).text(`⭐ ${l.label}`, lx + 6, 219);
        lx += lw + 8;
      });
    }

    doc.y = 250;

    // ── Helper functions ────────────────────────────────────────────────────
    const sectionTitle = (title) => {
      doc.addPage();
      doc.rect(0, 0, doc.page.width, 50).fill(BLUE);
      doc.fillColor('white').fontSize(16).font('Helvetica-Bold').text(title, 50, 16);
      doc.y = 70;
    };

    const row = (label, value, status = null, target = null) => {
      if (doc.y > 720) doc.addPage();
      const y = doc.y;
      doc.rect(50, y, W, 22).fill(doc.y % 44 < 22 ? LIGHT : 'white');
      doc.fillColor(MUTED).fontSize(9).font('Helvetica').text(label, 58, y + 6);
      const col = status ? statusColor(status) : DARK;
      doc.fillColor(col).font('Helvetica-Bold').text(String(value), 280, y + 6);
      if (target) doc.fillColor(MUTED).font('Helvetica').text(`Target: ${target}`, 380, y + 6);
      if (status) {
        const sw = doc.widthOfString(status) + 12;
        doc.roundedRect(W - sw + 20, y + 4, sw, 14, 3).fill(statusColor(status));
        doc.fillColor('white').fontSize(7).text(status, W - sw + 26, y + 7);
      }
      doc.y = y + 24;
    };

    const subheading = (text) => {
      if (doc.y > 720) doc.addPage();
      doc.y += 8;
      doc.fillColor(DARK).fontSize(11).font('Helvetica-Bold').text(text, 50);
      doc.moveTo(50, doc.y + 2).lineTo(50 + W, doc.y + 2).stroke(BORDER);
      doc.y += 8;
    };

    // ── OPS Score ───────────────────────────────────────────────────────────
    if (sections.includes('productivity')) {
      sectionTitle('Operational Productivity Score (OPS)');
      const oc = opsColor(ops.grade);

      // Big score circle (simulated with rect)
      doc.roundedRect(50, doc.y, 120, 80, 8).fill(oc);
      doc.fillColor('white').fontSize(36).font('Helvetica-Bold').text(String(ops.total), 72, doc.y + 12);
      doc.fontSize(11).text('/100', 100, doc.y + 50);
      const scoreY = doc.y;
      doc.fillColor(DARK).fontSize(10).font('Helvetica').text(ops.label, 185, scoreY + 10);
      doc.fontSize(9).fillColor(MUTED).text('Operational health score based on 5 pillars', 185, scoreY + 26);
      doc.y = scoreY + 100;

      subheading('Pillar Breakdown');
      const pillarLabels = {
        featureStability:'Feature Stability (25%)', responseToAlerts:'Alert Response (25%)',
        resolutionEfficiency:'Resolution Efficiency (20%)', taskCompletion:'Task Completion (15%)', hygiene:'Hygiene (15%)'
      };
      Object.entries(ops.pillars).forEach(([k, v]) => {
        const s = v >= 75 ? 'green' : v >= 50 ? 'yellow' : 'red';
        row(pillarLabels[k], `${v}/100`, s === 'green' ? 'Good' : s === 'yellow' ? 'Moderate' : 'Needs Work');
      });
    }

    // ── Growth ──────────────────────────────────────────────────────────────
    if (sections.includes('growth')) {
      sectionTitle('Growth Metrics');
      subheading('User Growth');
      row('Total Users',      sum?.uniqueUsers||0);
      row('New Users',        growth.newUsers);
      row('Returning Users',  growth.returningUsers);
      row('Daily Active (DAU)', dm?.dau||0, (dm?.dau||0)>=10?'Good':'Below target', 10);
      row('Weekly Active (WAU)', dm?.wau||0, (dm?.wau||0)>=5?'Good':'Below target', 5);
      row('Monthly Active (MAU)', dm?.mau||0);
      subheading('Transaction Volume');
      row('Total Transactions', sum?.totalTransactions||0, (sum?.totalTransactions||0)>=100?'Good':'Below target', 100);
      row('Activation Rate',  `${act?.activationRate||0}%`, (act?.activationRate||0)>=50?'Good':'Below target', '50%');
      row('Bounce Rate',      `${dm?.bounceRate||0}%`, (dm?.bounceRate||0)<=30?'Good':'High', '<30%');
      row('Avg Time to Activation', act?.avgTimeToActivation||'N/A');
      row('Avg Session Duration',   dm?.avgSessionDuration||'N/A');
    }

    // ── Retention ───────────────────────────────────────────────────────────
    if (sections.includes('retention')) {
      sectionTitle('Retention Metrics');
      row('D1 Retention',      `${ret?.d1Retention||0}%`,  (ret?.d1Retention||0)>=20?'Good':'Below target', '20%');
      row('D7 Retention',      `${ret?.d7Retention||0}%`,  (ret?.d7Retention||0)>=15?'Good':'Below target', '15%');
      row('D30 Retention',     `${ret?.d30Retention||0}%`, (ret?.d30Retention||0)>=10?'Good':'Below target', '10%');
      row('Churn Rate',        `${ret?.churnRate||0}%`,    (ret?.churnRate||0)<=25?'Good':'High',            '<25%');
      row('Resurrection Rate', `${ret?.resurrectionRate||0}%`, (ret?.resurrectionRate||0)>=10?'Good':'Below target', '10%');
      row('Overall Retention', `${ret?.retentionRate||0}%`, (ret?.retentionRate||0)>=40?'Good':'Below target', '40%');

      // Activation funnel
      if (growth.activationFunnel?.length) {
        subheading('Activation Funnel');
        growth.activationFunnel.forEach(step => {
          row(step.step, `${step.users} users`, null, null);
          const bw = Math.max(4, ((step.pct||0) / 100) * (W - 200));
          doc.rect(280, doc.y - 18, bw, 8).fill(BLUE);
          doc.fillColor(MUTED).fontSize(8).text(`${step.pct}%`, 280 + bw + 4, doc.y - 18);
        });
      }
    }

    // ── Transactions ────────────────────────────────────────────────────────
    if (sections.includes('transactions')) {
      sectionTitle('Transaction Volume & Gas');
      subheading('Volume');
      row('Total Transactions', sum?.totalTransactions||0);
      row('Unique Users',       sum?.uniqueUsers||0);
      row('Success Rate',       `${sum?.successRate||0}%`, (Number(sum?.successRate)||0)>=95?'Good':'Below target', '95%');
      row('Failed Transactions', gas?.failedTransactions||0, (gas?.failedTransactions||0)===0?'Good':'Has failures', '0');
      row('Failure Rate',       `${gas?.failureRate||0}%`, (gas?.failureRate||0)===0?'Good':'Has failures');
      subheading('Gas Cost');
      row('Avg Gas Price',      gas?.averageGasPrice||'N/A');
      row('Avg Gas Used (units)', (gas?.averageGasUsed||0).toLocaleString());
      row('Avg Gas Cost (USD)',  `$${gas?.averageGasCostUSD||0}`, (gas?.averageGasCostUSD||0)<=0.5?'Good':'High', '$0.50');
      row('Total Gas Cost (USD)', `$${gas?.totalGasCostUSD||0}`);
      row('Gas Efficiency',     `${gas?.gasEfficiencyScore||0}%`, (gas?.gasEfficiencyScore||0)>=90?'Good':'Below target', '90%');
    }

    // ── Activation ──────────────────────────────────────────────────────────
    if (sections.includes('activation')) {
      sectionTitle('Activation & Onboarding');
      row('Activation Rate',         `${act?.activationRate||0}%`,  (act?.activationRate||0)>=50?'Good':'Below target', '50%');
      row('Bounce Rate',             `${dm?.bounceRate||0}%`,        (dm?.bounceRate||0)<=30?'Good':'High', '<30%');
      row('Time to Activation',      act?.avgTimeToActivation||'N/A');
      row('Time to Value',           act?.timeToValue||'N/A');
      row('Avg Session Duration',    dm?.avgSessionDuration||'N/A');
      row('Gas Cost to Activate',    `$${act?.avgGasToActivateUSD||0}`, (act?.avgGasToActivateUSD||0)<=1?'Good':'High', '$1.00');
      row('ETH Cost to Activate',    `${act?.avgGasToActivateETH||0} ETH`);

      if (growth.activationFunnel?.length) {
        subheading('Activation Funnel');
        growth.activationFunnel.forEach(step => {
          row(step.step, `${step.users} users (${step.pct}%)`);
          const bw = Math.max(4, ((step.pct||0) / 100) * (W - 200));
          doc.rect(280, doc.y - 18, bw, 8).fill(BLUE);
          doc.fillColor(MUTED).fontSize(8).text(`${step.pct}%`, 280 + bw + 4, doc.y - 18);
        });
      }
    }

    // ── User Quality ────────────────────────────────────────────────────────
    if (sections.includes('quality')) {
      sectionTitle('User Quality & Behaviour');
      subheading('Quality Scores');
      row('Wallet Quality Score',  `${qual?.avgWalletQuality||0}/100`,  (qual?.avgWalletQuality||0)>=65?'Good':'Below target', '65/100');
      row('Power User Rate',       `${qual?.powerUserRate||0}%`,         (qual?.powerUserRate||0)>=15?'Good':'Below target', '15%');
      row('Bot Activity',          `${qual?.botPct||0}%`,                (qual?.botPct||0)<=5?'Good':'High', '<5%');
      row('Avg Sophistication',    `${qual?.avgSophistication||0} functions/user`);
      subheading('Behaviour');
      row('Loyalty Score',         `${dm?.loyaltyScore||0}%`);
      row('Whale Ratio',           `${dm?.whaleRatio||0}%`);
      row('Protocol Stickiness',   `${dm?.protocolStickiness||0}%`);
      row('Interaction Complexity', dm?.interactionComplexity||'N/A');
      row('Contract Utilization',  dm?.contractUtilization||0);
    }

    // ── Feature Adoption ────────────────────────────────────────────────────
    if (sections.includes('features') && featureInsights?.length) {
      sectionTitle('Feature Adoption');
      subheading('First Interactions by Users');
      featureInsights.forEach(f => {
        row(f.feature, `${f.count} users`, null, null);
        const bw = Math.max(4, ((f.adoption||0) / 100) * (W - 200));
        doc.rect(280, doc.y - 18, bw, 8).fill(BLUE);
        doc.fillColor(MUTED).fontSize(8).text(`${f.adoption}%`, 280 + bw + 4, doc.y - 18);
      });
    }

    // ── Top Wallets ─────────────────────────────────────────────────────────
    if (sections.includes('topusers') && users?.length) {
      sectionTitle('Top Wallets');
      subheading('Most Active Wallets');
      // Header
      const hy = doc.y;
      doc.rect(50, hy, W, 18).fill(BLUE);
      doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
        .text('Wallet', 58, hy + 5)
        .text('Txs', 230, hy + 5)
        .text('Gas Spent', 280, hy + 5)
        .text('Type', 370, hy + 5);
      doc.y = hy + 20;
      users.slice(0, 10).forEach((u, i) => {
        if (doc.y > 720) doc.addPage();
        const ry = doc.y;
        doc.rect(50, ry, W, 18).fill(i % 2 === 0 ? LIGHT : 'white');
        doc.fillColor(DARK).fontSize(8).font('Helvetica')
          .text(`${u.address?.slice(0,18)}...`, 58, ry + 5)
          .text(String(u.transactionCount||0), 230, ry + 5)
          .text(`$${Number(u.totalGasSpent||0).toFixed(4)}`, 280, ry + 5)
          .text(u.userType||'regular', 370, ry + 5);
        doc.y = ry + 20;
      });
    }

    // ── Open Tasks ──────────────────────────────────────────────────────────
    if (sections.includes('tasks') && tasks?.length) {
      sectionTitle('Open Tasks — Fix to Improve Score');
      tasks.forEach(t => {
        if (doc.y > 700) doc.addPage();
        const y = doc.y;
        const pc = t.priority === 'high' ? RED : YELLOW;
        doc.rect(50, y, 4, 50).fill(pc);
        doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold').text(t.title, 62, y + 4);
        doc.fillColor(MUTED).fontSize(8).font('Helvetica').text(t.description, 62, y + 18, { width: W - 20 });
        doc.fillColor(BLUE).fontSize(8).text(`💡 ${t.action}`, 62, y + 32, { width: W - 20 });
        doc.fillColor(MUTED).fontSize(7).text(`Current: ${t.current}  →  Target: ${t.target}  |  Pillar: ${t.pillar}  |  Priority: ${t.priority.toUpperCase()}`, 62, y + 46);
        doc.y = y + 60;
        doc.moveTo(50, doc.y).lineTo(50 + W, doc.y).stroke(BORDER);
        doc.y += 4;
      });
    }

    // ── Footer on last page ─────────────────────────────────────────────────
    doc.fontSize(8).fillColor(MUTED)
      .text(`MetaGauge · ${contract.name} · ${date} · metagauge.io`, 50, doc.page.height - 40, { align: 'center', width: W });

    doc.end();
  });
}
