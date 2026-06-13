import { cachedAuth } from '@/lib/cache';
import { CompanyTabs } from '@/components/layout/CompanyTabs';

// Company workbook shell (workbook PR 2): one header + tab bar per company;
// every nested route (Bulan/payroll, Karyawan/employees, Data) renders
// inside it. The Access mental model: the company is the database, the
// tabs are its views.
export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const { supabase, user } = await cachedAuth();

  let name: string | null = null;
  let aktif = true;
  if (user) {
    const { data } = await supabase
      .from('companies')
      .select('name, aktif')
      .eq('id', companyId)
      .maybeSingle();
    name = data?.name ?? null;
    aktif = data?.aktif ?? true;
  }

  return (
    <div className="space-y-5">
      <CompanyTabs companyId={companyId} companyName={name} aktif={aktif} />
      {children}
    </div>
  );
}
