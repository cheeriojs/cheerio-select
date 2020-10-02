import { parse, Selector, PseudoSelector } from "css-what";
import {
    _compileToken as compile,
    Options as CSSSelectOptions,
    appendNextSiblings,
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
const UNIVERSAL_SELECTOR: Selector = { type: "universal" };

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

function filterElements(
    filter: string,
    elems: Node[],
    data: Selector[][] | string | null,
    options: Options
): Node[] {
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
        case "not":
            return filterNot(elems, data as Selector[][], options);
    }

    throw new Error("Did not check all cases");
}

function filterNot(elems: Node[], data: Selector[][], options: Options) {
    const filtered = new Set(
        data
            .map((sel) =>
                findFilterElements(elems, [SCOPE_PSEUDO, ...sel], options)
            )
            // TODO: Use flatMap here
            .reduce((arr, rest) => [...arr, ...rest], [])
    );

    return elems.filter((e) => !filtered.has(e));
}

function isFilter(s: Selector): s is CheerioSelector {
    if (s.type !== "pseudo") return false;
    if (filterNames.has(s.name)) return true;
    if (s.name === "not" && Array.isArray(s.data)) {
        return s.data.some((s) => s.some(isFilter));
    }

    return false;
}

export function select(
    selector: string,
    root: Node | Node[],
    options: Options = {}
): Node[] {
    const sel = parse(selector);
    const results: Node[][] = [];
    const plainSelectors: Selector[][] = [];

    for (let i = 0; i < sel.length; i++) {
        if (sel[i].some(isFilter)) {
            results.push(findFilterElements(root, sel[i], options));
        } else {
            plainSelectors.push(sel[i]);
        }
    }

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
const specialTraversal = new Set(["descendant", "adjacent", "siblingsibling"]);

function findFilterElements(
    root: Node | Node[],
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

    const result = filterElements(filter.name, elems, filter.data, options);

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
    root: Node | Node[],
    sel: Selector[][],
    options: CSSSelectOptions<Node, Element>,
    limit: number
) {
    if (limit === 0) return [];

    // @ts-ignore
    const query = compile<Node, Element>(sel, options, root);

    if (query.shouldTestNextSiblings) {
        // @ts-ignore
        root = appendNextSiblings(root, DomUtils);
    }

    const elems = Array.isArray(root)
        ? DomUtils.removeSubsets(root)
        : DomUtils.getChildren(root);

    return DomUtils.find(
        (node: Node) => DomUtils.isTag(node) && query(node),
        elems,
        true,
        limit
    );
}
