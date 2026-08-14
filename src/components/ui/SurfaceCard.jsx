export default function SurfaceCard({
  as: Component = "div",
  children,
  className = "",
  variant = "default",
  interactive = false,
  type,
  ...props
}) {
  const classes = [
    "bk-surface-card",
    `bk-surface-card--${variant}`,
    interactive ? "bk-surface-card--interactive" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const componentProps = Component === "button" ? { type: type || "button" } : {};

  return (
    <Component className={classes} {...componentProps} {...props}>
      {children}
    </Component>
  );
}
