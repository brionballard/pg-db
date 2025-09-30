## Assumptions Made
This db package assumes you use [Google Secret Manager ](https://cloud.google.com/security/products/secret-manager?hl=en)
in production. It offers a way to load secrets and version secrets from local .env or the remote. 

This can easily be changed or removed from ```./src/config/secrets```.

### Row Level Encryption
If for whatever reason you need row level, column-based encryption, you can do that by defining specific encryption maps and declaring them in ```./src/db/encrypt.ts -> ENCRYPTION_MAPS```.

```typescript
const UserEncryption = {
    table: 'users',
    fields: [
        'email',
        'phone'
        // more columns to encrypt...
    ]
}
```

Generate an App Key for encryption or auth with ```npm run generate:key```. This will write or overwrite the .env APP_KEY.
If you plan to use the APP_KEY in production, be sure you have a mechanism of storing and rotating your APP_KEYs otherwise, you may find yourself in a spot with encrypted data and no ability to decrypt.

### Remote vs Local DB
This system was created to help with migration testing locally, but you could extend it for multiple database instances or use it for syncing remotes to your local etc. Otherwise, this code can be disregarded.


## Example Usage

```typescript
// src/Models/User.ts example
import Database from "../database/db";
import {NotFoundError} from "./NotFoundError";

const USER_TABLE = 'users';

type User = {
    id: number;
    name: string;
    email: string;
    phone?: string;
    password: string;
    created_at: string;
    last_modified_at: string;
}

type UserQueryOptions = {
    id?: string;
    email?: string;
    phone?: string;
}

async function getUsers(options: UserQueryOptions): Promise<User[]> {
    let {baseQuery, queryParams} = addFiltersToQuery(`SELECT * FROM ${USER_TABLE}`, buildQueryFilters(options));

    const result = await Database.query(baseQuery, queryParams);

    return result.rows as User[];
}

async function findUserById(id: number) {
    const query = `SELECT * FROM ${USER_TABLE} WHERE id = $1 LIMIT 1;`

    const result = await Database.query(baseQuery, [id]);
    if (result.length === 0) throw new NotFoundError(`User ${id} not found.`);
    
    return result.rows[0];
}

async function createUser (data: Omit<User, "id" | "created_at" | "last_modified_at">) {
    const password = hashPasswordSomehow(data.password);
    const params = [
        data.name,
        data.email,
        data?.phone,
        password
    ]; // Order here should correlate to order of columns in query

    const insertQuery = `
            INSERT INTO ${USER_TABLE} (name, email, phone, password)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
    
    const result = await Database.query(insertQuery, params);
    
    return result.rows[0];
}
```

# Everything else
Look at the package.json scripts
