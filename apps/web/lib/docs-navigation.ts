import type { Node, Root } from "fumadocs-core/page-tree";

import { isPublished } from "@/lib/published-docs";
import { docsSource } from "@/lib/source";

export type BreadcrumbCrumb = {
  label: string;
  href?: string;
};

export type FlatPage = {
  url: string;
  title: string;
  sectionLabel: string | null;
};

function slugFromUrl(url: string): string[] {
  return url.replace(/^\/docs\/?/, "").split("/").filter(Boolean);
}

function urlFor(slug: string[]): string {
  return "/docs" + (slug.length === 0 ? "" : `/${slug.join("/")}`);
}

function filterPublishedTree(nodes: Node[]): Node[] {
  const filtered: Node[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;

    if (node.type === "separator") {
      const section: Node[] = [];
      for (let j = i + 1; j < nodes.length; j++) {
        if (nodes[j]!.type === "separator") break;
        section.push(nodes[j]!);
      }
      if (filterPublishedTree(section).length > 0) filtered.push(node);
      continue;
    }

    if (node.type === "page") {
      if (isPublished(slugFromUrl(node.url))) filtered.push(node);
      continue;
    }

    if (node.type === "folder") {
      const children = filterPublishedTree(node.children);
      const indexVisible = node.index
        ? isPublished(slugFromUrl(node.index.url))
        : false;
      if (children.length > 0 || indexVisible) {
        filtered.push({ ...node, children });
      }
    }
  }

  return filtered;
}

export function getPublishedTree(): Root {
  const tree = docsSource.pageTree;
  return { ...tree, children: filterPublishedTree(tree.children) };
}

/**
 * Pure tree walker: given a published tree and a target URL, return
 * the breadcrumb trail (including the root "Docs" entry).
 * Safe to run in either server or client components.
 */
export function getBreadcrumbFromTree(
  tree: Root,
  url: string,
): BreadcrumbCrumb[] {
  const base: BreadcrumbCrumb[] = [{ label: "Docs", href: "/docs" }];

  if (url === "/docs") return base;

  type PathEntry = { label: string; href?: string };

  const walk = (
    nodes: Node[],
    sectionLabel: string | null,
    trail: PathEntry[],
  ): PathEntry[] | null => {
    let currentSection = sectionLabel;

    for (const node of nodes) {
      if (node.type === "separator") {
        currentSection = String(node.name ?? "Section");
        continue;
      }

      if (node.type === "page") {
        if (node.url === url) {
          const prefix: PathEntry[] = [];
          if (currentSection) prefix.push({ label: currentSection });
          return [
            ...trail,
            ...prefix,
            { label: String(node.name), href: node.url },
          ];
        }
        continue;
      }

      if (node.type === "folder") {
        const folderEntry: PathEntry = {
          label: String(node.name),
          href: node.index?.url,
        };

        if (node.index?.url === url) {
          const prefix: PathEntry[] = [];
          if (currentSection) prefix.push({ label: currentSection });
          return [...trail, ...prefix, folderEntry];
        }

        const sectionTrail: PathEntry[] = [];
        if (currentSection) sectionTrail.push({ label: currentSection });
        const found = walk(
          node.children,
          null,
          [...trail, ...sectionTrail, folderEntry],
        );
        if (found) return found;
      }
    }

    return null;
  };

  const path = walk(tree.children, null, []);
  if (!path) return base;
  return [...base, ...path];
}

/** Flatten the visible tree into the order items would appear in the sidebar. */
export function getOrderedPagesFromTree(tree: Root): FlatPage[] {
  const flat: FlatPage[] = [];
  let currentSection: string | null = null;

  const walk = (nodes: Node[]) => {
    for (const node of nodes) {
      if (node.type === "separator") {
        currentSection = String(node.name ?? "Section");
        continue;
      }

      if (node.type === "page") {
        flat.push({
          url: node.url,
          title: String(node.name),
          sectionLabel: currentSection,
        });
        continue;
      }

      if (node.type === "folder") {
        if (node.index) {
          flat.push({
            url: node.index.url,
            title: String(node.name),
            sectionLabel: currentSection,
          });
        }
        walk(node.children);
      }
    }
  };

  walk(tree.children);
  return flat;
}

/* ── Server convenience wrappers (use the published tree) ─────────── */

export function getOrderedPages(): FlatPage[] {
  return getOrderedPagesFromTree(getPublishedTree());
}

export function getBreadcrumb(slug: string[] | undefined): BreadcrumbCrumb[] {
  return getBreadcrumbFromTree(getPublishedTree(), urlFor(slug ?? []));
}

export function getAdjacentPages(slug: string[] | undefined): {
  previous: FlatPage | null;
  next: FlatPage | null;
} {
  const url = urlFor(slug ?? []);
  const pages = getOrderedPages();
  const index = pages.findIndex((page) => page.url === url);

  if (index === -1) return { previous: null, next: null };

  return {
    previous: index > 0 ? pages[index - 1] ?? null : null,
    next: index < pages.length - 1 ? pages[index + 1] ?? null : null,
  };
}
