import { Button } from "@/components/ui/button";

export function DashboardActivationCtas() {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button disabled type="button">
        Request Demo Access
      </Button>
      <Button disabled type="button" variant="outline">
        Contact Bextudio
      </Button>
    </div>
  );
}
