# cheerio-select [![NPM version](https://img.shields.io/npm/v/cheerio-select.svg)](https://npmjs.org/package/cheerio-select) [![Node.js CI](https://github.com/cheeriojs/cheerio-select/actions/workflows/nodejs-test.yml/badge.svg)](https://github.com/cheeriojs/cheerio-select/actions/workflows/nodejs-test.yml) [![Downloads](https://img.shields.io/npm/dm/cheerio-select.svg)](https://npmjs.org/package/cheerio-select) [![Coverage](https://coveralls.io/repos/cheeriojs/cheerio-select/badge.svg?branch=master)](https://coveralls.io/r/cheeriojs/cheerio-select)

`cheerio-select` is a CSS selector engine that supports jQuery selectors, based
on the [`css-select`](https://github.com/fb55/css-select) library. This library
is a thin wrapper around [`css-select`](https://github.com/fb55/css-select) that
adds support for all of the jQuery positional pseudo-selectors:

- `:first`: Selects the first element in the set of elements.
- `:last`: Selects the last element in the set of elements.
- `:eq(index)`: Selects the element with the specified index.
- `:nth(index)`: Selects the element with the specified index. This pseudo-class
  is equivalent to :eq.
- `:gt(index)`: Selects elements with a higher index than the specified value.
- `:lt(index)`: Selects elements with a lower index than the specified value.
- `:even`: Selects even elements, zero-indexed. For example, :even will select
  the second, fourth, and sixth elements.
- `:odd`: Selects odd elements, zero-indexed. For example, :odd will select the
  first, third, and fifth elements.
- `:not(:positional)`, where `:positional` is any of the above: Excludes
  elements that match the specified selector.

## Installation

To install cheerio-select, use npm:

```bash
npm install cheerio-select
```

## Usage

```js
import { parseDocument } from "htmlparser2";
import { select, filter, is, some } from "cheerio-select";

const document = parseDocument("<html><body><div></div></body></html>");

const dom = parseDocument("<div><p>First<p>Second");

// Select all divs
expect(select("div", dom)).toHaveLength(1);

// Accepts a function as a selector
expect(select((elem) => elem.name === "p", dom)).toHaveLength(2);

// Supports positionals
expect(select("p:first", dom)).toHaveLength(1);

// Supports filtering
expect(filter("p:contains(First)", dom.children)).toHaveLength(1);

// Supports checking whether an element matches a selector
expect(is("p", dom.children[0])).toBe(true);

// Supports checking whether any element in a list matches a selector
expect(some("p", dom.children)).toBe(true);
```

## Note

Only use this module if you will actually use jQuery positional selectors in
your project. If you do not need these specific selectors, it is recommended to
use the [`css-select`](https://github.com/fb55/css-select) library directly.

## License

This project is licensed under the BSD-2-Clause license. See the
[LICENSE](LICENSE) file for more info.
