import { parseDOM } from "htmlparser2";
import { select, filter } from "./";
import type { Element } from "domhandler";

describe("index", () => {
    it("should find elements", () => {
        const dom = parseDOM("<div><p>First<p>Second") as Element[];
        expect(select("div", dom)).toHaveLength(1);
    });

    it("should support positionals", () => {
        const dom = parseDOM("<div><p>First<p>Second") as Element[];
        expect(select("p:first", dom)).toMatchInlineSnapshot(`
            Array [
              <p>
                First
              </p>,
            ]
        `);

        expect(select("p:last", dom)).toMatchInlineSnapshot(`
            Array [
              <p>
                Second
              </p>,
            ]
        `);
    });

    it("should support traversal-first queries", () => {
        const dom = parseDOM(`<p class=a><p class=b>`) as Element[];
        const [a, b] = dom;
        expect(a.attribs.class).toBe("a");
        expect(select("+.b", a)).toStrictEqual([b]);
    });

    it("should filter elements", () => {
        const dom = parseDOM("<div><p>First<p>Second") as Element[];
        const ps = select("p", dom);
        expect(ps).toHaveLength(2);
        expect(filter("p", ps)).toHaveLength(2);
        expect(filter("div p", ps)).toHaveLength(2);
        expect(filter(":first", ps)).toHaveLength(1);
        expect(filter("p:first", ps)).toHaveLength(1);
        expect(filter("div p:first", ps)).toHaveLength(1);
        expect(filter("div:first p:first", ps)).toHaveLength(1);
    });
});
