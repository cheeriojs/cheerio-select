import fs from "node:fs";
import { type AnyNode, Element, isTag, Text } from "domhandler";
import * as DomUtils from "domutils";
import { type ParserOptions, parseDocument } from "htmlparser2";
import { expect } from "vitest";
import { select } from "../../src/index.js";

function getDOMFromPath(file: string, options?: ParserOptions): AnyNode[] {
    const filePath = new URL(`../fixtures/${file}`, import.meta.url);
    return parseDocument(fs.readFileSync(filePath, "utf8"), options).children;
}

export interface SimpleDocument extends Array<Element> {
    getElementById(id: string): Element;
    createTextNode(content: string): Text;
    createElement(name: string): Element;
    body: Element;
    documentElement: Element;
}

export function getDocument(file: string): SimpleDocument {
    const document = getDOMFromPath(file) as SimpleDocument;

    document.getElementById = (id: string) =>
        DomUtils.getElementById(id, document) as Element;
    document.createTextNode = (content: string) => new Text(content);
    document.createElement = (name: string) =>
        new Element(name.toLocaleLowerCase(), {});
    [document.body] = DomUtils.getElementsByTagName("body", document, true, 1);
    const documentElement = document.find(isTag);
    if (!documentElement) throw new Error("No document element found");
    document.documentElement = documentElement;

    return document;
}

let document: SimpleDocument;

export function loadDocument(): SimpleDocument {
    document = getDocument("sizzle.html");
    return document;
}

document = loadDocument();

/**
 * Returns an array of elements with the given IDs
 * @param ids Array of IDs to query for
 * @example q("main", "foo", "bar")
 * @returns [<div id="main">, <span id="foo">, <input id="bar">]
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
    context: AnyNode[] | AnyNode = document,
): void {
    const actual = select(
        selector,
        context as Element | Element[],
    ) as Element[];
    const actualIds = actual.map((element) => element.attribs["id"]);

    // Should not contain falsy values
    expect(actualIds).toStrictEqual(expectedIds);
}

const xmlDocument = getDOMFromPath("fries.xml", {
    xmlMode: true,
}) as Element[];

export function createWithFriesXML(): Element[] {
    return xmlDocument;
}
