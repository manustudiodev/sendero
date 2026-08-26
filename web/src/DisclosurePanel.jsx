export function DisclosurePanel({ children, className = "", id, open }) {
  const classes = ["disclosure-panel", open ? "is-open" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      aria-hidden={!open}
      className={classes}
      id={id}
      inert={open ? undefined : ""}
    >
      <div className="disclosure-panel-inner">{children}</div>
    </div>
  );
}
