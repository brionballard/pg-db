"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildQueryFilters = buildQueryFilters;
exports.addFiltersToQuery = addFiltersToQuery;
exports.buildUpdateQuery = buildUpdateQuery;
/**
 * Builds query filters dynamically from provided query options.
 *
 * @param {QueryOptions} queryOptions - A key-value object where keys are column names and values are the filter criteria.
 * @param {FilterOption[]} filterOptions - An optional array of existing filters to append to (defaults to an empty array).
 * @returns {FilterOption[]} - An array of FilterOption objects representing SQL conditions and their values.
 */
function buildQueryFilters(queryOptions, filterOptions = []) {
    const filters = filterOptions;
    // Iterate through each key-value pair in queryOptions
    for (const [key, value] of Object.entries(queryOptions)) {
        // Ignore undefined or null values
        if (value !== undefined && value !== null) {
            const operator = value.operator || '='; // Use specified operator or default to "="
            filters.push({
                // Construct the SQL condition using the key, operator, and parameter placeholder
                condition: `${key} ${operator} $${filters.length + 1}`,
                // Use the specified value or fallback to the value directly
                value: value.value || value,
            });
        }
    }
    return filters; // Return the updated list of filters
}
/**
 * Adds WHERE clauses to a base SQL query based on provided filters.
 *
 * @param {string} baseQuery - The base SQL query (e.g., "SELECT * FROM table_name").
 * @param {FilterOption[]} filters - An array of FilterOption objects representing SQL conditions and their values.
 * @returns {FilteredQuery} - An object containing the modified SQL query and the array of query parameter values.
 */
function addFiltersToQuery(baseQuery, filters) {
    const queryParams = []; // Holds the values for the query parameters
    // If no filters are provided, return the base query unchanged
    if (!filters.length) {
        return { baseQuery, queryParams };
    }
    // Map each filter into its SQL condition and push the corresponding value to queryParams
    const filterClauses = filters.map((filter, index) => {
        queryParams.push(filter.value); // Add the filter value to query parameters
        return filter.condition.replace(/\$\d+/g, `$${index + 1}`); // Replace placeholders to ensure proper indexing
    });
    // Join all filter conditions with "AND" and append them to the query as a WHERE clause
    const filterClause = ` WHERE ${filterClauses.join(' AND ')}`;
    baseQuery += filterClause;
    return {
        baseQuery, // The updated query with WHERE clauses
        queryParams, // The array of parameter values for the query
    };
}
/**
 * Builds an SQL `UPDATE` query dynamically.
 *
 * @param tableName - The table to update.
 * @param updates - The columns and their new values.
 * @param conditions - Optional conditions for the update (e.g., WHERE clause).
 * @returns {UpdateQuery} - An object containing the SQL query and parameter values.
 */
function buildUpdateQuery(tableName, updates, conditions) {
    if (Object.keys(updates).length === 0) {
        throw new Error('No fields provided for update.');
    }
    const setClauses = [];
    const values = [];
    let index = 1;
    // Build SET clause
    for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
            setClauses.push(`${key} = $${index}`);
            values.push(value);
            index++;
        }
    }
    // Base UPDATE query
    let query = `UPDATE ${tableName} SET ${setClauses.join(', ')}`;
    // Add conditions if provided
    if (conditions?.length) {
        const conditionClauses = conditions.map((filter, i) => {
            values.push(filter.value);
            return filter.condition.replace(/\$\d+/g, `$${index + i}`);
        });
        query += ` WHERE ${conditionClauses.join(' AND ')}`;
    }
    query += ' RETURNING *;';
    return { query, values };
}
