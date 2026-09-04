'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type {
  ReconciliationAction,
  SearchReconciliationCase,
} from '@/lib/search/reconciliation';

const CONFIRMATIONS: Record<ReconciliationAction, string> = {
  attach_provider_run: 'ATTACH VERIFIED RUN',
  confirm_no_run: 'CONFIRM NO RUN',
  cancel_and_refund: 'CANCEL AND REFUND',
};

const ACTION_COPY: Record<ReconciliationAction, { title: string; detail: string }> = {
  attach_provider_run: {
    title: 'Attach verified run',
    detail: 'Continue this search using the exact Apify run that already started.',
  },
  confirm_no_run: {
    title: 'Confirm no run started',
    detail: 'Allow onboarding to retry, or safely refund an uncertain paid search.',
  },
  cancel_and_refund: {
    title: 'Cancel and release credit',
    detail: 'Stop the normal search and return its reserved topic-search credit.',
  },
};

function caseLabel(item: SearchReconciliationCase): string {
  if (item.caseType === 'onboarding_search') return 'Onboarding search';
  if (item.caseType === 'paid_search') return 'Paid topic search';
  return `${item.platform ?? 'Unknown'} enrichment`;
}

function CaseCard({
  item,
  onResolved,
}: {
  item: SearchReconciliationCase;
  onResolved: () => Promise<void>;
}) {
  const [action, setAction] = useState<ReconciliationAction | null>(null);
  const [providerRunId, setProviderRunId] = useState('');
  const [note, setNote] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allowedActions = useMemo<ReconciliationAction[]>(() => (
    item.caseType !== 'enrichment_dispatch'
      ? [
        ...(item.canAttachProviderRun ? ['attach_provider_run' as const] : []),
        'confirm_no_run',
      ]
      : [
        'attach_provider_run',
        'confirm_no_run',
        ...(item.canCancelAndRefund ? ['cancel_and_refund' as const] : []),
      ]
  ), [item.canAttachProviderRun, item.canCancelAndRefund, item.caseType]);

  const submit = async () => {
    if (!action) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/operations/search-reconciliation/${item.id}/resolve`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            expectedVersion: item.version,
            note,
            confirmation,
            ...(action === 'attach_provider_run' ? { providerRunId } : {}),
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'The case could not be resolved.');
      }
      await onResolved();
    } catch (resolutionError) {
      setError(
        resolutionError instanceof Error
          ? resolutionError.message
          : 'The case could not be resolved.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <article className="rounded-2xl bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-white/10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-xl bg-amber-100 p-2 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
            <AlertTriangle aria-hidden="true" size={20} strokeWidth={2} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-950 dark:text-white">
              {caseLabel(item)}
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {item.accountEmail} · brand {item.brandId} · location {item.brandLocationId}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-200 dark:ring-amber-300/20">
          Needs review
        </span>
      </div>

      <dl className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm ring-1 ring-slate-200/70 sm:grid-cols-2 dark:bg-white/[0.03] dark:ring-white/10">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Case</dt>
          <dd className="mt-1 font-mono text-slate-800 dark:text-slate-200">#{item.id}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Source</dt>
          <dd className="mt-1 text-slate-800 dark:text-slate-200">
            {item.searchJobId ? `job ${item.searchJobId}` : `request ${item.requestId}`}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Launch attempted</dt>
          <dd className="mt-1 text-slate-800 dark:text-slate-200">
            {new Date(item.sourceLaunchAttemptedAt).toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Detected</dt>
          <dd className="mt-1 text-slate-800 dark:text-slate-200">
            {new Date(item.detectedAt).toLocaleString()}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Recorded failure</dt>
          <dd className="mt-1 break-words text-slate-800 dark:text-slate-200">
            {item.sourceErrorMessage}
          </dd>
        </div>
      </dl>

      {!action ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {allowedActions.map((candidate) => {
            const Icon = candidate === 'attach_provider_run'
              ? Link2
              : candidate === 'confirm_no_run'
                ? RotateCcw
                : XCircle;
            return (
              <button
                key={candidate}
                type="button"
                onClick={() => setAction(candidate)}
                className="rounded-xl bg-white p-4 text-left shadow-[0_4px_16px_rgba(15,23,42,0.06)] ring-1 ring-slate-200 transition-[box-shadow,scale] duration-150 hover:shadow-[0_8px_24px_rgba(15,23,42,0.1)] active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:bg-slate-950 dark:ring-white/10"
              >
                <Icon aria-hidden="true" className="text-slate-700 dark:text-slate-200" size={20} strokeWidth={2} />
                <span className="mt-3 block text-sm font-semibold text-slate-950 dark:text-white">
                  {ACTION_COPY[candidate].title}
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-600 dark:text-slate-400">
                  {ACTION_COPY[candidate].detail}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl bg-slate-950 p-5 text-white shadow-[0_12px_30px_rgba(15,23,42,0.22)] ring-1 ring-white/10">
          <div className="flex items-start gap-3">
            <ShieldCheck aria-hidden="true" className="mt-0.5 text-amber-300" size={21} strokeWidth={2} />
            <div>
              <p className="font-semibold">{ACTION_COPY[action].title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                This action is recorded permanently. It never starts a replacement provider run.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            {action === 'attach_provider_run' && (
              <label className="grid gap-1.5 text-sm font-medium">
                Apify run ID
                <input
                  value={providerRunId}
                  onChange={(event) => setProviderRunId(event.target.value)}
                  maxLength={255}
                  autoComplete="off"
                  className="rounded-lg bg-white px-3 py-2.5 text-slate-950 outline-none ring-1 ring-white/20 focus:ring-2 focus:ring-amber-400"
                />
              </label>
            )}
            <label className="grid gap-1.5 text-sm font-medium">
              Investigation note
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                minLength={10}
                maxLength={1000}
                rows={3}
                className="resize-y rounded-lg bg-white px-3 py-2.5 text-slate-950 outline-none ring-1 ring-white/20 focus:ring-2 focus:ring-amber-400"
                placeholder="What did you verify, and where?"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Type <span className="font-mono text-amber-300">{CONFIRMATIONS[action]}</span>
              <input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                maxLength={80}
                autoComplete="off"
                className="rounded-lg bg-white px-3 py-2.5 text-slate-950 outline-none ring-1 ring-white/20 focus:ring-2 focus:ring-amber-400"
              />
            </label>
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-red-400/10 px-3 py-2 text-sm text-red-200 ring-1 ring-red-300/20">
              {error}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={
                submitting
                || note.trim().length < 10
                || confirmation !== CONFIRMATIONS[action]
                || (action === 'attach_provider_run' && !providerRunId.trim())
              }
              onClick={submit}
              className="rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-[background-color,scale] duration-150 hover:bg-amber-300 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? 'Checking and applying…' : 'Apply resolution'}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setAction(null);
                setError(null);
                setProviderRunId('');
                setNote('');
                setConfirmation('');
              }}
              className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-200 ring-1 ring-white/20 transition-[background-color,scale] duration-150 hover:bg-white/10 active:scale-[0.96]"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export default function SearchReconciliationPage() {
  const [cases, setCases] = useState<SearchReconciliationCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/operations/search-reconciliation', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          response.status === 403
            ? 'This account is not authorized for search operations.'
            : payload.error || 'Unable to load reconciliation cases.',
        );
      }
      setCases(Array.isArray(payload.cases) ? payload.cases : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load cases.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Internal operations</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
              Search reconciliation
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Review ambiguous paid-provider launches without ever retrying them automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadCases()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 shadow-[0_4px_14px_rgba(15,23,42,0.06)] ring-1 ring-slate-200 transition-[box-shadow,scale] duration-150 hover:shadow-[0_7px_20px_rgba(15,23,42,0.1)] active:scale-[0.96] disabled:opacity-50 dark:bg-slate-900 dark:text-slate-100 dark:ring-white/10"
          >
            <RefreshCw aria-hidden="true" size={17} strokeWidth={2} />
            Refresh
          </button>
        </header>

        <div className="mt-8 space-y-4">
          {loading && (
            <div className="rounded-2xl bg-white p-8 text-sm text-slate-600 shadow-[0_12px_36px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80 dark:bg-slate-900 dark:text-slate-300 dark:ring-white/10">
              Loading reconciliation cases…
            </div>
          )}
          {!loading && error && (
            <div role="alert" className="rounded-2xl bg-red-50 p-5 text-sm text-red-800 ring-1 ring-red-200 dark:bg-red-400/10 dark:text-red-200 dark:ring-red-300/20">
              {error}
            </div>
          )}
          {!loading && !error && cases.length === 0 && (
            <div className="rounded-2xl bg-white p-8 text-center shadow-[0_12px_36px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-white/10">
              <CheckCircle2 aria-hidden="true" className="mx-auto text-emerald-600 dark:text-emerald-400" size={32} strokeWidth={2} />
              <p className="mt-3 font-semibold text-slate-950 dark:text-white">No searches need review</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                New ambiguous launches will appear here automatically.
              </p>
            </div>
          )}
          {!loading && !error && cases.map((item) => (
            <CaseCard key={item.id} item={item} onResolved={loadCases} />
          ))}
        </div>
      </div>
    </main>
  );
}
