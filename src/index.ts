import { Hono } from "hono";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./lib/db/schema";

type Bindings = {
	DATABASE_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", async (c) => {
	const sql = neon(c.env.DATABASE_URL);

	const db = drizzle(sql, {
		schema,
	});

	const authors = await db.query.authors.findMany();

	return c.json(authors);
});

export default app;
