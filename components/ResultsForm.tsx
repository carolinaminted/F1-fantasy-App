import React, { useState, useEffect } from 'react';
import { Event, EventResult, Driver } from '../types.ts';
import { DRIVERS } from '../constants.ts';

interface ResultsFormProps {
    event: Event;
    currentResults?: EventResult;
    onSave: (eventId: string, results: EventResult) => void;
}

const emptyResults = (event: Event): EventResult => ({
    grandPrixFinish: Array(10).fill(null),
    gpQualifying: Array(3).fill(null),
    fastestLap: null,
    ...(event.hasSprint && {
        sprintFinish: Array(8).fill(null),
        sprintQualifying: Array(3).fill(null),
    }),
});


const ResultsForm: React.FC<ResultsFormProps> = ({ event, currentResults, onSave }) => {
    const [results, setResults] = useState<EventResult>(currentResults || emptyResults(event));

    useEffect(() => {
        setResults(currentResults || emptyResults(event));
    }, [currentResults, event]);

    const handleSelect = (category: keyof EventResult, value: string | null, index: number) => {
        setResults(prev => {
            const newResults = { ...prev };
            const field = newResults[category];
            if (Array.isArray(field)) {
                const newArray = [...field];
                newArray[index] = value;
                (newResults as any)[category] = newArray;
            }
            return newResults;
        });
    };

    const handleFastestLapSelect = (value: string | null) => {
        setResults(prev => ({ ...prev, fastestLap: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(event.id, results);
    };

    const driverOptions = DRIVERS.map(d => ({ value: d.id, label: d.name }));

    return (
        <form onSubmit={handleSubmit} className="space-y-6 text-pure-white">
            <div className="bg-carbon-black/50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2 text-center text-lg">Fastest Lap</h3>
                <SelectDriver
                    value={results.fastestLap}
                    onChange={handleFastestLapSelect}
                    options={driverOptions}
                    label="Driver"
                />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Grand Prix Events */}
                <div className="space-y-6">
                    <ResultGroup
                        title="Grand Prix Qualifying"
                        positions={3}
                        selected={results.gpQualifying}
                        onSelect={(value, index) => handleSelect('gpQualifying', value, index)}
                        options={driverOptions}
                    />
                    <ResultGroup
                        title="Grand Prix Finish"
                        positions={10}
                        selected={results.grandPrixFinish}
                        onSelect={(value, index) => handleSelect('grandPrixFinish', value, index)}
                        options={driverOptions}
                    />
                </div>

                {/* Right Column: Sprint Events */}
                <div className="space-y-6">
                    {event.hasSprint ? (
                        <>
                            <ResultGroup
                                title="Sprint Qualifying"
                                positions={3}
                                selected={results.sprintQualifying || []}
                                onSelect={(value, index) => handleSelect('sprintQualifying', value, index)}
                                options={driverOptions}
                            />
                             <ResultGroup
                                title="Sprint Race Finish"
                                positions={8}
                                selected={results.sprintFinish || []}
                                onSelect={(value, index) => handleSelect('sprintFinish', value, index)}
                                options={driverOptions}
                            />
                        </>
                    ) : (
                        <div className="bg-carbon-black/50 p-4 rounded-lg h-full flex items-center justify-center">
                            <p className="text-highlight-silver text-center">No Sprint event for this race weekend.</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-end pt-4">
                <button
                    type="submit"
                    className="bg-primary-red hover:opacity-90 text-pure-white font-bold py-2 px-6 rounded-lg"
                >
                    Save Results
                </button>
            </div>
        </form>
    );
};

interface ResultGroupProps {
    title: string;
    positions: number;
    selected: (string | null)[];
    onSelect: (value: string | null, index: number) => void;
    options: { value: string; label: string }[];
}

const ResultGroup: React.FC<ResultGroupProps> = ({ title, positions, selected, onSelect, options }) => (
    <div className="bg-carbon-black/50 p-4 rounded-lg h-min">
        <h3 className="font-semibold mb-3 text-lg text-center">{title}</h3>
        <div className="space-y-2">
            {Array.from({ length: positions }).map((_, i) => (
                <SelectDriver
                    key={i}
                    value={selected[i]}
                    onChange={(val) => onSelect(val, i)}
                    options={options}
                    label={`P${i + 1}`}
                />
            ))}
        </div>
    </div>
);

interface SelectDriverProps {
    value: string | null;
    onChange: (value: string | null) => void;
    options: { value: string; label: string }[];
    label: string;
}

const SelectDriver: React.FC<SelectDriverProps> = ({ value, onChange, options, label }) => (
    <div className="flex items-center gap-2">
        <label className="w-10 text-sm font-semibold text-highlight-silver">{label}</label>
        <select
            value={value || ''}
            onChange={e => onChange(e.target.value || null)}
            className="w-full bg-accent-gray/80 border border-accent-gray rounded-md py-1 px-2 text-pure-white focus:outline-none focus:ring-primary-red focus:border-primary-red"
        >
            <option value="">Select Driver...</option>
            {options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    </div>
);


export default ResultsForm;