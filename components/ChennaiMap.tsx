import React from 'react';
import { View, StyleSheet, Linking, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { CHENNAI_PHARMACIES } from '../constants/pharmacies';
import { Colors } from '../constants/theme';

interface ChennaiMapProps {
  selectedPharmacy?: string;
}

const ChennaiMap: React.FC<ChennaiMapProps> = ({ selectedPharmacy }) => {
  const openMapsWithDirections = (latitude: number, longitude: number) => {
    let url = '';

    if (Platform.OS === 'ios') {
      url = `maps:?ll=${latitude},${longitude}`;
    } else {
      url = `google.navigation:q=${latitude},${longitude}`;
    }

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        }
        const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
        return Linking.openURL(webUrl);
      })
      .catch((error) => console.error('Error opening maps:', error));
  };

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: 13.0827,
          longitude: 80.2707,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      >
        {CHENNAI_PHARMACIES.map((pharmacy) => (
          <Marker
            key={pharmacy.id}
            coordinate={pharmacy.coordinates}
            title={pharmacy.name}
            description={pharmacy.address}
            pinColor={Colors.primary}
            onPress={() =>
              openMapsWithDirections(
                pharmacy.coordinates.latitude,
                pharmacy.coordinates.longitude
              )
            }
          />
        ))}
      </MapView>
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
  map: {
    width: '100%',
    height: '100%',
  },
});

export default ChennaiMap;