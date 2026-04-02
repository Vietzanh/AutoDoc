import React from "react";
import { JobStatus } from "@/services/api";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "green" | "yellow" | "red" | "blue";
  className?: string;
}

export function Badge({
  children,
  variant = "default",
  className = "",
}: BadgeProps) {
  const variants: Record<string, string> = {
    default: "bg-gray-100 text-gray-700",
    green: "bg-green-100 text-green-700",
    yellow: "bg-yellow-100 text-yellow-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

const statusVariant: Record<JobStatus, BadgeProps["variant"]> = {
  pending: "yellow",
  processing: "blue",
  done: "green",
  failed: "red",
};

const statusLabel: Record<JobStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  done: "Done",
  failed: "Failed",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <Badge variant={statusVariant[status]}>{statusLabel[status]}</Badge>
  );
}
