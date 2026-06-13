import { redirect } from 'next/navigation';

// Batch board was merged into Home (the company-database list). This redirect
// keeps old links/bookmarks working.
export default function BatchPage() {
  redirect('/');
}
