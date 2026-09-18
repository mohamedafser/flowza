import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/common/ModulePlaceholder";

export const metadata: Metadata = {
  title: "Analytics",
};

export default function Page() {
  return (
    <ModulePlaceholder
      title="Analytics"
      description="Performance insights will be implemented in a later phase."
    />
  );
}
