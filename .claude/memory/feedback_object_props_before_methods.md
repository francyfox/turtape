---
name: feedback-object-props-before-methods
description: In object literals, interfaces, and classes, order data properties before function/method members
metadata:
  type: feedback
---

In an object (interface, class, or object literal), list plain data properties first, then function/method members after.

**Why:** user preference — data shape reads before behavior.

**How to apply:** applies to interface/type declarations (e.g. `HttpClientOptions`), classes, and object literals returned from factories (e.g. the `client` object in `packages/sdk/src/modules/http-client/index.ts`). When adding a new field to an existing object that already mixes order, don't reorder unrelated members — but new members should slot into the correct group (properties block, then methods block).
