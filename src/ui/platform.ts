/** The modifier a keyboard shortcut is written with: the Command key on Apple devices. */
export const MOD_KEY =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
