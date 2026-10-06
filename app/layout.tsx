import type { Metadata } from "next";
import { cookies } from "next/headers";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "e-GURO Companion",
  description: "Your LMS, without the constant checking.",
};

// The theme choice lives in a plain cookie (not localStorage), so the server can render the right
// theme on the first paint with no flash. No cookie = follow the device's light/dark setting.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const saved = (await cookies()).get("egaro_theme")?.value;
  const theme = saved === "light" || saved === "dark" ? saved : undefined;
  return (
    <html lang="en" data-theme={theme}>
      <body>{children}</body>
    </html>
  );
}
