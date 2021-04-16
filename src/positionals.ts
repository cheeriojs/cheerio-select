import type { Selector, PseudoSelector } from "css-what";

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

export interface CheerioSelector extends PseudoSelector {
    name: Filter;
    data: string | null;
}

export function isFilter(s: Selector): s is CheerioSelector {
    if (s.type !== "pseudo") return false;
    if (filterNames.has(s.name)) return true;
    if (s.name === "not" && Array.isArray(s.data)) {
        // Only consider `:not` with embedded filters
        return s.data.some((s) => s.some(isFilter));
    }

    return false;
}

export function getLimit(filter: Filter, data: string | null): number {
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
