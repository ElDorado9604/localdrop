import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { SendPage } from "./pages/SendPage";
import { ReceivePage } from "./pages/ReceivePage";
import { getStoredTheme, setStoredTheme, type ThemeMode } from "./lib/device";

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    setStoredTheme(theme);
  }, [theme]);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <header className="border-b border-slate-200/80 dark:border-slate-800/80">
          <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
            <span className="font-semibold tracking-tight">LocalDrop</span>
            <button
              type="button"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-800"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
            </button>
          </div>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/send" element={<SendPage />} />
            <Route path="/receive" element={<ReceivePage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
