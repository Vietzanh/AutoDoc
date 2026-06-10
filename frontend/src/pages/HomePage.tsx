import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { allTools, convertTools, editTools, ToolDefinition } from "@/config/tools";

type ToolFilter = "all" | "convert" | "edit";

const filters: Array<{ id: ToolFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "convert", label: "Convert" },
  { id: "edit", label: "Edit" },
];

function AppLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm ${className}`}>
      <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.5L19 9.5V19a2 2 0 01-2 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 3v5a2 2 0 002 2h4" />
      </svg>
    </div>
  );
}

function ToolIcon({ tool }: { tool: ToolDefinition }) {
  const baseClass = "h-16 w-16 rounded-xl flex items-center justify-center";

  if (tool.icon === "docx") {
    return (
      <div className={`${baseClass} bg-blue-50 text-blue-700`}>
        <svg className="h-9 w-9" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 3h7l5 5v13H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14 3v5h5M8 13l2 5 2-5 2 5 2-5" />
        </svg>
      </div>
    );
  }

  if (tool.icon === "merge") {
    return (
      <div className={`${baseClass} bg-sky-50 text-sky-700`}>
        <svg className="h-9 w-9" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7h6a4 4 0 014 4v6M20 7h-6a4 4 0 00-4 4v6" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 14l3 3 3-3" />
        </svg>
      </div>
    );
  }

  if (tool.icon === "split") {
    return (
      <div className={`${baseClass} bg-cyan-50 text-cyan-700`}>
        <svg className="h-9 w-9" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3v18M5 7h4m-4 5h4m-4 5h4m10-10h-4m4 5h-4m4 5h-4" />
        </svg>
      </div>
    );
  }

  if (tool.icon === "organize") {
    return (
      <div className={`${baseClass} bg-indigo-50 text-indigo-700`}>
        <svg className="h-9 w-9" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v4H4zM14 15h6v4h-6z" />
        </svg>
      </div>
    );
  }

  if (tool.icon === "reorder") {
    return (
      <div className={`${baseClass} bg-violet-50 text-violet-700`}>
        <svg className="h-9 w-9" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 6h12M4 6h.01M8 12h12M4 12h.01M8 18h12M4 18h.01" />
        </svg>
      </div>
    );
  }

  if (tool.icon === "numbers") {
    return (
      <div className={`${baseClass} bg-blue-50 text-blue-700`}>
        <svg className="h-9 w-9" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 4h10a2 2 0 012 2v14H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 9h1v6M14 10.5a1.5 1.5 0 113 0c0 2-3 2.5-3 4.5h3" />
        </svg>
      </div>
    );
  }

  return (
    <div className={`${baseClass} bg-teal-50 text-teal-700`}>
      <svg className="h-9 w-9" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 4v14a2 2 0 002 2h10M4 6h14a2 2 0 012 2v10" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 8h8v8H8z" />
      </svg>
    </div>
  );
}

function ToolCard({ tool }: { tool: ToolDefinition }) {
  return (
    <Link
      to={tool.route}
      className="group block min-h-[260px] rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    >
      <ToolIcon tool={tool} />
      <h3 className="mt-7 text-2xl font-bold text-gray-900 group-hover:text-blue-700">{tool.name}</h3>
      <p className="mt-4 text-base leading-7 text-gray-600">{tool.description}</p>
    </Link>
  );
}

export default function HomePage() {
  const [activeFilter, setActiveFilter] = useState<ToolFilter>("all");

  const filteredTools = useMemo(() => {
    if (activeFilter === "convert") return convertTools;
    if (activeFilter === "edit") return editTools;
    return allTools;
  }, [activeFilter]);

  const handleFilterClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setActiveFilter(event.currentTarget.dataset.filter as ToolFilter);
  };

  return (
    <div className="bg-gray-50">
      <section className="bg-blue-700">
        <div className="flex min-h-[540px] flex-col items-center justify-center bg-gradient-to-b from-white from-[54%] via-blue-100 via-[74%] to-blue-700 px-6 pb-28 pt-16 text-center">
          <div className="flex items-center gap-6">
            <AppLogo className="h-20 w-20" />
            <h1 className="text-5xl font-bold text-gray-950">AutoDoc</h1>
          </div>
          <p className="mt-10 text-5xl font-bold text-gray-950">Explore all AutoDoc features</p>
          <p className="mt-6 text-xl font-medium text-gray-700">All are 100% FREE and easy to use!</p>
        </div>
      </section>

      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-10 px-6">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              data-filter={filter.id}
              onClick={handleFilterClick}
              className={`border-b-2 px-1 py-6 text-xl font-bold transition ${
                activeFilter === filter.id
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredTools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </section>
    </div>
  );
}
