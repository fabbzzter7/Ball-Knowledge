import { forwardRef } from "react";

function Button({
  children,
  className = "",
  variant = "primary",
  loading = false,
  fullWidth = false,
  leadingIcon,
  trailingIcon,
  type = "button",
  disabled,
  ...props
}, ref) {
  const classes = [
    "bk-button",
    `bk-button--${variant}`,
    fullWidth ? "bk-button--full" : "",
    loading ? "bk-button--loading" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button ref={ref} className={classes} type={type} disabled={disabled || loading} {...props}>
      {leadingIcon}
      <span>{loading ? "Loading..." : children}</span>
      {trailingIcon}
    </button>
  );
}

export default forwardRef(Button);
