import { redirect } from 'next/navigation';

// Dashboard was merged into Home — the KPI cards / status board / recent-runs
// content now live on the company-database list at /. This redirect keeps old
// links/bookmarks working.
export default function DashboardPage() {
  redirect('/');
}
