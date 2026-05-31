/**
 * Gera um username a partir do nome do usuário
 * Exemplo: "João Alves da Silva" → "joao.silva"
 * 
 * @param {string} fullName - Nome completo do usuário
 * @returns {string} Username gerado
 */
export function generateUsername(fullName) {
  if (!fullName || typeof fullName !== 'string') {
    throw new Error('Nome inválido');
  }

  // Remover espaços extras e dividir em palavras
  const words = fullName
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0);

  if (words.length === 0) {
    throw new Error('Nome inválido');
  }

  // Se apenas uma palavra, usar a mesma palavra
  if (words.length === 1) {
    return normalizeWord(words[0]);
  }

  // Pega primeira e última palavra
  const firstName = normalizeWord(words[0]);
  const lastName = normalizeWord(words[words.length - 1]);

  return `${firstName}.${lastName}`;
}

/**
 * Normaliza uma palavra para usar em username
 * - Converte para minúsculas
 * - Remove acentos e caracteres especiais
 * 
 * @param {string} word - Palavra a normalizar
 * @returns {string} Palavra normalizada
 */
function normalizeWord(word) {
  return word
    .toLowerCase()
    // Remover acentos usando NFD decomposition
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Remover caracteres especiais, mantendo apenas letras e números
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Gera um username único adicionando números se necessário
 * @param {string} baseUsername - Username base
 * @param {number} attempts - Número de tentativas
 * @returns {string} Username único
 */
export function generateUniqueUsername(baseUsername, attempts = 1) {
  if (attempts === 1) {
    return baseUsername;
  }
  return `${baseUsername}${attempts - 1}`;
}
