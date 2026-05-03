import { Section, Text, Button, Heading } from '@react-email/components';
import { EmailLayout, emailStyles } from './components/EmailLayout';
import type { SupportedLocale } from '@/lib/email';

interface PaymentFailedEmailProps {
  name: string;
  locale: SupportedLocale;
  plan: string;
  appUrl: string;
}

const copy = {
  en: {
    subject: 'Action needed — your payment failed',
    preview: 'Your latest Afforce One payment was declined',
    heading: 'Your payment failed',
    intro: (name: string, plan: string) =>
      `Hi ${name}, we tried to charge your card for your ${plan} plan but the payment was declined. This usually means an expired card, insufficient funds, or a bank block.`,
    alert:
      'No action from your bank yet — but if you don\'t update your card soon, your account will be paused until the payment goes through.',
    cta: 'Update payment method',
    closing:
      'If you think this is a mistake or your card is fine, just reply to this email and we\'ll take a look.',
  },
  de: {
    subject: 'Aktion erforderlich — deine Zahlung ist fehlgeschlagen',
    preview: 'Deine letzte Afforce-One-Zahlung wurde abgelehnt',
    heading: 'Deine Zahlung ist fehlgeschlagen',
    intro: (name: string, plan: string) =>
      `Hi ${name}, wir konnten deine Karte für den ${plan}-Plan nicht belasten — die Zahlung wurde abgelehnt. Meist liegt es an einer abgelaufenen Karte, fehlender Deckung oder einer Bank-Sperre.`,
    alert:
      'Noch ist nichts passiert — aber wenn du deine Karte nicht bald aktualisierst, pausieren wir deinen Zugang, bis die Zahlung durchgeht.',
    cta: 'Zahlungsmethode aktualisieren',
    closing:
      'Wenn das ein Fehler ist oder deine Karte funktioniert, antworte einfach auf diese E-Mail — wir schauen uns das an.',
  },
} as const;

export function PaymentFailedEmail({ name, locale, plan, appUrl }: PaymentFailedEmailProps) {
  const t = copy[locale];

  return (
    <EmailLayout preview={t.preview}>
      <Section>
        <Heading style={emailStyles.heading}>{t.heading}</Heading>
        <Text style={emailStyles.paragraph}>{t.intro(name, plan)}</Text>
        <Section style={emailStyles.alertCard}>
          <Text style={emailStyles.alertText}>{t.alert}</Text>
        </Section>
        <Button href={`${appUrl}/settings`} style={emailStyles.primaryButton}>
          {t.cta}
        </Button>
        <Text style={emailStyles.paragraphMuted}>{t.closing}</Text>
      </Section>
    </EmailLayout>
  );
}

export const paymentFailedEmailSubject = (locale: SupportedLocale) => copy[locale].subject;

export default PaymentFailedEmail;
