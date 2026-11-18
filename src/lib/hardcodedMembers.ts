// src/lib/hardcodedMembers.ts
// Hardcoded member directory for Gordon College School Cooperative.
import type { MemberProfile, MemberRow } from '@/services/memberService';

export interface HardcodedMemberRaw {
  id: number;
  memberCode: string;
  fullName: string;
  email: string;
  phone?: string;
  shareCapital: number;
  creditLimit: number;
  chargeBalance: number;
  accumulatedPatronage: number;
}

export const GORDON_COLLEGE_STUDENTS: HardcodedMemberRaw[] = [
  { id: 101, memberCode: '202310457', fullName: 'AGAPAY, AIKO HEART', email: '202310457@gordoncollege.edu.ph', shareCapital: 10000, creditLimit: 1500, chargeBalance: 0, accumulatedPatronage: 2450 },
  { id: 102, memberCode: '202311208', fullName: 'ALIPIO, CRISTINA', email: '202311208@gordoncollege.edu.ph', shareCapital: 10000, creditLimit: 1500, chargeBalance: 120, accumulatedPatronage: 1890 },
  { id: 103, memberCode: '202311229', fullName: 'ALVAREZ, LOUISE JELAINE', email: '202311229@gordoncollege.edu.ph', shareCapital: 10000, creditLimit: 1500, chargeBalance: 0, accumulatedPatronage: 3100 },
  { id: 104, memberCode: '202310606', fullName: 'AMPLOGIO, JENNYLYN', email: '202310606@gordoncollege.edu.ph', shareCapital: 10000, creditLimit: 1500, chargeBalance: 45, accumulatedPatronage: 2150 },
  { id: 105, memberCode: '202310907', fullName: 'AQUINO, IAN', email: '202310907@gordoncollege.edu.ph', shareCapital: 10000, creditLimit: 1500, chargeBalance: 0, accumulatedPatronage: 1420 },
  { id: 106, memberCode: '202310560', fullName: 'ARATEA, ROSEMARIE', email: '202310560@gordoncollege.edu.ph', shareCapital: 10000, creditLimit: 1500, chargeBalance: 250, accumulatedPatronage: 2890 },
  { id: 107, memberCode: '202310503', fullName: 'ARCEO, PAOLO RENZ', email: '202310503@gordoncollege.edu.ph', shareCapital: 10000, creditLimit: 1500, chargeBalance: 0, accumulatedPatronage: 1980 },
  { id: 108, memberCode: '202310799', fullName: 'ARENAS, JULIA ROSE', email: '202310799@gordoncollege.edu.ph', shareCapital: 10000, creditLimit: 1500, chargeBalance: 0, accumulatedPatronage: 2750 },
  { id: 109, memberCode: '202310883', fullName: 'BADAR, MAC ELROY', email: '202310883@gordoncollege.edu.ph', shareCapital: 10000, creditLimit: 1500, chargeBalance: 175, accumulatedPatronage: 3340 },
  { id: 110, memberCode: '202310567', fullName: 'BATALLONES, VINCENT THEODORE', email: '202310567@gordoncollege.edu.ph', shareCapital: 10000, creditLimit: 1500, chargeBalance: 0, accumulatedPatronage: 1620 },
  { id: 111, memberCode: '202311726', fullName: 'BERNARDINO, LYRESH ANN', email: '202311726@gordoncollege.edu.ph', shareCapital: 10000, creditLimit: 1500, chargeBalance: 0, accumulatedPatronage: 2900 },
  { id: 112, memberCode: '202310530', fullName: 'BOLUNTATE, JOHN CHRISTIAN', email: '202310530@gordoncollege.edu.ph', shareCapital: 10000, creditLimit: 1500, chargeBalance: 85, accumulatedPatronage: 1780 },
  { id: 113, memberCode: '202310889', fullName: 'CACPAL, CHRYSLER IVAN', email: '202310889@gordoncollege.edu.ph', shareCapital: 10000, creditLimit: 1500, chargeBalance: 0, accumulatedPatronage: 2240 },
  { id: 114, memberCode: '202311372', fullName: 'CASEJA, STEPHANIE', email: '202311372@gordoncollege.edu.ph', shareCapital: 10000, creditLimit: 1500, chargeBalance: 0, accumulatedPatronage: 2600 },
  { id: 115, memberCode: '202312277', fullName: 'DE OCAMPO, RICHARD', email: '202312277@gordoncollege.edu.ph', shareCapital: 15000, creditLimit: 2000, chargeBalance: 0, accumulatedPatronage: 4120 },
  { id: 116, memberCode: '202312057', fullName: 'DELA CRUZ, JAMES LAWRENCE', email: '202312057@gordoncollege.edu.ph', shareCapital: 10000, creditLimit: 1500, chargeBalance: 110, accumulatedPatronage: 1950 },
  { id: 117, memberCode: '202310449', fullName: 'DIMATE, ADRIAAN', email: '202310449@gordoncollege.edu.ph', shareCapital: 10000, creditLimit: 1500, chargeBalance: 0, accumulatedPatronage: 1540 },
  { id: 118, memberCode: '202312278', fullName: 'DIOSOMITO, MARKUZ GABRIEL', email: '202312278@gordoncollege.edu.ph', shareCapital: 15000, creditLimit: 2000, chargeBalance: 0, accumulatedPatronage: 4350 },
  { id: 119, memberCode: '202310706', fullName: 'ESPIRITU, JOSHUA PAOLO', email: '202310706@gordoncollege.edu.ph', shareCapital: 10000, creditLimit: 1500, chargeBalance: 60, accumulatedPatronage: 2080 },
  { id: 120, memberCode: '202310829', fullName: 'IBAÑEZ, ALLYNSON', email: '202310829@gordoncollege.edu.ph', shareCapital: 10000, creditLimit: 1500, chargeBalance: 0, accumulatedPatronage: 2310 },
  { id: 121, memberCode: '202311646', fullName: 'NILO, ALEXIES', email: '202311646@gordoncollege.edu.ph', shareCapital: 10000, creditLimit: 1500, chargeBalance: 0, accumulatedPatronage: 1870 },
  { id: 122, memberCode: '202311082', fullName: 'NORIAL, CHRIZELDA', email: '202311082@gordoncollege.edu.ph', shareCapital: 10000, creditLimit: 1500, chargeBalance: 140, accumulatedPatronage: 2490 },
  { id: 123, memberCode: '202312286', fullName: 'PANGAN, JERALD', email: '202312286@gordoncollege.edu.ph', shareCapital: 10000, creditLimit: 1500, chargeBalance: 0, accumulatedPatronage: 2190 },
  { id: 124, memberCode: '202311770', fullName: 'REDONDO, KRISTEL', email: '202311770@gordoncollege.edu.ph', shareCapital: 10000, creditLimit: 1500, chargeBalance: 0, accumulatedPatronage: 2840 },
  { id: 125, memberCode: '202311237', fullName: 'REYES, ZOIE DRIZELLA', email: '202311237@gordoncollege.edu.ph', shareCapital: 10000, creditLimit: 1500, chargeBalance: 95, accumulatedPatronage: 3020 },
  { id: 126, memberCode: '202312291', fullName: 'SACAY, JOVEN', email: '202312291@gordoncollege.edu.ph', shareCapital: 10000, creditLimit: 1500, chargeBalance: 0, accumulatedPatronage: 1720 },
  { id: 127, memberCode: '202312292', fullName: 'SELUBO, AARON', email: '202312292@gordoncollege.edu.ph', shareCapital: 10000, creditLimit: 1500, chargeBalance: 0, accumulatedPatronage: 2650 },
  { id: 128, memberCode: '202311209', fullName: 'SORITCHO, ALLYSON DANIELLE', email: '202311209@gordoncollege.edu.ph', shareCapital: 10000, creditLimit: 1500, chargeBalance: 0, accumulatedPatronage: 2980 },
  { id: 129, memberCode: '202312293', fullName: 'VERGARA, DENMARK DILAN', email: '202312293@gordoncollege.edu.ph', shareCapital: 10000, creditLimit: 1500, chargeBalance: 50, accumulatedPatronage: 3150 },
  { id: 130, memberCode: '202310694', fullName: 'YEE, JOMMEL', email: '202310694@gordoncollege.edu.ph', shareCapital: 10000, creditLimit: 1500, chargeBalance: 0, accumulatedPatronage: 2210 },
];

export function toHardcodedMemberRow(raw: HardcodedMemberRaw): MemberRow {
  const availableCredit = Math.max(0, raw.creditLimit - raw.chargeBalance);
  return {
    id: raw.id,
    memberCode: raw.memberCode,
    fullName: raw.fullName,
    email: raw.email,
    phone: raw.phone ?? '0917-000-0000',
    status: 'ACTIVE',
    shareCapital: raw.shareCapital,
    accumulatedPatronage: raw.accumulatedPatronage,
    chargeBalance: raw.chargeBalance,
    creditLimit: raw.creditLimit,
    availableCredit,
    joinedAt: '2023-08-15T00:00:00.000Z',
  };
}

export function searchHardcodedMembers(query: string): MemberRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return GORDON_COLLEGE_STUDENTS.filter(
    (m) =>
      m.memberCode.toLowerCase().includes(q) ||
      m.fullName.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
  ).map(toHardcodedMemberRow);
}

export function getHardcodedMemberProfile(memberId: number): MemberProfile | null {
  const raw = GORDON_COLLEGE_STUDENTS.find((m) => m.id === memberId);
  if (!raw) return null;

  const row = toHardcodedMemberRow(raw);
  return {
    ...row,
    ledger: [
      {
        id: 1,
        type: 'SHARE_CAPITAL',
        amount: raw.shareCapital,
        chargeBalanceAfter: 0,
        shareCapitalAfter: raw.shareCapital,
        reference: 'INITIAL-SUB',
        note: 'Initial share capital subscription',
        createdAt: '2023-08-15T08:00:00.000Z',
      },
      ...(raw.chargeBalance > 0
        ? [
            {
              id: 2,
              type: 'CHARGE',
              amount: raw.chargeBalance,
              chargeBalanceAfter: raw.chargeBalance,
              shareCapitalAfter: raw.shareCapital,
              reference: '#1042',
              note: 'Canteen POS charge purchase',
              createdAt: '2026-11-15T10:30:00.000Z',
            },
          ]
        : []),
    ],
    purchases: [
      {
        id: 'tx-1',
        transactionNumber: '#1048',
        totalAmount: 185.0,
        paymentMethod: raw.chargeBalance > 0 ? 'CHARGE' : 'CASH',
        status: 'COMPLETED',
        createdAt: '2026-11-18T10:15:00.000Z',
      },
      {
        id: 'tx-2',
        transactionNumber: '#1039',
        totalAmount: 95.0,
        paymentMethod: 'CASH',
        status: 'COMPLETED',
        createdAt: '2026-11-17T14:20:00.000Z',
      },
    ],
  };
}
