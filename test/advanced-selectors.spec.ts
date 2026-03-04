import { innerText } from "domutils";
import { parseDocument } from "htmlparser2";
import { select } from "../src";

const testCases: [
    name: string,
    html: string,
    selector: string,
    text: string,
][] = [
    ["Non-advanced selector", "<div>foo</div><div>bar</div>", "div", "foobar"],
    [
        "Simple selector ending in :first()",
        "<div>foo</div><div>bar</div>",
        "div:first",
        "foo",
    ],
    [
        "Simple selector ending in :last()",
        "<div>foo</div><div>bar</div>",
        "div:last",
        "bar",
    ],
    [
        "Simple selector ending in :first-child()",
        "<div><span>foo</span><span>bar</span></div>",
        "div span:first-child",
        "foo",
    ],
    [
        "Simple selector ending in :last-child()",
        "<div><span>foo</span><span>bar</span></div>",
        "div span:last-child",
        "bar",
    ],
    [
        "Simple selector ending in :eq()",
        "<div>foo</div><div>bar</div>",
        "div:eq(1)",
        "bar",
    ],
    [
        "Simple selector with :eq() in the middle",
        "<div><span>foo</span></div><div><span>bar</span></div>",
        "div:eq(0) span",
        "foo",
    ],
    [
        "Complex selector",
        "<div><span><h1>foo</h1></span><span><h1>bar</h1></span></div>",
        "div:first span:eq(1) h1",
        "bar",
    ],
];

describe("cheerio-advanced-selectors — #find()", () => {
    for (const [name, html, selector, text] of testCases) {
        it(name, () => {
            const document = parseDocument(html);
            const result = select(selector, document);
            expect(innerText(result)).toBe(text);
        });
    }

    it("Custom context", () => {
        const document = parseDocument("<div>foo</div><div>bar</div>");
        const result = select("div:eq(1)", document, {
            context: document.children[0],
        });
        expect(innerText(result)).toBe("bar");
    });

    it("Custom root", () => {
        const document = parseDocument(
            "<div><span>foo</span></div><div><span>bar</span></div>",
        );
        const result = select("span:eq(1)", document, {
            root: document,
        });
        expect(innerText(result)).toBe("bar");
    });
});
