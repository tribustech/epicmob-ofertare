import { describe, expect, it } from 'vitest';
import { parseProjectDetails } from '../project-details';

describe('detaliile proiectului', () => {
  it('curăță valorile și permite clientul și contactul opționale', () => {
    expect(parseProjectDetails({
      name: '  Bucătărie Popescu  ',
      clientName: '  Ana Popescu  ',
      clientContact: '  0712 345 678  ',
    })).toEqual({
      name: 'Bucătărie Popescu',
      clientName: 'Ana Popescu',
      clientContact: '0712 345 678',
    });

    expect(parseProjectDetails({
      name: 'Dormitor',
      clientName: '',
      clientContact: '',
    })).toEqual({ name: 'Dormitor' });
  });

  it('respinge numele gol al proiectului', () => {
    expect(() => parseProjectDetails({
      name: '   ',
      clientName: '',
      clientContact: '',
    })).toThrow();
  });
});
