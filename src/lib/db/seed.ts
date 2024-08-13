import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { authors, books } from "./schema";

async function seed() {
	const sql = neon(process.env.DATABASE_URL!);
	const db = drizzle(sql);

	await db.insert(authors).values([
		{
			name: "J.R.R. Tolkien",
			bio: "The creator of Middle-earth and author of The Lord of the Rings.",
		},
		{
			name: "George R.R. Martin",
			bio: "The author of the epic fantasy series A Song of Ice and Fire.",
		},
		{
			name: "J.K. Rowling",
			bio: "The creator of the Harry Potter series.",
		},
	]);

	const authorRows = await db.select().from(authors);
	const authorIds = authorRows.map((row) => row.id);

	await db.insert(books).values([
		{
			title: "The Fellowship of the Ring",
			authorId: authorIds[0],
		},
		{
			title: "The Two Towers",
			authorId: authorIds[0],
		},
		{
			title: "The Return of the King",
			authorId: authorIds[0],
		},
		{
			title: "A Game of Thrones",
			authorId: authorIds[1],
		},
		{
			title: "A Clash of Kings",
			authorId: authorIds[1],
		},
		{
			title: "Harry Potter and the Philosopher's Stone",
			authorId: authorIds[2],
		},
		{
			title: "Harry Potter and the Chamber of Secrets",
			authorId: authorIds[2],
		},
	]);
}

async function main() {
	try {
		await seed();
		console.log("Seeding completed");
	} catch (error) {
		console.error("Error during seeding:", error);
		process.exit(1);
	}
}

main();
