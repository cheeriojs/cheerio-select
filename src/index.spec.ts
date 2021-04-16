import { parseDocument } from "htmlparser2";
import { select, filter, is, some } from "./";
import type { Element } from "domhandler";

describe("index", () => {
    it("should find elements", () => {
        const dom = parseDocument("<div><p>First<p>Second");
        expect(select("div", dom)).toHaveLength(1);
    });

    it("should find with a function", () => {
        const dom = parseDocument("<div><p>First<p>Second");
        expect(select((elem) => elem.name === "p", dom)).toHaveLength(2);
    });

    it("should ignore positionals without numbers", () => {
        const dom = parseDocument("<div><p>First<p>Second");
        expect(select(":eq(e)", dom)).toHaveLength(0);
        expect(select(":lt(e)", dom)).toHaveLength(0);
        expect(select(":gt(e)", dom)).toHaveLength(0);
    });

    it("should support positionals", () => {
        const dom = parseDocument("<div><p>First<p>Second");
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

        expect(select("p:lt(-1)", dom)).toMatchInlineSnapshot(`
            Array [
              <p>
                First
              </p>,
              <p>
                Second
              </p>,
            ]
        `);
    });

    it("should support traversal-first queries", () => {
        const dom = parseDocument(`<p class=a><p class=b>`);
        const [a, b] = dom.children;
        expect((a as Element).attribs.class).toBe("a");
        expect(select("+.b", a)).toStrictEqual([b]);
    });

    it("should filter elements", () => {
        const dom = parseDocument("<div><p>First<p>Second");
        const ps = select("p", dom);
        expect(ps).toHaveLength(2);
        expect(filter("p", ps)).toHaveLength(2);
        expect(filter("div p", ps)).toHaveLength(2);
        expect(filter(":first", ps)).toHaveLength(1);
        expect(filter("p:first", ps)).toHaveLength(1);
        expect(filter("div p:first", ps)).toHaveLength(1);
        expect(filter("div:first p:first", ps)).toHaveLength(1);
        expect(filter("p:nth-child(1), :last", ps)).toHaveLength(2);
        expect(
            filter("div p:not(:scope)", ps, { context: [ps[1]] })
        ).toHaveLength(1);
        expect(filter(":last", [])).toHaveLength(0);
        expect(filter("p, :last", ps)).toHaveLength(2);
    });

    it("should check individual elements", () => {
        const dom = parseDocument("<div><p>First<p>Second");
        const [div] = dom.children as Element[];
        const [p1, p2] = div.children as Element[];
        expect(is(div, "")).toBe(false);
        expect(is(p1, "div p")).toBe(true);
        expect(is(p1, "div p:first")).toBe(true);
        expect(is(p2, "div p:first")).toBe(false);
        expect(is(p2, "div p:first, :contains(ond)")).toBe(true);
        expect(is(p1, "div p:last")).toBe(false);
        expect(is(div, (el) => el.children.length > 1)).toBe(true);

        expect(is(p2, "div p:not(:scope)", { context: p1 })).toBe(true);
        expect(is(p1, "div p:not(:scope)", { context: [p1, p2] })).toBe(false);
    });

    it("should check if set matches selector", () => {
        const dom = parseDocument("<div><p>First<p>Second");
        const [div] = dom.children as Element[];
        const ps = div.children as Element[];
        expect(some(ps, "")).toBe(false);
        expect(some(ps, "div p:last")).toBe(true);
        expect(some(ps, "div p:eq(3)")).toBe(false);
        expect(some(ps, "div p:eq(3), p:gt(2)")).toBe(false);
        expect(some(ps, "div p:gt(foo)")).toBe(false);
        expect(some(ps, "div p:eq(3), p:contains(ond)")).toBe(true);
        expect(some([div], (el) => el.children.length > 1)).toBe(true);
        expect(some(ps, (el) => el.children.length > 1)).toBe(false);

        expect(some(ps, "div p:not(:scope)", { context: [ps[1]] })).toBe(true);
        expect(some(ps, "div p:not(:scope)", { context: ps })).toBe(false);
    });
});
