import { mysqlTable, int, varchar, timestamp, boolean, float } from "drizzle-orm/mysql-core"

export const users = mysqlTable(
  'users',
  {
    name: varchar({ length: 128 }).notNull().primaryKey(),
    hash: varchar({ length: 60 }).notNull(),
    email: varchar({ length: 128 }).notNull(),
    verified: boolean().default(false),
    vkey: varchar({ length: 32 }),
    params: varchar({ length: 512 })
  }
);

export const games = mysqlTable(
  'games',
  {
    gid: int().notNull().autoincrement().primaryKey(),
    uname: varchar({ length: 128 }).notNull().references(() => users.name),
    type: varchar({ length: 5 }),
    time: int(),
    accuracy: float(),
    date: timestamp()
  }
);