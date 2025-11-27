import { ResultItem } from '../types';

const STORAGE_KEY = 'affiliate_finder_saved_v1';
const DISCOVERED_KEY = 'affiliate_finder_discovered_v1';

export interface SavedAffiliate extends ResultItem {
  savedAt: string;
}

export interface DiscoveredAffiliate extends ResultItem {
  discoveredAt: string;
  searchKeyword: string; // Track which search found this affiliate
}

export const getSavedAffiliates = (): SavedAffiliate[] => {
  if (typeof window === 'undefined') return [];
  try {
    const item = localStorage.getItem(STORAGE_KEY);
    return item ? JSON.parse(item) : [];
  } catch (e) {
    console.error('Failed to load saved affiliates', e);
    return [];
  }
};

export const saveAffiliate = (affiliate: ResultItem) => {
  const saved = getSavedAffiliates();
  if (saved.some(s => s.link === affiliate.link)) return; // Prevent duplicates

  const newSaved: SavedAffiliate = {
    ...affiliate,
    savedAt: new Date().toISOString()
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify([newSaved, ...saved]));
  window.dispatchEvent(new Event('pipeline-update'));
};

export const removeAffiliate = (link: string) => {
  const saved = getSavedAffiliates();
  const newSaved = saved.filter(s => s.link !== link);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newSaved));
  window.dispatchEvent(new Event('pipeline-update'));
};

export const isAffiliateSaved = (link: string): boolean => {
  const saved = getSavedAffiliates();
  return saved.some(s => s.link === link);
};

// ============================================
// DISCOVERED AFFILIATES (for "All Discovered" page)
// ============================================

export const getDiscoveredAffiliates = (): DiscoveredAffiliate[] => {
  if (typeof window === 'undefined') return [];
  try {
    const item = localStorage.getItem(DISCOVERED_KEY);
    return item ? JSON.parse(item) : [];
  } catch (e) {
    console.error('Failed to load discovered affiliates', e);
    return [];
  }
};

export const saveDiscoveredAffiliate = (affiliate: ResultItem, searchKeyword: string) => {
  const discovered = getDiscoveredAffiliates();
  
  // Check if already exists (by link)
  if (discovered.some(d => d.link === affiliate.link)) {
    return; // Prevent duplicates
  }

  const newDiscovered: DiscoveredAffiliate = {
    ...affiliate,
    discoveredAt: new Date().toISOString(),
    searchKeyword
  };

  // Add to beginning of array (newest first)
  localStorage.setItem(DISCOVERED_KEY, JSON.stringify([newDiscovered, ...discovered]));
  window.dispatchEvent(new Event('discovered-update'));
};

export const saveDiscoveredAffiliates = (affiliates: ResultItem[], searchKeyword: string) => {
  // Batch save multiple affiliates from a search
  affiliates.forEach(affiliate => {
    saveDiscoveredAffiliate(affiliate, searchKeyword);
  });
};

export const removeDiscoveredAffiliate = (link: string) => {
  const discovered = getDiscoveredAffiliates();
  const newDiscovered = discovered.filter(d => d.link !== link);
  localStorage.setItem(DISCOVERED_KEY, JSON.stringify(newDiscovered));
  window.dispatchEvent(new Event('discovered-update'));
};

export const clearAllDiscovered = () => {
  localStorage.removeItem(DISCOVERED_KEY);
  window.dispatchEvent(new Event('discovered-update'));
};

