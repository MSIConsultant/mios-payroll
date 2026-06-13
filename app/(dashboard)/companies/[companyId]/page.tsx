import { redirect } from 'next/navigation';

// Company root → current month's sheet (workbook PR 2). The old detail page
// content moved into the workbook tabs: employee table → /employees,
// company info/edit/archive → /data.
export default async function CompanyRootPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const now = new Date();
  redirect(`/companies/${companyId}/payroll/${now.getFullYear()}/${now.getMonth() + 1}`);
}
