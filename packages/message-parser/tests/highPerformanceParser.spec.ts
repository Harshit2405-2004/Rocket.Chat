import { HighPerformanceParser } from '../src/HighPerformanceParser';

describe('HighPerformanceParser', () => {
	it('parses mixed blocks and inline formatting in one pass pipeline', () => {
		const input = `# Heading
Hello **world**

- item 1
- item 2

> quote line

\`\`\`ts
const x = 1;
\`\`\``;

		const ast = HighPerformanceParser.parse(input);

		expect(ast).toMatchObject([
			{
				type: 'HEADING',
				level: 1,
				value: [{ type: 'PLAIN_TEXT', value: 'Heading' }],
			},
			{
				type: 'PARAGRAPH',
				value: [
					{ type: 'PLAIN_TEXT', value: 'Hello ' },
					{ type: 'BOLD', value: [{ type: 'PLAIN_TEXT', value: 'world' }] },
				],
			},
			{
				type: 'UNORDERED_LIST',
				value: [
					{ type: 'LIST_ITEM', value: [{ type: 'PLAIN_TEXT', value: 'item 1' }] },
					{ type: 'LIST_ITEM', value: [{ type: 'PLAIN_TEXT', value: 'item 2' }] },
				],
			},
			{
				type: 'QUOTE',
				value: [{ type: 'PARAGRAPH', value: [{ type: 'PLAIN_TEXT', value: 'quote line' }] }],
			},
			{
				type: 'CODE',
				language: 'ts',
				value: [{ type: 'CODE_LINE', value: { type: 'PLAIN_TEXT', value: 'const x = 1;' } }],
			},
		]);
	});
});

