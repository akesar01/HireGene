"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface CompanyDropdownProps {
  companies: { name: string; count: number }[];
  currentCompany: string;
}

export default function CompanyDropdown({ companies, currentCompany }: CompanyDropdownProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("company", value);
    } else {
      params.delete("company");
    }
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  return (
    <div className="space-y-1">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-light px-1 mb-1">
        Company
      </h3>
      <select
        value={currentCompany}
        onChange={handleChange}
        className="w-full px-2.5 py-1.5 text-sm rounded-md border border-card-border bg-surface text-foreground focus:outline-none focus:border-accent focus:bg-card-bg transition-colors cursor-pointer"
      >
        <option value="">All companies</option>
        {companies.map(({ name, count }) => (
          <option key={name} value={name}>
            {name} ({count})
          </option>
        ))}
      </select>
    </div>
  );
}
