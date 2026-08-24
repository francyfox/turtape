
Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

## Comment style

- **Prefer JSDoc (`/** */`) over plain `//` comments.** Plain `//` comments are for the rare case
  that genuinely needs one — a fix that must not be reverted, a non-obvious gotcha, something a
  reader must not skip. Everything else that documents an exported function, type, or interface
  goes in a JSDoc block instead.
- **Write for someone new to the codebase, not a co-author.** A JSDoc block on an exported function
  is short: one or two plain sentences on what it does, plus a minimal `@example` showing how to
  call/wire it up. It's not the place for implementation rationale, history, or edge-case
  reasoning — a reader who just wants to use the function shouldn't have to read past that to find
  out how.
- **Document arguments on the type, not the call site.** If a function takes an options object,
  document each field with its own short JSDoc comment on the interface/type itself, not with
  `@param` prose repeated on every function that accepts it.
- **Format JSDoc as markdown — editors render it that way.** VS Code, WebStorm/IntelliJ, and
  TypeDoc all show JSDoc hover tooltips as rendered markdown, not plain text. Use `**bold**` for
  the key term or constraint in a sentence, `*italic*` sparingly for emphasis, and fenced code
  blocks with a language tag for `@example` (` ```ts ... ``` `, not an unfenced indented block) —
  fenced blocks get real syntax highlighting in the tooltip, plain ones don't. A relevant emoji is
  fine for scanability (e.g. ⚠️ on a warning that must not be missed) — don't decorate for its own
  sake.
