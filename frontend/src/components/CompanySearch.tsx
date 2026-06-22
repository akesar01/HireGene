"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface CompanySearchProps {
  currentCompany: string;
}

export default function CompanySearch({ currentCompany }: CompanySearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(currentCompany);

  useEffect(() => {
    setValue(currentCompany);
  }, [currentCompany]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (value !== currentCompany) {
        const params = new URLSearchParams(searchParams.toString());
        if (value) {
          params.set("company", value);
        } else {
          params.delete("company");
        }
        const qs = params.toString();
        router.push(qs ? `/?${qs}` : "/");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [value, currentCompany, router, searchParams]);

  return (
    <div className="space-y-1">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-light px-1 mb-1">
        Company
      </h3>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search company..."
        className="w-full px-2.5 py-1.5 text-sm rounded-md border border-card-border bg-surface text-foreground placeholder:text-muted-light focus:outline-none focus:border-accent focus:bg-card-bg transition-colors"
      />
    </div>
  );
}
