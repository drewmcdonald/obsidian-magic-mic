const supportedMimeTypes = [
	'audio/webm; codecs=opus',
	'audio/webm',
	'audio/ogg',
] as const;

export type SupportedMimeType = (typeof supportedMimeTypes)[number];

const _mimeTypeToFileExtension: Record<SupportedMimeType, string> = {
	'audio/webm; codecs=opus': 'webm',
	'audio/webm': 'webm',
	'audio/ogg': 'ogg',
};

export function pickMimeType(preferred: SupportedMimeType) {
	if (MediaRecorder.isTypeSupported(preferred)) {
		return preferred;
	}
	for (const mimeType of supportedMimeTypes) {
		if (MediaRecorder.isTypeSupported(mimeType)) {
			return mimeType;
		}
	}
	throw new Error('No supported mime types found');
}

export function mimeTypeToFileExtension(mimeType: SupportedMimeType) {
	return _mimeTypeToFileExtension[mimeType];
}
