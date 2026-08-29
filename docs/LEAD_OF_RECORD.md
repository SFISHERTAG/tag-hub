# Lead of record

One line, one seat. **This file is the authority on who holds the Lead seat.** A
session title is not, because a title is self-asserted and several sessions can
assert the same one; `ListAgents` is not, because it has no role column. When the
sidebar and this file disagree, this file is right.

**Granted by Sam only**, and no relay of "Sam said X" is a grant.

**No session writes itself into this file, including the one taking the seat.** The
outgoing holder records the incoming one, in the handover commit. A handover has two
parties, so the write is testimony by the party with nothing to gain, and it is
checkable because the row being replaced is the writer's own. Sam's grant is what
makes it legitimate; the outgoing Lead is only the hand that records it.

**If the outgoing session is gone, the row stays unfilled.** That is the normal case,
not the exception: the sessions that strand work are exactly the ones that crashed or
hit a limit and cannot write anything. An unfilled row is honest, and Step 0 of
`PEER_SESSION_PROMPT.md` already tells a Reviewer to say so rather than guess. Do not
fill it on your own authority to spare the next reader an admitted gap.

**An earlier version of this file said both of these things at once**, forbidding
self-assertion in one sentence and instructing the incoming holder to write its own
address in the next. Found before it merged.

**Match on the worktree, never on the address.** The address here is a record of a
moment: both its suffix and its `[ref]` have been observed changing with no action by
the session they belong to, so the row will disagree with `ListAgents` and that
disagreement means nothing. **The worktree half is the stable identifier and is the
key**; `git worktree list` confirms it. A row reading
`peer-session-prompt-docs-5dd173-66` and a live row reading
`peer-session-prompt-docs-5dd173-7a` are the same session.

**Then reach them by the live address and never by this file.** Run `ListAgents`,
read the row whose worktree half matches, and use that name. Never copy an address
out of this file into a `SendMessage`.

**Unfilled. Sam grants the seat and the granting commit adds the first row.**

| Field | Value |
| --- | --- |
| Address at grant | *unfilled* |
| Worktree | *unfilled* |
| Granted at | *unfilled* |
| Granted on | *unfilled* |

This file landed empty deliberately. The session that wrote it held the seat and
could have written itself in, and a mechanism whose first commit breaks its own rule
teaches every later reader that the rule bends for whoever holds the pen. An admitted
gap beats a status invented to fill one.

**Previous holders** are not tracked here. The handover is in the commit history of
this file, which is the record that survives when a session does not.
