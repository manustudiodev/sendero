import { useEffect, useId, useRef, useState } from "react";
import {
  DESTINATION_QUERY_MIN_LENGTH,
  destinationQueryReady,
  requestDestinationSuggestions,
} from "./destination-client.js";

const SEARCH_DEBOUNCE_MS = 250;

function newSessionToken() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(18);
  globalThis.crypto?.getRandomValues?.(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function DestinationCombobox({
  accepted = false,
  copy,
  csrfToken,
  destinationPlaceId,
  disabled = false,
  kind = "destination",
  label,
  locale,
  name = "place-search",
  onChange,
  placeholder,
  required = false,
  value,
  wide = false,
}) {
  const inputId = useId();
  const listboxId = `${inputId}-listbox`;
  const [query, setQuery] = useState(value.label || "");
  const [suggestions, setSuggestions] = useState([]);
  const [state, setState] = useState("idle");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const sessionTokenRef = useRef(newSessionToken());
  const selected = Boolean((value.placeId || accepted) && value.label === query);

  useEffect(() => {
    setQuery((current) => current === (value.label || "") ? current : (value.label || ""));
  }, [value.label, value.placeId]);

  useEffect(() => {
    const normalized = query.trim();
    if (disabled || selected || !destinationQueryReady(normalized)) {
      setSuggestions([]);
      setState("idle");
      setOpen(false);
      setActiveIndex(-1);
      return undefined;
    }

    const controller = new AbortController();
    let active = true;
    const timeout = globalThis.setTimeout(async () => {
      setState("loading");
      setOpen(true);
      try {
        const next = await requestDestinationSuggestions({
          csrfToken,
          destinationPlaceId,
          kind,
          locale,
          query: normalized,
          sessionToken: sessionTokenRef.current,
          signal: controller.signal,
        });
        if (!active) return;
        setSuggestions(next);
        setState(next.length ? "ready" : "empty");
        setActiveIndex(-1);
      } catch (error) {
        if (!active || error?.name === "AbortError") return;
        setSuggestions([]);
        setState("error");
        setActiveIndex(-1);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      active = false;
      globalThis.clearTimeout(timeout);
      controller.abort();
    };
  }, [csrfToken, destinationPlaceId, disabled, kind, locale, query, selected]);

  function choose(suggestion) {
    setQuery(suggestion.label);
    setSuggestions([]);
    setState("idle");
    setOpen(false);
    setActiveIndex(-1);
    sessionTokenRef.current = newSessionToken();
    onChange({
      label: suggestion.label,
      placeId: suggestion.placeId,
      types: suggestion.types || [],
    });
  }

  function handleInput(event) {
    const next = event.target.value;
    setQuery(next);
    setOpen(destinationQueryReady(next));
    setActiveIndex(-1);
    onChange({ label: next, placeId: "", types: [] });
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!suggestions.length || !["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) return;
    if (event.key === "Enter") {
      if (open && activeIndex >= 0) {
        event.preventDefault();
        choose(suggestions[activeIndex]);
      }
      return;
    }
    event.preventDefault();
    setOpen(true);
    setActiveIndex((current) => {
      if (event.key === "ArrowDown") return current >= suggestions.length - 1 ? 0 : current + 1;
      return current <= 0 ? suggestions.length - 1 : current - 1;
    });
  }

  const remaining = Math.max(0, DESTINATION_QUERY_MIN_LENGTH - query.trim().length);
  const status = selected
    ? copy.selected
    : disabled
      ? copy.disabled
      : state === "loading"
        ? copy.loading
        : state === "empty"
          ? copy.empty
          : state === "error"
            ? copy.error
            : remaining > 0
              ? copy.remaining(remaining)
              : copy.choose;
  const showPanel = !disabled && open && destinationQueryReady(query) && state !== "idle";

  return (
    <div className={`generate-field${wide ? " generate-field-wide" : ""} generate-destination-field`}>
      <label htmlFor={inputId}>{label}</label>
      <div className="generate-combobox">
        <input
          aria-activedescendant={open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={showPanel}
          aria-invalid={query.length > 0 && !selected}
          autoCapitalize="words"
          autoComplete="off"
          disabled={disabled}
          id={inputId}
          name={name}
          onBlur={() => setOpen(false)}
          onChange={handleInput}
          onFocus={() => suggestions.length && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          role="combobox"
          value={query}
        />
        {selected ? <span aria-hidden="true" className="generate-destination-check">✓</span> : null}
        {showPanel ? (
          <div className="generate-destination-panel" id={listboxId} role="listbox">
            {state === "ready" ? (
              <ul role="presentation">
                {suggestions.map((suggestion, index) => (
                  <li
                    aria-selected={index === activeIndex}
                    className={index === activeIndex ? "is-active" : ""}
                    id={`${listboxId}-option-${index}`}
                    key={suggestion.placeId}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(suggestion)}
                    role="option"
                  >
                    <strong>{suggestion.primaryText}</strong>
                    {suggestion.secondaryText ? <span>{suggestion.secondaryText}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={`generate-destination-message is-${state}`}>{status}</p>
            )}
            <p className="generate-destination-attribution" translate="no">Google Maps</p>
          </div>
        ) : null}
      </div>
      <p aria-live="polite" className={`generate-destination-status${state === "error" ? " is-error" : ""}`} role="status">{status}</p>
    </div>
  );
}
