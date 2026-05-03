import { Section, Text, Button, Heading } from '@react-email/components';
import { EmailLayout, emailStyles } from './components/EmailLayout';
import type { SupportedLocale } from '@/lib/email';

interface WelcomeEmailProps {
  name: string;
  locale: SupportedLocale;
  appUrl: string;
}

const copy = {
  en: {
    subject: 'Welcome to Afforce One',
    preview: "Welcome to Afforce One — let's find your first affiliates",
    heading: (name: string) => `Welcome, ${name}!`,
    intro:
      "Thanks for joining Afforce One. We help brands discover the right affiliates and creators using AI-powered search across the web, YouTube, Instagram, and TikTok.",
    nextSteps: "Here's what to do next:",
    steps: [
      'Complete your onboarding (brand, topics, target market).',
      'Run your first search to discover affiliates.',
      'Save the ones you like and start outreach.',
    ],
    cta: 'Open dashboard',
    closing: 'Questions? Just reply to this email — we read every one.',
  },
  de: {
    subject: 'Willkommen bei Afforce One',
    preview: 'Willkommen bei Afforce One — finden wir deine ersten Affiliates',
    heading: (name: string) => `Willkommen, ${name}!`,
    intro:
      'Danke, dass du Afforce One gewählt hast. Wir helfen Marken, mit KI-gestützter Suche im Web, auf YouTube, Instagram und TikTok die passenden Affiliates und Creator zu finden.',
    nextSteps: 'Das sind deine nächsten Schritte:',
    steps: [
      'Onboarding abschließen (Marke, Themen, Zielmarkt).',
      'Erste Suche starten und Affiliates entdecken.',
      'Passende speichern und mit dem Outreach beginnen.',
    ],
    cta: 'Zum Dashboard',
    closing: 'Fragen? Einfach auf diese E-Mail antworten — wir lesen jede einzelne.',
  },
} as const;

const stepsListStyle = {
  fontFamily: emailStyles.fontStack,
  fontSize: 15,
  color: '#425466',
  lineHeight: 1.9,
  marginTop: 12,
  marginBottom: 0,
};

const stepNumberStyle = {
  display: 'inline-block' as const,
  width: 22,
  height: 22,
  lineHeight: '22px',
  textAlign: 'center' as const,
  borderRadius: 9999,
  backgroundColor: '#ffbf23',
  color: '#0f172a',
  fontSize: 11,
  fontWeight: 700,
  marginRight: 10,
};

export function WelcomeEmail({ name, locale, appUrl }: WelcomeEmailProps) {
  const t = copy[locale];

  return (
    <EmailLayout preview={t.preview}>
      <Section>
        <Heading style={emailStyles.heading}>{t.heading(name)}</Heading>
        <Text style={emailStyles.paragraph}>{t.intro}</Text>
        <Text style={emailStyles.emphasis}>{t.nextSteps}</Text>
        {t.steps.map((step, idx) => (
          <Text key={idx} style={stepsListStyle}>
            <span style={stepNumberStyle}>{idx + 1}</span>
            {step}
          </Text>
        ))}
        <Button href={appUrl} style={emailStyles.primaryButton}>
          {t.cta}
        </Button>
        <Text style={emailStyles.paragraphMuted}>{t.closing}</Text>
      </Section>
    </EmailLayout>
  );
}

export const welcomeEmailSubject = (locale: SupportedLocale) => copy[locale].subject;

export default WelcomeEmail;
