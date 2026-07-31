import { LanguageSwitcher } from "@/components/layouts/language-switcher";
import { ThemeToggle } from "@/components/layouts/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-nf-bg text-nf-on-surface font-display selection:bg-nf-secondary-container selection:text-nf-on-secondary-container p-4">
      <div className="ambient-orb orb-1 animate-pulse" />
      <div className="ambient-orb orb-2" />
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      <div className="relative z-10 w-full flex justify-center">{children}</div>
    </div>
  );
}
