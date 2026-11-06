const TOAST_DURATION = 3500;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Dialogs and toasts of a surface. They live in their own layer, so a refresh
 * of the screen below never closes them.
 */
export function createDialogs(root) {
  let closeOpen = null;
  let toastNode = null;
  let toastTimer = null;

  function confirm({ title, message, buttons }) {
    // One at a time: a new dialog answers the open one with "no choice".
    closeOpen?.(null);

    return new Promise((resolve) => {
      const previousFocus = document.activeElement;

      const wrap = element("div", "dlg-wrap");
      const dialog = element("div", "dlg");
      dialog.setAttribute("role", "alertdialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.setAttribute("aria-label", title);
      dialog.append(element("h3", "", title), element("p", "", message));

      const close = (value) => {
        closeOpen = null;
        wrap.remove();
        previousFocus?.focus?.();
        resolve(value);
      };
      closeOpen = close;

      const row = element("div", "dlg-btns");
      const nodes = buttons.map(({ label, kind, value }) => {
        const button = element("button", `btn ${kind ?? "plain"}`, label);
        button.type = "button";
        button.addEventListener("click", () => close(value ?? null));
        row.append(button);
        return button;
      });
      dialog.append(row);

      wrap.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          close(null);
        } else if (event.key === "Tab") {
          // Focus stays inside the dialog.
          event.preventDefault();
          const step = event.shiftKey ? -1 : 1;
          const current = nodes.indexOf(document.activeElement);
          nodes[(current + step + nodes.length) % nodes.length].focus();
        }
      });

      wrap.append(dialog);
      root.append(wrap);
      nodes[nodes.length - 1]?.focus();
    });
  }

  async function alert(title, message) {
    await confirm({
      title,
      message,
      buttons: [{ label: "OK", kind: "pri", value: true }],
    });
  }

  function toast(message) {
    toastNode?.remove();
    clearTimeout(toastTimer);

    toastNode = element("div", "toast", message);
    toastNode.setAttribute("role", "status");
    root.append(toastNode);

    toastTimer = setTimeout(() => {
      toastNode?.remove();
      toastNode = null;
    }, TOAST_DURATION);
  }

  return { confirm, alert, toast };
}
