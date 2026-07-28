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

interface WelcomeEmailProps {
  name: string;
  loginUrl?: string;
}

export default function WelcomeEmail({ name, loginUrl = "http://localhost:3000" }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to Notifin - Your notification system is ready</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Welcome to Notifin</Heading>
          <Hr style={hr} />
          <Text style={text}>Hi {name},</Text>
          <Text style={text}>
            Your account has been created and your notification system is ready to use.
            You can now configure your WhatsApp and email notifications, create templates,
            and set up automated schedules.
          </Text>
          <Link href={loginUrl} style={button}>
            Get Started
          </Link>
          <Text style={text}>
            If you have any questions, feel free to reach out to our support team.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>Notifin - Smart Notification System</Text>
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
  fontSize: "24px",
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
