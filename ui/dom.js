export function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
        if (value == null || value === false) continue;
        if (key === "class") node.className = value;
        else if (key === "text") node.textContent = value;
        else if (key === "html") node.innerHTML = value;
        else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
        else node.setAttribute(key, value === true ? "" : value);
    }
    for (const child of [].concat(children)) {
        if (child == null || child === false) continue;
        node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
}

export const $ = (id) => document.getElementById(id);

export function flash(node, className = "shake") {
    node.classList.remove(className);
    void node.offsetWidth;
    node.classList.add(className);
}

export function plural(n, word) {
    return `${n} ${word}${n === 1 ? "" : "s"}`;
}
