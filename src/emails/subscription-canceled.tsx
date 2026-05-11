import { Section, Text, Button, Heading } from '@react-email/components';
import { EmailLayout, emailStyles } from './components/EmailLayout';
import type { SupportedLocale } from '@/lib/email';

interface SubscriptionCanceledEmailProps {
  name: string;
  locale: SupportedLocale;
  plan: string;
  accessUntil: string; // ISO date or formatted date
  appUrl: string;
}

// 2026-05-10 (paras): Removed `feedback` field (client said we won't respond
// to email replies; the paragraph existed only to invite a reply). Removed
// em dashes from preview/intro/closing in both EN and DE.
const copy = {
  en: {
    subject: 'Your subscription has been canceled',
    preview: "We've canceled your subscription. You have access until {date}.",
    heading: "We've canceled your subscription",
    intro: (name: string, plan: string) =>
      `Hi ${name}, your cancellation request has been processed. You'll keep full access to your ${plan} plan until the end of the current billing period. No further charges will be made.`,
    accessLabel: 'Access until',
    cta: 'Reactivate subscription',
    closing: 'You can reactivate any time, and your old data will still be there.',
  },
  de: {
    subject: 'Dein Abo wurde gekündigt',
    preview: 'Wir haben dein Abo gekündigt. Zugang bis {date}.',
    heading: 'Wir haben dein Abo gekündigt',
    intro: (name: string, plan: string) =>
      `Hi ${name}, deine Kündigung wurde verarbeitet. Du behältst vollen Zugriff auf deinen ${plan}-Plan bis zum Ende des aktuellen Abrechnungszeitraums. Es werden keine weiteren Beträge abgebucht.`,
    accessLabel: 'Zugang bis',
    cta: 'Abo reaktivieren',
    closing: 'Du kannst jederzeit reaktivieren. Deine Daten warten auf dich.',
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

export function SubscriptionCanceledEmail({ name, locale, plan, accessUntil, appUrl }: SubscriptionCanceledEmailProps) {
  const t = copy[locale];
  const formattedDate = formatDate(accessUntil, locale);

  return (
    <EmailLayout preview={t.preview.replace('{date}', formattedDate)}>
      <Section>
        <Heading style={emailStyles.heading}>{t.heading}</Heading>
        <Text style={emailStyles.paragraph}>{t.intro(name, plan)}</Text>
        <Section style={emailStyles.infoCard}>
          <Text style={emailStyles.infoLabel}>{t.accessLabel}</Text>
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

export const subscriptionCanceledEmailSubject = (locale: SupportedLocale) => copy[locale].subject;

export default SubscriptionCanceledEmail;
