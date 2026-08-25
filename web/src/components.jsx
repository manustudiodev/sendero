export function Button({ children, variant = "secondary", className = "", ...props }) {
  return (
    <button className={`button button-${variant} ${className}`.trim()} type="button" {...props}>
      {children}
    </button>
  );
}

export function SegmentedControl({ label, value, options, onChange }) {
  return (
    <fieldset className="field-group">
      <legend>{label}</legend>
      <div className="segmented-control">
        {options.map((option) => (
          <button
            aria-pressed={value === option.value}
            className={value === option.value ? "is-selected" : ""}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function ChoiceChips({ label, values, options, onChange }) {
  const selected = new Set(values);
  return (
    <fieldset className="field-group">
      <legend>{label}</legend>
      <div className="choice-chips">
        {options.map((option) => (
          <button
            aria-pressed={selected.has(option.value)}
            className={selected.has(option.value) ? "is-selected" : ""}
            key={option.value}
            onClick={() => {
              const next = new Set(selected);
              if (next.has(option.value)) next.delete(option.value);
              else next.add(option.value);
              onChange([...next]);
            }}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`field ${className}`.trim()}>
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function InlineNotice({ tone = "neutral", children }) {
  return <div aria-live="polite" className={`notice notice-${tone}`} role={tone === "error" ? "alert" : "status"}>{children}</div>;
}

export function BrandMark() {
  return <span aria-hidden="true" className="brand-mark">S</span>;
}

export function SelectionReceipt({ eyebrow = "Selección confirmada", title, description, status, children }) {
  return (
    <section aria-live="polite" className="selection-receipt">
      <span aria-hidden="true" className="selection-check">✓</span>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
        {status ? <small>{status}</small> : null}
        {children ? <div className="receipt-actions">{children}</div> : null}
      </div>
    </section>
  );
}
