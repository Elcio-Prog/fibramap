/**
 * Converts Portuguese number words in a string to digits.
 * E.g. "Rua Quarenta e Dois" → "Rua 42"
 */

const units: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, três: 3,
  quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14,
  quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
};

const tens: Record<string, number> = {
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50,
  sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
};

const hundreds: Record<string, number> = {
  cem: 100, cento: 100, duzentos: 200, duzentas: 200,
  trezentos: 300, trezentas: 300, quatrocentos: 400, quatrocentas: 400,
  quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600,
  setecentos: 700, setecentas: 700, oitocentos: 800, oitocentas: 800,
  novecentos: 900, novecentas: 900,
};

const allWords = new Set([
  ...Object.keys(units),
  ...Object.keys(tens),
  ...Object.keys(hundreds),
  "e",
]);

function wordToValue(word: string): { value: number; type: "unit" | "ten" | "hundred" } | null {
  const low = word.toLowerCase();
  if (hundreds[low] !== undefined) return { value: hundreds[low], type: "hundred" };
  if (tens[low] !== undefined) return { value: tens[low], type: "ten" };
  if (units[low] !== undefined) return { value: units[low], type: "unit" };
  return null;
}

/**
 * Replace sequences of Portuguese number words with their digit equivalent.
 * "Quarenta e Dois" → "42", "Cento e Vinte e Três" → "123"
 */
export function convertNumberWords(input: string): string {
  const words = input.split(/\s+/);
  const result: string[] = [];
  let i = 0;

  while (i < words.length) {
    const cleaned = words[i].replace(/[,.:;]/g, "").toLowerCase();
    const parsed = wordToValue(cleaned);

    if (parsed) {
      // Start collecting number words
      let total = parsed.value;
      let lastType = parsed.type;
      let j = i + 1;

      while (j < words.length) {
        const nextCleaned = words[j].replace(/[,.:;]/g, "").toLowerCase();
        
        // Skip "e" connector
        if (nextCleaned === "e" && j + 1 < words.length) {
          const afterE = words[j + 1].replace(/[,.:;]/g, "").toLowerCase();
          const afterParsed = wordToValue(afterE);
          if (afterParsed) {
            total += afterParsed.value;
            lastType = afterParsed.type;
            j += 2;
            continue;
          }
          break;
        }

        const nextParsed = wordToValue(nextCleaned);
        if (nextParsed && nextParsed.value < total) {
          total += nextParsed.value;
          lastType = nextParsed.type;
          j++;
          continue;
        }
        break;
      }

      result.push(String(total));
      i = j;
    } else {
      result.push(words[i]);
      i++;
    }
  }

  return result.join(" ");
}
