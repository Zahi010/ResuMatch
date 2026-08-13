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
  title: "ResuMatch | Know your chances before you apply",
  description: "Upload your resume, analyze ATS compatibility, compare against job descriptions, and get custom learning paths and interview preparation questions powered by AI.",
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
      <body className="min-h-full flex flex-col bg-[#0a0c10] text-zinc-100">
        {/* Persistent Vibrant Background Gradient */}
        <div className="fixed inset-0 z-[-1] pointer-events-none" style={{
          backgroundImage: `
            radial-gradient(circle at 15% 50%, rgba(124, 58, 237, 0.25), transparent 45%),
            radial-gradient(circle at 85% 30%, rgba(37, 99, 235, 0.25), transparent 45%),
            radial-gradient(circle at 50% 80%, rgba(236, 72, 153, 0.15), transparent 50%)
          `
        }} />
        {children}
      </body>
    </html>
  );
}
