import { redirect } from 'next/navigation';

// The company list is now Home (workbook PR 4). CompaniesClient is deleted in
// PR 6; this redirect keeps old links/bookmarks working. Note: nested routes
// like /companies/[companyId]/... are unaffected — only the bare list moved.
export default function CompaniesPage() {
  redirect('/');
}
