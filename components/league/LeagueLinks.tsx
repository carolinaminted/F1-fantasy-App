import React, { useState } from 'react';
import { Tile, SectionHeader, NUMERIC } from '../ui/index.ts';
import { DonationIcon } from '../icons/DonationIcon.tsx';
import { DONATION_VENMO_URL } from '../../constants.ts';

const SUPPORT_EMAIL = 'lightsoutleague2026@gmail.com';
const FEEDBACK_FORM_URL = 'https://forms.gle/zVmBrPATMqtFhRCb7';
const VICTORY_JUNCTION_URL = 'https://victoryjunction.org/donate-online/';

const LifebuoyIcon: React.FC<React.SVGProps<SVGSVGElement>> = props => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
       strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round"
          d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.82 1.508-2.316a7.5 7.5 0 1 0-7.516 0c.85.496 1.508 1.333 1.508 2.316v.192m6 3a46.236 46.236 0 0 1-1.5 0m-3 0a46.236 46.236 0 0 0-1.5 0" />
  </svg>
);

const ACTION_CLASS =
  'mt-3 inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-[11px] font-black uppercase tracking-wider transition-colors';

const LinkCard: React.FC<{
  title: string;
  body: string;
  children: React.ReactNode;
}> = ({ title, body, children }) => (
  <Tile padding="md" className="flex flex-col justify-between">
    <div>
      <h3 className="text-sm font-black uppercase italic tracking-wide text-pure-white">{title}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-highlight-silver">{body}</p>
    </div>
    {children}
  </Tile>
);

/**
 * Donate and Support, which used to be two routes of two tiles each. Both are really just
 * four outbound actions, so they are four cards — no navigation, nothing behind a menu.
 */
export const LeagueLinks: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const copyEmail = () => {
    navigator.clipboard.writeText(SUPPORT_EMAIL).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 2000); },
      () => { setCopied(false); }
    );
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
      <div>
        <SectionHeader
          title="Give Back"
          subtitle="The league's two donation destinations"
          icon={DonationIcon}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <LinkCard
            title="Victory Junction"
            body="Give kids with complex medical needs the chance to experience camp adventures like zip lining, archery, and fishing in a safe, barrier-free environment."
          >
            <a
              href={VICTORY_JUNCTION_URL} target="_blank" rel="noopener noreferrer"
              className={`${ACTION_CLASS} bg-primary-red text-pure-white hover:bg-red-600`}
            >
              Donate Now
            </a>
          </LinkCard>

          <LinkCard
            title="League Operations"
            body="Covers cloud hosting, the domain, and everything that keeps the platform running for the season."
          >
            <a
              href={DONATION_VENMO_URL} target="_blank" rel="noopener noreferrer"
              className={`${ACTION_CLASS} bg-[#008CFF] text-pure-white hover:opacity-90`}
            >
              Donate via Venmo
            </a>
          </LinkCard>
        </div>
      </div>

      <div>
        <SectionHeader
          title="Get Help"
          subtitle="Feedback, questions, and feature requests"
          icon={LifebuoyIcon}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <LinkCard
            title="Feedback & Requests"
            body="General site feedback, plus anything you would like the league platform to do next season."
          >
            <a
              href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer"
              className={`${ACTION_CLASS} bg-pure-white/5 border border-pure-white/10 text-pure-white hover:bg-pure-white/10`}
            >
              Open the Form
            </a>
          </LinkCard>

          <LinkCard
            title="Questions & Concerns"
            body="Direct questions, account issues, or anything that needs a human. Tap to copy the address."
          >
            <button
              onClick={copyEmail}
              className={`${ACTION_CLASS} bg-pure-white/5 border border-pure-white/10 text-pure-white hover:bg-pure-white/10 ${NUMERIC} break-all normal-case tracking-normal`}
            >
              {copied ? '✓ Copied' : SUPPORT_EMAIL}
            </button>
          </LinkCard>
        </div>
      </div>
    </div>
  );
};
