import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ============================================
// SAVED AFFILIATES
// ============================================

// Get all saved affiliates for a user
export const getSaved = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const affiliates = await ctx.db
      .query("savedAffiliates")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
    return affiliates;
  },
});

// Check if an affiliate is saved
export const isSaved = query({
  args: { userId: v.id("users"), link: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("savedAffiliates")
      .withIndex("by_user_link", (q) =>
        q.eq("userId", args.userId).eq("link", args.link)
      )
      .first();
    return !!existing;
  },
});

// Save an affiliate
export const save = mutation({
  args: {
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
    // Discovery method
    highlightedWords: v.optional(v.array(v.string())),
    discoveryMethodType: v.optional(v.string()),
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
  },
  handler: async (ctx, args) => {
    // Check for duplicate
    const existing = await ctx.db
      .query("savedAffiliates")
      .withIndex("by_user_link", (q) =>
        q.eq("userId", args.userId).eq("link", args.link)
      )
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("savedAffiliates", {
      ...args,
      savedAt: Date.now(),
    });
  },
});

// Remove a saved affiliate
export const removeSaved = mutation({
  args: { userId: v.id("users"), link: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("savedAffiliates")
      .withIndex("by_user_link", (q) =>
        q.eq("userId", args.userId).eq("link", args.link)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

// ============================================
// DISCOVERED AFFILIATES
// ============================================

// Get all discovered affiliates for a user
export const getDiscovered = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const affiliates = await ctx.db
      .query("discoveredAffiliates")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
    return affiliates;
  },
});

// Save a discovered affiliate
export const saveDiscovered = mutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    link: v.string(),
    domain: v.string(),
    snippet: v.string(),
    source: v.string(),
    searchKeyword: v.string(),
    isAffiliate: v.optional(v.boolean()),
    personName: v.optional(v.string()),
    summary: v.optional(v.string()),
    email: v.optional(v.string()),
    thumbnail: v.optional(v.string()),
    views: v.optional(v.string()),
    date: v.optional(v.string()),
    rank: v.optional(v.number()),
    keyword: v.optional(v.string()),
    // Discovery method
    highlightedWords: v.optional(v.array(v.string())),
    discoveryMethodType: v.optional(v.string()),
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
  },
  handler: async (ctx, args) => {
    // Check for duplicate
    const existing = await ctx.db
      .query("discoveredAffiliates")
      .withIndex("by_user_link", (q) =>
        q.eq("userId", args.userId).eq("link", args.link)
      )
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("discoveredAffiliates", {
      ...args,
      discoveredAt: Date.now(),
    });
  },
});

// Batch save discovered affiliates
export const saveDiscoveredBatch = mutation({
  args: {
    userId: v.id("users"),
    searchKeyword: v.string(),
    affiliates: v.array(
      v.object({
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
        // Discovery method
        highlightedWords: v.optional(v.array(v.string())),
        discoveryMethodType: v.optional(v.string()),
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
    ),
  },
  handler: async (ctx, args) => {
    const insertedIds = [];

    for (const affiliate of args.affiliates) {
      // Check for duplicate
      const existing = await ctx.db
        .query("discoveredAffiliates")
        .withIndex("by_user_link", (q) =>
          q.eq("userId", args.userId).eq("link", affiliate.link)
        )
        .first();

      if (!existing) {
        const id = await ctx.db.insert("discoveredAffiliates", {
          userId: args.userId,
          searchKeyword: args.searchKeyword,
          discoveredAt: Date.now(),
          ...affiliate,
        });
        insertedIds.push(id);
      }
    }

    return insertedIds;
  },
});

// Remove a discovered affiliate
export const removeDiscovered = mutation({
  args: { userId: v.id("users"), link: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("discoveredAffiliates")
      .withIndex("by_user_link", (q) =>
        q.eq("userId", args.userId).eq("link", args.link)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

// Clear all discovered affiliates for a user
export const clearAllDiscovered = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("discoveredAffiliates")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    for (const item of all) {
      await ctx.db.delete(item._id);
    }
  },
});

