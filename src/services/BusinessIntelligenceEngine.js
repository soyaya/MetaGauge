/**
 * BusinessIntelligenceEngine
 * Computes LTV, churn risk, session analysis, feature funnel,
 * revenue forecast, pattern recognition, and predictive analytics
 * from raw on-chain transaction data.
 */

const DAY = 86400;

export class BusinessIntelligenceEngine {

  // ── LTV Segmentation ────────────────────────────────────────────────────────
  static computeLTV(transactions, ethPriceUSD = 2500) {
    const walletMap = {};
    for (const tx of transactions) {
      const w = walletMap[tx.from] = walletMap[tx.from] || {
        address: tx.from, txCount: 0, gasSpentWei: 0, valueWei: 0,
        firstTs: Infinity, lastTs: 0, successCount: 0, failCount: 0,
      };
      w.txCount++;
      try { w.gasSpentWei += Number(tx.gasUsed || 0) * Number(tx.gasPrice || 0); } catch {}
      try { w.valueWei += Number(tx.value || 0); } catch {}
      const ts = tx.blockTimestamp || 0;
      if (ts < w.firstTs) w.firstTs = ts;
      if (ts > w.lastTs) w.lastTs = ts;
      if (tx.status) w.successCount++; else w.failCount++;
    }

    const wallets = Object.values(walletMap).map(w => {
      const gasUSD = (w.gasSpentWei / 1e18) * ethPriceUSD;
      const valueUSD = (w.valueWei / 1e18) * ethPriceUSD;
      const ltv = gasUSD + valueUSD;
      const agedays = w.firstTs < Infinity ? (w.lastTs - w.firstTs) / DAY : 0;
      return { ...w, gasUSD: +gasUSD.toFixed(4), valueUSD: +valueUSD.toFixed(4), ltv: +ltv.toFixed(4), ageDays: +agedays.toFixed(1) };
    }).sort((a, b) => b.ltv - a.ltv);

    const total = wallets.length;
    const top10pct = Math.max(1, Math.floor(total * 0.1));
    const top30pct = Math.max(1, Math.floor(total * 0.3));

    return {
      segments: {
        high:   wallets.slice(0, top10pct),
        mid:    wallets.slice(top10pct, top30pct),
        low:    wallets.slice(top30pct),
      },
      summary: {
        totalWallets: total,
        avgLTV: total ? +(wallets.reduce((s, w) => s + w.ltv, 0) / total).toFixed(4) : 0,
        topLTV: wallets[0]?.ltv || 0,
        top10pctShare: total ? +(wallets.slice(0, top10pct).reduce((s, w) => s + w.ltv, 0) /
          Math.max(1, wallets.reduce((s, w) => s + w.ltv, 0)) * 100).toFixed(1) : 0,
      },
    };
  }

  // ── Churn Risk ──────────────────────────────────────────────────────────────
  static computeChurnRisk(transactions, nowTs = Date.now() / 1000) {
    const walletMap = {};
    for (const tx of transactions) {
      const w = walletMap[tx.from] = walletMap[tx.from] || { txCount: 0, lastTs: 0, firstTs: Infinity };
      w.txCount++;
      const ts = tx.blockTimestamp || 0;
      if (ts > w.lastTs) w.lastTs = ts;
      if (ts < w.firstTs) w.firstTs = ts;
    }

    const results = Object.entries(walletMap).map(([address, w]) => {
      const daysSinceLast = w.lastTs ? (nowTs - w.lastTs) / DAY : 999;
      const lifespanDays = w.firstTs < Infinity ? (w.lastTs - w.firstTs) / DAY : 0;
      // Risk score 0-100: higher = more likely to churn
      let risk = 0;
      if (daysSinceLast > 90) risk = 95;
      else if (daysSinceLast > 60) risk = 80;
      else if (daysSinceLast > 30) risk = 60;
      else if (daysSinceLast > 14) risk = 35;
      else if (daysSinceLast > 7) risk = 15;
      // Adjust: single-tx wallets are higher risk
      if (w.txCount === 1) risk = Math.min(100, risk + 20);
      return { address, txCount: w.txCount, daysSinceLast: +daysSinceLast.toFixed(1), lifespanDays: +lifespanDays.toFixed(1), riskScore: risk };
    }).sort((a, b) => b.riskScore - a.riskScore);

    return {
      highRisk:   results.filter(w => w.riskScore >= 70),
      mediumRisk: results.filter(w => w.riskScore >= 35 && w.riskScore < 70),
      lowRisk:    results.filter(w => w.riskScore < 35),
      summary: {
        totalAtRisk: results.filter(w => w.riskScore >= 70).length,
        avgDaysSinceLast: results.length ? +(results.reduce((s, w) => s + w.daysSinceLast, 0) / results.length).toFixed(1) : 0,
      },
    };
  }

  // ── Session Analysis ────────────────────────────────────────────────────────
  static computeSessions(transactions, sessionGapSeconds = 1800) {
    const byWallet = {};
    for (const tx of transactions) {
      if (!tx.blockTimestamp) continue;
      (byWallet[tx.from] = byWallet[tx.from] || []).push(tx);
    }

    const allSessions = [];
    for (const [wallet, txs] of Object.entries(byWallet)) {
      const sorted = txs.sort((a, b) => a.blockTimestamp - b.blockTimestamp);
      let session = [sorted[0]];
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].blockTimestamp - sorted[i - 1].blockTimestamp > sessionGapSeconds) {
          allSessions.push(session);
          session = [];
        }
        session.push(sorted[i]);
      }
      allSessions.push(session);
    }

    const depths = allSessions.map(s => s.length);
    const durations = allSessions.map(s => s.length > 1 ? (s[s.length - 1].blockTimestamp - s[0].blockTimestamp) / 60 : 0);

    return {
      totalSessions: allSessions.length,
      avgDepth: depths.length ? +(depths.reduce((a, b) => a + b, 0) / depths.length).toFixed(2) : 0,
      avgDurationMinutes: durations.length ? +(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2) : 0,
      singleTxSessions: depths.filter(d => d === 1).length,
      deepSessions: depths.filter(d => d >= 3).length,
    };
  }

  // ── Feature Funnel ──────────────────────────────────────────────────────────
  static computeFeatureFunnel(transactions) {
    const SIG_NAMES = {
      '0xa9059cbb': 'transfer', '0x095ea7b3': 'approve', '0x23b872dd': 'transferFrom',
      '0x40c10f19': 'mint', '0x42966c68': 'burn', '0x2e1a7d4d': 'withdraw',
      '0xd0e30db0': 'deposit', '0x3593564c': 'execute', '0x09c5eabe': 'execute_v2',
    };
    const label = input => {
      if (!input || input === '0x') return 'ETH Transfer';
      return SIG_NAMES[input.slice(0, 10)] || input.slice(0, 10);
    };

    // Per-wallet ordered function sequence
    const byWallet = {};
    for (const tx of transactions) {
      (byWallet[tx.from] = byWallet[tx.from] || []).push({ fn: label(tx.input), ts: tx.blockTimestamp || 0 });
    }

    const fnCounts = {};
    const transitionCounts = {};
    for (const txs of Object.values(byWallet)) {
      const sorted = txs.sort((a, b) => a.ts - b.ts);
      for (let i = 0; i < sorted.length; i++) {
        fnCounts[sorted[i].fn] = (fnCounts[sorted[i].fn] || 0) + 1;
        if (i > 0) {
          const key = `${sorted[i - 1].fn} → ${sorted[i].fn}`;
          transitionCounts[key] = (transitionCounts[key] || 0) + 1;
        }
      }
    }

    const totalWallets = Object.keys(byWallet).length;
    const funnel = Object.entries(fnCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([fn, count]) => ({ fn, count, pct: totalWallets ? +(count / totalWallets * 100).toFixed(1) : 0 }));

    const topTransitions = Object.entries(transitionCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([path, count]) => ({ path, count }));

    return { funnel, topTransitions, totalWallets };
  }

  // ── Time Patterns ───────────────────────────────────────────────────────────
  static computeTimePatterns(transactions) {
    const hourly = new Array(24).fill(0);
    const daily = new Array(7).fill(0); // 0=Sun
    const weekly = {};

    for (const tx of transactions) {
      if (!tx.blockTimestamp) continue;
      const d = new Date(tx.blockTimestamp * 1000);
      hourly[d.getUTCHours()]++;
      daily[d.getUTCDay()]++;
      const wk = `${d.getUTCFullYear()}-W${String(Math.ceil(d.getUTCDate() / 7)).padStart(2, '0')}`;
      weekly[wk] = (weekly[wk] || 0) + 1;
    }

    const peakHour = hourly.indexOf(Math.max(...hourly));
    const peakDay = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][daily.indexOf(Math.max(...daily))];

    return {
      hourly: hourly.map((count, hour) => ({ hour, count })),
      daily: daily.map((count, day) => ({ day: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day], count })),
      weekly: Object.entries(weekly).sort().map(([week, count]) => ({ week, count })),
      peakHour, peakDay,
    };
  }

  // ── Revenue Forecast ────────────────────────────────────────────────────────
  static computeRevenueForecast(transactions, ethPriceUSD = 2500, forecastDays = 30) {
    if (!transactions.length) return { forecast30d: 0, forecast90d: 0, trend: 'insufficient_data' };

    // Group fees by day
    const byDay = {};
    for (const tx of transactions) {
      if (!tx.blockTimestamp) continue;
      const day = new Date(tx.blockTimestamp * 1000).toISOString().slice(0, 10);
      const feeETH = (Number(tx.gasUsed || 0) * Number(tx.gasPrice || 0)) / 1e18;
      byDay[day] = (byDay[day] || 0) + feeETH * ethPriceUSD;
    }

    const days = Object.entries(byDay).sort();
    if (days.length < 3) return { forecast30d: 0, forecast90d: 0, trend: 'insufficient_data' };

    const values = days.map(([, v]) => v);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;

    // Simple linear regression
    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = avg;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (values[i] - yMean);
      den += (i - xMean) ** 2;
    }
    const slope = den ? num / den : 0;
    const intercept = yMean - slope * xMean;

    const forecast = (daysAhead) => Math.max(0, (intercept + slope * (n + daysAhead)) * daysAhead);

    const trend = slope > avg * 0.01 ? 'growing' : slope < -avg * 0.01 ? 'declining' : 'stable';

    return {
      dailyAvgUSD: +avg.toFixed(2),
      forecast30d: +forecast(30).toFixed(2),
      forecast90d: +forecast(90).toFixed(2),
      trend,
      slope: +slope.toFixed(4),
      dataPoints: days.length,
    };
  }

  // ── Pattern Recognition ─────────────────────────────────────────────────────
  static recognizePatterns(transactions, nowTs = Date.now() / 1000) {
    const patterns = [];
    if (!transactions.length) return patterns;

    const byWallet = {};
    for (const tx of transactions) {
      (byWallet[tx.from] = byWallet[tx.from] || []).push(tx);
    }

    // Pattern 1: Bot detection — wallets with suspiciously regular intervals
    let botCount = 0;
    for (const [, txs] of Object.entries(byWallet)) {
      if (txs.length < 5) continue;
      const sorted = txs.sort((a, b) => (a.blockTimestamp || 0) - (b.blockTimestamp || 0));
      const intervals = [];
      for (let i = 1; i < sorted.length; i++) {
        intervals.push((sorted[i].blockTimestamp || 0) - (sorted[i - 1].blockTimestamp || 0));
      }
      const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((s, v) => s + (v - mean) ** 2, 0) / intervals.length;
      const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
      if (cv < 0.1) botCount++; // coefficient of variation < 10% = very regular = bot
    }
    if (botCount > 0) patterns.push({ type: 'bot_cluster', severity: botCount > 5 ? 'high' : 'medium', detail: `${botCount} wallets show bot-like regularity`, count: botCount });

    // Pattern 2: Whale accumulation — large wallets increasing tx frequency recently
    const recentCutoff = nowTs - 7 * DAY;
    const whales = Object.entries(byWallet).filter(([, txs]) => txs.length >= 10);
    const acceleratingWhales = whales.filter(([, txs]) => {
      const recent = txs.filter(t => (t.blockTimestamp || 0) > recentCutoff).length;
      const older = txs.filter(t => (t.blockTimestamp || 0) <= recentCutoff).length;
      const recentRate = recent / 7;
      const olderRate = older / Math.max(1, (txs.length > 0 ? (nowTs - recentCutoff) / DAY : 30));
      return recentRate > olderRate * 1.5;
    });
    if (acceleratingWhales.length > 0) patterns.push({ type: 'whale_accumulation', severity: 'positive', detail: `${acceleratingWhales.length} whale wallet(s) increasing activity`, count: acceleratingWhales.length });

    // Pattern 3: Viral coefficient — new wallets appearing in clusters
    const firstTxByWallet = Object.entries(byWallet).map(([addr, txs]) => ({
      addr, firstTs: Math.min(...txs.map(t => t.blockTimestamp || Infinity)),
    })).filter(w => w.firstTs < Infinity).sort((a, b) => a.firstTs - b.firstTs);

    let viralBursts = 0;
    for (let i = 0; i < firstTxByWallet.length - 2; i++) {
      const window = firstTxByWallet.slice(i, i + 3);
      if (window[2].firstTs - window[0].firstTs < 3600) viralBursts++; // 3 new wallets within 1 hour
    }
    if (viralBursts > 0) patterns.push({ type: 'viral_burst', severity: 'positive', detail: `${viralBursts} viral burst(s) detected — multiple new wallets joining within 1 hour`, count: viralBursts });

    // Pattern 4: Churn wave — many wallets going silent at the same time
    const thirtyDaysAgo = nowTs - 30 * DAY;
    const sixtyDaysAgo = nowTs - 60 * DAY;
    const churnedRecently = Object.values(byWallet).filter(txs => {
      const last = Math.max(...txs.map(t => t.blockTimestamp || 0));
      return last > sixtyDaysAgo && last < thirtyDaysAgo;
    }).length;
    const totalActive = Object.values(byWallet).filter(txs => Math.max(...txs.map(t => t.blockTimestamp || 0)) > sixtyDaysAgo).length;
    if (totalActive > 0 && churnedRecently / totalActive > 0.3) {
      patterns.push({ type: 'churn_wave', severity: 'high', detail: `${churnedRecently} wallets (${Math.round(churnedRecently / totalActive * 100)}%) went silent 30-60 days ago`, count: churnedRecently });
    }

    // Pattern 5: Feature abandonment — function usage declining
    const recentFns = {};
    const olderFns = {};
    for (const tx of transactions) {
      const fn = tx.input?.slice(0, 10) || 'ETH';
      const ts = tx.blockTimestamp || 0;
      if (ts > recentCutoff) recentFns[fn] = (recentFns[fn] || 0) + 1;
      else olderFns[fn] = (olderFns[fn] || 0) + 1;
    }
    const recentTotal = Object.values(recentFns).reduce((a, b) => a + b, 0) || 1;
    const olderTotal = Object.values(olderFns).reduce((a, b) => a + b, 0) || 1;
    for (const [fn, oldCount] of Object.entries(olderFns)) {
      const recentCount = recentFns[fn] || 0;
      const oldShare = oldCount / olderTotal;
      const recentShare = recentCount / recentTotal;
      if (oldShare > 0.1 && recentShare < oldShare * 0.5) {
        patterns.push({ type: 'feature_abandonment', severity: 'medium', detail: `Function ${fn} usage dropped ${Math.round((1 - recentShare / oldShare) * 100)}% recently`, fn });
      }
    }

    return patterns;
  }

  // ── Predictive: Next Action ─────────────────────────────────────────────────
  static predictNextActions(transactions) {
    // Build Markov chain of function transitions
    const transitions = {};
    const byWallet = {};
    for (const tx of transactions) {
      (byWallet[tx.from] = byWallet[tx.from] || []).push({ fn: tx.input?.slice(0, 10) || 'ETH', ts: tx.blockTimestamp || 0 });
    }
    for (const txs of Object.values(byWallet)) {
      const sorted = txs.sort((a, b) => a.ts - b.ts);
      for (let i = 0; i < sorted.length - 1; i++) {
        const from = sorted[i].fn;
        const to = sorted[i + 1].fn;
        if (!transitions[from]) transitions[from] = {};
        transitions[from][to] = (transitions[from][to] || 0) + 1;
      }
    }
    // Normalize to probabilities
    const predictions = {};
    for (const [from, tos] of Object.entries(transitions)) {
      const total = Object.values(tos).reduce((a, b) => a + b, 0);
      predictions[from] = Object.entries(tos)
        .map(([to, count]) => ({ nextFn: to, probability: +(count / total * 100).toFixed(1) }))
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 3);
    }
    return predictions;
  }

  // ── Predictive: User Growth ─────────────────────────────────────────────────
  static predictUserGrowth(transactions, forecastWeeks = 4) {
    const byWeek = {};
    const seenWallets = new Set();
    for (const tx of transactions) {
      if (!tx.blockTimestamp) continue;
      const d = new Date(tx.blockTimestamp * 1000);
      const wk = `${d.getUTCFullYear()}-${String(Math.ceil((d.getUTCDate() + new Date(d.getUTCFullYear(), d.getUTCMonth(), 1).getUTCDay()) / 7)).padStart(2, '0')}`;
      if (!seenWallets.has(tx.from)) {
        seenWallets.add(tx.from);
        byWeek[wk] = (byWeek[wk] || 0) + 1;
      }
    }
    const weeks = Object.entries(byWeek).sort();
    if (weeks.length < 3) return { forecast: [], trend: 'insufficient_data' };

    const values = weeks.map(([, v]) => v);
    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (i - xMean) * (values[i] - yMean); den += (i - xMean) ** 2; }
    const slope = den ? num / den : 0;
    const intercept = yMean - slope * xMean;

    const forecast = Array.from({ length: forecastWeeks }, (_, i) => ({
      week: `+${i + 1}w`,
      predicted: Math.max(0, Math.round(intercept + slope * (n + i))),
    }));

    return {
      historicalWeeks: weeks.map(([week, count]) => ({ week, count })),
      forecast,
      weeklyGrowthRate: yMean > 0 ? +(slope / yMean * 100).toFixed(1) : 0,
      trend: slope > 0 ? 'growing' : slope < 0 ? 'declining' : 'stable',
    };
  }

  // ── Smart Money Detection ───────────────────────────────────────────────────
  static detectSmartMoney(transactions) {
    const byWallet = {};
    for (const tx of transactions) {
      const w = byWallet[tx.from] = byWallet[tx.from] || { txs: [], totalValue: 0 };
      w.txs.push(tx);
      try { w.totalValue += Number(tx.value || 0); } catch {}
    }

    const smartMoney = Object.entries(byWallet)
      .filter(([, w]) => {
        const valueETH = Number(w.totalValue) / 1e18;
        return w.txs.length >= 3 && valueETH > 0.1; // active + meaningful value
      })
      .map(([address, w]) => ({
        address,
        txCount: w.txs.length,
        totalValueETH: +(w.totalValue / 1e18).toFixed(6),
        successRate: +(w.txs.filter(t => t.status).length / w.txs.length * 100).toFixed(1),
      }))
      .sort((a, b) => b.totalValueETH - a.totalValueETH)
      .slice(0, 20);

    return { smartMoney, count: smartMoney.length };
  }

  // ── Run all analytics at once ───────────────────────────────────────────────
  static runAll(transactions, ethPriceUSD = 2500) {
    const nowTs = Date.now() / 1000;
    return {
      ltv:            this.computeLTV(transactions, ethPriceUSD),
      churnRisk:      this.computeChurnRisk(transactions, nowTs),
      sessions:       this.computeSessions(transactions),
      featureFunnel:  this.computeFeatureFunnel(transactions),
      timePatterns:   this.computeTimePatterns(transactions),
      revenueForecast:this.computeRevenueForecast(transactions, ethPriceUSD),
      patterns:       this.recognizePatterns(transactions, nowTs),
      nextActions:    this.predictNextActions(transactions),
      userGrowth:     this.predictUserGrowth(transactions),
      smartMoney:     this.detectSmartMoney(transactions),
    };
  }
}
