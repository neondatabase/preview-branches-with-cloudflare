import { Client } from "pg";

export default {
  async fetch(_request, env, ctx): Promise<Response> {
    // Hyperdrive provides a unique generated connection string to connect to
    // your database via Hyperdrive that can be used with your existing tools
    const client = new Client({
      connectionString: env.HYPERDRIVE.connectionString,
    });

    // NOTE: The plain connection URLs are also available for convenience:
    // - env.DATABASE_URL
    // - env.DATABASE_URL_UNPOOLED
    // console.log("DATABASE_URL", env.DATABASE_URL);
    // console.log("DATABASE_URL_UNPOOLED", env.DATABASE_URL_UNPOOLED);

    await client.connect();

    try {
      // Sample SQL query — reads from the `authors` table created and
      // seeded by the Drizzle migrations in src/lib/db/migrations/.
      const result = await client.query("SELECT * FROM authors ORDER BY id");

      // Clean up the client connection in the background
      ctx.waitUntil(client.end());

      return Response.json({ authors: result.rows });
    } catch (e) {
      return Response.json(
        { error: e instanceof Error ? e.message : e },
        { status: 500 },
      );
    }
  },
} satisfies ExportedHandler<Env>;
