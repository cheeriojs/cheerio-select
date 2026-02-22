import type { Selector } from "css-what";
import type { AnyNode } from "domhandler";
import { isFilter } from "./positionals.js";

/**
 * Get the document root node for a given node.
 */
export function getDocumentRoot(node: AnyNode): AnyNode {
    while (node.parent) node = node.parent;
    return node;
}

/**
 * Split selectors into plain selectors and selectors using positional filters.
 */
export function groupSelectors(
    selectors: Selector[][],
): [plain: Selector[][], filtered: Selector[][]] {
    const filteredSelectors: Selector[][] = [];
    const plainSelectors: Selector[][] = [];

    for (const selector of selectors) {
        if (selector.some(isFilter)) {
            filteredSelectors.push(selector);
        } else {
            plainSelectors.push(selector);
        }
    }

    return [plainSelectors, filteredSelectors];
}
