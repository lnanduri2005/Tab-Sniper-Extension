// A confirm box drawn as a little mascot window. Stays until the user chooses; Esc or Cancel
// says no. Uses <dialog> so focus is trapped and screen readers announce it.
//
//   const ok = await confirmBox({ title: "Super ban instagram.com?", body: "...", confirmLabel: "Lock it", tone: "super" });

import { el } from "./dom.js";
import { ICONS } from "./icons.js";
import { createMascot } from "./mascot.js";

// mascot: optional { mood, line }. Shows the mascot's warning at the top of the box.
export function confirmBox({ title, body, confirmLabel = "OK", cancelLabel = "Cancel", tone = "default", mascot = null }) {
    return new Promise((resolve) => {
        const titleId = `confirm-title-${Date.now()}`;
        let face = null;
        const warning = ({ mood = "stern", line }) => {
            face = createMascot({ mood, interactive: false, label: "Tab Sniper mascot, looking serious" });
            return el("div", { class: "confirm-warning" }, [face.el, el("p", { class: "bubble side", text: line })]);
        };
        const cancel = el("button", { class: "btn small ghost", type: "button", text: cancelLabel });
        const confirm = el("button", {
            class: `btn small ${tone === "super" ? "super" : tone === "danger" ? "danger" : ""}`,
            type: "button",
            html: `${tone === "super" ? ICONS.lock : ""}<span>${confirmLabel}</span>`
        });
        const dialog = el("dialog", { class: "confirm", "aria-labelledby": titleId }, [
            el("div", { class: "titlebar" }, [
                el("div", { class: "dots", "aria-hidden": "true" }, [el("span", { class: "dot pink" }), el("span", { class: "dot slate" })])
            ]),
            el("div", { class: "confirm-body" }, [
                mascot ? warning(mascot) : null,
                el("h2", { id: titleId, text: title }),
                body ? el("p", { text: body }) : null,
                el("div", { class: "confirm-actions" }, [cancel, confirm])
            ])
        ]);

        const close = (answer) => {
            face?.destroy();
            dialog.close();
            dialog.remove();
            resolve(answer);
        };
        cancel.addEventListener("click", () => close(false));
        confirm.addEventListener("click", () => close(true));
        dialog.addEventListener("cancel", (e) => {
            e.preventDefault(); // Esc
            close(false);
        });
        dialog.addEventListener("click", (e) => {
            if (e.target === dialog) close(false); // click on the backdrop
        });

        document.body.append(dialog);
        if (mascot) requestAnimationFrame(() => face?.react("nod"));
        dialog.showModal();
        cancel.focus(); // the safe choice has focus, so Enter never locks or removes by accident
    });
}
