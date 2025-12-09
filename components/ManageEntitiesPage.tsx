
import React, { useState } from 'react';
import { Driver, Constructor, EntityClass } from '../types.ts';
import { saveLeagueEntities } from '../services/firestoreService.ts';
import { BackIcon } from './icons/BackIcon.tsx';
import { TeamIcon } from './icons/TeamIcon.tsx';
import { DriverIcon } from './icons/DriverIcon.tsx';
import { DRIVERS, CONSTRUCTORS } from '../constants.ts';

interface ManageEntitiesPageProps {
    setAdminSubPage: (page: 'dashboard') => void;
    currentDrivers: Driver[];
    currentConstructors: Constructor[];
    onUpdateEntities: (drivers: Driver[], constructors: Constructor[]) => void;
}

const ManageEntitiesPage: React.FC<ManageEntitiesPageProps> = ({ setAdminSubPage, currentDrivers, currentConstructors, onUpdateEntities }) => {
    const [activeTab, setActiveTab] = useState<'drivers' | 'teams'>('drivers');
    const [drivers, setDrivers] = useState<Driver[]>(currentDrivers);
    const [constructors, setConstructors] = useState<Constructor[]>(currentConstructors);
    const [isSaving, setIsSaving] = useState(false);
    
    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editEntityId, setEditEntityId] = useState<string | null>(null); // Null means adding new
    
    // Form State
    const [formName, setFormName] = useState('');
    const [formId, setFormId] = useState('');
    const [formClass, setFormClass] = useState<EntityClass>(EntityClass.A);
    const [formTeamId, setFormTeamId] = useState('');
    const [formIsActive, setFormIsActive] = useState(true);

    const openModal = (entity?: Driver | Constructor) => {
        if (entity) {
            setEditEntityId(entity.id);
            setFormName(entity.name);
            setFormId(entity.id);
            setFormClass(entity.class);
            setFormIsActive(entity.isActive);
            if (activeTab === 'drivers') {
                setFormTeamId((entity as Driver).constructorId);
            }
        } else {
            setEditEntityId(null);
            setFormName('');
            setFormId('');
            setFormClass(EntityClass.A);
            setFormIsActive(true);
            setFormTeamId(constructors[0]?.id || '');
        }
        setShowModal(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveLeagueEntities(drivers, constructors);
            onUpdateEntities(drivers, constructors);
            alert("Changes saved successfully!");
        } catch (e) {
            console.error(e);
            alert("Failed to save changes.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = async () => {
        if (!window.confirm("WARNING: This will overwrite all Drivers and Teams in the database with the official 2026 Default Roster. Any custom drivers will be lost. Continue?")) {
            return;
        }
        setIsSaving(true);
        try {
            await saveLeagueEntities(DRIVERS, CONSTRUCTORS);
            onUpdateEntities(DRIVERS, CONSTRUCTORS);
            setDrivers(DRIVERS);
            setConstructors(CONSTRUCTORS);
            alert("Roster reset to official 2026 defaults!");
        } catch (e) {
            console.error(e);
            alert("Failed to reset roster.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (activeTab === 'drivers') {
            const newDriver: Driver = {
                id: editEntityId || formId.toLowerCase().replace(/\s+/g, '_'),
                name: formName,
                class: formClass,
                constructorId: formTeamId,
                isActive: formIsActive
            };
            
            setDrivers(prev => {
                if (editEntityId) return prev.map(d => d.id === editEntityId ? newDriver : d);
                return [...prev, newDriver];
            });
        } else {
             const newConstructor: Constructor = {
                id: editEntityId || formId.toLowerCase().replace(/\s+/g, '_'),
                name: formName,
                class: formClass,
                isActive: formIsActive
            };
             setConstructors(prev => {
                if (editEntityId) return prev.map(c => c.id === editEntityId ? newConstructor : c);
                return [...prev, newConstructor];
            });
        }
        setShowModal(false);
    };

    const toggleActive = (id: string, type: 'drivers' | 'teams') => {
        if (type === 'drivers') {
            setDrivers(prev => prev.map(d => d.id === id ? { ...d, isActive: !d.isActive } : d));
        } else {
            setConstructors(prev => prev.map(c => c.id === id ? { ...c, isActive: !c.isActive } : c));
        }
    };

    return (
        <div className="max-w-6xl mx-auto text-pure-white">
            <div className="flex items-center justify-between mb-8">
                 <button 
                    onClick={() => setAdminSubPage('dashboard')}
                    className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors"
                >
                    <BackIcon className="w-5 h-5" />
                    Back
                </button>
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleReset}
                        disabled={isSaving}
                        className="bg-accent-gray text-highlight-silver hover:text-pure-white hover:bg-carbon-black border border-accent-gray font-bold py-2 px-4 rounded-lg text-sm disabled:opacity-50"
                        title="Reset database to match source code constants"
                    >
                        Reset to Official 2026 Roster
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-primary-red hover:opacity-90 text-pure-white font-bold py-2 px-6 rounded-lg disabled:opacity-50"
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
            
            <div className="flex gap-4 mb-6 justify-center">
                <button
                    onClick={() => setActiveTab('drivers')}
                    className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-colors ${activeTab === 'drivers' ? 'bg-pure-white text-carbon-black' : 'bg-accent-gray text-highlight-silver'}`}
                >
                    <DriverIcon className="w-5 h-5" /> Drivers
                </button>
                <button
                    onClick={() => setActiveTab('teams')}
                    className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-colors ${activeTab === 'teams' ? 'bg-pure-white text-carbon-black' : 'bg-accent-gray text-highlight-silver'}`}
                >
                    <TeamIcon className="w-5 h-5" /> Teams
                </button>
            </div>

            <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg ring-1 ring-pure-white/10 overflow-hidden">
                <div className="p-4 flex justify-between items-center bg-carbon-black/50">
                    <h2 className="text-xl font-bold">{activeTab === 'drivers' ? 'Driver Roster' : 'Constructor List'}</h2>
                    <button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-500 text-pure-white px-4 py-1.5 rounded text-sm font-bold">
                        + Add New
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-carbon-black/30">
                            <tr>
                                <th className="p-4 text-xs font-bold uppercase text-highlight-silver">Name</th>
                                <th className="p-4 text-xs font-bold uppercase text-highlight-silver">Class</th>
                                {activeTab === 'drivers' && <th className="p-4 text-xs font-bold uppercase text-highlight-silver">Team</th>}
                                <th className="p-4 text-xs font-bold uppercase text-highlight-silver text-center">Active</th>
                                <th className="p-4 text-xs font-bold uppercase text-highlight-silver text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(activeTab === 'drivers' ? drivers : constructors).map((entity) => (
                                <tr key={entity.id} className="border-t border-accent-gray/50 hover:bg-pure-white/5">
                                    <td className="p-4 font-semibold">{entity.name} <span className="text-xs text-highlight-silver block">{entity.id}</span></td>
                                    <td className="p-4">
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${entity.class === EntityClass.A ? 'bg-yellow-600 text-pure-white' : 'bg-blue-900 text-blue-100'}`}>
                                            Class {entity.class}
                                        </span>
                                    </td>
                                    {activeTab === 'drivers' && (
                                        <td className="p-4 text-sm text-highlight-silver">
                                            {constructors.find(c => c.id === (entity as Driver).constructorId)?.name || (entity as Driver).constructorId}
                                        </td>
                                    )}
                                    <td className="p-4 text-center">
                                         <button 
                                            onClick={() => toggleActive(entity.id, activeTab)}
                                            className={`px-3 py-1 rounded-full text-xs font-bold w-20 ${entity.isActive ? 'bg-green-600/80 text-pure-white' : 'bg-red-900/50 text-red-200'}`}
                                         >
                                            {entity.isActive ? 'Active' : 'Inactive'}
                                         </button>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button onClick={() => openModal(entity)} className="text-highlight-silver hover:text-pure-white underline text-sm">Edit</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-carbon-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-accent-gray rounded-lg max-w-md w-full p-6 ring-1 ring-pure-white/20">
                        <h3 className="text-2xl font-bold mb-4">{editEntityId ? 'Edit Entity' : 'Add New Entity'}</h3>
                        <form onSubmit={handleFormSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-highlight-silver mb-1">ID (Unique)</label>
                                <input 
                                    type="text" 
                                    value={formId} 
                                    onChange={e => setFormId(e.target.value)} 
                                    disabled={!!editEntityId}
                                    className="w-full bg-carbon-black border border-accent-gray rounded p-2 text-pure-white disabled:opacity-50"
                                    required 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-highlight-silver mb-1">Display Name</label>
                                <input 
                                    type="text" 
                                    value={formName} 
                                    onChange={e => setFormName(e.target.value)} 
                                    className="w-full bg-carbon-black border border-accent-gray rounded p-2 text-pure-white"
                                    required 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-highlight-silver mb-1">Class</label>
                                <select 
                                    value={formClass} 
                                    onChange={e => setFormClass(e.target.value as EntityClass)} 
                                    className="w-full bg-carbon-black border border-accent-gray rounded p-2 text-pure-white"
                                >
                                    <option value={EntityClass.A}>Class A</option>
                                    <option value={EntityClass.B}>Class B</option>
                                </select>
                            </div>
                            {activeTab === 'drivers' && (
                                <div>
                                    <label className="block text-xs font-bold uppercase text-highlight-silver mb-1">Team</label>
                                    <select 
                                        value={formTeamId} 
                                        onChange={e => setFormTeamId(e.target.value)} 
                                        className="w-full bg-carbon-black border border-accent-gray rounded p-2 text-pure-white"
                                    >
                                        {constructors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            )}
                             <div className="flex items-center gap-2">
                                <input 
                                    type="checkbox" 
                                    id="isActiveCheck"
                                    checked={formIsActive} 
                                    onChange={e => setFormIsActive(e.target.checked)} 
                                    className="w-4 h-4"
                                />
                                <label htmlFor="isActiveCheck" className="text-sm font-bold text-pure-white">Active for Selection</label>
                            </div>

                            <div className="flex justify-end gap-2 mt-6">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-highlight-silver hover:text-pure-white">Cancel</button>
                                <button type="submit" className="bg-primary-red px-6 py-2 rounded text-pure-white font-bold hover:opacity-90">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageEntitiesPage;
