import type { Root } from './definitions';
import * as grammar from './grammar.pegjs';
import { HighPerformanceParser } from './HighPerformanceParser';

export type * from './definitions';

export { isNodeOfType } from './guards';

export type Options = {
	colors?: boolean;
	emoticons?: boolean;
	katex?: {
		dollarSyntax?: boolean;
		parenthesisSyntax?: boolean;
	};
	customDomains?: string[];
	mode?: 'peggy' | 'high-performance';
};

export const parse = (input: string, options?: Options): Root => {
	if (options?.mode === 'high-performance') {
		return HighPerformanceParser.parse(input);
	}
	return grammar.parse(input, options);
};

export type { Root as MarkdownAST };
export { parse as parser };
