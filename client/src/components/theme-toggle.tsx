import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme-context";

interface ThemeToggleProps {
  className?: string;
  size?: "icon" | "sm" | "default" | "lg";
}

export function ThemeToggle({ className, size = "icon" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size={size}
      onClick={toggleTheme}
      className={className}
      data-testid="button-theme-toggle"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </Button>
  );
}
