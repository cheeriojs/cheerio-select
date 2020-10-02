import { select } from "../../src";
import fs from "fs";
import path from "path";
import * as htmlparser2 from "htmlparser2";
import * as DomUtils from "domutils";
import { DataNode, Element, Node } from "domhandler";

function getDOMFromPath(
    file: string,
    options?: htmlparser2.ParserOptions
): Node[] {
    const filePath = path.join(__dirname, "..", "fixtures", file);
    return htmlparser2.parseDOM(fs.readFileSync(filePath, "utf8"), options);
}

export interface SimpleDocument extends Array<Node> {
    getElementById(id: string): Element;
    createTextNode(content: string): DataNode;
    createElement(name: string): Element;
    body: Element;
    documentElement: Element;
}

export function getDocument(file: string): SimpleDocument {
    const document = getDOMFromPath(file) as SimpleDocument;

    document.getElementById = (id: string) =>
        DomUtils.getElementById(id, document) as Element;
    document.createTextNode = (content: string) =>
        new DataNode(htmlparser2.ElementType.Text, content);
    document.createElement = (name: string) =>
        new Element(name.toLocaleLowerCase(), {});
    [document.body] = DomUtils.getElementsByTagName("body", document, true, 1);
    [document.documentElement] = document.filter(DomUtils.isTag);

    return document;
}

let document = loadDoc();

export function loadDoc(): SimpleDocument {
    return (document = getDocument("sizzle.html"));
}

/**
 * Returns an array of elements with the given IDs
 * @example q("main", "foo", "bar")
 * @result [<div id="main">, <span id="foo">, <input id="bar">]
 */
export function q(...ids: string[]): Element[] {
    return ids.map((id) => document.getElementById(id));
}

/**
 * Asserts that a select matches the given IDs
 * @param selector - Selector
 * @param expectedIds - Array of ids to construct what is expected
 * @param context - Root of the current search.
 * @example t("Check for something", "//[a]", ["foo", "baar"]);
 * @returns `true` iff the selector produces the expected elements.
 */
export function t(
    selector: string,
    expectedIds: string[],
    context: Node[] | Node = document
): void {
    const actual = select(selector, context) as Element[];
    const actualIds = actual.map((e) => e.attribs.id);

    // Should not contain falsy values
    expect(actualIds).toStrictEqual(expectedIds);
}

const xmlDoc = getDOMFromPath("fries.xml", {
    xmlMode: true,
});

export function createWithFriesXML(): Node[] {
    return xmlDoc;
}
