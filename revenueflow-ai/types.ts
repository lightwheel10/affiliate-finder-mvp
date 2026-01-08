export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
}

export type Language = 'en' | 'de';

export interface Service {
  id: string;
  title: string;
  description: string;
  category: 'Outbound' | 'Inbound' | 'Operations' | 'Strategy';
  price: string;
  originalPrice: string;
  tags: string[];
}

export interface Testimonial {
  id: string;
  name: string;
  company: string;
  text: string;
}