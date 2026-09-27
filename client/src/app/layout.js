import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import Providers from "@/components/Providers";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/config";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-display", weight: ["600", "700", "800"], display: "swap" });

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} – Free Resume Builder with Live PDF Preview`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ["resume builder", "free resume builder", "CV maker", "ATS resume", "resume templates", "resume PDF", "curriculum vitae"],
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: SITE_NAME, title: `${SITE_NAME} – Free Resume Builder`, description: SITE_DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: `${SITE_NAME} – Free Resume Builder`, description: SITE_DESCRIPTION },
  robots: { index: true, follow: true },
};

export const viewport = { themeColor: "#007B7B", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-screen font-sans">
        <AntdRegistry layer>
          <Providers>{children}</Providers>
        </AntdRegistry>
      </body>
    </html>
  );
}
