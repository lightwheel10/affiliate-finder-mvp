import { Section, Text, Button, Heading } from '@react-email/components';
import { EmailLayout, emailStyles } from './components/EmailLayout';
import type { SupportedLocale } from '@/lib/email';

export type CreditType = 'email' | 'ai' | 'topic_search';

interface CreditsAddedEmailProps {
  name: string;
  locale: SupportedLocale;
  creditType: CreditType;
  creditsAmount: number;
  amountFormatted: string; // e.g. "€19.00"
  appUrl: string;
}

const creditLabels = {
  en: {
    email: 'Email Credits',
    ai: 'AI Outreach Credits',
    topic_search: 'Topic Search Credits',
  },
  de: {
    email: 'E-Mail-Credits',
    ai: 'KI-Outreach-Credits',
    topic_search: 'Themen-Such-Credits',
  },
} as const;

const copy = {
  en: {
    subject: (n: number, t: string) => `${n} ${t} added to your account`,
    preview: (n: number, t: string) => `${n} ${t} have been added — ready to use`,
    heading: 'Credits added',
    intro: (name: string, n: number, type: string) =>
      `Hi ${name}, your purchase of ${n} ${type} was successful and they're already in your account, ready to use whenever you need them.`,
    creditsLabel: 'Credits added',
    amountLabel: 'Amount charged',
    cta: 'Open dashboard',
    closing: "Top-up credits don't expire as long as your subscription is active.",
  },
  de: {
    subject: (n: number, t: string) => `${n} ${t} zu deinem Konto hinzugefügt`,
    preview: (n: number, t: string) => `${n} ${t} wurden hinzugefügt — sofort einsatzbereit`,
    heading: 'Credits hinzugefügt',
    intro: (name: string, n: number, type: string) =>
      `Hi ${name}, dein Kauf von ${n} ${type} war erfolgreich. Sie sind bereits auf deinem Konto und stehen jederzeit zur Verfügung.`,
    creditsLabel: 'Credits hinzugefügt',
    amountLabel: 'Betrag',
    cta: 'Zum Dashboard',
    closing: 'Top-up-Credits verfallen nicht, solange dein Abo aktiv ist.',
  },
} as const;

const detailRowDivider = {
  borderTop: '1px solid #e6ebf1',
};

export function CreditsAddedEmail({ name, locale, creditType, creditsAmount, amountFormatted, appUrl }: CreditsAddedEmailProps) {
  const t = copy[locale];
  const typeLabel = creditLabels[locale][creditType];

  return (
    <EmailLayout preview={t.preview(creditsAmount, typeLabel)}>
      <Section>
        <Heading style={emailStyles.heading}>{t.heading}</Heading>
        <Text style={emailStyles.paragraph}>{t.intro(name, creditsAmount, typeLabel)}</Text>
        <Section style={emailStyles.infoCard}>
          <table width="100%" style={{ borderCollapse: 'collapse' as const }}>
            <tbody>
              <tr>
                <td style={{ padding: '8px 0' }}>
                  <Text style={emailStyles.infoLabel}>{t.creditsLabel}</Text>
                </td>
                <td style={{ padding: '8px 0', textAlign: 'right' as const }}>
                  <Text style={{ ...emailStyles.infoValue, fontSize: 15, marginTop: 0 }}>
                    +{creditsAmount} {typeLabel}
                  </Text>
                </td>
              </tr>
              <tr style={detailRowDivider}>
                <td style={{ padding: '12px 0 0 0' }}>
                  <Text style={emailStyles.infoLabel}>{t.amountLabel}</Text>
                </td>
                <td style={{ padding: '12px 0 0 0', textAlign: 'right' as const }}>
                  <Text style={emailStyles.infoValue}>{amountFormatted}</Text>
                </td>
              </tr>
            </tbody>
          </table>
        </Section>
        <Button href={appUrl} style={emailStyles.primaryButton}>
          {t.cta}
        </Button>
        <Text style={emailStyles.paragraphMuted}>{t.closing}</Text>
      </Section>
    </EmailLayout>
  );
}

export const creditsAddedEmailSubject = (locale: SupportedLocale, creditsAmount: number, creditType: CreditType) =>
  copy[locale].subject(creditsAmount, creditLabels[locale][creditType]);

export default CreditsAddedEmail;
