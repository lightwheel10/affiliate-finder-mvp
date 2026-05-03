/**
 * Shared email layout — Afforce One smoover design system.
 *
 * Color tokens mirror src/app/globals.css:
 *   #ffbf23 - brand yellow (CTAs / accents)
 *   #0f172a - heading text (near-black slate)
 *   #425466 - body text (soft slate)
 *   #8898aa - muted text (footer, secondary)
 *   #e6ebf1 - light border / divider
 *   #f6f9fc - off-white background
 *   #fdfdfd - canvas background (warm near-white)
 *
 * Typography:
 *   Inter is the app's primary sans-serif. We list it first with
 *   email-safe fallbacks (system fonts), since most email clients won't
 *   load Google Fonts. Inter renders only on clients that have it installed
 *   (e.g. Apple Mail on iOS/macOS, web Gmail with the user's system font).
 */
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Preview,
} from '@react-email/components';
import type { ReactNode } from 'react';

interface EmailLayoutProps {
  preview: string;
  children: ReactNode;
}

const fontStack = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

const bodyStyle = {
  fontFamily: fontStack,
  backgroundColor: '#f6f9fc',
  margin: 0,
  padding: 0,
  WebkitFontSmoothing: 'antialiased' as const,
};

const containerStyle = {
  maxWidth: 560,
  margin: '40px auto',
  backgroundColor: '#ffffff',
  padding: '40px 40px 32px',
  borderRadius: 16,
  border: '1px solid #e6ebf1',
  boxShadow: '0 4px 12px -2px rgba(16, 24, 40, 0.06), 0 2px 4px -2px rgba(16, 24, 40, 0.03)',
};

const brandRowStyle = {
  paddingBottom: 24,
  borderBottom: '1px solid #e6ebf1',
  marginBottom: 8,
};

const brandStyle = {
  fontFamily: fontStack,
  fontSize: 20,
  fontWeight: 700,
  color: '#0f172a',
  letterSpacing: '-0.02em',
  margin: 0,
  lineHeight: 1.2,
};

const brandAccentStyle = {
  ...brandStyle,
  display: 'inline' as const,
  color: '#ffbf23',
};

const dividerStyle = {
  borderColor: '#e6ebf1',
  margin: '32px 0 16px',
};

const footerStyle = {
  fontFamily: fontStack,
  fontSize: 12,
  color: '#8898aa',
  margin: 0,
  lineHeight: 1.6,
};

export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={brandRowStyle}>
            <Text style={brandStyle}>
              Afforce<span style={brandAccentStyle}> One</span>
            </Text>
          </Section>
          {children}
          <Hr style={dividerStyle} />
          <Text style={footerStyle}>
            Afforce One — AI-powered affiliate discovery for brands.
            <br />
            Need help? Just reply to this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// Shared style atoms — used by all email templates so they stay consistent.

export const emailStyles = {
  fontStack,
  heading: {
    fontFamily: fontStack,
    fontSize: 24,
    fontWeight: 700,
    color: '#0f172a',
    marginTop: 32,
    marginBottom: 0,
    letterSpacing: '-0.02em',
    lineHeight: 1.25,
  },
  paragraph: {
    fontFamily: fontStack,
    fontSize: 15,
    color: '#425466',
    lineHeight: 1.7,
    marginTop: 16,
    marginBottom: 0,
  },
  paragraphMuted: {
    fontFamily: fontStack,
    fontSize: 14,
    color: '#8898aa',
    lineHeight: 1.6,
    marginTop: 16,
    marginBottom: 0,
  },
  emphasis: {
    fontFamily: fontStack,
    fontSize: 15,
    color: '#0f172a',
    fontWeight: 600,
    lineHeight: 1.7,
    marginTop: 24,
    marginBottom: 0,
  },
  // Primary CTA — brand yellow with soft yellow glow shadow (matches landing page)
  primaryButton: {
    backgroundColor: '#ffbf23',
    color: '#0f172a',
    padding: '12px 28px',
    borderRadius: 9999,
    fontSize: 14,
    fontWeight: 700,
    marginTop: 28,
    textDecoration: 'none',
    display: 'inline-block',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    boxShadow: '0 4px 14px -2px rgba(255, 191, 35, 0.5)',
  },
  // Secondary CTA — neutral, used for less-urgent links
  secondaryButton: {
    backgroundColor: '#f6f9fc',
    color: '#0f172a',
    padding: '12px 24px',
    borderRadius: 9999,
    fontSize: 14,
    fontWeight: 600,
    marginTop: 16,
    textDecoration: 'none',
    display: 'inline-block',
    border: '1px solid #e6ebf1',
  },
  // Info card (for a stat / receipt detail block)
  infoCard: {
    backgroundColor: '#f6f9fc',
    border: '1px solid #e6ebf1',
    borderRadius: 12,
    padding: '20px 24px',
    marginTop: 24,
  },
  infoLabel: {
    fontFamily: fontStack,
    fontSize: 11,
    color: '#8898aa',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    margin: 0,
    lineHeight: 1.4,
  },
  infoValue: {
    fontFamily: fontStack,
    fontSize: 18,
    color: '#0f172a',
    fontWeight: 700,
    margin: '4px 0 0 0',
    lineHeight: 1.3,
  },
  // Highlight stat — large yellow number for the scan-digest hero
  heroStat: {
    fontFamily: fontStack,
    fontSize: 48,
    fontWeight: 800,
    color: '#ffbf23',
    margin: '24px 0 4px 0',
    lineHeight: 1,
    letterSpacing: '-0.03em',
  },
  // Alert card (for failures)
  alertCard: {
    backgroundColor: '#fff5f5',
    border: '1px solid #fecaca',
    borderRadius: 12,
    padding: '16px 20px',
    marginTop: 24,
  },
  alertText: {
    fontFamily: fontStack,
    fontSize: 14,
    color: '#991b1b',
    lineHeight: 1.6,
    margin: 0,
  },
} as const;
