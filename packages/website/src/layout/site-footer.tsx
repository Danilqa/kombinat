export function SiteFooter() {
  return (
    <footer className="mx-auto max-w-[1180px] px-4 pb-8 sm:px-6">
      <p className="border-t border-line-faint pt-6 text-body-sm text-fg-muted">
        © {new Date().getFullYear()} Daniil Sitdikov
      </p>
    </footer>
  );
}
