"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "cn";

type SelectOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

function collectOptions(children: React.ReactNode): SelectOption[] {
  const options: SelectOption[] = [];

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type !== "option") return;

    const props = child.props as React.OptionHTMLAttributes<HTMLOptionElement> & {
      children?: React.ReactNode;
    };
    const value =
      props.value !== undefined && props.value !== null
        ? String(props.value)
        : String(props.children ?? "");

    options.push({
      value,
      label: props.children ?? value,
      disabled: Boolean(props.disabled),
    });
  });

  return options;
}

function mergeRefs<T>(
  ...refs: Array<React.Ref<T> | undefined>
): React.RefCallback<T> {
  return (node) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") {
        ref(node);
      } else {
        (ref as React.MutableRefObject<T | null>).current = node;
      }
    }
  };
}

function createChangeEvent(
  select: HTMLSelectElement,
): React.ChangeEvent<HTMLSelectElement> {
  return {
    target: select,
    currentTarget: select,
    type: "change",
    bubbles: true,
    cancelable: false,
    defaultPrevented: false,
    eventPhase: 0,
    isTrusted: true,
    nativeEvent: new Event("change", { bubbles: true }),
    preventDefault() {},
    isDefaultPrevented: () => false,
    stopPropagation() {},
    isPropagationStopped: () => false,
    persist() {},
    timeStamp: Date.now(),
  };
}

export type SelectProps = Omit<
  React.ComponentProps<"select">,
  "size" | "multiple"
> & {
  placeholder?: string;
};

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    className,
    children,
    value,
    defaultValue,
    onChange,
    onBlur,
    disabled,
    name,
    id,
    required,
    placeholder = "Select…",
    "aria-invalid": ariaInvalid,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    ...rest
  },
  forwardedRef,
) {
  const hiddenRef = React.useRef<HTMLSelectElement | null>(null);
  const options = React.useMemo(() => collectOptions(children), [children]);
  const isControlled = value !== undefined;

  const [uncontrolled, setUncontrolled] = React.useState(
    () => (defaultValue != null ? String(defaultValue) : ""),
  );
  const [synced, setSynced] = React.useState<string | null>(null);

  const resolvedValue = isControlled
    ? value == null
      ? ""
      : String(value)
    : (synced ?? uncontrolled);

  const selectedOption =
    options.find((option) => option.value === resolvedValue) ?? null;

  const items = React.useMemo(
    () =>
      options.map((option) => ({
        label: option.label,
        value: option.value,
      })),
    [options],
  );

  const setHiddenRef = React.useCallback(
    (node: HTMLSelectElement | null) => {
      hiddenRef.current = node;
      mergeRefs(forwardedRef)(node);
      if (!node || isControlled) return;
      // react-hook-form writes defaultValues through the ref after mount.
      queueMicrotask(() => {
        if (hiddenRef.current) {
          setSynced(hiddenRef.current.value);
        }
      });
    },
    [forwardedRef, isControlled],
  );

  const commitValue = React.useCallback(
    (next: string) => {
      const select = hiddenRef.current;
      if (select && select.value !== next) {
        select.value = next;
      }
      if (!isControlled) {
        setUncontrolled(next);
        setSynced(next);
      }
      if (onChange && select) {
        onChange(createChangeEvent(select));
      }
    },
    [isControlled, onChange],
  );

  return (
    <div className={cn("relative h-8 w-full min-w-0", className)}>
      <select
        ref={setHiddenRef}
        name={name}
        id={id}
        disabled={disabled}
        required={required}
        value={isControlled ? resolvedValue : undefined}
        defaultValue={isControlled ? undefined : defaultValue}
        onChange={onChange}
        onBlur={onBlur}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute h-px w-px opacity-0"
        {...rest}
      >
        {children}
      </select>

      <SelectPrimitive.Root
        value={resolvedValue}
        onValueChange={(next) => {
          commitValue(next == null ? "" : String(next));
        }}
        disabled={disabled}
        items={items}
        modal={false}
      >
        <SelectPrimitive.Trigger
          disabled={disabled}
          aria-invalid={ariaInvalid}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          data-slot="select-trigger"
          className={cn(
            "border-input bg-background text-foreground flex size-full min-w-0 items-center justify-between gap-2 rounded-lg border px-2.5 text-left text-sm transition-colors outline-none select-none",
            "hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3",
            "data-popup-open:border-ring data-popup-open:ring-ring/50 data-popup-open:ring-3",
            "disabled:bg-input/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
            "dark:bg-input/30 dark:hover:bg-input/50 dark:disabled:bg-input/80",
            "aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:ring-3",
            "dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          )}
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              !selectedOption && "text-muted-foreground",
            )}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <SelectPrimitive.Icon className="text-muted-foreground -mr-0.5 flex shrink-0 opacity-70">
            <ChevronDownIcon className="size-4" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Positioner
            className="z-[100] outline-none"
            sideOffset={6}
            alignItemWithTrigger={false}
          >
            <SelectPrimitive.Popup
              className={cn(
                "bg-popover text-popover-foreground ring-foreground/10 z-[100] max-h-(--available-height) w-(--anchor-width) min-w-40 origin-(--transform-origin) overflow-hidden rounded-xl shadow-lg ring-1",
                "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
                "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
                "duration-100",
              )}
            >
              <SelectPrimitive.ScrollUpArrow className="text-muted-foreground flex h-6 w-full cursor-default items-center justify-center bg-popover text-xs">
                <ChevronDownIcon className="size-3.5 rotate-180" />
              </SelectPrimitive.ScrollUpArrow>
              <SelectPrimitive.List className="max-h-64 scroll-py-1 overflow-y-auto overscroll-contain p-1">
                {options.map((option) => (
                  <SelectPrimitive.Item
                    key={option.value || "__empty"}
                    value={option.value}
                    disabled={option.disabled}
                    className={cn(
                      "data-highlighted:bg-muted data-highlighted:text-foreground grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded-lg py-1.5 pr-3 pl-2 text-sm outline-none select-none",
                      "data-disabled:pointer-events-none data-disabled:opacity-50",
                    )}
                  >
                    <SelectPrimitive.ItemIndicator className="col-start-1 flex items-center justify-center">
                      <CheckIcon className="size-3.5" />
                    </SelectPrimitive.ItemIndicator>
                    <SelectPrimitive.ItemText className="col-start-2 min-w-0 truncate">
                      {option.label}
                    </SelectPrimitive.ItemText>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.List>
              <SelectPrimitive.ScrollDownArrow className="text-muted-foreground flex h-6 w-full cursor-default items-center justify-center bg-popover text-xs">
                <ChevronDownIcon className="size-3.5" />
              </SelectPrimitive.ScrollDownArrow>
            </SelectPrimitive.Popup>
          </SelectPrimitive.Positioner>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
});

Select.displayName = "Select";

export { Select };
