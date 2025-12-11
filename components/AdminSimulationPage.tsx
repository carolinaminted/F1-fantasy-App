
import React, { useState } from 'react';
import { runSeasonSimulation, SimulationReport } from '../services/simulationService.ts';
import { BackIcon } from './icons/BackIcon.tsx';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { PointsSystem } from '../types.ts';

interface AdminSimulationPageProps {
    setAdminSubPage: (page: 'dashboard') => void;
    pointsSystem: PointsSystem;
}

const AdminSimulationPage: React.FC<AdminSimulationPageProps> = ({ setAdminSubPage, pointsSystem }) => {
    const [report, setReport] = useState<SimulationReport | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [simCount, setSimCount] = useState(10);

    const handleRun = async () => {
        setIsRunning(true);
        setReport(null);
        // Small timeout to allow UI to render "Running" state
        setTimeout(async () => {
            const result = await runSeasonSimulation(simCount, pointsSystem);
            setReport(result);
            setIsRunning(false);
        }, 100);
    };

    return (
        <div className="max-w-4xl mx-auto text-pure-white">
            <div className="flex items-center justify-between mb-8">
                 <button 
                    onClick={() => setAdminSubPage('dashboard')}
                    className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors"
                >
                    <BackIcon className="w-5 h-5" />
                    Back
                </button>
                <h1 className="text-3xl font-bold flex items-center gap-3 text-right">
                    Scoring Simulator <TrophyIcon className="w-8 h-8 text-primary-red"/>
                </h1>
            </div>

            <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-6 ring-1 ring-pure-white/10 mb-8">
                <h2 className="text-xl font-bold mb-4">Run Audit Simulation</h2>
                <p className="text-highlight-silver mb-6">
                    This tool generates mock race results and user picks to stress-test the scoring engine.
                    Use this to verify data integrity before locking in rule changes.
                </p>

                <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1">
                        <label className="block text-xs font-bold uppercase text-highlight-silver mb-1">Seasons to Simulate</label>
                        <select 
                            value={simCount} 
                            onChange={(e) => setSimCount(Number(e.target.value))}
                            className="w-full bg-carbon-black border border-accent-gray rounded-md py-2 px-3 text-pure-white"
                        >
                            <option value={1}>1 Season (Test)</option>
                            <option value={10}>10 Seasons (Validation)</option>
                            <option value={50}>50 Seasons (Stress)</option>
                            <option value={100}>100 Seasons (Full Audit)</option>
                        </select>
                    </div>
                    <button
                        onClick={handleRun}
                        disabled={isRunning}
                        className="bg-primary-red hover:opacity-90 text-pure-white font-bold py-2 px-6 rounded-lg self-end disabled:bg-accent-gray disabled:cursor-wait h-[42px]"
                    >
                        {isRunning ? 'Running Simulation...' : 'Start Simulation'}
                    </button>
                </div>

                {report && (
                    <div className="border-t border-accent-gray pt-6 animate-fade-in">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-carbon-black p-4 rounded-lg text-center">
                                <p className="text-highlight-silver text-xs uppercase">Integrity Score</p>
                                <p className={`text-2xl font-bold ${report.integrityScore === 100 ? 'text-green-500' : 'text-primary-red'}`}>
                                    {report.integrityScore}/100
                                </p>
                            </div>
                             <div className="bg-carbon-black p-4 rounded-lg text-center">
                                <p className="text-highlight-silver text-xs uppercase">Races Processed</p>
                                <p className="text-2xl font-bold text-pure-white">{report.totalRacesSimulated}</p>
                            </div>
                             <div className="bg-carbon-black p-4 rounded-lg text-center">
                                <p className="text-highlight-silver text-xs uppercase">Picks Audited</p>
                                <p className="text-2xl font-bold text-pure-white">{report.totalPicksProcessed}</p>
                            </div>
                             <div className="bg-carbon-black p-4 rounded-lg text-center">
                                <p className="text-highlight-silver text-xs uppercase">Time (ms)</p>
                                <p className="text-2xl font-bold text-pure-white">{report.executionTimeMs.toFixed(0)}</p>
                            </div>
                        </div>

                        <div>
                            <h3 className="font-bold mb-2">Audit Log</h3>
                            <div className="bg-carbon-black p-4 rounded-lg h-48 overflow-y-auto font-mono text-xs">
                                {report.anomalies.length === 0 ? (
                                    <p className="text-green-500">✓ No calculation anomalies detected.</p>
                                ) : (
                                    <ul className="space-y-1 text-primary-red">
                                        {report.anomalies.map((a, i) => <li key={i}>{a}</li>)}
                                    </ul>
                                )}
                                <p className="text-highlight-silver mt-2 border-t border-accent-gray/50 pt-2">
                                    Simulation complete. Logic holds for current static constants.
                                    <br/>
                                    <strong>Recommendation:</strong> Move Driver/Team constants to Firestore to prevent historical data corruption during roster changes.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminSimulationPage;
