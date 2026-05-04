import { Section, Text, Button, Heading } from '@react-email/components';
import { EmailLayout, emailStyles } from './components/EmailLayout';
import type { SupportedLocale } from '@/lib/email';

interface PaymentSuccessEmailProps {
  name: string;
  locale: SupportedLocale;
  plan: string;
  amountFormatted: string; // e.g. "€29.00"
  appUrl: string;
}

const copy = {
  en: {
    subject: 'Payment received — your Afforce One plan is active',
    preview: "Thanks for your payment — you're on the {plan} plan",
    heading: 'Payment received',
    intro: (name: string, plan: string) =>
      `Thanks ${name} — your payment was successful and your ${plan} plan is now active. Your credits have been refreshed for the new billing period.`,
    amountLabel: 'Amount charged',
    planLabel: 'Plan',
    cta: 'Open dashboard',
    closing:
      'Your invoice and receipt are also available in the Settings page if you need them for accounting.',
  },
  de: {
    subject: 'Zahlung erhalten — dein Afforce-One-Abo ist aktiv',
    preview: 'Danke für deine Zahlung — du bist auf dem {plan}-Plan',
    heading: 'Zahlung erhalten',
    intro: (name: string, plan: string) =>
      `Danke ${name} — deine Zahlung war erfolgreich und dein ${plan}-Plan ist nun aktiv. Deine Credits wurden für den neuen Abrechnungszeitraum aufgefrischt.`,
    amountLabel: 'Betrag',
    planLabel: 'Plan',
    cta: 'Zum Dashboard',
    closing:
      'Rechnung und Beleg findest du jederzeit in den Einstellungen, falls du sie für die Buchhaltung brauchst.',
  },
} as const;

const detailRowStyle = {
  display: 'flex' as const,
  justifyContent: 'space-between' as const,
  alignItems: 'center' as const,
  padding: '12px 0',
};

const detailRowDivider = {
  borderTop: '1px solid #e6ebf1',
};

export function PaymentSuccessEmail({ name, locale, plan, amountFormatted, appUrl }: PaymentSuccessEmailProps) {
  const t = copy[locale];

  return (
    <EmailLayout preview={t.preview.replace('{plan}', plan)}>
      <Section>
        <Heading style={emailStyles.heading}>{t.heading}</Heading>
        <Text style={emailStyles.paragraph}>{t.intro(name, plan)}</Text>
        <Section style={emailStyles.infoCard}>
          <table width="100%" style={{ borderCollapse: 'collapse' as const }}>
            <tbody>
              <tr>
                <td style={{ padding: '8px 0' }}>
                  <Text style={emailStyles.infoLabel}>{t.planLabel}</Text>
                </td>
                <td style={{ padding: '8px 0', textAlign: 'right' as const }}>
                  <Text style={{ ...emailStyles.infoValue, fontSize: 15, marginTop: 0 }}>{plan}</Text>
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

export const paymentSuccessEmailSubject = (locale: SupportedLocale) => copy[locale].subject;

export default PaymentSuccessEmail;
