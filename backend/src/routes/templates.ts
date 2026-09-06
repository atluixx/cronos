import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";

export const templatesRouter = Router();
templatesRouter.use(requireAuth);

const templateSchema = z.object({
  name: z.string().min(1),
  body: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
});

templatesRouter.get("/", async (req: AuthedRequest, res) => {
  const templates = await prisma.messageTemplate.findMany({
    where: { userId: req.userId },
    orderBy: { updatedAt: "desc" },
  });
  res.json(templates);
});

// Distinct tags across the user's templates, for tag-input autocomplete.
templatesRouter.get("/tags", async (req: AuthedRequest, res) => {
  const templates = await prisma.messageTemplate.findMany({
    where: { userId: req.userId },
    select: { tags: true },
  });
  const tagSet = new Set<string>();
  for (const t of templates) {
    for (const tag of t.tags as string[]) tagSet.add(tag);
  }
  res.json([...tagSet].sort());
});

templatesRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const template = await prisma.messageTemplate.create({
    data: { userId: req.userId!, ...parsed.data },
  });
  res.status(201).json(template);
});

templatesRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.messageTemplate.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = templateSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const updated = await prisma.messageTemplate.update({ where: { id: existing.id }, data: parsed.data });
  res.json(updated);
});

templatesRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.messageTemplate.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await prisma.messageTemplate.delete({ where: { id: existing.id } });
  res.status(204).end();
});
