import React from 'react';

interface PlanComponentProps {
  onApprove: () => void;
}

const PlanComponent: React.FC<PlanComponentProps> = ({ onApprove }) => {
  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 md:p-8 max-w-4xl mx-auto ring-1 ring-white/10">
      <h2 className="text-3xl font-bold text-white mb-2">Project Plan &amp; Decisions</h2>
      <p className="text-gray-400 mb-6">Here is the proposed plan and a summary of our design decisions. Please approve to proceed.</p>

      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-semibold text-[#ff8400] mb-3 border-b-2 border-[#ff8400]/50 pb-2">Plan of Attack</h3>
          <ol className="list-decimal list-inside space-y-4 text-gray-300">
            <li>
              <span className="font-bold">Phase 1: Foundation & Core User Flow (This Delivery)</span>
              <ul className="list-disc list-inside ml-6 mt-2 space-y-1 text-gray-400">
                <li><span className="font-semibold text-white">Stack:</span> Building a mobile-first <span className="text-cyan-400">React Web App</span> with TypeScript & Tailwind CSS. The UI is designed to feel native on mobile devices.</li>
                <li><span className="font-semibold text-white">Authentication:</span> Mock Login/Sign-Up screens to establish the user flow.</li>
                <li><span className="font-semibold text-white">Pick Submission:</span> A fully interactive form to make weekly picks, complete with live usage counters and a countdown to the lock-in time. Now includes an event selector for the full 2026 season.</li>
                <li><span className="font-semibold text-white">Data:</span> Using mock data based on your spec to make the app fully functional for demonstration.</li>
              </ul>
            </li>
            <li>
              <span className="font-bold">Phase 2: Data Persistence & History</span>
              <ul className="list-disc list-inside ml-6 mt-2 space-y-1 text-gray-400">
                <li>Integrate with a live Firebase backend for auth and data storage.</li>
                <li>Build screens for users to view their past picks and detailed scoring breakdowns.</li>
              </ul>
            </li>
            <li>
              <span className="font-bold">Phase 3: Leaderboard & Profile</span>
               <ul className="list-disc list-inside ml-6 mt-2 space-y-1 text-gray-400">
                <li>Implement a season leaderboard and a user profile page.</li>
              </ul>
            </li>
          </ol>
        </div>

        <div>
          <h3 className="text-xl font-semibold text-[#94d600] mb-3 border-b-2 border-[#94d600]/50 pb-2">Confirmed Design Decisions</h3>
          <ul className="list-disc list-inside space-y-3 text-gray-300">
            <li><span className="font-semibold text-white">2026 Team Classes:</span> <span className="text-gray-400">Class A is set to McLaren, Ferrari, Red Bull, Mercedes, and Williams. Class B will be all others, including the new Cadillac team.</span></li>
            <li><span className="font-semibold text-white">User Onboarding:</span> <span className="text-gray-400">Sign-up will be open for now. A league code will be implemented in a future phase.</span></li>
            <li><span className="font-semibold text-white">Fastest Lap Picks:</span> <span className="text-gray-400">There will be no usage limits or selection conflicts for the Fastest Lap driver pick.</span></li>
            <li><span className="font-semibold text-white">Season History:</span> <span className="text-gray-400">Past seasons' data will be accessible via an expandable section on the user's profile page.</span></li>
          </ul>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-gray-700/50 flex justify-end">
        <button
          onClick={onApprove}
          className="bg-[#ff8400] hover:bg-orange-500 text-white font-bold py-3 px-8 rounded-lg transition-transform transform hover:scale-105 shadow-lg shadow-orange-500/20"
        >
          Approve Plan & Proceed to App
        </button>
      </div>
    </div>
  );
};

export default PlanComponent;
