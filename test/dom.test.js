import assert from "node:assert/strict";
import { test } from "node:test";
import { html, raw } from "../ui/dom.js";

test("values are escaped", () => {
  assert.equal(
    String(html`<b>${"<img onerror=x>"}</b>`),
    "<b>&lt;img onerror=x&gt;</b>",
  );
  assert.equal(String(html`<a title="${'"'}">`), '<a title="&quot;">');
});

test("safe html nests without double escaping", () => {
  assert.equal(String(html`<b>${html`<i>a</i>`}</b>`), "<b><i>a</i></b>");
  assert.equal(String(html`<b>${raw("<i>a</i>")}</b>`), "<b><i>a</i></b>");
});

test("arrays join and empty values disappear", () => {
  assert.equal(
    String(html`${[html`<i></i>`, "x"]}${null}${false}${undefined}`),
    "<i></i>x",
  );
});

test("zero is a value", () => {
  assert.equal(String(html`${0}`), "0");
});

test("arrays escape their strings", () => {
  assert.equal(String(html`${["<b>"]}`), "&lt;b&gt;");
});
