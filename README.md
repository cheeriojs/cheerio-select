# cheerio-select

CSS selector engine supporting jQuery selectors, based on [`css-select`](https://github.com/fb55/css-select).

Supports all jQuery positional pseudo-selectors:

-   `:first`
-   `:last`
-   `:eq`
-   `:nth`
-   `:gt`
-   `:lt`
-   `:even`
-   `:odd`
-   `:not(:positional)`, where `:positional` is any of the above.

This library is a thin wrapper around [`css-select`](https://github.com/fb55/css-select).
Only use this module if you will actually use jQuery positional selectors.
