import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users table - stores user profile and subscription info
  users: defineTable({
    email: v.string(),
    name: v.string(),
    isOnboarded: v.boolean(),
    hasSubscription: v.boolean(),
    role: v.optional(v.string()),
    brand: v.optional(v.string()),
    plan: v.union(
      v.literal("free_trial"),
      v.literal("pro"),
      v.literal("business"),
      v.literal("enterprise")
    ),
    trialPlan: v.optional(v.union(v.literal("pro"), v.literal("business"))),
    trialStartDate: v.optional(v.string()),
    trialEndDate: v.optional(v.string()),
    bio: v.optional(v.string()),
    // Billing info
    billingLast4: v.optional(v.string()),
    billingBrand: v.optional(v.string()),
    billingExpiry: v.optional(v.string()),
    // Notification preferences
    emailMatches: v.optional(v.boolean()),
    emailReports: v.optional(v.boolean()),
    emailUpdates: v.optional(v.boolean()),
    appReplies: v.optional(v.boolean()),
    appReminders: v.optional(v.boolean()),
  }).index("by_email", ["email"]),

  // Saved affiliates - affiliates user has saved to their pipeline
  savedAffiliates: defineTable({
    userId: v.id("users"),
    title: v.string(),
    link: v.string(),
    domain: v.string(),
    snippet: v.string(),
    source: v.string(),
    isAffiliate: v.optional(v.boolean()),
    personName: v.optional(v.string()),
    summary: v.optional(v.string()),
    email: v.optional(v.string()),
    thumbnail: v.optional(v.string()),
    views: v.optional(v.string()),
    date: v.optional(v.string()),
    rank: v.optional(v.number()),
    keyword: v.optional(v.string()),
    savedAt: v.number(), // timestamp
    // Discovery method
    highlightedWords: v.optional(v.array(v.string())),
    discoveryMethodType: v.optional(v.string()), // 'competitor' | 'keyword' | 'topic' | 'tagged'
    discoveryMethodValue: v.optional(v.string()),
    isAlreadyAffiliate: v.optional(v.boolean()),
    isNew: v.optional(v.boolean()),
    // YouTube specific
    channelName: v.optional(v.string()),
    channelLink: v.optional(v.string()),
    channelThumbnail: v.optional(v.string()),
    channelVerified: v.optional(v.boolean()),
    channelSubscribers: v.optional(v.string()),
    duration: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_link", ["userId", "link"]),

  // Discovered affiliates - all affiliates found from searches
  discoveredAffiliates: defineTable({
    userId: v.id("users"),
    title: v.string(),
    link: v.string(),
    domain: v.string(),
    snippet: v.string(),
    source: v.string(),
    isAffiliate: v.optional(v.boolean()),
    personName: v.optional(v.string()),
    summary: v.optional(v.string()),
    email: v.optional(v.string()),
    thumbnail: v.optional(v.string()),
    views: v.optional(v.string()),
    date: v.optional(v.string()),
    rank: v.optional(v.number()),
    keyword: v.optional(v.string()),
    searchKeyword: v.string(), // which search found this
    discoveredAt: v.number(), // timestamp
    // Discovery method
    highlightedWords: v.optional(v.array(v.string())),
    discoveryMethodType: v.optional(v.string()), // 'competitor' | 'keyword' | 'topic' | 'tagged'
    discoveryMethodValue: v.optional(v.string()),
    isAlreadyAffiliate: v.optional(v.boolean()),
    isNew: v.optional(v.boolean()),
    // YouTube specific
    channelName: v.optional(v.string()),
    channelLink: v.optional(v.string()),
    channelThumbnail: v.optional(v.string()),
    channelVerified: v.optional(v.boolean()),
    channelSubscribers: v.optional(v.string()),
    duration: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_link", ["userId", "link"]),

  // Search history - track user's searches
  searches: defineTable({
    userId: v.id("users"),
    keyword: v.string(),
    sources: v.array(v.string()),
    resultsCount: v.number(),
    searchedAt: v.number(),
  }).index("by_user", ["userId"]),
});

