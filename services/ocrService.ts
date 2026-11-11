import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';

const VISION_ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';

function getVisionApiKey(): string | undefined {
  return process.env.EXPO_PUBLIC_GOOGLE_CLOUD_VISION_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
}

async function toBase64(uri: string): Promise<string> {
  const result = await manipulateAsync(uri, [], {
    compress: 0.85,
    format: SaveFormat.JPEG,
    base64: true,
  });

  if (!result.base64) {
    throw new Error('Could not convert image to base64 for OCR processing.');
  }

  return result.base64;
}

export async function recognizeText(imageUri: string): Promise<string> {
  const apiKey = getVisionApiKey();
  if (!apiKey) {
    throw new Error(
      'Cloud Vision API key is missing. Set EXPO_PUBLIC_GOOGLE_CLOUD_VISION_API_KEY in your environment.'
    );
  }

  const imageBase64 = await toBase64(imageUri);

  const response = await fetch(`${VISION_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          image: { content: imageBase64 },
          features: [{ type: 'TEXT_DETECTION' }],
        },
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const message =
      data?.error?.message ||
      'Cloud Vision API request failed. Ensure the API is enabled and billing is configured.';
    throw new Error(message);
  }

  const visionError = data?.responses?.[0]?.error?.message;
  if (visionError) {
    throw new Error(visionError);
  }

  const text =
    data?.responses?.[0]?.fullTextAnnotation?.text ||
    data?.responses?.[0]?.textAnnotations?.[0]?.description ||
    '';

  return typeof text === 'string' ? text.trim() : '';
}
