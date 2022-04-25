import type { AnyNode } from "domhandler";
import type { Selector } from "css-what";
import { isFilter } from "./positionals";

export function getDocumentRoot(node: AnyNode): AnyNode {
    while (node.parent) node = node.parent;
    return node;
}

export function groupSelectors(
    selectors: Selector[][]
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
