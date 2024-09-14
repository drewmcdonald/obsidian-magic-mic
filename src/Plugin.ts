import { Menu, Notice, Plugin, TFile, moment, normalizePath } from 'obsidian';
import Settings, { type ISettings, DEFAULT_SETTINGS } from './Settings';
import OpenAI from 'openai';
import AudioRecorder from './AudioRecorder';
import transcribeAudioFile from './transcribeAudioFile';
import summarizeTranscription, {
	SummarizationResult,
} from './summarizeTranscription';
import { must } from './utils/must';
import { isAudioFile } from './utils/isAudioFile';

export default class MagicMic extends Plugin {
	settings: ISettings;

	private _client?: OpenAI;
	private audioRecorder: AudioRecorder;
	private notice?: Notice;

	async onload() {
		this.audioRecorder = new AudioRecorder();

		await this.loadSettings();
		this.addSettingTab(new Settings(this.app, this));

		if (!this.settings.openaiApiKey) {
			new Notice('Magic Mic: OpenAI API key not set', 0);
			return;
		}

		this.addRibbonIconMenu();
		this.addCommands();
	}

	onunload() {
		this.notice?.hide();
		if (this.audioRecorder.state !== 'inactive') this.audioRecorder.stop();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	addRibbonIconMenu() {
		this.addRibbonIcon('microphone', 'Magic Mic', (event) => {
			const { state } = this.audioRecorder;

			const menu =
				state === 'inactive'
					? this.inactiveMenu()
					: state === 'recording'
						? this.recordingMenu()
						: this.pausedMenu();

			menu.showAtMouseEvent(event);
		});
	}

	addCommands() {
		this.addCommand({
			id: 'start-recording',
			name: 'Start recording',
			icon: 'audio-lines',
			checkCallback: (checking) => {
				if (checking) return this.audioRecorder.state === 'inactive';
				this.startRecording();
			},
		});

		this.addCommand({
			id: 'resume-recording',
			name: 'Resume recording',
			icon: 'audio-lines',
			checkCallback: (checking) => {
				if (checking) return this.audioRecorder.state === 'paused';
				this.resumeRecording();
			},
		});

		this.addCommand({
			id: 'pause-recording',
			name: 'Pause recording',
			icon: 'pause',
			checkCallback: (checking) => {
				if (checking) return this.audioRecorder.state === 'recording';
				this.pauseRecording();
			},
		});

		this.settings.assistants.forEach((assistant) =>
			this.addCommand({
				id: 'finish-recording-' + assistant.name,
				name: `Finish recording (${assistant.name})`,
				icon: 'check',
				checkCallback: (checking) => {
					if (checking) return this.audioRecorder.state !== 'inactive';
					this.fromActiveRecording({ assistantName: assistant.name });
				},
			}),
		);

		this.settings.assistants.forEach((assistant) =>
			this.addCommand({
				id: 'transcribe-and-summarize-' + assistant.name,
				name: `Transcribe and summarize (${assistant.name})`,
				icon: 'scroll-text',
				checkCallback: (checking) => {
					const activeFile = this.app.workspace.getActiveFile();
					if (checking) {
						return (
							this.audioRecorder.state === 'inactive' &&
							!!activeFile &&
							isAudioFile(activeFile)
						);
					}
					this.fromAudioFile({
						audioFile: must(activeFile),
						assistantName: assistant.name,
					});
				},
			}),
		);
	}

	inactiveMenu(): Menu {
		const menu = new Menu();
		menu.addItem((item) =>
			item
				.setTitle('Start recording')
				.setIcon('microphone')
				.onClick(this.startRecording.bind(this)),
		);

		// if current file is an audio file, add a menu item to transcribe it
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile && isAudioFile(activeFile)) {
			this.settings.assistants.forEach(({ name: assistantName }) =>
				menu.addItem((item) =>
					item
						.setTitle(`Transcribe and summarize (${assistantName})`)
						.setIcon('scroll-text')
						.onClick(() =>
							this.fromAudioFile({ audioFile: activeFile, assistantName }),
						),
				),
			);
		}
		return menu;
	}

	addPausedMenuItems(menu: Menu): Menu {
		menu
			.addItem((item) => {
				item
					.setTitle('Resume recording')
					.setIcon('play')
					.onClick(this.resumeRecording.bind(this));
			})
			.addItem((item) => {
				item
					.setTitle('Cancel recording')
					.setIcon('cross')
					.onClick(this.cancelRecording.bind(this));
			})
			.addSeparator();

		this.settings.assistants.forEach(({ name: assistantName }) =>
			menu.addItem((item) =>
				item
					.setTitle(`Finish recording (${assistantName})`)
					.setIcon('stop')
					.onClick(() => this.fromActiveRecording({ assistantName })),
			),
		);
		return menu;
	}

	pausedMenu(): Menu {
		const menu = new Menu();
		return this.addPausedMenuItems(menu);
	}

	recordingMenu(): Menu {
		const menu = new Menu();
		menu.addItem((item) => {
			item
				.setTitle('Pause recording')
				.setIcon('pause')
				.onClick(this.pauseRecording.bind(this));
		});

		return this.addPausedMenuItems(menu);
	}

	get client(): OpenAI {
		return (
			this._client ??
			(this._client = new OpenAI({
				apiKey: this.settings.openaiApiKey,
				dangerouslyAllowBrowser: true,
			}))
		);
	}

	setNotice(message: string) {
		if (this.notice) {
			this.notice.setMessage(message);
		} else {
			this.notice = new Notice(message, 0);
		}
	}

	startRecording() {
		this.audioRecorder.start();
		this.setNotice('Magic Mic: recording 🔴');
	}

	pauseRecording() {
		this.audioRecorder.pause();
		this.notice?.setMessage('Magic Mic: paused ⏸️');
	}

	resumeRecording() {
		this.audioRecorder.resume();
		this.notice?.setMessage('Magic Mic: recording 🔴');
	}

	async cancelRecording() {
		await this.audioRecorder.stop();
		this.notice?.hide();
	}

	async finishRecording() {
		this.notice?.hide();

		const startedAt = must(this.audioRecorder.startedAt);
		const blob = await this.audioRecorder.stop();
		const buffer = await blob.arrayBuffer();

		const audioFile = this.settings.saveAudio
			? await this.app.vault.createBinary(
					await this.resolveAttachmentPath(startedAt),
					buffer,
				)
			: undefined;

		this.audioRecorder = new AudioRecorder(); //reset the recorder
		return { buffer, audioFile, startedAt };
	}

	async transcribeAudio({
		audioFile,
		buffer,
	}: {
		audioFile?: TFile;
		buffer?: ArrayBuffer;
	}): Promise<string> {
		const { transcriptionHint: transcriptionPrompt } = this.settings;

		const audioData =
			buffer ?? (audioFile ? await this.app.vault.readBinary(audioFile) : null);

		if (!audioData)
			throw new Error('Must provide either an audio file or a buffer');

		return transcribeAudioFile(this.client, {
			prompt: transcriptionPrompt,
			audioData,
			extension: this.audioRecorder.fileExtension,
			onChunkStart: (i, total) => {
				let message = 'Magic Mic: transcribing';
				if (total > 1) message += ` ${i + 1}/${total}`;
				this.setNotice(message);
			},
		});
	}

	async summarizeTranscript({
		transcript,
		assistantName,
	}: {
		transcript: string;
		assistantName: string;
	}): Promise<SummarizationResult> {
		const { assistantModel, assistants } = this.settings;
		const assistant = assistants.find((a) => a.name === assistantName);
		if (!assistant)
			throw new Error(
				`Assistant '${assistantName}' not found; available assistants are ` +
					`${assistants.map((a) => a.name).join(', ')}`,
			);

		this.setNotice(`Magic Mic: summarizing`);
		const summary = await summarizeTranscription(this.client, {
			completionModel: assistantModel,
			completionInstructions: assistant?.prompt,
			transcript,
		});

		if (summary.state === 'refused')
			this.setNotice(`Summary refused: ${summary.refusal}`);
		else if (summary.state === 'error')
			this.setNotice(`Summary error: ${summary.error}`);

		return summary;
	}

	private resolveAttachmentPath(date: moment.Moment): Promise<string> {
		return this.app.fileManager.getAvailablePathForAttachment(
			`magic_mic_${date.format('YYYYMMDDHHmmss')}` +
				`.${this.audioRecorder.fileExtension}`,
		);
	}

	async writeResults({
		audioFile,
		date,
		summary,
		transcript,
	}: {
		audioFile?: TFile;
		date: moment.Moment;
		summary: SummarizationResult;
		transcript: string;
	}): Promise<TFile> {
		const { linkAudio } = this.settings;
		const noteName = `Magic Mic - ${date.format('yyMMDDHHmmss')}`;
		const noteFolder = this.app.fileManager.getNewFileParent(
			this.app.workspace.getActiveFile()?.path ?? '',
			noteName,
		);

		const notePath = normalizePath(`${noteFolder.path}/${noteName}.md`);

		let noteContent = '';
		if (audioFile && linkAudio) {
			const linkMd = this.app.fileManager.generateMarkdownLink(
				audioFile,
				notePath,
			);
			noteContent += `${linkMd}\n\n`;
		}

		switch (summary.state) {
			case 'success':
				noteContent += summary.response;
				break;
			case 'refused':
				noteContent += `# Summary refused\n\n${summary.refusal}\n\n`;
				break;
			case 'error':
				noteContent += `# Summary error\n\n${summary.error}\n\n`;
				break;
		}

		const note = await this.app.vault.create(notePath, noteContent);
		await this.app.fileManager.processFrontMatter(note, (frontMatter) => {
			frontMatter.createdBy = 'Magic Mic';
			frontMatter.recordedAt = date.local().format('YYYY-MM-DD HH:mm:ss');
			frontMatter.transcript = transcript;
		});

		return note;
	}

	async fromAudioFile({
		audioFile,
		assistantName,
	}: {
		audioFile: TFile;
		assistantName: string;
	}): Promise<TFile> {
		const buffer = await this.app.vault.readBinary(audioFile);
		const transcript = await this.transcribeAudio({ audioFile, buffer });
		const summary = await this.summarizeTranscript({
			transcript,
			assistantName,
		});
		return this.writeResults({
			audioFile,
			date: moment(),
			summary,
			transcript,
		});
	}

	async fromActiveRecording({
		assistantName,
	}: {
		assistantName: string;
	}): Promise<TFile> {
		const { buffer, audioFile, startedAt } = await this.finishRecording();
		const transcript = await this.transcribeAudio({ buffer, audioFile });
		const summary = await this.summarizeTranscript({
			transcript,
			assistantName,
		});
		return this.writeResults({
			audioFile,
			date: startedAt,
			summary,
			transcript,
		});
	}
}
