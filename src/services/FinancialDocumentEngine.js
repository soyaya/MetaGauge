/**
 * FinancialDocumentEngine
 * Pure calculation engine — no AI, no DB calls.
 * Takes on-chain data + financial inputs → returns structured JSON documents.
 *
 * All numbers are USD unless explicitly labelled.
 * Documents produced:
 *   1. Income Statement (P&L)
 *   2. Cash Flow Statement
 *   3. Balance Sheet
 *   4. Unit Economics
 *   5. KPI Dashboard
 *   6. 12-Month Forward Model (Base / Bull / Bear)
 */

// ── Helpers ────────────────────────────────────────────────────────────────

const round2 = (n) => Math.round((n || 0) * 100) / 100;
const round0 = (n) => Math.round(n || 0);
const pct    = (num, den) => den > 0 ? round2((num / den) * 100) : 0;
const safe   = (n) => isNaN(n) || !isFinite(n) ? 0 : (n || 0);

// ── 1. Income Statement (P&L) ──────────────────────────────────────────────

/**
 * @param {object} onChain  - indexed contract data
 * @param {object} inputs   - { profile, periodInputs }
 * @param {object} prices   - { ethUsd } current ETH price
 */
export function buildIncomeStatement(onChain, inputs, prices = {}) {
  const { profile = {}, periodInputs = {} } = inputs;
  const ethUsd = prices.ethUsd || 2500;

  // ── Revenue ──
  // Protocol fees: from on-chain gas + fee events
  const onChainFeeEth    = safe(onChain.totalFeeEth || onChain.totalVolumeEth * 0.003);
  const protocolRevenue  = round2(onChainFeeEth * ethUsd);

  // Token revenue: treasury inflows this period
  const tokenRevenue     = round2(safe(periodInputs.token_treasury_movement > 0
    ? periodInputs.token_treasury_movement : 0));

  // Off-chain revenue
  const offChainRevenue  = round2(safe(periodInputs.off_chain_revenue));

  const totalRevenue     = round2(protocolRevenue + tokenRevenue + offChainRevenue);

  // ── Cost of Revenue (COGS) ──
  // Gas subsidies: cost_per_tx_subsidy × total transactions
  const txCount          = safe(onChain.totalTransactions);
  const gasSubsidy       = round2(safe(profile.cost_per_tx_subsidy) * txCount);

  // Infrastructure (RPC, hosting) — direct cost of delivering the protocol
  const infraCost        = round2(safe(periodInputs.infra_cost));

  const cogs             = round2(gasSubsidy + infraCost);
  const grossProfit      = round2(totalRevenue - cogs);
  const grossMarginPct   = pct(grossProfit, totalRevenue);

  // ── Operating Expenses ──
  const marketing        = round2(safe(periodInputs.marketing_spend));
  const payroll          = round2(safe(periodInputs.payroll));
  const legalAudit       = round2(safe(periodInputs.legal_audit_cost));
  const otherOpex        = round2(safe(periodInputs.other_opex));
  const totalOpex        = round2(marketing + payroll + legalAudit + otherOpex);

  // ── Profitability ──
  const ebitda           = round2(grossProfit - totalOpex);
  const netProfit        = ebitda; // simplified: no D&A, no interest for early-stage crypto

  // ── Per-transaction unit economics ──
  const revenuePerTx     = txCount > 0 ? round2(totalRevenue / txCount) : 0;
  const costPerTx        = txCount > 0 ? round2((cogs + totalOpex) / txCount) : 0;
  const profitPerTx      = round2(revenuePerTx - costPerTx);

  return {
    period: inputs.period,
    currency: 'USD',
    revenue: {
      protocol_revenue:  protocolRevenue,
      token_revenue:     tokenRevenue,
      off_chain_revenue: offChainRevenue,
      total_revenue:     totalRevenue,
    },
    cost_of_revenue: {
      gas_subsidies:     gasSubsidy,
      infrastructure:    infraCost,
      total_cogs:        cogs,
    },
    gross_profit:        grossProfit,
    gross_margin_pct:    grossMarginPct,
    operating_expenses: {
      marketing:         marketing,
      payroll:           payroll,
      legal_audit:       legalAudit,
      other:             otherOpex,
      total_opex:        totalOpex,
    },
    ebitda:              ebitda,
    net_profit:          netProfit,
    net_margin_pct:      pct(netProfit, totalRevenue),
    per_transaction: {
      revenue_per_tx:    revenuePerTx,
      cost_per_tx:       costPerTx,
      profit_per_tx:     profitPerTx,
      total_transactions: txCount,
    },
    meta: {
      eth_usd_rate:      ethUsd,
      on_chain_fee_eth:  onChainFeeEth,
    },
  };
}

// ── 2. Cash Flow Statement ─────────────────────────────────────────────────

export function buildCashFlowStatement(onChain, inputs, prices = {}) {
  const { profile = {}, periodInputs = {}, fundingRounds = [] } = inputs;
  const ethUsd = prices.ethUsd || 2500;

  // ── Operating ──
  const cashFromProtocol   = round2(safe(onChain.totalFeeEth || 0) * ethUsd);
  const cashFromOffChain   = round2(safe(periodInputs.off_chain_revenue));
  const totalCashIn        = round2(cashFromProtocol + cashFromOffChain);

  const cashPaidPayroll    = round2(safe(periodInputs.payroll));
  const cashPaidMarketing  = round2(safe(periodInputs.marketing_spend));
  const cashPaidInfra      = round2(safe(periodInputs.infra_cost));
  const cashPaidLegal      = round2(safe(periodInputs.legal_audit_cost));
  const cashPaidOther      = round2(safe(periodInputs.other_opex));
  const cashPaidGasSubsidy = round2(safe(profile.cost_per_tx_subsidy) * safe(onChain.totalTransactions));
  const totalCashOut       = round2(cashPaidPayroll + cashPaidMarketing + cashPaidInfra +
                                    cashPaidLegal + cashPaidOther + cashPaidGasSubsidy);

  const operatingCashFlow  = round2(totalCashIn - totalCashOut);

  // ── Investing ──
  // Treasury token purchases/sales
  const tokenTreasuryFlow  = round2(safe(periodInputs.token_treasury_movement));
  const investingCashFlow  = round2(-tokenTreasuryFlow); // buying tokens = cash out

  // ── Financing ──
  // Funding rounds in this period (match by round_date to period)
  const [year, month] = (inputs.period || '').split('-');
  const periodFunding = fundingRounds
    .filter(r => {
      if (!r.round_date) return false;
      const d = new Date(r.round_date);
      return d.getFullYear() === parseInt(year) && d.getMonth() + 1 === parseInt(month);
    })
    .reduce((sum, r) => sum + safe(r.amount_usd), 0);

  const financingCashFlow  = round2(periodFunding);

  // ── Net ──
  const netCashChange      = round2(operatingCashFlow + investingCashFlow + financingCashFlow);
  const openingBalance     = round2(safe(periodInputs.cash_balance) - netCashChange);
  const closingBalance     = round2(safe(periodInputs.cash_balance));

  // Burn rate = total cash out from operations
  const monthlyBurnRate    = totalCashOut;
  const runwayMonths       = monthlyBurnRate > 0
    ? round2(closingBalance / monthlyBurnRate)
    : null;

  return {
    period: inputs.period,
    currency: 'USD',
    operating: {
      cash_from_protocol:   cashFromProtocol,
      cash_from_off_chain:  cashFromOffChain,
      total_cash_inflows:   totalCashIn,
      cash_paid_payroll:    cashPaidPayroll,
      cash_paid_marketing:  cashPaidMarketing,
      cash_paid_infra:      cashPaidInfra,
      cash_paid_legal:      cashPaidLegal,
      cash_paid_other:      cashPaidOther,
      cash_paid_gas_subsidy: cashPaidGasSubsidy,
      total_cash_outflows:  totalCashOut,
      net_operating_cash_flow: operatingCashFlow,
    },
    investing: {
      token_treasury_movement: tokenTreasuryFlow,
      net_investing_cash_flow: investingCashFlow,
    },
    financing: {
      funding_received:     periodFunding,
      net_financing_cash_flow: financingCashFlow,
    },
    summary: {
      net_cash_change:      netCashChange,
      opening_cash_balance: openingBalance,
      closing_cash_balance: closingBalance,
      monthly_burn_rate:    monthlyBurnRate,
      runway_months:        runwayMonths,
    },
  };
}

// ── 3. Balance Sheet ───────────────────────────────────────────────────────

/**
 * @param {object} financials - { currentNetProfit, priorRetainedEarnings }
 *   currentNetProfit: this period's net_profit from the income statement.
 *   priorRetainedEarnings: cumulative net_profit from all earlier periods (0 for the first period).
 *   Retained earnings is computed from actual profit history, not backed into
 *   balance as a plug — so balance_check is a real sanity check, not a tautology.
 */
export function buildBalanceSheet(onChain, inputs, prices = {}, financials = {}) {
  const { profile = {}, periodInputs = {}, fundingRounds = [] } = inputs;
  const ethUsd = prices.ethUsd || 2500;

  // ── Assets ──
  // Current assets
  const cashAndStables      = round2(safe(periodInputs.cash_balance));
  const accountsReceivable  = 0; // on-chain settlements are immediate
  const totalCurrentAssets  = round2(cashAndStables + accountsReceivable);

  // Non-current assets
  const tokenTreasuryUnits  = safe(profile.token_treasury_amount);
  const tokenPriceUsd       = prices.tokenUsd || 0;
  const tokenTreasuryValue  = round2(tokenTreasuryUnits * tokenPriceUsd);
  const protocolGoodwill    = 0; // excluded — too speculative for conservative reporting
  const totalNonCurrentAssets = round2(tokenTreasuryValue);

  const totalAssets         = round2(totalCurrentAssets + totalNonCurrentAssets);

  // ── Liabilities ──
  // Current liabilities — placeholder: assumes payroll/opex are paid in the
  // same period they're incurred (no accrual tracking input exists yet).
  const accruedPayroll      = 0;
  const accruedOther        = 0;
  const totalCurrentLiab    = round2(accruedPayroll + accruedOther);

  // Non-current liabilities (vesting obligations — estimated from team size)
  const teamSize            = safe(profile.team_size);
  const vestingObligation   = 0; // requires additional input — placeholder
  const totalNonCurrentLiab = round2(vestingObligation);

  const totalLiabilities    = round2(totalCurrentLiab + totalNonCurrentLiab);

  // ── Equity ──
  const totalFundingRaised  = fundingRounds.reduce((sum, r) => sum + safe(r.amount_usd), 0);
  // Retained earnings = actual cumulative profit/loss (prior periods + this one),
  // not a residual plug — so the balance check below is meaningful.
  const retainedEarnings    = round2(safe(financials.priorRetainedEarnings) + safe(financials.currentNetProfit));
  const totalEquity         = round2(totalFundingRaised + retainedEarnings);

  // Sanity check: assets = liabilities + equity. A non-zero value here is
  // expected and reflects the conservative exclusions above (goodwill,
  // accounts receivable, vesting obligations all reported as 0) — it is NOT
  // forced to zero.
  const balanceCheck        = round2(totalAssets - totalLiabilities - totalEquity);

  return {
    period: inputs.period,
    currency: 'USD',
    assets: {
      current: {
        cash_and_stablecoins:  cashAndStables,
        accounts_receivable:   accountsReceivable,
        total_current_assets:  totalCurrentAssets,
      },
      non_current: {
        token_treasury_units:  tokenTreasuryUnits,
        token_treasury_value:  tokenTreasuryValue,
        token_price_used:      tokenPriceUsd,
        total_non_current_assets: totalNonCurrentAssets,
      },
      total_assets: totalAssets,
    },
    liabilities: {
      current: {
        accrued_expenses:      totalCurrentLiab,
        total_current_liab:    totalCurrentLiab,
      },
      non_current: {
        vesting_obligations:   vestingObligation,
        total_non_current_liab: totalNonCurrentLiab,
      },
      total_liabilities: totalLiabilities,
    },
    equity: {
      total_funding_raised:  round2(totalFundingRaised),
      retained_earnings:     retainedEarnings,
      total_equity:          totalEquity,
    },
    balance_check: balanceCheck, // should be ~0
    meta: {
      eth_usd_rate: prices.ethUsd || 2500,
      token_price:  tokenPriceUsd,
    },
  };
}

// ── 4. Unit Economics ──────────────────────────────────────────────────────

export function buildUnitEconomics(onChain, inputs, prices = {}) {
  const { profile = {}, periodInputs = {} } = inputs;

  const newUsers        = safe(onChain.newUsers || onChain.uniqueUsers);
  const activeUsers     = safe(onChain.activeUsers || onChain.uniqueUsers);
  const totalUsers      = safe(onChain.uniqueUsers);
  const retentionRate   = safe(onChain.retentionRate) / 100; // fraction
  const txCount         = safe(onChain.totalTransactions);
  const ethUsd          = prices.ethUsd || 2500;

  // CAC — cost to acquire one new user
  const marketing       = safe(periodInputs.marketing_spend);
  const cac             = newUsers > 0 ? round2(marketing / newUsers) : null;

  // ARPU — average revenue per active user per month
  const onChainFeeEth   = safe(onChain.totalFeeEth || onChain.totalVolumeEth * 0.003);
  const totalRevenue    = round2(onChainFeeEth * ethUsd + safe(periodInputs.off_chain_revenue));
  const arpu            = activeUsers > 0 ? round2(totalRevenue / activeUsers) : 0;

  // LTV — estimated lifetime value
  // LTV = ARPU × avg retention months
  // avg retention months derived from retention rate: 1 / (1 - retention_rate)
  const avgRetentionMonths = retentionRate < 1 && retentionRate > 0
    ? round2(1 / (1 - retentionRate))
    : 6; // default 6 months if no retention data

  const ltv             = round2(arpu * avgRetentionMonths);

  // LTV:CAC ratio
  const ltvCacRatio     = (cac && cac > 0) ? round2(ltv / cac) : null;

  // Payback period in months
  const paybackMonths   = (cac && arpu > 0) ? round2(cac / arpu) : null;

  // Burn & runway
  const totalOpex       = round2(
    safe(periodInputs.marketing_spend) +
    safe(periodInputs.payroll) +
    safe(periodInputs.infra_cost) +
    safe(periodInputs.legal_audit_cost) +
    safe(periodInputs.other_opex)
  );
  const monthlyBurn     = round2(totalOpex + safe(profile.cost_per_tx_subsidy) * txCount);
  const cashBalance     = safe(periodInputs.cash_balance);
  const runwayMonths    = monthlyBurn > 0 ? round2(cashBalance / monthlyBurn) : null;

  // Cost per transaction
  const costPerTxTotal  = txCount > 0 ? round2(monthlyBurn / txCount) : 0;
  const revenuePerTx    = txCount > 0 ? round2(totalRevenue / txCount) : 0;

  return {
    period: inputs.period,
    currency: 'USD',
    acquisition: {
      new_users:          newUsers,
      marketing_spend:    marketing,
      cac:                cac,
      cac_label:          cac ? `$${cac} per new user` : 'Insufficient data',
    },
    monetisation: {
      total_revenue:      totalRevenue,
      active_users:       activeUsers,
      arpu:               arpu,
      arpu_label:         `$${arpu} per active user per month`,
    },
    lifetime_value: {
      avg_retention_months: avgRetentionMonths,
      ltv:                  ltv,
      ltv_label:            `$${ltv} estimated lifetime value`,
    },
    ratios: {
      ltv_cac_ratio:      ltvCacRatio,
      ltv_cac_label:      ltvCacRatio ? `${ltvCacRatio}x` : 'Insufficient data',
      payback_months:     paybackMonths,
      payback_label:      paybackMonths ? `${paybackMonths} months to recover CAC` : 'Insufficient data',
    },
    transactions: {
      total_transactions:  txCount,
      revenue_per_tx:      revenuePerTx,
      cost_per_tx:         costPerTxTotal,
      profit_per_tx:       round2(revenuePerTx - costPerTxTotal),
    },
    burn_and_runway: {
      total_monthly_burn:  monthlyBurn,
      cash_balance:        cashBalance,
      runway_months:       runwayMonths,
      runway_label:        runwayMonths
        ? `${Math.floor(runwayMonths)} months at current burn`
        : 'Insufficient data',
    },
  };
}

// ── 5. KPI Dashboard ───────────────────────────────────────────────────────

export function buildKPIDashboard(onChain, inputs, researchData = null) {
  const { periodInputs = {} } = inputs;
  const ethUsd = 2500;

  const onChainFeeEth  = safe(onChain.totalFeeEth || onChain.totalVolumeEth * 0.003);
  const totalRevenue   = round2(onChainFeeEth * ethUsd + safe(periodInputs.off_chain_revenue));

  const kpis = {
    users: {
      total:         safe(onChain.uniqueUsers),
      active_24h:    safe(onChain.dau),
      active_7d:     safe(onChain.wau),
      active_30d:    safe(onChain.mau || onChain.uniqueUsers),
      new_this_period: safe(onChain.newUsers),
    },
    engagement: {
      retention_rate:   safe(onChain.retentionRate),
      churn_rate:       safe(onChain.churnRate),
      d1_retention:     safe(onChain.d1Retention),
      d7_retention:     safe(onChain.d7Retention),
      d30_retention:    safe(onChain.d30Retention),
      bounce_rate:      safe(onChain.bounceRate),
      activation_rate:  safe(onChain.activationRate),
    },
    transactions: {
      total:            safe(onChain.totalTransactions),
      success_rate:     safe(onChain.txSuccessRate),
      avg_gas_usd:      safe(onChain.averageGasCostUSD),
    },
    financials: {
      total_revenue:    totalRevenue,
      monthly_burn:     round2(
        safe(periodInputs.payroll) +
        safe(periodInputs.marketing_spend) +
        safe(periodInputs.infra_cost) +
        safe(periodInputs.legal_audit_cost) +
        safe(periodInputs.other_opex)
      ),
      cash_balance:     safe(periodInputs.cash_balance),
    },
  };

  // Sector benchmarks (from research agent — Phase 2)
  const benchmarks = researchData?.sector_benchmarks || null;
  if (benchmarks) {
    kpis.vs_sector = {
      retention_vs_median: onChain.retentionRate != null && benchmarks.median_retention
        ? round2(onChain.retentionRate - benchmarks.median_retention)
        : null,
      cac_vs_median: null, // populated in Phase 2
      revenue_growth_vs_median: null,
      source: benchmarks.source || 'DeFiLlama / CoinGecko',
      fetched_at: benchmarks.fetched_at,
    };
  }

  return {
    period: inputs.period,
    currency: 'USD',
    kpis,
    benchmarks: benchmarks || null,
  };
}

// ── 6. 12-Month Forward Model ──────────────────────────────────────────────

/**
 * Generates Base, Bull, Bear scenarios.
 * Growth assumptions are fixed illustrative rates (8%/20%/1% monthly revenue
 * growth for base/bull/bear) — NOT derived from this contract's actual
 * on-chain trajectory. Treat these as planning scenarios, not a forecast.
 */
export function build12MonthModel(onChain, inputs, prices = {}) {
  const { periodInputs = {} } = inputs;
  const ethUsd = prices.ethUsd || 2500;

  const onChainFeeEth  = safe(onChain.totalFeeEth || onChain.totalVolumeEth * 0.003);
  const baseRevenue    = round2(onChainFeeEth * ethUsd + safe(periodInputs.off_chain_revenue));
  const baseBurn       = round2(
    safe(periodInputs.payroll) +
    safe(periodInputs.marketing_spend) +
    safe(periodInputs.infra_cost) +
    safe(periodInputs.legal_audit_cost) +
    safe(periodInputs.other_opex)
  );

  // Growth rates per month
  const scenarios = {
    base: { revenue_growth: 0.08, cost_growth: 0.04, label: 'Base Case' },
    bull: { revenue_growth: 0.20, cost_growth: 0.06, label: 'Bull Case' },
    bear: { revenue_growth: 0.01, cost_growth: 0.02, label: 'Bear Case' },
  };

  const buildScenario = (growth) => {
    const months = [];
    let revenue = baseRevenue;
    let costs   = baseBurn;
    let cash    = safe(periodInputs.cash_balance);
    let breakEvenMonth = null;

    for (let i = 1; i <= 12; i++) {
      revenue = round2(revenue * (1 + growth.revenue_growth));
      costs   = round2(costs   * (1 + growth.cost_growth));
      const profit = round2(revenue - costs);
      cash    = round2(cash + profit);

      if (!breakEvenMonth && profit > 0) breakEvenMonth = i;

      months.push({
        month: i,
        projected_revenue: revenue,
        projected_costs:   costs,
        projected_profit:  profit,
        cumulative_cash:   cash,
      });
    }

    return {
      label:             growth.label,
      assumptions: {
        monthly_revenue_growth: `${(growth.revenue_growth * 100).toFixed(0)}%`,
        monthly_cost_growth:    `${(growth.cost_growth   * 100).toFixed(0)}%`,
        starting_revenue:       baseRevenue,
        starting_costs:         baseBurn,
        starting_cash:          safe(periodInputs.cash_balance),
      },
      break_even_month:  breakEvenMonth || 'Beyond 12 months',
      month_12_revenue:  months[11]?.projected_revenue || 0,
      month_12_profit:   months[11]?.projected_profit  || 0,
      months,
    };
  };

  return {
    period: inputs.period,
    currency: 'USD',
    base:  buildScenario(scenarios.base),
    bull:  buildScenario(scenarios.bull),
    bear:  buildScenario(scenarios.bear),
    notes: [
      'Growth rates are fixed illustrative assumptions (base/bull/bear), not derived from this project\'s historical trajectory.',
      'Cost growth assumes linear scaling with team and infrastructure.',
      'Token price movements excluded from projections — consult a financial advisor.',
      'This model is for planning purposes only and does not constitute financial advice.',
    ],
  };
}

// ── Master builder ─────────────────────────────────────────────────────────

/**
 * Build all 6 documents in one call.
 * @param {object} financials - { priorRetainedEarnings } cumulative net_profit
 *   from all periods before this one — needed so the balance sheet's retained
 *   earnings reflects real profit history instead of a residual plug.
 * Returns { incomeStatement, cashFlow, balanceSheet, unitEconomics, kpiDashboard, forwardModel }
 */
export async function buildAllDocuments(onChain, inputs, prices = {}, researchData = null, financials = {}) {
  // Income statement is computed first — the balance sheet needs its net_profit.
  const incomeStatement = buildIncomeStatement(onChain, inputs, prices);

  const [
    cashFlow,
    balanceSheet,
    unitEconomics,
    kpiDashboard,
    forwardModel,
  ] = await Promise.all([
    Promise.resolve(buildCashFlowStatement(onChain, inputs, prices)),
    Promise.resolve(buildBalanceSheet(onChain, inputs, prices, {
      currentNetProfit: incomeStatement.net_profit,
      priorRetainedEarnings: financials.priorRetainedEarnings || 0,
    })),
    Promise.resolve(buildUnitEconomics(onChain, inputs, prices)),
    Promise.resolve(buildKPIDashboard(onChain, inputs, researchData)),
    Promise.resolve(build12MonthModel(onChain, inputs, prices)),
  ]);

  return {
    period: inputs.period,
    generated_at: new Date().toISOString(),
    income_statement:     incomeStatement,
    cash_flow_statement:  cashFlow,
    balance_sheet:        balanceSheet,
    unit_economics:       unitEconomics,
    kpi_dashboard:        kpiDashboard,
    forward_model:        forwardModel,
  };
}
