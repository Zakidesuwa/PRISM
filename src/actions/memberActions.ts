'use server';

import { branchAction } from '@/lib/action';
import { MemberService, type CreateMemberInput, type UpdateMemberInput } from '@/services/memberService';

const PAGES = ['/members', '/member-lookup', '/pos', '/daily-sales', '/reports', '/dividends'];

export async function createMemberAction(input: CreateMemberInput) {
  return branchAction(['MANAGER'], (user) => MemberService.create({ branchId: user.branchId, userId: user.id }, input), {
    revalidate: PAGES,
    message: (member) => `${member.fullName} registered as a member.`,
  });
}

export async function updateMemberAction(id: number, input: UpdateMemberInput) {
  return branchAction(['MANAGER'], (user) => MemberService.update({ branchId: user.branchId, userId: user.id }, id, input), {
    revalidate: PAGES,
    message: (member) => `${member.fullName} updated.`,
  });
}

export async function addShareCapitalAction(memberId: number, amount: string) {
  return branchAction(
    ['MANAGER'],
    (user) => MemberService.addShareCapital({ branchId: user.branchId, userId: user.id }, memberId, amount),
    { revalidate: PAGES, message: (member) => `Share capital added for ${member.fullName}.` }
  );
}

/** Cashiers collect payments at the till, so they may record them too. */
export async function recordMemberPaymentAction(memberId: number, amount: string) {
  return branchAction(
    ['MANAGER', 'CASHIER'],
    (user) => MemberService.recordPayment({ branchId: user.branchId, userId: user.id }, memberId, amount),
    { revalidate: PAGES, message: (member) => `Payment recorded for ${member.fullName}.` }
  );
}

export async function getMemberProfileAction(memberId: number) {
  return branchAction(['MANAGER', 'CASHIER'], async (user) => {
    const profile = await MemberService.getProfile(user.branchId, memberId);
    if (!profile) throw new Error('Member not found.');
    return profile;
  });
}
