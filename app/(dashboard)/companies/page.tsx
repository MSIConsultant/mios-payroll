import { redirect } from 'next/navigation';

// The company list is now Home. This redirect keeps old links/bookmarks
// working. Nested routes like /companies/[companyId]/... are unaffected —
// only the bare list moved.
export default function CompaniesPage() {
  redirect('/');
}
