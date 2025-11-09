import React, { useState, useEffect } from 'react';
import { Event, EventResult, Driver } from '../types';
import { DRIVERS } from '../constants';

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
        <form onSubmit={handleSubmit} className="space-y-6 text-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ResultGroup
                    title="Grand Prix Qualifying"
                    positions={3}
                    selected={results.gpQualifying}
                    onSelect={(value, index) => handleSelect('gpQualifying', value, index)}
                    options={driverOptions}
                />

                {event.hasSprint && (
                    <ResultGroup
                        title="Sprint Qualifying"
                        positions={3}
                        selected={results.sprintQualifying || []}
                        onSelect={(value, index) => handleSelect('sprintQualifying', value, index)}
                        options={driverOptions}
                    />
                )}
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ResultGroup
                    title="Grand Prix Finish"
                    positions={10}
                    selected={results.grandPrixFinish}
                    onSelect={(value, index) => handleSelect('grandPrixFinish', value, index)}
                    options={driverOptions}
                />
                
                {event.hasSprint && (
                    <ResultGroup
                        title="Sprint Race Finish"
                        positions={8}
                        selected={results.sprintFinish || []}
                        onSelect={(value, index) => handleSelect('sprintFinish', value, index)}
                        options={driverOptions}
                    />
                )}
            </div>

            <div>
                <h3 className="font-semibold mb-2 text-center">Fastest Lap</h3>
                <SelectDriver
                    value={results.fastestLap}
                    onChange={handleFastestLapSelect}
                    options={driverOptions}
                    label="Driver"
                />
            </div>

            <div className="flex justify-end pt-4">
                <button
                    type="submit"
                    className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-6 rounded-lg"
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
    <div className="bg-gray-900/50 p-4 rounded-lg">
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
        <label className="w-10 text-sm font-semibold text-gray-400">{label}</label>
        <select
            value={value || ''}
            onChange={e => onChange(e.target.value || null)}
            className="w-full bg-gray-700/50 border border-gray-600 rounded-md py-1 px-2 text-white focus:outline-none focus:ring-[#ff8400] focus:border-[#ff8400]"
        >
            <option value="">Select Driver...</option>
            {options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    </div>
);


export default ResultsForm;