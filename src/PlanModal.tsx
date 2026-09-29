import { useState } from 'react';
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  Copy,
  ExternalLink,
  Leaf,
  Link,
  MapPin,
  Navigation,
  Plus,
  Users,
} from 'lucide-react';
import { Avatar, Modal } from './components';
import { dateLabel, shortName } from './utils';
import type { Action, ModalKind, Person, Plan } from './types';

const titles: Record<string, [string, string]> = {
  invite: [
    'Better with your people.',
    'A name is all they need. No account, no app download.',
  ],
  dates: [
    'Find your overlap.',
    'A date that works for enough people is a date worth making.',
  ],
  members: ['The good company.', 'Clear answers. A little less chasing.'],
  rsvp: ['Are you in?', 'A real answer helps everyone make a real plan.'],
  location: ['Somewhere to gather.', 'One meeting point everyone can find.'],
  day: ['Let’s get together.', 'The details you need when the day comes.'],
  proposal: [
    'Put an idea on the table.',
    'Give the group something concrete to say yes to.',
  ],
  task: [
    'A little job, a lighter load.',
    'The small things that make it all happen.',
  ],
  expense: [
    'Who picked up the tab?',
    'Split equally with everyone marked Going, plus you.',
  ],
};

export function PlanModal({
  kind,
  plan,
  user,
  action,
  onClose,
  toast,
}: {
  kind: ModalKind;
  plan: Plan;
  user: Person;
  action: Action;
  onClose: () => void;
  toast: (message: string) => void;
}) {
  const current = plan.members.find((person) => person.id === user.id)!;
  const host = current.role === 'host';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rsvp, setRsvp] = useState<string>(
    current.rsvp === 'pending' ? 'going' : current.rsvp,
  );
  const [copied, setCopied] = useState('');
  const date = plan.dates.find((option) => option.id === plan.lockedDateId);
  const pending = plan.members.filter((member) => member.rsvp === 'pending');
  const link = `${window.location.origin}/?join=${plan.inviteToken}`;
  const [title, subtitle] = titles[kind || ''] || ['', ''];

  async function submit(
    type: string,
    payload?: Record<string, unknown>,
    close = true,
    success?: string,
  ) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action(type, payload);
      if (success) toast(success);
      if (close) onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleForm(
    event: React.FormEvent<HTMLFormElement>,
    type: string,
    extra?: Record<string, unknown>,
  ) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    void submit(type, { ...data, ...extra });
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      toast(
        label === 'link'
          ? 'Invite link copied.'
          : 'Plan summary copied. Drop it in the group chat.',
      );
    } catch {
      setError(
        'Clipboard access is unavailable. Select and copy the link below.',
      );
    }
  }

  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose}>
      {kind === 'invite' && (
        <>
          <div className="invite-preview">
            <span className="invite-emoji">{plan.emoji}</span>
            <h3>{plan.name}</h3>
            <p>
              {dateLabel(date)} ·{' '}
              {plan.members.filter((member) => member.rsvp === 'going').length}{' '}
              going
            </p>
          </div>
          <label className="field-label">Your private invite link</label>
          <div className="copy-field">
            <Link size={16} />
            <input
              aria-label="Invite link"
              value={link}
              readOnly
              onFocus={(event) => event.target.select()}
            />
            <button
              className="button primary small-button"
              onClick={() => void copy(link, 'link')}
            >
              {copied === 'link' ? <Check size={15} /> : <Copy size={15} />}
              {copied === 'link' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="form-note">
            Anyone with this link can join this plan as a guest.
          </p>
          <button
            className="share-summary"
            onClick={() =>
              void copy(
                `${plan.emoji} ${plan.name}\n${date ? `Date locked: ${dateLabel(date)}` : 'Finding a date'} · ${plan.members.filter((member) => member.rsvp === 'going').length} going\n${plan.location || 'Place TBD'}\n${plan.tasks.filter((task) => !task.done).length} little jobs left\nJoin the plan → ${link}`,
                'summary',
              )
            }
          >
            <span>
              <Copy size={18} />
              <strong>Bring the group chat along</strong>
              <small>Copy a tidy summary to share anywhere.</small>
            </span>
            <ArrowUpRight size={18} />
          </button>
        </>
      )}

      {kind === 'dates' && (
        <>
          <div className="date-options">
            {plan.dates.map((option) => {
              const voted = option.voters.includes(user.id);
              const locked = option.id === plan.lockedDateId;
              return (
                <div
                  className={`date-option ${locked ? 'locked' : ''}`}
                  key={option.id}
                >
                  <div className="date-option-header">
                    <CalendarDays size={19} />
                    <div>
                      <strong>
                        {dateLabel(option)}, {option.start.slice(0, 4)}
                      </strong>
                      <small>
                        {option.voters.length} of {plan.members.length}{' '}
                        available
                      </small>
                    </div>
                    {locked && (
                      <span className="confirmed-label">
                        <CheckCheck size={13} />
                        Locked
                      </span>
                    )}
                  </div>
                  <div className="availability-bar">
                    <span
                      style={{
                        width: `${(option.voters.length / plan.members.length) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="date-option-footer">
                    <button
                      className={`button small-button ${voted ? 'selected-button' : 'secondary'}`}
                      disabled={busy}
                      onClick={() =>
                        void submit('availability', { id: option.id }, false)
                      }
                    >
                      {voted ? <Check size={14} /> : <Plus size={14} />}
                      {voted ? 'Works for me' : 'I’m available'}
                    </button>
                    {host && !locked && (
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() =>
                          void submit(
                            'lockDate',
                            { id: option.id },
                            false,
                            'Date locked. It’s in the plan.',
                          )
                        }
                      >
                        Lock this date
                        <ArrowUpRight size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {!plan.dates.length && (
            <div className="info-note">
              {host
                ? 'Add a couple of options to get things moving.'
                : 'The host will add date options soon.'}
            </div>
          )}
          {host && (
            <form
              className="form-stack date-form"
              onSubmit={(event) => {
                event.preventDefault();
                const values = Object.fromEntries(
                  new FormData(event.currentTarget),
                );
                void submit('addDate', values, false);
              }}
            >
              <h3>Another possibility?</h3>
              <div className="form-columns">
                <label>
                  From
                  <input type="date" name="start" required />
                </label>
                <label>
                  To
                  <input type="date" name="end" required />
                </label>
              </div>
              <button className="button secondary full-width" disabled={busy}>
                <Plus size={15} />
                Add an option
              </button>
            </form>
          )}
          <p className="form-note">
            <Leaf size={13} />
            The host makes the final call. Perfect overlap is optional.
          </p>
        </>
      )}

      {kind === 'members' && (
        <>
          <div className="member-summary">
            {['going', 'maybe', 'pending', 'declined'].map((status) => (
              <span key={status}>
                <strong>
                  {
                    plan.members.filter((member) => member.rsvp === status)
                      .length
                  }
                </strong>
                {status === 'pending'
                  ? 'awaiting'
                  : status === 'declined'
                    ? 'can’t make it'
                    : status}
              </span>
            ))}
          </div>
          <div className="member-list">
            {plan.members.map((member) => (
              <div className="member-row" key={member.id}>
                <Avatar person={member} />
                <div>
                  <strong>
                    {member.id === user.id
                      ? `${member.name} (you)`
                      : member.name}
                    {member.role === 'host' && (
                      <span className="host-tag">HOST</span>
                    )}
                  </strong>
                  {member.constraint && <small>{member.constraint}</small>}
                </div>
                <span className={`rsvp-status ${member.rsvp}`}>
                  {member.rsvp === 'going'
                    ? 'Going'
                    : member.rsvp === 'maybe'
                      ? 'Maybe'
                      : member.rsvp === 'pending'
                        ? 'Awaiting'
                        : 'Can’t make it'}
                </span>
              </div>
            ))}
          </div>
          {host && pending.length > 0 && (
            <button
              className="button secondary full-width"
              disabled={busy}
              onClick={() =>
                void submit(
                  'nudge',
                  {},
                  false,
                  'A quiet reminder is waiting in their Activity.',
                )
              }
            >
              <Bell size={15} />
              Give{' '}
              {pending.length === 1
                ? shortName(pending[0].name)
                : `${pending.length} people`}{' '}
              a gentle nudge
            </button>
          )}
          <p className="form-note">
            A nudge appears in Activity. At most one per day.
          </p>
        </>
      )}

      {kind === 'rsvp' && (
        <form
          className="form-stack"
          onSubmit={(event) => handleForm(event, 'rsvp', { rsvp })}
        >
          <div className="rsvp-options">
            {[
              ['going', '🙌', 'I’m going'],
              ['maybe', '🤞', 'Maybe'],
              ['declined', '💛', 'Can’t make it'],
            ].map(([value, emoji, label]) => (
              <button
                type="button"
                className={rsvp === value ? 'selected' : ''}
                key={value}
                onClick={() => setRsvp(value)}
                aria-pressed={rsvp === value}
              >
                <span>{emoji}</span>
                {label}
                {rsvp === value && <Check size={13} />}
              </button>
            ))}
          </div>
          <label>
            Anything your people should know?
            <textarea
              name="constraint"
              maxLength={200}
              defaultValue={current.constraint}
              rows={3}
              placeholder="I’ll need a ride. Vegetarian. Waiting on work…"
            />
          </label>
          <button className="button primary full-width" disabled={busy}>
            {busy ? 'Saving…' : 'Save my RSVP'}
            <Check size={16} />
          </button>
        </form>
      )}

      {kind === 'location' && (
        <>
          {plan.address && (
            <a
              className="map-preview"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(plan.address)}`}
              target="_blank"
              rel="noreferrer"
            >
              <div className="map-lines">
                <MapPin size={30} />
              </div>
              <strong>{plan.location}</strong>
              <p>{plan.address}</p>
              <span>
                Open in Maps
                <ExternalLink size={13} />
              </span>
            </a>
          )}
          {host ? (
            <form
              className="form-stack"
              onSubmit={(event) => handleForm(event, 'location')}
            >
              <label>
                Place name
                <input
                  name="location"
                  defaultValue={plan.location}
                  maxLength={100}
                  required
                  placeholder="A cabin in the redwoods"
                />
              </label>
              <label>
                Address or meeting point
                <input
                  name="address"
                  defaultValue={plan.address}
                  maxLength={200}
                  placeholder="The exact spot, so no one gets lost"
                />
              </label>
              <button className="button primary full-width" disabled={busy}>
                Save the meeting point
                <Check size={15} />
              </button>
            </form>
          ) : (
            !plan.address && (
              <div className="info-note">
                The host hasn’t set a meeting point yet.
              </div>
            )
          )}
        </>
      )}

      {kind === 'day' && (
        <>
          <div className="day-details">
            <span className="day-icon">
              <Navigation size={23} />
            </span>
            <h3>{dateLabel(date)}</h3>
            <p>{plan.address || 'The meeting point is still to be decided.'}</p>
            {plan.address && (
              <a
                className="button secondary"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(plan.address)}`}
                target="_blank"
                rel="noreferrer"
              >
                <MapPin size={15} />
                Get directions
                <ExternalLink size={13} />
              </a>
            )}
          </div>
          {current.rsvp === 'going' ? (
            <>
              <div className="arrival-buttons">
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() =>
                    void submit(
                      'eta',
                      { eta: 'On my way! 🚗' },
                      false,
                      'Your group knows you’re on the way.',
                    )
                  }
                >
                  <Navigation size={15} />
                  On my way
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    void submit(
                      'eta',
                      { eta: 'I’m here! 📍' },
                      false,
                      'You’ve arrived. Let the good times begin.',
                    )
                  }
                >
                  <Check size={15} />
                  I’m here
                </button>
              </div>
              <form
                className="form-stack eta-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const values = Object.fromEntries(
                    new FormData(event.currentTarget),
                  );
                  void submit('eta', values, false, 'Arrival update shared.');
                }}
              >
                <label>
                  A quick arrival update
                  <input
                    name="eta"
                    maxLength={80}
                    placeholder="Running 20 minutes late. Save me a taco."
                    required
                  />
                </label>
                <button className="button secondary full-width" disabled={busy}>
                  Share with the group
                  <ArrowUpRight size={15} />
                </button>
              </form>
            </>
          ) : (
            <div className="info-note">RSVP Going to share your arrival.</div>
          )}
          <div className="section-title">
            <h3>On the way</h3>
            <Users size={15} />
          </div>
          {plan.members
            .filter((member) => member.rsvp === 'going')
            .map((member) => (
              <div className="arrival-row" key={member.id}>
                <Avatar person={member} small />
                <strong>{shortName(member.name)}</strong>
                <span>{member.eta || 'No update yet'}</span>
              </div>
            ))}
        </>
      )}

      {kind === 'proposal' && (
        <form
          className="form-stack"
          onSubmit={(event) => handleForm(event, 'proposal')}
        >
          <label>
            The idea
            <input
              name="title"
              maxLength={100}
              required
              placeholder="Tacos on the first night?"
            />
          </label>
          <label>
            The details
            <textarea
              name="detail"
              rows={4}
              maxLength={500}
              required
              placeholder="Where, what it costs, and anything worth knowing."
            />
          </label>
          <div className="info-note">
            <Users size={17} />
            {Math.max(1, Math.ceil(plan.members.length / 2))} votes confirms it
            and adds it to the plan.
          </div>
          <button className="button primary full-width" disabled={busy}>
            Put it to the group
            <ArrowUpRight size={16} />
          </button>
        </form>
      )}

      {kind === 'task' && (
        <form
          className="form-stack"
          onSubmit={(event) => handleForm(event, 'task')}
        >
          <label>
            What needs doing?
            <input
              name="title"
              maxLength={100}
              required
              placeholder="Bring a cooler and some ice"
            />
          </label>
          <label>
            Who’s on it?
            <select name="ownerId">
              <option value="">Open — someone can claim it</option>
              {(host ? plan.members : [current]).map((member) => (
                <option value={member.id} key={member.id}>
                  {member.id === user.id ? 'Me — I’ve got this' : member.name}
                </option>
              ))}
            </select>
          </label>
          <button className="button primary full-width" disabled={busy}>
            Add the little job
            <Plus size={16} />
          </button>
        </form>
      )}

      {kind === 'expense' && (
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void submit('expense', {
              title: data.get('title'),
              amount: Math.round(Number(data.get('amount')) * 100),
            });
          }}
        >
          <label>
            What was it for?
            <input
              name="title"
              maxLength={100}
              required
              placeholder="The cabin, groceries, gas…"
            />
          </label>
          <label>
            Total you paid (USD)
            <input
              name="amount"
              type="number"
              min="0.01"
              max="1000000"
              step="0.01"
              placeholder="0.00"
              required
            />
          </label>
          <div className="info-note">
            <Users size={17} />
            Split between{' '}
            {
              plan.members.filter(
                (member) => member.rsvp === 'going' || member.id === user.id,
              ).length
            }{' '}
            people. Your share is marked paid.
          </div>
          <button className="button primary full-width" disabled={busy}>
            Add the shared cost
            <Plus size={16} />
          </button>
          <p className="form-note">
            This keeps track. Settle up using your usual payment app.
          </p>
        </form>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
