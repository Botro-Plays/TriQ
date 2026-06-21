interface GeoResult {
  lat: number;
  lng: number;
  accuracy: number;
}

interface GeoError {
  code: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'UNSUPPORTED';
  message: string;
}

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 30000,
};

export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.geolocation;
}

export async function getCurrentLocation(): Promise<GeoResult> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      const err: GeoError = { code: 'UNSUPPORTED', message: 'Geolocation is not supported by this device' };
      reject(err);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        let code: GeoError['code'] = 'POSITION_UNAVAILABLE';
        let message = 'Failed to get location';

        if (err.code === err.PERMISSION_DENIED) {
          code = 'PERMISSION_DENIED';
          message = 'Location permission denied. Please enable location services in your browser settings.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          code = 'POSITION_UNAVAILABLE';
          message = 'Location information is unavailable. Check your GPS or network connection.';
        } else if (err.code === err.TIMEOUT) {
          code = 'TIMEOUT';
          message = 'Location request timed out. Please try again.';
        }

        reject({ code, message } as GeoError);
      },
      GEO_OPTIONS
    );
  });
}

export function watchLocation(
  onUpdate: (result: GeoResult) => void,
  onError?: (err: GeoError) => void
): number | null {
  if (!isGeolocationSupported()) {
    onError?.({ code: 'UNSUPPORTED', message: 'Geolocation is not supported' });
    return null;
  }

  return navigator.geolocation.watchPosition(
    (pos) => {
      onUpdate({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
    },
    (err) => {
      let code: GeoError['code'] = 'POSITION_UNAVAILABLE';
      let message = 'Location tracking error';

      if (err.code === err.PERMISSION_DENIED) {
        code = 'PERMISSION_DENIED';
        message = 'Location permission denied';
      } else if (err.code === err.TIMEOUT) {
        code = 'TIMEOUT';
        message = 'Location request timed out';
      }

      onError?.({ code, message } as GeoError);
    },
    GEO_OPTIONS
  );
}

export function clearWatch(watchId: number | null): void {
  if (watchId !== null && isGeolocationSupported()) {
    navigator.geolocation.clearWatch(watchId);
  }
}

export type { GeoResult, GeoError };
