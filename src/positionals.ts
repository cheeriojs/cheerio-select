import type { PseudoSelector, Selector } from "css-what";

/**
 * Positional pseudo filters supported by cheerio-select.
 */
export type Filter =
    | "first"
    | "last"
    | "eq"
    | "nth"
    | "gt"
    | "lt"
    | "even"
    | "odd"
    | "not";

/**
 * Set of positional filter names.
 */
export const filterNames: Set<string> = new Set<Filter>([
    "first",
    "last",
    "eq",
    "gt",
    "nth",
    "lt",
    "even",
    "odd",
]);

/**
 * Pseudo selector with positional filter semantics.
 */
export interface CheerioSelector extends PseudoSelector {
    name: Filter;
    data: string | null;
}

/**
 * Check whether a selector token is a positional filter.
 */
export function isFilter(s: Selector): s is CheerioSelector {
    if (s.type !== "pseudo") return false;
    if (filterNames.has(s.name)) return true;
    if (s.name === "not" && Array.isArray(s.data)) {
        // Only consider `:not` with embedded filters
        return s.data.some((s) => s.some(isFilter));
    }

    return false;
}

/**
 * Calculate the maximum number of elements needed for a positional filter.
 */
export function getLimit(
    filter: Filter,
    data: string | null,
    partLimit: number,
): number {
    const parsedNumber = data == null ? Number.NaN : Number.parseInt(data, 10);

    switch (filter) {
        case "first": {
            return 1;
        }
        case "nth":
        case "eq": {
            return Number.isFinite(parsedNumber)
                ? parsedNumber >= 0
                    ? parsedNumber + 1
                    : Infinity
                : 0;
        }
        case "lt": {
            return Number.isFinite(parsedNumber)
                ? parsedNumber >= 0
                    ? Math.min(parsedNumber, partLimit)
                    : Infinity
                : 0;
        }
        case "gt": {
            return Number.isFinite(parsedNumber) ? Infinity : 0;
        }
        case "odd": {
            return 2 * partLimit;
        }
        case "even": {
            return 2 * partLimit - 1;
        }
        case "last":
        case "not": {
            return Infinity;
        }
    }
}
