/**
 * Integration-style unit test for LedgerIngestionService, with the Postgres
 * `query()` helper mocked (no real database available in this environment —
 * see the Phase 1 plan's verification section). Drives `ingestTransactions`
 * through a realistic pair of decoded ERC-20 Transfer logs and asserts on
 * the actual SQL statements issued, so the decode -> classify -> post
 * pipeline is exercised end-to-end without a live Postgres instance.
 */

import { jest } from '@jest/globals';

// jest.mock factories may only reference mock-prefixed outer variables (babel
// hoisting restriction) — all shared fixture values are named accordingly.
const MOCK_CONTRACT_ADDRESS = '0xtokencontract00000000000000000000000001';
const MOCK_CONTRACT_ID = 'contract-uuid-1';
const MOCK_USER_ID = 'user-uuid-1';
const MOCK_CHAIN = 'ethereum';
const MOCK_CEX_WITHDRAWAL = '0xcoinbasewithdrawal0000000000000000000002';
const MOCK_UNKNOWN_COUNTERPARTY = '0xunknownaddress00000000000000000000000009';

const ERC20_TRANSFER_TOPIC0 = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

jest.mock('../../src/api/database/postgres.js', () => ({
  query: jest.fn(async (sql) => {
    if (sql.includes('FROM contracts WHERE user_id')) {
      return { rows: [{ id: MOCK_CONTRACT_ID }] };
    }
    if (sql.includes('FROM wallet_registry')) {
      return { rows: [] }; // no explicit registry -> defaults to contractAddress as sole internal wallet
    }
    if (sql.includes('FROM contract_registry')) {
      return {
        rows: [{
          address: MOCK_CEX_WITHDRAWAL,
          label: 'Coinbase Prime Withdrawal',
          protocol_type: 'cex',
          default_account_code: '4020',
          confidence_weight: 0.95,
        }],
      };
    }
    if (sql.includes('FROM classification_results') && sql.includes('JOIN token_transfers')) {
      return { rows: [] }; // no prior confirmed classifications yet
    }
    if (sql.startsWith('INSERT INTO raw_transactions')) {
      return { rows: [{ id: `raw-${Math.random()}` }] };
    }
    if (sql.startsWith('INSERT INTO token_transfers')) {
      return { rows: [{ id: `transfer-${Math.random()}` }] };
    }
    if (sql.startsWith('INSERT INTO classification_results')) {
      return { rows: [{ id: `classification-${Math.random()}` }] };
    }
    if (sql.startsWith('INSERT INTO ledger_entries')) {
      return { rows: [] };
    }
    throw new Error(`Unmocked query in test: ${sql}`);
  }),
}));

// Mutable config mock — tests flip `config.databaseType` directly.
jest.mock('../../src/config/env.js', () => ({ default: { databaseType: 'postgres' } }));

import config from '../../src/config/env.js';
import { query } from '../../src/api/database/postgres.js';
import { ingestTransactions } from '../../src/services/ledger/LedgerIngestionService.js';
import { _clearCacheForTests } from '../../src/services/ledger/TokenMetadataResolver.js';

function padAddressTopic(address) {
  return '0x' + '0'.repeat(24) + address.replace('0x', '');
}

function buildTransferLog({ tokenContract, from, to, amount, logIndex }) {
  return {
    address: tokenContract,
    topics: [ERC20_TRANSFER_TOPIC0, padAddressTopic(from), padAddressTopic(to)],
    data: '0x' + amount.toString(16),
    transactionHash: `0xtx-${from}-${to}`,
    logIndex: '0x' + logIndex.toString(16),
  };
}

function encodeDynamicString(str) {
  const dataHex = Buffer.from(str, 'utf8').toString('hex').padEnd(64, '0');
  const lengthHex = str.length.toString(16).padStart(64, '0');
  const offsetHex = (32).toString(16).padStart(64, '0');
  return '0x' + offsetHex + lengthHex + dataHex;
}

const fakeRpcClient = { _makeRpcCall: jest.fn() };

beforeEach(() => {
  query.mockClear();
  config.databaseType = 'postgres';
  _clearCacheForTests();
  fakeRpcClient._makeRpcCall.mockReset();
  fakeRpcClient._makeRpcCall.mockImplementation(async (method, params) => {
    if (method !== 'eth_call') throw new Error(`unexpected rpc method: ${method}`);
    const selector = params[0].data;
    if (selector === '0x313ce567') return '0x' + '6'.padStart(64, '0'); // decimals() -> 6
    if (selector === '0x95d89b41') return encodeDynamicString('USDC'); // symbol()
    throw new Error(`unexpected selector: ${selector}`);
  });
});

describe('LedgerIngestionService.ingestTransactions', () => {
  test('posts a ledger entry for a confidently-classified, priced transfer; skips a low-confidence one', async () => {
    const confidentTx = {
      hash: '0xtx-confident',
      from: MOCK_CEX_WITHDRAWAL,
      to: MOCK_CONTRACT_ADDRESS,
      value: '0x0',
      blockNumber: 100,
      blockTimestamp: Math.floor(new Date('2026-07-01').getTime() / 1000),
      events: [buildTransferLog({
        tokenContract: MOCK_CONTRACT_ADDRESS, from: MOCK_CEX_WITHDRAWAL, to: MOCK_CONTRACT_ADDRESS,
        amount: 10_000_000_000n, // 10,000 USDC at 6 decimals
        logIndex: 0,
      })],
    };

    const unresolvedTx = {
      hash: '0xtx-unresolved',
      from: MOCK_UNKNOWN_COUNTERPARTY,
      to: MOCK_CONTRACT_ADDRESS,
      value: '0x0',
      blockNumber: 101,
      blockTimestamp: Math.floor(new Date('2026-07-02').getTime() / 1000),
      events: [buildTransferLog({
        tokenContract: MOCK_CONTRACT_ADDRESS, from: MOCK_UNKNOWN_COUNTERPARTY, to: MOCK_CONTRACT_ADDRESS,
        amount: 3_200_000_000n,
        logIndex: 0,
      })],
    };

    const result = await ingestTransactions({
      userId: MOCK_USER_ID,
      contractAddress: MOCK_CONTRACT_ADDRESS,
      chain: MOCK_CHAIN,
      collectedTxs: [confidentTx, unresolvedTx],
      rpcClient: fakeRpcClient,
    });

    expect(result).toEqual({ transfersProcessed: 2, ledgerEntriesWritten: 1 });

    const classificationInserts = query.mock.calls.filter(([sql]) => sql.startsWith('INSERT INTO classification_results'));
    expect(classificationInserts).toHaveLength(2);
    expect(classificationInserts[0][1]).toEqual(
      expect.arrayContaining(['4020', 0.95, 'rule', expect.any(String), 'confirmed'])
    );
    expect(classificationInserts[1][1]).toEqual(
      expect.arrayContaining(['4040', 0.30, 'unresolved', expect.any(String), 'pending'])
    );

    const ledgerInserts = query.mock.calls.filter(([sql]) => sql.startsWith('INSERT INTO ledger_entries'));
    expect(ledgerInserts).toHaveLength(1);
    // params: [userId, contractId, period, account_code, debit, credit, tx_id, classification_id, confidence]
    const [, , period, accountCode, debit, credit] = ledgerInserts[0][1];
    expect(period).toBe('2026-07');
    expect(accountCode).toBe('4020');
    expect(debit).toBe(10000); // 10,000 USDC @ $1 = $10,000, posted as debit (inflow)
    expect(credit).toBe(0);
  });

  test('is a no-op when databaseType is not postgres', async () => {
    config.databaseType = 'file';

    const result = await ingestTransactions({
      userId: MOCK_USER_ID, contractAddress: MOCK_CONTRACT_ADDRESS, chain: MOCK_CHAIN,
      collectedTxs: [{ hash: '0xany', events: [] }], rpcClient: fakeRpcClient,
    });

    expect(result).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });
});
