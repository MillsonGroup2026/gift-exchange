"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  Gift,
  Link2,
  Mail,
  Plus,
  RefreshCw,
  Trash2,
  UserMinus,
} from "lucide-react";
import { Wordmark } from "@/components/brand";
import type { Group, SantaExchange } from "@/lib/types";
import {
  createExchange,
  deleteGroup,
  inviteToGroup,
  leaveGroup,
  removeMember,
  renameGroup,
  rotateJoinToken,
} from "@/app/groups/actions";

export type MemberView = {
  id: string;
  user_id: string | null;
  role: string;
  status: string;
  name: string;
  email: string;
  isSelf: boolean;
};

export function GroupDetail({
  group,
  isOwner,
  members: initialMembers,
  exchanges,
  joinToken: initialToken,
  origin,
}: {
  group: Group;
  isOwner: boolean;
  members: MemberView[];
  exchanges: SantaExchange[];
  joinToken: string | null;
  origin: string;
}) {
  const [name, setName] = useState(group.name);
  const [members, setMembers] = useState(initialMembers);
  const [token, setToken] = useState(initialToken);
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const joinLink = token ? `${origin}/groups/join/${token}` : null;

  function invite(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const clean = email.trim();
    if (!clean) return;
    start(async () => {
      const r = await inviteToGroup(group.id, clean);
      if (r?.error) setErr(r.error);
      else if (r?.member) {
        const m = r.member as { id: string; user_id: string | null; status: string };
        setMembers((prev) => [
          ...prev,
          { id: m.id, user_id: m.user_id, role: "member", status: m.status, name: clean, email: clean, isSelf: false },
        ]);
        setEmail("");
      }
    });
  }

  function remove(id: string) {
    start(async () => {
      const r = await removeMember(id, group.id);
      if (!r?.error) setMembers((prev) => prev.filter((m) => m.id !== id));
    });
  }

  function copyLink() {
    if (!joinLink) return;
    navigator.clipboard?.writeText(joinLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Wordmark href="/dashboard" />
          <Link
            href="/groups"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" /> All groups
          </Link>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-8 px-6 py-8 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          {isOwner ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => renameGroup(group.id, name)}
              className="w-full rounded-lg border border-transparent bg-transparent text-3xl font-semibold tracking-tight text-foreground outline-none hover:border-border focus:border-ring focus:bg-background focus:px-2"
            />
          ) : (
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">{group.name}</h1>
          )}

          {/* Members */}
          <section className="mt-6">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Members ({members.length})
            </h2>
            {err && <p className="mt-2 text-sm text-brand-strong">{err}</p>}
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                    {m.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium text-foreground">{m.name}</span>
                      {m.role === "owner" && <Crown className="h-3.5 w-3.5 text-brand" />}
                      {m.status === "invited" && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          invited
                        </span>
                      )}
                    </div>
                    {m.email && m.email !== m.name && (
                      <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                    )}
                  </div>
                  {isOwner && m.role !== "owner" && (
                    <button
                      type="button"
                      onClick={() => remove(m.id)}
                      className="flex-none text-muted-foreground hover:text-brand-strong"
                      aria-label={`Remove ${m.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {isOwner && (
              <form onSubmit={invite} className="mt-3 flex items-center gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Invite by email"
                    className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                  />
                </div>
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-strong disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" /> Invite
                </button>
              </form>
            )}
          </section>

          {/* Secret Santa */}
          <section className="mt-10">
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              <Gift className="h-4 w-4" /> Secret Santa
            </h2>
            <div className="mt-3 space-y-2">
              {exchanges.map((ex) => (
                <Link
                  key={ex.id}
                  href={`/groups/${group.id}/santa/${ex.id}`}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-brand/40"
                >
                  <span className="font-medium text-foreground">{ex.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      ex.status === "assigned" ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {ex.status === "assigned" ? "Names drawn" : "Setting up"}
                  </span>
                </Link>
              ))}
            </div>
            <form action={createExchange.bind(null, group.id)} className="mt-3 flex items-center gap-2">
              <input
                name="name"
                placeholder="New Secret Santa (e.g. Conner × Lake 2026)"
                className="h-11 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              />
              <button
                type="submit"
                className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-sm font-semibold transition-colors hover:bg-muted"
              >
                <Plus className="h-4 w-4" /> Start
              </button>
            </form>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {isOwner && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Link2 className="h-4 w-4" /> Join link
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Anyone with this link can join — handy when an invite email doesn&rsquo;t match.
              </p>
              {joinLink && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={joinLink}
                      onFocus={(e) => e.currentTarget.select()}
                      className="min-w-0 flex-1 truncate rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground"
                    />
                    <button
                      type="button"
                      onClick={copyLink}
                      className="inline-flex flex-none items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-strong"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => start(async () => {
                      const r = await rotateJoinToken(group.id);
                      if (r?.token) setToken(r.token);
                    })}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-brand-strong"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Reset link
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-5">
            {isOwner ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Delete this group? Lists shared to it will no longer be shared.")) deleteGroup(group.id);
                }}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-brand-strong"
              >
                <Trash2 className="h-4 w-4" /> Delete group
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Leave this group?")) leaveGroup(group.id);
                }}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-brand-strong"
              >
                <UserMinus className="h-4 w-4" /> Leave group
              </button>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
