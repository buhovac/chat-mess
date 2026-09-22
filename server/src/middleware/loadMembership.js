import { prisma } from "../lib/prisma.js";

// Runs after requireAuth on any route mounted under /api/conversations/:id/...
// One query fetches both "does this conversation exist" (req.conversation)
// and "is the caller a member, and with what role" (req.membership) — every
// group route needs both, and fetching them separately would mean the same
// conversation row gets read twice per request.
//
// req.membership is shaped { conversationId, userId, role, conversationType }
// — exactly what src/policies/authorize.js's functions expect — so routes
// never have to assemble that object themselves.
export async function loadMembership(req, res, next) {
  try {
    const conversationId = req.params.id;
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        type: true,
        members: {
          where: { userId: req.user.id },
          select: { conversationId: true, userId: true, role: true },
        },
      },
    });

    req.conversation = conversation ?? null;
    const membership = conversation?.members[0];
    req.membership = membership ? { ...membership, conversationType: conversation.type } : null;

    next();
  } catch (err) {
    next(err);
  }
}
