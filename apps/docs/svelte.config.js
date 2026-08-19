import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/**
 * @type {import('@sveltejs/kit').Config}
 */
const config = {
  extensions: [".svelte", ".md"],
  preprocess: [vitePreprocess()],
  kit: {
    adapter: adapter({
      pages: "dist",
    }),
    // GitHub Pages serves project sites under /<repo-name>/, not the domain
    // root. Set BASE_PATH in CI only -- local dev/build stays at "".
    paths: {
      base: process.env.BASE_PATH ?? "",
    },
  },
};

export default config;
