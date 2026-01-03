/**
 * Loading Screen (January 3rd, 2026)
 * 
 * This file is rendered by Next.js during page transitions using React Suspense.
 * Previously returned an empty fragment which caused a white screen flash.
 * 
 * Now shows the AuthLoadingScreen for a smooth transition between pages.
 * 
 * See: https://nextjs.org/docs/app/api-reference/file-conventions/loading
 */

import { AuthLoadingScreen } from './components/AuthLoadingScreen';

export default function Loading() {
  return <AuthLoadingScreen />;
}
