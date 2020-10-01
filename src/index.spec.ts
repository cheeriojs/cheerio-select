import { parseDOM } from "htmlparser2";
import * as CheerioSelect from "./";
import type { Element } from "domhandler";

describe("index", () => {
    it("should find elements", () => {
        const dom = parseDOM("<div><p>First<p>Second") as Element[];
        expect(CheerioSelect.select("div", dom)).toHaveLength(1);
    });

    it("should support positionals", () => {
        const dom = parseDOM("<div><p>First<p>Second") as Element[];
        expect(CheerioSelect.select("p:first", dom)).toMatchInlineSnapshot(`
            Array [
              <p>
                First
              </p>,
            ]
        `);

        expect(CheerioSelect.select("p:last", dom)).toMatchInlineSnapshot(`
            Array [
              <p>
                Second
              </p>,
            ]
        `);
    });
});
