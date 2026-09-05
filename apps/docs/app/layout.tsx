import { RootProvider } from "fumadocs-ui/provider/next";
import "./global.css";
import { Space_Grotesk, Space_Mono } from "next/font/google";
import type { Metadata } from "next";
import { appName } from "@/lib/shared";

export const metadata: Metadata = {
  metadataBase: new URL("https://ui.pipecat.ai"),
  title: { default: appName, template: `%s | ${appName}` },
  description:
    "Voice AI components for Pipecat, installed as source through shadcn and styled by your theme.",
};

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
});

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${spaceMono.variable} ${spaceGrotesk.className}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
