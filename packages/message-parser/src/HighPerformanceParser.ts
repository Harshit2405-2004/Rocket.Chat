import { BlockSplitter, BlockType } from './BlockSplitter';
import type { Code, CodeLine, Heading, Inlines, ListItem, Paragraph, Quote, Root } from './definitions';
import { InlineParser } from './InlineParser';

const plain = (value: string) => ({ type: 'PLAIN_TEXT' as const, value });

const paragraph = (value: Inlines[]): Paragraph => ({
	type: 'PARAGRAPH',
	value,
});

const heading = (value: string, level: number): Heading => ({
	type: 'HEADING',
	level: Math.min(Math.max(level, 1), 4) as 1 | 2 | 3 | 4,
	value: [plain(value)],
});

const codeLine = (value: string): CodeLine => ({
	type: 'CODE_LINE',
	value: plain(value),
});

const code = (value: string, language?: string): Code => ({
	type: 'CODE',
	language: language || 'none',
	value: value.split('\n').map((line) => codeLine(line)),
});

const parseListItemLine = (line: string): { ordered: boolean; item: string; number?: number } | null => {
	let pos = 0;
	while (pos < line.length && line.charCodeAt(pos) === 32) {
		pos++;
	}

	const start = pos;
	if (pos < line.length && line.charCodeAt(pos) >= 48 && line.charCodeAt(pos) <= 57) {
		while (pos < line.length && line.charCodeAt(pos) >= 48 && line.charCodeAt(pos) <= 57) {
			pos++;
		}
		if (pos < line.length && line.charCodeAt(pos) === 46 && pos + 1 < line.length && line.charCodeAt(pos + 1) === 32) {
			const number = Number(line.slice(start, pos));
			return { ordered: true, number, item: line.slice(pos + 2) };
		}
	}

	pos = start;
	if (
		pos < line.length &&
		(line.charCodeAt(pos) === 45 || line.charCodeAt(pos) === 42 || line.charCodeAt(pos) === 43) &&
		pos + 1 < line.length &&
		line.charCodeAt(pos + 1) === 32
	) {
		return { ordered: false, item: line.slice(pos + 2) };
	}

	return null;
};

const parseListBlock = (content: string, ordered: boolean): { type: 'ORDERED_LIST' | 'UNORDERED_LIST'; value: ListItem[] } => {
	const lines = content.split('\n');
	const items: ListItem[] = [];

	for (const line of lines) {
		const parsed = parseListItemLine(line);
		if (!parsed) {
			const last = items[items.length - 1];
			if (last) {
				const text = line.trim();
				if (text.length > 0) {
					last.value.push(...InlineParser.parse(` ${text}`));
				}
			}
			continue;
		}

		items.push({
			type: 'LIST_ITEM',
			value: InlineParser.parse(parsed.item),
			...(parsed.number !== undefined ? { number: parsed.number } : {}),
		});
	}

	return ordered ? { type: 'ORDERED_LIST', value: items } : { type: 'UNORDERED_LIST', value: items };
};

const parseQuoteBlock = (content: string): Quote => {
	const lines = content.split('\n');
	const paragraphs: Paragraph[] = [];

	for (const line of lines) {
		let pos = 0;
		while (pos < line.length && line.charCodeAt(pos) === 62) {
			pos++;
		}
		if (pos < line.length && line.charCodeAt(pos) === 32) {
			pos++;
		}
		paragraphs.push(paragraph(InlineParser.parse(line.slice(pos))));
	}

	return {
		type: 'QUOTE',
		value: paragraphs,
	};
};

export class HighPerformanceParser {
	public static parse(input: string): Root {
		const blocks = BlockSplitter.split(input);
		const root: Root = [];

		for (const block of blocks) {
			if (block.type === BlockType.PARAGRAPH) {
				root.push(paragraph(InlineParser.parse(block.content)));
				continue;
			}

			if (block.type === BlockType.HEADING) {
				root.push(heading(block.content, block.level ?? 1));
				continue;
			}

			if (block.type === BlockType.CODE) {
				root.push(code(block.content, block.language));
				continue;
			}

			if (block.type === BlockType.QUOTE) {
				root.push(parseQuoteBlock(block.content));
				continue;
			}

			if (block.type === BlockType.LIST) {
				root.push(parseListBlock(block.content, block.ordered !== false));
			}
		}

		return root;
	}
}

