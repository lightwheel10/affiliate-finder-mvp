'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { Id } from '../../../convex/_generated/dataModel';

// User data type from Convex
export interface ConvexUserData {
  _id: Id<"users">;
  email: string;
  name: string;
  isOnboarded: boolean;
  hasSubscription: boolean;
  role?: string;
  brand?: string;
  plan: "free_trial" | "pro" | "business" | "enterprise";
  targetCountry?: string;
  targetLanguage?: string;
  competitors?: string[];
  topics?: string[];
  affiliateTypes?: string[];
}

/**
 * Hook to get or create the current user in Convex using Clerk identity
 */
export function useConvexUser() {
  const { user: clerkUser, isLoaded: clerkLoaded, isSignedIn } = useUser();
  const [convexUserId, setConvexUserId] = useState<Id<"users"> | null>(null);
  
  // Get email from Clerk user
  const email = clerkUser?.primaryEmailAddress?.emailAddress;
  const name = clerkUser?.fullName || clerkUser?.firstName || email?.split('@')[0] || 'User';
  
  // Query for existing user by email
  const existingUser = useQuery(
    api.users.getByEmail,
    email ? { email } : 'skip'
  );
  
  // Mutation to create/update user
  const upsertUser = useMutation(api.users.upsert);
  
  // Sync Clerk user to Convex
  useEffect(() => {
    async function syncUser() {
      if (!clerkLoaded || !isSignedIn || !email) {
        setConvexUserId(null);
        return;
      }
      
      // If user already exists in Convex, use their ID
      if (existingUser) {
        setConvexUserId(existingUser._id);
        return;
      }
      
      // If query has loaded (not undefined) and no user exists, create one
      if (existingUser === null) {
        try {
          const userId = await upsertUser({
            email,
            name,
            isOnboarded: false,
            hasSubscription: false,
            plan: 'free_trial',
          });
          setConvexUserId(userId);
        } catch (error) {
          console.error('Failed to create Convex user:', error);
        }
      }
    }
    
    syncUser();
  }, [clerkLoaded, isSignedIn, email, name, existingUser, upsertUser]);
  
  return {
    userId: convexUserId,
    user: existingUser as ConvexUserData | null | undefined,
    isLoading: !clerkLoaded || (isSignedIn && email && existingUser === undefined),
    isAuthenticated: isSignedIn && !!convexUserId,
    isOnboarded: existingUser?.isOnboarded ?? false,
    clerkUser,
    userName: name,
  };
}
