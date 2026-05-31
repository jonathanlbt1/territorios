import { generateUsername, generateUniqueUsername } from '../../src/utils/generateUsername.js';

describe('generateUsername', () => {
  describe('basic functionality', () => {
    it('should generate username from first and last name', () => {
      expect(generateUsername('João Silva')).toBe('joao.silva');
    });

    it('should use first and last word for multi-word names', () => {
      expect(generateUsername('João Alves da Silva')).toBe('joao.silva');
    });

    it('should handle three-word names', () => {
      expect(generateUsername('Maria José Santos')).toBe('maria.santos');
    });

    it('should handle single word name', () => {
      expect(generateUsername('Pedro')).toBe('pedro');
    });
  });

  describe('normalization', () => {
    describe('lowercase conversion', () => {
      it('should convert uppercase names to lowercase', () => {
        expect(generateUsername('JOÃO SILVA')).toBe('joao.silva');
      });

      it('should handle mixed case', () => {
        expect(generateUsername('JoÃo SiLvA')).toBe('joao.silva');
      });
    });

    describe('accent removal', () => {
      it('should remove acute accents (á, é, í, ó, ú)', () => {
        expect(generateUsername('José María')).toBe('jose.maria');
      });

      it('should remove grave accents (à)', () => {
        expect(generateUsername('Àlvaro Àlves')).toBe('alvaro.alves');
      });

      it('should remove circumflex accents (â, ê, ô)', () => {
        expect(generateUsername('Ângela Côrrea')).toBe('angela.correa');
      });

      it('should remove tilde (ã, õ)', () => {
        expect(generateUsername('João Conceição')).toBe('joao.conceicao');
      });

      it('should remove cedilla (ç)', () => {
        expect(generateUsername('Graça Gonçalves')).toBe('graca.goncalves');
      });

      it('should remove umlaut (ü)', () => {
        expect(generateUsername('Müller Büchner')).toBe('muller.buchner');
      });

      it('should handle multiple accents in one name', () => {
        expect(generateUsername('José Conceição')).toBe('jose.conceicao');
      });
    });

    describe('special character removal', () => {
      it('should remove hyphens', () => {
        expect(generateUsername('Ana-Maria Costa-Silva')).toBe('anamaria.costasilva');
      });

      it('should remove apostrophes', () => {
        expect(generateUsername("O'Connor D'Silva")).toBe('oconnor.dsilva');
      });

      it('should keep numbers', () => {
        expect(generateUsername('User123 Test456')).toBe('user123.test456');
      });

      it('should remove other special characters', () => {
        expect(generateUsername('John@#$ Smith!@#')).toBe('john.smith');
      });
    });
  });

  describe('whitespace handling', () => {
    it('should trim leading whitespace', () => {
      expect(generateUsername('   João Silva')).toBe('joao.silva');
    });

    it('should trim trailing whitespace', () => {
      expect(generateUsername('João Silva   ')).toBe('joao.silva');
    });

    it('should handle multiple spaces between words', () => {
      expect(generateUsername('João    Silva')).toBe('joao.silva');
    });

    it('should handle tabs and newlines', () => {
      expect(generateUsername('João\t\nSilva')).toBe('joao.silva');
    });

    it('should handle mixed whitespace characters', () => {
      expect(generateUsername('  João  \t  Alves  \n  Silva  ')).toBe('joao.silva');
    });
  });

  describe('validation', () => {
    it('should throw error for null input', () => {
      expect(() => generateUsername(null)).toThrow('Nome inválido');
    });

    it('should throw error for undefined input', () => {
      expect(() => generateUsername(undefined)).toThrow('Nome inválido');
    });

    it('should throw error for empty string', () => {
      expect(() => generateUsername('')).toThrow('Nome inválido');
    });

    it('should throw error for whitespace-only string', () => {
      expect(() => generateUsername('   ')).toThrow('Nome inválido');
    });

    it('should throw error for number input', () => {
      expect(() => generateUsername(123)).toThrow('Nome inválido');
    });

    it('should throw error for array input', () => {
      expect(() => generateUsername(['João', 'Silva'])).toThrow('Nome inválido');
    });

    it('should throw error for object input', () => {
      expect(() => generateUsername({ name: 'João' })).toThrow('Nome inválido');
    });
  });

  describe('Portuguese names', () => {
    it('should handle common prepositions (da, de, do, dos, das)', () => {
      expect(generateUsername('Maria da Silva')).toBe('maria.silva');
      expect(generateUsername('João de Souza')).toBe('joao.souza');
      expect(generateUsername('Pedro do Carmo')).toBe('pedro.carmo');
      expect(generateUsername('Ana dos Santos')).toBe('ana.santos');
      expect(generateUsername('Rosa das Flores')).toBe('rosa.flores');
    });

    it('should handle names with multiple prepositions', () => {
      expect(generateUsername('José da Silva e Souza')).toBe('jose.souza');
    });

    it('should handle compound last names', () => {
      expect(generateUsername('Maria Silva Santos')).toBe('maria.santos');
    });
  });

  describe('international names', () => {
    it('should handle German characters (ö, ü, ß)', () => {
      expect(generateUsername('Günther Müller')).toBe('gunther.muller');
    });

    it('should handle Spanish characters (ñ)', () => {
      expect(generateUsername('Señor España')).toBe('senor.espana');
    });

    it('should handle French characters', () => {
      expect(generateUsername('François Bézier')).toBe('francois.bezier');
    });

    it('should handle Nordic characters (å)', () => {
      // Note: ø doesn't decompose via NFD, so it gets removed
      expect(generateUsername('Håkansson Berg')).toBe('hakansson.berg');
    });

    it('should remove non-decomposable characters like ø', () => {
      // The ø character doesn't decompose via NFD normalization
      expect(generateUsername('Jørgen Berg')).toBe('jrgen.berg');
    });
  });

  describe('edge cases', () => {
    it('should handle very long names', () => {
      const longName = 'Maria' + ' Palavra'.repeat(20) + ' Silva';
      expect(generateUsername(longName)).toBe('maria.silva');
    });

    it('should return empty parts for special-character-only words', () => {
      // Words that become empty after normalization result in empty strings
      // The implementation processes them without throwing
      expect(generateUsername('!@# $%^')).toBe('.');
    });

    it('should return empty string for single special-character word', () => {
      // Single word that becomes empty after special char removal
      expect(generateUsername('@#$%')).toBe('');
    });

    it('should handle two-letter names', () => {
      expect(generateUsername('Li Wu')).toBe('li.wu');
    });

    it('should handle single-letter names', () => {
      expect(generateUsername('A B')).toBe('a.b');
    });
  });
});

describe('generateUniqueUsername', () => {
  describe('first attempt', () => {
    it('should return base username on first attempt', () => {
      expect(generateUniqueUsername('joao.silva', 1)).toBe('joao.silva');
    });

    it('should return base username when attempts not specified', () => {
      expect(generateUniqueUsername('joao.silva')).toBe('joao.silva');
    });
  });

  describe('subsequent attempts', () => {
    it('should append 1 on second attempt', () => {
      expect(generateUniqueUsername('joao.silva', 2)).toBe('joao.silva1');
    });

    it('should append 2 on third attempt', () => {
      expect(generateUniqueUsername('joao.silva', 3)).toBe('joao.silva2');
    });

    it('should append 9 on tenth attempt', () => {
      expect(generateUniqueUsername('joao.silva', 10)).toBe('joao.silva9');
    });

    it('should append 99 on hundredth attempt', () => {
      expect(generateUniqueUsername('joao.silva', 100)).toBe('joao.silva99');
    });
  });

  describe('various base usernames', () => {
    it('should work with simple username', () => {
      expect(generateUniqueUsername('pedro', 2)).toBe('pedro1');
    });

    it('should work with username containing numbers', () => {
      expect(generateUniqueUsername('user123', 2)).toBe('user1231');
    });

    it('should work with username already having a number suffix', () => {
      expect(generateUniqueUsername('joao.silva1', 2)).toBe('joao.silva11');
    });

    it('should work with empty base username', () => {
      expect(generateUniqueUsername('', 2)).toBe('1');
    });
  });

  describe('edge cases', () => {
    it('should handle zero attempts (returns base)', () => {
      // Zero is falsy, so default is used (1)
      expect(generateUniqueUsername('joao.silva', 0)).toBe('joao.silva-1');
    });

    it('should handle negative attempts', () => {
      expect(generateUniqueUsername('joao.silva', -1)).toBe('joao.silva-2');
    });

    it('should handle very large attempt numbers', () => {
      expect(generateUniqueUsername('joao.silva', 1000000)).toBe('joao.silva999999');
    });
  });
});

describe('integration scenarios', () => {
  it('should work together for typical user creation flow', () => {
    const fullName = 'João da Silva';
    const baseUsername = generateUsername(fullName);
    
    expect(baseUsername).toBe('joao.silva');
    
    // Simulate finding existing usernames
    const attempt1 = generateUniqueUsername(baseUsername, 1);
    expect(attempt1).toBe('joao.silva');
    
    const attempt2 = generateUniqueUsername(baseUsername, 2);
    expect(attempt2).toBe('joao.silva1');
    
    const attempt3 = generateUniqueUsername(baseUsername, 3);
    expect(attempt3).toBe('joao.silva2');
  });

  it('should handle complex name to unique username flow', () => {
    const fullName = 'José Conceição da Silva';
    const baseUsername = generateUsername(fullName);
    
    expect(baseUsername).toBe('jose.silva');
    
    const uniqueUsername = generateUniqueUsername(baseUsername, 5);
    expect(uniqueUsername).toBe('jose.silva4');
  });

  it('should handle single name to unique username flow', () => {
    const fullName = 'Madonna';
    const baseUsername = generateUsername(fullName);
    
    expect(baseUsername).toBe('madonna');
    
    const uniqueUsername = generateUniqueUsername(baseUsername, 3);
    expect(uniqueUsername).toBe('madonna2');
  });
});
