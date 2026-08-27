import React, { useState } from 'react';
import {
  PageShell, SectionHeader, Tile, StatTile, DataTable, Sheet, Modal,
  SegmentedControl, Chip, Meter, Countdown, EmptyState, Banner,
  CATEGORY_THEME, teamColor, type Category, type Column, type Segment,
} from './ui/index.ts';
import { ConfirmModal, Toggle } from './admin/index.ts';
import { CONSTRUCTORS, USAGE_LIMITS } from '../constants.ts';
import { EntityClass } from '../types.ts';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { LeaderboardIcon } from './icons/LeaderboardIcon.tsx';
import { SpeakerphoneIcon } from './icons/SpeakerphoneIcon.tsx';
import { PicksIcon } from './icons/PicksIcon.tsx';
import { CalendarIcon } from './icons/CalendarIcon.tsx';

/**
 * Gate 3 review surface. Every primitive in every state, on one page, so the design
 * language can be approved here rather than relitigated on each real page.
 * Not linked from anywhere in the app — reachable only at /dev/ui.
 */

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="mb-8">
    <div className="text-[10px] uppercase tracking-widest text-highlight-silver/60 font-bold mb-2">{label}</div>
    {children}
  </div>
);

type RaceTab = 'picks' | 'weekend' | 'results';

const RACE_TABS: Segment<RaceTab>[] = [
  { value: 'picks',   label: 'Picks',   icon: PicksIcon },
  { value: 'weekend', label: 'Weekend', icon: CalendarIcon },
  { value: 'results', label: 'Results', icon: TrophyIcon },
];

const COUNT_TABS: Segment<RaceTab>[] = [
  { value: 'picks',   label: 'Drivers', count: 23 },
  { value: 'weekend', label: 'Teams',   count: 11 },
];

interface DemoRow { pos: number; team: string; points: number; delta: number; you?: boolean }

const DEMO_ROWS: DemoRow[] = [
  { pos: 1, team: 'Go Jonny Go Go',  points: 1457, delta: 0 },
  { pos: 2, team: 'SixWheelFanCar',  points: 1440, delta: -17 },
  { pos: 3, team: 'Big Baked Ziti',  points: 1420, delta: -37, you: true },
  { pos: 4, team: 'Motor City Madman', points: 1417, delta: -40 },
  { pos: 5, team: 'Mr. Softees Taint', points: 1335, delta: -122 },
];

const COLUMNS: Column<DemoRow>[] = [
  { key: 'pos',    header: '#',      render: r => r.pos, numeric: true, width: '3rem' },
  { key: 'team',   header: 'Team',   render: r => (
      <span className="font-bold">{r.team}{r.you && <Chip label="You" className="ml-2" tone="neutral" size="xs" />}</span>
  ) },
  { key: 'delta',  header: 'Gap',    render: r => r.delta === 0 ? '—' : r.delta, numeric: true, align: 'right', hideOnMobile: true },
  { key: 'points', header: 'Points', render: r => r.points, numeric: true, align: 'right' },
];

const CATEGORIES: Category[] = ['gp', 'quali', 'sprint', 'fl'];

const DevUiGallery: React.FC = () => {
  const [tab, setTab] = useState<RaceTab>('picks');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [urgentOpen, setUrgentOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [guardOpen, setGuardOpen] = useState(false);
  const [toggleOn, setToggleOn] = useState(true);

  const soon = new Date(Date.now() + 1000 * 60 * 60 * 26).toISOString();
  const urgentSoon = new Date(Date.now() + 1000 * 60 * 4).toISOString();

  return (
    <PageShell>
      <div className="pt-6 pb-4">
        <h1 className="text-3xl font-black uppercase italic tracking-wider text-pure-white">UI Gallery</h1>
        <p className="text-sm text-highlight-silver mt-1">
          Every primitive, every state. Nothing here is wired to real data or consumed by a page yet.
        </p>
      </div>

      <SectionHeader title="Tiles" subtitle="One tile spec, four accents" icon={TrophyIcon} />
      <Row label="Plain / interactive / glow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Tile><div className="text-sm">Plain tile</div></Tile>
          <Tile onClick={() => {}}><div className="text-sm">Interactive — hover me</div></Tile>
          <Tile glow><div className="text-sm">Glow (CTA / live / champion only)</div></Tile>
        </div>
      </Row>
      <Row label="Category accents">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CATEGORIES.map(c => (
            <Tile key={c} accent={c} accentEdge>
              <div className={`text-sm font-bold ${CATEGORY_THEME[c].text}`}>{CATEGORY_THEME[c].label}</div>
              <div className="text-[11px] text-highlight-silver mt-0.5">accentEdge</div>
            </Tile>
          ))}
        </div>
      </Row>
      <Row label="Team-colored tiles (hex accent)">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {CONSTRUCTORS.slice(0, 5).map(c => (
            <Tile key={c.id} accent={c.color}>
              <div className="text-sm font-bold">{c.name}</div>
            </Tile>
          ))}
        </div>
      </Row>

      <SectionHeader title="Stat tiles" subtitle="Tabular figures, delta, sparkline" icon={LeaderboardIcon} />
      <Row label="Variants">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile label="Total Points" value="1,420" unit="pts" />
          <StatTile label="Championship Rank" value="#3" delta={2} deltaLabel="vs last round" />
          <StatTile label="Grand Prix" value="1,106" accent="gp" icon={TrophyIcon} />
          <StatTile label="Per Event" value="118" unit="avg" sparkline={[108, 206, 135, 131, 145, 96, 160, 118]} accent="fl" />
        </div>
      </Row>

      <SectionHeader title="Meters" subtitle="Usage budgets, visible before committing" />
      <Row label="Healthy / nearly spent / exhausted">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Meter label="Williams" value={1} max={USAGE_LIMITS[EntityClass.A].teams} color={teamColor('williams', CONSTRUCTORS)} />
          <Meter label="Mercedes" value={7} max={USAGE_LIMITS[EntityClass.A].teams} color={teamColor('mercedes', CONSTRUCTORS)} />
          <Meter label="McLaren" value={10} max={USAGE_LIMITS[EntityClass.A].teams} color={teamColor('mclaren', CONSTRUCTORS)} showRemaining />
        </div>
      </Row>

      <SectionHeader title="Chips" subtitle="Team colors win on team-linked elements" />
      <Row label="Tones and team colors">
        <div className="flex flex-wrap gap-2">
          <Chip label="Paid" tone="success" />
          <Chip label="Locks Soon" tone="warning" />
          <Chip label="Locked" tone="danger" />
          <Chip label="Sprint" tone="warning" size="xs" />
          <Chip label="Unsubmitted" tone="neutral" />
          <Chip label="Announcement" tone="info" icon={SpeakerphoneIcon} />
          {CONSTRUCTORS.slice(0, 6).map(c => <Chip key={c.id} label={c.name} color={c.color} />)}
        </div>
      </Row>

      <SectionHeader title="Segmented control" subtitle="Replaces tile menus and tab rows" />
      <Row label="Default / full width / with counts">
        <div className="space-y-3">
          <SegmentedControl segments={RACE_TABS} value={tab} onChange={v => setTab(v)} />
          <SegmentedControl segments={COUNT_TABS} value={tab} onChange={v => setTab(v)} fullWidth size="sm" />
        </div>
      </Row>
      <Row label="Collapsed on mobile — narrow the window past md to see the picker">
        <SegmentedControl
          segments={RACE_TABS}
          value={tab}
          onChange={v => setTab(v)}
          scrollable
          collapseOnMobile
          ariaLabel="Race tab"
          size="sm"
        />
      </Row>

      <SectionHeader title="Countdown" subtitle="Same thresholds as the old CountdownTimer" />
      <Row label="Normal (26h) / urgent (4m) / sizes">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <Tile><Countdown targetDate={soon} label="Picks lock in" /></Tile>
          <Tile><Countdown targetDate={urgentSoon} label="Urgent" /></Tile>
          <Tile><Countdown targetDate={soon} size="lg" /></Tile>
        </div>
      </Row>

      <SectionHeader title="Data table" subtitle="Sticky header, scrolls inside itself" />
      <Row label="With a highlighted row">
        <DataTable
          columns={COLUMNS}
          rows={DEMO_ROWS}
          rowKey={r => r.team}
          isHighlighted={r => !!r.you}
          onRowClick={() => {}}
        />
      </Row>
      <Row label="Empty state">
        <DataTable columns={COLUMNS} rows={[]} rowKey={r => r.team}
          emptyTitle="No results yet" emptyDescription="Standings appear once the first Grand Prix is scored." />
      </Row>

      <SectionHeader title="Banners" subtitle="Unifies the three announcement banners" />
      <Row label="Every tone">
        <div className="space-y-2 -mx-4 md:mx-0">
          <Banner tone="info" title="League Announcement" icon={SpeakerphoneIcon}
            message="Isack Hadjar out; Liam Lawson takes the Red Bull seat for the Dutch GP." onDismiss={() => {}} />
          <Banner tone="success" title="Results Posted" message="Dutch GP scored. You earned 145 points." onDismiss={() => {}} />
          <Banner tone="warning" title="Picks Lock Soon" message="Under an hour until lights out." />
          <Banner tone="danger" title="Race Control: Red Flag" message="The app is temporarily read-only." />
        </div>
      </Row>

      <SectionHeader title="Overlays" subtitle="Sheet for options, Modal for decisions" />
      <Row label="Triggers">
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setSheetOpen(true)}
            className="bg-primary-red hover:bg-primary-red/90 text-pure-white font-bold py-2 px-5 rounded-lg text-sm transition-colors">
            Open Sheet
          </button>
          <button onClick={() => setModalOpen(true)}
            className="bg-accent-gray hover:bg-accent-gray/80 text-pure-white font-bold py-2 px-5 rounded-lg text-sm transition-colors">
            Open Modal
          </button>
          <button onClick={() => setUrgentOpen(true)}
            className="bg-accent-gray hover:bg-accent-gray/80 text-pure-white font-bold py-2 px-5 rounded-lg text-sm transition-colors">
            Open Urgent Modal
          </button>
        </div>
      </Row>

      <SectionHeader title="Admin primitives" subtitle="components/admin/ — not part of the member kit" />
      <Row label="Toggle">
        <div className="space-y-4 max-w-md">
          <Toggle
            checked={toggleOn} onChange={setToggleOn}
            label="League admin"
            description="Can enter results, manage members, and pause the league."
          />
          <Toggle
            checked disabled onChange={() => {}}
            label="League admin (yourself)"
            disabledReason="You can't remove your own admin access."
          />
        </div>
      </Row>
      <Row label="Confirm">
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setConfirmOpen(true)}
            className="bg-primary-red text-pure-white font-bold py-2 px-5 rounded-lg text-sm">
            Destructive
          </button>
          <button onClick={() => setGuardOpen(true)}
            className="bg-accent-gray text-pure-white font-bold py-2 px-5 rounded-lg text-sm">
            Typed guard
          </button>
        </div>
      </Row>

      <SectionHeader title="Empty state" />
      <Row label="Standalone">
        <Tile padding="none">
          <EmptyState icon={PicksIcon} title="No picks submitted"
            description="Your lineup for this Grand Prix has not been locked in yet."
            action={
              <button className="bg-primary-red text-pure-white font-bold py-2 px-5 rounded-lg text-sm">
                Make Picks
              </button>
            } />
        </Tile>
      </Row>

      <Sheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title="Select Class A Team">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {CONSTRUCTORS.filter(c => c.class === EntityClass.A).map(c => {
            const used = c.id === 'mclaren' ? 10 : 3;
            const limit = USAGE_LIMITS[EntityClass.A].teams;
            const exhausted = used >= limit;
            return (
              <Tile key={c.id} accent={exhausted ? undefined : c.color}
                    onClick={exhausted ? undefined : () => setSheetOpen(false)}
                    className={exhausted ? 'opacity-40' : ''}>
                <div className="text-sm font-bold">{c.name}</div>
                <Meter value={used} max={limit} color={c.color} className="mt-2" showRemaining />
                {exhausted && <div className="text-[10px] text-primary-red font-bold mt-1.5">Limit reached</div>}
              </Tile>
            );
          })}
        </div>
      </Sheet>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Confirm Lineup"
        footer={
          <>
            <button onClick={() => setModalOpen(false)}
              className="text-highlight-silver hover:text-pure-white font-bold py-2 px-4 rounded-lg text-sm">Cancel</button>
            <button onClick={() => setModalOpen(false)}
              className="bg-primary-red text-pure-white font-bold py-2 px-5 rounded-lg text-sm">Lock In Picks</button>
          </>
        }>
        <p className="text-sm text-highlight-silver">
          Your lineup can be edited until lights out. After that it is final.
        </p>
      </Modal>

      <Modal isOpen={urgentOpen} onClose={() => setUrgentOpen(false)} urgent size="sm"
        title="Session Expiring" icon={TrophyIcon}
        footer={
          <button onClick={() => setUrgentOpen(false)}
            className="bg-primary-red text-pure-white font-bold py-2 px-5 rounded-lg text-sm">Stay Signed In</button>
        }>
        <p className="text-sm text-highlight-silver">
          You will be signed out in 2:00 unless you continue.
        </p>
      </Modal>

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => setConfirmOpen(false)}
        title="Delete results for this race"
        consequence="This removes every score entered for the Monaco Grand Prix and recalculates the championship. You can enter the results again afterwards."
        confirmLabel="Delete results"
      />

      <ConfirmModal
        isOpen={guardOpen}
        onClose={() => setGuardOpen(false)}
        onConfirm={() => setGuardOpen(false)}
        title="Delete this member's data"
        consequence="This permanently removes Jordan Blake, their picks, and their scores. Their invitation code is released so it can be used again. This cannot be undone."
        confirmLabel="Delete member"
        typedGuard="Jordan Blake"
      />

      <div className="h-16" />
    </PageShell>
  );
};

export default DevUiGallery;
