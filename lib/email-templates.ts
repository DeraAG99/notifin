import { render } from "@react-email/render";
import WelcomeEmail from "../emails/welcome";
import NotificationEmail from "../emails/notification";

export async function renderWelcomeEmail(name: string, loginUrl?: string): Promise<string> {
  return render(WelcomeEmail({ name, loginUrl }));
}

export async function renderNotificationEmail(
  title: string,
  message: string,
  recipientName?: string,
  actionUrl?: string,
  actionLabel?: string
): Promise<string> {
  return render(
    NotificationEmail({ title, message, recipientName, actionUrl, actionLabel })
  );
}
