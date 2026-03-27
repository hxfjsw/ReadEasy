declare module 'wink-lemmatizer' {
  /**
   * Lemmatize a noun to its singular form
   * @param word - The noun to lemmatize
   * @returns The singular form
   */
  export function noun(word: string): string;
  
  /**
   * Lemmatize a verb to its base form
   * @param word - The verb to lemmatize
   * @returns The base form
   */
  export function verb(word: string): string;
  
  /**
   * Lemmatize an adjective to its base form
   * @param word - The adjective to lemmatize
   * @returns The base form
   */
  export function adjective(word: string): string;
  
  /**
   * Lemmatize a noun to its singular form (alias)
   * @param word - The noun to lemmatize
   * @returns The singular form
   */
  export function lemmatizeNoun(word: string): string;
  
  /**
   * Lemmatize a verb to its base form (alias)
   * @param word - The verb to lemmatize
   * @returns The base form
   */
  export function lemmatizeVerb(word: string): string;
  
  /**
   * Lemmatize an adjective to its base form (alias)
   * @param word - The adjective to lemmatize
   * @returns The base form
   */
  export function lemmatizeAdjective(word: string): string;
}
