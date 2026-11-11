import React from 'react';
import { View, StyleSheet } from 'react-native';
import GoogleMapReact from 'google-map-react';
import { CHENNAI_PHARMACIES, CHENNAI_CENTER } from '../constants/pharmacies';
import { Colors } from '../constants/theme';

// Marker component for web
const MapMarker = ({ text, lat, lng }: { text: string; lat: number; lng: number }) => {
  const handleClick = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    window.open(url, '_blank');
  };

  return (
    <div
      style={{
        position: 'absolute',
        transform: 'translate(-50%, -100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'pointer',
      }}
      onClick={handleClick}
    >
      <div
        style={{
          color: Colors.primary,
          backgroundColor: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 'bold',
          marginBottom: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      >
        {text}
      </div>
      <div style={{ color: Colors.primary, fontSize: '24px' }}>📍</div>
    </div>
  );
};

interface ChennaiMapProps {
  selectedPharmacy?: string;
}

const ChennaiMap: React.FC<ChennaiMapProps> = ({ selectedPharmacy }) => {
  return (
    <View style={styles.container}>
      <GoogleMapReact
        bootstrapURLKeys={{ key: '' }}
        defaultCenter={{ lat: CHENNAI_CENTER.latitude, lng: CHENNAI_CENTER.longitude }}
        defaultZoom={12}
        options={{
          fullscreenControl: false,
          zoomControl: false,
        }}
      >
        {CHENNAI_PHARMACIES.map((pharmacy) => (
          <MapMarker
            key={pharmacy.id}
            lat={pharmacy.coordinates.latitude}
            lng={pharmacy.coordinates.longitude}
            text={pharmacy.name}
          />
        ))}
      </GoogleMapReact>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
});

export default ChennaiMap;
