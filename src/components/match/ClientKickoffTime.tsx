"use client";

import { useEffect, useState } from "react";
import { formatKickoff } from "@/lib/utils";

interface Props {
  isoDate: string;
  className?: string;
}

export function ClientKickoffTime({ isoDate, className }: Props) {
  const [label, setLabel] = useState<string>("");

  useEffect(() => {
    setLabel(formatKickoff(isoDate));
  }, [isoDate]);

  return (
    <span suppressHydrationWarning className={className}>
      {label}
    </span>
  );
}
