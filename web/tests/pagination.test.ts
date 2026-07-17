import assert from "node:assert/strict";
import { buildPaginatedHref, getVisiblePageNumbers, paginateItems, parsePageNumber, PUBLIC_DIRECTORY_PAGE_SIZE } from "../lib/pagination";

assert.equal(PUBLIC_DIRECTORY_PAGE_SIZE, 9);
assert.equal(parsePageNumber(undefined), 1);
assert.equal(parsePageNumber(""), 1);
assert.equal(parsePageNumber("abc"), 1);
assert.equal(parsePageNumber("-2"), 1);
assert.equal(parsePageNumber("2.5"), 1);
assert.equal(parsePageNumber("3"), 3);

const values = Array.from({ length: 21 }, (_, index) => index + 1);
assert.deepEqual(paginateItems(values, 1), { items: values.slice(0, 9), total: 21, page: 1, pageSize: 9, totalPages: 3 });
assert.deepEqual(paginateItems(values, "2").items, values.slice(9, 18));
assert.deepEqual(paginateItems(values, "999"), { items: values.slice(18), total: 21, page: 3, pageSize: 9, totalPages: 3 });
assert.deepEqual(paginateItems(values, "invalid").items, values.slice(0, 9));
assert.deepEqual(paginateItems([], 8), { items: [], total: 0, page: 1, pageSize: 9, totalPages: 0 });
assert.throws(() => paginateItems(values, 1, 0), RangeError);

assert.deepEqual(getVisiblePageNumbers(1, 10), [1, 2, 3, 4, 5]);
assert.deepEqual(getVisiblePageNumbers(5, 10), [3, 4, 5, 6, 7]);
assert.deepEqual(getVisiblePageNumbers(10, 10), [6, 7, 8, 9, 10]);
assert.deepEqual(getVisiblePageNumbers(99, 3), [1, 2, 3]);
assert.deepEqual(getVisiblePageNumbers(1, 0), []);

assert.equal(buildPaginatedHref("/works", 2, { q: "AI agent", race: "bay-area", page: 8 }), "/works?q=AI+agent&race=bay-area&page=2");
assert.equal(buildPaginatedHref("/", 1, { q: "骑行", status: "", page: 3 }, "race-gallery"), "/?q=%E9%AA%91%E8%A1%8C#race-gallery");

console.log("PASS public directory pagination normalizes, clamps and slices pages");
