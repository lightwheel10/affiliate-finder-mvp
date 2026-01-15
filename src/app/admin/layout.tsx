import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { jwtVerify } from 'jose';
import { AdminSidebar } from './components/AdminSidebar';

// Admin UI refresh (neo-brutalist, light-only) - January 15th, 2026
// Aligns admin section visuals with the updated product design language.

// Get secret as Uint8Array for jose
function getJwtSecret(): Uint8Array {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    throw new Error('ADMIN_JWT_SECRET is not configured');
  }
  return new TextEncoder().encode(secret);
}

async function verifyAdminSession(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_session')?.value;

    if (!token) {
      return false;
    }

    await jwtVerify(token, getJwtSecret());
    return true;
  } catch {
    return false;
  }
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check if we're on the login page
  // We need to allow the login page to render without auth
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_session')?.value;
  
  // Get the current path from headers (Next.js 15 way)
  const isLoginPage = typeof window === 'undefined' ? false : window.location.pathname === '/admin/login';
  
  // For server-side, we check auth for all pages except login
  // The login page has its own layout effectively
  if (!token) {
    // If no token, redirect to login (except if already on login page)
    // This will be handled by the page itself
  }

  // Verify session for authenticated pages
  const isAuthenticated = await verifyAdminSession();

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-[#111827]">
        {isAuthenticated ? (
          <div className="flex">
            <AdminSidebar />
            <main className="flex-1 ml-56 min-h-screen bg-[#FDFDFD]">
              {children}
            </main>
          </div>
        ) : (
          // For login page or unauthenticated state
          <>{children}</>
        )}
    </div>
  );
}
