import { defaultTheme } from "@sveltepress/theme-default";
import { sveltepress } from "@sveltepress/vite";
import { defineConfig } from "vite";

const config = defineConfig({
  plugins: [
    sveltepress({
      theme: defaultTheme({
        navbar: [{ title: "Plan", to: "/plan" }],
        sidebar: {
          // Add your sidebar configs here
        },
        logo: "/logo.svg",
        github: "https://github.com/francyfox/turtape",
        highlighter: {
          languages: ["svelte", "sh", "js", "html", "ts", "md", "css", "scss", "json"],
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
