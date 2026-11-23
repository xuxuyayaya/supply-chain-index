export const number = (value) =>
  value === null || value === undefined ? "—" : Number(value).toFixed(1);
export function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
