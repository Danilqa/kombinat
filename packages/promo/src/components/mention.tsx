interface MentionProps {
  name: string;
}

export function Mention({ name }: MentionProps) {
  return (
    <span className="rounded-md bg-[rgba(185,168,255,0.16)] px-1 font-medium text-brand-violet">
      @{name}
    </span>
  );
}
