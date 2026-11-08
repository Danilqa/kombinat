export function SiteFooter() {
  return (
    <footer className="mx-auto flex max-w-[1180px] flex-col items-center gap-5 px-4 pb-10 sm:px-6">
      <span
        aria-hidden="true"
        className="h-px w-full max-w-md bg-linear-to-r from-transparent via-line-strong to-transparent"
      />
      <p className="text-caption font-normal text-fg-muted">
        © {new Date().getFullYear()} <span className="text-fg">Daniil Sitdikov</span>
      </p>
    </footer>
  );
}
