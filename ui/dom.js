import { SCROLL_FOLLOW_THRESHOLD } from "../lib/constants.js";
import { escapeHtml } from "../lib/format.js";

/** Markup that is safe to put in the page: built by `html` or marked by `raw`. */
class SafeHtml {
  constructor(value) {
    this.value = value;
  }

  toString() {
    return this.value;
  }
}

/** For markup the extension itself wrote. Never pass it a value from the API. */
export function raw(markup) {
  return new SafeHtml(String(markup));
}

function renderValue(value) {
  if (value === null || value === undefined || value === false) return "";
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(renderValue).join("");
  return escapeHtml(value);
}

/** Template tag: every interpolated value is escaped unless it is SafeHtml. */
export function html(strings, ...values) {
  let markup = strings[0];
  values.forEach((value, index) => {
    markup += renderValue(value) + strings[index + 1];
  });
  return new SafeHtml(markup);
}

const lastMarkup = new WeakMap();

/** Replaces the content, unless it is the same: scroll and focus stay. */
export function setHtml(element, safe) {
  const markup = String(safe);
  if (lastMarkup.get(element) === markup) return;
  lastMarkup.set(element, markup);
  element.innerHTML = markup;
}

function toElement(markup) {
  const template = document.createElement("template");
  template.innerHTML = markup.trim();
  return template.content.firstElementChild;
}

/**
 * Makes `container` show `items`. Elements whose markup didn't change stay in
 * the page, so a refresh doesn't disturb a hover, a focus or an animation.
 */
export function renderKeyed(container, items, keyOf, render) {
  const existing = new Map();
  for (const child of container.children) {
    if (child.dataset.key !== undefined) existing.set(child.dataset.key, child);
  }

  let previous = null;
  for (const item of items) {
    const key = String(keyOf(item));
    const markup = String(render(item));
    let element = existing.get(key);

    if (!element || lastMarkup.get(element) !== markup) {
      const next = toElement(markup);
      next.dataset.key = key;
      lastMarkup.set(next, markup);
      element?.replaceWith(next);
      element = next;
    }

    const expected = previous
      ? previous.nextElementSibling
      : container.firstElementChild;
    if (element !== expected) container.insertBefore(element, expected);
    previous = element;
  }

  // Everything still wanted is in place at the start: the rest goes.
  let stale = previous ? previous.nextElementSibling : container.firstElementChild;
  while (stale) {
    const next = stale.nextElementSibling;
    stale.remove();
    stale = next;
  }

  // The content is no longer what setHtml last wrote here.
  lastMarkup.delete(container);
}

/**
 * Clicks on `[data-action]` call `handlers[action](dataset, element, event)`.
 * Returns the function that stops listening.
 */
export function delegate(root, handlers) {
  const listener = (event) => {
    const element = event.target.closest("[data-action]");
    if (!element || !root.contains(element) || element.disabled) return;

    const handler = handlers[element.dataset.action];
    if (handler) handler(element.dataset, element, event);
  };
  root.addEventListener("click", listener);
  return () => root.removeEventListener("click", listener);
}

/**
 * Keeps a scrolling element pinned to its end as content grows (live logs), but
 * only while the user is at the bottom: scrolling up to read pauses following,
 * scrolling back down resumes it.
 */
export function createLogFollower(element, { threshold = SCROLL_FOLLOW_THRESHOLD } = {}) {
  let following = true;

  const toEnd = () => {
    element.scrollTop = element.scrollHeight;
  };

  element.addEventListener(
    "scroll",
    () => {
      following =
        element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
    },
    { passive: true },
  );

  return {
    onContentChanged() {
      if (following) toEnd();
    },
    toLatest() {
      following = true;
      toEnd();
    },
  };
}
