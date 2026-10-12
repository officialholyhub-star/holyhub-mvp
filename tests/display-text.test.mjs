import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { decodeDisplayText } from "../lib/display-text.ts";

test("numeric and common named entities become readable text", () => {
  assert.equal(decodeDisplayText("HolyHu&#x62; van&#x73;"), "HolyHub vans");
  assert.equal(decodeDisplayText("Tom&#39;s &amp; Jane&#x2019;s &pound;5"), "Tom's & Jane’s £5");
  assert.equal(decodeDisplayText("&#128591; &quot;Hello&quot;"), '🙏 "Hello"');
});

test("unknown or invalid entities and intentional literal encoding are preserved", () => {
  for (const value of ["&#x110000;", "&#xD800;", "&#0;", "&unknown;", "&constructor;", "Fish & chips"]) assert.equal(decodeDisplayText(value), value);
  assert.equal(decodeDisplayText("&amp;#x62;"), "&#x62;");
});

test("decoded markup remains escaped React text, including event handlers and scripts", () => {
  const value = decodeDisplayText('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&lt;script&gt;alert(2)&lt;/script&gt;');
  const html = renderToStaticMarkup(React.createElement("span", null, value));
  assert.ok(!html.includes("<img"));
  assert.ok(!html.includes("<script"));
  assert.ok(html.includes("&lt;img"));
  assert.ok(html.includes("&lt;script&gt;"));
});
