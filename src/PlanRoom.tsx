import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Circle,
  ClipboardList,
  Compass,
  DollarSign,
  Leaf,
  ListChecks,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  Smile,
  Sparkles,
  Users,
  Vote,
  X,
} from 'lucide-react';
import { api } from './api';
import { Avatar, AvatarStack, EmptyState, ProposalCard } from './components';
import { PlanModal } from './PlanModal';
import {
  dateLabel,
  downloadCalendar,
  money,
  planStatus,
  shareAmount,
  shortName,
} from './utils';
import type { ModalKind, Person, Plan } from './types';

type Tab = 'talk' | 'decisions' | 'tasks' | 'expenses';

export function PlanRoom({
  plan,
  user,
  onUpdate,
  toast,
}: {
  plan: Plan;
  user: Person;
  onUpdate: (plan: Plan) => void;
  toast: (message: string) => void;
}) {
  const [tab, setTab] = useState<Tab>('talk');
  const [modal, setModal] = useState<ModalKind>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);
  const messageInput = useRef<HTMLTextAreaElement>(null);
  const current = plan.members.find((person) => person.id === user.id)!;
  const host = current.role === 'host';
  const going = plan.members.filter((person) => person.rsvp === 'going');
  const pending = plan.members.filter((person) => person.rsvp === 'pending');
  const maybe = plan.members.filter((person) => person.rsvp === 'maybe');
  const date = plan.dates.find((option) => option.id === plan.lockedDateId);
  const openDecisions = plan.proposals.filter(
    (proposal) => proposal.status === 'open',
  );
  const doneTasks = plan.tasks.filter((task) => task.done).length;
  const unowned = plan.tasks.filter(
    (task) => !task.ownerId && !task.done,
  ).length;
  const totalOwed = plan.expenses.reduce(
    (sum, expense) =>
      sum +
      (expense.settledIds.includes(user.id)
        ? 0
        : shareAmount(expense, user.id)),
    0,
  );
  const closeModal = useCallback(() => setModal(null), []);

  const action = useCallback(
    async (type: string, payload?: Record<string, unknown>) => {
      const updated = await api<Plan>(`/plans/${plan.id}/actions`, {
        type,
        payload,
      });
      onUpdate(updated);
    },
    [plan.id, onUpdate],
  );

  function run(
    type: string,
    payload?: Record<string, unknown>,
    success?: string,
  ) {
    void action(type, payload)
      .then(() => {
        if (success) toast(success);
      })
      .catch((err) => toast(err.message));
  }

  useEffect(() => {
    const chat = chatRef.current;
    if (chat) chat.scrollTop = chat.scrollHeight;
  }, [plan.messages.length, tab]);

  async function send() {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      await action('message', { text: message });
      setMessage('');
      setShowEmoji(false);
      messageInput.current?.focus();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  const tabs: {
    id: Tab;
    label: string;
    icon: typeof MessageCircle;
    count?: number;
  }[] = [
    { id: 'talk', label: 'Conversation', icon: MessageCircle },
    {
      id: 'decisions',
      label: 'Decisions',
      icon: Vote,
      count: openDecisions.length,
    },
    { id: 'tasks', label: 'Little jobs', icon: ListChecks },
    { id: 'expenses', label: 'Shared costs', icon: DollarSign },
  ];

  return (
    <div className="room">
      <header className="room-header">
        <div className={`room-emoji ${plan.color}`}>{plan.emoji}</div>
        <div className="room-heading">
          <div>
            <h1>{plan.name}</h1>
            <span className="private-badge">PRIVATE PLAN</span>
          </div>
          <p>{plan.description || 'A good idea. Your favorite people.'}</p>
        </div>
        <button
          className="button secondary invite-button"
          onClick={() => (host ? setModal('invite') : setModal('members'))}
        >
          {host ? <Plus size={16} /> : <Users size={16} />}
          {host ? 'Invite people' : 'The people'}
        </button>
        <button
          className="icon-button details-toggle"
          aria-label="Show plan details"
          onClick={() => setShowDetails(!showDetails)}
        >
          <ClipboardList size={20} />
        </button>
      </header>
      <div className="room-body">
        <section className="conversation-panel">
          <div className="room-tabs" role="tablist" aria-label="Plan sections">
            {tabs.map((item) => (
              <button
                key={item.id}
                role="tab"
                aria-selected={tab === item.id}
                className={tab === item.id ? 'active' : ''}
                onClick={() => setTab(item.id)}
              >
                <item.icon size={16} />
                <span>{item.label}</span>
                {!!item.count && (
                  <span className="tab-count">{item.count}</span>
                )}
              </button>
            ))}
            <button
              className={`icon-button chat-search-button ${searchOpen ? 'search-active' : ''}`}
              aria-label="Search conversation"
              onClick={() => {
                setSearchOpen(!searchOpen);
                setSearch('');
                setTab('talk');
              }}
            >
              <Search size={17} />
            </button>
          </div>

          <div className="plan-summary">
            <div className="summary-icon">
              <CheckCheck size={18} />
            </div>
            <div className="summary-copy">
              <strong>
                {date
                  ? 'Less planning. More looking forward.'
                  : 'A good idea is only the beginning.'}
              </strong>
              <div>
                <button onClick={() => setModal('dates')}>
                  <CalendarDays size={12} />
                  {dateLabel(date)}
                </button>
                <span className="summary-separator">·</span>
                <button onClick={() => setModal('location')}>
                  <MapPin size={12} />
                  {plan.location || 'Place TBD'}
                </button>
                <span className="summary-separator">·</span>
                <button onClick={() => setModal('members')}>
                  <Users size={12} />
                  {going.length} going
                </button>
              </div>
            </div>
            <button
              className="icon-button"
              aria-label="View the plan"
              onClick={() => setShowDetails(!showDetails)}
            >
              <ChevronDown size={16} />
            </button>
          </div>

          {tab === 'talk' && (
            <>
              {searchOpen && (
                <div className="chat-search">
                  <Search size={16} />
                  <input
                    autoFocus
                    placeholder="Find something in the conversation…"
                    aria-label="Search messages"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <button
                    className="icon-button"
                    aria-label="Close search"
                    onClick={() => {
                      setSearchOpen(false);
                      setSearch('');
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              <div
                className="chat-messages"
                ref={chatRef}
                role="log"
                aria-label="Conversation"
              >
                <div className="chat-start">
                  <span className="small-flower">✳</span>
                  <p>This is where “we should” becomes a plan.</p>
                  <span>YOU’RE IN GOOD COMPANY</span>
                </div>
                <div className="day-divider">
                  <span />
                  {search ? 'Search results' : 'The conversation'}
                  <span />
                </div>
                {plan.messages
                  .filter(
                    (item) =>
                      !search ||
                      item.text.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((item, index, messages) => {
                    const author = plan.members.find(
                      (person) => person.id === item.authorId,
                    );
                    if (item.type === 'system')
                      return (
                        <div className="system-message" key={item.id}>
                          <span>
                            <CheckCheck size={13} />
                            {item.text}
                          </span>
                        </div>
                      );
                    const own = item.authorId === user.id;
                    const continuation =
                      index > 0 &&
                      messages[index - 1].authorId === item.authorId &&
                      messages[index - 1].type !== 'system';
                    const proposal =
                      item.type === 'decision'
                        ? plan.proposals.find((entry) => entry.id === item.text)
                        : null;
                    return (
                      <div
                        className={`message-row ${own ? 'own' : ''} ${continuation ? 'continuation' : ''}`}
                        key={item.id}
                      >
                        <div className="message-avatar">
                          {!continuation && <Avatar person={author} />}
                        </div>
                        <div className="message-content">
                          {!continuation && (
                            <div className="message-meta">
                              <strong>
                                {own ? 'You' : author?.name || 'A friend'}
                              </strong>
                              {author?.role === 'host' && (
                                <span className="host-tag">HOST</span>
                              )}
                              <time
                                dateTime={item.createdAt}
                                title={new Date(
                                  item.createdAt,
                                ).toLocaleString()}
                              >
                                {new Date(item.createdAt).toLocaleTimeString(
                                  'en-US',
                                  { hour: 'numeric', minute: '2-digit' },
                                )}
                              </time>
                            </div>
                          )}
                          {proposal ? (
                            <ProposalCard
                              proposal={proposal}
                              plan={plan}
                              userId={user.id}
                              compact
                              onVote={() => run('vote', { id: proposal.id })}
                            />
                          ) : (
                            <div className="message-bubble">{item.text}</div>
                          )}
                          {own && (
                            <span className="message-sent">
                              <CheckCheck size={12} />
                              Sent
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                {(!plan.messages.length ||
                  (search &&
                    !plan.messages.some((item) =>
                      item.text.toLowerCase().includes(search.toLowerCase()),
                    ))) && (
                  <EmptyState
                    icon={<MessageCircle size={26} />}
                    title={
                      search ? 'Nothing here just yet.' : 'Say the first hello.'
                    }
                  >
                    {search
                      ? 'Try a different word.'
                      : 'Every good plan starts with a conversation.'}
                  </EmptyState>
                )}
              </div>
              <div className="composer-area">
                <div className="composer">
                  <textarea
                    ref={messageInput}
                    aria-label="Message the group"
                    rows={1}
                    placeholder={`A thought for the group…`}
                    maxLength={2000}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void send();
                      }
                    }}
                  />
                  <div className="composer-controls">
                    <div>
                      <button
                        className="icon-button"
                        aria-label="Propose a decision"
                        title="Propose a decision"
                        onClick={() => setModal('proposal')}
                      >
                        <Plus size={19} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Add an emoji"
                        aria-expanded={showEmoji}
                        onClick={() => setShowEmoji(!showEmoji)}
                      >
                        <Smile size={18} />
                      </button>
                      <span className="composer-divider" />
                      <span className="composer-hint">
                        Good plans start with a hello.
                      </span>
                    </div>
                    <button
                      className="send-button"
                      aria-label="Send message"
                      disabled={!message.trim() || sending}
                      onClick={() => void send()}
                    >
                      <ArrowUp size={18} />
                    </button>
                  </div>
                  {showEmoji && (
                    <div className="emoji-picker">
                      {['🌲', '✨', '🙌', '❤️', '😂', '🌮', '☕', '🏕️'].map(
                        (emoji) => (
                          <button
                            key={emoji}
                            onClick={() => {
                              setMessage(message + emoji);
                              setShowEmoji(false);
                              messageInput.current?.focus();
                            }}
                          >
                            {emoji}
                          </button>
                        ),
                      )}
                    </div>
                  )}
                </div>
                <div className="composer-footnote">
                  <Leaf size={11} />
                  No noisy notifications. Just good conversation.
                  <span>↵ to send</span>
                </div>
              </div>
            </>
          )}

          {tab === 'decisions' && (
            <div className="tab-content">
              <div className="content-heading">
                <div>
                  <div className="eyebrow">FEWER “ANY THOUGHTS?”</div>
                  <h2>A little less back-and-forth.</h2>
                  <p>Weigh in. Make a call. Keep it in the plan.</p>
                </div>
                <button
                  className="button primary small-button"
                  onClick={() => setModal('proposal')}
                >
                  <Plus size={15} />
                  Propose
                </button>
              </div>
              <button
                className="date-decision-card"
                onClick={() => setModal('dates')}
              >
                <span className="date-icon">
                  <CalendarDays size={21} />
                </span>
                <span>
                  <strong>
                    {date ? 'The dates are in.' : 'Find a time that works.'}
                  </strong>
                  <small>
                    {date
                      ? `${dateLabel(date)} · ${date.voters.length} available`
                      : `${plan.dates.length} options · Add your availability`}
                  </small>
                </span>
                <span className="text-button">
                  {date ? 'View dates' : 'Find a date'}
                  <ArrowUpRight size={15} />
                </span>
              </button>
              <div className="section-title">
                <h3>On the table</h3>
                <span>{openDecisions.length} open</span>
              </div>
              {openDecisions.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  plan={plan}
                  userId={user.id}
                  onVote={() =>
                    run(
                      'vote',
                      { id: proposal.id },
                      proposal.votes.includes(user.id)
                        ? 'Vote removed.'
                        : 'Your vote is in.',
                    )
                  }
                />
              ))}
              {!openDecisions.length && (
                <EmptyState
                  icon={<CheckCheck size={24} />}
                  title="All on the same page."
                >
                  Got another idea? Put it to the group.
                </EmptyState>
              )}
              {plan.proposals.some(
                (proposal) => proposal.status === 'confirmed',
              ) && (
                <>
                  <div className="section-title">
                    <h3>In the plan</h3>
                    <CheckCheck size={15} />
                  </div>
                  {plan.proposals
                    .filter((proposal) => proposal.status === 'confirmed')
                    .map((proposal) => (
                      <ProposalCard
                        key={proposal.id}
                        proposal={proposal}
                        plan={plan}
                        userId={user.id}
                        onVote={() => {}}
                      />
                    ))}
                </>
              )}
            </div>
          )}

          {tab === 'tasks' && (
            <div className="tab-content">
              <div className="content-heading">
                <div>
                  <div className="eyebrow">MANY HANDS, LIGHT WORK</div>
                  <h2>The little jobs.</h2>
                  <p>Everyone brings something to the table.</p>
                </div>
                <button
                  className="button primary small-button"
                  onClick={() => setModal('task')}
                >
                  <Plus size={15} />
                  Add a job
                </button>
              </div>
              <div className="task-progress">
                <div>
                  <strong>
                    {doneTasks} of {plan.tasks.length} done
                  </strong>
                  <span>
                    {unowned
                      ? `${unowned} ${unowned === 1 ? 'job needs' : 'jobs need'} a person`
                      : 'Every job has a person'}
                  </span>
                </div>
                <div className="progress-track">
                  <span
                    style={{
                      width: `${plan.tasks.length ? (doneTasks / plan.tasks.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              {plan.tasks.map((task) => (
                <div
                  className={`task-row full ${task.done ? 'done' : ''}`}
                  key={task.id}
                >
                  <button
                    className="task-check"
                    aria-label={`${task.done ? 'Reopen' : 'Complete'} ${task.title}`}
                    disabled={!host && task.ownerId !== user.id}
                    onClick={() => run('toggleTask', { id: task.id })}
                  >
                    {task.done && <Check size={13} />}
                  </button>
                  <span className="task-title">{task.title}</span>
                  {task.ownerId ? (
                    <button
                      className="task-owner"
                      disabled={task.ownerId !== user.id && !host}
                      onClick={() => run('claimTask', { id: task.id })}
                    >
                      <Avatar
                        person={plan.members.find(
                          (person) => person.id === task.ownerId,
                        )}
                        small
                      />
                      <span>
                        {task.ownerId === user.id
                          ? 'You'
                          : shortName(
                              plan.members.find(
                                (person) => person.id === task.ownerId,
                              )?.name || '',
                            )}
                      </span>
                    </button>
                  ) : (
                    <button
                      className="claim-button"
                      onClick={() =>
                        run(
                          'claimTask',
                          { id: task.id },
                          'That one’s yours. Thanks for pitching in.',
                        )
                      }
                    >
                      <Plus size={13} />
                      I’ll do it
                    </button>
                  )}
                </div>
              ))}
              {!plan.tasks.length && (
                <EmptyState
                  icon={<ListChecks size={26} />}
                  title="A little teamwork goes a long way."
                >
                  Add the small jobs that make the plan happen.
                </EmptyState>
              )}
              <div className="info-note">
                <Leaf size={16} />
                This is a weekend, not a project. Keep the list little.
              </div>
            </div>
          )}

          {tab === 'expenses' && (
            <div className="tab-content">
              <div className="content-heading">
                <div>
                  <div className="eyebrow">KEEP THE GOOD VIBES</div>
                  <h2>A fair share.</h2>
                  <p>Track it here. Pay each other however you like.</p>
                </div>
                <button
                  className="button primary small-button"
                  onClick={() => setModal('expense')}
                >
                  <Plus size={15} />
                  Add a cost
                </button>
              </div>
              <div className="expense-summary">
                <div>
                  <span>Total shared costs</span>
                  <strong>
                    {money(
                      plan.expenses.reduce(
                        (sum, expense) => sum + expense.amount,
                        0,
                      ),
                    )}
                  </strong>
                </div>
                <div>
                  <span>Your unsettled share</span>
                  <strong>{money(totalOwed)}</strong>
                </div>
              </div>
              {plan.expenses.map((expense) => {
                const payer = plan.members.find(
                  (person) => person.id === expense.paidBy,
                );
                const included = expense.participants.includes(user.id);
                const settled = expense.settledIds.includes(user.id);
                return (
                  <div className="expense-card" key={expense.id}>
                    <div className="expense-card-top">
                      <span className="expense-icon">
                        <DollarSign size={19} />
                      </span>
                      <div>
                        <h3>{expense.title}</h3>
                        <p>
                          {payer?.name} paid · Split{' '}
                          {expense.participants.length} ways
                        </p>
                      </div>
                      <strong>{money(expense.amount)}</strong>
                    </div>
                    <div className="expense-card-bottom">
                      <span>
                        {included
                          ? `Your share: ${money(shareAmount(expense, user.id))}`
                          : 'You’re not in this split'}
                      </span>
                      {included &&
                        (settled ? (
                          <span className="confirmed-label">
                            <Check size={14} />
                            Settled
                          </span>
                        ) : (
                          <button
                            className="text-button"
                            onClick={() =>
                              run(
                                'settle',
                                { id: expense.id },
                                'Marked settled. No payment was sent.',
                              )
                            }
                          >
                            <Check size={14} />
                            Mark paid
                          </button>
                        ))}
                    </div>
                    <div className="settled-people">
                      {expense.settledIds.length} of{' '}
                      {expense.participants.length} settled
                    </div>
                  </div>
                );
              })}
              {!plan.expenses.length && (
                <EmptyState
                  icon={<DollarSign size={25} />}
                  title="Nothing to split. Yet."
                >
                  Log a shared cost when someone picks up the tab.
                </EmptyState>
              )}
              <div className="info-note">
                No payments happen here. “Mark paid” records a payment you made
                elsewhere.
              </div>
            </div>
          )}
        </section>

        <aside className={`plan-panel ${showDetails ? 'visible' : ''}`}>
          <div className="plan-panel-title">
            <h2>
              The plan<span>↗</span>
            </h2>
            <button
              className="icon-button close-details"
              aria-label="Close plan details"
              onClick={() => setShowDetails(false)}
            >
              <X size={17} />
            </button>
            <span className="live-label">
              <i />
              All in one place
            </span>
          </div>
          <div className="plan-cover">
            <img
              src="/big-sur.svg"
              alt="A quiet stretch of the California coast"
            />
            <span className="cover-label">
              <span>LESS SCROLLING.</span>
              <strong>More living.</strong>
            </span>
            <span className="cover-stamp">
              GO
              <br />
              GATHER
            </span>
          </div>
          <div className={`happening-badge ${date ? '' : 'idea'}`}>
            <span className="status-dot green" />
            {planStatus(plan)}
            <Sparkles size={13} />
          </div>
          <div className="plan-facts">
            <button className="fact" onClick={() => setModal('dates')}>
              <span className="fact-icon">
                <CalendarDays size={17} />
              </span>
              <span>
                <small>WHEN</small>
                <strong>
                  {date
                    ? `${dateLabel(date)}, ${date.start.slice(0, 4)}`
                    : 'Let’s find a date'}
                </strong>
                {date && (
                  <span className="fact-note">
                    {date.start === date.end
                      ? 'Save the day'
                      : `${Math.round((new Date(date.end).getTime() - new Date(date.start).getTime()) / 86400000)} nights, a little further offline`}
                    <span className="locked-label">
                      <Check size={10} />
                      Locked
                    </span>
                  </span>
                )}
              </span>
              <ChevronRight size={14} />
            </button>
            <button className="fact" onClick={() => setModal('location')}>
              <span className="fact-icon">
                <MapPin size={17} />
              </span>
              <span>
                <small>WHERE</small>
                <strong>{plan.location || 'Somewhere good'}</strong>
                <span className="fact-note">
                  {plan.address
                    ? 'View meeting point'
                    : 'A place to be decided'}
                </span>
              </span>
              <ArrowUpRight size={14} />
            </button>
          </div>
          {date && (
            <button
              className="calendar-export"
              onClick={() => {
                downloadCalendar(plan);
                toast(
                  'Calendar file downloaded. Open it in your calendar app.',
                );
              }}
            >
              <CalendarDays size={14} />
              Add to my calendar
              <ArrowDown size={13} />
            </button>
          )}
          <div className="panel-section people-section">
            <div className="section-title">
              <h3>The good company</h3>
              <button
                className="text-button"
                onClick={() => setModal('members')}
              >
                View all
                <ArrowUpRight size={13} />
              </button>
            </div>
            <button
              className="people-preview"
              onClick={() => setModal('members')}
            >
              <AvatarStack members={going} limit={5} />
              <span>
                <strong>{going.length} going</strong>
                <small>
                  {maybe.length} maybe · {pending.length} awaiting
                </small>
              </span>
            </button>
            <button className="your-rsvp" onClick={() => setModal('rsvp')}>
              <span>
                {current.rsvp === 'going' ? (
                  <Check size={15} />
                ) : (
                  <Circle size={14} />
                )}
                {current.rsvp === 'going'
                  ? 'You’re going'
                  : current.rsvp === 'maybe'
                    ? 'You’re a maybe'
                    : current.rsvp === 'declined'
                      ? 'You can’t make it'
                      : 'Are you in?'}
              </span>
              <span>
                {current.rsvp === 'pending' ? 'RSVP' : 'Change'}
                <ChevronDown size={13} />
              </span>
            </button>
          </div>
          <div className="panel-section">
            <div className="section-title">
              <h3>A little teamwork</h3>
              <span>
                {doneTasks}/{plan.tasks.length}
              </span>
            </div>
            <div className="mini-tasks">
              {plan.tasks.slice(0, 3).map((task) => (
                <div
                  className={`task-row ${task.done ? 'done' : ''}`}
                  key={task.id}
                >
                  <button
                    className="task-check"
                    aria-label={`${task.done ? 'Reopen' : 'Complete'} ${task.title}`}
                    disabled={!host && task.ownerId !== user.id}
                    onClick={() => run('toggleTask', { id: task.id })}
                  >
                    {task.done && <Check size={11} />}
                  </button>
                  <span className="task-title">{task.title}</span>
                  {task.ownerId ? (
                    <Avatar
                      person={plan.members.find(
                        (person) => person.id === task.ownerId,
                      )}
                      small
                    />
                  ) : (
                    <button
                      className="claim-button"
                      onClick={() =>
                        run('claimTask', { id: task.id }, 'You’re on it.')
                      }
                    >
                      <Plus size={11} />
                      Claim
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              className="panel-link"
              onClick={() => {
                setTab('tasks');
                setShowDetails(false);
              }}
            >
              {plan.tasks.length
                ? 'All the little jobs'
                : 'Add the first little job'}
              <ArrowRight size={13} />
            </button>
            {unowned > 0 && (
              <div className="unowned-hint">
                <span />
                {unowned}{' '}
                {unowned === 1 ? 'thing still needs' : 'things still need'} a
                person
              </div>
            )}
          </div>
          <button className="day-mode" onClick={() => setModal('day')}>
            <Compass size={19} />
            <span>
              <strong>When the day comes</strong>
              <small>Meeting point, ETAs & “I’m here”</small>
            </span>
            <ArrowUpRight size={16} />
          </button>
          <div className="panel-footer">
            <span>✳</span>Good times take a little gathering.
          </div>
        </aside>
      </div>
      {modal && (
        <PlanModal
          kind={modal}
          plan={plan}
          user={user}
          action={action}
          onClose={closeModal}
          toast={toast}
        />
      )}
    </div>
  );
}
