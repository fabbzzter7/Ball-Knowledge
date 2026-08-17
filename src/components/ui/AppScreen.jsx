export default function AppScreen({
  children,
  className = "",
  contentClassName = "",
  backgroundImage,
  scroll = true,
  centered = false,
  width = "default",
}) {
  const classes = [
    "bk-app-screen",
    scroll ? "bk-scroll-page" : "bk-static-page",
    scroll ? "bk-app-screen--scroll" : "",
    centered ? "bk-app-screen--center" : "",
    width === "wide" ? "bk-app-screen--wide" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const style = backgroundImage
    ? { "--bk-app-screen-bg-image": `url(${backgroundImage})` }
    : undefined;

  return (
    <main className={classes} style={style}>
      <div className={["bk-app-screen__content", contentClassName].filter(Boolean).join(" ")}>
        {children}
      </div>
    </main>
  );
}
