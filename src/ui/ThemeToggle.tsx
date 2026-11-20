import { Moon, Sun } from "lucide-react";
import { setScheme, useScheme } from "../state/scheme";
import { IconButton } from "./primitives";

export function ThemeToggle() {
  const scheme = useScheme();
  const next = scheme === "dark" ? "light" : "dark";
  return (
    <IconButton
      label={`Switch to ${next} theme`}
      onClick={() => setScheme(next)}
      className="size-7"
    >
      {scheme === "dark" ? <Sun /> : <Moon />}
    </IconButton>
  );
}
