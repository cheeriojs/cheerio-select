import { parse, Selector, PseudoSelector, isTraversal } from "css-what";
import {
    _compileToken as compileToken,
    Options as CSSSelectOptions,
    prepareContext,
} from "css-select";
import * as DomUtils from "domutils";
import type { Element, Node } from "domhandler";
import { getDocumentRoot, groupSelectors } from "./helpers";
import { Filter, isFilter, CheerioSelector, getLimit } from "./positionals";

// Re-export pseudo extension points
export { filters, pseudos, aliases } from "css-select";

/** Used to indicate a scope should be filtered. Might be ignored when filtering. */
const SCOPE_PSEUDO: PseudoSelector = {
    type: "pseudo",
    name: "scope",
    data: null,
};
/** Used for actually filtering for scope. */
const CUSTOM_SCOPE_PSEUDO: PseudoSelector = { ...SCOPE_PSEUDO };
const UNIVERSAL_SELECTOR: Selector = { type: "universal", namespace: null };

export type Options = CSSSelectOptions<Node, Element>;

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
                filterParsed(data as Selector[][], elems, options)
            );

            return elems.filter((e) => !filtered.has(e));
        }
    }
}

export function filter(
    selector: string,
    elements: Element[],
    options: Options = {}
): Element[] {
    return filterParsed(parse(selector, options), elements, options);
}

/**
 * Filter a set of elements by a selector.
 *
 * Will return elements in the original order.
 *
 * @param selector Selector to filter by.
 * @param elements Elements to filter.
 * @param options Options for selector.
 */
function filterParsed(
    selector: Selector[][],
    elements: Element[],
    options: Options
) {
    if (elements.length === 0) return [];

    const [plainSelectors, filteredSelectors] = groupSelectors(selector);
    let found: undefined | Set<Element>;

    if (plainSelectors.length) {
        const filtered = filterElements(elements, plainSelectors, options);

        // If there are no filters, just return
        if (filteredSelectors.length === 0) {
            return filtered;
        }

        // Otherwise, we have to do some filtering
        if (filtered.length) {
            found = new Set(filtered);
        }
    }

    for (let i = 0; i < filteredSelectors.length; i++) {
        const filteredSelector = filteredSelectors[i];
        const missing = found
            ? elements.filter((e) => !found!.has(e))
            : elements;

        if (missing.length === 0) break;
        let filtered: Element[];

        if (filteredSelector.some(isTraversal)) {
            /*
             * Get one root node, run selector with the scope
             * set to all of our nodes.
             */
            const root = getDocumentRoot(elements[0]);
            const sel = [...filteredSelector, CUSTOM_SCOPE_PSEUDO];
            filtered = findFilterElements(
                root as Element,
                sel,
                options,
                true,
                elements
            );
        } else {
            // Performance optimization: If we don't have to traverse, just filter set.
            filtered = findFilterElements(
                elements,
                filteredSelector,
                options,
                false
            );
        }

        if (!found) {
            /*
             * If we haven't found anything before the last selector,
             * just return what we found now.
             */
            if (i === filteredSelectors.length - 1) {
                return filtered;
            }
            if (filtered.length) {
                found = new Set(filtered);
            }
        } else if (filtered.length) {
            filtered.forEach((el) => found!.add(el));
        }
    }

    return typeof found !== "undefined"
        ? elements.filter((el) => found!.has(el))
        : [];
}

export function select(
    selector: string | ((el: Element) => boolean),
    root: Element | Element[],
    options: Options = {}
): Element[] {
    if (typeof selector === "function") {
        return find(root, selector);
    }

    const [plain, filtered] = groupSelectors(parse(selector, options));

    const results: Element[][] = filtered.map((sel) =>
        findFilterElements(root, sel, options, true)
    );

    // Plain selectors can be queried in a single go
    if (plain.length) {
        results.push(findElements(root, plain, options, Infinity));
    }

    // If there was only a single selector, just return the result
    if (results.length === 1) {
        return results[0];
    }

    // Sort results, filtering for duplicates
    return DomUtils.uniqueSort(
        results.reduce((a, b) => [...a, ...b])
    ) as Element[];
}

// Traversals that are treated differently in css-select.
const specialTraversal = new Set<Selector["type"]>(["descendant", "adjacent"]);

function includesScopePseudo(t: Selector): boolean {
    return (
        t !== SCOPE_PSEUDO &&
        t.type === "pseudo" &&
        (t.name === "scope" ||
            (Array.isArray(t.data) &&
                t.data.some((data) => data.some(includesScopePseudo))))
    );
}

function addContextIfScope(
    selector: Selector[],
    options: Options,
    scopeContext?: Element[]
) {
    return scopeContext && selector.some(includesScopePseudo)
        ? { ...options, context: scopeContext }
        : options;
}

/**
 *
 * @param root Element(s) to search from.
 * @param selector Selector to look for.
 * @param options Options for querying.
 * @param queryForSelector Query multiple levels deep for the initial selector, even if it doesn't contain a traversal.
 * @param scopeContext Optional context for a :scope.
 */
function findFilterElements(
    root: Element | Element[],
    selector: Selector[],
    options: Options,
    queryForSelector: boolean,
    scopeContext?: Element[]
): Element[] {
    const filterIndex = selector.findIndex(isFilter);
    const sub = selector.slice(0, filterIndex);
    const filter: CheerioSelector = selector[filterIndex] as CheerioSelector;

    /*
     * Set the number of elements to retrieve.
     * Eg. for :first, we only have to get a single element.
     */
    const limit = getLimit(filter.name, filter.data);

    if (limit === 0) return [];

    const subOpts = addContextIfScope(sub, options, scopeContext);

    /*
     * Skip `findElements` call if our selector starts with a positional
     * pseudo.
     */
    const elemsNoLimit =
        sub.length === 0 && !Array.isArray(root)
            ? DomUtils.getChildren(root).filter(DomUtils.isTag)
            : sub.length === 0 || (sub.length === 1 && sub[0] === SCOPE_PSEUDO)
            ? Array.isArray(root)
                ? root
                : [root]
            : queryForSelector || sub.some(isTraversal)
            ? findElements(root, [sub], subOpts, limit)
            : // We know that this cannot be reached with root not being an array.
              filterElements(root as Element[], [sub], subOpts);

    const elems = elemsNoLimit.slice(0, limit);

    const result = filterByPosition(filter.name, elems, filter.data, options);

    if (result.length === 0 || selector.length === filterIndex + 1) {
        return result;
    }

    const remainingSelector = selector.slice(filterIndex + 1);
    const remainingHasTraversal = remainingSelector.some(isTraversal);

    const remainingOpts = addContextIfScope(
        remainingSelector,
        options,
        scopeContext
    );

    if (remainingHasTraversal) {
        /*
         * Some types of traversals have special logic when they start a selector
         * in css-select. If this is the case, add a universal selector in front of
         * the selector to avoid this behavior.
         */
        if (specialTraversal.has(remainingSelector[0].type)) {
            remainingSelector.unshift(UNIVERSAL_SELECTOR);
        }

        /*
         * Add a scope token in front of the remaining selector,
         * to make sure traversals don't match elements that aren't a
         * part of the considered tree.
         */
        remainingSelector.unshift(SCOPE_PSEUDO);
    }

    /*
     * If we have another filter, recursively call `findFilterElements`,
     * with the `recursive` flag disabled. We only have to look for more
     * elements when we see a traversal.
     *
     * Otherwise,
     */
    return remainingSelector.some(isFilter)
        ? findFilterElements(
              result,
              remainingSelector,
              options,
              false,
              scopeContext
          )
        : remainingHasTraversal
        ? // Query existing elements to resolve traversal.
          findElements(result, [remainingSelector], remainingOpts, Infinity)
        : // If we don't have any more traversals, simply filter elements.
          filterElements(result, [remainingSelector], remainingOpts);
}

interface CompiledQuery {
    (el: Element): boolean;
    shouldTestNextSiblings?: boolean;
}

function findElements(
    root: Element | Element[],
    sel: Selector[][],
    options: Options,
    limit: number
): Element[] {
    if (limit === 0) return [];

    const query: CompiledQuery = compileToken<Node, Element>(
        sel,
        // @ts-expect-error TS seems to mess up the type here ¯\_(ツ)_/¯
        options,
        root
    );

    return find(root, query, limit);
}

function find(
    root: Element | Element[],
    query: CompiledQuery,
    limit = Infinity
): Element[] {
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

function filterElements(
    elements: Element[],
    sel: Selector[][],
    options: Options
): Element[] {
    // @ts-expect-error TS seems to mess up the type here ¯\_(ツ)_/¯
    const query = compileToken<Node, Element>(sel, options);
    return elements.filter(query);
}
