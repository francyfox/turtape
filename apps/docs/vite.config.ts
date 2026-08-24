import { defaultTheme } from "@sveltepress/theme-default";
import { sveltepress } from "@sveltepress/vite";
import { defineConfig } from "vite";

const config = defineConfig({
  plugins: [
    sveltepress({
      theme: defaultTheme({
        navbar: [
          { title: "Development", to: "/development" },
          { title: "Project Structure", to: "/project-structure" },
          { title: "Plan", to: "/plan" },
          { title: "TuringDB Issues", to: "/turingdb-issues" },
        ],
        sidebar: {
          "/turingdb-issues/": [
            {
              title: "TuringDB Issues",
              items: [
                { title: "Overview", to: "/turingdb-issues" },
                {
                  title: "EXISTS not implemented",
                  to: "/turingdb-issues/exists-not-implemented",
                },
                {
                  title: "Unknown label on MATCH",
                  to: "/turingdb-issues/unknown-label-on-match",
                },
                {
                  title: "Commit not visible",
                  to: "/turingdb-issues/commit-not-visible",
                },
                {
                  title: "HISTORY syntax mismatch",
                  to: "/turingdb-issues/history-syntax-mismatch",
                },
                {
                  title: "Inline filter + count() crash",
                  to: "/turingdb-issues/inline-filter-count-crash",
                },
                {
                  title: "nightly tag is stale",
                  to: "/turingdb-issues/nightly-build-disabled",
                },
                {
                  title: "latest image breaking changes",
                  to: "/turingdb-issues/latest-image-breaking-changes",
                },
                {
                  title: 'CLI reports version "1.0"',
                  to: "/turingdb-issues/cli-version-hardcoded",
                },
                {
                  title: "Without -demon, writes are slow",
                  to: "/turingdb-issues/commit-cpu-hang",
                },
                {
                  title: "Change tracking gets stuck",
                  to: "/turingdb-issues/change-not-found",
                },
              ],
            },
          ],
        },
        logo: "/logo.svg",
        github: "https://github.com/francyfox/turtape",
        highlighter: {
          languages: [
            "svelte",
            "sh",
            "js",
            "html",
            "ts",
            "md",
            "css",
            "scss",
            "json",
            "cypher",
            "dockerfile",
            "python",
            "yaml",
            "cpp",
          ],
        },
      }),
      siteConfig: {
        title: "turtape",
        description: "Bun/Node.js SDK, CLI, and query layer for TuringDB",
      },
    }),
  ],
});

export default config;
