let fingerprintApi;

const QUALITY_MESSAGES = {
  0: 'Muestra correcta',
  1: 'El lector no recibio imagen',
  2: 'La muestra salio muy clara',
  3: 'La muestra salio muy oscura',
  4: 'La muestra tiene mucho ruido',
  5: 'La muestra tiene bajo contraste',
  6: 'No se detectaron suficientes puntos de huella',
  7: 'El dedo no esta centrado',
  8: 'El lector no detecto un dedo',
  9: 'El dedo esta muy arriba',
  10: 'El dedo esta muy abajo',
  11: 'El dedo esta muy a la izquierda',
  12: 'El dedo esta muy a la derecha',
  19: 'Estas presionando demasiado fuerte',
  20: 'Falta presionar un poco mas el dedo',
  21: 'El dedo podria estar humedo',
  23: 'La superficie de dedo capturada es muy pequena',
  24: 'El dedo esta demasiado girado'
};

function getFingerprintApi() {
  if (!window.Fingerprint?.WebApi) {
    return null;
  }

  if (!fingerprintApi) {
    fingerprintApi = new window.Fingerprint.WebApi();
  }

  return fingerprintApi;
}

export function isDeviceReady() {
  return Boolean(getFingerprintApi());
}

export async function listFingerprintReaders() {
  const api = getFingerprintApi();
  if (!api) {
    return [];
  }

  return api.enumerateDevices();
}

export async function captureFingerprint() {
  const api = getFingerprintApi();
  if (!api) {
    return captureDemoFingerprint();
  }

  const readers = await api.enumerateDevices();
  if (!readers.length) {
    throw new Error('No se detecto el lector Fingerprint 4500. Revisa que este conectado y que DPAgent este iniciado.');
  }

  const readerId = readers[0];
  const format = window.Fingerprint.SampleFormat.Intermediate;

  try {
    await api.stopAcquisition(readerId);
  } catch {
    // Si no habia una captura activa, el SDK puede responder con error. Se ignora.
  }

  return new Promise((resolve, reject) => {
    let finished = false;
    let lastQuality = '';

    const cleanup = async () => {
      try {
        await api.stopAcquisition(readerId);
      } catch {
        // El SDK puede lanzar error si la captura ya fue detenida.
      }

      api.onSamplesAcquired = null;
      api.onQualityReported = null;
      api.onErrorOccurred = null;
      api.onCommunicationFailed = null;
    };

    const timeout = window.setTimeout(async () => {
      if (finished) return;
      finished = true;
      await cleanup();
      reject(new Error(lastQuality || 'Tiempo agotado. Levanta el dedo, vuelve a apoyarlo completo y espera sin moverlo.'));
    }, 45000);

    api.onSamplesAcquired = async (sampleEvent) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);

      try {
        const samples = JSON.parse(sampleEvent.samples);
        const firstSample = samples[0];
        const template = window.Fingerprint.b64UrlTo64(firstSample.Data || firstSample);
        await cleanup();
        resolve(`digitalpersona-intermediate:${template}`);
      } catch (error) {
        await cleanup();
        reject(new Error(`No se pudo procesar la huella: ${error.message}`));
      }
    };

    api.onQualityReported = (qualityEvent) => {
      lastQuality = QUALITY_MESSAGES[qualityEvent.quality]
        || `Calidad de huella no aceptada por el lector. Codigo ${qualityEvent.quality}.`;
    };

    api.onErrorOccurred = async (errorEvent) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      await cleanup();
      reject(new Error(`El lector informo un error durante la captura. Codigo ${errorEvent.error}.`));
    };

    api.onCommunicationFailed = async () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      await cleanup();
      reject(new Error('No hay comunicacion con el servicio DigitalPersona WebSDK.'));
    };

    api.startAcquisition(format, readerId).catch(async (error) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      await cleanup();
      reject(new Error(error.message || 'No se pudo iniciar la captura de huella.'));
    });
  });
}

export async function captureFingerprintSamples(totalSamples = 4, onProgress = () => {}) {
  const samples = [];

  for (let index = 0; index < totalSamples; index += 1) {
    onProgress(index + 1, totalSamples);
    samples.push(await captureFingerprint());
  }

  return samples;
}

function captureDemoFingerprint() {
  const demoValue = window.prompt('Modo demostracion: escribe el codigo de huella del empleado');
  if (!demoValue || demoValue.trim().length < 4) {
    throw new Error('Captura cancelada o huella invalida');
  }

  return `demo-template:${demoValue.trim().toLowerCase()}`;
}
