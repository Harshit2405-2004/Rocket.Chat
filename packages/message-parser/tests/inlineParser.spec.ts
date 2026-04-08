import { InlineParser } from '../src/InlineParser';

describe('InlineParser', () => {
	it('parses bold, italic and strike markers', () => {
		const nodes = InlineParser.parse('**bold** _italic_ ~~strike~~');
		expect(nodes).toMatchObject([
			{ type: 'BOLD', value: [{ type: 'PLAIN_TEXT', value: 'bold' }] },
			{ type: 'PLAIN_TEXT', value: ' ' },
			{ type: 'ITALIC', value: [{ type: 'PLAIN_TEXT', value: 'italic' }] },
			{ type: 'PLAIN_TEXT', value: ' ' },
			{ type: 'STRIKE', value: [{ type: 'PLAIN_TEXT', value: 'strike' }] },
		]);
	});

	it('parses nested markers', () => {
		const nodes = InlineParser.parse('**bold _inside_**');
		expect(nodes).toMatchObject([
			{
				type: 'BOLD',
				value: [
					{ type: 'PLAIN_TEXT', value: 'bold ' },
					{ type: 'ITALIC', value: [{ type: 'PLAIN_TEXT', value: 'inside' }] },
				],
			},
		]);
	});

	it('parses mentions, channel mentions, links, inline code and emoji shortcode', () => {
		const nodes = InlineParser.parse('@john #general https://rocket.chat `cmd` :smile:');
		expect(nodes).toMatchObject([
			{ type: 'MENTION_USER', value: { type: 'PLAIN_TEXT', value: 'john' } },
			{ type: 'PLAIN_TEXT', value: ' ' },
			{ type: 'MENTION_CHANNEL', value: { type: 'PLAIN_TEXT', value: 'general' } },
			{ type: 'PLAIN_TEXT', value: ' ' },
			{
				type: 'LINK',
				value: {
					src: { type: 'PLAIN_TEXT', value: 'https://rocket.chat' },
				},
			},
			{ type: 'PLAIN_TEXT', value: ' ' },
			{
				type: 'INLINE_CODE',
				value: { type: 'PLAIN_TEXT', value: 'cmd' },
			},
			{ type: 'PLAIN_TEXT', value: ' ' },
			{ type: 'EMOJI', shortCode: 'smile', value: { type: 'PLAIN_TEXT', value: 'smile' } },
		]);
	});

	it('keeps unmatched markers as plain text', () => {
		const nodes = InlineParser.parse('**unclosed');
		expect(nodes).toMatchObject([{ type: 'PLAIN_TEXT', value: '**unclosed' }]);
	});
});

