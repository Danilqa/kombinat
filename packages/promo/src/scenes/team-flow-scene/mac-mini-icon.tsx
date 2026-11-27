interface MacMiniIconProps {
  className?: string;
}

export function MacMiniIcon({ className }: MacMiniIconProps) {
  return (
    <svg viewBox="0 0 40 16" fill="none" aria-hidden="true" className={className}>
      <rect x="1" y="2" width="38" height="12" rx="3.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="33" cy="8" r="1.1" fill="currentColor" />
    </svg>
  );
}
