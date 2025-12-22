'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Dashboard is temporarily hidden - redirect to home
// Original dashboard code is preserved in git history
export default function DashboardPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/');
  }, [router]);
  
  return null;
}
