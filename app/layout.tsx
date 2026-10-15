import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Image credits",
  description: "An AI image generator where every new account gets 10 free credits.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
