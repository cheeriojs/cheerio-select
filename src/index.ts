import { parse, Selector, PseudoSelector, Traversal } from "css-what";
import {
    _compileToken as compileToken,
    Options as CSSSelectOptions,
    prepareContext,
} from "css-select";
import * as DomUtils from "domutils";
import type { Element, Node } from "domhandler";

type Filter =
    | "first"
    | "last"
    | "eq"
    | "nth"
    | "gt"
    | "lt"
    | "even"
    | "odd"
    | "not";
const filterNames = new Set([
    "first",
    "last",
    "eq",
    "gt",
    "nth",
    "lt",
    "even",
    "odd",
]);

const SCOPE_PSEUDO: PseudoSelector = {
    type: "pseudo",
    name: "scope",
    data: null,
};
const UNIVERSAL_SELECTOR: Selector = { type: "universal", namespace: null };

interface CheerioSelector extends PseudoSelector {
    name: Filter;
    data: string | null;
}
type Options = CSSSelectOptions<Node, Element>;

function getLimit(filter: Filter, data: string | null) {
    const num = data != null ? parseInt(data, 10) : NaN;

    switch (filter) {
        case "first":
            return 1;
        case "nth":
        case "eq":
            return isFinite(num) ? (num >= 0 ? num + 1 : Infinity) : 0;
        case "lt":
            return isFinite(num) ? (num >= 0 ? num : Infinity) : 0;
        case "gt":
            return isFinite(num) ? Infinity : 0;
        default:
            return Infinity;
    }
}

function filterByPosition(
    filter: Filter,
    elems: Element[],
    data: Selector[][] | string | null,
    options: Options
): Element[] {
    const num = typeof data === "string" ? parseInt(data, 10) : NaN;

    switch (filter) {
        case "first":
        case "lt":
            // Already done in `getLimit`
            return elems;
        case "last":
            return elems.length > 0 ? [elems[elems.length - 1]] : elems;
        case "nth":
        case "eq":
            return isFinite(num) && Math.abs(num) < elems.length
                ? [num < 0 ? elems[elems.length + num] : elems[num]]
                : [];
        case "gt":
            return isFinite(num) ? elems.slice(num + 1) : [];
        case "even":
            return elems.filter((_, i) => i % 2 === 0);
        case "odd":
            return elems.filter((_, i) => i % 2 === 1);
        case "not": {
            const filtered = new Set(
                (data as Selector[][])
                    .map((sel) =>
                        findFilterElements(
                            elems,
                            [...sel, SCOPE_PSEUDO],
                            options
                        )
                    )
                    // TODO: Use flatMap
                    .reduce((arr, rest) => [...arr, ...rest], [])
            );

            return elems.filter((e) => !filtered.has(e));
        }
    }
}

function isFilter(s: Selector): s is CheerioSelector {
    if (s.type !== "pseudo") return false;
    if (filterNames.has(s.name)) return true;
    if (s.name === "not" && Array.isArray(s.data)) {
        // Only consider `:not` with embedded filters
        return s.data.some((s) => s.some(isFilter));
    }

    return false;
}

export function select(
    selector: string,
    root: Element | Element[],
    options: Options = {}
): Node[] {
    const sel = parse(selector);
    const filteredSelectors: Selector[][] = [];
    const plainSelectors: Selector[][] = [];

    for (const subSel of sel) {
        if (subSel.some(isFilter)) {
            filteredSelectors.push(subSel);
        } else {
            plainSelectors.push(subSel);
        }
    }

    const results: Node[][] = filteredSelectors.map((sel) =>
        findFilterElements(root, sel, options)
    );

    // Plain selectors can be queried in a single go
    if (plainSelectors.length) {
        results.push(findElements(root, plainSelectors, options, Infinity));
    }

    // If there was only a single selector, just return the result
    if (results.length === 1) {
        return results[0];
    }

    // Sort results, filtering for duplicates
    return DomUtils.uniqueSort(results.reduce((a, b) => [...a, ...b]));
}

// Traversals that are treated differently in css-select.
const specialTraversal = new Set<Traversal["type"]>([
    "descendant",
    "adjacent",
]) as Set<string>;

function findFilterElements(
    root: Element | Element[],
    sel: Selector[],
    options: Options
): Node[] {
    const filterIndex = sel.findIndex(isFilter);
    const sub = sel.slice(0, filterIndex);
    const filter: CheerioSelector = sel[filterIndex] as CheerioSelector;

    /*
     * Set the number of elements to retrieve.
     * Eg. for :first, we only have to get a single element.
     */
    const limit = getLimit(filter.name, filter.data);

    if (limit === 0) return [];

    /*
     * Skip `findElements` call if our selector starts with a positional
     * pseudo.
     */
    const elems =
        sub.length === 0 && !Array.isArray(root)
            ? DomUtils.getChildren(root).filter(DomUtils.isTag)
            : sub.length === 0 || (sub.length === 1 && sub[0] === SCOPE_PSEUDO)
            ? Array.isArray(root)
                ? root.slice(0, limit)
                : [root]
            : findElements(root, [sub], options, limit);

    const result = filterByPosition(filter.name, elems, filter.data, options);

    if (!result.length || sel.length === filterIndex + 1) {
        return result;
    }

    const remainingSelector = sel.slice(filterIndex + 1);

    /*
     * Some types of traversals have special logic when they start a selector
     * in css-select. If this is the case, add a universal selector in front of
     * the selector to avoid this behavior.
     */
    if (specialTraversal.has(remainingSelector[0].type)) {
        remainingSelector.unshift(UNIVERSAL_SELECTOR);
    }

    // Add a scope token in front of the remaining selector
    remainingSelector.unshift(SCOPE_PSEUDO);

    if (remainingSelector.some(isFilter)) {
        return findFilterElements(result, remainingSelector, options);
    }

    // Query existing elements
    return findElements(result, [remainingSelector], options, Infinity);
}

function findElements(
    root: Element | Element[],
    sel: Selector[][],
    options: Options,
    limit: number
): Element[] {
    if (limit === 0) return [];

    // @ts-expect-error TS seems to mess up the type here ¯\_(ツ)_/¯
    const query = compileToken<Node, Element>(sel, options, root);
    const elems = prepareContext<Node, Element>(
        root,
        DomUtils,
        query.shouldTestNextSiblings
    );

    return DomUtils.find(
        (node: Node) => DomUtils.isTag(node) && query(node),
        elems,
        true,
        limit
    ) as Element[];
}
