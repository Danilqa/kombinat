import { CircleDashed, Hash, Webhook } from 'lucide-react';
import type { ReactNode } from 'react';
import { Avatar } from '../components/avatar';
import { Mention } from '../components/mention';
import { SceneHeading } from '../components/scene-heading';
import { getProgress, toPopStyle, toRiseStyle } from '../motion';

interface MessageProps {
  avatar: ReactNode;
  author: string;
  sentAt: string;
  progress: number;
  children: ReactNode;
}

function Message({ avatar, author, sentAt, progress, children }: MessageProps) {
  return (
    <div style={toRiseStyle(progress, 10)} className="flex gap-3">
      {avatar}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-semibold">{author}</span>
          <span className="text-[12px] text-fg-muted">{sentAt}</span>
        </div>
        <div className="text-[15px] leading-[22px] text-fg-prose">{children}</div>
      </div>
    </div>
  );
}

interface WebhookSentProps {
  progress: number;
}

function WebhookSent({ progress }: WebhookSentProps) {
  return (
    <div
      style={toPopStyle(progress)}
      className="mt-auto flex items-center gap-2 self-start rounded-full bg-raised px-3 py-1 text-[13px] text-fg-secondary"
    >
      <Webhook className="size-3.5 text-brand-pink" />
      Webhook sent to Kombinat
    </div>
  );
}

interface ChatPanelProps {
  time: number;
}

function ChatPanel({ time }: ChatPanelProps) {
  return (
    <div
      style={toRiseStyle(getProgress(time, 0.45, 0.6), 20)}
      className="flex h-[272px] w-[520px] flex-col gap-4 rounded-2xl border border-line bg-surface p-5"
    >
      <div className="flex items-center gap-2 text-[13px] font-medium tracking-wide text-fg-muted uppercase">
        Chat
        <span className="flex items-center gap-0.5 text-fg normal-case">
          <Hash className="size-4" />
          web-team
        </span>
      </div>
      <Message avatar={<Avatar initial="S" />} author="Sam" sentAt="10:02" progress={1}>
        Release 2.9 is out.
      </Message>
      <Message
        avatar={<Avatar initial="M" isAccent />}
        author="Maya"
        sentAt="10:21"
        progress={getProgress(time, 2.2, 0.5)}
      >
        <Mention name="kombinat" /> the checkout e2e test is flaky again, can you take it?
      </Message>
      <WebhookSent progress={getProgress(time, 3.1, 0.4)} />
    </div>
  );
}

interface TaskPanelProps {
  time: number;
}

function TaskPanel({ time }: TaskPanelProps) {
  return (
    <div
      style={toRiseStyle(getProgress(time, 0.3, 0.6), 20)}
      className="flex h-[272px] w-[520px] flex-col gap-4 rounded-2xl border border-line bg-surface p-5"
    >
      <div className="flex items-center gap-2 text-[13px] font-medium tracking-wide text-fg-muted uppercase">
        Task manager
        <span className="font-mono text-fg normal-case">ACME-142</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[18px] leading-[24px] font-semibold">
          CSV export times out for big workspaces
        </span>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-raised px-2.5 py-0.5 text-[13px] font-medium text-fg-secondary">
          <CircleDashed className="size-3.5" />
          Todo
        </span>
      </div>
      <Message
        avatar={<Avatar initial="L" isAccent />}
        author="Leo"
        sentAt="10:14"
        progress={getProgress(time, 1, 0.5)}
      >
        <Mention name="kombinat" /> take this one
      </Message>
      <WebhookSent progress={getProgress(time, 1.9, 0.4)} />
    </div>
  );
}

interface DelegateSceneProps {
  time: number;
}

export function DelegateScene({ time }: DelegateSceneProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-12 pb-4">
      <SceneHeading
        time={time}
        title="For example, delegate from"
        accent="chat or your task manager"
        subtitle="Mention the agent in a comment, and a routine takes the task."
      />
      <div className="flex gap-8">
        <TaskPanel time={time} />
        <ChatPanel time={time} />
      </div>
    </div>
  );
}
