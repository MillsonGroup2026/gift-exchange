import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand";
import { createClient } from "@/lib/supabase/server";
import { UpdatePasswordForm } from "./update-password-form";

export const dynamic = "force-dynamic";

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Reached via a recovery link (which signs the user in) or while already signed in.
  if (!user) redirect("/login");

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center px-6 py-5">
        <Wordmark href="/dashboard" />
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-24">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-card-foreground">Set a new password</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Choose a new password for <span className="font-medium text-foreground">{user.email}</span>.
          </p>
          <div className="mt-6">
            <UpdatePasswordForm />
          </div>
        </div>
      </main>
    </div>
  );
}
