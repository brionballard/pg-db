import Database from "../db";

const DEFAULT_PAGE_COUNT = 15;
const DEFAULT_PAGE = 1;

interface FilterOption {
    condition: string; // e.g., "status = $1"
    value: any;        // e.g., RegistrationStatus.APPROVED
    operator?: '=' | '<' | '>' | '<=' | '>=' | 'LIKE' | '!=' | '<>'
}

type SortValues = "ASC" | "DESC" | undefined

type PaginatedQueryResult<T> = {
    results: T[];
    totalRecords: number;
    totalPages: number;
    currentPage: number;
    perPage: number;
};

type QueryOptions = {
    tableName: string;
    filters?: FilterOption[];
    perPage?: number ;
    page?: number;
    sort?: 'ASC' | 'DESC';
    sortBy?: string; // specific column to sort by
};

async function fetchPaginatedResults<T>(options: QueryOptions): Promise<PaginatedQueryResult<T>> {
    let { tableName, filters = [], perPage  = DEFAULT_PAGE_COUNT , page = DEFAULT_PAGE, sort, sortBy } = options;

    const offset = perPage * (page - 1);

    let baseQuery = `SELECT * FROM ${tableName}`;
    let countQuery = `SELECT COUNT(*) FROM ${tableName}`;
    const queryParams: any[] = [];

    // Add filters if present
    if (filters.length > 0) {
        const filterClauses = filters.map((filter, index) => {
            queryParams.push(filter.value);
            return filter.condition.replace(/\$\d+/g, `$${index + 1}`); // Ensure positional params
        });
        const filterClause = ` WHERE ${filterClauses.join(' AND ')}`;
        baseQuery += filterClause;
        countQuery += filterClause;
    }

    // Add sorting if applicable
    if (sort && sortBy) {
        baseQuery += ` ORDER BY ${sortBy} ${sort}`;
    } else if (sort) {
        baseQuery += ` ORDER BY created_at ${sort}`;
    } else {
        baseQuery += " ORDER BY created_at DESC"; // Default to latest results
    }

    // Add pagination to data query
    baseQuery += ` LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(perPage, offset);

    // Execute count query
    const totalCountResult = await Database.query(countQuery, queryParams.slice(0, filters.length));
    const totalRecords = parseInt(totalCountResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalRecords / perPage);

    // Execute data query
    const result = await Database.query(baseQuery, queryParams);

    return {
        results: result.rows,
        totalRecords,
        totalPages,
        currentPage: page,
        perPage,
    };
}

/**
 * Removes any pagination related properties from query params.
 **/
function sanitizeQueryParams (params: Record<string, any>) {
        if (params.page) {
            delete params.page;
        }

        if (params.perPage) {
            delete params.perPage;
        }

        if (params?.sort) {
            delete params.sort
        }

        if (params?.sortBy) {
            delete params.sortBy
        }

        return params;
}

export { fetchPaginatedResults, QueryOptions, PaginatedQueryResult, FilterOption, sanitizeQueryParams, SortValues };
