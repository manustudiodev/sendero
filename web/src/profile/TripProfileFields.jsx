const WALKING_TOLERANCES = ["", "low", "moderate", "high"];
const REST_FREQUENCIES = ["", "frequent", "regular", "minimal"];

function agesText(value) {
  return Array.isArray(value) ? value.join(", ") : "";
}

function parsedAges(value) {
  return String(value || "")
    .split(/[,;]+/)
    .map((age) => age.trim())
    .filter(Boolean)
    .map(Number)
    .filter((age) => Number.isInteger(age));
}

export function tripProfileDraftFromBrief(brief = {}) {
  return {
    arrivalTime: brief.arrivalTime || "",
    departureTime: brief.departureTime || "",
    seniors: String(brief.travellers?.seniors || 0),
    childAges: agesText(brief.travellers?.childAges),
    seniorAges: agesText(brief.travellers?.seniorAges),
    earliestStartTime: brief.dailySchedule?.earliestStartTime || "",
    latestEndTime: brief.dailySchedule?.latestEndTime || "",
    breakfastTime: brief.dailySchedule?.mealTimes?.breakfast || "",
    lunchTime: brief.dailySchedule?.mealTimes?.lunch || "",
    dinnerTime: brief.dailySchedule?.mealTimes?.dinner || "",
    walkingTolerance: brief.mobility?.walkingTolerance || "",
    maxWalkingMinutes: brief.mobility?.maxWalkingMinutes === undefined
      ? ""
      : String(brief.mobility.maxWalkingMinutes),
    avoidStairs: Boolean(brief.mobility?.avoidStairs),
    wheelchairAccess: Boolean(brief.mobility?.wheelchairAccess),
    restFrequency: brief.mobility?.restFrequency || "",
    accessibilityNeeds: (brief.accessibilityNeeds || []).join(", "),
  };
}

export function tripProfileValueFromDraft(draft = {}) {
  const seniors = Math.max(0, Number(draft.seniors) || 0);
  const childAges = parsedAges(draft.childAges);
  const seniorAges = parsedAges(draft.seniorAges);
  const mealTimes = {
    ...(draft.breakfastTime ? { breakfast: draft.breakfastTime } : {}),
    ...(draft.lunchTime ? { lunch: draft.lunchTime } : {}),
    ...(draft.dinnerTime ? { dinner: draft.dinnerTime } : {}),
  };
  const dailySchedule = {
    ...(draft.earliestStartTime ? { earliestStartTime: draft.earliestStartTime } : {}),
    ...(draft.latestEndTime ? { latestEndTime: draft.latestEndTime } : {}),
    ...(Object.keys(mealTimes).length ? { mealTimes } : {}),
  };
  const maxWalkingMinutes = Number(draft.maxWalkingMinutes);
  const mobility = {
    ...(draft.walkingTolerance ? { walkingTolerance: draft.walkingTolerance } : {}),
    ...(Number.isInteger(maxWalkingMinutes) && maxWalkingMinutes > 0 ? { maxWalkingMinutes } : {}),
    ...(draft.avoidStairs ? { avoidStairs: true } : {}),
    ...(draft.wheelchairAccess ? { wheelchairAccess: true } : {}),
    ...(draft.restFrequency ? { restFrequency: draft.restFrequency } : {}),
  };
  const accessibilityNeeds = String(draft.accessibilityNeeds || "")
    .split(/[,;]+/)
    .map((need) => need.trim())
    .filter(Boolean);

  return {
    travellers: {
      seniors,
      ...(childAges.length ? { childAges } : {}),
      ...(seniorAges.length ? { seniorAges } : {}),
    },
    ...(draft.arrivalTime ? { arrivalTime: draft.arrivalTime } : {}),
    ...(draft.departureTime ? { departureTime: draft.departureTime } : {}),
    ...(Object.keys(dailySchedule).length ? { dailySchedule } : {}),
    ...(Object.keys(mobility).length ? { mobility } : {}),
    ...(accessibilityNeeds.length ? { accessibilityNeeds } : {}),
  };
}

function ProfileField({ children, label }) {
  return <label className="profile-field"><span>{label}</span>{children}</label>;
}

export function TripProfileFields({ adultsCount, childrenCount, copy, onChange, value }) {
  const current = value || tripProfileDraftFromBrief();
  const seniors = Math.max(0, Number(current.seniors) || 0);
  const update = (field, nextValue) => onChange({ ...current, [field]: nextValue });

  return (
    <details className="profile-editor">
      <summary><span>{copy.title}</span><small>{copy.optional}</small></summary>
      <p>{copy.description}</p>

      <section>
        <h3>{copy.tripTimes}</h3>
        <div className="profile-grid">
          <ProfileField label={copy.arrivalTime}><input onChange={(event) => update("arrivalTime", event.target.value)} type="time" value={current.arrivalTime} /></ProfileField>
          <ProfileField label={copy.departureTime}><input onChange={(event) => update("departureTime", event.target.value)} type="time" value={current.departureTime} /></ProfileField>
        </div>
      </section>

      <section>
        <h3>{copy.party}</h3>
        <div className="profile-grid">
          {Number(childrenCount) > 0 ? (
            <ProfileField label={copy.childAges}>
              <input inputMode="numeric" onChange={(event) => update("childAges", event.target.value)} pattern="\s*\d{1,2}(\s*[,;]\s*\d{1,2})*\s*" placeholder={copy.agesPlaceholder} value={current.childAges} />
            </ProfileField>
          ) : null}
          <ProfileField label={copy.seniors}>
            <input max={Math.max(1, Number(adultsCount) || 1)} min="0" onChange={(event) => update("seniors", event.target.value)} type="number" value={current.seniors} />
          </ProfileField>
          {seniors > 0 ? (
            <ProfileField label={copy.seniorAges}>
              <input inputMode="numeric" onChange={(event) => update("seniorAges", event.target.value)} pattern="\s*\d{2,3}(\s*[,;]\s*\d{2,3})*\s*" placeholder={copy.seniorAgesPlaceholder} value={current.seniorAges} />
            </ProfileField>
          ) : null}
        </div>
        <small>{copy.seniorsHint}</small>
      </section>

      <section>
        <h3>{copy.dailySchedule}</h3>
        <div className="profile-grid">
          <ProfileField label={copy.earliestStart}><input onChange={(event) => update("earliestStartTime", event.target.value)} type="time" value={current.earliestStartTime} /></ProfileField>
          <ProfileField label={copy.latestEnd}><input onChange={(event) => update("latestEndTime", event.target.value)} type="time" value={current.latestEndTime} /></ProfileField>
          <ProfileField label={copy.breakfast}><input onChange={(event) => update("breakfastTime", event.target.value)} type="time" value={current.breakfastTime} /></ProfileField>
          <ProfileField label={copy.lunch}><input onChange={(event) => update("lunchTime", event.target.value)} type="time" value={current.lunchTime} /></ProfileField>
          <ProfileField label={copy.dinner}><input onChange={(event) => update("dinnerTime", event.target.value)} type="time" value={current.dinnerTime} /></ProfileField>
        </div>
      </section>

      <section>
        <h3>{copy.mobility}</h3>
        <div className="profile-grid">
          <ProfileField label={copy.walkingTolerance}>
            <select onChange={(event) => update("walkingTolerance", event.target.value)} value={current.walkingTolerance}>
              {WALKING_TOLERANCES.map((option) => <option key={option || "none"} value={option}>{copy.walkingOptions[option || "none"]}</option>)}
            </select>
          </ProfileField>
          <ProfileField label={copy.maxWalkingMinutes}><input max="240" min="5" onChange={(event) => update("maxWalkingMinutes", event.target.value)} placeholder={copy.minutesPlaceholder} type="number" value={current.maxWalkingMinutes} /></ProfileField>
          <ProfileField label={copy.restFrequency}>
            <select onChange={(event) => update("restFrequency", event.target.value)} value={current.restFrequency}>
              {REST_FREQUENCIES.map((option) => <option key={option || "none"} value={option}>{copy.restOptions[option || "none"]}</option>)}
            </select>
          </ProfileField>
        </div>
        <div className="profile-checks">
          <label><input checked={current.avoidStairs} onChange={(event) => update("avoidStairs", event.target.checked)} type="checkbox" />{copy.avoidStairs}</label>
          <label><input checked={current.wheelchairAccess} onChange={(event) => update("wheelchairAccess", event.target.checked)} type="checkbox" />{copy.wheelchairAccess}</label>
        </div>
        <ProfileField label={copy.accessibilityNeeds}><textarea onChange={(event) => update("accessibilityNeeds", event.target.value)} placeholder={copy.accessibilityPlaceholder} value={current.accessibilityNeeds} /></ProfileField>
      </section>

      <small className="profile-note">{copy.note}</small>
    </details>
  );
}
