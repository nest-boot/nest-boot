export interface FilterOptions {
  /** Maximum nesting depth for filter queries. Default: 5 */
  maxDepth: number;
  /** Maximum number of field conditions in a filter. Default: 20 */
  maxConditions: number;
  /** Maximum number of branches in $or operator. Default: 5 */
  maxOrBranches: number;
  /** Maximum array length for $in/$nin/$contains/$overlap operators. Default: 100 */
  maxArrayLength: number;
  /** List of disabled operators, e.g., ['$fulltext'] */
  disabledOperators: string[];
}
