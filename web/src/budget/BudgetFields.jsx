const DEFAULT_INCLUDES = ["activities", "food", "local_transport"];
const COMFORTS = ["flexible", "low", "medium", "high"];
const SCOPES = ["total", "per_person", "per_day"];
const FLEXIBILITIES = ["strict", "target", "flexible"];
const CATEGORIES = [
  "activities",
  "food",
  "local_transport",
  "lodging",
  "long_distance_transport",
];

export function budgetDraftFromValue(value) {
  const source = typeof value === "string" ? { comfort: value } : value || {};
  return {
    comfort: COMFORTS.includes(source.comfort) ? source.comfort : "flexible",
    amount: source.amount === undefined ? "" : String(source.amount),
    currency: typeof source.currency === "string" ? source.currency.toUpperCase() : "",
    scope: SCOPES.includes(source.scope) ? source.scope : "total",
    flexibility: FLEXIBILITIES.includes(source.flexibility)
      ? source.flexibility
      : source.amount
        ? "target"
        : "flexible",
    includes: Array.isArray(source.includes) && source.includes.length
      ? source.includes.filter((category) => CATEGORIES.includes(category))
      : [...DEFAULT_INCLUDES],
  };
}

export function budgetValueFromDraft(draft) {
  const amount = Number(draft.amount);
  const currency = draft.currency.trim().toUpperCase();
  return {
    comfort: draft.comfort,
    scope: draft.scope,
    flexibility: Number.isFinite(amount) && amount > 0 ? draft.flexibility : "flexible",
    includes: draft.includes,
    ...(Number.isFinite(amount) && amount > 0 ? { amount } : {}),
    ...(currency ? { currency } : {}),
  };
}

export function BudgetFields({ copy, onChange, value }) {
  const monetary = value.amount.trim().length > 0;

  function update(field, nextValue) {
    onChange({ ...value, [field]: nextValue });
  }

  function toggleCategory(category) {
    const includes = value.includes.includes(category)
      ? value.includes.filter((entry) => entry !== category)
      : [...value.includes, category];
    if (includes.length) update("includes", includes);
  }

  function updateAmount(amount) {
    onChange({
      ...value,
      amount,
      ...(!monetary && amount.trim() && value.flexibility === "flexible"
        ? { flexibility: "target" }
        : {}),
    });
  }

  return (
    <fieldset className="budget-editor">
      <legend>{copy.title}</legend>
      <p>{copy.description}</p>
      <div className="budget-grid">
        <label className="budget-field">
          <span>{copy.comfort}</span>
          <select onChange={(event) => update("comfort", event.target.value)} value={value.comfort}>
            {COMFORTS.map((comfort) => <option key={comfort} value={comfort}>{copy.comforts[comfort]}</option>)}
          </select>
        </label>
        <label className="budget-field">
          <span>{copy.amount} <small>{copy.optional}</small></span>
          <input inputMode="decimal" min="0" onChange={(event) => updateAmount(event.target.value)} placeholder="1200" step="0.01" type="number" value={value.amount} />
        </label>
        <label className="budget-field">
          <span>{copy.currency}</span>
          <input autoCapitalize="characters" maxLength="3" minLength={monetary ? 3 : undefined} onChange={(event) => update("currency", event.target.value.toUpperCase())} pattern="[A-Za-z]{3}" placeholder="USD" required={monetary} value={value.currency} />
        </label>
        {monetary ? (
          <>
            <label className="budget-field">
              <span>{copy.scope}</span>
              <select onChange={(event) => update("scope", event.target.value)} value={value.scope}>
                {SCOPES.map((scope) => <option key={scope} value={scope}>{copy.scopes[scope]}</option>)}
              </select>
            </label>
            <label className="budget-field">
              <span>{copy.flexibility}</span>
              <select onChange={(event) => update("flexibility", event.target.value)} value={value.flexibility}>
                {FLEXIBILITIES.map((flexibility) => <option key={flexibility} value={flexibility}>{copy.flexibilities[flexibility]}</option>)}
              </select>
            </label>
          </>
        ) : null}
      </div>
      <div className="budget-categories">
        <strong>{copy.includes}</strong>
        <div>
          {CATEGORIES.map((category) => (
            <label key={category}>
              <input checked={value.includes.includes(category)} onChange={() => toggleCategory(category)} type="checkbox" />
              <span>{copy.categories[category]}</span>
            </label>
          ))}
        </div>
      </div>
      <small className="budget-note">{copy.note}</small>
    </fieldset>
  );
}
