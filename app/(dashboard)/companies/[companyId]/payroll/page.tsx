import { redirect } from 'next/navigation';

// Payroll index → current month (workbook PR 2). The 12-month grid is
// superseded by the MonthSwitcher in the month header (and REKAP in PR 3).
export default async function PayrollIndexPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const now = new Date();
  redirect(`/companies/${companyId}/payroll/${now.getFullYear()}/${now.getMonth() + 1}`);
}
