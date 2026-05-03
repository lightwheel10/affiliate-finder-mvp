import { Section, Text, Button, Heading } from '@react-email/components';
import { EmailLayout, emailStyles } from './components/EmailLayout';
import type { SupportedLocale } from '@/lib/email';

interface TrialEndingEmailProps {
  name: string;
  locale: SupportedLocale;
  daysRemaining: number;
  trialEndsAt: string; // ISO date or formatted date string
  plan: string;
  appUrl: string;
}

const copy = {
  en: {
    subject: (days: number) => `Your trial ends in ${days} day${days === 1 ? '' : 's'}`,
    preview: (days: number) => `Your Afforce One trial ends in ${days} day${days === 1 ? '' : 's'}`,
    heading: (days: number) => `Your trial ends in ${days} day${days === 1 ? '' : 's'}`,
    intro: (name: string, plan: string) =>
      `Hi ${name}, just a heads-up — your free trial of the ${plan} plan ends soon. We'll automatically charge your card on file once the trial ends so your access continues without interruption.`,
    detailLabel: 'Trial ends on',
    cta: 'Manage subscription',
    closing:
      "If you'd like to cancel before then, you can do that any time from the Settings page. No questions asked.",
  },
  de: {
    subject: (days: number) => `Deine Testphase endet in ${days} Tag${days === 1 ? '' : 'en'}`,
    preview: (days: number) => `Deine Afforce-One-Testphase endet in ${days} Tag${days === 1 ? '' : 'en'}`,
    heading: (days: number) => `Deine Testphase endet in ${days} Tag${days === 1 ? '' : 'en'}`,
    intro: (name: string, plan: string) =>
      `Hi ${name}, kurzer Hinweis — deine kostenlose Testphase des ${plan}-Plans endet bald. Wir buchen die Zahlung automatisch von deiner hinterlegten Karte ab, sodass dein Zugang lückenlos weiterläuft.`,
    detailLabel: 'Testphase endet am',
    cta: 'Abo verwalten',
    closing: 'Du kannst jederzeit in den Einstellungen kündigen — ganz ohne Rückfragen.',
  },
} as const;

function formatDate(iso: string, locale: SupportedLocale): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function TrialEndingEmail({ name, locale, daysRemaining, trialEndsAt, plan, appUrl }: TrialEndingEmailProps) {
  const t = copy[locale];
  const formattedDate = formatDate(trialEndsAt, locale);

  return (
    <EmailLayout preview={t.preview(daysRemaining)}>
      <Section>
        <Heading style={emailStyles.heading}>{t.heading(daysRemaining)}</Heading>
        <Text style={emailStyles.paragraph}>{t.intro(name, plan)}</Text>
        <Section style={emailStyles.infoCard}>
          <Text style={emailStyles.infoLabel}>{t.detailLabel}</Text>
          <Text style={emailStyles.infoValue}>{formattedDate}</Text>
        </Section>
        <Button href={`${appUrl}/settings`} style={emailStyles.primaryButton}>
          {t.cta}
        </Button>
        <Text style={emailStyles.paragraphMuted}>{t.closing}</Text>
      </Section>
    </EmailLayout>
  );
}

export const trialEndingEmailSubject = (locale: SupportedLocale, days: number) => copy[locale].subject(days);

export default TrialEndingEmail;
