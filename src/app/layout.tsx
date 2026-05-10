import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Millennium Project",
  description: "Order entry system with role-based access",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
