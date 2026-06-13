import { redirect } from 'next/navigation';

// Batch board merged into Home (workbook PR 4). BatchClient is deleted in
// PR 6; this redirect keeps old links/bookmarks working.
export default function BatchPage() {
  redirect('/');
}
