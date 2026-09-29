import { useEffect, useRef, type ReactNode } from 'react';
import { Check, X, ArrowUpRight, CheckCheck, MapPin } from 'lucide-react';
import type { Member, Person, Plan, Proposal } from './types';
import { shortName } from './utils';

export function Avatar({
  person,
  small = false,
}: {
  person?: Person;
  small?: boolean;
}) {
  return (
    <span
      className={`avatar ${person?.color || 'sage'} ${small ? 'small' : ''}`}
      title={person?.name}
    >
      {person?.initials || '?'}
    </span>
  );
}

export function AvatarStack({
  members,
  limit = 4,
}: {
  members: Member[];
  limit?: number;
}) {
  return (
    <div className="avatar-stack">
      {members.slice(0, limit).map((member) => (
        <Avatar person={member} key={member.id} small />
      ))}
      {members.length > limit && (
        <span className="avatar small more">+{members.length - limit}</span>
      )}
    </div>
  );
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    node
      ?.querySelector<HTMLElement>('input, button, select, textarea')
      ?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !node) return;
      const elements = [
        ...node.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, textarea, select, a[href]',
        ),
      ];
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        ref={ref}
      >
        <button
          className="icon-button modal-close"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <h2 id="modal-title">{title}</h2>
        {subtitle && <p className="modal-subtitle">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

export function ProposalCard({
  proposal,
  plan,
  userId,
  onVote,
  compact = false,
}: {
  proposal: Proposal;
  plan: Plan;
  userId: string;
  onVote: () => void;
  compact?: boolean;
}) {
  const confirmed = proposal.status === 'confirmed';
  const voted = proposal.votes.includes(userId);
  return (
    <div className={`proposal-card ${compact ? 'compact' : ''}`}>
      {compact && (
        <div className="cabin-art">
          <img src="/big-sur.svg" alt="Illustration of the Big Sur coast" />
          <span>
            <MapPin size={12} /> BIG SUR, CALIFORNIA
          </span>
        </div>
      )}
      <div className="proposal-body">
        <div className="eyebrow">
          {confirmed ? (
            <>
              <CheckCheck size={13} /> DECISION MADE
            </>
          ) : (
            'LET’S DECIDE'
          )}
        </div>
        <h3>{proposal.title}</h3>
        <p>{proposal.detail}</p>
        <div className="proposal-footer">
          <div className="vote-people">
            <AvatarStack
              members={plan.members.filter((person) =>
                proposal.votes.includes(person.id),
              )}
              limit={3}
            />
            <span>
              {proposal.votes.length} {confirmed ? 'on board' : 'votes'}
            </span>
          </div>
          {confirmed ? (
            <span className="confirmed-label">
              <Check size={13} /> In the plan
            </span>
          ) : (
            <button
              className={`button small-button ${voted ? 'secondary' : 'primary'}`}
              onClick={onVote}
            >
              {voted ? <Check size={14} /> : <ArrowUpRight size={14} />}
              {voted ? 'Voted' : 'I’m in'}
            </button>
          )}
        </div>
        {!confirmed && (
          <div className="vote-progress">
            <span
              style={{
                width: `${Math.min(100, (proposal.votes.length / Math.max(1, Math.ceil(plan.members.length / 2))) * 100)}%`,
              }}
            />
          </div>
        )}
        {!confirmed && (
          <p className="threshold">
            {Math.max(1, Math.ceil(plan.members.length / 2))} votes makes it a
            plan · Proposed by{' '}
            {shortName(
              plan.members.find((person) => person.id === proposal.authorId)
                ?.name || 'a friend',
            )}
          </p>
        )}
      </div>
    </div>
  );
}
