import { redirect } from 'next/navigation';

// Dashboard merged into Home (workbook PR 4). The KPI cards / status board /
// recent-runs content moved to the company-database list at /. The page is
// deleted in PR 6; this redirect keeps old links/bookmarks working.
export default function DashboardPage() {
  redirect('/');
}
