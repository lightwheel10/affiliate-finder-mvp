import { Section, Text, Button, Heading } from '@react-email/components';
import { EmailLayout, emailStyles } from './components/EmailLayout';
import type { SupportedLocale } from '@/lib/email';

interface SourceBreakdown {
  youtube?: number;
  instagram?: number;
  tiktok?: number;
  web?: number;
}

interface ScanSummaryEmailProps {
  name: string;
  locale: SupportedLocale;
  affiliatesFound: number;
  sources: SourceBreakdown;
  appUrl: string;
}

const copy = {
  en: {
    subject: (n: number) => `We found ${n} new affiliate${n === 1 ? '' : 's'} this week`,
    preview: (n: number) => `Your weekly scan finished — ${n} new affiliate${n === 1 ? '' : 's'} ready to review`,
    heading: 'Your weekly scan is in',
    intro: (name: string) =>
      `Hi ${name}, our automated weekly scan just finished and found fresh content creators and affiliates matching your topics. Here's the breakdown:`,
    countLabel: (n: number) => (n === 1 ? 'new affiliate' : 'new affiliates'),
    sourcesLabel: 'Where we found them',
    sourceLabels: {
      youtube: 'YouTube',
      instagram: 'Instagram',
      tiktok: 'TikTok',
      web: 'Web articles & blogs',
    },
    cta: 'Review affiliates',
    closing: 'These will sit in your Discovered list until you save or skip them.',
    emptyHint: '',
  },
  de: {
    subject: (n: number) => `Wir haben ${n} neue Affiliate${n === 1 ? '' : 's'} diese Woche gefunden`,
    preview: (n: number) => `Dein wöchentlicher Scan ist fertig — ${n} neue${n === 1 ? 'r' : ''} Affiliate${n === 1 ? '' : 's'} zum Prüfen`,
    heading: 'Dein wöchentlicher Scan ist da',
    intro: (name: string) =>
      `Hi ${name}, unser automatischer wöchentlicher Scan ist fertig und hat frische Creator und Affiliates zu deinen Themen gefunden. Hier die Übersicht:`,
    countLabel: (n: number) => (n === 1 ? 'neuer Affiliate' : 'neue Affiliates'),
    sourcesLabel: 'Wo wir sie gefunden haben',
    sourceLabels: {
      youtube: 'YouTube',
      instagram: 'Instagram',
      tiktok: 'TikTok',
      web: 'Webseiten & Blogs',
    },
    cta: 'Affiliates ansehen',
    closing: 'Sie warten in deiner Liste der entdeckten Affiliates, bis du sie speicherst oder überspringst.',
    emptyHint: '',
  },
} as const;

const heroSectionStyle = {
  textAlign: 'center' as const,
  marginTop: 24,
  marginBottom: 8,
};

const heroSubLabelStyle = {
  fontFamily: emailStyles.fontStack,
  fontSize: 13,
  color: '#8898aa',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  margin: 0,
  marginTop: -4,
};

const sourceRowStyle = {
  display: 'flex' as const,
  justifyContent: 'space-between' as const,
  alignItems: 'center' as const,
  padding: '10px 0',
};

const sourceLabelTextStyle = {
  fontFamily: emailStyles.fontStack,
  fontSize: 14,
  color: '#425466',
  margin: 0,
  fontWeight: 500,
};

const sourceCountTextStyle = {
  fontFamily: emailStyles.fontStack,
  fontSize: 14,
  color: '#0f172a',
  fontWeight: 700,
  margin: 0,
};

export function ScanSummaryEmail({ name, locale, affiliatesFound, sources, appUrl }: ScanSummaryEmailProps) {
  const t = copy[locale];

  // Filter out zero-count sources
  const visibleSources = (Object.entries(sources) as Array<[keyof SourceBreakdown, number | undefined]>)
    .filter(([, count]) => typeof count === 'number' && count > 0)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0));

  return (
    <EmailLayout preview={t.preview(affiliatesFound)}>
      <Section>
        <Heading style={emailStyles.heading}>{t.heading}</Heading>
        <Text style={emailStyles.paragraph}>{t.intro(name)}</Text>

        <Section style={heroSectionStyle}>
          <Text style={emailStyles.heroStat}>{affiliatesFound}</Text>
          <Text style={heroSubLabelStyle}>{t.countLabel(affiliatesFound)}</Text>
        </Section>

        {visibleSources.length > 0 && (
          <Section style={emailStyles.infoCard}>
            <Text style={emailStyles.infoLabel}>{t.sourcesLabel}</Text>
            <table width="100%" style={{ borderCollapse: 'collapse' as const, marginTop: 8 }}>
              <tbody>
                {visibleSources.map(([key, count], idx) => (
                  <tr
                    key={key}
                    style={idx > 0 ? { borderTop: '1px solid #e6ebf1' } : undefined}
                  >
                    <td style={{ padding: '10px 0' }}>
                      <Text style={sourceLabelTextStyle}>{t.sourceLabels[key]}</Text>
                    </td>
                    <td style={{ padding: '10px 0', textAlign: 'right' as const }}>
                      <Text style={sourceCountTextStyle}>{count}</Text>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        <Button href={`${appUrl}/discovered`} style={emailStyles.primaryButton}>
          {t.cta}
        </Button>
        <Text style={emailStyles.paragraphMuted}>{t.closing}</Text>
      </Section>
    </EmailLayout>
  );
}

export const scanSummaryEmailSubject = (locale: SupportedLocale, affiliatesFound: number) =>
  copy[locale].subject(affiliatesFound);

export default ScanSummaryEmail;
