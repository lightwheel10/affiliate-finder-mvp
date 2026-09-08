import { DashboardRouteSkeleton } from '@/app/components/LoadingSkeletons';

// Child routes provide their own fallbacks; this covers the dashboard entry.
export default function Loading() {
  return <DashboardRouteSkeleton />;
}
