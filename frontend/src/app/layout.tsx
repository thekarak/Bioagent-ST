import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BioAgent-ST — Spatial transcriptomics, with evidence at every step",
  description:
    "BioAgent-ST is an evidence-aware workflow assistant for spatial transcriptomics. It connects natural-language research questions to approved analysis workflows, technical verification, and reproducible reports. Research prototype.",
  keywords: [
    "spatial transcriptomics",
    "single-cell analysis",
    "scanpy",
    "squidpy",
    "workflow verification",
    "provenance",
    "research software",
  ],
  authors: [{ name: "BioAgent-ST Project" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
