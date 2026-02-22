import * as boolbase from "boolbase";
import {
    type Options as CSSSelectOptions,
    _compileToken as compileToken,
    prepareContext,
} from "css-select";
import { isTraversal, parse, type Selector, SelectorType } from "css-what";
import type { AnyNode, Document, Element } from "domhandler";
import * as DomUtils from "domutils";
import { getDocumentRoot, groupSelectors } from "./helpers.js";
import {
    type CheerioSelector,
    type Filter,
    getLimit,
    isFilter,
} from "./positionals.js";

// Re-export pseudo extension points
export { aliases, filters, pseudos } from "css-select";

const UNIVERSAL_SELECTOR: Selector = {
    type: SelectorType.Universal,
    namespace: null,
};
const SCOPE_PSEUDO: Selector = {
    type: SelectorType.Pseudo,
    name: "scope",
    data: null,
};

/**
 * Options for cheerio-select queries.
 */
export interface Options extends CSSSelectOptions<AnyNode, Element> {
    /** Optional reference to the root of the document. If not set, this will be computed when needed. */
    root?: Document;
}

/**
 * Check whether an element matches a selector.
 */
export function is(
    element: Element,
    selector: string | ((element_: Element) => boolean),
    options: Options = {},
): boolean {
    return some([element], selector, options);
}

/**
 * Check whether at least one element in a list matches a selector.
 */
export function some(
    elements: Element[],
    selector: string | ((element: Element) => boolean),
    options: Options = {},
): boolean {
    if (typeof selector === "function") return elements.some(selector);

    const [plain, filtered] = groupSelectors(parse(selector));

    return (
        (plain.length > 0 && elements.some(compileToken(plain, options))) ||
        filtered.some(
            (sel) => filterBySelector(sel, elements, options).length > 0,
        )
    );
}

function filterByPosition(
    filter: Filter,
    elements: Element[],
    data: Selector[][] | string | null,
    options: Options,
): Element[] {
    const number_ =
        typeof data === "string" ? Number.parseInt(data, 10) : Number.NaN;

    switch (filter) {
        case "first":
        case "lt": {
            // Already done in `getLimit`
            return elements;
        }
        case "last": {
            return elements.length > 0
                ? [elements[elements.length - 1]]
                : elements;
        }
        case "nth":
        case "eq": {
            return isFinite(number_) && Math.abs(number_) < elements.length
                ? [
                      number_ < 0
                          ? elements[elements.length + number_]
                          : elements[number_],
                  ]
                : [];
        }
        case "gt": {
            return isFinite(number_) ? elements.slice(number_ + 1) : [];
        }
        case "even": {
            return elements.filter((_, index) => index % 2 === 0);
        }
        case "odd": {
            return elements.filter((_, index) => index % 2 === 1);
        }
        case "not": {
            const filtered = new Set(
                filterParsed(data as Selector[][], elements, options),
            );

            return elements.filter((e) => !filtered.has(e));
        }
    }
}

/**
 * Filter a list of nodes by selector.
 */
export function filter(
    selector: string,
    elements: AnyNode[],
    options: Options = {},
): Element[] {
    return filterParsed(parse(selector), elements, options);
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
    elements: AnyNode[],
    options: Options,
): Element[] {
    if (elements.length === 0) return [];

    const [plainSelectors, filteredSelectors] = groupSelectors(selector);
    let found: undefined | Set<Element>;

    if (plainSelectors.length > 0) {
        const filtered = filterElements(elements, plainSelectors, options);

        // If there are no filters, just return
        if (filteredSelectors.length === 0) {
            return filtered;
        }

        // Otherwise, we have to do some filtering
        if (filtered.length > 0) {
            found = new Set(filtered);
        }
    }

    for (
        let index = 0;
        index < filteredSelectors.length && found?.size !== elements.length;
        index++
    ) {
        const filteredSelector = filteredSelectors[index];
        const missing = found
            ? elements.filter((e) => DomUtils.isTag(e) && !found!.has(e))
            : elements;

        if (missing.length === 0) break;
        const filtered = filterBySelector(filteredSelector, elements, options);

        if (filtered.length > 0) {
            if (found) {
                for (const element of filtered) {
                    found!.add(element);
                }
            } else {
                /*
                 * If we haven't found anything before the last selector,
                 * just return what we found now.
                 */
                if (index === filteredSelectors.length - 1) {
                    return filtered;
                }

                found = new Set(filtered);
            }
        }
    }

    return found === undefined
        ? []
        : ((found.size === elements.length
              ? elements
              : // Filter elements to preserve order
                elements.filter((element) =>
                    (found as Set<AnyNode>).has(element),
                )) as Element[]);
}

function filterBySelector(
    selector: Selector[],
    elements: AnyNode[],
    options: Options,
) {
    if (selector.some(isTraversal)) {
        /*
         * Get root node, run selector with the scope
         * set to all of our nodes.
         */
        const root = options.root ?? getDocumentRoot(elements[0]);
        const options_ = {
            ...options,
            context: elements,
            relativeSelector: false,
        };
        selector.push(SCOPE_PSEUDO);
        return findFilterElements(
            root,
            selector,
            options_,
            true,
            elements.length,
        );
    }
    // Performance optimization: If we don't have to traverse, just filter set.
    return findFilterElements(
        elements,
        selector,
        options,
        false,
        elements.length,
    );
}

/**
 * Select matching elements from a root node or list of nodes.
 */
export function select(
    selector: string | ((element: Element) => boolean),
    root: AnyNode | AnyNode[],
    options: Options = {},
    limit = Infinity,
): Element[] {
    if (typeof selector === "function") {
        return find(root, selector);
    }

    const [plain, filtered] = groupSelectors(parse(selector));

    const results: Element[][] = filtered.map((sel) =>
        findFilterElements(root, sel, options, true, limit),
    );

    // Plain selectors can be queried in a single go
    if (plain.length > 0) {
        results.push(findElements(root, plain, options, limit));
    }

    if (results.length === 0) {
        return [];
    }

    // If there was only a single selector, just return the result
    if (results.length === 1) {
        return results[0];
    }

    // Sort results, filtering for duplicates
    return DomUtils.uniqueSort(results.reduce((a, b) => [...a, ...b]));
}

/**
 *
 * @param root Element(s) to search from.
 * @param selector Selector to look for.
 * @param options Options for querying.
 * @param queryForSelector Query multiple levels deep for the initial selector, even if it doesn't contain a traversal.
 */
function findFilterElements(
    root: AnyNode | AnyNode[],
    selector: Selector[],
    options: Options,
    queryForSelector: boolean,
    totalLimit: number,
): Element[] {
    const filterIndex = selector.findIndex(isFilter);
    const sub = selector.slice(0, filterIndex);
    const filter = selector[filterIndex] as CheerioSelector;
    // If we are at the end of the selector, we can limit the number of elements to retrieve.
    const partLimit =
        selector.length - 1 === filterIndex ? totalLimit : Infinity;

    /*
     * Set the number of elements to retrieve.
     * Eg. for :first, we only have to get a single element.
     */
    const limit = getLimit(filter.name, filter.data, partLimit);

    if (limit === 0) return [];

    /*
     * Skip `findElements` call if our selector starts with a positional
     * pseudo.
     */
    const elementsNoLimit =
        sub.length === 0 && !Array.isArray(root)
            ? DomUtils.getChildren(root).filter(DomUtils.isTag)
            : sub.length === 0
              ? (Array.isArray(root) ? root : [root]).filter(DomUtils.isTag)
              : queryForSelector || sub.some(isTraversal)
                ? findElements(root, [sub], options, limit)
                : filterElements(root, [sub], options);

    const elements = elementsNoLimit.slice(0, limit);

    let result = filterByPosition(filter.name, elements, filter.data, options);

    if (result.length === 0 || selector.length === filterIndex + 1) {
        return result;
    }

    const remainingSelector = selector.slice(filterIndex + 1);
    const remainingHasTraversal = remainingSelector.some(isTraversal);

    if (remainingHasTraversal) {
        if (isTraversal(remainingSelector[0])) {
            const { type } = remainingSelector[0];

            if (
                type === SelectorType.Sibling ||
                type === SelectorType.Adjacent
            ) {
                // If we have a sibling traversal, we need to also look at the siblings.
                result = prepareContext(result, DomUtils, true) as Element[];
            }

            // Avoid a traversal-first selector error.
            remainingSelector.unshift(UNIVERSAL_SELECTOR);
        }

        options = {
            ...options,
            // Avoid absolutizing the selector
            relativeSelector: false,
            /*
             * Add a custom root func, to make sure traversals don't match elements
             * that aren't a part of the considered tree.
             */
            rootFunc: (element: Element) => result.includes(element),
        };
    } else if (options.rootFunc && options.rootFunc !== boolbase.trueFunc) {
        options = { ...options, rootFunc: boolbase.trueFunc };
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
              totalLimit,
          )
        : remainingHasTraversal
          ? // Query existing elements to resolve traversal.
            findElements(result, [remainingSelector], options, totalLimit)
          : // If we don't have any more traversals, simply filter elements.
            filterElements(result, [remainingSelector], options);
}

interface CompiledQuery {
    (element: Element): boolean;
    shouldTestNextSiblings?: boolean;
}

function findElements(
    root: AnyNode | AnyNode[],
    sel: Selector[][],
    options: Options,
    limit: number,
): Element[] {
    const query: CompiledQuery = compileToken<AnyNode, Element>(
        sel,
        options,
        root,
    );

    return find(root, query, limit);
}

function find(
    root: AnyNode | AnyNode[],
    query: CompiledQuery,
    limit = Infinity,
): Element[] {
    const elements = prepareContext<AnyNode, Element>(
        root,
        DomUtils,
        query.shouldTestNextSiblings,
    );

    return DomUtils.find(
        (node: AnyNode) => DomUtils.isTag(node) && query(node),
        elements,
        true,
        limit,
    ) as Element[];
}

function filterElements(
    elements: AnyNode | AnyNode[],
    sel: Selector[][],
    options: Options,
): Element[] {
    const els = (Array.isArray(elements) ? elements : [elements]).filter(
        DomUtils.isTag,
    );

    if (els.length === 0) return els;

    const query = compileToken<AnyNode, Element>(sel, options);
    return query === boolbase.trueFunc ? els : els.filter(query);
}
