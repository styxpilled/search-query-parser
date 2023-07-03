interface SearchQueryParserOptions<
  TKeywords extends readonly string[],
  TRanges extends readonly string[]
> {
  alwaysArray: boolean,
  deleteEmpty: boolean,
  keywords: TKeywords,
  ranges: TRanges
}

type Text = {
  type: 'text',
  exclude: boolean,
  value: string,
  offset: {
    start: number,
    end: number
  }
}

type Keyword = {
  type: 'keyword',
  exclude: boolean,
  value: string,
  key: string,
} | null;

type Range = {
  type: 'range',
  exclude: boolean,
  from: string,
  to: string,
  key: string
} | null;

export type SearchQueryResult<
  TKeywords extends readonly string[],
  TRanges extends readonly string[]
> = {
  textSegments: Text[],
  advanced: {
    [K in (TKeywords[number] | TRanges[number])]: Keyword | Range
  },
  segments: (Text | NonNullable<Keyword> | NonNullable<Range>)[]
}

type InteralSearchQueryResult = {
  textSegments: Text[],
  advanced: Record<string, Keyword | Range>,
  segments: (Text | NonNullable<Keyword> | NonNullable<Range>)[]
}

export class SearchQuery<
  TKeywords extends readonly string[],
  TRanges extends readonly string[]
> {
  private previousValue: string
  public options: SearchQueryParserOptions<TKeywords, TRanges>
  public value: string
  private _parsed: SearchQueryResult<TKeywords, TRanges>
  private defaultOptions: SearchQueryParserOptions<TKeywords, TRanges> = {
    alwaysArray: false,
    deleteEmpty: true,
    keywords: ([] as unknown as TKeywords),
    ranges: ([] as unknown as TRanges),
  };
  private readonly re = /(\S+:'(?:[^'\\]|\\.)*')|(\S+:"(?:[^"\\]|\\.)*")|(-?"(?:[^"\\]|\\.)*")|(-?'(?:[^'\\]|\\.)*')|\S+|\S+:\S+/g;

  constructor(input?: string, opts?: Partial<SearchQueryParserOptions<TKeywords, TRanges>>) {
    this.value = input ? input : '';
    this.options = opts ? { ...this.defaultOptions, ...opts } : { ...this.defaultOptions };
    this._parsed = this.parse();
    // this.parsed = this.parse();
    this.previousValue = this.value;
  }

  public get(key: TKeywords[number]): Keyword;
  public get(key: TRanges[number]): Range;
  public get(key: TKeywords[number] | TRanges[number]): Range | Keyword {
    if (this.isKeywordKey(key)) {
      return (this.parsed.advanced[key] as Keyword)
    } else if (this.isRangeKey(key)) {
      return (this.parsed.advanced[key] as Range)
    }
    throw new Error(`Cannot fetch key ${key}. Key ${key} not provided in options`);
  }

  public set(
    key: TKeywords[number] | TRanges[number],
    value: string,
    exclude = false
  ) {
    if (this.isKeywordKey(key)) {
      this.parsed.advanced[key] = this.parseKeyword(value, key, exclude);
      this.updateSegment(this.parsed.advanced[key], key);
    } else if (this.isRangeKey(key)) {
      this.parsed.advanced[key] = this.parseRange(value, key, exclude);
      this.updateSegment(this.parsed.advanced[key], key);
    } else {
      throw new Error(`Cannot set key ${key}. Key ${key} not provided in options`);
    }
  }

  private set parsed(p: SearchQueryResult<TKeywords, TRanges>) {
    this._parsed = p;
  }

  get parsed(): SearchQueryResult<TKeywords, TRanges> {
    return this._parsed;
  }

  public parse(): SearchQueryResult<TKeywords, TRanges> {
    if (this.previousValue === this.value) return this.parsed;
    this.previousValue = this.value;
    this.value = this.value.trim();

    const result: InteralSearchQueryResult = {
      textSegments: [],
      advanced: {},
      segments: []
    };

    if (!this.value.includes(':')
      || (this.options.keywords.length === 0
        && this.options.ranges.length === 0
      )) {
      const textSegment = this.parseText(this.value, 0, this.value[0] === '-');
      if (textSegment !== null) {
        result.segments.push(textSegment);
        result.textSegments.push(textSegment);
      }
      result.advanced = (generateNull(this.options.keywords.concat(this.options.ranges)));
      return (result as SearchQueryResult<TKeywords, TRanges>);
    }

    let match;
    while ((match = this.re.exec(this.value)) !== null) {
      let term = match[0];
      const exclude = term[0] === '-';
      term = exclude ? term.slice(1) : term;

      const sepIndex = term.indexOf(':');
      let segment: Text | Keyword | Range = null;

      if (sepIndex !== -1) {
        const key = term.slice(0, sepIndex);
        const value = clean(term.slice(sepIndex + 1));
        if (this.isKeywordKey(key)) {
          segment = this.parseKeyword(value, key, exclude)
          result.advanced[key] = segment;
        } else if (this.isRangeKey(key)) {
          segment = this.parseRange(value, key, exclude);
          result.advanced[key] = segment;
        }
      } else {
        segment = this.parseText(term, match.index, exclude);
        if (segment !== null) result.textSegments.push(segment);
      }
      if (segment) result.segments.push(segment);
    }
    const r = result as SearchQueryResult<TKeywords, TRanges>;
    this.parsed = r;
    return r;
  }

  public stringify(): string {
    let strigified = ''
    for (const segment of this.parsed.segments) {
      if (segment.exclude) strigified += '-';
      switch (segment.type) {
        case 'text':
          strigified += segment.value;
          break;
        case 'keyword': {
          strigified += segment.key;
          strigified += ':';
          const containsSpace = segment.value.includes(' ');
          if (containsSpace) strigified += '"';
          strigified += segment.value;
          if (containsSpace) strigified += '"';
          break;
        }
        case 'range':
          strigified += segment.key;
          strigified += ':';
          strigified += segment.from;
          strigified += '-';
          strigified += segment.to;
          break;
      }
      strigified += ' ';
    }
    return strigified;
  }

  private isKeywordKey(key: TKeywords[number] | TRanges[number]): key is TKeywords[number] {
    return this.options.keywords.includes(key);
  }

  private isRangeKey(key: TKeywords[number] | TRanges[number]): key is TRanges[number] {
    return this.options.ranges.includes(key);
  }

  private updateSegment(
    segment: Keyword | Range | Text,
    key?: TKeywords[number] | TRanges[number]
  ) {
    if (segment === null) {
      for (let i = this.parsed.segments.length - 1; i >= 0; i--) {
        const s = this.parsed.segments[i];
        if (s.type === 'text') continue;
        if (s.key === key) {
          this.parsed.segments.splice(i, 1);
          return;
        }
      }
    } else if (segment.type === 'text') {
      for (let i = 0; i < this.parsed.segments.length; i++) {
        const s = this.parsed.segments[i];
        if (s.type === 'text' && s.offset.start === segment.offset.start) {
          this.parsed.segments[i] = segment;
          return;
        }
      }
      this.parsed.segments.push(segment);
    } else {
      for (let i = 0; i < this.parsed.segments.length; i++) {
        const s = this.parsed.segments[i];
        if (s.type === 'text') continue;
        if (s.key == segment.key) {
          this.parsed.segments[i] = segment;
          return;
        }
      }
      this.parsed.segments.push(segment);
    }
  }

  private parseText(
    text: string,
    offset: number,
    exclude: boolean,
  ): Text | null {
    if (text.length === 0) return null;
    text = clean(text);
    return {
      type: 'text',
      value: clean(text),
      exclude,
      offset: {
        start: offset,
        end: offset + text.length
      }
    }
  }

  private parseRange(
    text: string,
    key: string,
    exclude: boolean,
  ): Range | null {
    const split = text.split('-', 2);
    if (split.length < 2) return null;
    return {
      type: 'range',
      key,
      exclude,
      from: split[0],
      to: clean(split[1]),
    }
  }

  private parseKeyword(
    text: string,
    key: string,
    exclude: boolean
  ): Keyword | null {
    if (this.options.deleteEmpty && text === '') {
      return null;
    }
    return {
      type: 'keyword' as const,
      exclude,
      key,
      value: clean(text)
    }
  }
}

const generateNull = <TStrings extends readonly string[]>
  (keywords: TStrings) => {
  const retobj: {
    [K: string]: null;
  } = {};
  for (const keyword of keywords) {
    retobj[keyword] = null;
  }
  return retobj;
}

const backslashRegex = /\\(.?)/g;
const quotesRegex = /^"|"$|^'|'$/g;

const clean = (text: string) => {
  return text.replace(backslashRegex, escapeBackslashes).replace(quotesRegex, '');
}

const escapeBackslashes = (_: string, escaped: string) => {
  switch (escaped) {
    case '\\':
      return '\\';
    case '0':
      return '\u0000';
    case '':
      return '';
    default:
      return escaped;
  }
}