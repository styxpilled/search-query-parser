# search-query-parser

Every search query parser I could find was really outdated and didn't have proper Typescript support. This one uses generics to ensure type safety when accessing parsed properties. It will only parse the keywords provided, but it won't sanitize anything in any way.

Given an input like:

`from:hi@retrace.io,foo@gmail.com to:me subject:vacations date:1/10/2013-15/04/2014 photos`

It will return an object like this:

```js
{
  textSegments: [{
    type: 'text',
    value: 'photos',
    exclude: false,
    offset: {
      from: 83,
      to: 89
    }
  }],
  advanced: {
    from: {
      type: 'keyword',
      exclude: false,
      key: 'from',
      value: 'hi@retrace.io,foo@gmail.com'
    },
    to: { type: 'keyword', exclude: false, key: 'to', value: 'me' },
    subject: {
      type: 'keyword',
      exclude: false,
      key: 'subject',
      value: 'vacations'
    },
    date: {
      type: 'range',
      key: 'date',
      exclude: false,
      from: '1/10/2013',
      to: '15/04/2014'
    }
  },
  segments: [
    {
      type: 'keyword',
      exclude: false,
      key: 'from',
      value: 'hi@retrace.io,foo@gmail.com'
    },
    { type: 'keyword', exclude: false, key: 'to', value: 'me' },
    {
      type: 'keyword',
      exclude: false,
      key: 'subject',
      value: 'vacations'
    },
    {
      type: 'range',
      key: 'date',
      exclude: false,
      from: '1/10/2013',
      to: '15/04/2014'
    },
    { 
      type: 'text',
      value: 'photos',
      exclude: false,
      offset: {
        from: 83,
        to: 89
      }
    }
  ]
}
```

## Usage

```ts
const query = 'from:hi@retrace.io,foo@gmail.com to:me subject:vacations date:1/10/2013-15/04/2014';
const options = {
  keywords: (['from', 'to', 'subject'] as const),
  ranges: (['date'] as const)
}

const search = new SearchQuery(query, options);
search.set('subject', 'restaurants', true);
const strigified = search.stringify();
// from:hi@retrace.io,foo@gmail.com to:me -subject:restaurants date:1/10/2013-15/04/2014
```