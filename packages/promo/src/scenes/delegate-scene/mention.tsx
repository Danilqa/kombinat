interface MentionProps {
  name: string;
}

export function Mention({ name }: MentionProps) {
  return (
    <span className="rounded-md bg-brand-violet/16 px-1 font-medium text-brand-violet">
      @{name}
    </span>
  );
}
