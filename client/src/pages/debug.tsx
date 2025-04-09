import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import DatabaseStatus from "@/components/debug/database-status";

export default function DebugPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold">System Diagnostics</h1>
        <Button asChild variant="outline">
          <Link href="/">Back to Home</Link>
        </Button>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold mb-4">Database Status</h2>
          <DatabaseStatus />
        </section>
      </div>
    </div>
  );
}