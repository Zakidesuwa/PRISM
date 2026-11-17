// scripts/verify-surplus-engine.ts
// Run with: npm run test:surplus-engine
import assert from 'node:assert/strict';
import {
  DEFAULT_RATES,
  DistributionError,
  DistributionMember,
  allocateProRata,
  computeDistribution,
  computeMemberPools,
  computeStatutoryFunds,
  getRateWarnings,
  parseMoneyToCentavos,
  parsePercentToBps,
} from '../src/lib/surplus/distribution';

const peso = (amount: number) => amount * 100;

function member(id: number, patronage: number, shareCapital: number): DistributionMember {
  return {
    id,
    memberCode: `MEM-${id}`,
    fullName: `Member ${id}`,
    branchName: 'Test Branch',
    status: 'ACTIVE',
    patronageCentavos: peso(patronage),
    shareCapitalCentavos: peso(shareCapital),
  };
}

let passed = 0;
let failed = 0;

function test(name: string, run: () => void) {
  try {
    run();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${error instanceof Error ? error.message : error}`);
  }
}

console.log('\nSurplus distribution engine\n');

test('Step 1: statutory funds on a ₱1,000,000 net surplus', () => {
  const funds = computeStatutoryFunds(peso(1_000_000), DEFAULT_RATES);
  assert.equal(funds.reserveFund, peso(100_000));
  assert.equal(funds.cetf, peso(100_000));
  assert.equal(funds.cdf, peso(30_000));
  assert.equal(funds.optionalFund, peso(70_000));
  assert.equal(funds.totalStatutory, peso(300_000));
});

test('Step 2: available surplus is ₱700,000', () => {
  const funds = computeStatutoryFunds(peso(1_000_000), DEFAULT_RATES);
  assert.equal(funds.availableSurplus, peso(700_000));
});

test('Step 3: pools are ₱210,000 patronage and ₱490,000 interest', () => {
  const pools = computeMemberPools(peso(700_000), DEFAULT_RATES);
  assert.equal(pools.patronageRefundPool, peso(210_000));
  assert.equal(pools.shareCapitalInterestPool, peso(490_000));
});

test('Member A: ₱10,000 of ₱500,000 patronage gets a ₱4,200 refund', () => {
  const result = computeDistribution({
    netSurplus: peso(1_000_000),
    members: [member(1, 10_000, 0), member(2, 490_000, 0)],
  });
  assert.equal(result.totalPatronage, peso(500_000));
  assert.equal(result.members[0].patronageRefund, peso(4_200));
  assert.equal(result.members[1].patronageRefund, peso(205_800));
});

test('Interest on share capital is pro-rata to share capital', () => {
  const result = computeDistribution({
    netSurplus: peso(1_000_000),
    members: [member(1, 0, 25_000), member(2, 0, 75_000)],
  });
  assert.equal(result.members[0].shareCapitalInterest, peso(122_500));
  assert.equal(result.members[1].shareCapitalInterest, peso(367_500));
  assert.equal(result.members[0].total, peso(122_500));
});

test('Member payouts add up to the pools exactly when shares do not divide evenly', () => {
  const result = computeDistribution({
    netSurplus: peso(1_000_000) + 1,
    members: [member(1, 3420.5, 15_000), member(2, 1850, 10_000), member(3, 5200, 20_000)],
  });
  const refunds = result.members.reduce((sum, m) => sum + m.patronageRefund, 0);
  const interests = result.members.reduce((sum, m) => sum + m.shareCapitalInterest, 0);
  assert.equal(refunds, result.patronageRefundPool);
  assert.equal(interests, result.shareCapitalInterestPool);
  assert.equal(
    result.totalStatutory + result.patronageRefundPool + result.shareCapitalInterestPool,
    result.netSurplus
  );
});

test('Leftover centavos go to the largest remainders', () => {
  assert.deepEqual(allocateProRata(100, [1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(allocateProRata(10, [1, 2]), [3, 7]);
});

test('A pool with no member basis stays undistributed', () => {
  const result = computeDistribution({
    netSurplus: peso(1_000_000),
    members: [member(1, 0, 10_000)],
  });
  assert.equal(result.members[0].patronageRefund, 0);
  assert.equal(result.undistributedPatronage, peso(210_000));
  assert.equal(result.undistributedInterest, 0);
});

test('Custom rates are applied', () => {
  const funds = computeStatutoryFunds(peso(250_000), {
    ...DEFAULT_RATES,
    reserveFundBps: 5000,
    optionalFundBps: 0,
  });
  assert.equal(funds.reserveFund, peso(125_000));
  assert.equal(funds.optionalFund, 0);
  assert.equal(funds.availableSurplus, peso(92_500));
});

test('Fractional centavos round half up', () => {
  // 3% of ₱0.50 = 1.5 centavos -> 2 centavos
  assert.equal(computeStatutoryFunds(50, DEFAULT_RATES).cdf, 2);
});

test('Statutory funds never exceed the net surplus', () => {
  const funds = computeStatutoryFunds(1, {
    reserveFundBps: 5000,
    cetfBps: 5000,
    cdfBps: 0,
    optionalFundBps: 0,
    patronagePoolBps: 3000,
  });
  assert.equal(funds.totalStatutory, 1);
  assert.equal(funds.availableSurplus, 0);
  assert.equal(funds.reserveFund, 1);
  assert.equal(funds.cetf, 0);
  assert.equal(funds.optionalFund, 0);
});

test('Invalid input is rejected', () => {
  assert.throws(() => computeDistribution({ netSurplus: 0, members: [] }), DistributionError);
  assert.throws(() => computeDistribution({ netSurplus: -100, members: [] }), DistributionError);
  assert.throws(
    () => computeStatutoryFunds(peso(1000), { ...DEFAULT_RATES, reserveFundBps: 9000 }),
    DistributionError
  );
  assert.throws(
    () => computeStatutoryFunds(peso(1000), { ...DEFAULT_RATES, cdfBps: -1 }),
    DistributionError
  );
});

test('Rate warnings follow the statutory limits', () => {
  assert.deepEqual(getRateWarnings(DEFAULT_RATES), []);
  assert.equal(
    getRateWarnings({ ...DEFAULT_RATES, reserveFundBps: 500, cetfBps: 1500 }).length,
    2
  );
});

test('Money and percentage parsing', () => {
  assert.equal(parseMoneyToCentavos('1,000,000'), peso(1_000_000));
  assert.equal(parseMoneyToCentavos('₱1500.5'), 150_050);
  assert.equal(parseMoneyToCentavos('15000.00'), peso(15_000));
  assert.equal(parseMoneyToCentavos(3420.5), 342_050);
  assert.equal(parseMoneyToCentavos('abc'), null);
  assert.equal(parseMoneyToCentavos('-5'), null);
  assert.equal(parseMoneyToCentavos('1.234'), null);
  assert.equal(parsePercentToBps('10'), 1000);
  assert.equal(parsePercentToBps('3.5'), 350);
  assert.equal(parsePercentToBps('100.01'), null);
  assert.equal(parsePercentToBps(''), null);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
