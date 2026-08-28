import { formatDate, formatList, resolveContentLocale, t } from "./i18n/index.js";

function transportSummary(brief) {
  const locale = resolveContentLocale(brief?.locale);
  const modes = (brief.transport?.modes || []).map((mode) => t(locale, `transport.${mode}`));
  return formatList(locale, modes, { style: "long", type: "conjunction" });
}

function dateLabel(value, locale) {
  return value
    ? (formatDate(locale, value, { day: "numeric", month: "short", year: "numeric" }) || value)
    : t(locale, "date.pending");
}

export function briefReceiptSummary(brief) {
  const locale = resolveContentLocale(brief?.locale);
  const travellers = Number(brief.travellers?.adults || 0);
  const adultLabel = t(locale, travellers === 1 ? "conversation.adult" : "conversation.adults");
  return `${brief.destination} · ${dateLabel(brief.startDate, locale)} — ${dateLabel(brief.endDate, locale)} · ${travellers} ${adultLabel} · ${transportSummary(brief)}`;
}

export function tripRequirementsContinuation({ brief, fields, interactionId }) {
  const locale = resolveContentLocale(brief?.locale);
  const adults = Number(brief.travellers?.adults || 0);
  const license = brief.transport?.modes?.includes("car")
    ? t(locale, brief.transport.hasLicense ? "conversation.licenseYes" : "conversation.licenseNo")
    : "";
  const message = t(locale, "conversation.requirementsVisible", {
    destination: brief.destination,
    startDate: dateLabel(brief.startDate, locale),
    endDate: dateLabel(brief.endDate, locale),
    adults,
    adultLabel: t(locale, adults === 1 ? "conversation.adult" : "conversation.adults"),
    transport: transportSummary(brief),
    license,
  });
  return {
    context: {
      content: [{ type: "text", text: t(locale, "conversation.requirementsContext", { summary: briefReceiptSummary(brief) }) }],
      structuredContent: {
        sendero: {
          intent: "create_trip",
          stage: "brief_ready",
          ...(interactionId ? { interactionId } : {}),
          completedFields: fields,
          validation: { ready: true, criticalFields: [] },
          brief,
        },
      },
    },
    visibleMessage: message,
    fallbackMessage: message,
  };
}

export function tripIntakeContinuation(brief) {
  const locale = resolveContentLocale(brief?.locale);
  const adults = Number(brief.travellers?.adults || 0);
  const children = Number(brief.travellers?.children || 0);
  const lodging = brief.lodging.status === "confirmed"
    ? t(locale, "conversation.lodgingConfirmed", { address: brief.lodging.address })
    : brief.lodging.status === "area_only"
      ? t(locale, "conversation.lodgingArea", { area: brief.lodging.area })
      : t(locale, "conversation.lodgingUndecided");
  const interests = brief.interests.length
    ? t(locale, "conversation.interests", { interests: formatList(locale, brief.interests, { style: "long", type: "conjunction" }) })
    : "";
  const childrenCopy = children
    ? t(locale, "conversation.childrenCopy", {
      children,
      childLabel: t(locale, children === 1 ? "conversation.child" : "conversation.children"),
    })
    : "";
  const startDate = dateLabel(brief.startDate, locale);
  const endDate = dateLabel(brief.endDate, locale);
  const message = t(locale, "conversation.intakeVisible", {
    destination: brief.destination,
    startDate,
    endDate,
    adults,
    adultLabel: t(locale, adults === 1 ? "conversation.adult" : "conversation.adults"),
    childrenCopy,
    transport: transportSummary(brief),
    lodging,
    interests,
  });
  return {
    context: {
      content: [{ type: "text", text: t(locale, "conversation.intakeContext", { destination: brief.destination, startDate, endDate }) }],
      structuredContent: {
        sendero: {
          intent: "create_trip",
          stage: "brief_ready",
          validation: { ready: true, criticalFields: [] },
          brief,
        },
      },
    },
    visibleMessage: message,
    fallbackMessage: message,
  };
}

export function tripSelectionContinuation({ trip, purpose }) {
  const locale = resolveContentLocale(trip?.locale);
  const purposeCopy = purpose === "adjust"
    ? { verb: t(locale, "conversation.selection.adjustVerb"), visible: t(locale, "conversation.selection.adjustVisible") }
    : purpose === "refresh"
      ? { verb: t(locale, "conversation.selection.refreshVerb"), visible: t(locale, "conversation.selection.refreshVisible") }
      : { verb: t(locale, "conversation.selection.openVerb"), visible: t(locale, "conversation.selection.openVisible") };
  return {
    context: {
      content: [{ type: "text", text: t(locale, "conversation.selectionContext", { title: trip.title, verb: purposeCopy.verb }) }],
      structuredContent: { sendero: { intent: purpose, tripId: trip.id, tripTitle: trip.title } },
    },
    visibleMessage: purposeCopy.visible,
  };
}
