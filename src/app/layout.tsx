import type { Metadata } from "next";
import "../index.css";

export const metadata: Metadata = {
  title: "Qlarissa",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
