import { App, PluginSettingTab, Setting } from 'obsidian';

import MagicMicPlugin from './Plugin';
import { Model, models } from './summarizeTranscription';

export interface ISettings {
	openaiApiKey: string;
	transcriptionHint: string;
	assistantModel: Model;
	assistants: { name: string; prompt: string }[];
	saveAudio: boolean;
	linkAudio: boolean;
}

const defaultInstructions = `You are an AI specializing in summarizing
transcribed voice notes. Below is a transcript of a spoken recording. Please
generate concise notes in markdown format, prioritizing clarity and coherence.
Reorganize content into appropriate sections with headers. Do not infer any
additional context or information beyond the transcription. Keep the content
structured and readable in markdown format, but without using code blocks.
Below is the transcribed audio:`
	.replace(/\n/g, ' ')
	.trim();

export const DEFAULT_SETTINGS: ISettings = {
	openaiApiKey: '',
	transcriptionHint: '',
	assistantModel: 'gpt-4o',
	assistants: [{ name: 'Default', prompt: defaultInstructions }],
	saveAudio: true,
	linkAudio: true,
};

export default class Settings extends PluginSettingTab {
	plugin: MagicMicPlugin;

	constructor(app: App, plugin: MagicMicPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Save audio')
			.setDesc(
				'Save audio files in your vault after transcription; files will ' +
					'be saved according to your vault settings for new attachments.',
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.saveAudio)
					.onChange(async (value) => {
						this.plugin.settings.saveAudio = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Link audio')
			.setDesc(
				'Link audio files into the summary note; ignored if not retaining audio',
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.linkAudio)
					.onChange(async (value) => {
						this.plugin.settings.linkAudio = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl).setHeading().setName('AI configuration');

		new Setting(containerEl).setName('OpenAI API key').addText((text) =>
			text
				.setPlaceholder('ApiKey')
				.setValue(this.plugin.settings.openaiApiKey)
				.onChange(async (value) => {
					this.plugin.settings.openaiApiKey = value;
					await this.plugin.saveSettings();
				}),
		);
		new Setting(containerEl)
			.setName('Speech to text hints')
			.setDesc(
				'Hint the transcription with words, acronyms, or names that are ' +
					'likely to appear in your audio, or with stylized text you want ' +
					'the transcript to match. Note that this is different from ' +
					"summary instructions - see OpenAI's documentation for more. For " +
					'longer transcriptions that require more than one API call, the ' +
					'prompt will be prepended to the final tokens of the previous ' +
					'response to improve consistency across segments.',
			)
			.addTextArea((text) =>
				text
					.setPlaceholder(
						'Avi, Bryan, and Kristy discussed the latest work on BART, MTS, and the T.',
					)
					.setValue(this.plugin.settings.transcriptionHint)
					.onChange(async (value) => {
						this.plugin.settings.transcriptionHint = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Summary assistant model')
			.setDesc('Choose an OpenAI chat model to power your summary assistants.')
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(Object.fromEntries(models.map((m) => [m, m])))
					.setValue(this.plugin.settings.assistantModel)
					.onChange(async (value: Model) => {
						this.plugin.settings.assistantModel = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setHeading()
			.setName('Summary assistants')
			.setDesc(
				'Summary assistants turn your transcribed memos into useful notes. ' +
					'Provide a name and a prompt for each. Add multiple assistants for ' +
					'different purposes, and choose between them when you run Magic Mic.',
			);

		for (const [
			index,
			{ name: key, prompt: value },
		] of this.plugin.settings.assistants.entries()) {
			new Setting(containerEl)
				.setName(`${index + 1}.`)
				.addText((text) => {
					text
						.setPlaceholder('Assistant name')
						.setValue(key)
						.onChange(async (newValue) => {
							this.plugin.settings.assistants[index].name = newValue;
							await this.plugin.saveSettings();
						});
				})
				.addTextArea((text) =>
					text
						.setPlaceholder('Instructions')
						.setValue(value)
						.onChange(async (newValue) => {
							this.plugin.settings.assistants[index].prompt = newValue;
							await this.plugin.saveSettings();
						}),
				)
				.addExtraButton((button) => {
					button
						.setIcon('x')
						.setTooltip('Delete this prompt')
						.onClick(async () => {
							this.plugin.settings.assistants.splice(index, 1);
							await this.plugin.saveSettings();
							this.display();
						});
				});
		}

		new Setting(containerEl).addButton((button) => {
			button
				.setIcon('plus')
				.setButtonText('+ Add an assistant')
				.onClick(() => {
					this.plugin.settings.assistants.push({
						name: '',
						prompt: defaultInstructions,
					});
					this.display();
				});
		});
	}
}
