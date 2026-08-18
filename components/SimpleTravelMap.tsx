'use client';

import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { useState, useMemo, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { ChevronUp, ChevronDown, X } from 'lucide-react';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const continentColors = {
  asia: { primary: '#EF4444', glow: 'rgba(239, 68, 68, 0.6)', fill: 'rgba(239, 68, 68, 0.2)', fillDark: 'rgba(239, 68, 68, 0.35)' },
  europe: { primary: '#F59E0B', glow: 'rgba(245, 158, 11, 0.6)', fill: 'rgba(245, 158, 11, 0.2)', fillDark: 'rgba(245, 158, 11, 0.35)' },
  americas: { primary: '#A855F7', glow: 'rgba(168, 85, 247, 0.6)', fill: 'rgba(168, 85, 247, 0.2)', fillDark: 'rgba(168, 85, 247, 0.35)' },
  oceania: { primary: '#22C55E', glow: 'rgba(34, 197, 94, 0.6)', fill: 'rgba(34, 197, 94, 0.2)', fillDark: 'rgba(34, 197, 94, 0.35)' },
};

// Map our country names to ISO 3166 numeric codes used in world-atlas
const visitedCountryMap: Record<string, { code: string; continent: keyof typeof continentColors }> = {
  'Portugal': { code: '620', continent: 'europe' },
  'Spain': { code: '724', continent: 'europe' },
  'France': { code: '250', continent: 'europe' },
  'Netherlands': { code: '528', continent: 'europe' },
  'Germany': { code: '276', continent: 'europe' },
  'Czechia': { code: '203', continent: 'europe' },
  'Austria': { code: '040', continent: 'europe' },
  'Japan': { code: '392', continent: 'asia' },
  'South Korea': { code: '410', continent: 'asia' },
  'United States': { code: '840', continent: 'americas' },
  'New Zealand': { code: '554', continent: 'oceania' },
};

const visitedCountryCodes = new Set(Object.values(visitedCountryMap).map(v => v.code));
const codeToContinent: Record<string, keyof typeof continentColors> = {};
Object.values(visitedCountryMap).forEach(v => { codeToContinent[v.code] = v.continent; });

interface Location {
  name: string;
  lat: number;
  lng: number;
  continent: keyof typeof continentColors;
  isHome?: boolean;
  country?: string;
}

const locations: Location[] = [
  // Europe — the night-train tour
  { name: 'Lisbon', lat: 38.7223, lng: -9.1393, continent: 'europe', isHome: true, country: 'Portugal' },
  { name: 'Porto', lat: 41.1579, lng: -8.6291, continent: 'europe', country: 'Portugal' },
  { name: 'Madrid', lat: 40.4168, lng: -3.7038, continent: 'europe', country: 'Spain' },
  { name: 'Barcelona', lat: 41.3874, lng: 2.1686, continent: 'europe', country: 'Spain' },
  { name: 'Paris', lat: 48.8566, lng: 2.3522, continent: 'europe', country: 'France' },
  { name: 'Amsterdam', lat: 52.3676, lng: 4.9041, continent: 'europe', country: 'Netherlands' },
  { name: 'Berlin', lat: 52.52, lng: 13.405, continent: 'europe', country: 'Germany' },
  { name: 'Prague', lat: 50.0755, lng: 14.4378, continent: 'europe', country: 'Czechia' },
  { name: 'Vienna', lat: 48.2082, lng: 16.3738, continent: 'europe', country: 'Austria' },
  // Farther afield
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503, continent: 'asia', country: 'Japan' },
  { name: 'Seoul', lat: 37.5665, lng: 126.978, continent: 'asia', country: 'South Korea' },
  { name: 'New York', lat: 40.7128, lng: -74.006, continent: 'americas', country: 'United States' },
  { name: 'Auckland', lat: -36.8485, lng: 174.7633, continent: 'oceania', country: 'New Zealand' },
];

function SimpleMarker({ location, isSelected, onClick, onMouseEnter, onMouseLeave, zoom = 1 }: { 
  location: Location; 
  isSelected: boolean; 
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  zoom?: number;
}) {
  const color = continentColors[location.continent];
  const isHome = location.isHome;
  const s = 1 / zoom; // scale factor: markers shrink as map zooms in
  // Minimum visible sizes to stay visible but not oversized on mobile
  const baseRadius = Math.max(isHome ? 8 * s : 3.5 * s, isHome ? 1.8 : 0.8);
  const selectedRadius = Math.max(isHome ? 10 * s : 6 * s, isHome ? 2.2 : 1.5);
  const pulseRadius = Math.max((isHome ? 16 : 12) * s, 2.5);
  const strokeW = Math.max(0.2, 2 * s);

  // Invisible hit area: ensure tappable on mobile
  const hitRadius = Math.max(isSelected ? selectedRadius : baseRadius, 2);

  return (
    <g 
      onClick={onClick} 
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ cursor: 'pointer' }}
    >
      {/* Invisible hit area for easier clicking */}
      <circle r={hitRadius} fill="transparent" />
      {isSelected && (
        <circle
          r={pulseRadius}
          fill="none"
          stroke={color.primary}
          strokeWidth={Math.max(0.3, 1 * s)}
          opacity={0.3}
          style={{ animation: 'pulse 2s infinite' }}
        />
      )}
      <circle
        r={isSelected ? selectedRadius : baseRadius}
        fill={isHome ? '#F59E0B' : color.primary}
        stroke="white"
        strokeWidth={strokeW}
        style={{
          filter: `drop-shadow(0 0 ${(isSelected ? 12 : 6) * s}px ${color.glow})`,
          transition: 'r 0.3s ease',
        }}
      />
    </g>
  );
}

// Group locations by country, sorted north to south by average latitude
function getCountriesSorted(locs: Location[]) {
  const grouped: Record<string, Location[]> = {};
  locs.forEach(loc => {
    const key = loc.country || loc.name;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(loc);
  });
  return Object.entries(grouped)
    .map(([country, cities]) => ({
      country,
      cities,
      avgLat: cities.reduce((s, c) => s + c.lat, 0) / cities.length,
      avgLng: cities.reduce((s, c) => s + c.lng, 0) / cities.length,
    }))
    .sort((a, b) => b.avgLat - a.avgLat); // north to south
}

export default function SimpleTravelMap() {
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [hoveredLocation, setHoveredLocation] = useState<Location | null>(null);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [countryIndex, setCountryIndex] = useState<number | null>(null);
  // Separate map view state from info panel state
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [mapZoom, setMapZoom] = useState(1);

  const { theme, mounted } = useTheme();

  const countries = useMemo(() => getCountriesSorted(locations), []);

  if (!mounted) return null;

  const isDark = theme === 'dark';

  const currentCountry = countryIndex !== null ? countries[countryIndex] : null;

  const handleCountryNav = (dir: 'up' | 'down') => {
    const newIndex = countryIndex === null
      ? (dir === 'down' ? 0 : countries.length - 1)
      : dir === 'down'
        ? (countryIndex + 1) % countries.length
        : (countryIndex - 1 + countries.length) % countries.length;
    const c = countries[newIndex];
    setCountryIndex(newIndex);
    setSelectedLocation(null);
    setHoveredLocation(null); // ← key: clear the hover state so the info panel stops showing a city name
    setMapCenter([c.avgLng, c.avgLat]);
    setMapZoom(10);
    setCurrentZoom(10);
  };

  const handleResetNav = () => {
    setCountryIndex(null);
    setSelectedLocation(null);
    setHoveredLocation(null);
    setMapCenter(null);
    setMapZoom(1);
    setCurrentZoom(1);
  };

  return (
    <div className="relative w-full h-full">
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 0.2; transform: scale(1.3); }
        }
      `}</style>
      
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 120,
          center: [0, 20],
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <ZoomableGroup 
          key={mapCenter ? `${mapCenter[0]}-${mapCenter[1]}` : 'global'}
          center={mapCenter ?? [0, 20]} 
          zoom={mapZoom}
          minZoom={1}
          maxZoom={20}
          onMoveEnd={({ zoom }: { zoom: number }) => setCurrentZoom(zoom)}
        >
          <defs>
            <linearGradient id="simpleLandGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={isDark ? '#1c1c1f' : '#F8FAFC'} />
              <stop offset="100%" stopColor={isDark ? '#27272a' : '#F1F5F9'} />
            </linearGradient>
          </defs>

          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const countryId = geo.id;
                const isVisited = visitedCountryCodes.has(countryId);
                const continent = codeToContinent[countryId];
                const color = continent ? continentColors[continent] : null;
                
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={isVisited && color 
                      ? (isDark ? color.fillDark : color.fill)
                      : 'url(#simpleLandGradient)'
                    }
                    stroke={isVisited && color 
                      ? color.primary 
                      : (isDark ? '#52525b' : '#E2E8F0')
                    }
                    strokeWidth={isVisited ? 1.2 : 0.5}
                    style={{
                      default: { outline: 'none' },
                      hover: { 
                        outline: 'none', 
                        fill: isVisited && color 
                          ? (isDark ? color.glow : color.fill)
                          : (isDark ? '#52525b' : '#E2E8F0'),
                      },
                      pressed: { outline: 'none' },
                    }}
                  />
                );
              })
            }
          </Geographies>

          {locations.map((loc, idx) => (
            <Marker key={idx} coordinates={[loc.lng, loc.lat]}>
              <SimpleMarker
                location={loc}
                isSelected={selectedLocation?.name === loc.name || hoveredLocation?.name === loc.name}
                onClick={() => { setSelectedLocation(loc); setCountryIndex(null); setMapCenter([loc.lng, loc.lat]); setMapZoom(10); setCurrentZoom(10); }}
                onMouseEnter={() => setHoveredLocation(loc)}
                onMouseLeave={() => setHoveredLocation(null)}
                zoom={currentZoom}
              />
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>

      {/* Country navigation buttons */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-10">
        <button
          onClick={() => handleCountryNav('up')}
          className={`p-2 rounded-xl backdrop-blur-xl border shadow-lg transition-all active:scale-95 ${
            isDark 
              ? 'bg-zinc-800/90 border-zinc-700 text-zinc-300 hover:text-white' 
              : 'bg-white/90 border-zinc-200 text-zinc-500 hover:text-zinc-900'
          }`}
          title="Previous country"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        {countryIndex !== null && (
          <button
            onClick={handleResetNav}
            className={`p-2 rounded-xl backdrop-blur-xl border shadow-lg transition-all active:scale-95 ${
              isDark 
                ? 'bg-zinc-800/90 border-zinc-700 text-zinc-400 hover:text-white' 
                : 'bg-white/90 border-zinc-200 text-zinc-400 hover:text-zinc-900'
            }`}
            title="Back to overview"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => handleCountryNav('down')}
          className={`p-2 rounded-xl backdrop-blur-xl border shadow-lg transition-all active:scale-95 ${
            isDark 
              ? 'bg-zinc-800/90 border-zinc-700 text-zinc-300 hover:text-white' 
              : 'bg-white/90 border-zinc-200 text-zinc-500 hover:text-zinc-900'
          }`}
          title="Next country"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Info panel */}
      <div className="absolute bottom-3 left-3 right-3 pointer-events-none">
        <div className={`backdrop-blur-xl rounded-xl px-4 py-2 text-center ${
          isDark 
            ? 'bg-zinc-900/90 border border-zinc-700' 
            : 'bg-white/90 border border-zinc-200'
        }`}>
          {hoveredLocation ? (
            <>
              <div className={`font-bold text-sm ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                {hoveredLocation.name}
              </div>
              <div className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                {hoveredLocation.country}
              </div>
            </>
          ) : currentCountry ? (
            <>
              <div className={`font-bold text-sm ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                {currentCountry.country}
              </div>
              <div className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                {currentCountry.cities.map(c => c.name).join(' · ')}
              </div>
              <div className={`text-[10px] mt-0.5 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                {(countryIndex ?? 0) + 1} / {countries.length}
              </div>
            </>
          ) : selectedLocation ? (
            <>
              <div className={`font-bold text-sm ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                {selectedLocation.name}
              </div>
              <div className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                {selectedLocation.country}
              </div>
            </>
          ) : (
            <div className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
              {locations.length} cities · {new Set(locations.map(l => l.country)).size} countries · {Object.keys(continentColors).filter(c => locations.some(l => l.continent === c)).length} continents
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
