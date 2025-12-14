
import React from 'react';

const CIRCUIT_PATHS: { [key: string]: string } = {
    // Bahrain (Sakhir)
    'bhr': 'M38,12 L38,18 L46,18 L46,38 L30,38 L25,30 L10,35 L4,28 L10,20 L20,25 L30,15 Z',
    // Saudi Arabia (Jeddah)
    'sau': 'M40,10 C45,10 45,15 40,15 C35,15 35,20 30,25 C25,30 20,35 15,40 C10,45 5,40 10,35 C15,30 20,25 25,20 C30,15 30,10 35,10 Z', 
    // Australia (Albert Park) - Updated Design
    'aus': 'M32,42 L18,42 C12,42 10,38 8,32 C7,28 10,26 14,26 L16,26 C18,26 18,22 20,18 L22,15 C25,10 38,10 42,15 L44,18 C46,22 46,28 42,32 L40,34 C36,36 36,42 32,42 Z',
    // China (Shanghai)
    'chn': 'M30,10 C40,10 45,20 35,25 L15,25 L10,35 L40,35 L45,45 L5,45 L5,30 C5,20 15,10 30,10 Z',
    // Japan (Suzuka) - Figure 8
    'jpn': 'M36,42 L42,42 C46,42 48,36 44,32 S38,34 34,30 S30,24 28,20 C26,14 32,12 34,16 L28,26 L22,30 C18,32 18,26 22,26 L14,24 C6,22 4,36 16,32 L38,20 C44,16 46,28 42,34 L40,36 L42,38 C42,41 38,42 36,42 Z',
    // Miami
    'mia': 'M10,10 L40,10 L45,20 L40,40 L25,45 L10,35 L5,20 Z',
    // Canada (Montreal)
    'can': 'M10,15 L40,15 L45,25 L40,35 L10,35 L5,25 Z M35,35 L35,40',
    // Monaco
    'mco': 'M20,10 L35,10 L40,20 L35,30 L45,35 L40,45 L10,40 L5,20 L15,15 Z',
    // Spain (Barcelona)
    'esp': 'M10,10 L40,10 L45,20 L35,40 L10,40 L5,25 Z',
    // Austria (Red Bull Ring)
    'aut': 'M10,35 L20,10 L40,10 L45,25 L35,40 L15,40 Z',
    // Great Britain (Silverstone)
    'gbr': 'M20,10 L35,5 L45,15 L40,30 L35,45 L15,45 L5,30 L10,15 Z',
    // Belgium (Spa) - The Gun
    'bel': 'M15,40 L5,25 L15,10 L30,5 L45,15 L40,30 L25,35 Z',
    // Hungary (Hungaroring)
    'hun': 'M10,15 L40,15 L45,25 L35,40 L15,40 L5,30 Z',
    // Netherlands (Zandvoort)
    'nld': 'M15,10 L35,10 C45,10 45,25 35,30 L20,35 L15,45 L5,35 L10,20 Z',
    // Italy (Monza) - The Boot/Pistol
    'ita': 'M10,35 L15,10 L35,5 L45,15 L40,40 L20,40 Z',
    // Madrid (IFEMA) - Speculative/Rough
    'mad': 'M10,15 L40,15 L45,30 L35,45 L15,45 L5,30 Z',
    // Azerbaijan (Baku) - Key shape
    'aze': 'M10,30 L10,15 L30,15 L35,5 L45,15 L40,40 L15,40 Z',
    // Singapore (Marina Bay)
    'sgp': 'M10,15 L40,15 L45,25 L35,45 L15,45 L5,25 Z',
    // USA (COTA)
    'usa': 'M15,40 L5,20 L15,10 L40,15 L45,30 L30,35 L25,30 L20,35 Z',
    // Mexico (Mexico City)
    'mex': 'M15,10 L40,10 L45,20 L35,40 L15,40 L5,25 Z',
    // Brazil (Interlagos)
    'bra': 'M30,10 L40,20 L35,40 L15,40 L5,25 L10,15 L20,25 Z',
    // Las Vegas - The Pig
    'las': 'M10,10 L40,10 L40,35 L30,45 L20,35 L10,35 Z',
    // Qatar (Lusail)
    'qat': 'M15,10 L35,10 L45,25 L35,40 L15,40 L5,25 Z',
    // Abu Dhabi (Yas Marina)
    'abu': 'M10,35 L10,15 L25,10 L45,15 L45,30 L35,40 L25,35 Z',
};

// Generic Fallback
const DEFAULT_PATH = 'M16.5,3C18.5,3 19.5,4.5 19.5,6V16.5C19.5,18.5 18,19.5 16,19.5H8C6,19.5 4.5,18 4.5,16V13.5C4.5,12.5 5,12 6,12H9.5C10.3,12 11,11.3 11,10.5C11,9.7 10.3,9 9.5,9H6.5C5,9 4.5,8 4.5,7C4.5,5 6,3.5 8,3.5H16.5M16.5,5H8.5C7.5,5 6.5,5.5 6.5,6.5C6.5,7 7,7.5 7.5,7.5H9.5C11.2,7.5 12.5,8.8 12.5,10.5C12.5,12.2 11.2,13.5 9.5,13.5H6.5V16C6.5,17 7,17.5 7.5,17.5H16C17,17.5 17.5,17 17.5,16V6C17.5,5 17,5 16.5,5Z';

interface CircuitRouteProps extends React.SVGProps<SVGSVGElement> {
    eventId: string;
}

export const CircuitRoute: React.FC<CircuitRouteProps> = ({ eventId, ...props }) => {
    // Extract the circuit code (e.g., 'bhr' from 'bhr_26')
    const circuitCode = eventId.split('_')[0];
    
    const pathData = CIRCUIT_PATHS[circuitCode] || null;

    if (!pathData) {
        // Render generic track icon path scaled to fit 50x50 viewBox if needed
        return (
            <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
                <path d={DEFAULT_PATH} />
            </svg>
        );
    }

    return (
        <svg
            viewBox="0 0 50 50"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <path d={pathData} />
        </svg>
    );
};
