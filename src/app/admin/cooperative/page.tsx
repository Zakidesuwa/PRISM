import { AdminService } from '@/services/adminService';
import CooperativeDirectory from './CooperativeDirectory';
import RegisterCooperative from './RegisterCooperative';

export default async function AdminCooperativePage() {
  const { cooperatives, stats } = await AdminService.getCooperatives();

  return (
    <>
      <RegisterCooperative />
      <CooperativeDirectory cooperatives={cooperatives} stats={stats} />
    </>
  );
}
