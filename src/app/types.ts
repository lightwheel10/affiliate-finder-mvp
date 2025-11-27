export interface ResultItem {
  title: string;
  link: string;
  domain: string;
  snippet: string;
  source: string;
  isAffiliate?: boolean;
  personName?: string;
  summary?: string;
  email?: string;
  thumbnail?: string;
  views?: string;
  date?: string;
  highlightedWords?: string[];
  rank?: number;
  keyword?: string;
  discoveryMethod?: {
    type: 'competitor' | 'keyword' | 'topic' | 'tagged';
    value: string;
  };
  isAlreadyAffiliate?: boolean;
  isNew?: boolean;
}

