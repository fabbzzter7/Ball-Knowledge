export default function FormField({
  id,
  label,
  children,
  hint,
  error,
  className = "",
}) {
  return (
    <label className={["bk-form-field", className].filter(Boolean).join(" ")} htmlFor={id}>
      <span>{label}</span>
      {children}
      {hint && !error && <small>{hint}</small>}
      {error && (
        <small id={`${id}-error`} className="bk-form-field__error">
          {error}
        </small>
      )}
    </label>
  );
}
