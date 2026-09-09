'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  CreditCard,
  Globe2,
  Loader2,
  Minus,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { DowngradeCapacityStep } from '@/app/components/DowngradeCapacityStep';
import { Modal } from '@/app/components/Modal';
import { useLanguage } from '@/contexts/LanguageContext';
import { getStripe } from '@/lib/stripe-client';
import type { ManagedPortfolio } from '@/lib/brand-locations/portfolio';
import type { DowngradeRetentionSelection } from '@/lib/plans/downgrade-capacity';
import {
  capacityApiFailure,
  buildCapacityTarget,
  CapacityUiError,
  needsCapacityRetention,
  readCapacityApiResult,
  readCapacityOverview,
  readCapacityQuote,
  readCapacitySuccess,
  type CapacityApiResult,
  type CapacityKind,
  type CapacityOverview,
  type CapacityQuote,
  type CapacitySuccess,
  type PaidQuantities,
} from '@/lib/stripe/capacity-client';

type EditorStage = 'quantity' | 'retention' | 'quote' | 'success';
type ChangeDirection = 'increase' | 'decrease';

interface Props {
  userId: number | null;
  portfolio: ManagedPortfolio | undefined;
  placement: 'management' | 'billing';
  onChanged?: () => unknown | Promise<unknown>;
  onReviewArchived?: () => void;
}

const PAYMENT_POLL_DELAYS_MS = [0, 750, 1_500, 2_500, 4_000] as const;

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function PaidCapacityManager({
  userId,
  portfolio,
  placement,
  onChanged,
  onReviewArchived,
}: Props) {
  const router = useRouter();
  const { language, t } = useLanguage();
  const copy = t.dashboard.brandLocations.paidCapacity;
  const capacity = portfolio?.capacity;
  const isEligiblePlan = capacity?.plan === 'pro' || capacity?.plan === 'business';
  const [overview, setOverview] = useState<CapacityOverview | null>(null);
  const [isLoading, setIsLoading] = useState(isEligiblePlan);
  const [isDisabled, setIsDisabled] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [editorKind, setEditorKind] = useState<CapacityKind | null>(null);
  const [stage, setStage] = useState<EditorStage>('quantity');
  const [targetExtra, setTargetExtra] = useState(0);
  const [selection, setSelection] = useState<DowngradeRetentionSelection>({
    brandIds: [],
    locationIds: [],
  });
  const [quote, setQuote] = useState<CapacityQuote | null>(null);
  const [resultDirection, setResultDirection] = useState<ChangeDirection>('increase');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const formatMoney = useMemo(() => new Intl.NumberFormat(
    language === 'de' ? 'de-DE' : 'en-GB',
    { style: 'currency', currency: 'EUR' },
  ), [language]);

  const loadOverview = useCallback(async (signal?: AbortSignal) => {
    if (!userId || !isEligiblePlan) {
      setOverview(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(false);
    try {
      const result = await readCapacityApiResult(await fetch('/api/stripe/capacity', {
        cache: 'no-store',
        signal,
      }));
      if (!result.response.ok) {
        if (result.response.status === 404 && result.data.code === 'PAID_CAPACITY_DISABLED') {
          setIsDisabled(true);
          setOverview(null);
          return;
        }
        throw capacityApiFailure(result, copy.unavailable);
      }
      setOverview(readCapacityOverview(result.data));
      setIsDisabled(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('[PaidCapacityManager] Could not load capacity.', error);
      setLoadError(true);
      setOverview(null);
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [copy.unavailable, isEligiblePlan, userId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadOverview(controller.signal);
    return () => controller.abort();
  }, [loadOverview]);

  const closeEditor = useCallback(() => {
    if (isSubmitting) return;
    setEditorKind(null);
    setStage('quantity');
    setQuote(null);
    setActionError(null);
    setSelection({ brandIds: [], locationIds: [] });
  }, [isSubmitting]);

  const currentExtra = useCallback((kind: CapacityKind): number => {
    if (!overview) return 0;
    return kind === 'brand'
      ? overview.paidCapacity.extraBrands
      : overview.paidCapacity.extraLocations;
  }, [overview]);

  const includedCapacity = useCallback((kind: CapacityKind): number => {
    if (!capacity) return 0;
    return kind === 'brand' ? capacity.includedBrands : capacity.includedLocationsPerAccount;
  }, [capacity]);

  const openEditor = (kind: CapacityKind) => {
    if (!overview || overview.pendingPayment) return;
    setEditorKind(kind);
    setTargetExtra(currentExtra(kind));
    setStage('quantity');
    setQuote(null);
    setSelection({ brandIds: [], locationIds: [] });
    setActionError(null);
  };

  const targetQuantities = useCallback((): PaidQuantities => {
    if (!overview || !editorKind) throw new Error('Missing capacity editor state.');
    return buildCapacityTarget(overview.paidCapacity, editorKind, targetExtra);
  }, [editorKind, overview, targetExtra]);

  const targetLimits = useCallback(() => {
    if (!overview || !editorKind) return null;
    return {
      maxBrands: editorKind === 'brand'
        ? includedCapacity('brand') + targetExtra
        : overview.effectiveLimits.maxBrands,
      maxLocations: editorKind === 'location'
        ? includedCapacity('location') + targetExtra
        : overview.effectiveLimits.maxLocationsPerAccount,
    };
  }, [editorKind, includedCapacity, overview, targetExtra]);

  const requiresRetention = useCallback(() => {
    const limits = targetLimits();
    if (!capacity || !limits) return false;
    return needsCapacityRetention(
      { brands: capacity.activeBrands, locations: capacity.activeLocations },
      { brands: limits.maxBrands, locations: limits.maxLocations },
    );
  }, [capacity, targetLimits]);

  const previewChange = async (retention?: DowngradeRetentionSelection) => {
    if (!overview || !editorKind || !userId) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const result = await readCapacityApiResult(await fetch('/api/stripe/capacity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview',
          userId,
          requestId: crypto.randomUUID(),
          target: targetQuantities(),
          ...(retention ? { retention } : {}),
        }),
      }));
      if (!result.response.ok) throw capacityApiFailure(result, copy.paymentError);
      setQuote(readCapacityQuote(result.data));
      setStage('quote');
    } catch (error) {
      console.error('[PaidCapacityManager] Could not preview capacity.', error);
      setActionError(copy.paymentError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const beginPreview = () => {
    if (!overview || !editorKind) return;
    if (targetExtra === currentExtra(editorKind)) return;
    const isDecrease = targetExtra < currentExtra(editorKind);
    if (isDecrease && requiresRetention()) {
      setSelection({ brandIds: [], locationIds: [] });
      setStage('retention');
      return;
    }
    void previewChange();
  };

  const confirmRequest = async (operationId: string): Promise<CapacityApiResult> => readCapacityApiResult(
    await fetch('/api/stripe/capacity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm', userId, operationId }),
    }),
  );

  const finishSuccessfulChange = async (
    success: CapacitySuccess,
    direction: ChangeDirection,
  ) => {
    setResultDirection(direction);
    setStage('success');
    window.dispatchEvent(new CustomEvent('brand-portfolio-updated'));
    const refreshes: Array<Promise<unknown>> = [loadOverview()];
    if (onChanged) refreshes.push(Promise.resolve(onChanged()));
    const outcomes = await Promise.allSettled(refreshes);
    if (outcomes.some((outcome) => outcome.status === 'rejected')) {
      console.error('[PaidCapacityManager] Capacity changed but a portfolio refresh failed.', outcomes);
    }
    toast.success(copy.successTitle);
    return success;
  };

  const pollConfirmedPayment = async (operationId: string): Promise<CapacitySuccess> => {
    for (const delay of PAYMENT_POLL_DELAYS_MS) {
      if (delay > 0) await sleep(delay);
      const result = await confirmRequest(operationId);
      if (result.response.ok) return readCapacitySuccess(result.data);
      if (
        result.response.status === 402
        && result.data.code === 'CAPACITY_PAYMENT_ACTION_REQUIRED'
      ) {
        continue;
      }
      throw capacityApiFailure(result, copy.paymentError);
    }
    throw new CapacityUiError('CAPACITY_PAYMENT_SYNCING', copy.paymentSyncing);
  };

  const completeOperation = async (
    operationId: string,
    direction: ChangeDirection,
  ) => {
    if (!userId) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const result = await confirmRequest(operationId);
      if (result.response.ok) {
        await finishSuccessfulChange(readCapacitySuccess(result.data), direction);
        return;
      }
      if (
        result.response.status !== 402
        || result.data.code !== 'CAPACITY_PAYMENT_ACTION_REQUIRED'
        || typeof result.data.clientSecret !== 'string'
      ) {
        throw capacityApiFailure(result, copy.paymentError);
      }

      const stripeClient = await getStripe();
      if (!stripeClient) throw new CapacityUiError('STRIPE_UNAVAILABLE', copy.paymentError);
      const confirmation = await stripeClient.confirmCardPayment(result.data.clientSecret);
      if (confirmation.error) {
        throw new CapacityUiError(
          'CAPACITY_PAYMENT_FAILED',
          confirmation.error.message ?? copy.paymentError,
        );
      }
      const success = await pollConfirmedPayment(operationId);
      await finishSuccessfulChange(success, direction);
    } catch (error) {
      console.error('[PaidCapacityManager] Capacity confirmation failed.', error);
      setActionError(
        error instanceof CapacityUiError && error.code === 'CAPACITY_PAYMENT_SYNCING'
          ? copy.paymentSyncing
          : copy.paymentError,
      );
      await loadOverview();
    } finally {
      setIsSubmitting(false);
    }
  };

  const resumePendingPayment = () => {
    if (!overview?.pendingOperation) return;
    const target = overview.pendingOperation.target;
    const direction: ChangeDirection = (
      target.extraBrands < overview.paidCapacity.extraBrands
      || target.extraLocations < overview.paidCapacity.extraLocations
    ) ? 'decrease' : 'increase';
    void completeOperation(overview.pendingOperation.operationId, direction);
  };

  if (!capacity) return null;
  if (placement === 'billing' && (!isEligiblePlan || isDisabled)) return null;

  const renderCapacityCard = (kind: CapacityKind) => {
    const isBrand = kind === 'brand';
    const active = isBrand ? capacity.activeBrands : capacity.activeLocations;
    const maximum = overview
      ? isBrand
        ? overview.effectiveLimits.maxBrands
        : overview.effectiveLimits.maxLocationsPerAccount
      : isBrand
        ? capacity.maxBrands
        : capacity.maxLocationsPerAccount;
    const paidExtra = overview ? currentExtra(kind) : isBrand
      ? capacity.paidExtraBrands
      : capacity.paidExtraLocations;
    const item = overview?.catalogue[kind];
    const canChange = overview !== null
      && !overview.pendingPayment
      && (overview.canPurchase || paidExtra > 0);
    const planName = overview?.basePlan === 'business'
      ? t.dashboard.settings.plan.growth
      : t.dashboard.settings.plan.pro;
    const maximumLabel = maximum < 0 ? t.dashboard.brandLocations.unlimited : maximum;
    const usagePercentage = maximum > 0
      ? Math.min(100, Math.round((active / maximum) * 100))
      : 0;

    return (
      <article className="rounded-xl bg-[#f8fafc] p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.06)] dark:bg-gray-900/70 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#fff4d1] text-[#b57900] dark:bg-[#ffbf23]/10 dark:text-[#ffbf23]">
              {isBrand
                ? <Building2 size={17} strokeWidth={2} />
                : <Globe2 size={17} strokeWidth={2} />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#0f172a] dark:text-white">
                {isBrand ? copy.brandCapacity : copy.locationCapacity}
              </p>
              <p className="mt-0.5 text-xs text-[#596579] dark:text-gray-400">
                {copy.usage
                  .replace('{used}', String(active))
                  .replace('{total}', String(maximumLabel))}
              </p>
            </div>
          </div>

          {overview && item && (
            <button
              type="button"
              onClick={() => openEditor(kind)}
              disabled={!canChange || isSubmitting}
              title={!overview.canPurchase && paidExtra === 0 ? copy.purchaseUnavailable : undefined}
              className="min-h-9 shrink-0 rounded-full border border-[#d8e0e8] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#425466] outline-none transition-[background-color,border-color,scale] duration-150 hover:border-[#ffbf23] hover:bg-[#fffaf0] focus-visible:ring-2 focus-visible:ring-[#ffbf23]/60 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-[#ffbf23]/10"
            >
              {paidExtra > 0 ? copy.manageExtras : copy.addCapacity}
            </button>
          )}
        </div>

        <div className="mt-3">
          <div
            role="progressbar"
            aria-label={isBrand ? copy.brandCapacity : copy.locationCapacity}
            aria-valuemin={0}
            aria-valuemax={maximum > 0 ? maximum : undefined}
            aria-valuenow={maximum > 0 ? active : undefined}
            className="h-1.5 overflow-hidden rounded-full bg-[#e6ebf1] dark:bg-gray-800"
          >
            <div
              className="h-full rounded-full bg-[#ffbf23] transition-[width] duration-150"
              style={{ width: `${usagePercentage}%` }}
            />
          </div>
          {overview && item && (
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#596579] dark:text-gray-400">
              <span>{copy.included.replace('{count}', String(includedCapacity(kind))).replace('{plan}', planName)}</span>
              {paidExtra > 0 && (
                <>
                  <span aria-hidden="true" className="text-[#b6c0cc]">·</span>
                  <span>{copy.paidExtra.replace('{count}', String(paidExtra))}</span>
                </>
              )}
              <span aria-hidden="true" className="text-[#b6c0cc]">·</span>
              <span>{copy.monthlyUnit.replace('{price}', String(item.monthlyEur))}</span>
            </div>
          )}
        </div>
      </article>
    );
  };

  const editorCurrent = editorKind ? currentExtra(editorKind) : 0;
  const editorCatalog = editorKind && overview ? overview.catalogue[editorKind] : null;
  const editorIncluded = editorKind ? includedCapacity(editorKind) : 0;
  const editorMaximum = editorCatalog
    ? overview?.canPurchase ? editorCatalog.maxQuantity : editorCurrent
    : 0;
  const direction: ChangeDirection = targetExtra < editorCurrent ? 'decrease' : 'increase';
  const estimatedMonthlyCents = overview
    ? (
        (editorKind === 'brand' ? targetExtra : overview.paidCapacity.extraBrands)
          * overview.catalogue.brand.monthlyEur
        + (editorKind === 'location' ? targetExtra : overview.paidCapacity.extraLocations)
          * overview.catalogue.location.monthlyEur
      ) * 100
    : 0;
  const limits = targetLimits();

  return (
    <section className="space-y-3" aria-label={copy.title}>
      {placement === 'billing' && (
        <header>
          <h3 className="text-base font-semibold text-[#0f172a] dark:text-white">{copy.title}</h3>
          <p className="mt-1 text-xs leading-5 text-[#8898aa]">{copy.description}</p>
        </header>
      )}

      {overview?.pendingPayment && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/25 sm:flex-row sm:items-center">
          <AlertTriangle size={18} className="shrink-0 text-amber-700 dark:text-amber-300" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">{copy.pendingTitle}</p>
            <p className="mt-0.5 text-xs leading-5 text-amber-800 dark:text-amber-300">
              {overview.pendingOperation ? copy.pendingDescription : copy.pendingUnavailable}
            </p>
          </div>
          {overview.pendingOperation ? (
            <button
              type="button"
              onClick={resumePendingPayment}
              disabled={isSubmitting}
              className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-full bg-[#ffbf23] px-4 py-2 text-xs font-semibold text-[#0f172a] transition-[background-color,scale] duration-150 hover:bg-[#e5ac20] active:scale-[0.96] disabled:opacity-60"
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              {isSubmitting ? copy.resumingPayment : copy.resumePayment}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push('/settings?tab=plan')}
              className="shrink-0 rounded-full border border-amber-300 bg-white px-4 py-2 text-xs font-semibold text-amber-900 transition-[background-color,scale] duration-150 hover:bg-amber-100 active:scale-[0.96] dark:bg-gray-900 dark:text-amber-200"
            >
              {copy.managePayment}
            </button>
          )}
        </div>
      )}

      {actionError && editorKind === null && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/25 dark:text-red-300">
          {actionError}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {renderCapacityCard('brand')}
        {renderCapacityCard('location')}
      </div>

      {isLoading && !overview && isEligiblePlan && (
        <div className="flex items-center gap-2 text-xs text-[#8898aa]" role="status">
          <Loader2 size={14} className="animate-spin" />
          {copy.loading}
        </div>
      )}
      {loadError && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/60 dark:bg-red-950/25">
          <p className="min-w-0 flex-1 text-xs font-medium text-red-700 dark:text-red-300">{copy.unavailable}</p>
          <button
            type="button"
            onClick={() => void loadOverview()}
            className="shrink-0 rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-gray-900 dark:text-red-300"
          >
            {copy.retry}
          </button>
        </div>
      )}

      <Modal
        isOpen={editorKind !== null}
        onClose={closeEditor}
        title={editorKind === 'brand' ? copy.changeBrandTitle : copy.changeLocationTitle}
        width={stage === 'retention' ? 'max-w-3xl' : 'max-w-xl'}
      >
        {overview && editorKind && editorCatalog && stage === 'quantity' && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-[#e6ebf1] bg-[#f6f9fc] p-5 dark:border-gray-800 dark:bg-gray-900/70">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#8898aa]">{copy.newPaidExtra}</p>
                  <p className="mt-1 text-sm text-[#425466] dark:text-gray-300">
                    {copy.monthlyUnit.replace('{price}', String(editorCatalog.monthlyEur))}
                  </p>
                </div>
                <div className="flex items-center rounded-full border border-[#d8e0e8] bg-white p-1 shadow-soft-sm dark:border-gray-700 dark:bg-[#0f0f0f]">
                  <button
                    type="button"
                    aria-label={copy.decreaseQuantity}
                    onClick={() => setTargetExtra((value) => Math.max(0, value - 1))}
                    disabled={targetExtra === 0 || isSubmitting}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[#425466] transition-[background-color,scale] duration-150 hover:bg-[#f6f9fc] active:scale-[0.96] disabled:opacity-35 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    <Minus size={16} />
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={editorMaximum}
                    value={targetExtra}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (Number.isSafeInteger(value)) {
                        setTargetExtra(Math.min(editorMaximum, Math.max(0, value)));
                      }
                    }}
                    aria-label={copy.newPaidExtra}
                    className="h-9 w-14 bg-transparent text-center text-lg font-bold tabular-nums text-[#0f172a] outline-none [appearance:textfield] dark:text-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    aria-label={copy.increaseQuantity}
                    onClick={() => setTargetExtra((value) => Math.min(editorMaximum, value + 1))}
                    disabled={targetExtra >= editorMaximum || isSubmitting}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fff4d1] text-[#0f172a] transition-[background-color,scale] duration-150 hover:bg-[#ffe49a] active:scale-[0.96] disabled:opacity-35 dark:bg-[#ffbf23]/15 dark:text-[#ffbf23]"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#e6ebf1] p-3 dark:border-gray-800">
                <p className="text-xs text-[#8898aa]">{copy.currentPaidExtra}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-[#0f172a] dark:text-white">{editorCurrent}</p>
              </div>
              <div className="rounded-xl border border-[#e6ebf1] p-3 dark:border-gray-800">
                <p className="text-xs text-[#8898aa]">{copy.totalCapacity}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-[#0f172a] dark:text-white">
                  {editorIncluded + targetExtra}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-[#e6ebf1] px-4 py-3 dark:border-gray-800">
              <span className="text-sm text-[#425466] dark:text-gray-300">{copy.estimatedMonthly}</span>
              <span className="text-sm font-semibold tabular-nums text-[#0f172a] dark:text-white">
                {formatMoney.format(estimatedMonthlyCents / 100)} {copy.perMonthSuffix}
              </span>
            </div>

            {targetExtra < editorCurrent && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-200">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span>{copy.decreaseWarning}</span>
              </div>
            )}
            {!overview.canPurchase && targetExtra >= editorCurrent && (
              <p className="text-xs text-amber-700 dark:text-amber-300">{copy.purchaseUnavailable}</p>
            )}
            {actionError && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/25 dark:text-red-300">
                {actionError}
              </p>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeEditor}
                disabled={isSubmitting}
                className="min-h-10 rounded-full border border-[#d8e0e8] bg-white px-5 py-2 text-sm font-medium text-[#425466] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={beginPreview}
                disabled={
                  isSubmitting
                  || targetExtra === editorCurrent
                  || (!overview.canPurchase && targetExtra > editorCurrent)
                }
                className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#ffbf23] px-5 py-2 text-sm font-semibold text-[#0f172a] shadow-yellow-glow-sm transition-[background-color,scale] duration-150 hover:bg-[#e5ac20] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting && <Loader2 size={15} className="animate-spin" />}
                {isSubmitting ? copy.reviewingPrice : copy.reviewPrice}
              </button>
            </div>
          </div>
        )}

        {overview && portfolio && limits && stage === 'retention' && (
          <DowngradeCapacityStep
            portfolio={portfolio}
            targetPlan={overview.basePlan}
            maxBrands={limits.maxBrands}
            maxLocations={limits.maxLocations}
            selection={selection}
            copy={{
              downgradeChoiceTitle: copy.chooseTitle,
              downgradeChoiceMessage: copy.chooseMessage,
              brandsKept: copy.brandsKept,
              locationsKept: copy.locationsKept,
              keepBrand: copy.keepBrand,
              keepLocation: copy.keepLocation,
              noActiveLocations: copy.noActiveLocations,
              downgradeArchiveNote: copy.archiveNote,
              backToPlans: copy.back,
              confirmDowngrade: copy.confirmChoice,
              confirmingDowngrade: copy.confirmingChoice,
            }}
            isSubmitting={isSubmitting}
            onChange={setSelection}
            onBack={() => setStage('quantity')}
            onConfirm={() => void previewChange(selection)}
          />
        )}

        {quote && stage === 'quote' && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-[#e6ebf1] bg-[#f6f9fc] p-5 dark:border-gray-800 dark:bg-gray-900/70">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#8898aa]">{copy.dueNow}</p>
              <p className="mt-1 font-display text-3xl font-bold tabular-nums text-[#0f172a] dark:text-white">
                {formatMoney.format(quote.quote.amountDueNowCents / 100)}
              </p>
              <div className="mt-4 flex items-center justify-between gap-4 border-t border-[#e6ebf1] pt-4 text-sm dark:border-gray-800">
                <span className="text-[#425466] dark:text-gray-300">{copy.monthlyTotal}</span>
                <span className="font-semibold tabular-nums text-[#0f172a] dark:text-white">
                  {formatMoney.format(quote.quote.monthlySubtotalCents / 100)} {copy.perMonthSuffix}
                </span>
              </div>
            </div>
            {quote.quote.prorationCents !== 0 && (
              <p className="text-xs leading-5 text-[#8898aa]">
                {copy.proration.replace(
                  '{amount}',
                  formatMoney.format(quote.quote.prorationCents / 100),
                )}
              </p>
            )}
            <p className="text-xs leading-5 text-[#8898aa]">
              {copy.quoteExpiry.replace(
                '{time}',
                new Date(quote.expiresAt).toLocaleTimeString(
                  language === 'de' ? 'de-DE' : 'en-GB',
                  { hour: '2-digit', minute: '2-digit' },
                ),
              )}
            </p>
            {actionError && (
              <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-900/60 dark:bg-red-950/25">
                <p role="alert" className="text-xs font-medium text-red-700 dark:text-red-300">{actionError}</p>
                <button
                  type="button"
                  onClick={() => router.push('/settings?tab=plan')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 underline underline-offset-2 dark:text-red-300"
                >
                  <CreditCard size={13} />
                  {copy.managePayment}
                </button>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <button
                type="button"
                onClick={() => setStage(direction === 'decrease' && requiresRetention() ? 'retention' : 'quantity')}
                disabled={isSubmitting}
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#d8e0e8] bg-white px-4 py-2 text-sm font-medium text-[#425466] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              >
                <ArrowLeft size={14} />
                {copy.back}
              </button>
              <button
                type="button"
                onClick={() => void completeOperation(quote.operationId, direction)}
                disabled={isSubmitting}
                className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#ffbf23] px-5 py-2 text-sm font-semibold text-[#0f172a] shadow-yellow-glow-sm transition-[background-color,scale] duration-150 hover:bg-[#e5ac20] active:scale-[0.96] disabled:opacity-60"
              >
                {isSubmitting && <Loader2 size={15} className="animate-spin" />}
                {isSubmitting
                  ? copy.processing
                  : direction === 'increase'
                    ? copy.increaseAction
                    : copy.decreaseAction}
              </button>
            </div>
          </div>
        )}

        {stage === 'success' && (
          <div className="py-4 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
              <CheckCircle2 size={24} />
            </span>
            <h3 className="mt-4 font-display text-xl font-bold text-[#0f172a] dark:text-white">{copy.successTitle}</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#596579] dark:text-gray-400">
              {resultDirection === 'increase' ? copy.increaseSuccess : copy.decreaseSuccess}
            </p>
            <div className="mt-6 flex flex-col-reverse justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={closeEditor}
                className="min-h-10 rounded-full border border-[#d8e0e8] bg-white px-5 py-2 text-sm font-medium text-[#425466] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              >
                {copy.done}
              </button>
              {onReviewArchived && (
                <button
                  type="button"
                  onClick={() => {
                    closeEditor();
                    onReviewArchived();
                  }}
                  className="min-h-10 rounded-full bg-[#ffbf23] px-5 py-2 text-sm font-semibold text-[#0f172a] transition-[background-color,scale] duration-150 hover:bg-[#e5ac20] active:scale-[0.96]"
                >
                  {copy.reviewArchived}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
