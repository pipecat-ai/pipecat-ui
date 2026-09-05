import { getPageImageUrl, getPageMarkdownUrl, source } from "@/lib/source";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from "fumadocs-ui/layouts/docs/page";
import { notFound } from "next/navigation";
import { getMDXComponents } from "@/components/mdx";
import type { Metadata } from "next";
import { createRelativeLink } from "fumadocs-ui/mdx";
import { gitConfig } from "@/lib/shared";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { ExternalLinkIcon } from "lucide-react";

export default async function Page(props: PageProps<"/docs/[[...slug]]">) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const markdownUrl = getPageMarkdownUrl(page).url;

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
      breadcrumb={{ enabled: !page.data.hideHeader }}
    >
      <DocsTitle className={page.data.hideHeader ? "sr-only" : "wrap-anywhere"}>
        {page.data.title}
      </DocsTitle>
      {!page.data.hideHeader && (
        <>
          <DocsDescription className="mb-0">
            {page.data.description}
          </DocsDescription>
          <div className="flex flex-row flex-wrap items-center gap-2 border-b pb-6">
            <MarkdownCopyButton markdownUrl={markdownUrl} />
            <ViewOptionsPopover
              markdownUrl={markdownUrl}
              githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/apps/docs/content/docs/${page.path}`}
            />
            {page.data.storybook && (
              <a
                href={page.data.storybook}
                target="_blank"
                rel="noreferrer noopener"
                className={buttonVariants({
                  color: "secondary",
                  size: "sm",
                  className: "gap-2",
                })}
              >
                <ExternalLinkIcon
                  aria-hidden
                  className="text-fd-muted-foreground size-3.5"
                />
                View in Storybook
              </a>
            )}
          </div>
        </>
      )}
      <DocsBody>
        <MDX
          components={getMDXComponents({
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(
  props: PageProps<"/docs/[[...slug]]">,
): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      images: getPageImageUrl(page).url,
    },
  };
}
