"use client";
import React from "react";

export default function ThemeToggle() {
	const [theme, setTheme] = React.useState<string | null>(null);

	React.useEffect(() => {
		const current = document.documentElement.getAttribute("data-theme");
		setTheme(current);
	}, []);

	function setAndPersist(next: "light" | "dark") {
		document.documentElement.setAttribute("data-theme", next);
		setTheme(next);
		try { localStorage.setItem("theme", next); } catch {}
	}

	return (
		<div className="ml-2 inline-flex items-center gap-1 relative z-10">
			<button
				type="button"
				onClick={() => setAndPersist("light")}
				className="rounded border px-2 py-1 cursor-pointer select-none"
				aria-pressed={theme === "light"}
			>
				Light
			</button>
			<button
				type="button"
				onClick={() => setAndPersist("dark")}
				className="rounded border px-2 py-1 cursor-pointer select-none"
				aria-pressed={theme === "dark"}
			>
				Dark
			</button>
		</div>
	);
}


