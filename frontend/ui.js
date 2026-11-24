export const number = (value) =>
  value === null || value === undefined ? "—" : Number(value).toFixed(1);
export function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export function recordButton(label, open, accessibleLabel = label) {
  const button = el("button", label, "record-link");
  button.type = "button";
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-controls", "record-dialog");
  button.setAttribute("aria-label", accessibleLabel);
  button.onclick = open;
  return button;
}

export function recordHeading(heading, ...actions) {
  const row = el("div", undefined, "record-heading");
  row.append(heading, ...actions);
  return row;
}
