import type { Bold, ChannelMention, Emoji, InlineCode, Inlines, Italic, Link, Plain, Strike, UserMention } from './definitions';

type MarkerChar = 42 | 95 | 126; // *, _, ~
type InlineNode = Plain | Bold | Italic | Strike | Link | UserMention | ChannelMention | Emoji | InlineCode;

type StackEntry = {
	type: 'ROOT' | 'BOLD' | 'ITALIC' | 'STRIKE';
	markerChar?: MarkerChar;
	markerLength?: 1 | 2;
	nodes: InlineNode[];
};

const isWordCharCode = (code: number): boolean =>
	(code >= 48 && code <= 57) || // 0-9
	(code >= 65 && code <= 90) || // A-Z
	(code >= 97 && code <= 122) || // a-z
	code === 95 || // _
	code === 46 || // .
	code === 45; // -

const isWhitespaceCode = (code: number): boolean =>
	code === 32 || code === 9 || code === 10 || code === 13;

const plain = (value: string): Plain => ({ type: 'PLAIN_TEXT', value });

const pushPlain = (nodes: InlineNode[], value: string): void => {
	if (!value) {
		return;
	}

	const last = nodes[nodes.length - 1];
	if (last?.type === 'PLAIN_TEXT') {
		last.value += value;
		return;
	}

	nodes.push(plain(value));
};

const markerTypeFromChar = (marker: MarkerChar): StackEntry['type'] => {
	if (marker === 42) {
		return 'BOLD';
	}
	if (marker === 95) {
		return 'ITALIC';
	}
	return 'STRIKE';
};

const createStyledNode = (entry: StackEntry): Bold | Italic | Strike => {
	if (entry.type === 'BOLD') {
		return { type: 'BOLD', value: entry.nodes as Bold['value'] };
	}
	if (entry.type === 'ITALIC') {
		return { type: 'ITALIC', value: entry.nodes as Italic['value'] };
	}
	return { type: 'STRIKE', value: entry.nodes as Strike['value'] };
};

const parseURLAt = (input: string, start: number): string | null => {
	if (input.charCodeAt(start) !== 104 /* h */) {
		return null;
	}

	const hasHttp = input.startsWith('http://', start);
	const hasHttps = input.startsWith('https://', start);
	if (!hasHttp && !hasHttps) {
		return null;
	}

	let pos = start + (hasHttps ? 8 : 7);
	while (pos < input.length) {
		const code = input.charCodeAt(pos);
		if (isWhitespaceCode(code)) {
			break;
		}
		pos++;
	}

	return input.slice(start, pos);
};

const parseMentionAt = (input: string, start: number): { type: 'MENTION_USER' | 'MENTION_CHANNEL'; value: string } | null => {
	const marker = input.charCodeAt(start);
	if (marker !== 64 /* @ */ && marker !== 35 /* # */) {
		return null;
	}

	let pos = start + 1;
	while (pos < input.length && isWordCharCode(input.charCodeAt(pos))) {
		pos++;
	}

	if (pos === start + 1) {
		return null;
	}

	return {
		type: marker === 64 ? 'MENTION_USER' : 'MENTION_CHANNEL',
		value: input.slice(start + 1, pos),
	};
};

const parseEmojiShortCodeAt = (input: string, start: number): string | null => {
	if (input.charCodeAt(start) !== 58 /* : */) {
		return null;
	}

	let pos = start + 1;
	while (pos < input.length && isWordCharCode(input.charCodeAt(pos))) {
		pos++;
	}

	if (pos === start + 1 || pos >= input.length || input.charCodeAt(pos) !== 58 /* : */) {
		return null;
	}

	return input.slice(start + 1, pos);
};

export class InlineParser {
	public static parse(input: string): Inlines[] {
		const stack: StackEntry[] = [{ type: 'ROOT', nodes: [] }];
		let buffer = '';
		let i = 0;

		const current = (): StackEntry => stack[stack.length - 1];
		const flushBuffer = (): void => {
			pushPlain(current().nodes, buffer);
			buffer = '';
		};

		while (i < input.length) {
			const code = input.charCodeAt(i);

			// Escape sequence
			if (code === 92 /* \ */ && i + 1 < input.length) {
				buffer += input[i + 1];
				i += 2;
				continue;
			}

			// Inline code
			if (code === 96 /* ` */) {
				let end = i + 1;
				while (end < input.length && input.charCodeAt(end) !== 96 /* ` */) {
					end++;
				}

				if (end < input.length) {
					flushBuffer();
					const codeNode: InlineCode = {
						type: 'INLINE_CODE',
						value: plain(input.slice(i + 1, end)),
					};
					current().nodes.push(codeNode);
					i = end + 1;
					continue;
				}
			}

			// URL
			const url = parseURLAt(input, i);
			if (url) {
				flushBuffer();
				const linkNode: Link = {
					type: 'LINK',
					value: {
						src: plain(url),
						label: [plain(url)],
					},
				};
				current().nodes.push(linkNode);
				i += url.length;
				continue;
			}

			// Mentions / channels
			const mention = parseMentionAt(input, i);
			if (mention) {
				flushBuffer();
				if (mention.type === 'MENTION_USER') {
					current().nodes.push({ type: 'MENTION_USER', value: plain(mention.value) });
				} else {
					current().nodes.push({ type: 'MENTION_CHANNEL', value: plain(mention.value) });
				}
				i += mention.value.length + 1;
				continue;
			}

			// Emoji short code
			const emojiShortCode = parseEmojiShortCodeAt(input, i);
			if (emojiShortCode) {
				flushBuffer();
				current().nodes.push({
					type: 'EMOJI',
					value: plain(emojiShortCode),
					shortCode: emojiShortCode,
				});
				i += emojiShortCode.length + 2;
				continue;
			}

			// Marker stack for bold/italic/strike
			if (code === 42 /* * */ || code === 95 /* _ */ || code === 126 /* ~ */) {
				const markerLength = (i + 1 < input.length && input.charCodeAt(i + 1) === code ? 2 : 1) as 1 | 2;
				flushBuffer();

				const top = current();
				if (top.markerChar === code && top.markerLength === markerLength) {
					const closed = stack.pop();
					if (closed && closed.type !== 'ROOT') {
						if (closed.nodes.length === 0) {
							pushPlain(current().nodes, input.slice(i - markerLength, i + markerLength));
						} else {
							current().nodes.push(createStyledNode(closed));
						}
					}
				} else {
					stack.push({
						type: markerTypeFromChar(code),
						markerChar: code,
						markerLength,
						nodes: [],
					});
				}

				i += markerLength;
				continue;
			}

			buffer += input[i];
			i++;
		}

		flushBuffer();

		while (stack.length > 1) {
			const entry = stack.pop();
			if (!entry || entry.type === 'ROOT') {
				continue;
			}
			const marker = String.fromCharCode(entry.markerChar ?? 42).repeat(entry.markerLength ?? 1);
			pushPlain(current().nodes, marker);
			current().nodes.push(...entry.nodes);
		}

		return stack[0].nodes as Inlines[];
	}
}

