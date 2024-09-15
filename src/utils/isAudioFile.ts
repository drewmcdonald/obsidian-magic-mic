const knownAudioFileExtensions = [
	'mp3',
	'mp4',
	'mpeg',
	'mpga',
	'm4a',
	'wav',
	'webm',
	'ogg',
];

export function isAudioFile({ extension }: { extension: string }): boolean {
	return knownAudioFileExtensions.includes(extension.toLowerCase());
}
