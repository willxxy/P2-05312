import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Leaf,
  LoaderCircle,
  MessageCircle,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { api } from './api';
import { Avatar, EmptyState, Modal } from './components';
import { PlanRoom } from './PlanRoom';
import { dateLabel, parseDate, planStatus, shortName } from './utils';
import type { Person, Plan } from './types';

type View = 'plans' | 'activity' | 'calendar';
type Invite = {
  name: string;
  emoji: string;
  description: string;
  count: number;
};

export default function App() {
  const [user, setUser] = useState<Person | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedId, setSelectedId] = useState(
    localStorage.getItem('gather-plan') || '',
  );
  const [view, setView] = useState<View>('plans');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [help, setHelp] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [inviteError, setInviteError] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(new Date(2026, 9, 1));
  const revision = useRef(0);
  const inviteToken = useRef(
    new URLSearchParams(window.location.search).get('join'),
  );

  const refresh = useCallback(async () => {
    const version = revision.current;
    const result = await api<Plan[]>('/plans');
    if (version === revision.current) setPlans(result);
    return result;
  }, []);

  useEffect(() => {
    async function initialize() {
      try {
        const profile = await api<Person>(
          inviteToken.current ? '/session?guest=1' : '/session',
        );
        setUser(profile);
        const initialPlans = await refresh();
        setSelectedId((current) =>
          initialPlans.some((plan) => plan.id === current)
            ? current
            : initialPlans[0]?.id || '',
        );
        if (inviteToken.current) {
          try {
            setInvite(
              await api<Invite>(
                `/invites/${encodeURIComponent(inviteToken.current)}`,
              ),
            );
          } catch (err) {
            setInviteError((err as Error).message);
          }
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    void initialize();
    const interval = setInterval(() => {
      if (!document.hidden) void refresh().catch(() => {});
    }, 4000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 4200);
    return () => clearTimeout(timeout);
  }, [toast]);

  const updatePlan = useCallback((updated: Plan) => {
    revision.current += 1;
    setPlans((current) =>
      current.some((plan) => plan.id === updated.id)
        ? current.map((plan) => (plan.id === updated.id ? updated : plan))
        : [...current, updated],
    );
  }, []);

  function selectPlan(id: string) {
    setSelectedId(id);
    localStorage.setItem('gather-plan', id);
    setView('plans');
    setMenuOpen(false);
  }

  const selected = plans.find((plan) => plan.id === selectedId) || plans[0];
  const notices = plans.flatMap((plan) =>
    plan.notifications.map((notice) => ({ ...notice, plan })),
  );
  const unread = notices.filter((notice) => !notice.read).length;
  const needsYou = plans.filter(
    (plan) =>
      plan.members.find((person) => person.id === user?.id)?.rsvp ===
        'pending' ||
      plan.tasks.some((task) => task.ownerId === user?.id && !task.done) ||
      plan.proposals.some(
        (proposal) =>
          proposal.status === 'open' &&
          !proposal.votes.includes(user?.id || ''),
      ),
  );
  const closeCreate = useCallback(() => {
    setCreating(false);
    setFormError('');
  }, []);
  const closeHelp = useCallback(() => setHelp(false), []);
  const dismissInvite = useCallback(() => {
    setInvite(null);
    setInviteError('');
    setFormError('');
    history.replaceState(null, '', window.location.pathname);
  }, []);

  async function createPlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFormError('');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const plan = await api<Plan>('/plans', values);
      updatePlan(plan);
      selectPlan(plan.id);
      closeCreate();
      setToast('A good plan starts here.');
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function join(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFormError('');
    const name = new FormData(event.currentTarget).get('name');
    try {
      const plan = await api<Plan>('/join', {
        token: inviteToken.current,
        name,
      });
      updatePlan(plan);
      selectPlan(plan.id);
      dismissInvite();
      const member = plan.members.find((person) => person.id === user?.id);
      if (member)
        setUser({
          id: member.id,
          name: member.name,
          initials: member.initials,
          color: member.color,
        });
      setToast('You’re in. Let’s make a plan.');
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <div className="app-loading">
        <img src="/favicon.svg" alt="" />
        <h1>
          gather<span>®</span>
        </h1>
        <LoaderCircle className="spin" size={20} />
        <p>Getting your people together…</p>
      </div>
    );
  if (error || !user)
    return (
      <div className="app-loading">
        <Leaf size={36} />
        <h2>Couldn’t open your plans.</h2>
        <p>{error || 'Your session is unavailable.'}</p>
        <button
          className="button primary"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </div>
    );

  const calendarPlans = plans.filter((plan) => {
    const date = plan.dates.find((option) => option.id === plan.lockedDateId);
    return (
      date &&
      parseDate(date.start).getMonth() === calendarMonth.getMonth() &&
      parseDate(date.start).getFullYear() === calendarMonth.getFullYear()
    );
  });

  return (
    <div className="app-shell">
      {menuOpen && (
        <div className="sidebar-scrim" onClick={() => setMenuOpen(false)} />
      )}
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <a
          className="brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            setView('plans');
            setMenuOpen(false);
          }}
        >
          <img src="/favicon.svg" alt="" />
          <span>
            gather<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-icon">
            {user.initials[0].toLowerCase()}
          </span>
          <span>
            {shortName(user.name)}’s little corner
            <span className="workspace-caption">Good people. Real plans.</span>
          </span>
          <Leaf size={15} />
        </div>
        <button
          className="button primary new-plan"
          onClick={() => {
            setCreating(true);
            setMenuOpen(false);
          }}
        >
          <Plus size={17} />
          Create a plan<span>⌘ K</span>
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          <button
            className={view === 'plans' ? 'active' : ''}
            onClick={() => {
              setView('plans');
              setMenuOpen(false);
            }}
          >
            <MessageCircle size={18} />
            Your plans<span className="nav-count">{plans.length}</span>
          </button>
          <button
            className={view === 'activity' ? 'active' : ''}
            onClick={() => {
              setView('activity');
              setMenuOpen(false);
            }}
          >
            <Bell size={18} />
            Activity{unread > 0 && <span className="nav-count">{unread}</span>}
          </button>
          <button
            className={view === 'calendar' ? 'active' : ''}
            onClick={() => {
              setView('calendar');
              setMenuOpen(false);
            }}
          >
            <CalendarDays size={18} />
            Calendar
          </button>
        </nav>
        <div className="plan-list-heading">
          <span>IN THE WORKS</span>
          <button
            className="icon-button"
            aria-label="Create another plan"
            onClick={() => setCreating(true)}
          >
            <Plus size={16} />
          </button>
        </div>
        <label className="plan-search">
          <Search size={14} />
          <input
            aria-label="Search your plans"
            placeholder="Find a plan…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="plan-list">
          {plans
            .filter((plan) =>
              plan.name.toLowerCase().includes(query.toLowerCase()),
            )
            .map((plan) => (
              <button
                className={`plan-item ${selected?.id === plan.id && view === 'plans' ? 'selected' : ''}`}
                key={plan.id}
                onClick={() => selectPlan(plan.id)}
              >
                <span className={`plan-emoji ${plan.color}`}>{plan.emoji}</span>
                <span className="plan-item-text">
                  <strong>{plan.name}</strong>
                  <span>
                    <i
                      className={`status-dot ${plan.lockedDateId ? 'green' : plan.dates.length ? 'amber' : 'gray'}`}
                    />
                    {planStatus(plan)}
                  </span>
                </span>
                {plan.id === selected?.id && view === 'plans' && (
                  <span className="selected-indicator" />
                )}
              </button>
            ))}
          {query &&
            !plans.some((plan) =>
              plan.name.toLowerCase().includes(query.toLowerCase()),
            ) && <p className="search-empty">No plans found.</p>}
        </div>
        <div className="sidebar-bottom">
          <div className="manifesto">
            <div className="little-spark">
              <Sparkles size={20} />
            </div>
            <p>
              Less “we should.”
              <br />
              <span>More “remember when.”</span>
            </p>
            <span>Make it out of the group chat.</span>
          </div>
          <button className="help-button" onClick={() => setHelp(true)}>
            <CircleHelp size={17} />A little help
            <ArrowUpRight size={14} />
          </button>
          <div className="profile">
            <Avatar person={user} />
            <span>
              <strong>{user.name}</strong>
              <small>Your personal space</small>
            </span>
            <span className="online-dot" title="Your private space" />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <div className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Open menu"
              onClick={() => setMenuOpen(true)}
            >
              <MessageCircle size={19} />
            </button>
            <span>Your space</span>
            <ChevronRight size={13} />
            <span>
              {view === 'plans'
                ? 'Your plans'
                : view === 'activity'
                  ? 'Activity'
                  : 'Calendar'}
            </span>
          </div>
          <button className="quiet-pill" onClick={() => setView('activity')}>
            <span className="quiet-dot" />
            <span>A little quieter here</span>
            <Leaf size={13} />
          </button>
        </div>
        {view === 'plans' && selected && (
          <PlanRoom
            key={selected.id}
            plan={selected}
            user={user}
            onUpdate={updatePlan}
            toast={setToast}
          />
        )}
        {view === 'plans' && !selected && (
          <section className="standalone-view">
            <EmptyState
              icon={<Leaf size={28} />}
              title="Make room for something good."
            >
              Join a friend’s invitation or start a plan of your own.
            </EmptyState>
            <button
              className="button primary"
              onClick={() => setCreating(true)}
            >
              <Plus size={16} />
              Create a plan
            </button>
          </section>
        )}
        {view === 'activity' && (
          <section className="standalone-view">
            <div className="page-eyebrow">
              <Bell size={16} /> THE IMPORTANT BITS
            </div>
            <h1>A little nudge, when it matters.</h1>
            <p className="page-description">
              Decisions, dates, and the things only you can do. The chatter can
              wait.
            </p>
            <div className="section-title">
              <h2>Needs your attention</h2>
              <span>{needsYou.length} plans</span>
            </div>
            {needsYou.map((plan) => (
              <button
                className="attention-card"
                key={plan.id}
                onClick={() => selectPlan(plan.id)}
              >
                <span className={`plan-emoji ${plan.color}`}>{plan.emoji}</span>
                <span>
                  <strong>{plan.name}</strong>
                  <small>
                    {plan.members.find((person) => person.id === user.id)
                      ?.rsvp === 'pending'
                      ? 'Your RSVP is waiting'
                      : `${plan.proposals.filter((item) => item.status === 'open' && !item.votes.includes(user.id)).length} decisions to weigh in on · ${plan.tasks.filter((task) => task.ownerId === user.id && !task.done).length} tasks with your name on them`}
                  </small>
                </span>
                <ArrowUpRight size={18} />
              </button>
            ))}
            {!needsYou.length && (
              <EmptyState icon={<Check />} title="You’re all caught up.">
                A little less planning, a little more living.
              </EmptyState>
            )}
            <div className="section-title">
              <h2>Updates</h2>
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    for (const plan of plans.filter((item) =>
                      item.notifications.some((notice) => !notice.read),
                    ))
                      updatePlan(
                        await api<Plan>(`/plans/${plan.id}/actions`, {
                          type: 'readNotifications',
                        }),
                      );
                    setToast('All caught up.');
                  } catch (err) {
                    setToast((err as Error).message);
                  }
                }}
              >
                Mark all read
              </button>
            </div>
            {notices.length ? (
              notices
                .slice()
                .reverse()
                .map((notice) => (
                  <button
                    className={`notice-card ${notice.read ? 'read' : ''}`}
                    key={notice.id}
                    onClick={() => selectPlan(notice.plan.id)}
                  >
                    <Bell size={17} />
                    <span>
                      <strong>{notice.title}</strong>
                      <small>{notice.plan.name}</small>
                    </span>
                    {!notice.read && <i className="status-dot green" />}
                  </button>
                ))
            ) : (
              <div className="quiet-empty">
                <Leaf size={22} />
                <p>Nothing noisy. Just the updates that matter.</p>
                <small>
                  You’ll hear about locked dates, assigned tasks, and RSVP
                  requests here.
                </small>
              </div>
            )}
          </section>
        )}
        {view === 'calendar' && (
          <section className="standalone-view">
            <div className="page-eyebrow">
              <CalendarDays size={16} /> SOMETHING TO LOOK FORWARD TO
            </div>
            <h1>Make room for good times.</h1>
            <p className="page-description">
              Your confirmed plans, all in one place.
            </p>
            <div className="calendar-layout">
              <div className="calendar-card">
                <div className="calendar-heading">
                  <h2>
                    {calendarMonth.toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </h2>
                  <div>
                    <button
                      className="icon-button"
                      aria-label="Previous month"
                      onClick={() =>
                        setCalendarMonth(
                          new Date(
                            calendarMonth.getFullYear(),
                            calendarMonth.getMonth() - 1,
                            1,
                          ),
                        )
                      }
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Next month"
                      onClick={() =>
                        setCalendarMonth(
                          new Date(
                            calendarMonth.getFullYear(),
                            calendarMonth.getMonth() + 1,
                            1,
                          ),
                        )
                      }
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
                <div className="calendar-grid">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                    <span className="weekday" key={i}>
                      {day}
                    </span>
                  ))}
                  {Array.from({ length: calendarMonth.getDay() }, (_, i) => (
                    <span key={`empty-${i}`} />
                  ))}
                  {Array.from(
                    {
                      length: new Date(
                        calendarMonth.getFullYear(),
                        calendarMonth.getMonth() + 1,
                        0,
                      ).getDate(),
                    },
                    (_, i) => {
                      const day = i + 1;
                      const date = new Date(
                        calendarMonth.getFullYear(),
                        calendarMonth.getMonth(),
                        day,
                        12,
                      );
                      const events = plans.filter((plan) => {
                        const option = plan.dates.find(
                          (item) => item.id === plan.lockedDateId,
                        );
                        return (
                          option &&
                          date >= parseDate(option.start) &&
                          date <= parseDate(option.end)
                        );
                      });
                      return (
                        <button
                          key={day}
                          className={events.length ? 'event-day' : ''}
                          disabled={!events.length}
                          title={events.map((plan) => plan.name).join(', ')}
                          onClick={() => events[0] && selectPlan(events[0].id)}
                        >
                          {day}
                          {events.length > 0 && <i />}
                        </button>
                      );
                    },
                  )}
                </div>
              </div>
              <div className="upcoming-plans">
                <h2>On the horizon</h2>
                {calendarPlans.length ? (
                  calendarPlans.map((plan) => (
                    <button
                      className="upcoming-card"
                      key={plan.id}
                      onClick={() => selectPlan(plan.id)}
                    >
                      <span>{plan.emoji}</span>
                      <strong>{plan.name}</strong>
                      <small>
                        {dateLabel(
                          plan.dates.find(
                            (date) => date.id === plan.lockedDateId,
                          ),
                        )}{' '}
                        · {plan.location || 'Place TBD'}
                      </small>
                      <ArrowUpRight size={17} />
                    </button>
                  ))
                ) : (
                  <p className="muted">
                    A little room for spontaneity.
                    <br />
                    No confirmed plans this month.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      {creating && (
        <Modal
          title="What should we do?"
          subtitle="Start with an idea. Figure it out together."
          onClose={closeCreate}
        >
          <form onSubmit={createPlan} className="form-stack">
            <label>
              Give your plan a name
              <input
                name="name"
                placeholder="A weekend in the mountains…"
                maxLength={70}
                required
                autoFocus
              />
            </label>
            <label>
              A little more about it
              <textarea
                name="description"
                placeholder="Good people, fresh air, and no real agenda."
                maxLength={200}
                rows={3}
              />
            </label>
            <label>
              Set the mood
              <select name="emoji">
                <option value="🏕️">🏕️ An outdoor escape</option>
                <option value="🍝">🍝 Something delicious</option>
                <option value="🌊">🌊 A little getaway</option>
                <option value="🎂">🎂 A reason to celebrate</option>
                <option value="☕">☕ Just getting together</option>
                <option value="✈️">✈️ A bigger adventure</option>
              </select>
            </label>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <button className="button primary full-width" disabled={busy}>
              {busy ? 'Creating…' : 'Let’s make it happen'}
              <ArrowUpRight size={17} />
            </button>
            <p className="form-note">
              <Leaf size={13} />
              Private to you and the people you invite.
            </p>
          </form>
        </Modal>
      )}
      {invite && (
        <Modal
          title={`${invite.emoji} You’re invited.`}
          subtitle="No account. Just your people."
          onClose={dismissInvite}
        >
          <div className="invite-preview">
            <h3>{invite.name}</h3>
            <p>{invite.description}</p>
            <span>{invite.count} people making a plan</span>
          </div>
          <form className="form-stack" onSubmit={join}>
            <label>
              Your name
              <input
                name="name"
                maxLength={60}
                placeholder="What should we call you?"
                required
              />
            </label>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <button className="button primary full-width" disabled={busy}>
              {busy ? 'Joining…' : 'Join the plan'}
              <ArrowDownLeft size={17} />
            </button>
          </form>
        </Modal>
      )}
      {inviteError && (
        <Modal title="This invite took a wrong turn." onClose={dismissInvite}>
          <p>{inviteError}</p>
          <button className="button primary" onClick={dismissInvite}>
            Back to your plans
          </button>
        </Modal>
      )}
      {help && (
        <Modal
          title="Good plans, less back-and-forth."
          subtitle="A little guide to Gather."
          onClose={closeHelp}
        >
          <div className="help-steps">
            {[
              [
                '01',
                'Start with an idea',
                'Create a plan and invite your people with a private link. Guests only need a name.',
              ],
              [
                '02',
                'Make a few decisions',
                'Vote on dates and proposals. The host locks the date; half the group confirms a proposal.',
              ],
              [
                '03',
                'Share the little jobs',
                'Claim a task, log shared costs, and let everyone know when you’re on your way.',
              ],
            ].map(([number, title, detail]) => (
              <div key={number}>
                <span>{number}</span>
                <section>
                  <h3>{title}</h3>
                  <p>{detail}</p>
                </section>
              </div>
            ))}
          </div>
          <div className="info-note">
            <Leaf size={17} />
            Chat stays quiet. Only things that need you appear in Activity.
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast('')}
          >
            <X size={14} />
          </button>
        </div>
      )}
      <KeyboardShortcut onCreate={() => setCreating(true)} />
    </div>
  );
}

function KeyboardShortcut({ onCreate }: { onCreate: () => void }) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        onCreate();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCreate]);
  return null;
}
