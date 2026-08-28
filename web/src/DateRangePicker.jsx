import { useEffect, useId, useRef, useState } from "react";
import { DisclosurePanel } from "./DisclosurePanel.jsx";
import {
  addMonthsISO,
  formatDateLabel,
  formatLongDateLabel,
  formatMonthLabel,
  monthMatrix,
  moveCalendarFocus,
  rangeState,
  selectRangeDate,
  startOfMonthISO,
  todayISO,
} from "./date-range.js";
import { t, uiLocale, weekdayLabels } from "./i18n/index.js";

export function DateRangePicker({ startDate, endDate, locale, onChange }) {
  const id = useId();
  const panelId = `${id}-date-range`;
  const instructionsId = `${id}-instructions`;
  const [open, setOpen] = useState(false);
  const [endpoint, setEndpoint] = useState(startDate && !endDate ? "end" : "start");
  const [focusedDate, setFocusedDate] = useState(startDate || endDate || todayISO());
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonthISO(startDate || endDate || todayISO()));
  const triggerRefs = useRef({ start: null, end: null });
  const dayRefs = useRef(new Map());

  useEffect(() => {
    if (!open) return;
    const button = dayRefs.current.get(focusedDate);
    if (button) window.requestAnimationFrame(() => button.focus());
  }, [focusedDate, open, visibleMonth]);

  function openFor(nextEndpoint) {
    const resolvedEndpoint = nextEndpoint === "end" && !startDate ? "start" : nextEndpoint;
    const preferred = resolvedEndpoint === "end"
      ? (endDate || startDate || todayISO())
      : (startDate || endDate || todayISO());
    setEndpoint(resolvedEndpoint);
    setFocusedDate(preferred);
    setVisibleMonth(startOfMonthISO(preferred));
    setOpen(true);
  }

  function close(returnEndpoint = endpoint) {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRefs.current[returnEndpoint]?.focus());
  }

  function choose(value) {
    const selection = selectRangeDate({ startDate, endDate, endpoint }, value);
    onChange({ startDate: selection.startDate, endDate: selection.endDate });
    setFocusedDate(value);
    setVisibleMonth(startOfMonthISO(value));
    if (selection.endpoint === "complete") {
      close("end");
      return;
    }
    setEndpoint(selection.endpoint);
  }

  function moveMonth(amount) {
    const next = addMonthsISO(focusedDate, amount);
    setFocusedDate(next);
    setVisibleMonth(startOfMonthISO(next));
  }

  function handleDayKeyDown(event, value) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(value);
      return;
    }
    const next = moveCalendarFocus(value, event.key, event.shiftKey, resolvedLocale);
    if (!next) return;
    event.preventDefault();
    setFocusedDate(next);
    setVisibleMonth(startOfMonthISO(next));
  }

  function handlePanelKeyDown(event) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    close();
  }

  const resolvedLocale = uiLocale(locale || globalThis.document?.documentElement?.lang);
  const cells = monthMatrix(visibleMonth, resolvedLocale);
  const cellRows = Array.from({ length: 6 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
  const weekdays = weekdayLabels(resolvedLocale);
  const today = todayISO();

  return (
    <fieldset className="date-range field-wide">
      <legend>{t(resolvedLocale, "dateRange.legend")}</legend>
      <div className="date-range-fields">
        {[
          { key: "start", label: t(resolvedLocale, "dateRange.arrival"), value: startDate },
          { key: "end", label: t(resolvedLocale, "dateRange.return"), value: endDate },
        ].map((item) => (
          <button
            aria-controls={panelId}
            aria-expanded={open && endpoint === item.key}
            className={`date-range-trigger ${open && endpoint === item.key ? "is-active" : ""}`}
            key={item.key}
            onClick={() => openFor(item.key)}
            ref={(node) => { triggerRefs.current[item.key] = node; }}
            type="button"
          >
            <span>{item.label}</span>
            <strong className={item.value ? "" : "is-placeholder"}>{formatDateLabel(item.value, resolvedLocale)}</strong>
            <span aria-hidden="true" className="date-range-calendar-icon">▦</span>
          </button>
        ))}
      </div>
      <DisclosurePanel className="date-range-disclosure" id={panelId} open={open}>
        <section aria-describedby={instructionsId} aria-label={t(resolvedLocale, "dateRange.chooseAria")} className="date-range-panel" onKeyDown={handlePanelKeyDown}>
          <p className="visually-hidden" id={instructionsId}>{t(resolvedLocale, "dateRange.instructions")}</p>
          <div className="date-range-toolbar">
            <button aria-label={t(resolvedLocale, "dateRange.previousMonth")} onClick={() => moveMonth(-1)} type="button">←</button>
            <strong aria-live="polite">{formatMonthLabel(visibleMonth, resolvedLocale)}</strong>
            <button aria-label={t(resolvedLocale, "dateRange.nextMonth")} onClick={() => moveMonth(1)} type="button">→</button>
          </div>
          <p aria-live="polite" className="date-range-prompt">{t(resolvedLocale, endpoint === "start" ? "dateRange.chooseArrival" : "dateRange.chooseReturn")}</p>
          <div aria-label={formatMonthLabel(visibleMonth, resolvedLocale)} aria-multiselectable="true" className="date-range-grid" role="grid">
            <div className="date-range-row" role="row">
              {weekdays.map(({ short, long }) => <span aria-label={long} className="date-range-weekday" key={long} role="columnheader">{short}</span>)}
            </div>
            {cellRows.map((row, rowIndex) => (
              <div className="date-range-row" key={row[0]?.iso || rowIndex} role="row">
                {row.map(({ iso, inMonth }) => {
                  const state = rangeState(iso, startDate, endDate);
                  const className = [
                    "date-range-day",
                    inMonth ? "" : "is-outside",
                    state.inRange ? "is-in-range" : "",
                    state.isStart ? "is-start" : "",
                    state.isEnd ? "is-end" : "",
                  ].filter(Boolean).join(" ");
                  return (
                    <button
                      aria-current={iso === today ? "date" : undefined}
                      aria-label={`${formatLongDateLabel(iso, resolvedLocale)}${state.isStart ? t(resolvedLocale, "dateRange.arrivalState") : state.isEnd ? t(resolvedLocale, "dateRange.returnState") : state.inRange ? t(resolvedLocale, "dateRange.inRangeState") : ""}`}
                      aria-selected={state.isStart || state.isEnd || state.inRange}
                      className={className}
                      key={iso}
                      onClick={() => choose(iso)}
                      onFocus={() => setFocusedDate(iso)}
                      onKeyDown={(event) => handleDayKeyDown(event, iso)}
                      ref={(node) => {
                        if (node) dayRefs.current.set(iso, node);
                        else dayRefs.current.delete(iso);
                      }}
                      role="gridcell"
                      tabIndex={focusedDate === iso ? 0 : -1}
                      type="button"
                    >
                      {Number(iso.slice(-2))}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <button className="date-range-close" onClick={() => close()} type="button">{t(resolvedLocale, "dateRange.close")}</button>
        </section>
      </DisclosurePanel>
    </fieldset>
  );
}
