import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";

interface NotificationEmailProps {
  title: string;
  message: string;
  recipientName?: string;
  actionUrl?: string;
  actionLabel?: string;
}

export default function NotificationEmail({
  title,
  message,
  recipientName,
  actionUrl,
  actionLabel = "View Details",
}: NotificationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{title}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>{title}</Heading>
          <Hr style={hr} />
          {recipientName && (
            <Text style={text}>Hi {recipientName},</Text>
          )}
          <Text style={text}>{message}</Text>
          {actionUrl && (
            <Link href={actionUrl} style={button}>
              {actionLabel}
            </Link>
          )}
          <Hr style={hr} />
          <Text style={footer}>Sent via Notifin - Smart Notification System</Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: "#f6f9fc",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
  maxWidth: "600px",
  borderRadius: "8px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
};

const heading = {
  fontSize: "22px",
  fontWeight: "bold",
  textAlign: "center" as const,
  color: "#1a1a1a",
  padding: "0 20px",
};

const hr = {
  borderColor: "#e6ebf1",
  margin: "20px 0",
};

const text = {
  color: "#333",
  fontSize: "16px",
  lineHeight: "26px",
  textAlign: "left" as const,
  padding: "0 20px",
};

const button = {
  backgroundColor: "#0070f3",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  padding: "12px 24px",
  margin: "20px auto",
  width: "fit-content",
};

const footer = {
  color: "#8898aa",
  fontSize: "12px",
  textAlign: "center" as const,
  padding: "0 20px",
};
