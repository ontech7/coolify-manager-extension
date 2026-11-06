import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import { createPoller } from "../lib/poll.js";

const INTERVAL = 5000;

/** Lets the promises of a tick settle. setImmediate isn't mocked. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

function fakeDocument() {
  const doc = new EventTarget();
  doc.hidden = false;
  doc.setHidden = (value) => {
    doc.hidden = value;
    doc.dispatchEvent(new Event("visibilitychange"));
  };
  return doc;
}

async function advance(ms) {
  mock.timers.tick(ms);
  await flush();
}

beforeEach(() => {
  mock.timers.reset();
  mock.timers.enable({ apis: ["setTimeout"] });
});

test("the first tick waits for the interval", async () => {
  let count = 0;
  const poller = createPoller({
    refresh: async () => count++,
    interval: INTERVAL,
    doc: fakeDocument(),
  });

  poller.start();
  await flush();
  assert.equal(count, 0);

  await advance(INTERVAL);
  assert.equal(count, 1);
  poller.stop();
});

test("the next tick starts after the previous one finished", async () => {
  let count = 0;
  let finish;
  const poller = createPoller({
    refresh: () => {
      count++;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
    interval: INTERVAL,
    doc: fakeDocument(),
  });

  poller.start();
  await advance(INTERVAL);
  assert.equal(count, 1);

  // Still in flight: nothing piles up.
  await advance(INTERVAL * 3);
  assert.equal(count, 1);

  finish();
  await flush();
  await advance(INTERVAL - 1);
  assert.equal(count, 1);
  await advance(1);
  assert.equal(count, 2);
  poller.stop();
});

test("a rejected refresh keeps polling", async () => {
  let count = 0;
  const poller = createPoller({
    refresh: async () => {
      count++;
      throw new Error("nope");
    },
    interval: INTERVAL,
    doc: fakeDocument(),
  });

  poller.start();
  await advance(INTERVAL);
  await advance(INTERVAL);
  assert.equal(count, 2);
  poller.stop();
});

test("no ticks while hidden, and a refresh right away on return", async () => {
  let count = 0;
  const doc = fakeDocument();
  const poller = createPoller({
    refresh: async () => count++,
    interval: INTERVAL,
    doc,
  });

  poller.start();
  doc.setHidden(true);
  await advance(INTERVAL * 5);
  assert.equal(count, 0);

  doc.setHidden(false);
  await flush();
  assert.equal(count, 1);

  await advance(INTERVAL);
  assert.equal(count, 2);
  poller.stop();
});

test("a poller started while hidden waits for the page to show", async () => {
  let count = 0;
  const doc = fakeDocument();
  doc.hidden = true;
  const poller = createPoller({
    refresh: async () => count++,
    interval: INTERVAL,
    doc,
  });

  poller.start();
  await advance(INTERVAL * 2);
  assert.equal(count, 0);

  doc.setHidden(false);
  await flush();
  assert.equal(count, 1);
  poller.stop();
});

test("returning during a refresh doesn't start a second one", async () => {
  let count = 0;
  let finish;
  const doc = fakeDocument();
  const poller = createPoller({
    refresh: () => {
      count++;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
    interval: INTERVAL,
    doc,
  });

  poller.start();
  await advance(INTERVAL);
  doc.setHidden(true);
  doc.setHidden(false);
  await flush();
  assert.equal(count, 1);

  finish();
  poller.stop();
});

test("isEnabled false skips the refresh and keeps the timer", async () => {
  let count = 0;
  let enabled = false;
  const poller = createPoller({
    refresh: async () => count++,
    interval: INTERVAL,
    isEnabled: () => enabled,
    doc: fakeDocument(),
  });

  poller.start();
  await advance(INTERVAL);
  await advance(INTERVAL);
  assert.equal(count, 0);

  enabled = true;
  await advance(INTERVAL);
  assert.equal(count, 1);
  poller.stop();
});

test("isEnabled false also skips the refresh on return", async () => {
  let count = 0;
  const doc = fakeDocument();
  const poller = createPoller({
    refresh: async () => count++,
    interval: INTERVAL,
    isEnabled: () => false,
    doc,
  });

  poller.start();
  doc.setHidden(true);
  doc.setHidden(false);
  await flush();
  assert.equal(count, 0);
  poller.stop();
});

test("stop cancels the next tick", async () => {
  let count = 0;
  const doc = fakeDocument();
  const poller = createPoller({
    refresh: async () => count++,
    interval: INTERVAL,
    doc,
  });

  poller.start();
  await advance(INTERVAL);
  poller.stop();
  await advance(INTERVAL * 3);
  assert.equal(count, 1);

  // It no longer listens either.
  doc.setHidden(true);
  doc.setHidden(false);
  await flush();
  assert.equal(count, 1);
});

test("stop during a refresh cancels what would follow it", async () => {
  let count = 0;
  let finish;
  const poller = createPoller({
    refresh: () => {
      count++;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
    interval: INTERVAL,
    doc: fakeDocument(),
  });

  poller.start();
  await advance(INTERVAL);
  poller.stop();
  finish();
  await flush();
  await advance(INTERVAL * 3);
  assert.equal(count, 1);
});
