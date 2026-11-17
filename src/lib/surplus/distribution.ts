// src/lib/surplus/distribution.ts
//
// Net surplus distribution engine (Reserve Fund, CETF, CDF, Optional Fund,
// Patronage Refund, Interest on Share Capital).
//
// Pure and dependency-free so the same code runs on the server, in the browser
// and in scripts. All money is integer centavos and all rates are basis points
// (1% = 100 bps), so no floating-point arithmetic touches an amount.

export interface DistributionRates {
  /** Reserve Fund — share of net surplus. */
  reserveFundBps: number;
  /** Cooperative Education and Training Fund — share of net surplus. */
  cetfBps: number;
  /** Community Development Fund — share of net surplus. */
  cdfBps: number;
  /** Optional Fund — share of net surplus. */
  optionalFundBps: number;
  /**
   * Share of the surplus left after statutory funds that goes to the Patronage
   * Refund pool. The rest goes to Interest on Share Capital.
   */
  patronagePoolBps: number;
}

export const DEFAULT_RATES: DistributionRates = {
  reserveFundBps: 1000, // 10%
  cetfBps: 1000, // 10%
  cdfBps: 300, // 3%
  optionalFundBps: 700, // 7%
  patronagePoolBps: 3000, // 30% patronage / 70% interest on share capital
};

export interface DistributionMember {
  id: number;
  memberCode: string;
  fullName: string;
  branchName: string;
  status: string;
  /** Member's purchases (or interest paid) for the period, in centavos. */
  patronageCentavos: number;
  /** Member's paid-up share capital, in centavos. */
  shareCapitalCentavos: number;
}

export interface StatutoryFunds {
  reserveFund: number;
  cetf: number;
  cdf: number;
  optionalFund: number;
  totalStatutory: number;
  /** Net surplus left for members after the statutory funds. */
  availableSurplus: number;
}

export interface MemberPools {
  patronageRefundPool: number;
  shareCapitalInterestPool: number;
}

export interface MemberAllocation {
  memberId: number;
  patronageRefund: number;
  shareCapitalInterest: number;
  total: number;
}

export interface DistributionResult extends StatutoryFunds, MemberPools {
  netSurplus: number;
  rates: DistributionRates;
  /** Same order as the members passed in. */
  members: MemberAllocation[];
  totalPatronage: number;
  totalShareCapital: number;
  /** Pool money that could not be paid out because no member had a basis. */
  undistributedPatronage: number;
  undistributedInterest: number;
}

export class DistributionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DistributionError';
  }
}

const BPS_DENOMINATOR = 10000;

function assertAmount(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DistributionError(`${label} must be a non-negative whole number of centavos.`);
  }
}

/** amount × numerator ÷ denominator, rounded half up, without float error. */
function mulDivRoundHalfUp(amount: number, numerator: number, denominator: number): number {
  const two = BigInt(2);
  const product = BigInt(amount) * BigInt(numerator);
  const divisor = BigInt(denominator);
  return Number((product * two + divisor) / (two * divisor));
}

/**
 * Parses a peso amount ("1,000,000", "₱1500.50", 1500.5) into centavos.
 * Returns null when the input is not a valid non-negative amount.
 */
export function parseMoneyToCentavos(input: string | number): number | null {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0) return null;
    const centavos = Math.round(input * 100);
    return Number.isSafeInteger(centavos) ? centavos : null;
  }

  const cleaned = input.replace(/[₱,\s]/g, '');
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;

  const centavos = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(centavos) ? centavos : null;
}

/** Parses a percentage ("10", "3.5") into basis points. Null when invalid or over 100%. */
export function parsePercentToBps(input: string): number | null {
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;

  const bps = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return bps <= BPS_DENOMINATOR ? bps : null;
}

export function centavosToPesos(centavos: number): number {
  return centavos / 100;
}

export function validateRates(rates: DistributionRates) {
  const entries: [string, number][] = [
    ['Reserve Fund rate', rates.reserveFundBps],
    ['CETF rate', rates.cetfBps],
    ['CDF rate', rates.cdfBps],
    ['Optional Fund rate', rates.optionalFundBps],
    ['Patronage Refund share', rates.patronagePoolBps],
  ];

  for (const [label, bps] of entries) {
    if (!Number.isInteger(bps) || bps < 0 || bps > BPS_DENOMINATOR) {
      throw new DistributionError(`${label} must be between 0% and 100%.`);
    }
  }

  const statutoryTotal =
    rates.reserveFundBps + rates.cetfBps + rates.cdfBps + rates.optionalFundBps;
  if (statutoryTotal > BPS_DENOMINATOR) {
    throw new DistributionError('Statutory fund rates add up to more than 100% of net surplus.');
  }
}

/**
 * Non-blocking checks against the statutory limits in RA 9520, Art. 86.
 * The engine still computes with out-of-range rates; these are shown as warnings.
 */
export function getRateWarnings(rates: DistributionRates): string[] {
  const warnings: string[] = [];
  if (rates.reserveFundBps < 1000) warnings.push('Reserve Fund should be at least 10% of net surplus.');
  if (rates.cetfBps > 1000) warnings.push('CETF should not exceed 10% of net surplus.');
  if (rates.cdfBps < 300) warnings.push('CDF should be at least 3% of net surplus.');
  if (rates.optionalFundBps > 700) warnings.push('Optional Fund should not exceed 7% of net surplus.');
  return warnings;
}

/** Step 1 and 2: statutory funds and the surplus left for members. */
export function computeStatutoryFunds(netSurplus: number, rates: DistributionRates): StatutoryFunds {
  assertAmount(netSurplus, 'Net surplus');
  validateRates(rates);

  // Rounding each fund up can overshoot by a centavo when rates total 100%,
  // so each fund is capped at what is still left of the net surplus.
  let remaining = netSurplus;
  const take = (bps: number) => {
    const amount = Math.min(mulDivRoundHalfUp(netSurplus, bps, BPS_DENOMINATOR), remaining);
    remaining -= amount;
    return amount;
  };

  const reserveFund = take(rates.reserveFundBps);
  const cetf = take(rates.cetfBps);
  const cdf = take(rates.cdfBps);
  const optionalFund = take(rates.optionalFundBps);

  return {
    reserveFund,
    cetf,
    cdf,
    optionalFund,
    totalStatutory: netSurplus - remaining,
    availableSurplus: remaining,
  };
}

/** Step 3a: split the available surplus into the two member pools. */
export function computeMemberPools(availableSurplus: number, rates: DistributionRates): MemberPools {
  assertAmount(availableSurplus, 'Available surplus');
  validateRates(rates);

  const patronageRefundPool = mulDivRoundHalfUp(
    availableSurplus,
    rates.patronagePoolBps,
    BPS_DENOMINATOR
  );

  // Interest takes the remainder so the two pools always add up exactly.
  return {
    patronageRefundPool,
    shareCapitalInterestPool: availableSurplus - patronageRefundPool,
  };
}

/**
 * Step 3b: share = (member basis ÷ total basis) × pool.
 *
 * Uses the largest-remainder method: every share is rounded down, then the
 * leftover centavos go to the largest fractional parts. The shares therefore
 * always add up to exactly the pool. Returns all zeros when nobody has a basis.
 */
export function allocateProRata(pool: number, bases: number[]): number[] {
  assertAmount(pool, 'Pool');
  bases.forEach((basis) => assertAmount(basis, 'Member basis'));

  const totalBasis = bases.reduce((sum, basis) => sum + basis, 0);
  if (pool === 0 || totalBasis === 0) return bases.map(() => 0);

  const bigPool = BigInt(pool);
  const bigTotal = BigInt(totalBasis);

  const shares: number[] = [];
  const remainders: bigint[] = [];
  let allocated = 0;

  for (const basis of bases) {
    const product = bigPool * BigInt(basis);
    const share = Number(product / bigTotal);
    shares.push(share);
    remainders.push(product % bigTotal);
    allocated += share;
  }

  const order = bases
    .map((_, index) => index)
    .sort((a, b) => {
      if (remainders[a] === remainders[b]) return a - b;
      return remainders[a] > remainders[b] ? -1 : 1;
    });

  let leftover = pool - allocated;
  for (const index of order) {
    if (leftover === 0) break;
    shares[index] += 1;
    leftover -= 1;
  }

  return shares;
}

/** Full distribution: statutory funds, member pools and each member's payout. */
export function computeDistribution(input: {
  netSurplus: number;
  rates?: DistributionRates;
  members: DistributionMember[];
}): DistributionResult {
  const rates = input.rates ?? DEFAULT_RATES;

  assertAmount(input.netSurplus, 'Net surplus');
  if (input.netSurplus === 0) {
    throw new DistributionError('Net surplus must be greater than zero to distribute.');
  }

  const funds = computeStatutoryFunds(input.netSurplus, rates);
  const pools = computeMemberPools(funds.availableSurplus, rates);

  const patronageBases = input.members.map((member) => member.patronageCentavos);
  const capitalBases = input.members.map((member) => member.shareCapitalCentavos);

  const refunds = allocateProRata(pools.patronageRefundPool, patronageBases);
  const interests = allocateProRata(pools.shareCapitalInterestPool, capitalBases);

  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

  return {
    netSurplus: input.netSurplus,
    rates,
    ...funds,
    ...pools,
    members: input.members.map((member, index) => ({
      memberId: member.id,
      patronageRefund: refunds[index],
      shareCapitalInterest: interests[index],
      total: refunds[index] + interests[index],
    })),
    totalPatronage: sum(patronageBases),
    totalShareCapital: sum(capitalBases),
    undistributedPatronage: pools.patronageRefundPool - sum(refunds),
    undistributedInterest: pools.shareCapitalInterestPool - sum(interests),
  };
}
