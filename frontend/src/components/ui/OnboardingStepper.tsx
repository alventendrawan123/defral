interface OnboardingStepperProps {
  steps: readonly string[];
  activeIndex: number;
}

export function OnboardingStepper({ steps, activeIndex }: OnboardingStepperProps) {
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {steps.map((step, index) => {
        const isDone = index < activeIndex;
        const isActive = index === activeIndex;

        return (
          <li key={step} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold tabular-nums ${
                isDone || isActive
                  ? 'border-line bg-ink text-paper'
                  : 'border-line-soft bg-surface text-ink-muted'
              }`}
            >
              {index + 1}
            </span>
            <span
              aria-current={isActive ? 'step' : undefined}
              className={isActive ? 'text-sm font-semibold' : 'text-sm text-ink-muted'}
            >
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
