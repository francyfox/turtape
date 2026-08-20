import { defaultTheme } from "@sveltepress/theme-default";
import { sveltepress } from "@sveltepress/vite";
import { defineConfig } from "vite";

const config = defineConfig({
  plugins: [
    sveltepress({
      theme: defaultTheme({
        navbar: [
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
