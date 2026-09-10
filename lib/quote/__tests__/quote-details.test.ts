import { describe, expect, it } from 'vitest';
import { parseQuoteDetails } from '../quote-details';

describe('detaliile proiectului', () => {
  it('curăță valorile și permite clientul și contactul opționale', () => {
    expect(parseQuoteDetails({
      name: '  Bucătărie Popescu  ',
    })).toEqual({
      name: 'Bucătărie Popescu',
    });

    expect(parseQuoteDetails({
      name: 'Dormitor',
    })).toEqual({ name: 'Dormitor' });
  });

  it('respinge numele gol al proiectului', () => {
    expect(() => parseQuoteDetails({
      name: '   ',
    })).toThrow();
  });
});
