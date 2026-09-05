import { RootProvider } from "fumadocs-ui/provider/next";
import "./global.css";
import { Geist, JetBrains_Mono } from "next/font/google";
import type { Metadata } from "next";
import { appName } from "@/lib/shared";

export const metadata: Metadata = {
  metadataBase: new URL("https://ui.pipecat.ai"),
  title: { default: appName, template: `%s | ${appName}` },
  description:
    "Pipecat UI — components designed for building voice AI experiences with Pipecat.",
};

const geist = Geist({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-geist-sans",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-jetbrains-mono",
});

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${jetBrainsMono.variable} font-sans`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
