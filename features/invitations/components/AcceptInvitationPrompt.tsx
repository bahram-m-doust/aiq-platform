import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AcceptInvitationPrompt({
  acceptPath,
}: {
  acceptPath: string;
}) {
  const next = encodeURIComponent(acceptPath);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accept invitation</CardTitle>
        <CardDescription>
          Sign in or create an account with the invited email address to accept
          this Brand Specialist invitation.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href={`/login?next=${next}`}>Sign in</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/register?next=${next}`}>Create account</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
