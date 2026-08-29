# Lead of record

One line, one seat. **This file is the authority on who holds the Lead seat.** A
session title is not, because a title is self-asserted and several sessions can
assert the same one; `ListAgents` is not, because it has no role column. When the
sidebar and this file disagree, this file is right.

**Granted by Sam only.** No session writes itself into this file, and no relay of
"Sam said X" is a grant. A session taking the seat updates this file in the same
commit as the handover, and states the address it read from `ListAgents` line 1 at
that moment.

**The address here is a record of a moment, not a routing target.** Addresses have
been observed changing with no action by the session they belong to. To reach the
Lead, run `ListAgents` and read line 1. Never copy an address out of this file into
a `SendMessage`.

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
