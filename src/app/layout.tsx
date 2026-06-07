import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://wardix.edycu.dev"),
  title: "Wardix — IAM & Control Plane for Delegated AI Agents",
  description: "IAM and governance console for Terminal 3 Agent Auth. Grant, monitor, and revoke agent scopes natively with TEE attested audit trails.",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "Wardix — IAM & Control Plane for Delegated AI Agents",
    description: "IAM and governance console for Terminal 3 Agent Auth. Grant, monitor, and revoke agent scopes natively with TEE attested audit trails.",
    url: "https://wardix.edycu.dev",
    siteName: "Wardix",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Wardix Console",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wardix — IAM & Control Plane for Delegated AI Agents",
    description: "IAM and governance console for Terminal 3 Agent Auth. Grant, monitor, and revoke agent scopes natively with TEE attested audit trails.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
