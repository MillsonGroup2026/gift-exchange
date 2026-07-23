import Link from "next/link";
import { Wordmark } from "@/components/brand";
import { ForgotForm } from "./forgot-form";

export default function ForgotPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center px-6 py-5">
        <Wordmark />
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-24">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-card-foreground">Reset your password</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Enter your email and we&rsquo;ll send you a link to set a new one.
          </p>
          <div className="mt-6">
            <ForgotForm />
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-foreground/70 transition-colors hover:text-foreground">
            &larr; Back to sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
