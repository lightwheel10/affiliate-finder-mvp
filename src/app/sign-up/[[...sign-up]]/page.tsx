import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function SignUpPage() {
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
      <SignUp 
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-xl border border-slate-200",
            headerTitle: "text-slate-900",
            headerSubtitle: "text-slate-500",
            socialButtonsBlockButton: "border-slate-200 hover:bg-slate-50",
            formButtonPrimary: "bg-[#D4E815] hover:bg-[#c5d913] text-[#1A1D21]",
            footerActionLink: "text-[#1A1D21] hover:text-[#D4E815]",
          },
        }}
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        forceRedirectUrl="/discovered"
      />
    </div>
  );
}

