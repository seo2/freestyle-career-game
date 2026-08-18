// The smallest DOM helper that makes the creator readable.
//
// No framework on purpose: the game is Phaser and pulling React in for one screen
// would double the bundle. `el` exists so a panel reads as its structure instead of
// forty lines of createElement.

// A plain style bag. Not Partial<CSSStyleDeclaration>: that type carries readonly
// members like `parentRule` which fight an index signature.
export type Style = Record<string, string | number>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  style?: Style,
  ...children: (Node | string | null | false | undefined)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (style) Object.assign(node.style, style as Record<string, string>);
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

export function button(style: Style, label: Node | string, onClick: () => void, hover?: Style): HTMLButtonElement {
  const b = el("button", { cursor: "pointer", font: "inherit", ...style });
  b.type = "button";
  b.append(typeof label === "string" ? document.createTextNode(label) : label);
  b.addEventListener("click", onClick);
  if (hover) {
    const base = { ...style };
    b.addEventListener("pointerenter", () => Object.assign(b.style, hover));
    b.addEventListener("pointerleave", () => Object.assign(b.style, base));
  }
  return b;
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}
