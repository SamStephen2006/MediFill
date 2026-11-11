// Single source of truth for pharmacy data
// Used by both the pharmacy screen and the map component

export interface Pharmacy {
  id: string;
  name: string;
  address: string;
  distance: string;
  rating: number;
  hours: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  phone?: string;
  is24Hours?: boolean;
}

export const CHENNAI_CENTER = {
  latitude: 13.0827,
  longitude: 80.2707,
};

export const CHENNAI_PHARMACIES: Pharmacy[] = [
  {
    id: '1',
    name: 'Apollo Pharmacy',
    address: '23 Mount Road, Chennai',
    distance: '0.5 km',
    rating: 4.5,
    hours: '8:00 AM - 10:00 PM',
    coordinates: { latitude: 13.0827, longitude: 80.2707 },
    phone: '+91-44-28192000',
    is24Hours: false,
  },
  {
    id: '2',
    name: 'MedPlus Pharmacy',
    address: '45 Anna Nagar, Chennai',
    distance: '1.2 km',
    rating: 4.2,
    hours: '9:00 AM - 9:00 PM',
    coordinates: { latitude: 13.0850, longitude: 80.2750 },
    phone: '+91-44-26281234',
    is24Hours: false,
  },
  {
    id: '3',
    name: 'Netmeds Pharmacy',
    address: '78 T Nagar, Chennai',
    distance: '2.0 km',
    rating: 4.7,
    hours: '24 hours',
    coordinates: { latitude: 13.0810, longitude: 80.2680 },
    phone: '+91-44-24343456',
    is24Hours: true,
  },
  {
    id: '4',
    name: 'Wellness Forever',
    address: '112 Adyar, Chennai',
    distance: '3.5 km',
    rating: 4.3,
    hours: '8:00 AM - 11:00 PM',
    coordinates: { latitude: 13.0060, longitude: 80.2545 },
    phone: '+91-44-24461234',
    is24Hours: false,
  },
  {
    id: '5',
    name: 'Guardian Pharmacy',
    address: '56 Mylapore, Chennai',
    distance: '2.8 km',
    rating: 4.1,
    hours: '9:00 AM - 10:00 PM',
    coordinates: { latitude: 13.0368, longitude: 80.2676 },
    phone: '+91-44-24985678',
    is24Hours: false,
  },
  {
    id: '6',
    name: 'Medikart Pharmacy',
    address: '89 Velachery, Chennai',
    distance: '5.2 km',
    rating: 4.0,
    hours: '8:30 AM - 9:30 PM',
    coordinates: { latitude: 12.9815, longitude: 80.2180 },
    phone: '+91-44-22592345',
    is24Hours: false,
  },
  {
    id: '7',
    name: 'LifeCare Pharmacy',
    address: '34 Porur, Chennai',
    distance: '7.1 km',
    rating: 4.4,
    hours: '8:00 AM - 10:00 PM',
    coordinates: { latitude: 13.0374, longitude: 80.1575 },
    phone: '+91-44-24761890',
    is24Hours: false,
  },
  {
    id: '8',
    name: 'Health & Glow',
    address: '22 Nungambakkam, Chennai',
    distance: '1.8 km',
    rating: 4.6,
    hours: '9:00 AM - 11:00 PM',
    coordinates: { latitude: 13.0569, longitude: 80.2425 },
    phone: '+91-44-28273456',
    is24Hours: false,
  },
];

// Helper to search pharmacies
export function searchPharmacies(query: string): Pharmacy[] {
  if (!query.trim()) return CHENNAI_PHARMACIES;
  
  const lowerQuery = query.toLowerCase();
  return CHENNAI_PHARMACIES.filter(
    (p) =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.address.toLowerCase().includes(lowerQuery)
  );
}

// Helper to sort by distance (parse the "X.X km" string)
export function sortByDistance(pharmacies: Pharmacy[]): Pharmacy[] {
  return [...pharmacies].sort((a, b) => {
    const distA = parseFloat(a.distance);
    const distB = parseFloat(b.distance);
    return distA - distB;
  });
}

// Helper to sort by rating
export function sortByRating(pharmacies: Pharmacy[]): Pharmacy[] {
  return [...pharmacies].sort((a, b) => b.rating - a.rating);
}

// Helper to get only 24-hour pharmacies
export function get24HourPharmacies(): Pharmacy[] {
  return CHENNAI_PHARMACIES.filter((p) => p.is24Hours);
}
