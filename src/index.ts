import { parse, Selector, PseudoSelector } from "css-what";
import {
    _compileToken as compile,
    Options as CSSSelectOptions,
} from "css-select";
import { find, getChildren, removeSubsets, uniqueSort } from "domutils";
import type { Element, Node } from "domhandler";

type Filter = "first" | "last" | "eq" | "gt" | "lt" | "even" | "odd";
const filterNames = new Set(["first", "last", "eq", "gt", "lt", "even", "odd"]);

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
        case "eq":
        case "lt":
            return isFinite(num) ? num + 1 : 0;
        case "gt":
            return isFinite(num) && num >= 0 ? Infinity : 0;
        default:
            return Infinity;
    }
}

function filterElements(
    filter: string,
    elems: Node[],
    data: string | null
): Node[] {
    const num = data != null ? parseInt(data, 10) : NaN;

    switch (filter) {
        case "first":
        case "lt":
            // Already done in `getLimit`
            return elems;
        case "last":
            return elems.length > 0 ? [elems[elems.length - 1]] : elems;
        case "eq":
            return isFinite(num) && Math.abs(num) < elems.length
                ? [num < 0 ? elems[elems.length - num] : elems[num]]
                : [];
        case "gt":
            return isFinite(num) ? elems.slice(num) : [];
        case "even":
            return elems.filter((_, i) => i % 2 === 0);
        case "odd":
            return elems.filter((_, i) => i % 2 === 1);
    }

    throw new Error("Did not check all cases");
}

function isFilter(s: Selector): s is CheerioSelector {
    return s.type === "pseudo" && filterNames.has(s.name);
}

export default function select(
    root: Node | Node[],
    selector: string,
    options: Options
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
    return uniqueSort(results.reduce((a, b) => [...a, ...b]));
}

function findFilterElements(
    root: Node | Node[],
    sel: Selector[],
    options: Options
): Node[] {
    const filterIndex = sel.findIndex(isFilter);
    const sub = sel.slice(0, filterIndex);
    // @ts-expect-error `findIndex` is not smart enough here
    const filter: CheerioSelector = sel[filterIndex];

    /*
     * Set the number of elements to retrieve.
     * Eg. for :first, we only have to get a single element
     */
    const limit = getLimit(filter.name, filter.data);

    const elems = findElements(root, [sub], options, limit);

    const result = filterElements(filter.name, elems, filter.data);

    if (!result.length || sel.length === filterIndex + 1) {
        return result;
    }

    const remainingSelector = sel.slice(filterIndex + 1);

    // Add a scope token in front of the remaining selector
    remainingSelector.unshift({ type: "pseudo", name: "scope", data: null });

    if (remainingSelector.some(isFilter)) {
        return findFilterElements(result, remainingSelector, options);
    }

    // Query existing elements
    return findElements(result, [remainingSelector], options, Infinity);
}

function findElements(
    root: Node | Node[],
    sel: Selector[][],
    options: Options,
    limit: number
) {
    if (limit === 0) return [];

    const cmp = compile(sel, options, root);
    const elems = Array.isArray(root) ? removeSubsets(root) : getChildren(root);
    return find(cmp, elems, true, limit);
}
