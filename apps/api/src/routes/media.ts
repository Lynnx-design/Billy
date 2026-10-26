import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parse, type RouteDeps } from "../app";
import { media } from "../db/schema";
import { badRequest, notFound } from "../errors";

const MAX_BYTES = 2 * 1024 * 1024;
const uploadSchema = z.object({
  dataUrl: z.string().regex(/^data:image\/(jpeg|png|webp);base64,/, "Upload a JPG, PNG or WebP image"),
});

/**
 * Bill photos and profile pictures. The web app shrinks images before upload, so they are
 * small enough to keep in Postgres for now. Move to object storage when volume grows.
 */
export async function mediaRoutes(app: FastifyInstance, { ctx, auth }: RouteDeps) {
  app.post("/media", { config: { rateLimit: { max: 30, timeWindow: "10 minutes" } } }, async (req, reply) => {
    const user = await auth.requireUser(req);
    const { dataUrl } = parse(uploadSchema, req.body);
    const [header, base64] = dataUrl.split(",", 2);
    const mime = header.slice(5, header.indexOf(";"));
    const data = Buffer.from(base64, "base64");
    if (data.length === 0 || data.length > MAX_BYTES) throw badRequest("Images must be smaller than 2 MB");
    const [row] = await ctx.db.insert(media).values({ ownerId: user.id, mime, data }).returning({ id: media.id });
    reply.status(201);
    return { id: row.id, url: `/media/${row.id}` };
  });

  app.get<{ Params: { id: string } }>("/media/:id", async (req, reply) => {
    if (!z.string().uuid().safeParse(req.params.id).success) throw notFound();
    const [row] = await ctx.db.select().from(media).where(eq(media.id, req.params.id));
    if (!row) throw notFound();
    reply.header("Content-Type", row.mime);
    reply.header("Cache-Control", "public, max-age=31536000, immutable");
    return reply.send(row.data);
  });
}
