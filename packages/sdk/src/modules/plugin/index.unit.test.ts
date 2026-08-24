import { describe, expect, test } from "bun:test";
import {
  compose,
  type HttpRequestOptions,
  type Plugin,
} from "@/modules/plugin";

const request: HttpRequestOptions = { path: "/query" };

describe("compose", () => {
  test("runs plugins outer-to-inner around the terminal handler", async () => {
    const order: string[] = [];
    const tag =
      (name: string): Plugin =>
      async (req, next) => {
        order.push(`${name}:before`);
        const result = await next(req);
        order.push(`${name}:after`);
        return result;
      };

    const pipeline = compose([tag("a"), tag("b")], async () => {
      order.push("handler");
      return "ok";
    });

    const result = await pipeline(request);

    expect(result).toBe("ok");
    expect(order).toEqual([
      "a:before",
      "b:before",
      "handler",
      "b:after",
      "a:after",
    ]);
  });

  test("with no plugins, just calls the handler", async () => {
    const pipeline = compose([], async (req) => req.path);
    expect(await pipeline(request)).toBe("/query");
  });
});
