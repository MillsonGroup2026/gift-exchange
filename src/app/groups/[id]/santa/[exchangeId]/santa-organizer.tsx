"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Ban, Loader2, Shuffle, Users, X } from "lucide-react";
import type { SantaExclusion, SantaRule } from "@/lib/types";
import {
  addExclusion,
  addRule,
  generateAssignments,
  removeExclusion,
  removeRule,
  setParticipantTeam,
  setParticipants as setParticipantsAction,
} from "@/app/groups/actions";

export type Candidate = { user_id: string; name: string; email: string };
export type ParticipantView = { id: string; user_id: string; team: string | null; name: string; email: string };

export function SantaOrganizer({
  exchangeId,
  status,
  candidates,
  initialParticipants,
  initialRules,
  initialExclusions,
}: {
  exchangeId: string;
  status: "draft" | "assigned";
  candidates: Candidate[];
  initialParticipants: ParticipantView[];
  initialRules: SantaRule[];
  initialExclusions: SantaExclusion[];
}) {
  const router = useRouter();
  const [parts, setParts] = useState(initialParticipants);
  const [rules, setRules] = useState(initialRules);
  const [excls, setExcls] = useState(initialExclusions);
  const [fromTeam, setFromTeam] = useState("");
  const [toTeam, setToTeam] = useState("");
  const [giver, setGiver] = useState("");
  const [recipient, setRecipient] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const teams = [...new Set(parts.map((p) => p.team?.trim()).filter(Boolean))] as string[];
  const nameOf = (uid: string) => parts.find((p) => p.user_id === uid)?.name ?? "Someone";

  function toggle(userId: string) {
    const has = parts.some((p) => p.user_id === userId);
    const ids = has
      ? parts.filter((p) => p.user_id !== userId).map((p) => p.user_id)
      : [...parts.map((p) => p.user_id), userId];
    start(async () => {
      const r = await setParticipantsAction(exchangeId, ids);
      if (r?.participants) {
        setParts(
          r.participants.map((row) => {
            const c = candidates.find((c) => c.user_id === row.user_id);
            return { id: row.id, user_id: row.user_id, team: row.team, name: c?.name ?? "Someone", email: c?.email ?? "" };
          }),
        );
      }
    });
  }

  function saveTeam(p: ParticipantView, team: string) {
    setParts((prev) => prev.map((x) => (x.id === p.id ? { ...x, team: team.trim() || null } : x)));
    setParticipantTeam(p.id, exchangeId, team);
  }

  function onAddRule() {
    if (!fromTeam || !toTeam) return;
    setError(null);
    start(async () => {
      const r = await addRule(exchangeId, fromTeam, toTeam);
      if (r?.error) setError(r.error);
      else if (r?.rule) {
        setRules((prev) => [...prev, r.rule as SantaRule]);
        setToTeam("");
      }
    });
  }

  function onAddExclusion() {
    if (!giver || !recipient) return;
    setError(null);
    start(async () => {
      const r = await addExclusion(exchangeId, giver, recipient);
      if (r?.error) setError(r.error);
      else if (r?.exclusion) {
        setExcls((prev) => [...prev, r.exclusion as SantaExclusion]);
        setGiver("");
        setRecipient("");
      }
    });
  }

  function draw() {
    setError(null);
    start(async () => {
      const r = await generateAssignments(exchangeId);
      if (r?.error) setError(r.error);
      else router.refresh();
    });
  }

  const selectCls =
    "h-10 rounded-lg border border-border bg-background px-2 text-sm outline-none focus-visible:border-ring";

  return (
    <div className="space-y-6 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Users className="h-4 w-4" />
        </span>
        <h2 className="font-semibold text-card-foreground">Organizer setup</h2>
      </div>

      {/* Participants */}
      <div>
        <h3 className="text-sm font-semibold text-foreground">Who&rsquo;s playing?</h3>
        <p className="text-xs text-muted-foreground">Pick people, then give each a team (e.g. Conners, Lake).</p>
        {candidates.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No active members yet — invite people to the group first.
          </p>
        ) : (
          <div className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border">
            {candidates.map((c) => {
              const p = parts.find((x) => x.user_id === c.user_id);
              return (
                <label key={c.user_id} className="flex items-center gap-3 bg-background px-3 py-2">
                  <input
                    type="checkbox"
                    checked={!!p}
                    onChange={() => toggle(c.user_id)}
                    className="h-4 w-4 accent-[var(--brand)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{c.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{c.email}</span>
                  </span>
                  {p && (
                    <input
                      key={p.id}
                      defaultValue={p.team ?? ""}
                      onBlur={(e) => saveTeam(p, e.target.value)}
                      placeholder="Team"
                      className="h-9 w-28 flex-none rounded-lg border border-border bg-card px-2 text-sm outline-none focus-visible:border-ring"
                    />
                  )}
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Team rules */}
      <div>
        <h3 className="text-sm font-semibold text-foreground">Team rules</h3>
        <p className="text-xs text-muted-foreground">
          Who gives to whom. Leave empty for a free-for-all (anyone → anyone). Example: Conners → Lake and Lake → Conners.
        </p>
        {rules.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {rules.map((r) => (
              <li
                key={r.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm text-foreground"
              >
                {r.from_team} <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" /> {r.to_team}
                <button
                  type="button"
                  onClick={() => start(async () => { await removeRule(r.id, exchangeId); setRules((p) => p.filter((x) => x.id !== r.id)); })}
                  className="text-muted-foreground hover:text-brand-strong"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {teams.length >= 1 ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select value={fromTeam} onChange={(e) => setFromTeam(e.target.value)} className={selectCls}>
              <option value="">from team…</option>
              {teams.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <select value={toTeam} onChange={(e) => setToTeam(e.target.value)} className={selectCls}>
              <option value="">to team…</option>
              {teams.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={onAddRule}
              disabled={pending || !fromTeam || !toTeam}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              Add rule
            </button>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Assign teams above to add cross-team rules.</p>
        )}
      </div>

      {/* Exclusions */}
      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Ban className="h-4 w-4" /> Blocked pairs
        </h3>
        <p className="text-xs text-muted-foreground">Never assign one specific person to another (e.g. spouses).</p>
        {excls.length > 0 && (
          <ul className="mt-2 space-y-1">
            {excls.map((x) => (
              <li key={x.id} className="flex items-center gap-2 text-sm text-foreground">
                <span className="font-medium">{nameOf(x.giver_user_id)}</span>
                <span className="text-muted-foreground">✕ won&rsquo;t get</span>
                <span className="font-medium">{nameOf(x.recipient_user_id)}</span>
                <button
                  type="button"
                  onClick={() => start(async () => { await removeExclusion(x.id, exchangeId); setExcls((p) => p.filter((e) => e.id !== x.id)); })}
                  className="text-muted-foreground hover:text-brand-strong"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {parts.length >= 2 && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select value={giver} onChange={(e) => setGiver(e.target.value)} className={selectCls}>
              <option value="">giver…</option>
              {parts.map((p) => (
                <option key={p.user_id} value={p.user_id}>{p.name}</option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">won&rsquo;t get</span>
            <select value={recipient} onChange={(e) => setRecipient(e.target.value)} className={selectCls}>
              <option value="">recipient…</option>
              {parts.map((p) => (
                <option key={p.user_id} value={p.user_id}>{p.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={onAddExclusion}
              disabled={pending || !giver || !recipient}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              Block
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-sm text-brand-strong">{error}</p>
      )}

      <div className="flex items-center gap-3 border-t border-border pt-4">
        <button
          type="button"
          onClick={draw}
          disabled={pending || parts.length < 2}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 font-semibold text-brand-foreground transition-colors hover:bg-brand-strong disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}
          {status === "assigned" ? "Redraw names" : "Draw names"}
        </button>
        {status === "assigned" && (
          <span className="text-sm text-muted-foreground">Redrawing replaces the current assignments.</span>
        )}
      </div>
    </div>
  );
}
