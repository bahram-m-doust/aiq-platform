import { AdminBackBar } from "@/components/app/AdminBackBar";

export default function AdminSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark bg-background text-foreground min-h-svh">
      <AdminBackBar />
      {children}
    </div>
  );
}
