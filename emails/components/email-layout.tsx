import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type { ReactNode } from 'react';
import { emailTheme } from './theme';

type EmailLayoutProps = {
  preview: string;
  title: string;
  intro?: string;
  children?: ReactNode;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
};

export function EmailLayout({
  preview,
  title,
  intro,
  children,
  ctaLabel,
  ctaUrl,
  footerNote,
}: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.brandBar}>
            <Text style={styles.brandMark}>bloomie</Text>
            <Text style={styles.brandAccent}>vacation</Text>
          </Section>

          <Section style={styles.card}>
            <Heading style={styles.title}>{title}</Heading>
            {intro ? <Text style={styles.intro}>{intro}</Text> : null}
            {children}
            {ctaLabel && ctaUrl ? (
              <Section style={styles.ctaWrap}>
                <Button href={ctaUrl} style={styles.button}>
                  {ctaLabel}
                </Button>
              </Section>
            ) : null}
            {footerNote ? <Text style={styles.footerNote}>{footerNote}</Text> : null}
          </Section>

          <Hr style={styles.hr} />
          <Text style={styles.footer}>
            BloomieVacation keeps team leave simple, visible, and fair.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

type DetailRow = {
  label: string;
  value: string;
};

export function EmailDetails({ rows }: { rows: DetailRow[] }) {
  return (
    <Section style={styles.details}>
      {rows.map((row) => (
        <Section key={row.label} style={styles.detailRow}>
          <Text style={styles.detailLabel}>{row.label}</Text>
          <Text style={styles.detailValue}>{row.value}</Text>
        </Section>
      ))}
    </Section>
  );
}

export function EmailCallout({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  children: ReactNode;
}) {
  const palette = {
    neutral: { bg: emailTheme.primarySoft, color: emailTheme.foreground },
    success: { bg: emailTheme.successSoft, color: emailTheme.success },
    warning: { bg: emailTheme.warningSoft, color: emailTheme.warning },
    danger: { bg: emailTheme.dangerSoft, color: emailTheme.danger },
  }[tone];

  return (
    <Section style={{ ...styles.callout, backgroundColor: palette.bg }}>
      <Text style={{ ...styles.calloutText, color: palette.color }}>{children}</Text>
    </Section>
  );
}

const styles = {
  body: {
    backgroundColor: emailTheme.background,
    margin: 0,
    padding: '32px 16px',
    fontFamily: emailTheme.fontFamily,
  },
  container: {
    margin: '0 auto',
    maxWidth: '560px',
  },
  brandBar: {
    margin: '0 0 20px',
    textAlign: 'center' as const,
  },
  brandMark: {
    display: 'inline',
    margin: 0,
    color: emailTheme.foreground,
    fontFamily: emailTheme.displayFamily,
    fontSize: '24px',
    fontWeight: 500,
    letterSpacing: '-0.02em',
  },
  brandAccent: {
    display: 'inline',
    margin: 0,
    color: emailTheme.primary,
    fontFamily: emailTheme.displayFamily,
    fontSize: '24px',
    fontWeight: 500,
    letterSpacing: '-0.02em',
  },
  card: {
    backgroundColor: emailTheme.card,
    border: `1px solid ${emailTheme.border}`,
    borderRadius: '16px',
    padding: '28px 24px',
  },
  title: {
    color: emailTheme.foreground,
    fontFamily: emailTheme.displayFamily,
    fontSize: '28px',
    fontWeight: 500,
    lineHeight: '1.2',
    margin: '0 0 12px',
  },
  intro: {
    color: emailTheme.muted,
    fontSize: '15px',
    lineHeight: '24px',
    margin: '0 0 20px',
  },
  ctaWrap: {
    marginTop: '24px',
    textAlign: 'center' as const,
  },
  button: {
    backgroundColor: emailTheme.primary,
    borderRadius: '10px',
    color: '#FFFFFF',
    display: 'inline-block',
    fontSize: '15px',
    fontWeight: 600,
    lineHeight: '1',
    padding: '14px 22px',
    textDecoration: 'none',
  },
  footerNote: {
    color: emailTheme.muted,
    fontSize: '13px',
    lineHeight: '20px',
    margin: '20px 0 0',
  },
  hr: {
    borderColor: emailTheme.border,
    margin: '24px 0 16px',
  },
  footer: {
    color: emailTheme.muted,
    fontSize: '12px',
    lineHeight: '18px',
    margin: 0,
    textAlign: 'center' as const,
  },
  details: {
    backgroundColor: emailTheme.background,
    border: `1px solid ${emailTheme.border}`,
    borderRadius: '12px',
    margin: '0 0 8px',
    padding: '4px 0',
  },
  detailRow: {
    borderBottom: `1px solid ${emailTheme.border}`,
    margin: 0,
    padding: '12px 16px',
  },
  detailLabel: {
    color: emailTheme.muted,
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    lineHeight: '16px',
    margin: '0 0 4px',
    textTransform: 'uppercase' as const,
  },
  detailValue: {
    color: emailTheme.foreground,
    fontSize: '15px',
    lineHeight: '22px',
    margin: 0,
  },
  callout: {
    borderRadius: '12px',
    margin: '0 0 8px',
    padding: '14px 16px',
  },
  calloutText: {
    fontSize: '14px',
    lineHeight: '22px',
    margin: 0,
  },
};
