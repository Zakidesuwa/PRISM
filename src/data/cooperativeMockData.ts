// Synthetic school-cooperative directory for the admin prototype.
// Replace with real queries in Phase 2 — see IMPLEMENTATION_PLAN.md.

export type UnitLevel = 'Elementary' | 'High School' | 'College';
export type StockStatus = 'In Stock' | 'Low Stock' | 'Stock Out';

export interface Cooperative {
  id: number;
  name: string;
  address: string;
  level: UnitLevel;
  monthlyProfit: number;
  stockStatus: StockStatus;
}

/**
 * Park–Miller LCG. Integer-exact in IEEE doubles, so the generated rows are
 * byte-identical on the server and the client — no hydration mismatch.
 * (Math.random or Math.sin would break that.)
 */
function createRandom(seed: number) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;

  return () => {
    state = (state * 48271) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

const BARANGAYS = [
  'Asinan', 'Banicain', 'Barretto', 'East Bajac-Bajac', 'East Tapinac',
  'Gordon Heights', 'Kalaklan', 'Mabayuan', 'New Cabalan', 'New Ilalim',
  'New Kababae', 'New Kalalake', 'Old Cabalan', 'Pag-asa', 'Sta. Rita',
  'West Bajac-Bajac', 'West Tapinac',
];

const STREETS = [
  'Rizal Avenue', 'Magsaysay Drive', 'Fendler Street', 'Canda Street',
  'Gordon Avenue', 'Waterdam Road', 'National Highway', '18th Street',
  'Jolo Street', 'Iba Street',
];

const SCHOOL_TYPES: { suffix: string; level: UnitLevel }[] = [
  { suffix: 'Elementary School', level: 'Elementary' },
  { suffix: 'Central School', level: 'Elementary' },
  { suffix: 'Integrated School', level: 'Elementary' },
  { suffix: 'National High School', level: 'High School' },
  { suffix: 'Senior High School', level: 'High School' },
  { suffix: 'Science High School', level: 'High School' },
  { suffix: 'College', level: 'College' },
];

/** The five schools shown in the design, kept verbatim at the top of the list. */
const FEATURED: Cooperative[] = [
  {
    id: 1,
    name: 'Gordon College',
    address: 'Olongapo City Sports Complex, East Tapinac',
    level: 'College',
    monthlyProfit: 124500,
    stockStatus: 'In Stock',
  },
  {
    id: 2,
    name: 'Sta. Rita Elementary',
    address: 'Sta. Rita Road, Barangay Sta. Rita',
    level: 'Elementary',
    monthlyProfit: 88230.5,
    stockStatus: 'Low Stock',
  },
  {
    id: 3,
    name: 'Tapinac Senior High School',
    address: 'Donor Street, East Tapinac, Olongapo City',
    level: 'High School',
    monthlyProfit: 215900,
    stockStatus: 'Stock Out',
  },
  {
    id: 4,
    name: 'Olongapo City National High School',
    address: 'Rizal Avenue corner 14th Street, East Bajac-Bajac',
    level: 'High School',
    monthlyProfit: 92400,
    stockStatus: 'In Stock',
  },
  {
    id: 5,
    name: 'Balic-Balic Elementary',
    address: 'Waterdam Road, Balic-Balic, Sta. Rita',
    level: 'Elementary',
    monthlyProfit: 45120,
    stockStatus: 'In Stock',
  },
];

const TOTAL_COOPERATIVES = 142;

function generateRest(): Cooperative[] {
  const random = createRandom(20260722);
  const rows: Cooperative[] = [];

  for (let i = 0; i < TOTAL_COOPERATIVES - FEATURED.length; i += 1) {
    const barangay = BARANGAYS[i % BARANGAYS.length];
    const type = SCHOOL_TYPES[(i * 3 + 1) % SCHOOL_TYPES.length];
    const street = STREETS[(i * 7 + 2) % STREETS.length];

    // Bigger units carry bigger canteens, so profit scales with level.
    const base = type.level === 'College' ? 110000 : type.level === 'High School' ? 75000 : 40000;
    const spread = type.level === 'College' ? 120000 : type.level === 'High School' ? 95000 : 55000;

    // Roughly one in eight units needs attention, matching the alert count.
    const stockStatus: StockStatus =
      i % 12 === 5 ? 'Low Stock' : i % 27 === 9 ? 'Stock Out' : 'In Stock';

    rows.push({
      id: FEATURED.length + i + 1,
      name: `${barangay} ${type.suffix}`,
      address: `${street}, ${barangay}, Olongapo City`,
      level: type.level,
      monthlyProfit: Math.round((base + random() * spread) * 100) / 100,
      stockStatus,
    });
  }

  return rows;
}

export const cooperatives: Cooperative[] = [...FEATURED, ...generateRest()];

/** Headline figures, derived from the directory so they can never disagree. */
export const cooperativeStats = {
  totalMonthlyProfit: cooperatives.reduce((sum, coop) => sum + coop.monthlyProfit, 0),
  profitChange: 12.5,
  activeCooperatives: cooperatives.length,
  operationalEfficiency: 98,
  /** Daily average spend per student — not derivable from the directory. */
  avgTransaction: 42,
  stockAlerts: cooperatives.filter((coop) => coop.stockStatus !== 'In Stock').length,
};
