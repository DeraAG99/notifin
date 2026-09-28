import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/toast";
import { Providers } from "@/components/layouts/providers";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SI-MPOK NORI | Notification Management",
  description:
    "Schedule WhatsApp and email notifications, manage recipients and templates, and track delivery from one dashboard.",
  icons: { icon: "/brand/icon.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${jakarta.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");var d=t==="light"?false:(t==="dark"?true:(t==="system"?window.matchMedia("(prefers-color-scheme: dark)").matches:false));document.documentElement.classList.toggle("dark",d);}catch(e){document.documentElement.classList.remove("dark")}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
