import { redirect } from 'next/navigation';

/**
 * Keep old bookmarks working while brand and location management now lives as
 * a dedicated Settings tab.
 */
export default function BrandsPage() {
  redirect('/settings?tab=brands');
}
