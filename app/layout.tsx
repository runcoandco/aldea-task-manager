import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ALDEA Task Manager",
  description: "Internal ALDEA task dashboard backed by Google Sheets",
  icons: {
    icon: "/favicon.jpeg",
    shortcut: "/favicon.jpeg",
    apple: "/favicon.jpeg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
