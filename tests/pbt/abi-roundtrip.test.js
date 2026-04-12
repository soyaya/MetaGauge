// Feature: metagauge-full-implementation, Property 10: ABI JSON Round-Trip
import fc from 'fast-check';

const abiArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 20 }),
  type: fc.constantFrom('function', 'event', 'constructor'),
  inputs: fc.array(fc.record({
    name: fc.string({ minLength: 1, maxLength: 10 }),
    type: fc.constantFrom('uint256', 'address', 'bool', 'string', 'bytes32'),
    indexed: fc.boolean()
  }), { maxLength: 5 }),
  outputs: fc.array(fc.record({
    name: fc.string({ minLength: 1, maxLength: 10 }),
    type: fc.constantFrom('uint256', 'address', 'bool', 'string', 'bytes32')
  }), { maxLength: 3 }),
  stateMutability: fc.constantFrom('pure', 'view', 'nonpayable', 'payable')
});

describe('ABI JSON Round-Trip', () => {
  test('ABI survives JSON serialization round-trip', () => {
    fc.assert(fc.property(
      abiArb,
      (abi) => {
        const serialized = JSON.stringify(abi);
        const parsed = JSON.parse(serialized);
        
        return parsed.name === abi.name &&
               parsed.type === abi.type &&
               parsed.stateMutability === abi.stateMutability &&
               JSON.stringify(parsed.inputs) === JSON.stringify(abi.inputs) &&
               JSON.stringify(parsed.outputs) === JSON.stringify(abi.outputs);
      }
    ), { numRuns: 100 });
  });
});
