// src/data/surplusMockData.ts
// Sample members for the surplus distribution page, used until the database is
// connected. Mirrors the sample members on the Coop Members page.
import type { DistributionMember } from '@/lib/surplus/distribution';

export const SAMPLE_NET_SURPLUS = '1,000,000';

export const sampleDistributionMembers: DistributionMember[] = [
  {
    id: 1,
    memberCode: 'MEM-GC-001',
    fullName: 'Maria Santos',
    branchName: 'Gordon College',
    status: 'ACTIVE',
    patronageCentavos: 342050,
    shareCapitalCentavos: 1500000,
  },
  {
    id: 2,
    memberCode: 'MEM-SRE-002',
    fullName: 'Juan Dela Cruz',
    branchName: 'Sta. Rita Elementary',
    status: 'ACTIVE',
    patronageCentavos: 185000,
    shareCapitalCentavos: 1000000,
  },
  {
    id: 3,
    memberCode: 'MEM-THS-003',
    fullName: 'Robert Tan',
    branchName: 'Tapinac Senior High School',
    status: 'ACTIVE',
    patronageCentavos: 520000,
    shareCapitalCentavos: 2000000,
  },
  {
    id: 4,
    memberCode: 'MEM-OCN-004',
    fullName: 'Grace Villanueva',
    branchName: 'Olongapo City National High School',
    status: 'ACTIVE',
    patronageCentavos: 219000,
    shareCapitalCentavos: 1250000,
  },
];
