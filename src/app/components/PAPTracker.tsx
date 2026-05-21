"use client";

/**
 * PostAffiliatePro tracking script loader.
 *
 * 2026-05-20 (paras): Extracted from layout.tsx because Next.js Server
 * Components can't pass event handlers (`onLoad`) to children — this whole
 * component carries the "use client" directive so the function prop is legal.
 *
 * Drops PAP's tracking cookie on every page so when an affiliate sends a
 * visitor here via a ?a_aid=... URL, the cookie is set and later read in
 * OnboardingScreen.tsx (step 7) to attribute the eventual Stripe customer to
 * the right affiliate via the customer's `description` field.
 *
 * Loads with `afterInteractive` so it doesn't block first paint. The try/catch
 * in onLoad keeps a CDN hiccup or ad blocker from breaking the app.
 */
import Script from "next/script";

const PAP_ACCOUNT_ID = "44e6c33b";
const PAP_TRACKJS_SRC = "https://work.selecdoo.com/scripts/trackjs.js";

export function PAPTracker() {
  return (
    <Script
      id="pap-trackjs"
      src={PAP_TRACKJS_SRC}
      strategy="afterInteractive"
      onLoad={() => {
        try {
          const PAP = (window as unknown as { PostAffTracker?: {
            setAccountId: (id: string) => void;
            track: () => void;
          } }).PostAffTracker;
          if (PAP) {
            PAP.setAccountId(PAP_ACCOUNT_ID);
            PAP.track();
          }
        } catch (err) {
          console.warn("[PAP] tracking init failed:", err);
        }
      }}
    />
  );
}
