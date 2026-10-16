import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { NativeShell } from "@/components/native/native-shell";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Agent Mobile ΓÇö AI chat with skills & tools",
    template: "%s ┬╖ Agent Mobile",
  },
  description:
    "A ChatGPT-style AI assistant with web search, code execution, image generation and file reading built into the conversation.",
  applicationName: "Agent Mobile",
  keywords: ["AI chat", "assistant", "tools", "skills", "Next.js", "Supabase"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#101014" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={200}>
            <NativeShell>
              {children}
              <Toaster
                position="top-center"
                toastOptions={{
                  classNames: {
                    toast:
                      "rounded-xl border border-border bg-card text-card-foreground shadow-lg",
                  },
                }}
              />
            </NativeShell>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
