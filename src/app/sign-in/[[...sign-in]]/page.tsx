'use client';

import { SignIn, useUser } from "@stackframe/stack";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SignInPage() {
  const user = useUser();
  const router = useRouter();

  // Auto-redirect to home if already signed in
  useEffect(() => {
    if (user) {
      router.replace('/');
    }
  }, [user, router]);

  // Show loading while checking auth or redirecting
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFDFD]">
        <div className="w-8 h-8 border-2 border-[#D4E815] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Show sign-in form for unauthenticated users
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FDFDFD]">
      <div className="w-full max-w-md px-4">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-[#1A1D21] transition-colors mb-6"
        >
          <ArrowLeft size={16} />
          Back to Home
        </Link>
      </div>
      <SignIn automaticRedirect={true} />
    </div>
  );
}
