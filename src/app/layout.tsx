import type { Metadata } from "next";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { IBM_Plex_Mono, Manrope, Newsreader } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  weight: ["400", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Social Accountability Reader",
  description: "Read together, stay consistent, and protect your streak.",
};

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${newsreader.variable} ${ibmPlexMono.variable}`}>
        {googleClientId ? (
          <GoogleOAuthProvider clientId={googleClientId}>{children}</GoogleOAuthProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
