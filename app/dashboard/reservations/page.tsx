import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/common/ModulePlaceholder";

export const metadata: Metadata = {
  title: "Reservations",
};

export default function Page() {
  return (
    <ModulePlaceholder
      title="Reservations"
      description="Booking management will be implemented in a later phase."
    />
  );
}
