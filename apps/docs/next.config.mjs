import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  agentRules: false,
  skipTrailingSlashRedirect: true,
  async rewrites() {
    const origin = (
      process.env.STORYBOOK_ORIGIN || "https://pipecat-ui-storybook.vercel.app"
    ).replace(/\/$/, "");
    return [{ source: "/storybook/:path*", destination: `${origin}/:path*` }];
  },
};

export default withMDX(config);
