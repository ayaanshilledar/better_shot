import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Velo — macOS-Inspired Screen Recorder for Windows",
  description:
    "A precision, high-performance screenshot and screen recording application with macOS-inspired aesthetics for Windows.",
  icons: {
    icon: "/Logo.png",
    shortcut: "/Logo.png",
    apple: "/Logo.png",
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
      className={`${poppins.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-[#101216] text-white selection:bg-white selection:text-black">
        {children}
      </body>
    </html>
  );
}
