import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Define public routes that don't require authentication
const publicRoutes = [
  "/",
  "/sign-in",
  "/sign-up",
  "/handler", // Stack Auth handler routes
  "/api/webhook",
  "/api/stripe/webhook", // Stripe webhook - secured by signature verification
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the route is public
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Allow public routes and static files
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // For protected routes, Stack Auth handles auth via the StackProvider
  // The actual auth check happens client-side with useUser({ or: "redirect" })
  // This middleware just ensures the request passes through
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
