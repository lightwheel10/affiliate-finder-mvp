import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get user by email
export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});

// Get user by ID
export const get = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create or update user (upsert)
export const upsert = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    isOnboarded: v.optional(v.boolean()),
    hasSubscription: v.optional(v.boolean()),
    role: v.optional(v.string()),
    brand: v.optional(v.string()),
    plan: v.optional(
      v.union(
        v.literal("free_trial"),
        v.literal("pro"),
        v.literal("business"),
        v.literal("enterprise")
      )
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        ...(args.isOnboarded !== undefined && { isOnboarded: args.isOnboarded }),
        ...(args.hasSubscription !== undefined && { hasSubscription: args.hasSubscription }),
        ...(args.role && { role: args.role }),
        ...(args.brand && { brand: args.brand }),
        ...(args.plan && { plan: args.plan }),
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      email: args.email,
      name: args.name,
      isOnboarded: args.isOnboarded ?? false,
      hasSubscription: args.hasSubscription ?? false,
      plan: args.plan ?? "free_trial",
      emailMatches: true,
      emailReports: true,
      emailUpdates: true,
      appReplies: true,
      appReminders: true,
    });
  },
});

// Update user profile
export const updateProfile = mutation({
  args: {
    id: v.id("users"),
    name: v.optional(v.string()),
    isOnboarded: v.optional(v.boolean()),
    hasSubscription: v.optional(v.boolean()),
    role: v.optional(v.string()),
    brand: v.optional(v.string()),
    bio: v.optional(v.string()),
    plan: v.optional(
      v.union(
        v.literal("free_trial"),
        v.literal("pro"),
        v.literal("business"),
        v.literal("enterprise")
      )
    ),
    trialPlan: v.optional(v.union(v.literal("pro"), v.literal("business"))),
    trialStartDate: v.optional(v.string()),
    trialEndDate: v.optional(v.string()),
    // Billing
    billingLast4: v.optional(v.string()),
    billingBrand: v.optional(v.string()),
    billingExpiry: v.optional(v.string()),
    // Notifications
    emailMatches: v.optional(v.boolean()),
    emailReports: v.optional(v.boolean()),
    emailUpdates: v.optional(v.boolean()),
    appReplies: v.optional(v.boolean()),
    appReminders: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    // Filter out undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(id, cleanUpdates);
  },
});

// Start free trial
export const startFreeTrial = mutation({
  args: {
    id: v.id("users"),
    selectedPlan: v.union(v.literal("pro"), v.literal("business")),
  },
  handler: async (ctx, args) => {
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    await ctx.db.patch(args.id, {
      hasSubscription: true,
      plan: "free_trial",
      trialPlan: args.selectedPlan,
      trialStartDate: now.toISOString(),
      trialEndDate: trialEnd.toISOString(),
    });
  },
});

// Cancel trial
export const cancelTrial = mutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      hasSubscription: false,
      plan: "free_trial",
      trialPlan: undefined,
      trialStartDate: undefined,
      trialEndDate: undefined,
    });
  },
});

// Complete subscription
export const completeSubscription = mutation({
  args: {
    id: v.id("users"),
    plan: v.union(
      v.literal("free_trial"),
      v.literal("pro"),
      v.literal("business"),
      v.literal("enterprise")
    ),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {
      hasSubscription: true,
      plan: args.plan,
    };

    if (args.plan !== "free_trial") {
      updates.billingLast4 = "4242";
      updates.billingBrand = "Visa";
      updates.billingExpiry = "12/2028";
      updates.trialPlan = undefined;
      updates.trialStartDate = undefined;
      updates.trialEndDate = undefined;
    }

    await ctx.db.patch(args.id, updates);
  },
});

