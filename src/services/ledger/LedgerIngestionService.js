/**
 * LedgerIngestionService — orchestrates Phase 1 ledger writes.
 *
 * Given the transactions trigger-indexing.js already fetched for a contract,
 * this: decodes token transfers (fixing the from/to/amount decode bug),
 * resolves token metadata, classifies each transfer, and posts confidently-
 * classified, priced transfers to `ledger_entries`. This is what
 * `financial.js`'s `fetchOnChainSnapshot()` reads from — see that file's
 * comment for the bug this replaces.
 *
 * Postgres-only. In file-storage dev mode (`DATABASE_TYPE=file`) this is a
 * no-op, matching the existing graceful-degradation pattern used elsewhere
 * in this codebase (e.g. `connectMongo()` in src/api/database/mongo.js).
 */

import config from '../../config/env.js';
import { query } from '../../api/database/postgres.js';
import { ClassificationEngine, CONFIRM_THRESHOLD } from './ClassificationEngine.js';
import { decodeTransfersFromTx, toHumanAmount } from './TokenTransferDecoder.js';
import { resolveTokenMetadata } from './TokenMetadataResolver.js';
import { priceForToken, NATIVE_USD_FALLBACK } from '../../config/tokenPrices.js';

function periodFromUnixSeconds(unixSeconds) {
  if (!unixSeconds) return null;
  const d = new Date(unixSeconds * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function resolveContractId(userId, contractAddress, chain) {
  const result = await query(
    `SELECT id FROM contracts WHERE user_id=$1 AND LOWER(target_address)=$2 AND target_chain=$3 LIMIT 1`,
    [userId, contractAddress.toLowerCase(), chain]
  );
  return result.rows[0]?.id || null;
}

async function loadInternalWallets(userId, contractId, contractAddress) {
  const result = await query(
    `SELECT address FROM wallet_registry WHERE user_id=$1 AND contract_id=$2`,
    [userId, contractId]
  );
  if (result.rows.length === 0) return [contractAddress.toLowerCase()];
  return result.rows.map((r) => r.address.toLowerCase());
}

async function loadContractRegistry(chain) {
  const result = await query(
    `SELECT address, label, protocol_type, default_account_code, confidence_weight
     FROM contract_registry WHERE chain=$1`,
    [chain]
  );
  const map = new Map();
  for (const row of result.rows) {
    map.set(row.address.toLowerCase(), {
      label: row.label,
      protocolType: row.protocol_type,
      defaultAccountCode: row.default_account_code,
      confidenceWeight: Number(row.confidence_weight),
    });
  }
  return map;
}

async function loadRecurringPatterns(userId, contractId, internalWallets) {
  const result = await query(
    `SELECT tt.from_address, tt.to_address, cr.proposed_account_code
     FROM classification_results cr
     JOIN token_transfers tt ON tt.id = cr.transfer_id
     WHERE cr.user_id=$1 AND cr.contract_id=$2 AND cr.status='confirmed'`,
    [userId, contractId]
  );
  const map = new Map();
  for (const row of result.rows) {
    const from = row.from_address.toLowerCase();
    const to = row.to_address.toLowerCase();
    const counterparty = internalWallets.has(from) ? to : from;
    if (!internalWallets.has(counterparty)) map.set(counterparty, row.proposed_account_code);
  }
  return map;
}

async function upsertRawTransaction(chain, tx) {
  const result = await query(
    `INSERT INTO raw_transactions
       (chain, tx_hash, block_number, block_timestamp, from_address, to_address,
        value_native, gas_used, gas_price_native, method_signature, raw_input_data)
     VALUES ($1,$2,$3,to_timestamp($4),$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (chain, tx_hash) DO UPDATE SET tx_hash = EXCLUDED.tx_hash
     RETURNING id`,
    [
      chain,
      tx.hash,
      tx.blockNumber || 0,
      tx.blockTimestamp || null,
      (tx.from || '').toLowerCase(),
      (tx.to || '').toLowerCase(),
      safeBigIntToDecimalString(tx.value),
      tx.gasUsed ? safeBigIntToDecimalString(tx.gasUsed) : null,
      tx.gasPrice ? safeBigIntToDecimalString(tx.gasPrice) : null,
      tx.input && tx.input.length >= 10 ? tx.input.slice(0, 10) : null,
      tx.input || null,
    ]
  );
  return result.rows[0].id;
}

function safeBigIntToDecimalString(hexOrDec) {
  if (!hexOrDec || hexOrDec === '0x0' || hexOrDec === '0') return '0';
  try {
    return BigInt(hexOrDec).toString();
  } catch {
    return '0';
  }
}

async function upsertTokenTransfer(txId, transfer) {
  const result = await query(
    `INSERT INTO token_transfers
       (tx_id, token_contract, token_symbol, token_decimals, from_address, to_address, amount, log_index)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (tx_id, log_index) DO UPDATE SET amount = EXCLUDED.amount
     RETURNING id`,
    [
      txId,
      transfer.tokenContract,
      transfer.symbol,
      transfer.decimals,
      transfer.from,
      transfer.to,
      transfer.humanAmount,
      transfer.logIndex ?? 0,
    ]
  );
  return result.rows[0].id;
}

/**
 * Decode every transfer (ERC-20 events + native value) carried by one
 * collected transaction, each tagged with resolved symbol/decimals.
 */
async function decodeAllTransfers(rpcClient, chain, tx) {
  const transfers = [];

  const erc20Transfers = decodeTransfersFromTx(tx);
  for (const t of erc20Transfers) {
    const { symbol, decimals } = await resolveTokenMetadata(rpcClient, chain, t.tokenContract);
    transfers.push({
      tokenContract: t.tokenContract,
      symbol,
      decimals,
      from: t.from,
      to: t.to,
      humanAmount: toHumanAmount(t.rawAmount, decimals),
      logIndex: t.logIndex ?? 0,
    });
  }

  // Native-asset transfer (backward-scan path — real tx.value, no event log)
  const nativeValue = safeBigIntToDecimalString(tx.value);
  if (erc20Transfers.length === 0 && nativeValue !== '0' && tx.from && tx.to) {
    transfers.push({
      tokenContract: null,
      symbol: 'ETH',
      decimals: 18,
      from: tx.from.toLowerCase(),
      to: tx.to.toLowerCase(),
      humanAmount: toHumanAmount(nativeValue, 18),
      logIndex: 0,
    });
  }

  return transfers;
}

/**
 * Ingest a batch of already-fetched transactions (trigger-indexing.js's
 * `collectedTxs`) into the ledger: decode -> classify -> post.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.contractAddress
 * @param {string} params.chain
 * @param {Array} params.collectedTxs - as built by trigger-indexing.js
 * @param {object} params.rpcClient - the same RPC client trigger-indexing.js uses
 * @returns {Promise<{transfersProcessed:number, ledgerEntriesWritten:number}|null>}
 *   null if skipped (non-Postgres mode, or contract not found)
 */
export async function ingestTransactions({ userId, contractAddress, chain, collectedTxs, rpcClient }) {
  if (config.databaseType !== 'postgres') return null; // file-storage dev mode — nothing to ingest into
  if (!Array.isArray(collectedTxs) || collectedTxs.length === 0) return { transfersProcessed: 0, ledgerEntriesWritten: 0 };

  try {
    const contractId = await resolveContractId(userId, contractAddress, chain);
    if (!contractId) return null;

    const internalWalletList = await loadInternalWallets(userId, contractId, contractAddress);
    const internalWallets = new Set(internalWalletList);
    const [contractRegistry, recurringPatterns] = await Promise.all([
      loadContractRegistry(chain),
      loadRecurringPatterns(userId, contractId, internalWallets),
    ]);

    const engine = new ClassificationEngine(internalWalletList, contractRegistry, recurringPatterns);

    let transfersProcessed = 0;
    let ledgerEntriesWritten = 0;

    for (const tx of collectedTxs) {
      const transfers = await decodeAllTransfers(rpcClient, chain, tx);
      if (transfers.length === 0) continue;

      const txId = await upsertRawTransaction(chain, tx);

      for (const transfer of transfers) {
        const transferId = await upsertTokenTransfer(txId, transfer);
        transfersProcessed++;

        const result = engine.classify(transfer);

        const classificationRow = await query(
          `INSERT INTO classification_results
             (transfer_id, user_id, contract_id, proposed_account_code, confidence, source, rationale, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (transfer_id) DO UPDATE SET
             proposed_account_code = EXCLUDED.proposed_account_code,
             confidence            = EXCLUDED.confidence,
             source                = EXCLUDED.source,
             rationale             = EXCLUDED.rationale
           RETURNING id`,
          [
            transferId, userId, contractId,
            result.proposedAccountCode, result.confidence, result.source, result.rationale, result.status,
          ]
        );
        const classificationId = classificationRow.rows[0].id;

        // Only post to the ledger if confidently classified, not internal,
        // and the token has a known USD price — never fabricate a price.
        if (result.confidence < CONFIRM_THRESHOLD || result.proposedAccountCode === 'INTERNAL') continue;

        const price = transfer.symbol === 'ETH' || transfer.symbol === 'WETH'
          ? NATIVE_USD_FALLBACK
          : priceForToken(transfer.symbol);
        if (price == null) continue;

        const usdAmount = Math.round(transfer.humanAmount * price * 100) / 100;
        const isInflow = !internalWallets.has(transfer.from); // frm not company => money coming in
        const period = periodFromUnixSeconds(tx.blockTimestamp) || null;
        if (!period) continue; // no timestamp — can't assign a period, skip posting

        await query(
          `INSERT INTO ledger_entries
             (user_id, contract_id, period, account_code, debit, credit, source, tx_id, classification_id, confidence)
           VALUES ($1,$2,$3,$4,$5,$6,'onchain',$7,$8,$9)`,
          [
            userId, contractId, period, result.proposedAccountCode,
            isInflow ? usdAmount : 0,
            isInflow ? 0 : usdAmount,
            txId, classificationId, result.confidence,
          ]
        );
        ledgerEntriesWritten++;
      }
    }

    return { transfersProcessed, ledgerEntriesWritten };
  } catch (err) {
    // Ledger ingestion must never break the indexing flow it's attached to.
    console.warn('[LedgerIngestionService] ingestion failed:', err.message);
    return null;
  }
}

export default { ingestTransactions };
