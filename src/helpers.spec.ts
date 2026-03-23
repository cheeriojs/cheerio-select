import { parse } from "css-what";
import { describe, expect, it } from "vitest";
import { groupSelectors } from "./helpers.js";

describe("helpers", () => {
    describe("groupSelectors", () => {
        it("should group selectors", () => {
            const selector = parse("foo, bar, baz, :first, :last");
            const [plainSelectors, filteredSelectors] =
                groupSelectors(selector);

            expect(plainSelectors).toHaveLength(3);
            expect(filteredSelectors).toHaveLength(2);
        });

        it("should query sub-selectors", () => {
            const selector = parse(
                "foo, bar, baz, :not(:last), :not(:not(:first))",
            );
            const [plainSelectors, filteredSelectors] =
                groupSelectors(selector);

            expect(plainSelectors).toHaveLength(3);
            expect(filteredSelectors).toHaveLength(2);
        });
    });
});
